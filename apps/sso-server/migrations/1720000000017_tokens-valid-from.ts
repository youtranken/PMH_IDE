import type { MigrationBuilder } from "node-pg-migrate";

/**
 * #1 Thu hồi phiên TỨC THÌ trên portal (FR-05). Mốc `tokens_valid_from`: access
 * token (JWT) có `iat` TRƯỚC mốc này bị guard từ chối NGAY, không chờ hết hạn
 * (≤5'). Set = now() khi Khóa/Hủy-mọi-phiên/Xóa/Reset (revokeAllForUser). NULL =
 * chưa bao giờ revoke → guard bỏ qua (token nào cũng qua) → user thường KHÔNG bị
 * ảnh hưởng. KHÔNG dùng jti (token jwt stateless, không có bản ghi tra được — đã
 * gây loop); iat không phụ thuộc điều đó nên an toàn.
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS tokens_valid_from timestamptz;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`ALTER TABLE users DROP COLUMN IF EXISTS tokens_valid_from;`);
}
