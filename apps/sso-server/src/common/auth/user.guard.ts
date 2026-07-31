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
    const { rows } = await this.pool.query<{ tvf: string | null }>(
      `SELECT EXTRACT(EPOCH FROM tokens_valid_from)::bigint AS tvf
       FROM users WHERE id = $1 AND deleted_at IS NULL AND status = 'active'`,
      [claims.sub],
    );
    if (rows.length === 0) {
      throw new UnauthorizedException("tài khoản không hoạt động");
    }
    // THU HỒI TỨC THÌ: token có iat TRƯỚC mốc tokens_valid_from → đã bị thu hồi
    // (Khóa/Hủy-phiên set mốc = now()). tvf NULL = user chưa từng bị revoke → bỏ
    // qua, KHÔNG ảnh hưởng ai. Token đăng nhập mới có iat > mốc → qua bình thường.
    const tvf = rows[0].tvf;
    if (tvf !== null && claims.iat !== undefined && claims.iat < Number(tvf)) {
      throw new UnauthorizedException("phiên đã bị thu hồi");
    }
    (req as Request & { userId: string }).userId = claims.sub as string;
    return true;
  }
}
