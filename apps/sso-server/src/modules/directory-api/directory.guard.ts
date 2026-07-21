import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { Pool } from "pg";
import { AccessTokenService } from "../../common/admin/access-token.service";
import { PG_POOL } from "../../database/database.module";

export interface DirClient {
  pk: string; // clients.id (uuid)
  clientId: string; // OIDC client_id
}

/**
 * Chốt Directory API (E7-S1, AD-11): Bearer access token M2M (client-
 * credentials). Verify chữ ký + lấy client_id → resolve DB client còn sống.
 * Gắn req.dirClient để service scope theo client_groups.
 */
@Injectable()
export class DirectoryGuard implements CanActivate {
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
    const clientId = this.tokens.verifyM2M(auth.slice(7));
    // Chặn NGAY cả token M2M còn sống khi SSA vừa tắt m2m_enabled (M3) — không
    // chờ token hết hạn.
    const { rows } = await this.pool.query<{ id: string }>(
      `SELECT id FROM clients
       WHERE client_id = $1 AND disabled = false AND m2m_enabled = true`,
      [clientId],
    );
    if (rows.length === 0) {
      throw new UnauthorizedException("client không hợp lệ hoặc chưa bật M2M");
    }
    (req as Request & { dirClient: DirClient }).dirClient = {
      pk: rows[0].id,
      clientId,
    };
    return true;
  }
}
