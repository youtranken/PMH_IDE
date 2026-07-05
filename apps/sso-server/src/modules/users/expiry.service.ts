import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Pool } from "pg";
import { AuditService } from "../../common/audit.service";
import { SessionRevocationService } from "../../common/session-revocation.service";
import { SettingsService } from "../../config/settings.service";
import { PG_POOL } from "../../database/database.module";
import { EmailQueueService } from "../notifications/email-queue.service";

/**
 * Tài khoản có hạn (E4-S6, FR-18). Cron mỗi giờ (UTC — now() của PG là UTC):
 *   1. quá expires_at → auto-lock + thu hồi phiên.
 *   2. sắp hết hạn ≤ N ngày → email cảnh báo MỘT LẦN (cột expiry_warning_sent_at).
 * Không chặn request; lỗi cron chỉ log (AD-13).
 */
@Injectable()
export class ExpiryService {
  private readonly logger = new Logger(ExpiryService.name);

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly settings: SettingsService,
    private readonly emails: EmailQueueService,
    private readonly revocation: SessionRevocationService,
    private readonly audit: AuditService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async run(): Promise<void> {
    try {
      await this.autoLock();
      await this.sendWarnings();
    } catch (e) {
      this.logger.error(`expiry cron lỗi: ${String(e)}`);
    }
  }

  /** Khóa user đã quá hạn + thu hồi phiên. */
  private async autoLock(): Promise<void> {
    const { rows } = await this.pool.query<{ id: string }>(
      `UPDATE users SET status = 'locked', updated_at = now()
       WHERE expires_at IS NOT NULL AND expires_at < now()
         AND status = 'active' AND deleted_at IS NULL
       RETURNING id`,
    );
    for (const { id } of rows) {
      const revoked = await this.revocation.revokeAllForUser(id);
      await this.audit.record({
        actorUserId: null,
        action: "user.expired_locked",
        targetType: "user",
        targetId: id,
        detail: { revoked_sessions: revoked },
      });
    }
    if (rows.length > 0) this.logger.log(`auto-lock ${rows.length} user hết hạn`);
  }

  /** Email cảnh báo cho user sắp hết hạn trong N ngày (gửi một lần). */
  private async sendWarnings(): Promise<void> {
    const days = await this.settings.getInt("expiry_warning_days", 7);
    const { rows } = await this.pool.query<{
      id: string;
      email: string;
      full_name: string;
      expires_at: Date;
    }>(
      `UPDATE users SET expiry_warning_sent_at = now()
       WHERE id IN (
         SELECT id FROM users
         WHERE expires_at IS NOT NULL AND status = 'active' AND deleted_at IS NULL
           AND expires_at > now()
           AND expires_at <= now() + make_interval(days => $1)
           AND expiry_warning_sent_at IS NULL
       )
       RETURNING id, email, full_name, expires_at`,
      [days],
    );
    for (const u of rows) {
      const dateStr = u.expires_at.toISOString().slice(0, 10);
      await this.emails.enqueue(
        u.email,
        "Tài khoản PMH ID sắp hết hạn",
        `<p>Chào ${escapeHtml(u.full_name)},</p>
         <p>Tài khoản của bạn sẽ hết hạn vào <b>${dateStr}</b> và bị khóa tự động.</p>
         <p>Liên hệ quản trị nếu cần gia hạn.</p>`,
      );
    }
    if (rows.length > 0) this.logger.log(`gửi cảnh báo hết hạn cho ${rows.length} user`);
  }
}

function escapeHtml(v: string): string {
  return v.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ] as string,
  );
}
