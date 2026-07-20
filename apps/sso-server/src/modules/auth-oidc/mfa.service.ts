import { randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import * as argon2 from "argon2";
import { authenticator } from "otplib";
import { Pool } from "pg";
import { KekService } from "../../common/kek.service";
import { PG_POOL } from "../../database/database.module";

// Chấp nhận ±1 bước 30s (window=1) — dung sai lệch đồng hồ thiết bị/server và
// biên khi user gõ mã ở cuối bước. window=0 (mặc định) làm SSA fail mã đúng.
authenticator.options = { window: 1 };
const TOTP_PERIOD = 30; // giây/bước — khớp mặc định otplib (dùng tính step).

/** Step tuyệt đối của mã đang khớp (để chống replay one-time, M5). null nếu sai. */
function matchedStep(code: string, secret: string): number | null {
  const delta = authenticator.checkDelta(code, secret);
  if (delta === null || delta === undefined) return null;
  return Math.floor(Date.now() / 1000 / TOTP_PERIOD) + delta;
}

export interface MfaStatus {
  enabled: boolean;
  isBreakglass: boolean;
}

/**
 * MFA TOTP cho SSA (E2-S1) + recovery codes/break-glass (E2-S2). Secret TOTP
 * mã hóa bằng KEK (AD-15). Break-glass (is_breakglass) BỎ QUA enforcement MFA
 * — không hard-code email.
 */
@Injectable()
export class MfaService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly kek: KekService,
  ) {}

  /** MFA đã bật cho user? + có phải tài khoản break-glass? */
  async status(userId: string): Promise<MfaStatus> {
    const { rows } = await this.pool.query<{
      enabled: boolean | null;
      is_breakglass: boolean;
    }>(
      `SELECT m.enabled, u.is_breakglass
       FROM users u LEFT JOIN mfa_totp m ON m.user_id = u.id
       WHERE u.id = $1`,
      [userId],
    );
    const r = rows[0];
    return {
      enabled: !!r?.enabled,
      isBreakglass: !!r?.is_breakglass,
    };
  }

  /**
   * Bắt buộc MFA khi login? = MFA đã bật VÀ không phải break-glass.
   * (Phase này chỉ SSA bật MFA; project_admin/user thường chưa bắt buộc.)
   */
  async isRequired(userId: string): Promise<boolean> {
    const s = await this.status(userId);
    return s.enabled && !s.isBreakglass;
  }

  /** Bước enroll 1: sinh secret (chưa bật), trả otpauth URI để render QR. */
  async beginEnroll(userId: string, accountLabel: string): Promise<string> {
    const secret = authenticator.generateSecret();
    const enc = this.kek.encrypt(secret);
    await this.pool.query(
      `INSERT INTO mfa_totp (user_id, totp_secret_enc, enabled)
       VALUES ($1, $2, false)
       ON CONFLICT (user_id) DO UPDATE SET totp_secret_enc = EXCLUDED.totp_secret_enc,
         enabled = false, last_totp_step = NULL`,
      [userId, enc],
    );
    return authenticator.keyuri(accountLabel, "PMH ID", secret);
  }

  /** Bước enroll 2: xác nhận một mã đúng → bật MFA. */
  async confirmEnroll(userId: string, code: string): Promise<boolean> {
    const secret = await this.loadSecret(userId);
    if (!secret) return false;
    const step = matchedStep(code, secret);
    if (step === null) return false;
    // Ghi step xác nhận → mã enroll này KHÔNG replay lại được làm mã đăng nhập.
    await this.pool.query(
      `UPDATE mfa_totp SET enabled = true, last_totp_step = $2 WHERE user_id = $1`,
      [userId, step],
    );
    return true;
  }

  /** Verify mã TOTP lúc đăng nhập — ONE-TIME: chỉ nhận step MỚI hơn lần trước
   *  (chống replay mã đã lộ trong cửa sổ ~90s, M5). */
  async verifyTotp(userId: string, code: string): Promise<boolean> {
    const secret = await this.loadSecret(userId);
    if (!secret) return false;
    const step = matchedStep(code, secret);
    if (step === null) return false;
    // Cập nhật nguyên tử: rowCount=0 nghĩa là step này (hoặc cũ hơn) đã dùng →
    // từ chối replay. Điều kiện < $2 để mã của bước trước không dùng lại được.
    const res = await this.pool.query(
      `UPDATE mfa_totp SET last_totp_step = $2
       WHERE user_id = $1 AND (last_totp_step IS NULL OR last_totp_step < $2)`,
      [userId, step],
    );
    return (res.rowCount ?? 0) === 1;
  }

  /** Sinh 10 recovery code, lưu hash, trả plaintext để hiện MỘT LẦN. */
  async generateRecoveryCodes(userId: string): Promise<string[]> {
    await this.pool.query(`DELETE FROM mfa_recovery WHERE user_id = $1`, [
      userId,
    ]);
    const codes: string[] = [];
    for (let i = 0; i < 10; i++) {
      // 64-bit entropy (16 hex), chia 4 nhóm XXXX-XXXX-XXXX-XXXX dễ đọc/nhập.
      const raw = randomBytes(8).toString("hex").toUpperCase();
      const code = (raw.match(/.{4}/g) ?? [raw]).join("-");
      codes.push(code);
      const hash = await argon2.hash(code);
      await this.pool.query(
        `INSERT INTO mfa_recovery (user_id, code_hash) VALUES ($1, $2)`,
        [userId, hash],
      );
    }
    return codes;
  }

  /** Dùng một recovery code: đúng & chưa dùng → đánh dấu used, trả true. */
  async consumeRecoveryCode(userId: string, code: string): Promise<boolean> {
    const normalized = code.trim().toUpperCase();
    const { rows } = await this.pool.query<{ id: string; code_hash: string }>(
      `SELECT id, code_hash FROM mfa_recovery
       WHERE user_id = $1 AND used_at IS NULL`,
      [userId],
    );
    for (const r of rows) {
      if (await argon2.verify(r.code_hash, normalized)) {
        // Đánh dấu đã dùng NGUYÊN TỬ (chỉ khi còn chưa dùng)
        const res = await this.pool.query(
          `UPDATE mfa_recovery SET used_at = now()
           WHERE id = $1 AND used_at IS NULL`,
          [r.id],
        );
        return (res.rowCount ?? 0) === 1;
      }
    }
    return false;
  }

  private async loadSecret(userId: string): Promise<string | null> {
    const { rows } = await this.pool.query<{ totp_secret_enc: Buffer }>(
      `SELECT totp_secret_enc FROM mfa_totp WHERE user_id = $1`,
      [userId],
    );
    if (rows.length === 0) return null;
    return this.kek.decrypt(rows[0].totp_secret_enc);
  }
}
