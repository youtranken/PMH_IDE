import type { MigrationBuilder } from "node-pg-migrate";

/**
 * Phòng ban của nhân viên (Department) — KHÁC với "nhóm" (user_groups): nhóm mở
 * quyền vào app, còn department chỉ là nhãn tổ chức để admin biết user thuộc bộ
 * phận nào. NOT NULL DEFAULT '' để user cũ (và luồng nhập CSV) không vỡ; bắt buộc
 * nhập được ép ở form tạo user (whitespace) + DTO.
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS department text NOT NULL DEFAULT '';
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`ALTER TABLE users DROP COLUMN IF EXISTS department;`);
}
