import type { MigrationBuilder } from "node-pg-migrate";

export const shorthands = undefined;

/** Thêm tham số vận hành đường dẫn lưu trữ audit (E3-S6). */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    INSERT INTO settings (key, value) VALUES ('audit_archive_path', '/archive')
    ON CONFLICT (key) DO NOTHING;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`DELETE FROM settings WHERE key = 'audit_archive_path';`);
}
