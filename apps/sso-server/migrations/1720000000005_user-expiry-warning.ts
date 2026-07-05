import type { MigrationBuilder } from "node-pg-migrate";

export const shorthands = undefined;

/**
 * E4-S6: cột đánh dấu đã gửi email cảnh báo sắp hết hạn (chống gửi trùng mỗi
 * lần cron chạy) + tham số số ngày cảnh báo trước (SSA chỉnh ở Settings).
 * Reset về NULL khi admin đổi expires_at → cảnh báo lại cho hạn mới.
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    ALTER TABLE users ADD COLUMN expiry_warning_sent_at timestamptz;
    INSERT INTO settings (key, value) VALUES ('expiry_warning_days', '7')
    ON CONFLICT (key) DO NOTHING;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    ALTER TABLE users DROP COLUMN IF EXISTS expiry_warning_sent_at;
    DELETE FROM settings WHERE key = 'expiry_warning_days';
  `);
}
