import type { MigrationBuilder } from "node-pg-migrate";

/**
 * M3 — gate `client_credentials` (Directory API M2M) theo từng client.
 *
 * Trước đây pg-adapter LUÔN cấp grant `client_credentials` cho mọi DB client →
 * bất kỳ client nào có secret cũng gọi được Directory API (kéo danh bạ trong
 * phạm vi nhóm). Thêm cột `m2m_enabled` để chỉ client nào THỰC SỰ cần mới bật.
 *
 * Mặc định FALSE cho client TẠO MỚI (phải bật có chủ đích). Nhưng để KHÔNG gãy
 * client đang chạy (vd QLTS đang dùng M2M), backfill mọi client HIỆN CÓ = true —
 * giữ nguyên hành vi cũ; SSA tự tắt cái nào không cần qua toggle.
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    ALTER TABLE clients
      ADD COLUMN IF NOT EXISTS m2m_enabled boolean NOT NULL DEFAULT false;
    UPDATE clients SET m2m_enabled = true;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`ALTER TABLE clients DROP COLUMN IF EXISTS m2m_enabled;`);
}
