import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Pool } from "pg";
import { PG_POOL } from "../../database/database.module";

/**
 * Dọn bảng nóng (AD-13): oidc_payloads hết hạn (adapter chỉ LỌC khi đọc, không
 * xóa → phình vô hạn nếu không dọn) + login_attempts cũ. Chạy mỗi giờ.
 */
@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);
  private static readonly LOGIN_ATTEMPTS_KEEP_DAYS = 30;
  private static readonly USER_EVENTS_KEEP_DAYS = 90;

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  @Cron(CronExpression.EVERY_HOUR)
  async cleanup(): Promise<void> {
    try {
      const oidc = await this.pool.query(
        `DELETE FROM oidc_payloads WHERE expires_at IS NOT NULL AND expires_at < now()`,
      );
      const attempts = await this.pool.query(
        `DELETE FROM login_attempts
         WHERE created_at < now() - make_interval(days => $1)`,
        [CleanupService.LOGIN_ATTEMPTS_KEEP_DAYS],
      );
      // Secret rotate hết ân hạn → revoked (E5-S6, AD-12). Middleware đã bỏ qua
      // secret retiring quá hạn; đây chỉ dọn trạng thái cho gọn + giữ dấu vết.
      const secrets = await this.pool.query(
        `UPDATE client_secrets SET status = 'revoked', revoked_at = now()
         WHERE status = 'retiring' AND expires_at < now()`,
      );
      // Events feed giữ 90 ngày (E7-S2, FR-27) — cursor cũ hơn → 410 resync.
      const events = await this.pool.query(
        `DELETE FROM user_events
         WHERE created_at < now() - make_interval(days => $1)`,
        [CleanupService.USER_EVENTS_KEEP_DAYS],
      );
      // Rate-limit Directory chỉ cần cửa sổ 60s → dọn dòng cũ hơn 5 phút.
      await this.pool.query(
        `DELETE FROM directory_hits WHERE at < now() - interval '5 minutes'`,
      );
      const nOidc = oidc.rowCount ?? 0;
      const nAtt = attempts.rowCount ?? 0;
      const nSec = secrets.rowCount ?? 0;
      const nEv = events.rowCount ?? 0;
      if (nOidc + nAtt + nSec + nEv > 0) {
        this.logger.log(
          `dọn: ${nOidc} oidc_payloads, ${nAtt} login_attempts, ${nSec} client_secret, ${nEv} user_events cũ`,
        );
      }
    } catch (e) {
      this.logger.error(`cleanup lỗi: ${String(e)}`);
    }
  }
}
