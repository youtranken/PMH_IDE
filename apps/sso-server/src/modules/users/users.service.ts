import {
  ConflictException,
  ForbiddenException,
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
  // Tùy chọn: đặt MK thủ công ngay khi tạo (hữu ích khi chưa cấu hình SMTP).
  // Bỏ trống → user chưa có MK, phải reset/quên-MK để lấy MK tạm.
  password?: string;
  mustChangePassword?: boolean;
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
  is_ssa?: boolean;
  admin_projects?: string[]; // tên dự án user là project_admin
  groups?: string[]; // tên các nhóm user thuộc về
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

  async list(admin: AdminContext): Promise<UserRow[]> {
    // Tài khoản break-glass ẩn HOÀN TOÀN khỏi UI quản trị (bảo vệ lối vào khẩn
    // cấp — SSA không thấy/không đụng được; quản lý qua script offline).
    // project_admin chỉ thấy user TRONG phạm vi project mình (AD-1, cùng luật
    // CsvExport) — chặn lộ toàn bộ danh bạ + topology admin xuyên tenant.
    const where = ["u.is_breakglass = false"];
    const params: unknown[] = [];
    if (!admin.isSsa) {
      params.push(admin.projectIds);
      // KHÔNG xét allow_all_groups ở đây: cờ đó nới quyền ĐĂNG NHẬP (login.service),
      // không phải quyền QUẢN TRỊ. project_admin tự bật được cờ trên client của
      // mình → nếu tính vào đây thì họ tự nới phạm vi quản trị ra toàn hệ thống.
      where.push(`EXISTS (
        SELECT 1 FROM user_groups ugx
        JOIN client_groups cgx ON cgx.group_id = ugx.group_id
        JOIN clients cx ON cx.id = cgx.client_id
        WHERE ugx.user_id = u.id AND cx.project_id = ANY($1::uuid[])
              AND NOT cx.disabled)`);
    }
    const { rows } = await this.pool.query<UserRow>(
      `SELECT ${USER_COLS.split(", ").map((c) => "u." + c).join(", ")},
              EXISTS(SELECT 1 FROM admin_roles r WHERE r.user_id = u.id AND r.role = 'ssa') AS is_ssa,
              COALESCE((SELECT array_agg(p.name ORDER BY p.name)
                        FROM admin_projects ap JOIN projects p ON p.id = ap.project_id
                        WHERE ap.user_id = u.id), '{}') AS admin_projects,
              COALESCE((SELECT array_agg(g.name ORDER BY g.name)
                        FROM user_groups ug JOIN groups g ON g.id = ug.group_id
                        WHERE ug.user_id = u.id), '{}') AS groups
       FROM users u
       WHERE ${where.join(" AND ")}
       ORDER BY u.created_at DESC LIMIT 500`,
      params,
    );
    return rows;
  }

  // get() cũng ẩn break-glass → mọi mutation qua get() (update, revokeSessions,
  // grantSsa…) tự động không chạm được tài khoản khẩn cấp.
  async get(id: string): Promise<UserRow> {
    const { rows } = await this.pool.query<UserRow>(
      `SELECT ${USER_COLS} FROM users WHERE id = $1 AND is_breakglass = false`,
      [id],
    );
    if (rows.length === 0) throw new NotFoundException("user không tồn tại");
    return rows[0];
  }

  /** Chặn thao tác lên tài khoản break-glass (ẩn = trả 404 giữ tính mờ). Dùng ở
   * các mutation KHÔNG đi qua get(). */
  private async assertNotBreakglass(id: string): Promise<void> {
    const { rows } = await this.pool.query<{ b: boolean }>(
      `SELECT is_breakglass AS b FROM users WHERE id = $1`,
      [id],
    );
    if (rows.length === 0 || rows[0].b) {
      throw new NotFoundException("user không tồn tại");
    }
  }

  /**
   * Chặn khóa/xóa/đặt-hạn làm mất SSA VẬN HÀNH cuối cùng (chống bus-factor —
   * revokeSsa đã gác đường "gỡ vai", đây gác các đường gián tiếp). Không tính
   * break-glass; nếu target không phải SSA hiển thị thì bỏ qua.
   */
  private async assertNotLastOperableSsa(id: string): Promise<void> {
    const { rows: t } = await this.pool.query<{ b: boolean }>(
      `SELECT u.is_breakglass AS b FROM admin_roles r JOIN users u ON u.id = r.user_id
       WHERE r.user_id = $1 AND r.role = 'ssa'`,
      [id],
    );
    if (t.length === 0 || t[0].b) return; // không phải SSA vận hành → không liên quan
    const { rows } = await this.pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM admin_roles r JOIN users u ON u.id = r.user_id
       WHERE r.role = 'ssa' AND u.is_breakglass = false
             AND u.deleted_at IS NULL AND u.status = 'active'`,
    );
    if (rows[0].n <= 1) {
      throw new ConflictException(
        "đây là SSA vận hành cuối cùng — bổ nhiệm SSA khác trước khi khóa/xóa/đặt hạn",
      );
    }
  }

  /**
   * project_admin chỉ thao tác user TRONG phạm vi project mình (AD-1, cùng luật
   * với CsvExport). SSA bỏ qua. Ngoài phạm vi → 404 (giữ mờ, không lộ tồn tại).
   */
  private async assertUserInScope(
    admin: AdminContext,
    userId: string,
  ): Promise<void> {
    if (admin.isSsa) return;
    const { rows } = await this.pool.query<{ ok: boolean }>(
      // Không xét allow_all_groups — xem chú thích ở list(). Đây là hàm gác MỌI
      // mutation theo phạm vi, nên rò cờ login vào đây là leo thang đặc quyền.
      `SELECT EXISTS (
        SELECT 1 FROM user_groups ug
        JOIN client_groups cg ON cg.group_id = ug.group_id
        JOIN clients c ON c.id = cg.client_id
        WHERE ug.user_id = $1 AND c.project_id = ANY($2::uuid[])
              AND NOT c.disabled
      ) AS ok`,
      [userId, admin.projectIds],
    );
    if (!rows[0]?.ok) throw new NotFoundException("user không tồn tại");
  }

  /**
   * Chặn admin non-SSA sửa tài khoản QUẢN TRỊ khác (SSA/project_admin) — nếu
   * không, project_admin có thể đổi email SSA rồi chiếm qua forgot-password.
   */
  private async assertTargetNotAdmin(userId: string): Promise<void> {
    const { rows } = await this.pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM admin_roles WHERE user_id = $1`,
      [userId],
    );
    if (rows[0].n > 0) {
      throw new ForbiddenException(
        "không thể sửa tài khoản quản trị khác — cần quyền SSA",
      );
    }
  }

  /** get() có kiểm phạm vi project_admin — dùng cho endpoint đọc 1 user. */
  async getScoped(id: string, admin: AdminContext): Promise<UserRow> {
    await this.assertUserInScope(admin, id);
    return this.get(id);
  }

  async create(
    input: CreateUserInput,
    actorUserId: string,
    ip: string | null,
  ): Promise<UserRow> {
    const email = input.email.trim();
    const code = input.employeeCode.trim();

    // Validate MK thủ công TRƯỚC khi tạo user (tránh tạo user rồi mới báo lỗi MK).
    if (input.password) await this.tempPassword.assertPolicy(input.password);

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
    // Đặt MK thủ công nếu admin nhập (đã validate ở trên).
    if (input.password) {
      await this.tempPassword.setManual(
        user.id,
        input.password,
        input.mustChangePassword ?? true,
      );
    }
    await this.audit.record({
      actorUserId,
      action: "user.created",
      targetType: "user",
      targetId: user.id,
      ip,
      detail: {
        email,
        employee_code: code,
        password_set: input.password ? "manual" : "none",
      },
    });
    return user;
  }

  async update(
    id: string,
    input: UpdateUserInput,
    admin: AdminContext,
    ip: string | null,
  ): Promise<UserRow> {
    const current = await this.get(id); // 404 nếu không có
    // Phạm vi: project_admin chỉ sửa user trong project mình, và KHÔNG được sửa
    // tài khoản quản trị khác (chống đổi email SSA → chiếm qua forgot-password).
    if (!admin.isSsa) {
      await this.assertUserInScope(admin, id);
      await this.assertTargetNotAdmin(id);
      // C1: đổi ĐỊNH DANH (email/mã NV) là mắt xích quyết định của chiếm tài
      // khoản — project_admin đổi email nạn nhân (nhân viên thường) sang địa chỉ
      // của mình rồi dùng "Quên mật khẩu" công khai để nhận MK tạm. Chỉ SSA đổi
      // được email/mã NV; project_admin chỉ sửa full_name. So với giá trị hiện
      // tại để form gửi lại email/mã cũ (không đổi) vẫn qua.
      const emailChanged =
        input.email !== undefined &&
        input.email.trim().toLowerCase() !== current.email.toLowerCase();
      const codeChanged =
        input.employeeCode !== undefined &&
        input.employeeCode.trim() !== current.employee_code;
      if (emailChanged || codeChanged) {
        throw new ForbiddenException("đổi email/mã nhân viên cần quyền SSA");
      }
    }
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
        actorUserId: admin.userId,
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
    if (id === actorUserId) {
      throw new ForbiddenException("không thể tự xóa tài khoản của chính mình");
    }
    await this.assertNotLastOperableSsa(id);
    const { rowCount } = await this.pool.query(
      `UPDATE users SET deleted_at = now(), updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL AND is_breakglass = false`,
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
       WHERE id = $1 AND deleted_at IS NOT NULL AND is_breakglass = false
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
    if (locked && id === actorUserId) {
      throw new ForbiddenException("không thể tự khóa tài khoản của chính mình");
    }
    if (locked) await this.assertNotLastOperableSsa(id);
    const { rowCount } = await this.pool.query(
      `UPDATE users SET status = $2, updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL AND is_breakglass = false`,
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

  /**
   * Bổ nhiệm SSA (E5-S7, chống bus-factor AD-16). Chỉ SSA gọi (guard ở
   * controller). User phải còn sống. Vai đọc LIVE trong AdminGuard nên có hiệu
   * lực ngay.
   */
  async grantSsa(
    id: string,
    actorUserId: string,
    ip: string | null,
  ): Promise<{ ok: true }> {
    const u = await this.get(id); // get() đã ẩn break-glass → 404 nếu là break-glass
    if (u.deleted_at) throw new ConflictException("user đã bị xóa");
    // Trần 2 SSA (không tính break-glass ẩn) — mô hình 2 SSA + 1 break-glass.
    const { rows: cnt } = await this.pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM admin_roles r
       JOIN users u ON u.id = r.user_id
       WHERE r.role = 'ssa' AND u.is_breakglass = false`,
    );
    if (cnt[0].n >= 2) {
      throw new ConflictException(
        "đã đủ 2 SSA (tối đa) — gỡ bớt một SSA trước khi bổ nhiệm người mới",
      );
    }
    await this.pool.query(
      `INSERT INTO admin_roles (user_id, role) VALUES ($1, 'ssa')
       ON CONFLICT DO NOTHING`,
      [id],
    );
    await this.audit.record({
      actorUserId,
      action: "user.ssa_granted",
      targetType: "user",
      targetId: id,
      ip,
    });
    return { ok: true };
  }

  /**
   * Gỡ vai SSA. CHẶN gỡ SSA CUỐI CÙNG (chống tự khóa toàn hệ thống). Không đụng
   * vai project_admin nếu có.
   */
  async revokeSsa(
    id: string,
    actorUserId: string,
    ip: string | null,
  ): Promise<{ ok: true }> {
    if (id === actorUserId) {
      throw new ForbiddenException(
        "không thể tự gỡ vai SSA của chính mình — nhờ một SSA khác thực hiện",
      );
    }
    await this.assertNotBreakglass(id); // không cho gỡ SSA của tài khoản khẩn cấp
    const { rowCount } = await this.pool.query(
      `SELECT 1 FROM admin_roles WHERE user_id = $1 AND role = 'ssa'`,
      [id],
    );
    if (rowCount === 0) throw new NotFoundException("user không phải SSA");
    // Đếm SSA VẬN HÀNH (không tính break-glass ẩn) — nhất quán với cap ở grantSsa.
    // Nếu tính cả break-glass sẽ cho gỡ đến khi chỉ còn break-glass = liệt UI.
    const { rows } = await this.pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM admin_roles r JOIN users u ON u.id = r.user_id
       WHERE r.role = 'ssa' AND u.is_breakglass = false`,
    );
    if (rows[0].n <= 1) {
      throw new ConflictException(
        "không thể gỡ SSA vận hành cuối cùng — hãy bổ nhiệm SSA khác trước",
      );
    }
    await this.pool.query(
      `DELETE FROM admin_roles WHERE user_id = $1 AND role = 'ssa'`,
      [id],
    );
    await this.audit.record({
      actorUserId,
      action: "user.ssa_revoked",
      targetType: "user",
      targetId: id,
      ip,
    });
    return { ok: true };
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
   * Admin reset MK (E4-S5, FR-15/16). Hai chế độ:
   *  - Mặc định: cấp MK TẠM ngẫu nhiên qua email + buộc đổi.
   *  - `opts.password`: đặt MK THỦ CÔNG do admin nhập (không email — dùng khi
   *    chưa cấu hình SMTP; giao MK ngoài luồng).
   * Thu hồi phiên theo THẨM QUYỀN (SSA toàn cục / project_admin theo project).
   */
  async resetPassword(
    id: string,
    admin: AdminContext,
    ip: string | null,
    opts: { password?: string; mustChangePassword?: boolean } = {},
  ): Promise<{ ok: true; revoked: number }> {
    await this.assertNotBreakglass(id);
    // Đường email temp cũng phải theo phạm vi project_admin (đường manual đã
    // chặn cứng chỉ-SSA bên dưới). SSA bỏ qua.
    await this.assertUserInScope(admin, id);
    // Cùng luật với update(): project_admin KHÔNG đụng được tài khoản quản trị
    // khác. Thiếu chốt này thì reset MK là đường ép-đổi-MK + thu hồi phiên của
    // một SSA (phá hoại/khóa cửa), dù MK tạm gửi về hòm thư của chính SSA đó.
    if (!admin.isSsa) await this.assertTargetNotAdmin(id);
    if (opts.password) {
      // Đặt MK THỦ CÔNG = admin biết MK của target → CHỈ SSA. Nếu để
      // project_admin làm, họ có thể đặt MK biết trước cho bất kỳ ai (kể cả
      // SSA) rồi đăng nhập chiếm quyền. project_admin vẫn được reset qua email.
      if (!admin.isSsa) {
        throw new ForbiddenException("chỉ SSA được đặt mật khẩu thủ công");
      }
      await this.get(id); // 404 nếu không có (get() đã ẩn break-glass)
      await this.tempPassword.setManual(
        id,
        opts.password,
        opts.mustChangePassword ?? true,
      );
    } else {
      const email = await this.tempPassword.issue(id);
      if (!email) throw new NotFoundException("user không tồn tại");
    }
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
      detail: {
        scope: admin.isSsa ? "global" : "project",
        mode: opts.password ? "manual" : "temp_email",
        revoked,
      },
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
    // Đặt hạn = tự động khóa khi tới hạn → cùng rủi ro lockout như khóa/xóa.
    if (expiresAt !== null) {
      if (id === actorUserId) {
        throw new ForbiddenException("không thể tự đặt hạn tài khoản của chính mình");
      }
      await this.assertNotLastOperableSsa(id);
    }
    const { rows } = await this.pool.query<UserRow>(
      `UPDATE users
       SET expires_at = $2, expiry_warning_sent_at = NULL, updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL AND is_breakglass = false
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
