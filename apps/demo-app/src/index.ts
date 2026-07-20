/**
 * App demo tích hợp PMH ID (E1-S9, FR-34) — mẫu để dev project ngoài copy:
 *   1. Đăng nhập OIDC Authorization Code + PKCE (openid-client v6)
 *   2. VERIFY JWT OFFLINE bằng JWKS (jose) — không gọi PMH ID mỗi request
 * (Directory API + webhook bổ sung ở Epic 8.)
 *
 * Chạy dev:  PMH_ISSUER=https://localhost/oidc node dist/index.js
 * (dev cert self-signed → đặt NODE_TLS_REJECT_UNAUTHORIZED=0; prod KHÔNG.
 *  Cổng 443 mặc định qua EDGE nginx — không còn :9443 sau khi gộp edge.)
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import express from "express";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import * as oidc from "openid-client";
import { MAX_JWKS_CACHE_SECONDS } from "@pmh/shared";

const ISSUER = process.env.PMH_ISSUER ?? "https://localhost/oidc";
const CLIENT_ID = process.env.PMH_CLIENT_ID ?? "demo-app";
const CLIENT_SECRET = process.env.PMH_CLIENT_SECRET ?? "demo-secret-dev-only";
const PORT = Number.parseInt(process.env.PORT ?? "4000", 10);
const REDIRECT_URI = `http://localhost:${PORT}/auth/callback`;

// --- 1. Discovery: đọc cấu hình từ issuer (KHÔNG hardcode endpoint) ---
const config = await oidc.discovery(
  new URL(ISSUER),
  CLIENT_ID,
  CLIENT_SECRET,
);

// --- 2. JWKS để verify offline. Cache ≤ 10' theo hợp đồng (@pmh/shared) ---
const jwks = createRemoteJWKSet(
  new URL(config.serverMetadata().jwks_uri!),
  { cacheMaxAge: MAX_JWKS_CACHE_SECONDS * 1000 },
);

/**
 * Escape HTML — BẮT BUỘC khi nhét dữ liệu user (full_name, email do admin/
 * Directory nhập) vào HTML, nếu không là stored XSS. Mẫu này để dev copy nên
 * phải làm ĐÚNG, đừng nhân bản lỗ hổng.
 */
function esc(v: unknown): string {
  return String(v).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c] as string,
  );
}

/** Verify access token offline — đây là việc app làm MỖI request thật. */
async function verifyOffline(accessToken: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(accessToken, jwks, {
    issuer: ISSUER,
    audience: CLIENT_ID,
  });
  return payload;
}

// Lưu tạm state → PKCE verifier (app thật dùng session store)
const pending = new Map<string, string>();
// Session tối giản: sid (cookie) → { id_token (cho logout hint), sub (để BCL đá
// đúng user) }. App thật dùng session store thực (express-session/redis).
const sessions = new Map<string, { idToken: string; sub: string }>();
function readCookie(req: express.Request, name: string): string | undefined {
  return (req.headers.cookie ?? "")
    .split(";")
    .map((c) => c.trim().split("="))
    .find(([k]) => k === name)?.[1];
}
const app = express();

app.get("/", (_req, res) => {
  res.send(
    `<h1>Demo app — PMH ID</h1><p><a href="/login">Đăng nhập qua PMH ID</a></p>`,
  );
});

app.get("/login", async (_req, res) => {
  const verifier = oidc.randomPKCECodeVerifier();
  const challenge = await oidc.calculatePKCECodeChallenge(verifier);
  const state = randomBytes(16).toString("hex");
  pending.set(state, verifier);

  const url = oidc.buildAuthorizationUrl(config, {
    redirect_uri: REDIRECT_URI,
    scope: "openid",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  res.redirect(url.href);
});

app.get("/auth/callback", async (req, res) => {
  try {
    const current = new URL(req.url, `http://localhost:${PORT}`);
    const state = current.searchParams.get("state") ?? "";
    const verifier = pending.get(state);
    if (!verifier) throw new Error("state không khớp");
    pending.delete(state);

    // Đổi code lấy token (client secret + PKCE do thư viện lo)
    const tokens = await oidc.authorizationCodeGrant(config, current, {
      pkceCodeVerifier: verifier,
      expectedState: state,
    });

    // VERIFY OFFLINE — không gọi lại PMH ID
    const claims = await verifyOffline(tokens.access_token);

    // Lưu id_token (làm id_token_hint khi logout) + sub (để Back-Channel Logout
    // đá đúng user). App thật lưu vào session store.
    const sid = randomBytes(16).toString("hex");
    sessions.set(sid, { idToken: tokens.id_token ?? "", sub: String(claims.sub) });
    res.setHeader("Set-Cookie", `demo_sid=${sid}; HttpOnly; Path=/; SameSite=Lax`);

    res.send(`<h1>Đăng nhập thành công ✓</h1>
      <p>Access token đã VERIFY OFFLINE qua JWKS (RS256).</p>
      <table border="1" cellpadding="6">
        <tr><td>sub</td><td>${esc(claims.sub)}</td></tr>
        <tr><td>email</td><td>${esc(claims.email)}</td></tr>
        <tr><td>employee_code</td><td>${esc(claims.employee_code)}</td></tr>
        <tr><td>full_name</td><td>${esc(claims.full_name)}</td></tr>
        <tr><td>groups</td><td>${esc(JSON.stringify(claims.groups))}</td></tr>
        <tr><td>ver</td><td>${esc(claims.ver)}</td></tr>
      </table>
      <p>refresh_token: ${tokens.refresh_token ? "có" : "không"}</p>
      <p><a href="/logout">Đăng xuất</a></p>`);
  } catch (e) {
    // User đăng nhập đúng nhưng KHÔNG thuộc group được cấp cho client này → PMH ID
    // trả callback với ?error=access_denied (mục 4.5). Hiện rõ, đừng để thành 500.
    const err = new URL(req.url, `http://localhost:${PORT}`).searchParams.get("error");
    if (err === "access_denied") {
      return res
        .status(403)
        .send(`<h1>Không có quyền truy cập</h1><p>Tài khoản của bạn chưa được cấp quyền vào ứng dụng này. Liên hệ quản trị.</p><p><a href="/">← về trang chủ</a></p>`);
    }
    res.status(500).send(`<h1>Lỗi đăng nhập</h1><pre>${esc(String(e))}</pre>`);
  }
});

// --- Đăng xuất (RP-initiated logout, mục 4.5) — KÈM id_token_hint để kết thúc
// phiên SSO và bỏ qua bước xác nhận. buildEndSessionUrl do thư viện dựng. ---
app.get("/logout", (req, res) => {
  const sid = readCookie(req, "demo_sid");
  const idToken = sid ? sessions.get(sid)?.idToken : undefined;
  if (sid) sessions.delete(sid);
  const url = oidc.buildEndSessionUrl(config, {
    ...(idToken ? { id_token_hint: idToken } : {}),
    post_logout_redirect_uri: `http://localhost:${PORT}`, // phải khớp app_url đã khai
  });
  res.setHeader("Set-Cookie", "demo_sid=; HttpOnly; Path=/; Max-Age=0");
  res.redirect(url.href);
});

// --- 3. Directory API (M2M) — lấy danh bạ user trong group được cấp (E8-S2) ---
// Base API = issuer bỏ hậu tố /oidc. client-credentials dùng chính client_secret.
const API_BASE = ISSUER.replace(/\/oidc$/, "");
app.get("/directory", async (_req, res) => {
  try {
    const tokens = await oidc.clientCredentialsGrant(config);
    const r = await fetch(`${API_BASE}/api/v1/users`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const users = (await r.json()) as unknown;
    res.send(`<h1>Directory API (client-credentials)</h1>
      <p>Danh bạ user thuộc group client được cấp (scope client_groups):</p>
      <pre>${esc(JSON.stringify(users, null, 2))}</pre>
      <p><a href="/">← về trang chủ</a></p>`);
  } catch (e) {
    res.status(500).send(`<pre>${esc(String(e))}</pre>`);
  }
});

// --- Back-Channel Logout: PMH ID POST logout_token (JWT ký) khi phiên SSO kết
// thúc → đá user ra TỨC THÌ. Verify chữ ký qua JWKS (như access token) + kiểm
// claim events; rồi xóa mọi phiên local của sub đó. ---
app.post(
  "/backchannel-logout",
  express.urlencoded({ extended: false }),
  async (req, res) => {
    try {
      const token = (req.body as { logout_token?: string })?.logout_token ?? "";
      if (!token) return res.status(400).json({ error: "missing logout_token" });
      // Verify chữ ký + iss + aud (KHÔNG dùng verifyOffline vì nó cho access token;
      // logout_token có cùng issuer/aud nên tái dùng jwks + jwtVerify).
      const { payload } = await jwtVerify(token, jwks, {
        issuer: ISSUER,
        audience: CLIENT_ID,
      });
      // Bắt buộc theo spec BCL: có claim events backchannel-logout; KHÔNG có nonce
      // (để không nhầm với id_token bị chèn).
      const events = payload.events as Record<string, unknown> | undefined;
      const isLogout =
        !!events &&
        Object.prototype.hasOwnProperty.call(
          events,
          "http://schemas.openid.net/event/backchannel-logout",
        );
      if (!isLogout || "nonce" in payload) {
        return res.status(400).json({ error: "not a valid logout token" });
      }
      // Đá MỌI phiên local của user (theo sub — id nội bộ ổn định).
      let killed = 0;
      for (const [sid, s] of sessions) {
        if (s.sub === payload.sub) {
          sessions.delete(sid);
          killed++;
        }
      }
      console.log(`backchannel-logout OK: sub=${payload.sub} → xóa ${killed} phiên`);
      res.status(200).end();
    } catch (e) {
      console.warn("backchannel-logout: token KHÔNG hợp lệ —", String(e));
      res.status(400).json({ error: "invalid logout_token" });
    }
  },
);

// --- 4. Nhận webhook — VERIFY HMAC-SHA256 TIMING-SAFE (E8-S2, AD-14) ---
// Secret lấy khi admin bật webhook cho client (hiện một lần) → PMH_WEBHOOK_SECRET.
const WEBHOOK_SECRET = process.env.PMH_WEBHOOK_SECRET ?? "";
app.post(
  "/webhook",
  express.raw({ type: () => true }), // cần RAW body để tính HMAC đúng byte
  (req, res) => {
    const body = req.body as Buffer;
    const got = String(req.header("X-PMH-Signature") ?? "");
    const want =
      "sha256=" + createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex");
    // timingSafeEqual chống dò chữ ký theo thời gian; so độ dài trước (nó ném nếu lệch).
    const ok =
      got.length === want.length &&
      timingSafeEqual(Buffer.from(got), Buffer.from(want));
    if (!ok) {
      console.warn("webhook: chữ ký SAI — bỏ");
      return res.status(401).json({ error: "bad_signature" });
    }
    const evt = JSON.parse(body.toString("utf8")) as {
      event: string;
      user_id: string;
    };
    console.log(`webhook OK: ${evt.event} user=${evt.user_id}`);
    // App thật: nếu user.deleted/locked → đá session user khỏi app ngay.
    res.json({ ok: true });
  },
);

app.listen(PORT, () => {
  console.log(`demo-app: http://localhost:${PORT} (issuer ${ISSUER})`);
});
