import type { MigrationBuilder } from "node-pg-migrate";

export const shorthands = undefined;

/**
 * Back-Channel Logout (OIDC BCL): URL đích PMH ID POST logout_token tới khi phiên
 * SSO kết thúc (end_session) → app đá user ra TỨC THÌ (thay vì chờ ≤5' token hết
 * hạn). Không cần secret riêng — logout_token là JWT do PMH ID ký, app verify qua
 * JWKS. NULL = app không bật BCL (vẫn văng trong ≤5' như cũ).
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`ALTER TABLE clients ADD COLUMN backchannel_logout_uri text;`);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`ALTER TABLE clients DROP COLUMN IF EXISTS backchannel_logout_uri;`);
}
