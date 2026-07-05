import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  JWT_CLAIMS_VERSION,
  PMH_CLAIM_KEYS,
  type PmhIdTokenClaims,
} from "@pmh/shared";
import { Pool } from "pg";
import { SettingsService } from "../config/settings.service";
import { importEsm } from "./esm";
import { KeysService } from "./keys.service";
import { PgAdapter, setAdapterKek, setAdapterPool } from "./pg-adapter";

/**
 * Type hẹp cho instance oidc-provider ta dùng (types gói ESM không resolve
 * được dưới CJS — chỉ khai đúng phần chạm tới, mở rộng dần theo epic).
 */
export interface OidcProviderInstance {
  proxy: boolean;
  callback(): (req: unknown, res: unknown) => void;
  interactionDetails(req: unknown, res: unknown): Promise<{
    uid: string;
    prompt: { name: string; details: Record<string, unknown> };
    params: Record<string, unknown>;
    session?: { accountId?: string };
  }>;
  interactionResult(
    req: unknown,
    res: unknown,
    result: Record<string, unknown>,
    options?: { mergeWithLastSubmission?: boolean },
  ): Promise<string>;
}

/** Resource indicator nội bộ — mọi client dùng chung "API PMH". */
const PMH_RESOURCE = "urn:pmh:api";

/** Claims hợp đồng (@pmh/shared) đọc từ DB. Kiểu trả về = hợp đồng FR-02. */
async function loadUserClaims(
  pool: Pool,
  sub: string,
): Promise<PmhIdTokenClaims | undefined> {
  const { rows } = await pool.query<{
    id: string;
    email: string;
    employee_code: string;
    full_name: string;
    groups: string[];
  }>(
    `SELECT u.id, u.email, u.employee_code, u.full_name,
            COALESCE(array_agg(g.name) FILTER (WHERE g.name IS NOT NULL), '{}') AS groups
     FROM users u
     LEFT JOIN user_groups ug ON ug.user_id = u.id
     LEFT JOIN groups g ON g.id = ug.group_id
     WHERE u.id = $1 AND u.deleted_at IS NULL AND u.status = 'active'
     GROUP BY u.id`,
    [sub],
  );
  if (rows.length === 0) return undefined; // khóa/xóa → không phát token mới
  const u = rows[0];
  return {
    sub: u.id, // id nội bộ ổn định, KHÔNG phải email
    email: u.email,
    employee_code: u.employee_code,
    full_name: u.full_name,
    groups: u.groups,
    ver: JWT_CLAIMS_VERSION,
  };
}

/**
 * Dựng oidc-provider v9 (AD-5). Issuer CÓ path /oidc (khớp docs tích hợp);
 * mount express tại /oidc nên routes bên dưới là tương đối.
 */
export async function createOidcProvider(
  config: ConfigService,
  keys: KeysService,
  pgPool: Pool,
  settings: SettingsService,
): Promise<OidcProviderInstance> {
  const logger = new Logger("oidc-provider");
  setAdapterPool(pgPool);
  // KEK để adapter dẫn xuất internal secret của DB client (Path A, E5-S5)
  setAdapterKek(Buffer.from(config.getOrThrow<string>("KEK_BASE64"), "base64"));

  // Dynamic import THẬT (không bị tsc dịch thành require) — AD-5
  const { default: Provider } = await importEsm<{
    default: new (
      issuer: string,
      configuration: Record<string, unknown>,
    ) => OidcProviderInstance;
  }>("oidc-provider");

  const issuer = config.getOrThrow<string>("OIDC_ISSUER");
  const cookieKeys = config
    .getOrThrow<string>("COOKIE_KEYS")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  const isProd = config.get("NODE_ENV") === "production";

  // Tham số phiên từ Settings (AD-15). Preload cache 1 lần rồi đọc ĐỒNG BỘ
  // trong từng closure ttl → SSA đổi runtime (E6-S5 gọi settings.set) có hiệu
  // lực NGAY, không cần restart. (ttl của oidc-provider phải là hàm sync.)
  await settings.preload();
  const accessTtl = () => settings.getIntSync("access_token_ttl_seconds", 300);
  const idleTtl = () => settings.getIntSync("session_idle_seconds", 900);
  const capTtl = () => settings.getIntSync("session_absolute_cap_seconds", 43200);
  logger.log(
    `TTL(boot): access ${accessTtl()}s, idle ${idleTtl()}s, cap ${capTtl()}s (đọc live)`,
  );

  async function findAccount(_ctx: unknown, sub: string) {
    const claims = await loadUserClaims(pgPool, sub);
    if (!claims) return undefined;
    return {
      accountId: sub,
      claims() {
        return claims;
      },
    };
  }

  const provider = new Provider(issuer, {
    // Mọi artifact stateful vào Postgres (AD-6) — bền qua restart, thu hồi được
    adapter: PgAdapter,
    // Khóa ký từ file mount (AD-8); khóa đầu mảng là khóa ký hiện hành
    jwks: { keys: keys.loadOrCreate() },
    cookies: {
      keys: cookieKeys,
      // Cookie interaction mặc định Path=/interaction/:uid — SPA gọi API tại
      // /api/interaction/:uid nên phải nới path để cookie đi kèm (AD-3)
      short: { path: "/" },
    },

    findAccount,

    /**
     * Phiên idle + cap (AD-7, FR-04): ttl.Session tính lại MỖI lần session
     * được lưu (= user thật sự quay lại IdP qua /authorize). Refresh ngầm ở
     * /token KHÔNG đụng session → không reset idle.
     * Thiếu loginTs → fail-closed (coi như hết hạn ngay).
     */
    ttl: {
      Session: (
        _ctx: unknown,
        session: { loginTs?: number },
      ): number => {
        const now = Math.floor(Date.now() / 1000);
        const loginTs =
          typeof session?.loginTs === "number" ? session.loginTs : 0; // fail-closed
        const capRemaining = loginTs + capTtl() - now;
        return Math.max(0, Math.min(idleTtl(), capRemaining));
      },
      AccessToken: () => accessTtl(),
      ClientCredentials: () => accessTtl(),
      AuthorizationCode: 60,
      // Form login được mở tối đa 30' trước khi phiên interaction chết (mặc định
      // lib là 3600s; 600s trước đây khiến form "chết" khi user rời tay vài phút).
      Interaction: 1800,
      Grant: () => capTtl(),
      // Trần refresh = cap; chết sớm hơn theo phiên nhờ expiresWithSession
      RefreshToken: () => capTtl(),
    },

    // Refresh token TRÓI vào phiên (AD-7/FR-04): phiên hết (idle/cap/logout)
    // → refresh bị từ chối tại thời điểm dùng.
    expiresWithSession: () => true,

    // Xoay refresh mỗi lần dùng — kèm phát hiện replay (adapter thu hồi grant)
    rotateRefreshToken: true,

    // Cấp refresh token cho client authorization_code (không cần offline_access
    // — app nội bộ, phiên là nguồn sống duy nhất)
    issueRefreshToken: async (
      _ctx: unknown,
      client: { grantTypeAllowed(t: string): boolean },
    ) => client.grantTypeAllowed("refresh_token"),

    // Endpoint khớp hợp đồng docs tích hợp
    routes: {
      authorization: "/authorize",
      token: "/token",
      jwks: "/jwks",
      userinfo: "/userinfo",
      end_session: "/logout",
    },

    // Hợp đồng claims cố định: mọi client openid nhận đủ claim (FR-02).
    // Phái sinh từ nguồn sự thật @pmh/shared — không viết tay lại danh sách.
    claims: {
      openid: [...PMH_CLAIM_KEYS],
    },

    // Access token = JWT RS256 verify offline được (hợp đồng docs, FR-02/03):
    // resource mặc định urn:pmh:api, format jwt, aud = client_id.
    features: {
      clientCredentials: { enabled: true },
      devInteractions: { enabled: false },
      resourceIndicators: {
        enabled: true,
        defaultResource: () => PMH_RESOURCE,
        useGrantedResource: () => true,
        getResourceServerInfo: (
          _ctx: unknown,
          _resource: string,
          client: { clientId: string },
        ) => ({
          scope: "openid",
          audience: client.clientId,
          accessTokenFormat: "jwt",
          accessTokenTTL: accessTtl(),
          jwt: { sign: { alg: "RS256" } },
        }),
      },
    },

    // Nhét claims hợp đồng vào JWT access token (app verify offline không cần
    // gọi userinfo). sub/aud/iss/exp do provider tự gắn.
    extraTokenClaims: async (
      _ctx: unknown,
      token: { kind: string; accountId?: string },
    ) => {
      if (token.kind !== "AccessToken" || !token.accountId) return undefined;
      const claims = await loadUserClaims(pgPool, token.accountId);
      if (!claims) return undefined;
      const { sub: _sub, ...rest } = claims;
      return rest;
    },

    // Bỏ màn consent: mọi client là first-party nội bộ — tự cấp Grant đúng
    // scope + resource. Gate quyền theo client_groups đến ở E5.
    async loadExistingGrant(ctx: {
      oidc: {
        session?: { accountId?: string; grantIdFor(clientId: string): string };
        client: { clientId: string };
        params: { scope?: string };
        provider: {
          Grant: {
            new (args: { clientId: string; accountId: string }): {
              addOIDCScope(scope: string): void;
              addResourceScope(resource: string, scope: string): void;
              save(): Promise<string>;
            };
            find(id: string): Promise<unknown>;
          };
        };
      };
    }) {
      const { session, client, params, provider: prov } = ctx.oidc;
      const grantId = session?.grantIdFor(client.clientId);
      if (grantId) return prov.Grant.find(grantId);
      if (!session?.accountId) return undefined;
      const grant = new prov.Grant({
        clientId: client.clientId,
        accountId: session.accountId,
      });
      const scope = params.scope ?? "openid";
      grant.addOIDCScope(scope);
      // Resource scope phải khớp scope resource server khai (getResourceServerInfo)
      // — lệch là provider bật consent prompt đòi cấp thêm
      grant.addResourceScope(PMH_RESOURCE, scope);
      await grant.save();
      return grant;
    },

    // Client tĩnh: dev seed cho demo-app; client thật từ DB đến ở E5-S5
    clients: isProd
      ? []
      : [
          {
            client_id: config.get("DEMO_CLIENT_ID") ?? "demo-app",
            client_secret:
              config.get("DEMO_CLIENT_SECRET") ?? "demo-secret-dev-only",
            redirect_uris: [
              config.get("DEMO_CLIENT_REDIRECT_URI") ??
                "http://localhost:4000/auth/callback",
            ],
            grant_types: ["authorization_code", "refresh_token"],
          },
          // Portal quản trị = SPA công khai (không secret) đăng nhập bằng PKCE.
          // Access token của client này là chứng chỉ vào API quản trị (Epic 4+):
          // AdminGuard verify offline rồi đối chiếu admin_roles. redirect về
          // /auth/callback do portal SPA xử lý (Epic 6).
          {
            client_id: config.get("PORTAL_CLIENT_ID") ?? "pmh-portal",
            token_endpoint_auth_method: "none",
            redirect_uris: [
              config.get("PORTAL_REDIRECT_URI") ??
                "https://localhost:9443/auth/callback",
            ],
            response_types: ["code"],
            grant_types: ["authorization_code", "refresh_token"],
          },
        ],
  });

  // Sau Nginx TLS termination — tin X-Forwarded-* đã được sanitize (AD-4)
  provider.proxy = true;

  logger.log(`oidc-provider sẵn sàng — issuer ${issuer}`);
  return provider;
}
