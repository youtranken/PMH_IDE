import { Inject, Injectable } from "@nestjs/common";
import * as argon2 from "argon2";
import { Pool } from "pg";
import { PG_POOL } from "../../database/database.module";

export interface LoginOk {
  userId: string;
  mustChangePassword: boolean;
  passwordUpdatedAt: Date | null;
}

/**
 * Xác thực email + mật khẩu (FR-01). Trả LoginOk hoặc null — KHÔNG phân biệt
 * "email không tồn tại" với "sai mật khẩu" (chống dò email; AD-9). Luôn chạy
 * argon2.verify kể cả khi không có user (chống timing).
 */
@Injectable()
export class LoginService {
  /** Hash mồi để verify khi user không tồn tại — cân bằng thời gian phản hồi. */
  private static readonly DUMMY_HASH =
    "$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$5c9DKvIhH9rTBOpn7yhb1M+8pyRvAUAr0uf2mL+GYbo";

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async validate(email: string, password: string): Promise<LoginOk | null> {
    const { rows } = await this.pool.query<{
      id: string;
      password_hash: string | null;
      must_change_password: boolean;
      password_updated_at: Date | null;
      temp_password_expired: boolean;
    }>(
      `SELECT id, password_hash, must_change_password, password_updated_at,
              (temp_password_expires_at IS NOT NULL
                 AND temp_password_expires_at < now()) AS temp_password_expired
       FROM users
       WHERE lower(email) = lower($1)
         AND deleted_at IS NULL AND status = 'active'`,
      [email.trim()],
    );

    const row = rows[0];
    const hash = row?.password_hash ?? LoginService.DUMMY_HASH;
    let ok = false;
    try {
      ok = await argon2.verify(hash, password);
    } catch {
      ok = false;
    }
    // MK tạm quá hạn (E4-S5) = không còn hợp lệ, kể cả nhập đúng. Vẫn chạy
    // verify ở trên để giữ thời gian phản hồi ĐỒNG NHẤT (chống dò, AD-9).
    if (!ok || !row || row.temp_password_expired) return null;
    return {
      userId: row.id,
      mustChangePassword: row.must_change_password,
      passwordUpdatedAt: row.password_updated_at,
    };
  }

  /**
   * Cổng LOGIN theo client_groups (E5-S3, AD-11). Cho phép nếu: client TĨNH
   * (không có trong bảng clients — vd portal/demo-app, hạ tầng nội bộ) HOẶC
   * client bật allow_all_groups HOẶC user thuộc một group đã gán cho client.
   * Ngược lại = chặn (user không có quyền vào app này). allow_all chỉ nới LOGIN,
   * không nới scope Directory (AD-11) — chỗ đó kiểm riêng ở Epic 7.
   */
  async isAllowedForClient(userId: string, clientId: string): Promise<boolean> {
    const { rows } = await this.pool.query<{ allowed: boolean }>(
      `SELECT (
         NOT EXISTS (SELECT 1 FROM clients WHERE client_id = $2)
         OR EXISTS (SELECT 1 FROM clients
                    WHERE client_id = $2 AND allow_all_groups AND NOT disabled)
         OR EXISTS (
           SELECT 1 FROM clients c
           JOIN client_groups cg ON cg.client_id = c.id
           JOIN user_groups ug ON ug.group_id = cg.group_id
           WHERE c.client_id = $2 AND ug.user_id = $1)
       ) AS allowed`,
      [userId, clientId],
    );
    return rows[0]?.allowed ?? false;
  }

  /**
   * Xác minh mật khẩu HIỆN TẠI của user (đổi MK tự phục vụ — chống chiếm phiên
   * đổi MK khi không biết MK cũ). Luôn chạy argon2.verify (kể cả thiếu hash) để
   * cân thời gian.
   */
  async verifyCurrent(userId: string, password: string): Promise<boolean> {
    const { rows } = await this.pool.query<{ password_hash: string | null }>(
      `SELECT password_hash FROM users
       WHERE id = $1 AND deleted_at IS NULL AND status = 'active'`,
      [userId],
    );
    const hash = rows[0]?.password_hash ?? LoginService.DUMMY_HASH;
    try {
      return (await argon2.verify(hash, password)) && !!rows[0]?.password_hash;
    } catch {
      return false;
    }
  }

  /** Đổi mật khẩu (đã validate policy ở nơi gọi): hash + cập nhật mốc. */
  async setPassword(userId: string, newPassword: string): Promise<void> {
    const hash = await argon2.hash(newPassword);
    await this.pool.query(
      `UPDATE users
       SET password_hash = $2,
           password_updated_at = now(),
           must_change_password = false,
           temp_password_expires_at = NULL,
           updated_at = now()
       WHERE id = $1`,
      [userId, hash],
    );
  }
}
