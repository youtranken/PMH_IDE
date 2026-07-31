import { Inject, Injectable, Logger } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import { Pool } from "pg";
import { PG_POOL } from "../database/database.module";
import { OIDC_PROVIDER } from "../oidc/oidc.module";
import type { OidcProviderInstance } from "../oidc/provider.factory";

/**
 * OIDC Back-Channel Logout do IdP CHỦ ĐỘNG khởi tạo (E1-S7): khi admin khóa/xóa
 * user hoặc "hủy mọi phiên", ta xóa THẲNG oidc_payloads (không qua luồng
 * /oidc/logout của provider) → provider KHÔNG tự bắn logout_token. Service này lấp
 * chỗ đó: đọc các phiên của user, với mỗi client có `backchannel_logout_uri` thì
 * POST logout_token (JWT ký) tới app để app (vd QLTS) đá user NGAY.
 *
 * PHẢI gọi TRƯỚC khi xóa oidc_payloads (cần đọc session→client khi phiên còn sống).
 * Best-effort: lỗi/timeout của một client KHÔNG được chặn việc thu hồi phiên.
 */
@Injectable()
export class BackchannelLogoutService {
  private readonly logger = new Logger(BackchannelLogoutService.name);
  private static readonly PER_CLIENT_TIMEOUT_MS = 5000;
  private provider?: OidcProviderInstance;

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly moduleRef: ModuleRef,
  ) {}

  /** Lazy-resolve OIDC_PROVIDER qua ModuleRef (tránh import OidcModule → cycle). */
  private getProvider(): OidcProviderInstance {
    if (!this.provider) {
      this.provider = this.moduleRef.get<OidcProviderInstance>(OIDC_PROVIDER, {
        strict: false,
      });
    }
    return this.provider;
  }

  /** Bắn logout_token tới mọi app mà user đang có phiên. Không bao giờ ném lỗi. */
  async notifyLogout(userId: string): Promise<void> {
    let provider: OidcProviderInstance;
    try {
      provider = this.getProvider();
    } catch (e) {
      // Giữ hợp đồng "không bao giờ ném": provider chưa resolve (boot/shutdown) →
      // bỏ qua BCL thay vì phá luồng thu hồi phiên của caller.
      this.logger.warn(`BCL: không lấy được provider: ${String(e)}`);
      return;
    }
    let sessionIds: string[];
    try {
      const { rows } = await this.pool.query<{ id: string }>(
        `SELECT id FROM oidc_payloads
         WHERE type = 'Session' AND payload->>'accountId' = $1`,
        [userId],
      );
      sessionIds = rows.map((r) => r.id);
    } catch (e) {
      this.logger.warn(`BCL: đọc danh sách phiên lỗi: ${String(e)}`);
      return;
    }
    if (sessionIds.length === 0) return;

    // Gom (clientId, sid) DUY NHẤT từ mọi phiên (đọc khi phiên còn sống).
    const targets = new Map<string, { clientId: string; sid: string }>();
    for (const id of sessionIds) {
      try {
        const session = await provider.Session.find(id);
        if (!session?.authorizations) continue;
        for (const clientId of Object.keys(session.authorizations)) {
          const sid = session.sidFor(clientId);
          targets.set(`${clientId}:${sid}`, { clientId, sid });
        }
      } catch (e) {
        this.logger.warn(`BCL: đọc Session ${id} lỗi: ${String(e)}`);
      }
    }
    if (targets.size === 0) return;

    let ok = 0;
    let fail = 0;
    await Promise.all(
      [...targets.values()].map(async ({ clientId, sid }) => {
        try {
          const client = await provider.Client.find(clientId);
          if (!client?.backchannelLogoutUri) return; // client không khai BCL → bỏ
          await this.withTimeout(client.backchannelLogout(userId, sid));
          ok += 1;
        } catch (e) {
          fail += 1;
          this.logger.warn(`BCL → ${clientId} lỗi: ${String(e)}`);
        }
      }),
    );
    if (ok || fail) {
      this.logger.log(`BCL user ${userId}: ${ok} gửi OK, ${fail} lỗi`);
    }
  }

  /** Chặn 1 client treo lâu làm nghẽn thao tác admin (provider.fetch có thể không timeout). */
  private withTimeout<T>(p: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<T>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error("BCL timeout")),
        BackchannelLogoutService.PER_CLIENT_TIMEOUT_MS,
      );
    });
    return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
  }
}
