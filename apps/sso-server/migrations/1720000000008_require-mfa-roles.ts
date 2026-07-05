import type { MigrationBuilder } from "node-pg-migrate";

export const shorthands = undefined;

/**
 * Tham số bắt buộc MFA theo vai (phase sau). Trống = không ép; SSA đặt
 * "ssa,project_admin" để bắt project_admin phải bật MFA (force-enroll lúc login).
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    INSERT INTO settings (key, value) VALUES ('require_mfa_roles', '')
    ON CONFLICT (key) DO NOTHING;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`DELETE FROM settings WHERE key = 'require_mfa_roles';`);
}
