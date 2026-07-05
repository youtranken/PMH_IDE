import { Inject, Injectable, Logger } from "@nestjs/common";
import { Pool } from "pg";
import { PG_POOL } from "../database/database.module";

/**
 * Phát sự kiện thay đổi user vào `user_events` (E7-S2, FR-27) — nguồn cho events
 * feed (polling) và webhook (E7-S3). seq tăng dần là con trỏ đồng bộ cho project
 * ngoài. Loại: user.created/locked/unlocked/deleted/reactivated/password_changed/
 * groups_changed. Không chặn luồng chính (lỗi chỉ nuốt qua try ở nơi gọi nếu cần).
 */
@Injectable()
export class UserEventsService {
  private readonly logger = new Logger(UserEventsService.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /**
   * Phát event + enqueue webhook. Lỗi KHÔNG được làm gãy thao tác chính (khóa/
   * đổi group... đã áp dụng xong trước khi gọi) — chỉ log, giống AuditService.
   */
  async emit(
    userId: string,
    eventType: string,
    detail?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.doEmit(userId, eventType, detail);
    } catch (e) {
      this.logger.error(`emit ${eventType} (user ${userId}) lỗi: ${String(e)}`);
    }
  }

  private async doEmit(
    userId: string,
    eventType: string,
    detail?: Record<string, unknown>,
  ): Promise<void> {
    const { rows } = await this.pool.query<{ seq: string; created_at: Date }>(
      `INSERT INTO user_events (user_id, event_type, detail) VALUES ($1, $2, $3)
       RETURNING seq, created_at`,
      [userId, eventType, detail ? JSON.stringify(detail) : null],
    );
    // Đẩy webhook (E7-S3) cho client CÓ webhook + trong phạm vi user (client_
    // groups). Worker gửi ngầm. user.deleted vẫn tới được (soft-delete giữ
    // user_groups). Chỉ enqueue; không chặn luồng chính.
    const payload = JSON.stringify({
      event: eventType,
      user_id: userId,
      seq: Number(rows[0].seq),
      detail: detail ?? null,
      at: rows[0].created_at,
    });
    await this.pool.query(
      `INSERT INTO webhook_deliveries (client_id, project_id, event, payload, target_url)
       SELECT DISTINCT c.id, c.project_id, $2, $3::jsonb, c.webhook_url
       FROM clients c
       JOIN client_groups cg ON cg.client_id = c.id
       JOIN user_groups ug ON ug.group_id = cg.group_id
       WHERE ug.user_id = $1 AND c.webhook_url IS NOT NULL AND NOT c.disabled`,
      [userId, eventType, payload],
    );
  }
}
