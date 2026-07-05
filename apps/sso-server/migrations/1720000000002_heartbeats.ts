import type { MigrationBuilder } from "node-pg-migrate";

export const shorthands = undefined;

/**
 * Nhịp sống (heartbeat) của scheduler/worker (AD-13/AD-16) — cron cập nhật
 * last_beat; giám sát out-of-band đọc để biết job nền còn chạy hay đã chết.
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE TABLE heartbeats (
      component  text PRIMARY KEY,
      last_beat  timestamptz NOT NULL DEFAULT now(),
      detail     jsonb
    );
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`DROP TABLE IF EXISTS heartbeats;`);
}
