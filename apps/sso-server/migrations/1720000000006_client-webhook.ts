import type { MigrationBuilder } from "node-pg-migrate";

export const shorthands = undefined;

/**
 * E7-S3: cấu hình webhook cho client — URL đích + secret ký HMAC mã hóa bằng KEK
 * (AD-14/AD-15, tách khỏi DB). Setting allowlist CIDR nội bộ (chặn dải private
 * mặc định, chỉ cho các dải khai báo → chống SSRF ra metadata/nội mạng).
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    ALTER TABLE clients ADD COLUMN webhook_url text;
    ALTER TABLE clients ADD COLUMN webhook_secret_enc bytea;
    INSERT INTO settings (key, value) VALUES ('webhook_allowlist_cidr', '')
    ON CONFLICT (key) DO NOTHING;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    ALTER TABLE clients DROP COLUMN IF EXISTS webhook_url;
    ALTER TABLE clients DROP COLUMN IF EXISTS webhook_secret_enc;
    DELETE FROM settings WHERE key = 'webhook_allowlist_cidr';
  `);
}
