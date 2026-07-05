import type { MigrationBuilder } from "node-pg-migrate";

export const shorthands = undefined;

/**
 * E4-S7: thêm `next_attempt_at` cho email_queue để retry GIÃN DẦN (backoff).
 * Bảng gốc (base-schema) không có cột này — worker cần biết "chưa tới giờ thử
 * lại" để không quay job lỗi liên tục. Đồng bộ thiết kế với webhook_deliveries.
 * NULL = sẵn sàng gửi ngay (job mới).
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    ALTER TABLE email_queue ADD COLUMN next_attempt_at timestamptz;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    ALTER TABLE email_queue DROP COLUMN IF EXISTS next_attempt_at;
  `);
}
