import {
  GoneException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Pool } from "pg";
import { AuditService } from "../../common/audit.service";
import { PG_POOL } from "../../database/database.module";
import type { DirClient } from "./directory.guard";

export interface DirUser {
  id: string;
  employee_code: string;
  email: string;
  full_name: string;
  status: string;
  groups: string[];
}

/**
 * Directory API (E7-S1, FR-26/AD-11). Scope theo client_groups của client:
 * chỉ user thuộc group ĐƯỢC CẤP; groups[] trả về = giao (user ∩ client) để
 * không lộ group ngoài phạm vi. allow_all_groups KHÔNG nới đọc ở đây. Không bao
 * giờ trả password. Rate-limit per-client (in-memory) + audit mọi truy vấn để
 * một secret rò không dump trọn PII im lặng.
 */
@Injectable()
export class DirectoryService {
  private static readonly MAX_LIMIT = 200;
  private static readonly RATE = 60; // request / cửa sổ
  private static readonly WINDOW_SEC = 60;

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly audit: AuditService,
  ) {}

  /**
   * Chặn per-client theo cửa sổ trượt trên Postgres (multi-instance-safe, thay
   * in-memory) — RATE request/60s. Đếm rồi ghi; quá → 429. Dòng cũ cron dọn.
   */
  private async rateLimit(clientId: string): Promise<void> {
    const { rows } = await this.pool.query<{ n: string }>(
      `SELECT count(*) AS n FROM directory_hits
       WHERE client_id = $1 AND at > now() - make_interval(secs => $2)`,
      [clientId, DirectoryService.WINDOW_SEC],
    );
    if (Number(rows[0].n) >= DirectoryService.RATE) {
      throw new HttpException(
        { error: "rate_limited" },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    await this.pool.query(
      `INSERT INTO directory_hits (client_id) VALUES ($1)`,
      [clientId],
    );
  }

  async listUsers(
    client: DirClient,
    opts: { includeDeleted: boolean; limit: number; offset: number; nowMs: number },
    ip: string | null,
  ): Promise<DirUser[]> {
    await this.rateLimit(client.clientId);
    const limit = Math.min(Math.max(opts.limit, 1), DirectoryService.MAX_LIMIT);
    // Luôn loại break-glass (phòng thủ — nó không có group nên hiện đã ẩn, nhưng
    // nếu lỡ gán group thì KHÔNG được lộ qua Directory API cho app ngoài).
    const delFilter =
      (opts.includeDeleted ? "" : "AND u.deleted_at IS NULL") +
      " AND u.is_breakglass = false";
    const { rows } = await this.pool.query<DirUser>(
      `SELECT u.id, u.employee_code, u.email, u.full_name, u.status,
              array_agg(DISTINCT g.name) AS groups
       FROM users u
       JOIN user_groups ug ON ug.user_id = u.id
       JOIN client_groups cg ON cg.group_id = ug.group_id
       JOIN groups g ON g.id = cg.group_id
       WHERE cg.client_id = $1 ${delFilter}
       GROUP BY u.id
       ORDER BY u.employee_code
       LIMIT $2 OFFSET $3`,
      [client.pk, limit, Math.max(opts.offset, 0)],
    );
    await this.audit.record({
      action: "directory.users_query",
      targetType: "client",
      targetId: client.clientId,
      ip,
      detail: { count: rows.length, include_deleted: opts.includeDeleted },
    });
    return rows;
  }

  async getUser(
    client: DirClient,
    userId: string,
    includeDeleted: boolean,
    ip: string | null,
  ): Promise<DirUser> {
    await this.rateLimit(client.clientId);
    const delFilter =
      (includeDeleted ? "" : "AND u.deleted_at IS NULL") +
      " AND u.is_breakglass = false";
    const { rows } = await this.pool.query<DirUser>(
      `SELECT u.id, u.employee_code, u.email, u.full_name, u.status,
              array_agg(DISTINCT g.name) AS groups
       FROM users u
       JOIN user_groups ug ON ug.user_id = u.id
       JOIN client_groups cg ON cg.group_id = ug.group_id
       JOIN groups g ON g.id = cg.group_id
       WHERE cg.client_id = $1 AND u.id = $2 ${delFilter}
       GROUP BY u.id`,
      [client.pk, userId],
    );
    if (rows.length === 0) {
      // Ngoài phạm vi HOẶC không tồn tại → 404 đồng nhất (không lộ tồn tại).
      throw new NotFoundException("user không tồn tại trong phạm vi");
    }
    await this.audit.record({
      action: "directory.user_get",
      targetType: "client",
      targetId: client.clientId,
      ip,
      detail: { user_id: userId },
    });
    return rows[0];
  }

  /**
   * Events feed đồng bộ (E7-S2, FR-27). Feed GLOBAL tối thiểu {seq,user_id,
   * event_type} — client resolve chi tiết qua Directory scoped (user rời phạm
   * vi → GET user 404 → client bỏ; xử lý đúng cả trường hợp rời group). Cursor
   * `since` cũ hơn dữ liệu còn giữ (đã dọn 90 ngày) → 410 full_resync_required,
   * KHÔNG trả 200 rỗng (client biết phải snapshot lại).
   */
  async listEvents(
    client: DirClient,
    since: number,
    limit: number,
    nowMs: number,
  ): Promise<{ events: unknown[]; cursor: number }> {
    void nowMs; // rate-limit chuyển sang Postgres (không dùng nowMs nữa)
    await this.rateLimit(client.clientId);
    const cap = Math.min(Math.max(limit, 1), DirectoryService.MAX_LIMIT);
    const { rows: b } = await this.pool.query<{
      mn: string | null;
      mx: string | null;
    }>(`SELECT min(seq) AS mn, max(seq) AS mx FROM user_events`);
    const mn = b[0].mn === null ? null : Number(b[0].mn);
    const mx = b[0].mx === null ? 0 : Number(b[0].mx);
    if (mn === null) return { events: [], cursor: 0 }; // chưa có sự kiện
    if (since < mn - 1) {
      // Có sự kiện sau `since` đã bị dọn (>90 ngày) → buộc resync. Kèm cursor
      // hiện tại để client snapshot qua Directory rồi poll tiếp từ đây.
      throw new GoneException({
        error: "full_resync_required",
        cursor: mx,
      });
    }
    const { rows } = await this.pool.query(
      // Ẩn break-glass khỏi MỌI đường directory (đồng bộ với list/getUser):
      // nếu tài khoản break-glass lỡ phát sự kiện, không lộ user_id ra ngoài.
      // CHỈ trả {seq,user_id,event_type} đúng hợp đồng tối thiểu — KHÔNG trả
      // `detail` (chứa group_id thêm/bớt) để feed global không lộ thay đổi
      // quyền của user thuộc tenant khác; client resolve chi tiết qua GET scoped.
      `SELECT ue.seq, ue.user_id, ue.event_type
       FROM user_events ue
       WHERE ue.seq > $1
         AND NOT EXISTS (
           SELECT 1 FROM users u
           WHERE u.id = ue.user_id AND u.is_breakglass = true
         )
       ORDER BY ue.seq LIMIT $2`,
      [since, cap],
    );
    const cursor = rows.length ? Number(rows[rows.length - 1].seq) : since;
    return { events: rows, cursor };
  }

  async listGroups(client: DirClient): Promise<{ id: string; name: string }[]> {
    await this.rateLimit(client.clientId);
    const { rows } = await this.pool.query<{ id: string; name: string }>(
      `SELECT g.id, g.name FROM client_groups cg JOIN groups g ON g.id = cg.group_id
       WHERE cg.client_id = $1 ORDER BY g.name`,
      [client.pk],
    );
    return rows;
  }
}
