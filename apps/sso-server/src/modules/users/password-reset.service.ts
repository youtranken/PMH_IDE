import { createHash, randomBytes } from "node:crypto";
import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as argon2 from "argon2";
import { Pool } from "pg";
import { AuditService } from "../../common/audit.service";
import { SessionRevocationService } from "../../common/session-revocation.service";
import { SettingsService } from "../../config/settings.service";
import { PG_POOL } from "../../database/database.module";
import { escapeHtml, renderEmail } from "../notifications/email-layout";
import { EmailQueueService } from "../notifications/email-queue.service";
import { TempPasswordService } from "./temp-password.service";

/**
 * Đặt lại mật khẩu qua LINK (C2, thay ghi đè hash ở luồng quên MK). Token ngẫu
 * nhiên 256-bit gửi email; lưu HASH sha-256; hết hạn ngắn; dùng một lần. MK hiện
 * tại KHÔNG bị đụng cho tới khi user đặt MK mới → biết email không vô hiệu được
 * MK nạn nhân. Thu hồi mọi phiên sau khi đổi.
 */
@Injectable()
export class PasswordResetService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly settings: SettingsService,
    private readonly emails: EmailQueueService,
    private readonly audit: AuditService,
    private readonly revocation: SessionRevocationService,
    private readonly tempPassword: TempPasswordService,
    private readonly config: ConfigService,
  ) {}

  private hashToken(raw: string): string {
    return createHash("sha256").update(raw).digest("hex");
  }

  /** Origin canonical của portal cho link email — KHÔNG suy từ Host header (kẻ
   *  tấn công điều khiển được) mà từ PORTAL_REDIRECT_URI (env prod). */
  private baseUrl(): string {
    const first = this.config
      .get<string>("PORTAL_REDIRECT_URI")
      ?.split(",")[0]
      ?.trim();
    if (first) {
      try {
        return new URL(first).origin;
      } catch {
        /* rơi xuống mặc định */
      }
    }
    return "https://admin-de.pmh.com.vn:8443";
  }

  /**
   * Cấp link đặt lại MK. Vô hiệu các token chưa dùng cũ của user (giữ đúng một
   * link sống). Không có user (đã xóa/break-glass) → no-op (nơi gọi giữ phản hồi
   * đồng nhất, không lộ email tồn tại).
   */
  async issue(userId: string): Promise<void> {
    const { rows } = await this.pool.query<{ email: string; full_name: string }>(
      `SELECT email, full_name FROM users
       WHERE id = $1 AND deleted_at IS NULL AND is_breakglass = false`,
      [userId],
    );
    if (rows.length === 0) return;
    const { email, full_name } = rows[0];
    const ttlMin = await this.settings.getInt("password_reset_ttl_minutes", 30);
    const raw = randomBytes(32).toString("base64url");
    await this.pool.query(
      `UPDATE password_reset_tokens SET used_at = now()
       WHERE user_id = $1 AND used_at IS NULL`,
      [userId],
    );
    await this.pool.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, now() + make_interval(mins => $3))`,
      [userId, this.hashToken(raw), ttlMin],
    );
    const link = `${this.baseUrl()}/reset-password?token=${raw}`;
    await this.emails.enqueue(
      email,
      "Đặt lại mật khẩu — PMH ID",
      renderEmail({
        preheader: "Yêu cầu đặt lại mật khẩu tài khoản PMH ID của bạn.",
        heading: "Đặt lại mật khẩu",
        intro: `<p style="margin:0 0 12px;">Chào ${escapeHtml(full_name)},</p>
          <p style="margin:0;">Có yêu cầu đặt lại mật khẩu cho tài khoản PMH ID của bạn. Bấm nút dưới để đặt mật khẩu mới:</p>`,
        cta: { label: "Đặt lại mật khẩu", href: link },
        outro: `Nếu nút không bấm được, mở liên kết:<br>
          <a href="${escapeHtml(link)}" style="color:#0E4D45;word-break:break-all;">${escapeHtml(link)}</a><br><br>
          Liên kết hết hạn sau <b>${ttlMin} phút</b> và chỉ dùng được <b>một lần</b>. Nếu bạn <b>không</b> yêu cầu, hãy bỏ qua email này — mật khẩu hiện tại của bạn vẫn nguyên.`,
      }),
    );
  }

  /**
   * Đổi token lấy MK mới. Hợp lệ = chưa dùng + chưa hết hạn (khóa hàng FOR UPDATE
   * chống dùng lại đồng thời). Validate policy, đặt MK, đánh dấu đã dùng trong 1
   * txn; thu hồi phiên + audit sau commit (best-effort, không làm hỏng thành công).
   */
  async redeem(
    rawToken: string,
    newPassword: string,
    ip: string | null,
  ): Promise<void> {
    await this.tempPassword.assertPolicy(newPassword);
    const client = await this.pool.connect();
    let userId = "";
    try {
      await client.query("BEGIN");
      const { rows } = await client.query<{ id: string; user_id: string }>(
        `SELECT id, user_id FROM password_reset_tokens
         WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
         FOR UPDATE`,
        [this.hashToken(rawToken)],
      );
      if (rows.length === 0) {
        await client.query("ROLLBACK");
        throw new BadRequestException("Liên kết không hợp lệ hoặc đã hết hạn.");
      }
      userId = rows[0].user_id;
      // argon2.hash CHỈ chạy SAU khi token hợp lệ — token sai không ép server hash
      // (chống khuếch đại CPU-DoS bằng token rác). Token 256-bit nên không brute (vbsec P2-5).
      const hash = await argon2.hash(newPassword);
      await client.query(
        `UPDATE users
         SET password_hash = $2, must_change_password = false,
             temp_password_expires_at = NULL, password_updated_at = now(),
             updated_at = now()
         WHERE id = $1 AND deleted_at IS NULL AND is_breakglass = false`,
        [userId, hash],
      );
      await client.query(
        `UPDATE password_reset_tokens SET used_at = now() WHERE id = $1`,
        [rows[0].id],
      );
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client.release();
    }
    // Sau commit: thu hồi phiên + audit (best-effort, không rethrow).
    await this.revocation.revokeAllForUser(userId).catch(() => {});
    await this.audit
      .record({
        actorUserId: userId,
        action: "password.reset_completed",
        targetType: "user",
        targetId: userId,
        ip,
      })
      .catch(() => {});
  }
}
