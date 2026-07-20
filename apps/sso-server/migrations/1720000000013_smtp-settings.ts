import type { MigrationBuilder } from "node-pg-migrate";

/**
 * Đưa CREDS SMTP vào bảng settings để cấu hình được TỪ FE (yêu cầu prod: dùng
 * Gmail). Trước đây user/pass/from chỉ ở .env → không sửa được qua UI.
 *
 * - smtp_user, smtp_from: chuỗi thường (user là địa chỉ mail, from không bí mật).
 * - smtp_password: LƯU MÃ HÓA (KEK, tiền tố 'enc:v1:') — settings-admin mã hóa
 *   lúc ghi, mask lúc đọc; MailerService giải mã. KHÔNG bao giờ trả về FE dạng thô.
 *
 * Seed rỗng để 3 dòng HIỆN trên FE (list() chỉ trả key đã tồn tại). Mailer vẫn
 * fallback về .env nếu setting rỗng → không gãy khi chưa cấu hình.
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    INSERT INTO settings (key, value) VALUES
      ('smtp_user', ''),
      ('smtp_from', ''),
      ('smtp_password', '')
    ON CONFLICT (key) DO NOTHING;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`DELETE FROM settings WHERE key IN ('smtp_user','smtp_from','smtp_password');`);
}
