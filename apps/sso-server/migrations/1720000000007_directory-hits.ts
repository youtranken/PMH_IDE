import type { MigrationBuilder } from "node-pg-migrate";

export const shorthands = undefined;

/**
 * Rate-limit Directory API bằng cửa sổ trượt Postgres (thay in-memory) → đúng
 * cả khi chạy MULTI-INSTANCE (chuẩn bị HA). Mỗi truy vấn Directory ghi một dòng;
 * đếm trong cửa sổ 60s để chặn. Cron dọn dòng cũ.
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE TABLE directory_hits (
      id        bigserial PRIMARY KEY,
      client_id text NOT NULL,
      at        timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX directory_hits_client_idx ON directory_hits (client_id, at);
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`DROP TABLE IF EXISTS directory_hits;`);
}
