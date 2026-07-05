/**
 * App demo tích hợp PMH ID (E1-S9, FR-34) — mẫu để dev project ngoài copy:
 *   1. Đăng nhập OIDC Authorization Code + PKCE (openid-client v6)
 *   2. VERIFY JWT OFFLINE bằng JWKS (jose) — không gọi PMH ID mỗi request
 * (Directory API + webhook bổ sung ở Epic 8.)
 *
 * Chạy dev:  PMH_ISSUER=https://localhost:9443/oidc node dist/index.js
 * (dev cert self-signed → đặt NODE_TLS_REJECT_UNAUTHORIZED=0; prod KHÔNG)
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import express from "express";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import * as oidc from "openid-client";
import { MAX_JWKS_CACHE_SECONDS } from "@pmh/shared";

const ISSUER = process.env.PMH_ISSUER ?? "https://localhost:9443/oidc";
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
      <p>refresh_token: ${tokens.refresh_token ? "có" : "không"}</p>`);
  } catch (e) {
    res.status(500).send(`<h1>Lỗi đăng nhập</h1><pre>${esc(String(e))}</pre>`);
  }
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
