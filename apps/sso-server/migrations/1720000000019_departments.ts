import type { MigrationBuilder } from "node-pg-migrate";

/**
 * Danh mục Phòng ban (Department) quản lý được — nguồn cho dropdown khi tạo/sửa
 * user. KHÁC "nhóm" (user_groups mở quyền vào app); department chỉ là nhãn tổ
 * chức. users.department lưu TÊN (text) đã thêm ở migration 018; bảng này là danh
 * mục chuẩn để chọn. Tên UNIQUE không phân biệt hoa/thường.
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS departments (
      id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name       text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS departments_name_key ON departments (lower(name));
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`DROP TABLE IF EXISTS departments;`);
}
