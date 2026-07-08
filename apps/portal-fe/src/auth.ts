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
 * boot bình thường KHÔNG truyền prompt để giữ SSO (không bắt nhập lại mỗi lần);
 * `prompt` để sẵn phòng khi cần ép hiện lại form (hiện chưa caller nào dùng —
 * Đăng xuất nay đi qua end_session, hủy phiên SSO thật).
 */
// Chặn "login() storm": nhiều request 401 đồng thời (vd sau khi user bị vô hiệu
// hóa) mỗi cái gọi login() → ghi đè pkce/state của nhau → thừa một vòng đăng nhập
// tự sửa. Chỉ cho MỘT điều hướng login diễn ra (trang sẽ rời đi, không cần reset).
let loginInFlight = false;

export async function login(prompt?: string): Promise<void> {
  if (loginInFlight) return;
  loginInFlight = true;
  try {
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
  } catch (e) {
    // challenge()/crypto.subtle có thể ném (context không bảo mật) TRƯỚC khi rời
    // trang → phải gỡ cờ, nếu không login() kẹt vĩnh viễn.
    loginInFlight = false;
    throw e;
  }
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
  sessionStorage.removeItem(K.usedCode); // dọn cờ chống double-mount sau khi xong
  history.replaceState({}, "", "/");
}

// Gộp refresh ĐỒNG THỜI vào MỘT lần (single-flight): nhiều api() chạy song song
// (vd trang gọi Promise.all) khi token vừa hết hạn sẽ cùng chờ chung một refresh,
// thay vì mỗi cái tự POST /token bằng cùng refresh_token → lần thứ hai là REPLAY
// của token đã xoay (rotateRefreshToken) → 400 + provider thu hồi grant → kẹt login.
let refreshInFlight: Promise<string> | null = null;

async function accessToken(): Promise<string> {
  const exp = Number(sessionStorage.getItem(K.exp) ?? 0);
  const at = sessionStorage.getItem(K.at);
  if (at && Date.now() < exp - 5000) return at;
  if (refreshInFlight) return refreshInFlight; // đã có refresh đang chạy → dùng chung
  refreshInFlight = doRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function doRefresh(): Promise<string> {
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
  // Đăng xuất THẬT: qua end_session của oidc-provider để HỦY phiên SSO (không chỉ
  // xóa token local). Phiên SSO chết → refresh token mọi app trói phiên cũng chết
  // (expiresWithSession) → single-logout toàn hệ. Provider quay portal về "/" →
  // boot() thấy hết phiên → hiện form login (đăng nhập lại được user khác).
  clear();
  const params = new URLSearchParams({
    post_logout_redirect_uri: `${location.origin}/`,
    client_id: CLIENT_ID,
  });
  location.href = `/oidc/logout?${params.toString()}`;
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
