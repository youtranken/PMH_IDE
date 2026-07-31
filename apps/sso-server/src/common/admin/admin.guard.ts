import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { Pool } from "pg";
import { PG_POOL } from "../../database/database.module";
import { AccessTokenService } from "./access-token.service";
import type { AdminContext, AdminRole } from "./admin.types";
import { ROLES_KEY } from "./roles.decorator";

/**
 * Chốt vào API quản trị (Epic 4+). Verify Bearer access token (portal) OFFLINE
 * rồi tra admin_roles/admin_projects → gắn AdminContext vào request. Không có
 * vai trò admin nào = 403. @Roles trên route siết thêm (vd chỉ SSA).
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly tokens: AccessTokenService,
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
      throw new UnauthorizedException("thiếu Bearer token");
    }
    const claims = this.tokens.verify(auth.slice(7));

    const admin = await this.loadContext(claims.sub as string, claims.iat);
    if (admin.roles.length === 0) {
      throw new ForbiddenException("tài khoản không có quyền quản trị");
    }

    // Đọc @Roles ở CẢ handler lẫn class — @Roles cấp controller (vd
    // ProjectsController) đặt metadata trên class; chỉ get(getHandler()) sẽ bỏ
    // sót và để lọt quyền.
    const required = this.reflector.getAllAndOverride<AdminRole[] | undefined>(
      ROLES_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (required?.length && !required.some((r) => admin.roles.includes(r))) {
      throw new ForbiddenException("vai trò không đủ cho thao tác này");
    }

    (req as Request & { admin: AdminContext }).admin = admin;
    return true;
  }

  /** Nạp vai trò + phạm vi project của user (chỉ user còn sống). */
  private async loadContext(
    userId: string,
    iat: number | undefined,
  ): Promise<AdminContext> {
    const [roles, projects, alive] = await Promise.all([
      this.pool.query<{ role: AdminRole }>(
        `SELECT role FROM admin_roles WHERE user_id = $1`,
        [userId],
      ),
      this.pool.query<{ project_id: string }>(
        `SELECT project_id FROM admin_projects WHERE user_id = $1`,
        [userId],
      ),
      this.pool.query<{ tvf: string | null }>(
        `SELECT EXTRACT(EPOCH FROM tokens_valid_from)::bigint AS tvf FROM users
         WHERE id = $1 AND deleted_at IS NULL AND status = 'active'`,
        [userId],
      ),
    ]);
    // Admin bị khóa/xóa giữa chừng → 401 (KHÔNG 403) để SPA tự đá về login,
    // nhất quán với nhánh tvf bên dưới và với UserGuard.
    if (alive.rowCount === 0) {
      throw new UnauthorizedException("tài khoản không hoạt động");
    }
    // THU HỒI TỨC THÌ: token phát trước mốc tokens_valid_from → 401 (SPA re-login).
    // tvf NULL = chưa từng revoke → bỏ qua. Ném 401 (KHÔNG 403) để portal đá về login.
    const tvf = alive.rows[0].tvf;
    if (tvf !== null && iat !== undefined && iat < Number(tvf)) {
      throw new UnauthorizedException("phiên đã bị thu hồi");
    }
    const roleList = roles.rows.map((r) => r.role);
    return {
      userId,
      roles: roleList,
      isSsa: roleList.includes("ssa"),
      projectIds: projects.rows.map((r) => r.project_id),
    };
  }
}
