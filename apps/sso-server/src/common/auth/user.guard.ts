import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { Pool } from "pg";
import { AccessTokenService } from "../admin/access-token.service";
import { PG_POOL } from "../../database/database.module";

/**
 * Chốt cho API tự phục vụ (/api/me, E6-S1/S2). Verify Bearer access token portal
 * (như AdminGuard) nhưng KHÔNG đòi vai admin — chỉ cần user còn sống. Gắn userId
 * vào request.
 */
@Injectable()
export class UserGuard implements CanActivate {
  constructor(
    private readonly tokens: AccessTokenService,
    @Inject(PG_POOL) private readonly pool: Pool,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
      throw new UnauthorizedException("thiếu Bearer token");
    }
    const claims = this.tokens.verify(auth.slice(7));
    const { rowCount } = await this.pool.query(
      `SELECT 1 FROM users WHERE id = $1 AND deleted_at IS NULL AND status = 'active'`,
      [claims.sub],
    );
    if (rowCount === 0) {
      throw new UnauthorizedException("tài khoản không hoạt động");
    }
    (req as Request & { userId: string }).userId = claims.sub as string;
    return true;
  }
}
