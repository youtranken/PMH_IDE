import { randomInt } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import * as argon2 from "argon2";
import { Pool } from "pg";
import { SettingsService } from "../../config/settings.service";
import { PG_POOL } from "../../database/database.module";
import { EmailQueueService } from "../notifications/email-queue.service";

/**
 * Cấp mật khẩu tạm dùng chung (E4-S5, FR-15/16): user mới, admin reset, quên MK
 * (E4-S8). Sinh MK ngẫu nhiên đủ 4 lớp, set must_change_password + hạn (Settings
 * temp_password_ttl_hours), gửi qua email_queue (KHÔNG chặn request — AD-13).
 * Thu hồi phiên do NƠI GỌI quyết định (phạm vi theo thẩm quyền, FR-05).
 */
@Injectable()
export class TempPasswordService {
  private static readonly UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  private static readonly LOWER = "abcdefghijkmnpqrstuvwxyz";
  private static readonly DIGIT = "23456789";
  private static readonly SYM = "!@#$%*-_";

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly settings: SettingsService,
    private readonly emails: EmailQueueService,
  ) {}

  /** MK tạm 12 ký tự, đảm bảo ≥1 mỗi lớp (bỏ ký tự dễ nhầm 0/O/1/l/I). */
  private generate(): string {
    const all =
      TempPasswordService.UPPER +
      TempPasswordService.LOWER +
      TempPasswordService.DIGIT +
      TempPasswordService.SYM;
    const pick = (s: string) => s[randomInt(s.length)];
    const chars = [
      pick(TempPasswordService.UPPER),
      pick(TempPasswordService.LOWER),
      pick(TempPasswordService.DIGIT),
      pick(TempPasswordService.SYM),
    ];
    while (chars.length < 12) chars.push(pick(all));
    // Fisher-Yates để lớp bắt buộc không dồn đầu chuỗi
    for (let i = chars.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join("");
  }

  /**
   * Sinh + đặt MK tạm cho user, xếp email. Trả email đích (hoặc null nếu user
   * không tồn tại/đã xóa — nơi gọi giữ phản hồi ĐỒNG NHẤT cho luồng quên MK).
   */
  async issue(userId: string): Promise<string | null> {
    const { rows } = await this.pool.query<{ email: string; full_name: string }>(
      `SELECT email, full_name FROM users
       WHERE id = $1 AND deleted_at IS NULL`,
      [userId],
    );
    if (rows.length === 0) return null;
    const { email, full_name } = rows[0];

    const ttlHours = await this.settings.getInt("temp_password_ttl_hours", 24);
    const temp = this.generate();
    const hash = await argon2.hash(temp);
    await this.pool.query(
      `UPDATE users
       SET password_hash = $2,
           must_change_password = true,
           temp_password_expires_at = now() + make_interval(hours => $3),
           password_updated_at = now(),
           updated_at = now()
       WHERE id = $1`,
      [userId, hash, ttlHours],
    );

    await this.emails.enqueue(
      email,
      "Mật khẩu tạm — PMH ID",
      `<p>Chào ${escapeHtml(full_name)},</p>
       <p>Mật khẩu tạm của bạn: <b style="font-size:18px">${escapeHtml(temp)}</b></p>
       <p>Hết hạn sau <b>${ttlHours} giờ</b>. Hãy đăng nhập và đổi mật khẩu ngay ở lần đăng nhập kế.</p>`,
    );
    return email;
  }
}

/** Escape để MK/tên không phá HTML email (temp có ký tự &,<... đã lọc nhưng tên thì không). */
function escapeHtml(v: string): string {
  return v.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ] as string,
  );
}
