import { createGzip, gunzipSync } from "node:zlib";
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
} from "node:fs";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Pool } from "pg";
import { SettingsService } from "../../config/settings.service";
import { PG_POOL } from "../../database/database.module";

/**
 * Nén & lưu trữ audit log (E3-S6, FR-31/AD-13). Bất biến an toàn (sau review):
 * - CHỈ archive các tháng TRỌN VẸN nằm trước cutoff → mỗi tháng ghi đúng một
 *   lần, không bao giờ ghi đè file tháng-dở → không mất dữ liệu.
 * - Cutoff chốt MỘT mốc (đọc DB một lần) dùng cho cả SELECT lẫn DELETE → không
 *   có khe now()-tăng làm xóa bản chưa kịp ghi.
 * - Stream theo lô id (không SELECT * cả tháng vào RAM) → không OOM process IdP.
 */
@Injectable()
export class AuditArchiveService {
  private readonly logger = new Logger(AuditArchiveService.name);
  private static readonly BATCH = 1000;

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly settings: SettingsService,
  ) {}

  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async monthlyArchive(): Promise<void> {
    try {
      const n = await this.archiveOlderThan(365);
      if (n > 0) this.logger.log(`Đã nén & lưu trữ ${n} audit log cũ`);
    } catch (e) {
      this.logger.error(`archive audit lỗi: ${String(e)}`);
    }
  }

  /** Liệt kê file lưu trữ tháng (E6-S4) — mới nhất trước. */
  async listArchives(): Promise<string[]> {
    const dir = await this.settings.get("audit_archive_path", "/archive");
    if (!dir || !existsSync(dir)) return [];
    return readdirSync(dir)
      .filter((f) => /^audit-\d{4}-\d{2}\.jsonl\.gz$/.test(f))
      .map((f) => f.replace(/^audit-(\d{4}-\d{2})\.jsonl\.gz$/, "$1"))
      .sort()
      .reverse();
  }

  /** Giải nén file tháng đã lưu trữ → mảng bản ghi (E6-S4, FR-31). */
  async readArchive(month: string): Promise<unknown[]> {
    // month YYYY-MM cứng → chặn path traversal (không cho ../).
    if (!/^\d{4}-\d{2}$/.test(month)) {
      throw new BadRequestException("tháng không hợp lệ (YYYY-MM)");
    }
    const dir = await this.settings.get("audit_archive_path", "/archive");
    const file = join(dir ?? "/archive", `audit-${month}.jsonl.gz`);
    if (!existsSync(file)) throw new NotFoundException("không có lưu trữ tháng này");
    const text = gunzipSync(readFileSync(file)).toString("utf8");
    return text
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l));
  }

  /** Nén các THÁNG TRỌN VẸN trước (now - days) → .jsonl.gz, xóa khỏi bảng nóng. */
  async archiveOlderThan(days: number): Promise<number> {
    const dir = await this.settings.get("audit_archive_path", "/archive");
    if (!dir) return 0;
    mkdirSync(dir, { recursive: true });

    // Chốt cutoff MỘT lần = đầu tháng-cutoff, và lấy bản ghi CŨ NHẤT còn lại.
    // Trước đây danh sách tháng lấy bằng `SELECT DISTINCT to_char(created_at,…)`
    // — to_char không sargable nên quét TOÀN BẢNG, và với statement_timeout=10s
    // thì job im lặng chết ở đây, audit_logs phình vĩnh viễn. min(created_at)
    // dùng được index nên rẻ, rồi tự duyệt tháng bằng vòng lặp.
    // Duyệt tháng TÍNH HOÀN TOÀN TRONG SQL. Không đưa mốc tháng qua JS Date:
    // date_trunc trả mốc theo TimeZone phiên (Asia/Bangkok), đầu tháng 7 giờ VN
    // là 2026-06-30T17:00Z → getUTCMonth() đọc ra tháng 6, lệch nguyên 1 tháng.
    // generate_series + to_char giữ mọi thứ trong cùng một hệ quy chiếu với
    // range predicate ($1||'-01')::timestamptz bên dưới.
    const { rows: months } = await this.pool.query<{ ym: string }>(
      `SELECT to_char(m, 'YYYY-MM') AS ym
       FROM generate_series(
         (SELECT date_trunc('month', min(created_at)) FROM audit_logs),
         date_trunc('month', now() - make_interval(days => $1))
           - interval '1 month',
         interval '1 month'
       ) AS m
       ORDER BY m`,
      [days],
    );

    let total = 0;
    // Chỉ các tháng HOÀN TOÀN trước tháng-cutoff (tháng trọn vẹn)
    for (const { ym } of months) {
      const file = join(dir, `audit-${ym}.jsonl.gz`);
      const count = await this.streamMonthToFile(ym, file);
      if (count > 0) {
        // Tháng trọn vẹn → mọi bản ghi của ym đều thuộc diện lưu trữ; xóa cả
        // tháng bằng range predicate (dùng audit_logs_created_idx).
        await this.pool.query(
          `DELETE FROM audit_logs
           WHERE created_at >= ($1 || '-01')::timestamptz
             AND created_at <  ($1 || '-01')::timestamptz + interval '1 month'`,
          [ym],
        );
        this.logger.log(`audit ${ym}: ${count} bản → ${file}`);
      }
      total += count;
    }
    return total;
  }

  /** Đọc bản ghi tháng theo lô id (không nạp cả tháng vào RAM), ghi gzip. */
  private async streamMonthToFile(ym: string, file: string): Promise<number> {
    const pool = this.pool;
    let count = 0;
    async function* lines(): AsyncGenerator<string> {
      let lastId = "0";
      for (;;) {
        const { rows } = await pool.query(
          // Range predicate (dùng audit_logs_created_idx) thay cho to_char —
          // to_char không sargable nên mỗi lô quét lại toàn bảng.
          `SELECT * FROM audit_logs
           WHERE created_at >= ($1 || '-01')::timestamptz
             AND created_at <  ($1 || '-01')::timestamptz + interval '1 month'
             AND id > $2
           ORDER BY id LIMIT $3`,
          [ym, lastId, AuditArchiveService.BATCH],
        );
        if (rows.length === 0) break;
        for (const r of rows) {
          count++;
          yield JSON.stringify(r) + "\n";
        }
        lastId = String(rows[rows.length - 1].id);
        if (rows.length < AuditArchiveService.BATCH) break;
      }
    }
    await pipeline(Readable.from(lines()), createGzip(), createWriteStream(file));
    return count;
  }
}
