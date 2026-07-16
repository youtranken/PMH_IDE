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
    // Shape khớp contract docs/integration/README (client đọc `type`, `event_id`,
    // và `groups` cho user.groups_changed). Trước đây gửi `event`/`seq` → client
    // (vd QLTS) parse theo doc bị 400. Giữ detail/at làm dữ liệu bổ sung.
    const payload = JSON.stringify({
      type: eventType,
      user_id: userId,
      event_id: String(rows[0].seq),
      // user.groups_changed: client cần DANH SÁCH group hiện tại (không phải delta).
      ...(eventType === "user.groups_changed"
        ? { groups: await this.currentGroupNames(userId) }
        : {}),
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

  /** TÊN các group hiện tại của user — dựng `groups` cho payload user.groups_changed. */
  private async currentGroupNames(userId: string): Promise<string[]> {
    const { rows } = await this.pool.query<{ name: string }>(
      `SELECT g.name FROM user_groups ug JOIN groups g ON g.id = ug.group_id
       WHERE ug.user_id = $1 ORDER BY g.name`,
      [userId],
    );
    return rows.map((r) => r.name);
  }
}
