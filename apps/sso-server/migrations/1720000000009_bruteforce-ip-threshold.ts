import type { MigrationBuilder } from "node-pg-migrate";

export const shorthands = undefined;

/**
 * Ngưỡng chống dò theo IP (AD-9, lớp password-spraying). Cao hơn ngưỡng account
 * (mỗi IP hợp lệ có thể phục vụ nhiều user). SSA tune runtime theo metric thật.
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    INSERT INTO settings (key, value) VALUES ('bruteforce_ip_threshold', '20')
    ON CONFLICT (key) DO NOTHING;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`DELETE FROM settings WHERE key = 'bruteforce_ip_threshold';`);
}
