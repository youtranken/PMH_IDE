import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  JWT_CLAIMS_VERSION,
  PMH_CLAIM_KEYS,
  type PmhIdTokenClaims,
} from "@pmh/shared";
import { Pool } from "pg";
import { SettingsService } from "../config/settings.service";
import { isClientLoginAllowed } from "../modules/auth-oidc/login.service";
import { assertEgressAllowed } from "../modules/notifications/egress.util";
import { importEsm } from "./esm";
import { KeysService } from "./keys.service";
import {
  PgAdapter,
  setAdapterKek,
  setAdapterPool,
  setAdapterSessionTtls,
} from "./pg-adapter";

/**
 * Type hẹp cho instance oidc-provider ta dùng (types gói ESM không resolve
 * được dưới CJS — chỉ khai đúng phần chạm tới, mở rộng dần theo epic).
 */
export interface OidcProviderInstance {
  proxy: boolean;
  on(event: string, cb: (...args: unknown[]) => void): void;
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
  const { default: Provider, errors } = await importEsm<{
    default: new (
      issuer: string,
      configuration: Record<string, unknown>,
    ) => OidcProviderInstance;
    errors: { AccessDenied: new (description?: string) => Error };
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
  // Adapter gia hạn phiên theo hoạt động (idle trượt) dùng chính 2 tham số này.
  setAdapterSessionTtls(idleTtl, capTtl);
  logger.log(
    `TTL(boot): access ${accessTtl()}s, idle ${idleTtl()}s, cap ${capTtl()}s (đọc live)`,
  );

  // Portal (SPA) redirect + post-logout: sau end_session, provider quay portal về
  // origin gốc "/" → boot() thấy hết phiên → hiện form login. Suy origin từ chính
  // redirect_uris để không lệch host giữa dev/prod.
  const portalRedirects = config.get("PORTAL_REDIRECT_URI")
    ? config.get<string>("PORTAL_REDIRECT_URI")!.split(",").map((s) => s.trim())
    : [
        // EDGE nginx phục vụ portal ở cổng 443 (không port trong URL). Cổng 9443
        // cũ đã bỏ khi gộp về EDGE chung — redirect_uri phải khớp location.origin
        // của SPA (https://id.pmh.com.vn) nếu không authorize trả invalid_redirect_uri.
        "https://id.pmh.com.vn/auth/callback",
        "https://localhost/auth/callback",
      ];
  const portalPostLogout = Array.from(
    new Set(portalRedirects.map((u) => new URL(u).origin + "/")),
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

    /**
     * Trang lỗi thô của oidc-provider (vd "interaction session not found" khi
     * logout đổi user, form mở quá lâu, tab cũ, phiên xoay) rất khó hiểu với user.
     * Với các lỗi PHỤC HỒI ĐƯỢC → đưa thẳng về portal `/` để bắt đầu đăng nhập
     * lại (SPA tự gọi login()); còn lại hiện trang tối giản không lộ chi tiết.
     */
    renderError: async (
      ctx: {
        status: number;
        type: string;
        body: unknown;
        set: (k: string, v: string) => void;
      },
      _out: unknown,
      error: { name?: string; error?: string; error_description?: string },
    ) => {
      // CHỈ phục hồi lỗi liên quan interaction/phiên/cookie — KHÔNG nuốt lỗi
      // tích hợp thật của client dev (vd sai redirect_uri/scope) để họ còn debug.
      const recoverable =
        error?.name === "SessionNotFound" ||
        /interaction|session (not found|expired)|cookie/i.test(
          error?.error_description ?? "",
        );
      if (recoverable) {
        ctx.status = 303;
        ctx.set("Location", "/");
        ctx.body = "";
        return;
      }
      ctx.type = "html";
      ctx.body =
        '<!doctype html><meta charset="utf-8"><title>PMH ID</title>' +
        '<body style="font-family:system-ui;text-align:center;padding:48px;color:#16211F">' +
        "<h3>Có lỗi xảy ra</h3><p>Vui lòng <a href=\"/\">đăng nhập lại</a>.</p></body>";
    },

    findAccount,

    /**
     * Phiên idle + cap (AD-7, FR-04): ttl.Session = min(idle, còn-lại-tới-cap),
     * tính lại mỗi lần session được lưu (khi user quay lại IdP qua /authorize).
     * Idle TRƯỢT theo HOẠT ĐỘNG: mỗi refresh ngầm ở /token cũng đẩy
     * expires_at của Session +idle (xem pg-adapter, bump trên RefreshToken),
     * nên chỉ KHÔNG-thao-tác đủ lâu mới hết idle — đúng ý "có thao tác = còn sống".
     * Cap 12h là trần cứng, refresh không vượt được. Thiếu loginTs → fail-closed.
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

    // oidc-provider gắn dispatcher chống-SSRF (chặn MỌI IP private) vào mọi fetch
    // ra ngoài — kể cả Back-Channel Logout. App PMH nội bộ đều ở IP private → BCL
    // bị chặn hết. Ta gỡ dispatcher đó NHƯNG thay bằng egress guard của mình (https
    // + chặn private TRỪ allowlist CIDR) áp NGAY LÚC GỬI (L6) — thay vì tin mỗi
    // validate lúc admin lưu. Nhờ vậy mọi kênh egress của provider (BCL hiện tại,
    // và jwks_uri/request_uri/sector_uri nếu bật sau) đều không thể SSRF nội bộ.
    fetch: async (url: string | URL, options: Record<string, unknown>) => {
      const { dispatcher: _drop, ...rest } = options ?? {};
      const allowlist =
        (await settings.get("webhook_allowlist_cidr", "")) ?? "";
      await assertEgressAllowed(String(url), allowlist); // ném nếu đích bị chặn
      return globalThis.fetch(url as string, rest);
    },

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
      // Back-Channel Logout (OIDC BCL): khi phiên SSO kết thúc (end_session),
      // provider POST logout_token (JWT ký) tới backchannel_logout_uri của MỌI
      // client trong phiên → app đá user ra TỨC THÌ, không chờ token hết hạn.
      backchannelLogout: { enabled: true },
      // RP-initiated logout (single-logout). App gọi /oidc/logout → hủy phiên SSO
      // → quay về post_logout_redirect_uri. Mặc định thư viện hiện trang xác nhận
      // (nhúng font CDN, vi phạm quy tắc no-CDN) → thay bằng trang PMH tự-submit:
      // đăng xuất mượt không cần bấm, có fallback nút khi JS tắt.
      rpInitiatedLogout: {
        enabled: true,
        logoutSource: async (
          ctx: { type: string; body: string },
          form: string,
        ) => {
          ctx.type = "html";
          ctx.body = `<!doctype html><html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Đăng xuất — PMH ID</title>
<style>body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;text-align:center;padding:56px 24px;color:#16211F;background:#fff}
h3{font-weight:600;margin:0 0 8px}.muted{color:#5a6b66;font-size:14px;margin:0 0 20px}
.btn{font:inherit;font-weight:600;padding:10px 22px;border:0;border-radius:8px;background:#1d7a4d;color:#fff;cursor:pointer}</style>
</head><body onload="var b=document.querySelector('button[name=logout]');if(b)b.click()">
${form}
<h3>Đang đăng xuất…</h3>
<p class="muted">Nếu trang không tự chuyển, hãy bấm nút bên dưới.</p>
<button class="btn" type="submit" form="op.logoutForm" value="yes" name="logout">Đăng xuất khỏi PMH ID</button>
</body></html>`;
        },
        postLogoutSuccessSource: async (ctx: {
          type: string;
          body: string;
        }) => {
          ctx.type = "html";
          ctx.body = `<!doctype html><html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Đã đăng xuất — PMH ID</title>
<style>body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;text-align:center;padding:56px 24px;color:#16211F;background:#fff}
h3{font-weight:600;margin:0 0 8px}a{color:#1d7a4d;font-weight:600;text-decoration:none}</style>
</head><body><h3>Bạn đã đăng xuất khỏi PMH ID.</h3>
<p><a href="/">Đăng nhập lại</a></p></body></html>`;
        },
      },
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
    // scope + resource. Phân quyền theo client_groups (E5-S3) enforce NGAY dưới.
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

      // CỔNG PHÂN QUYỀN theo client_groups (E5-S3, AD-11) — chốt chặn DUY NHẤT
      // chạy cho CẢ login mới LẪN dùng lại phiên SSO. Cổng ở interaction
      // (submitLogin) CHỈ phủ đường nhập mật khẩu; user đã có phiên SSO (vd đã
      // đăng nhập Portal — client tĩnh, ai cũng vào) sẽ được cấp token cho MỌI
      // client mà KHÔNG qua interaction → bypass. Chặn tại đây bịt đường đó.
      // (client tĩnh/allow_all vẫn được phép — xem isClientLoginAllowed.)
      if (
        session?.accountId &&
        !(await isClientLoginAllowed(pgPool, session.accountId, client.clientId))
      ) {
        throw new errors.AccessDenied("no_access_to_client");
      }

      const grantId = session?.grantIdFor(client.clientId);
      if (grantId) {
        const existing = await prov.Grant.find(grantId);
        if (existing) return existing;
        // Grant đã bị THU HỒI (vd phát hiện replay refresh) nhưng session vẫn nhớ
        // grantId cũ → KHÔNG trả undefined (sẽ khiến provider vòng lặp interaction,
        // khóa luôn login) mà rơi xuống dưới tạo grant mới thay thế.
      }
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
            post_logout_redirect_uris: ["http://localhost:4000"],
            backchannel_logout_uri: "http://localhost:4000/backchannel-logout",
          },
          // Portal quản trị = SPA công khai (không secret) đăng nhập bằng PKCE.
          // Access token của client này là chứng chỉ vào API quản trị (Epic 4+):
          // AdminGuard verify offline rồi đối chiếu admin_roles. redirect về
          // /auth/callback do portal SPA xử lý (Epic 6).
          {
            client_id: config.get("PORTAL_CLIENT_ID") ?? "pmh-portal",
            token_endpoint_auth_method: "none",
            // SPA dùng location.origin → đăng ký mọi host dev truy cập được.
            // id.pmh.com.vn = domain chính thức; localhost giữ cho test/tương thích.
            redirect_uris: portalRedirects,
            // Đăng xuất portal đi qua end_session rồi quay về origin "/" (đăng
            // xuất THẬT, hủy phiên SSO) — phải khai địa chỉ này.
            post_logout_redirect_uris: portalPostLogout,
            response_types: ["code"],
            grant_types: ["authorization_code", "refresh_token"],
          },
        ],
  });

  // Sau Nginx TLS termination — tin X-Forwarded-* đã được sanitize (AD-4)
  provider.proxy = true;

  // Log kết quả Back-Channel Logout (vận hành: biết app nào nhận/miss logout token)
  provider.on("backchannel.success", (...a: unknown[]) => {
    const client = a[1] as { clientId?: string };
    logger.log(`backchannel logout OK → ${client?.clientId}`);
  });
  provider.on("backchannel.error", (...a: unknown[]) => {
    const err = a[1] as { message?: string; cause?: { code?: string; message?: string } };
    const client = a[2] as { clientId?: string };
    logger.error(
      `backchannel logout LỖI → ${client?.clientId}: ${err?.message} | cause=${err?.cause?.code ?? ""} ${err?.cause?.message ?? ""}`,
    );
  });

  logger.log(`oidc-provider sẵn sàng — issuer ${issuer}`);
  return provider;
}
