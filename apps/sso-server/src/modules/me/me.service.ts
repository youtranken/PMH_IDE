import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import * as QRCode from "qrcode";
import { Pool } from "pg";
import { AuditService } from "../../common/audit.service";
import { SessionRevocationService } from "../../common/session-revocation.service";
import { UserEventsService } from "../../common/user-events.service";
import { PG_POOL } from "../../database/database.module";
import { LoginService } from "../auth-oidc/login.service";
import { MfaService } from "../auth-oidc/mfa.service";
import { PasswordPolicyService } from "../auth-oidc/password-policy.service";

/**
 * Tự phục vụ user (E6-S1/S2, FR-09/10): launcher app được vào, group của mình,
 * quản phiên, đổi mật khẩu. Mọi thứ theo CHÍNH user (userId từ UserGuard).
 */
@Injectable()
export class MeService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly login: LoginService,
    private readonly policy: PasswordPolicyService,
    private readonly revocation: SessionRevocationService,
    private readonly audit: AuditService,
    private readonly events: UserEventsService,
    private readonly mfa: MfaService,
  ) {}

  // ---- MFA tự phục vụ (phase sau — mở cho project_admin + user thường) ----

  async mfaStatus(userId: string): Promise<{ enabled: boolean }> {
    return { enabled: (await this.mfa.status(userId)).enabled };
  }

  /** Bước 1: sinh secret (chưa bật) + trả QR data URL để quét. */
  async mfaSetup(userId: string): Promise<{ otpauth: string; qr: string }> {
    const { rows } = await this.pool.query<{ email: string }>(
      `SELECT email FROM users WHERE id = $1`,
      [userId],
    );
    const otpauth = await this.mfa.beginEnroll(userId, rows[0]?.email ?? userId);
    return { otpauth, qr: await QRCode.toDataURL(otpauth) };
  }

  /** Bước 2: xác nhận mã đúng → bật MFA + trả 10 recovery code (HIỆN MỘT LẦN). */
  async mfaEnable(
    userId: string,
    code: string,
    ip: string | null,
  ): Promise<{ recoveryCodes: string[] }> {
    if (!(await this.mfa.confirmEnroll(userId, code.trim()))) {
      throw new BadRequestException("Mã xác thực không đúng");
    }
    const recoveryCodes = await this.mfa.generateRecoveryCodes(userId);
    await this.audit.record({
      actorUserId: userId,
      action: "mfa.enabled",
      targetType: "user",
      targetId: userId,
      ip,
      detail: { via: "self-service" },
    });
    return { recoveryCodes };
  }

  /** Tắt MFA — phải nhập mã TOTP hiện tại (chứng minh sở hữu, chống tắt lén). */
  async mfaDisable(
    userId: string,
    code: string,
    ip: string | null,
  ): Promise<{ ok: true }> {
    const ok =
      (await this.mfa.verifyTotp(userId, code.trim())) ||
      (await this.mfa.consumeRecoveryCode(userId, code));
    if (!ok) throw new BadRequestException("Mã xác thực không đúng");
    await this.pool.query(`DELETE FROM mfa_totp WHERE user_id = $1`, [userId]);
    await this.pool.query(`DELETE FROM mfa_recovery WHERE user_id = $1`, [userId]);
    await this.audit.record({
      actorUserId: userId,
      action: "mfa.disabled",
      targetType: "user",
      targetId: userId,
      ip,
    });
    return { ok: true };
  }

  async profile(userId: string): Promise<{
    id: string;
    email: string;
    employee_code: string;
    full_name: string;
    groups: string[];
    roles: string[];
    isSsa: boolean;
  }> {
    const { rows } = await this.pool.query<{
      id: string;
      email: string;
      employee_code: string;
      full_name: string;
      groups: string[];
      roles: string[];
    }>(
      `SELECT u.id, u.email, u.employee_code, u.full_name,
              COALESCE(array_agg(DISTINCT g.name) FILTER (WHERE g.name IS NOT NULL), '{}') AS groups,
              COALESCE(array_agg(DISTINCT ar.role) FILTER (WHERE ar.role IS NOT NULL), '{}') AS roles
       FROM users u
       LEFT JOIN user_groups ug ON ug.user_id = u.id
       LEFT JOIN groups g ON g.id = ug.group_id
       LEFT JOIN admin_roles ar ON ar.user_id = u.id
       WHERE u.id = $1
       GROUP BY u.id`,
      [userId],
    );
    if (rows.length === 0) throw new NotFoundException("user không tồn tại");
    return { ...rows[0], isSsa: rows[0].roles.includes("ssa") };
  }

  /** Launcher (FR-09): app user được vào (allow_all hoặc thuộc group của client). */
  async apps(userId: string): Promise<
    { client_id: string; name: string; app_url: string; env: string }[]
  > {
    const { rows } = await this.pool.query(
      `SELECT DISTINCT c.client_id, c.name, c.app_url, c.env
       FROM clients c
       WHERE NOT c.disabled AND c.app_url IS NOT NULL
         AND ( c.allow_all_groups
               OR EXISTS (
                 SELECT 1 FROM client_groups cg
                 JOIN user_groups ug ON ug.group_id = cg.group_id
                 WHERE cg.client_id = c.id AND ug.user_id = $1) )
       ORDER BY c.name`,
      [userId],
    );
    return rows;
  }

  async sessions(userId: string): Promise<
    {
      oidc_session_uid: string;
      ip: string | null;
      last_activity: Date;
      created_at: Date;
    }[]
  > {
    const { rows } = await this.pool.query(
      `SELECT oidc_session_uid, ip::text AS ip, last_activity, created_at
       FROM sessions
       WHERE user_id = $1 AND revoked_at IS NULL
       ORDER BY last_activity DESC`,
      [userId],
    );
    return rows;
  }

  /** Đăng xuất MỌI thiết bị (SLO) — thu hồi tất cả phiên kể cả hiện tại. */
  async logoutAll(
    userId: string,
    ip: string | null,
  ): Promise<{ revoked: number }> {
    const revoked = await this.revocation.revokeAllForUser(userId);
    await this.audit.record({
      actorUserId: userId,
      action: "self.logout_all",
      targetType: "user",
      targetId: userId,
      ip,
    });
    return { revoked };
  }

  async revokeSession(
    userId: string,
    sessionUid: string,
    ip: string | null,
  ): Promise<{ revoked: number }> {
    const revoked = await this.revocation.revokeSession(userId, sessionUid);
    await this.audit.record({
      actorUserId: userId,
      action: "self.session_revoked",
      targetType: "session",
      targetId: sessionUid,
      ip,
    });
    return { revoked };
  }

  /**
   * User tự đổi mật khẩu (FR-10/05): kiểm policy → đặt MK → thu hồi các phiên
   * KHÁC, GIỮ phiên hiện tại (keepSessionUid từ cookie _session). Thiếu cookie →
   * thu hồi tất (fail-safe, user đăng nhập lại).
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    keepSessionUid: string | null,
    ip: string | null,
  ): Promise<{ ok: true; revoked: number }> {
    // Chống chiếm phiên → đổi MK: phải biết MK hiện tại.
    if (!(await this.login.verifyCurrent(userId, currentPassword))) {
      throw new UnauthorizedException("Mật khẩu hiện tại không đúng");
    }
    await this.policy.assertValid(newPassword);
    await this.login.setPassword(userId, newPassword);
    const revoked = keepSessionUid
      ? await this.revocation.revokeOtherSessions(userId, keepSessionUid)
      : await this.revocation.revokeAllForUser(userId);
    await this.events.emit(userId, "user.password_changed", { via: "self" });
    await this.audit.record({
      actorUserId: userId,
      action: "password.changed",
      targetType: "user",
      targetId: userId,
      ip,
      detail: { via: "self-service", kept_current: !!keepSessionUid },
    });
    return { ok: true, revoked };
  }
}
