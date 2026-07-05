import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Pool } from "pg";
import type { AdminContext } from "../../common/admin/admin.types";
import { AuditService } from "../../common/audit.service";
import { SessionRevocationService } from "../../common/session-revocation.service";
import { UserEventsService } from "../../common/user-events.service";
import { PG_POOL } from "../../database/database.module";
import { TempPasswordService } from "./temp-password.service";

export interface CreateUserInput {
  email: string;
  employeeCode: string;
  fullName: string;
}
export interface UpdateUserInput {
  email?: string;
  employeeCode?: string;
  fullName?: string;
}
export interface UserRow {
  id: string;
  email: string;
  employee_code: string;
  full_name: string;
  status: string;
  deleted_at: Date | null;
  expires_at: Date | null;
  created_at: Date;
}

const USER_COLS =
  "id, email, employee_code, full_name, status, deleted_at, expires_at, created_at";

/**
 * Vòng đời user (E4-S1/S2, FR-12/17). Unique email + mã NV tính CẢ bản
 * soft-deleted (index toàn bảng) → trùng thì gợi ý reactivate thay vì tạo mới,
 * giữ định danh cũ. Khóa/xóa kéo theo thu hồi phiên (FR-05).
 */
@Injectable()
export class UsersService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly audit: AuditService,
    private readonly revocation: SessionRevocationService,
    private readonly tempPassword: TempPasswordService,
    private readonly events: UserEventsService,
  ) {}

  async list(): Promise<UserRow[]> {
    const { rows } = await this.pool.query<UserRow>(
      `SELECT ${USER_COLS} FROM users ORDER BY created_at DESC LIMIT 500`,
    );
    return rows;
  }

  async get(id: string): Promise<UserRow> {
    const { rows } = await this.pool.query<UserRow>(
      `SELECT ${USER_COLS} FROM users WHERE id = $1`,
      [id],
    );
    if (rows.length === 0) throw new NotFoundException("user không tồn tại");
    return rows[0];
  }

  async create(
    input: CreateUserInput,
    actorUserId: string,
    ip: string | null,
  ): Promise<UserRow> {
    const email = input.email.trim();
    const code = input.employeeCode.trim();

    // Trùng (kể cả deleted) → chặn + gợi ý reactivate/định danh đang dùng.
    const { rows: dup } = await this.pool.query<{
      id: string;
      deleted_at: Date | null;
      email_match: boolean;
      code_match: boolean;
    }>(
      `SELECT id, deleted_at,
              lower(email) = lower($1) AS email_match,
              employee_code = $2 AS code_match
       FROM users WHERE lower(email) = lower($1) OR employee_code = $2
       LIMIT 1`,
      [email, code],
    );
    if (dup.length > 0) {
      const d = dup[0];
      const field = d.email_match ? "email" : "employee_code";
      if (d.deleted_at) {
        throw new ConflictException({
          error: "exists_deleted",
          field,
          userId: d.id,
          message: `${field} thuộc một user đã xóa — hãy khôi phục (reactivate) thay vì tạo mới`,
        });
      }
      throw new ConflictException({
        error: "exists",
        field,
        message: `${field} đã được dùng`,
      });
    }

    let user: UserRow;
    try {
      const { rows } = await this.pool.query<UserRow>(
        `INSERT INTO users (email, employee_code, full_name)
         VALUES ($1, $2, $3)
         RETURNING ${USER_COLS}`,
        [email, code, input.fullName.trim()],
      );
      user = rows[0];
    } catch (e) {
      // Race: qua được pre-check nhưng đụng unique index lúc INSERT → 409 (không 500)
      if ((e as { code?: string }).code === "23505") {
        throw new ConflictException({ error: "exists", message: "email hoặc mã NV đã được dùng" });
      }
      throw e;
    }
    await this.audit.record({
      actorUserId,
      action: "user.created",
      targetType: "user",
      targetId: user.id,
      ip,
      detail: { email, employee_code: code },
    });
    return user;
  }

  async update(
    id: string,
    input: UpdateUserInput,
    actorUserId: string,
    ip: string | null,
  ): Promise<UserRow> {
    await this.get(id); // 404 nếu không có
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (input.email !== undefined) {
      sets.push(`email = $${++i}`);
      vals.push(input.email.trim());
    }
    if (input.employeeCode !== undefined) {
      sets.push(`employee_code = $${++i}`);
      vals.push(input.employeeCode.trim());
    }
    if (input.fullName !== undefined) {
      sets.push(`full_name = $${++i}`);
      vals.push(input.fullName.trim());
    }
    if (sets.length === 0) return this.get(id);

    try {
      const { rows } = await this.pool.query<UserRow>(
        `UPDATE users SET ${sets.join(", ")}, updated_at = now()
         WHERE id = $1 RETURNING ${USER_COLS}`,
        [id, ...vals],
      );
      await this.audit.record({
        actorUserId,
        action: "user.updated",
        targetType: "user",
        targetId: id,
        ip,
        detail: input as Record<string, unknown>,
      });
      return rows[0];
    } catch (e) {
      if ((e as { code?: string }).code === "23505") {
        throw new ConflictException({
          error: "exists",
          message: "email hoặc mã NV đã được dùng",
        });
      }
      throw e;
    }
  }

  /** Soft-delete (SSA): giữ lịch sử, thu hồi mọi phiên, phát event user.deleted. */
  async softDelete(
    id: string,
    actorUserId: string,
    ip: string | null,
  ): Promise<{ revoked: number }> {
    const { rowCount } = await this.pool.query(
      `UPDATE users SET deleted_at = now(), updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    if (rowCount === 0) {
      throw new NotFoundException("user không tồn tại hoặc đã bị xóa");
    }
    const revoked = await this.revocation.revokeAllForUser(id);
    await this.emitEvent(id, "user.deleted");
    await this.audit.record({
      actorUserId,
      action: "user.deleted",
      targetType: "user",
      targetId: id,
      ip,
      detail: { revoked_sessions: revoked },
    });
    return { revoked };
  }

  /** Khôi phục user đã xóa (SSA) — giữ định danh cũ, đặt lại active. */
  async reactivate(
    id: string,
    actorUserId: string,
    ip: string | null,
  ): Promise<UserRow> {
    const { rows } = await this.pool.query<UserRow>(
      `UPDATE users SET deleted_at = NULL, status = 'active', updated_at = now()
       WHERE id = $1 AND deleted_at IS NOT NULL
       RETURNING ${USER_COLS}`,
      [id],
    );
    if (rows.length === 0) {
      throw new NotFoundException("user không tồn tại hoặc chưa bị xóa");
    }
    await this.emitEvent(id, "user.reactivated");
    await this.audit.record({
      actorUserId,
      action: "user.reactivated",
      targetType: "user",
      targetId: id,
      ip,
    });
    return rows[0];
  }

  /** Khóa (SSA): chặn đăng nhập + thu hồi phiên đang mở. */
  async setLocked(
    id: string,
    locked: boolean,
    actorUserId: string,
    ip: string | null,
  ): Promise<{ revoked: number }> {
    const { rowCount } = await this.pool.query(
      `UPDATE users SET status = $2, updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL`,
      [id, locked ? "locked" : "active"],
    );
    if (rowCount === 0) throw new NotFoundException("user không tồn tại");
    const revoked = locked ? await this.revocation.revokeAllForUser(id) : 0;
    await this.emitEvent(id, locked ? "user.locked" : "user.unlocked");
    await this.audit.record({
      actorUserId,
      action: locked ? "user.locked" : "user.unlocked",
      targetType: "user",
      targetId: id,
      ip,
      detail: { revoked_sessions: revoked },
    });
    return { revoked };
  }

  /** Nút "hủy toàn bộ phiên" độc lập (SSA) — không khóa user. */
  async revokeSessions(
    id: string,
    actorUserId: string,
    ip: string | null,
  ): Promise<{ revoked: number }> {
    await this.get(id);
    const revoked = await this.revocation.revokeAllForUser(id);
    await this.audit.record({
      actorUserId,
      action: "user.sessions_revoked",
      targetType: "user",
      targetId: id,
      ip,
      detail: { revoked_sessions: revoked },
    });
    return { revoked };
  }

  /**
   * Admin reset MK (E4-S5, FR-15/16): cấp MK tạm + thu hồi phiên theo THẨM
   * QUYỀN — SSA hủy toàn cục, project_admin chỉ hủy phiên app trong project
   * mình (FR-05). Không trả MK trong response (đi qua email).
   */
  async resetPassword(
    id: string,
    admin: AdminContext,
    ip: string | null,
  ): Promise<{ ok: true; revoked: number }> {
    const email = await this.tempPassword.issue(id);
    if (!email) throw new NotFoundException("user không tồn tại");
    await this.emitEvent(id, "user.password_changed", { via: "admin_reset" });
    const revoked = admin.isSsa
      ? await this.revocation.revokeAllForUser(id)
      : await this.revocation.revokeForUserInProjects(id, admin.projectIds);
    await this.audit.record({
      actorUserId: admin.userId,
      action: "user.password_reset",
      targetType: "user",
      targetId: id,
      ip,
      detail: { scope: admin.isSsa ? "global" : "project", revoked },
    });
    return { ok: true, revoked };
  }

  /**
   * Đặt/gỡ hạn tài khoản (E4-S6, FR-18). Reset cờ đã-cảnh-báo để hạn mới được
   * cảnh báo lại. Cron ExpiryService lo auto-lock khi quá hạn.
   */
  async setExpiry(
    id: string,
    expiresAt: string | null,
    actorUserId: string,
    ip: string | null,
  ): Promise<UserRow> {
    const { rows } = await this.pool.query<UserRow>(
      `UPDATE users
       SET expires_at = $2, expiry_warning_sent_at = NULL, updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING ${USER_COLS}`,
      [id, expiresAt],
    );
    if (rows.length === 0) throw new NotFoundException("user không tồn tại");
    await this.audit.record({
      actorUserId,
      action: "user.expiry_set",
      targetType: "user",
      targetId: id,
      ip,
      detail: { expires_at: expiresAt },
    });
    return rows[0];
  }

  /** Phát event qua UserEventsService (ghi user_events + enqueue webhook E7-S3). */
  private emitEvent(
    userId: string,
    type: string,
    detail?: Record<string, unknown>,
  ): Promise<void> {
    return this.events.emit(userId, type, detail);
  }
}
