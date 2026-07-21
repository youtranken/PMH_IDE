import type { MigrationBuilder } from "node-pg-migrate";

/**
 * Index cho 2 đường LIST quản trị đang quét-rồi-sắp toàn bảng (rà soát prod
 * 2026-07). Thêm SỚM khi bảng còn nhỏ.
 *
 * 1) users (created_at DESC) WHERE is_breakglass = false
 *    UsersService.list: `ORDER BY u.created_at DESC LIMIT 500` với mọi truy vấn
 *    đều kèm `is_breakglass = false`. Không có index created_at → seq-scan + sort
 *    khi số user lớn. Partial (bỏ break-glass) khớp đúng tập được liệt kê.
 *
 * 2) audit_logs (project_id, id DESC)
 *    AuditService.list của project_admin: `WHERE project_id = ANY(...) ORDER BY
 *    id DESC`. Index (created_at) của migration 12 KHÔNG phủ ORDER BY id, và
 *    lọc theo project không có index → quét. (SSA sort theo id đã có PK.)
 *
 * CREATE INDEX thường (không CONCURRENTLY): node-pg-migrate chạy trong
 * transaction. Bảng còn nhỏ nên khóa ghi không đáng kể. LƯU Ý tương lai: thêm
 * index khi bảng ĐÃ lớn phải dùng migration noTransaction + CONCURRENTLY.
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS users_created_active_idx
      ON users (created_at DESC) WHERE is_breakglass = false;
    CREATE INDEX IF NOT EXISTS audit_logs_project_id_idx
      ON audit_logs (project_id, id DESC);
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP INDEX IF EXISTS users_created_active_idx;
    DROP INDEX IF EXISTS audit_logs_project_id_idx;
  `);
}
