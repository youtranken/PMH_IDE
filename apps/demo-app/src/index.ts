/**
 * App demo tích hợp PMH ID (E1-S9, FR-34) — mẫu để dev project ngoài copy:
 *   1. Đăng nhập OIDC Authorization Code + PKCE (openid-client v6)
 *   2. VERIFY JWT OFFLINE bằng JWKS (jose) — không gọi PMH ID mỗi request
 * (Directory API + webhook bổ sung ở Epic 8.)
 *
 * Chạy dev:  PMH_ISSUER=https://localhost:9443/oidc node dist/index.js
 * (dev cert self-signed → đặt NODE_TLS_REJECT_UNAUTHORIZED=0; prod KHÔNG)
 */
import { randomBytes } from "node:crypto";
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

app.listen(PORT, () => {
  console.log(`demo-app: http://localhost:${PORT} (issuer ${ISSUER})`);
});
