import type { MigrationBuilder } from "node-pg-migrate";

export const shorthands = undefined;

/**
 * sessions là projection một chiều từ oidc_payloads (AD-7) — upsert theo
 * oidc_session_uid nên cần UNIQUE (thay index thường từ base schema).
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP INDEX IF EXISTS sessions_oidc_uid_idx;
    CREATE UNIQUE INDEX sessions_oidc_uid_key ON sessions (oidc_session_uid);
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP INDEX IF EXISTS sessions_oidc_uid_key;
    CREATE INDEX sessions_oidc_uid_idx ON sessions (oidc_session_uid);
  `);
}
