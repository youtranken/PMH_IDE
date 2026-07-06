import { Inject, Injectable, Logger } from "@nestjs/common";
import { Pool } from "pg";
import { PG_POOL } from "../database/database.module";

export interface AuditEntry {
  actorUserId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  projectId?: string | null;
  ip?: string | null;
  detail?: Record<string, unknown>;
}

/**
 * Ghi audit tối thiểu (FR-29) — bản đầy đủ (xem theo phạm vi, archive) ở E6-S3.
 * Ở Epic 2 dùng để ghi các sự kiện bảo mật: break-glass login (nổi bật),
 * bật/tắt MFA, dùng recovery code, khóa/backoff.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /**
   * Tra cứu audit theo phạm vi (E6-S4, FR-30). SSA xem tất; project_admin chỉ
   * project mình (project_id NULL = sự kiện toàn cục — chỉ SSA thấy).
   */
  async query(opts: {
    isSsa: boolean;
    projectIds: string[];
    action?: string;
    limit: number;
    offset: number;
  }): Promise<unknown[]> {
    const where: string[] = [];
    const params: unknown[] = [];
    let p = 0;
    if (!opts.isSsa) {
      where.push(`a.project_id = ANY($${++p}::uuid[])`);
      params.push(opts.projectIds);
    }
    if (opts.action) {
      where.push(`a.action = $${++p}`);
      params.push(opts.action);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const { rows } = await this.pool.query(
      // Che định danh actor nếu là break-glass: giữ SỰ KIỆN (vd login.breakglass
      // vẫn hiện để biết có dùng khẩn cấp) nhưng KHÔNG lộ email/uuid tài khoản.
      `SELECT a.id,
              CASE WHEN u.is_breakglass THEN NULL ELSE a.actor_user_id END AS actor_user_id,
              CASE WHEN u.is_breakglass THEN NULL ELSE u.email END AS actor_email,
              a.action,
              a.target_type, a.target_id, a.project_id, a.ip::text AS ip,
              a.detail, a.created_at
       FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_user_id
       ${whereSql}
       ORDER BY a.id DESC LIMIT $${++p} OFFSET $${++p}`,
      [...params, opts.limit, opts.offset],
    );
    return rows;
  }

  async record(e: AuditEntry): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO audit_logs
           (actor_user_id, action, target_type, target_id, project_id, ip, detail)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          e.actorUserId ?? null,
          e.action,
          e.targetType ?? null,
          e.targetId ?? null,
          e.projectId ?? null,
          e.ip ?? null,
          e.detail ? JSON.stringify(e.detail) : null,
        ],
      );
    } catch (err) {
      // Audit KHÔNG được làm gãy luồng chính; log lỗi để giám sát
      this.logger.error(`Ghi audit thất bại (${e.action}): ${String(err)}`);
    }
  }
}
