import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from "@nestjs/common";
import { Pool, type PoolClient } from "pg";
import type { AdminContext } from "../../common/admin/admin.types";
import { PG_POOL } from "../../database/database.module";
import { parseCsv, splitGroups } from "./csv.util";
import { TempPasswordService } from "./temp-password.service";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REQUIRED_COLS = ["employee_code", "email", "full_name"];
/** Trần số dòng một lần nhập — chống một CSV khổng lồ băm argon2 chặn event loop. */
const MAX_ROWS = 5000;

interface RowData {
  employee_code: string;
  email: string;
  full_name: string;
  groups: string[];
}
type RowStatus = "ok" | "error" | "created" | "skipped" | "failed";
interface RowResult {
  line: number;
  data: RowData;
  status: RowStatus;
  errors: string[];
  newGroups: string[];
}
export interface ImportReport {
  total: number;
  ok: number;
  errorCount: number;
  created?: number;
  skipped?: number;
  failed?: number;
  rows: RowResult[];
}

/**
 * Nhập user hàng loạt từ CSV (E4-S3, FR-13). Preview soi lỗi TỪNG DÒNG (trùng
 * DB, trùng NỘI BỘ file, sai định dạng, group chưa tồn tại). Commit PER-ROW:
 * một dòng hỏng không kéo đổ cả mẻ. Email MK tạm đi qua email_queue nên tạo
 * user không rớt khi SMTP nghẽn (AD-13).
 */
@Injectable()
export class CsvImportService {
  private readonly logger = new Logger(CsvImportService.name);

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly tempPassword: TempPasswordService,
  ) {}

  async preview(
    csv: string,
    autoCreateGroups: boolean,
    admin: AdminContext,
  ): Promise<ImportReport> {
    const { rows } = await this.validate(csv, autoCreateGroups, admin);
    return this.summarize(rows);
  }

  async commit(
    csv: string,
    autoCreateGroups: boolean,
    admin: AdminContext,
  ): Promise<ImportReport> {
    const { rows } = await this.validate(csv, autoCreateGroups, admin);
    for (const r of rows) {
      if (r.status !== "ok") {
        r.status = "skipped"; // dòng lỗi ở preview → bỏ qua, giữ nguyên errors
        continue;
      }
      try {
        await this.createRow(r, autoCreateGroups);
        r.status = "created";
      } catch (e) {
        if ((e as { code?: string }).code === "23505") {
          r.status = "skipped";
          r.errors.push("đã tồn tại (trùng lúc ghi)");
        } else {
          r.status = "failed";
          r.errors.push(String((e as Error).message ?? e).slice(0, 200));
        }
      }
    }
    return this.summarize(rows);
  }

  /** Parse + validate mọi dòng (không ghi). Trả rows kèm status ok/error. */
  private async validate(
    csv: string,
    autoCreateGroups: boolean,
    admin: AdminContext,
  ): Promise<{ rows: RowResult[] }> {
    const grid = parseCsv(csv);
    if (grid.length === 0) throw new BadRequestException("CSV rỗng");
    if (grid.length - 1 > MAX_ROWS) {
      throw new BadRequestException(
        `CSV vượt ${MAX_ROWS} dòng — hãy chia nhỏ file`,
      );
    }

    const header = grid[0].map((h) => h.toLowerCase());
    const idx = {
      employee_code: header.indexOf("employee_code"),
      email: header.indexOf("email"),
      full_name: header.indexOf("full_name"),
      groups: header.indexOf("groups"),
    };
    const missing = REQUIRED_COLS.filter(
      (c) => idx[c as keyof typeof idx] === -1,
    );
    if (missing.length > 0) {
      throw new BadRequestException(
        `CSV thiếu cột bắt buộc: ${missing.join(", ")} (mẫu: employee_code,email,full_name,groups)`,
      );
    }

    // Nạp một lần: định danh đã có trong DB (kể cả deleted) + group đang tồn tại
    const [users, groups] = await Promise.all([
      this.pool.query<{ email: string; employee_code: string }>(
        `SELECT lower(email) AS email, employee_code FROM users`,
      ),
      this.pool.query<{ name: string }>(`SELECT lower(name) AS name FROM groups`),
    ]);
    const dbEmails = new Set(users.rows.map((u) => u.email));
    const dbCodes = new Set(users.rows.map((u) => u.employee_code));
    const dbGroups = new Set(groups.rows.map((g) => g.name));

    // project_admin chỉ được gán vào group THUỘC phạm vi project mình (như
    // assertCanManage) — chặn cấy user vào group của project khác qua import.
    // SSA bỏ qua. Group auto-tạo mới không gán client nào nên vô hại → cho phép.
    let scopedGroups: Set<string> | null = null;
    if (!admin.isSsa) {
      const sg = await this.pool.query<{ name: string }>(
        `SELECT DISTINCT lower(g.name) AS name
         FROM groups g JOIN client_groups cg ON cg.group_id = g.id
         JOIN clients c ON c.id = cg.client_id
         WHERE c.project_id = ANY($1::uuid[])`,
        [admin.projectIds],
      );
      scopedGroups = new Set(sg.rows.map((r) => r.name));
    }

    const seenEmails = new Set<string>();
    const seenCodes = new Set<string>();
    const rows: RowResult[] = [];

    for (let i = 1; i < grid.length; i++) {
      const cells = grid[i];
      const data: RowData = {
        employee_code: (cells[idx.employee_code] ?? "").trim(),
        email: (cells[idx.email] ?? "").trim(),
        full_name: (cells[idx.full_name] ?? "").trim(),
        groups:
          idx.groups === -1 ? [] : splitGroups(cells[idx.groups] ?? ""),
      };
      const errors: string[] = [];
      const newGroups: string[] = [];

      if (!data.employee_code) errors.push("thiếu employee_code");
      if (!data.full_name) errors.push("thiếu full_name");
      if (!EMAIL_RE.test(data.email)) errors.push("email không hợp lệ");

      const emailLc = data.email.toLowerCase();
      if (emailLc && seenEmails.has(emailLc))
        errors.push("email trùng trong file");
      if (data.employee_code && seenCodes.has(data.employee_code))
        errors.push("mã NV trùng trong file");
      if (emailLc && dbEmails.has(emailLc))
        errors.push("email đã có trong hệ thống (dùng reactivate)");
      if (data.employee_code && dbCodes.has(data.employee_code))
        errors.push("mã NV đã có trong hệ thống");

      for (const g of data.groups) {
        const gl = g.toLowerCase();
        if (!dbGroups.has(gl)) {
          if (autoCreateGroups) newGroups.push(g);
          else errors.push(`group chưa tồn tại: ${g}`);
        } else if (scopedGroups && !scopedGroups.has(gl)) {
          errors.push(`group ngoài phạm vi project của bạn: ${g}`);
        }
      }

      if (emailLc) seenEmails.add(emailLc);
      if (data.employee_code) seenCodes.add(data.employee_code);

      rows.push({
        line: i,
        data,
        status: errors.length ? "error" : "ok",
        errors,
        newGroups,
      });
    }
    return { rows };
  }

  /** Tạo 1 user + gán group (tạo group nếu cần) trong 1 txn; rồi phát MK tạm. */
  private async createRow(r: RowResult, autoCreate: boolean): Promise<void> {
    const client = await this.pool.connect();
    let userId: string;
    try {
      await client.query("BEGIN");
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO users (email, employee_code, full_name)
         VALUES ($1, $2, $3) RETURNING id`,
        [r.data.email, r.data.employee_code, r.data.full_name],
      );
      userId = rows[0].id;
      for (const g of r.data.groups) {
        const gid = await this.resolveGroup(client, g, autoCreate);
        if (gid) {
          await client.query(
            `INSERT INTO user_groups (user_id, group_id) VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [userId, gid],
          );
        }
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e; // user CHƯA tạo → dòng tính skipped/failed đúng nghĩa
    } finally {
      client.release();
    }
    // NGOÀI txn: user ĐÃ commit. Email MK tạm chỉ enqueue; lỗi ở đây KHÔNG được
    // biến dòng thành 'failed' (user vẫn tạo thành công) — chỉ log để admin reset.
    try {
      await this.tempPassword.issue(userId);
    } catch (e) {
      this.logger.error(
        `tạo user ${userId} OK nhưng phát MK tạm lỗi: ${String(e)}`,
      );
    }
  }

  private async resolveGroup(
    client: PoolClient,
    name: string,
    autoCreate: boolean,
  ): Promise<string | null> {
    const found = await client.query<{ id: string }>(
      `SELECT id FROM groups WHERE lower(name) = lower($1)`,
      [name],
    );
    if (found.rows.length > 0) return found.rows[0].id;
    if (!autoCreate) return null;
    const created = await client.query<{ id: string }>(
      `INSERT INTO groups (name) VALUES ($1)
       ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      [name],
    );
    return created.rows[0].id;
  }

  private summarize(rows: RowResult[]): ImportReport {
    const count = (s: RowStatus) => rows.filter((r) => r.status === s).length;
    return {
      total: rows.length,
      ok: count("ok"),
      errorCount: count("error"),
      created: count("created"),
      skipped: count("skipped"),
      failed: count("failed"),
      rows,
    };
  }
}
