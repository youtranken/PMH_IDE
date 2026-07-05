import { Inject, Injectable } from "@nestjs/common";
import { Pool } from "pg";
import { SettingsService } from "../../config/settings.service";
import { PG_POOL } from "../../database/database.module";

/**
 * Chống dò mật khẩu (E2-S3, AD-9): BACKOFF tăng dần theo số lần thất bại gần
 * đây, KHÔNG lockout cứng → kẻ tấn công không thể khóa tài khoản người thật,
 * và SSA không bao giờ bị khóa từ ngoài (chỉ chậm lại). Reset khi đăng nhập
 * đúng. Ghi mọi lần thử vào `login_attempts`. Tham số trong Settings.
 *
 * `identifier` = email (đường /interaction/login) hoặc client_id (/oidc/token).
 */
@Injectable()
export class RateLimitService {
  private static readonly WINDOW = "15 minutes";

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly settings: SettingsService,
  ) {}

  async record(
    identifier: string,
    clientId: string | null,
    ip: string | null,
    success: boolean,
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO login_attempts (identifier, client_id, ip, success)
       VALUES ($1, $2, $3, $4)`,
      [identifier.toLowerCase(), clientId, ip, success],
    );
  }

  /**
   * Số giây phải chờ trước lần thử kế (0 = cho thử ngay). Tính theo số lần
   * THẤT BẠI LIÊN TIẾP gần nhất (tính từ lần thành công gần nhất trong cửa sổ).
   */
  async retryAfterSeconds(identifier: string): Promise<number> {
    const threshold = await this.settings.getInt(
      "bruteforce_account_threshold",
      5,
    );
    const maxDelay = await this.settings.getInt("bruteforce_backoff_seconds", 900);

    const { rows } = await this.pool.query<{
      created_at: Date;
      success: boolean;
    }>(
      `SELECT created_at, success FROM login_attempts
       WHERE identifier = $1 AND created_at > now() - interval '${RateLimitService.WINDOW}'
       ORDER BY created_at DESC
       LIMIT 100`,
      [identifier.toLowerCase()],
    );

    // Đếm thất bại liên tiếp từ mới nhất tới lần thành công đầu tiên
    let consecutiveFails = 0;
    let lastFailAt: Date | null = null;
    for (const r of rows) {
      if (r.success) break;
      if (!lastFailAt) lastFailAt = r.created_at;
      consecutiveFails++;
    }

    if (consecutiveFails < threshold || !lastFailAt) return 0;

    // delay = 2^(vượt ngưỡng) giây, chặn trần maxDelay
    const over = consecutiveFails - threshold;
    const delaySec = Math.min(maxDelay, 2 ** over);
    const elapsedSec = (Date.now() - lastFailAt.getTime()) / 1000;
    return Math.max(0, Math.ceil(delaySec - elapsedSec));
  }

  /**
   * Lớp chặn theo IP (AD-9) — bắt password-spraying: MỘT IP thử nhiều ACCOUNT
   * khác nhau (backoff-theo-account không thấy vì mỗi account chỉ vài lần).
   * Đếm TỔNG lần thất bại từ IP trong cửa sổ; quá ngưỡng (Settings, cao hơn
   * account) → backoff. Ngưỡng chỉnh runtime theo metric thật.
   */
  async retryAfterSecondsByIp(ip: string | null): Promise<number> {
    if (!ip) return 0;
    const threshold = await this.settings.getInt("bruteforce_ip_threshold", 20);
    const maxDelay = await this.settings.getInt("bruteforce_backoff_seconds", 900);
    const { rows } = await this.pool.query<{ n: string; last: Date | null }>(
      `SELECT count(*) AS n, max(created_at) AS last
       FROM login_attempts
       WHERE ip = $1 AND success = false
         AND created_at > now() - interval '${RateLimitService.WINDOW}'`,
      [ip],
    );
    const n = Number(rows[0].n);
    const last = rows[0].last;
    if (n < threshold || !last) return 0;
    const over = n - threshold;
    const delaySec = Math.min(maxDelay, 2 ** over);
    const elapsedSec = (Date.now() - last.getTime()) / 1000;
    return Math.max(0, Math.ceil(delaySec - elapsedSec));
  }
}
