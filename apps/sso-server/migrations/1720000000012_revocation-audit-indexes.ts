import type { MigrationBuilder } from "node-pg-migrate";

/**
 * Index cho 2 đường ĐANG QUÉT TOÀN BẢNG và thất bại IM LẶNG khi bảng lớn
 * (rà soát tiền-prod 2026-07).
 *
 * 1) oidc_payloads ((payload->>'accountId'))
 *    Cả 4 đường thu hồi phiên (SessionRevocationService: revokeAllForUser,
 *    revokeForUserInProjects, revokeSession, revokeOtherSessions) đều lọc theo
 *    trường JSONB này, nhưng bảng chỉ có index trên grant_id/uid/user_code/
 *    client_id/expires_at. Kết hợp statement_timeout=10s (database.module) và
 *    cron nuốt lỗi: "khóa user" báo thành công trong khi phiên VẪN SỐNG.
 *    Đây là biện pháp bảo mật hỏng mà không báo — nên phải có index TRƯỚC khi
 *    bảng kịp lớn.
 *
 * 2) audit_logs (created_at)
 *    Job archive chuyển từ to_char(created_at,'YYYY-MM') (non-sargable) sang
 *    range predicate → cần index này mới dùng được.
 *
 * Cố ý dùng CREATE INDEX thường (không CONCURRENTLY): node-pg-migrate chạy
 * trong transaction nên CONCURRENTLY không hợp lệ, và bảng hiện còn nhỏ nên
 * khóa ghi không đáng kể. Chạy migration này SỚM, đừng để tới lúc bảng lớn.
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS oidc_payloads_account_idx
      ON oidc_payloads ((payload->>'accountId'));
    CREATE INDEX IF NOT EXISTS audit_logs_created_idx
      ON audit_logs (created_at);
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP INDEX IF EXISTS oidc_payloads_account_idx;
    DROP INDEX IF EXISTS audit_logs_created_idx;
  `);
}
