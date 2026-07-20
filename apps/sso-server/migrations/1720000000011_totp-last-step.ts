import type { MigrationBuilder } from "node-pg-migrate";

export const shorthands = undefined;

/**
 * TOTP one-time (M5): mã TOTP hợp lệ ~90s (window=1) → nếu bị lộ (phishing/
 * shoulder-surf) có thể REPLAY trong cửa sổ đó. Lưu STEP (floor(epoch/30)) của
 * mã đã chấp nhận gần nhất; verify chỉ nhận step MỚI hơn → mỗi mã dùng một lần
 * (NIST 800-63B). NULL = chưa dùng mã nào.
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`ALTER TABLE mfa_totp ADD COLUMN last_totp_step bigint;`);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`ALTER TABLE mfa_totp DROP COLUMN IF EXISTS last_totp_step;`);
}
