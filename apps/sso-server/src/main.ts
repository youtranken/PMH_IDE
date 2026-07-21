import "reflect-metadata";
import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { DirectoryApiModule } from "./modules/directory-api/directory-api.module";
import * as argon2 from "argon2";
import cookieParser from "cookie-parser";
import type { NextFunction, Request, Response } from "express";
import { Pool } from "pg";
import { KekService } from "./common/kek.service";
import { PG_POOL } from "./database/database.module";
import { AppModule } from "./app.module";
import { SettingsService } from "./config/settings.service";
import { RateLimitService } from "./modules/auth-oidc/rate-limit.service";
import { OIDC_PROVIDER } from "./oidc/oidc.module";
import type { OidcProviderInstance } from "./oidc/provider.factory";

/** Tách (client_id, secret) từ header Basic (RFC6749 §2.3.1: form-urlencoded). */
function parseBasic(
  auth: string | undefined,
): { clientId: string; secret: string } | null {
  if (!auth?.startsWith("Basic ")) return null;
  try {
    const decoded = Buffer.from(auth.slice(6), "base64").toString("utf8");
    const sep = decoded.indexOf(":");
    if (sep < 0) return null;
    return {
      clientId: decodeURIComponent(decoded.slice(0, sep)),
      secret: decodeURIComponent(decoded.slice(sep + 1)),
    };
  } catch {
    return null;
  }
}

/** Lấy client_id từ header Basic (client_secret_basic) để rate-limit /oidc/token. */
function basicClientId(auth: string | undefined): string | null {
  if (!auth?.startsWith("Basic ")) return null;
  try {
    const decoded = Buffer.from(auth.slice(6), "base64").toString("utf8");
    const id = decoded.split(":")[0];
    return id ? decodeURIComponent(id) : null;
  } catch {
    return null;
  }
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Sau Nginx (TLS termination + sanitize X-Forwarded-*, AD-4). CHỈ tin XFF từ
  // mạng edge (subnet PIN 172.20.0.0/16) + loopback (healthcheck) — KHÔNG tin mọi
  // hop như `true`/`1`, để kẻ chạm thẳng :3000 không giả được X-Forwarded-For qua
  // mặt limiter/audit theo IP (M6). Siết hơn: pin IP tĩnh cho nginx, chỉ tin IP đó.
  app.set("trust proxy", "loopback, 172.20.0.0/16");

  // Security headers (M4): HSTS ép HTTPS; chống clickjacking (trang logout OIDC
  // tự-submit KHÔNG được nhúng iframe); chặn MIME-sniff; giấu referrer. SPA do
  // Nginx phục vụ — đây phủ /oidc (HTML), /api (JSON), /docs. CSP đầy đủ cho SPA
  // đặt ở FE; ở đây chỉ frame-ancestors để không phá trang tương tác OIDC.
  app.use((_req: Request, res: Response, next: NextFunction): void => {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Content-Security-Policy", "frame-ancestors 'none'");
    next();
  });

  // Parse cookie cho các route /api (vé giai đoạn đăng nhập — StageService).
  // oidc-provider tự quản cookie riêng nên không bị ảnh hưởng.
  app.use(cookieParser());

  // Import CSV (E4-S3) gửi cả file dạng text trong JSON → nới giới hạn body.
  // Route quản trị đã sau AdminGuard nên rủi ro DoS thấp; 5mb đủ ~1000 user.
  app.useBodyParser("json", { limit: "5mb" });

  // Dải nội bộ được phép nhận webhook + Back-Channel Logout cấu hình qua .env
  // (WEBHOOK_ALLOWLIST_CIDR) cho tiện ops — seed vào settings lúc boot để mọi nơi
  // đọc settings.get("webhook_allowlist_cidr") vẫn dùng chung một nguồn. Mặc định
  // chặn mọi IP private (chống SSRF); khai dải app on-prem ở đây để BCL/webhook tới được.
  // Đọc THẲNG process.env (không qua ConfigService — validateEnv lọc bỏ biến
  // không khai trong EnvVars). env_file .env đã đưa biến vào process.env.
  {
    const cidr = process.env.WEBHOOK_ALLOWLIST_CIDR;
    if (cidr !== undefined) {
      const settings = app.get(SettingsService);
      await settings.preload();
      await settings.set("webhook_allowlist_cidr", cidr.trim());
    }
  }

  // Chống dò client_secret trên /oidc/token (AD-9/E2-S3): backoff theo
  // client_id, ghi login_attempts. Đặt TRƯỚC mount provider.
  const rateLimit = app.get(RateLimitService);
  app.use(
    "/oidc/token",
    (req: Request, res: Response, next: NextFunction): void => {
      if (req.method !== "POST") return next();
      const ip = req.ip ?? "unknown";
      const clientId = basicClientId(req.headers.authorization) ?? "unknown";
      // Khóa theo (client_id, IP) — client_id là công khai, không được để một
      // mình nó gây backoff cho RP thật; nhánh unknown cô lập theo IP (AD-9).
      const key = `client:${clientId}:${ip}`;
      rateLimit
        .retryAfterSeconds(key)
        .then((wait) => {
          if (wait > 0) {
            res.set("Retry-After", String(wait));
            res.status(429).json({ error: "rate_limited", retryAfter: wait });
            return;
          }
          res.on("finish", () => {
            // .catch BẮT BUỘC: record() reject (DB blip) mà không bắt =
            // unhandled rejection = Node giết cả process.
            rateLimit
              .record(key, clientId, ip === "unknown" ? null : ip, res.statusCode < 400)
              .catch(() => {});
          });
          next();
        })
        .catch(() => next()); // lỗi rate-limit không được chặn đăng nhập
    },
  );

  // Xác thực client_secret cho DB client (E5-S5/S6, Path A). oidc-provider chỉ
  // so 1 secret plaintext; secret dev lại lưu HASH + nhiều bản (active/retiring).
  // Middleware này tự verify secret dev với hash, hợp lệ thì THAY bằng internal
  // secret (KEK-derived) mà adapter Client.find trả cho provider. Client TĨNH
  // (demo-app) và client public (portal, không Basic) đi thẳng. Đặt TRƯỚC mount.
  const pool = app.get<Pool>(PG_POOL);
  const kek = app.get(KekService);
  app.use(
    "/oidc/token",
    (req: Request, _res: Response, next: NextFunction): void => {
      if (req.method !== "POST") return next();
      const creds = parseBasic(req.headers.authorization);
      if (!creds) return next(); // public/PKCE hoặc không Basic → provider lo
      void (async () => {
        const { rows: cli } = await pool.query<{ id: string }>(
          `SELECT id FROM clients WHERE client_id = $1 AND disabled = false`,
          [creds.clientId],
        );
        if (cli.length === 0) return; // client tĩnh hoặc không tồn tại → provider lo
        const { rows: secrets } = await pool.query<{ secret_hash: string }>(
          `SELECT secret_hash FROM client_secrets
           WHERE client_id = $1
             AND (status = 'active'
                  OR (status = 'retiring' AND expires_at > now()))`,
          [cli[0].id],
        );
        for (const s of secrets) {
          if (await argon2.verify(s.secret_hash, creds.secret).catch(() => false)) {
            const internal = kek.deriveClientProviderSecret(creds.clientId);
            req.headers.authorization =
              "Basic " +
              Buffer.from(
                `${encodeURIComponent(creds.clientId)}:${internal}`,
              ).toString("base64");
            return; // khớp → đã thay internal secret; secret sai thì để provider từ chối
          }
        }
      })()
        .catch(() => {}) // lỗi validate không được chặn; provider sẽ từ chối
        .finally(() => next());
    },
  );

  // Mount oidc-provider tại /oidc TRƯỚC listen => đứng trước router Nest
  // trong stack express (body-parser của Nest không đụng request OIDC).
  // Issuer có path /oidc nên URL sinh ra khớp mount này (AD-5).
  const oidcProvider = app.get<OidcProviderInstance>(OIDC_PROVIDER);
  app.use("/oidc", oidcProvider.callback());

  // /api/* → Nginx route vào đây.
  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  // OpenAPI/Swagger CHỈ cho Directory API (M2M) — bề mặt integrator gọi. KHÔNG
  // include module admin (không lộ bản đồ API quản trị). OIDC endpoints tự tả
  // qua Discovery (/oidc/.well-known/openid-configuration) nên không đưa vào đây.
  // UI: /api/directory-docs · JSON: /api/directory-docs-json (đều qua edge /api/).
  const openapi = new DocumentBuilder()
    .setTitle("PMH ID — Directory API (M2M)")
    .setDescription(
      "API danh bạ cho project tích hợp. Xác thực: client_credentials → Bearer access_token. " +
        "OIDC (authorize/token/jwks) xem Discovery: /oidc/.well-known/openid-configuration",
    )
    .setVersion("1")
    // Path trong spec đã gồm global-prefix /api (vd /api/v1/users) → server là
    // GỐC domain, không thêm /api nữa (tránh nhân đôi thành /api/api/...).
    .addServer("https://id.pmh.com.vn", "Production")
    .addBearerAuth(
      { type: "http", scheme: "bearer", description: "access_token từ client_credentials grant" },
      "client-credentials",
    )
    .build();
  const doc = SwaggerModule.createDocument(app, openapi, {
    include: [DirectoryApiModule],
  });
  SwaggerModule.setup("api/directory-docs", app, doc);

  const port = Number.parseInt(process.env.PORT ?? "3000", 10);
  await app.listen(port, "0.0.0.0");
  new Logger("bootstrap").log(`sso-server nghe cổng ${port} (sau Nginx)`);
}

void bootstrap();
