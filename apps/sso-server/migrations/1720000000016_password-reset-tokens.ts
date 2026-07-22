import type { MigrationBuilder } from "node-pg-migrate";

/**
 * C2 — Quên mật khẩu bằng LINK ĐẶT LẠI (reset token) thay cho ghi đè thẳng
 * password_hash. Trước đây /auth/forgot-password đặt luôn MK tạm vào users →
 * kẻ CHƯA xác thực biết email là vô hiệu được MK hiện tại của bất kỳ ai (DoS/
 * khóa cửa) và là mắt xích chiếm tài khoản. Nay gửi token 256-bit qua email;
 * KHÔNG đụng MK hiện tại cho tới khi user bấm link đặt MK mới.
 *
 * Lưu HASH sha-256 của token (không lưu raw → rò bảng không dùng lại được),
 * hết hạn ngắn (Settings password_reset_ttl_minutes), dùng MỘT LẦN (used_at).
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash text NOT NULL,
      expires_at timestamptz NOT NULL,
      used_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_prt_token_hash ON password_reset_tokens (token_hash);
    CREATE INDEX IF NOT EXISTS idx_prt_user ON password_reset_tokens (user_id);
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`DROP TABLE IF EXISTS password_reset_tokens;`);
}
