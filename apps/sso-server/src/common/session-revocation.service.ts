import { Inject, Injectable } from "@nestjs/common";
import { Pool } from "pg";
import { PG_POOL } from "../database/database.module";

/**
 * Thu hồi phiên/token (FR-05). Nguồn sự thật là oidc_payloads (AD-6/AD-7); mọi
 * artifact của user mang `accountId` trong payload → xóa theo accountId là
 * NGUYÊN TỬ và trọn vẹn (Session, Grant, Access/Refresh/Code). Bảng `sessions`
 * chỉ là projection nên cập nhật revoked_at kèm theo.
 *
 * Dùng cho: khóa/xóa user (E4-S2, SSA toàn cục), nút "hủy toàn bộ phiên",
 * reset mật khẩu (E4-S5). Phạm vi-project (project_admin) thêm ở E4-S5.
 */
@Injectable()
export class SessionRevocationService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /**
   * Hủy phiên/token của user CHỈ với app thuộc các project cho trước (FR-05,
   * thẩm quyền project_admin). Grant/token gắn client_id → lọc theo clients của
   * project; Session (không gắn client) KHÔNG đụng — user vẫn đăng nhập SSO và
   * app project khác. Trả số artifact đã xóa.
   */
  async revokeForUserInProjects(
    userId: string,
    projectIds: string[],
  ): Promise<number> {
    if (projectIds.length === 0) return 0;
    const del = await this.pool.query(
      `DELETE FROM oidc_payloads
       WHERE payload->>'accountId' = $1
         AND client_id IN (
           SELECT client_id FROM clients WHERE project_id = ANY($2::uuid[])
         )`,
      [userId, projectIds],
    );
    return del.rowCount ?? 0;
  }

  /**
   * "Định danh phiên" của một dòng oidc_payloads: Session tự mang `uid`; token
   * (Refresh/Code) mang `payload.sessionUid`. Dùng để lọc theo từng phiên.
   */
  private static readonly SESSION_KEY =
    "COALESCE(payload->>'sessionUid', uid)";

  /**
   * Hủy MỘT phiên cụ thể của user (self-service "đăng xuất thiết bị này", E6-S2).
   * Xóa Session + token thuộc phiên; Grant để lại (vô hại khi không còn phiên).
   */
  async revokeSession(userId: string, sessionUid: string): Promise<number> {
    const del = await this.pool.query(
      `DELETE FROM oidc_payloads
       WHERE payload->>'accountId' = $1
         AND type IN ('Session','RefreshToken','AuthorizationCode')
         AND ${SessionRevocationService.SESSION_KEY} = $2`,
      [userId, sessionUid],
    );
    await this.pool.query(
      `UPDATE sessions SET revoked_at = now()
       WHERE user_id = $1 AND oidc_session_uid = $2 AND revoked_at IS NULL`,
      [userId, sessionUid],
    );
    return del.rowCount ?? 0;
  }

  /**
   * Hủy mọi phiên của user TRỪ phiên hiện tại (FR-05 — user tự đổi mật khẩu giữ
   * phiên đang thao tác). `currentSessionId` = giá trị cookie _session của
   * oidc-provider = Session.id (PK), KHÁC với uid mà token tham chiếu → phải
   * resolve id→uid trước. Không resolve được (cookie thiếu/sai) → keep=không
   * khớp gì → hủy TẤT (fail-safe, user đăng nhập lại).
   */
  async revokeOtherSessions(
    userId: string,
    currentSessionId: string,
  ): Promise<number> {
    const { rows } = await this.pool.query<{ uid: string }>(
      `SELECT uid FROM oidc_payloads
       WHERE type = 'Session' AND id = $1 AND payload->>'accountId' = $2`,
      [currentSessionId, userId],
    );
    const keepUid = rows[0]?.uid ?? "__none__";
    const del = await this.pool.query(
      `DELETE FROM oidc_payloads
       WHERE payload->>'accountId' = $1
         AND type IN ('Session','RefreshToken','AuthorizationCode')
         AND ${SessionRevocationService.SESSION_KEY} <> $2`,
      [userId, keepUid],
    );
    await this.pool.query(
      `UPDATE sessions SET revoked_at = now()
       WHERE user_id = $1 AND oidc_session_uid <> $2 AND revoked_at IS NULL`,
      [userId, keepUid],
    );
    return del.rowCount ?? 0;
  }

  /** Hủy MỌI phiên/token của user (toàn cục). Trả số artifact đã xóa. */
  async revokeAllForUser(userId: string): Promise<number> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const del = await client.query(
        `DELETE FROM oidc_payloads WHERE payload->>'accountId' = $1`,
        [userId],
      );
      await client.query(
        `UPDATE sessions SET revoked_at = now()
         WHERE user_id = $1 AND revoked_at IS NULL`,
        [userId],
      );
      await client.query("COMMIT");
      return del.rowCount ?? 0;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
}
