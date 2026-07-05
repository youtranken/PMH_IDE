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
  private static readonly WINDOW_MS = 60_000;
  private readonly hits = new Map<string, number[]>();

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly audit: AuditService,
  ) {}

  /** Chặn per-client theo cửa sổ trượt (RATE/phút). Ném 403 nếu quá (dùng làm 429 ở controller). */
  private rateLimit(clientId: string, nowMs: number): void {
    const arr = (this.hits.get(clientId) ?? []).filter(
      (t) => nowMs - t < DirectoryService.WINDOW_MS,
    );
    if (arr.length >= DirectoryService.RATE) {
      throw new HttpException(
        { error: "rate_limited" },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    arr.push(nowMs);
    this.hits.set(clientId, arr);
  }

  async listUsers(
    client: DirClient,
    opts: { includeDeleted: boolean; limit: number; offset: number; nowMs: number },
    ip: string | null,
  ): Promise<DirUser[]> {
    this.rateLimit(client.clientId, opts.nowMs);
    const limit = Math.min(Math.max(opts.limit, 1), DirectoryService.MAX_LIMIT);
    const delFilter = opts.includeDeleted ? "" : "AND u.deleted_at IS NULL";
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
    const delFilter = includeDeleted ? "" : "AND u.deleted_at IS NULL";
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
    this.rateLimit(client.clientId, nowMs);
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
      `SELECT seq, user_id, event_type, detail, created_at
       FROM user_events WHERE seq > $1 ORDER BY seq LIMIT $2`,
      [since, cap],
    );
    const cursor = rows.length ? Number(rows[rows.length - 1].seq) : since;
    return { events: rows, cursor };
  }

  async listGroups(client: DirClient): Promise<{ id: string; name: string }[]> {
    const { rows } = await this.pool.query<{ id: string; name: string }>(
      `SELECT g.id, g.name FROM client_groups cg JOIN groups g ON g.id = cg.group_id
       WHERE cg.client_id = $1 ORDER BY g.name`,
      [client.pk],
    );
    return rows;
  }
}
