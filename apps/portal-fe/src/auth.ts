/**
 * Đăng nhập portal bằng OIDC Authorization Code + PKCE (client công khai
 * pmh-portal), tự viết bằng fetch + crypto.subtle — KHÔNG kéo thư viện (tránh
 * rebuild image). Token giữ ở sessionStorage; tự refresh khi hết hạn (refresh
 * token XOAY mỗi lần theo cấu hình provider). Mọi API gọi qua `api()`.
 */
const CLIENT_ID = "pmh-portal";
const REDIRECT = `${location.origin}/auth/callback`;
const K = {
  at: "pmh_at",
  rt: "pmh_rt",
  exp: "pmh_exp",
  pkce: "pmh_pkce",
  state: "pmh_state",
  usedCode: "pmh_used_code",
};

function b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
function randStr(len = 48): string {
  const a = new Uint8Array(len);
  crypto.getRandomValues(a);
  return b64url(a);
}
async function challenge(verifier: string): Promise<string> {
  const d = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return b64url(new Uint8Array(d));
}

interface TokenResp {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}
function store(t: TokenResp): void {
  sessionStorage.setItem(K.at, t.access_token);
  if (t.refresh_token) sessionStorage.setItem(K.rt, t.refresh_token);
  sessionStorage.setItem(K.exp, String(Date.now() + t.expires_in * 1000));
}
function clear(): void {
  for (const k of Object.values(K)) sessionStorage.removeItem(k);
}

export function isAuthed(): boolean {
  return !!sessionStorage.getItem(K.at);
}

/**
 * Chuyển hướng sang trang đăng nhập PMH ID (PKCE).
 * `prompt="login"` ép hiện lại form (dùng khi Đăng xuất để đổi được user) —
 * boot bình thường KHÔNG truyền prompt để giữ SSO (không bắt nhập lại mỗi lần).
 */
export async function login(prompt?: string): Promise<void> {
  const verifier = randStr();
  const state = randStr(16);
  sessionStorage.setItem(K.pkce, verifier);
  sessionStorage.setItem(K.state, state);
  const params: Record<string, string> = {
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT,
    scope: "openid",
    code_challenge: await challenge(verifier),
    code_challenge_method: "S256",
    state,
  };
  if (prompt) params.prompt = prompt;
  location.href = `/oidc/authorize?${new URLSearchParams(params).toString()}`;
}

/** Xử lý /auth/callback: đổi code lấy token rồi về trang chủ. */
export async function handleCallback(): Promise<void> {
  const q = new URLSearchParams(location.search);
  const code = q.get("code");
  // Guard StrictMode/double-mount: authorization code dùng MỘT lần — lần gọi
  // thứ hai với cùng code sẽ 400 (đã consumed) và văng re-login. Đặt cờ ĐỒNG BỘ
  // (trước mọi await) nên lần chạy sau thấy ngay và bỏ qua.
  if (code && sessionStorage.getItem(K.usedCode) === code) return;
  if (code) sessionStorage.setItem(K.usedCode, code);
  if (q.get("state") !== sessionStorage.getItem(K.state) || !code) {
    clear();
    return login();
  }
  const verifier = sessionStorage.getItem(K.pkce) ?? "";
  const r = await fetch("/oidc/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT,
      client_id: CLIENT_ID,
      code_verifier: verifier,
    }).toString(),
  });
  if (!r.ok) {
    clear();
    return login();
  }
  store(await r.json());
  sessionStorage.removeItem(K.pkce);
  sessionStorage.removeItem(K.state);
  history.replaceState({}, "", "/");
}

async function accessToken(): Promise<string> {
  const exp = Number(sessionStorage.getItem(K.exp) ?? 0);
  const at = sessionStorage.getItem(K.at);
  if (at && Date.now() < exp - 5000) return at;
  const rt = sessionStorage.getItem(K.rt);
  if (!rt) {
    await login();
    throw new Error("redirecting");
  }
  const r = await fetch("/oidc/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: rt,
      client_id: CLIENT_ID,
    }).toString(),
  });
  if (!r.ok) {
    clear();
    await login();
    throw new Error("redirecting");
  }
  store(await r.json());
  return sessionStorage.getItem(K.at) as string;
}

export function logout(): void {
  // prompt=login ép hiện lại form đăng nhập kể cả khi phiên SSO còn sống → đổi
  // được sang user khác (không tự đăng nhập lại user cũ).
  clear();
  login("login");
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public data: { message?: string; error?: string } & Record<string, unknown>,
  ) {
    super(data?.message ?? data?.error ?? `HTTP ${status}`);
  }
}

/** GET trả text thô (vd CSV export) có Bearer + tự refresh. */
export async function apiText(path: string): Promise<string> {
  const at = await accessToken();
  const r = await fetch(path, {
    headers: { Authorization: `Bearer ${at}` },
    credentials: "same-origin",
  });
  if (r.status === 401) {
    clear();
    await login();
    throw new Error("redirecting");
  }
  if (!r.ok) throw new ApiError(r.status, await r.json().catch(() => ({})));
  return r.text();
}

/** Gọi API có Bearer + tự refresh; ném ApiError khi lỗi. */
export async function api<T = unknown>(
  path: string,
  opts: { method?: string; body?: unknown } = {},
): Promise<T> {
  const at = await accessToken();
  const r = await fetch(path, {
    method: opts.method ?? "GET",
    headers: {
      Authorization: `Bearer ${at}`,
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
    },
    credentials: "same-origin",
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (r.status === 401) {
    clear();
    await login();
    throw new Error("redirecting");
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(r.status, data);
  return data as T;
}
