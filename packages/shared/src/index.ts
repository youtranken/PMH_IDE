/**
 * @pmh/shared — hợp đồng dùng chung FE / BE / demo-app / project ngoài.
 * MỘT nguồn sự thật cho JWT claims + hằng số hợp đồng (AD-2, AD-8, FR-02).
 * Phá vỡ hợp đồng claims => BẮT BUỘC tăng JWT_CLAIMS_VERSION.
 */

// ---- Phiên bản hợp đồng claims (FR-02) ----
export const JWT_CLAIMS_VERSION = 1;

// ---- Trần cache JWKS phía client (AD-8): client KHÔNG được cache khóa quá 10' ----
export const MAX_JWKS_CACHE_SECONDS = 600;

/**
 * NGUỒN SỰ THẬT DUY NHẤT của hợp đồng claims (FR-02). BE phái sinh cả type
 * `PmhIdTokenClaims` lẫn mảng scope `openid` của oidc-provider từ đây — thêm/bớt
 * một khóa là buộc chạm chỗ này, TS sẽ bắt mọi nơi lệch. Đổi phá vỡ → tăng
 * JWT_CLAIMS_VERSION.
 */
export const PMH_CLAIM_KEYS = [
  "sub",
  "email",
  "employee_code",
  "full_name",
  "groups",
  "ver",
] as const;

export type PmhClaimKey = (typeof PMH_CLAIM_KEYS)[number];

/**
 * Claims trong ID/Access token PMH ID phát ra. Project ngoài verify offline
 * bằng JWKS rồi đọc các claim này. `ver` = JWT_CLAIMS_VERSION lúc phát.
 * Các claim OIDC chuẩn (iss, aud, exp, iat) do provider tự gắn.
 */
export interface PmhIdTokenClaims {
  /** subject = user id (ổn định, không đổi kể cả khi đổi email) */
  sub: string;
  email: string;
  /** mã nhân viên (định danh nội bộ) */
  employee_code: string;
  full_name: string;
  /** tên các group user thuộc — nguồn quyền phía app tự diễn giải */
  groups: string[];
  /** phiên bản hợp đồng claims (FR-02) */
  ver: number;
}

// Chốt biên dịch: PmhIdTokenClaims và PMH_CLAIM_KEYS không được lệch nhau.
// Thêm khóa vào mảng mà quên thêm vào interface (hoặc ngược lại) → lỗi TS ở đây.
type _AssertKeysMatch = PmhClaimKey extends keyof PmhIdTokenClaims
  ? keyof PmhIdTokenClaims extends PmhClaimKey
    ? true
    : ["THIẾU khóa trong PMH_CLAIM_KEYS"]
  : ["THIẾU trường trong PmhIdTokenClaims"];
const _assertKeysMatch: _AssertKeysMatch = true;
void _assertKeysMatch;

// ---- Policy mật khẩu (FR-32) — MỘT luật cho cả FE checklist lẫn BE validate ----

export interface PasswordChecks {
  minLength: boolean;
  lower: boolean;
  upper: boolean;
  digit: boolean;
  special: boolean;
}

/** Nhãn tiếng Việt cho từng luật (FE hiển thị checklist trực quan). */
export const PASSWORD_RULE_LABELS: Record<keyof PasswordChecks, string> = {
  minLength: "Tối thiểu độ dài yêu cầu",
  lower: "Có chữ thường (a-z)",
  upper: "Có chữ HOA (A-Z)",
  digit: "Có chữ số (0-9)",
  special: "Có ký tự đặc biệt",
};

/** Kiểm từng luật (không phán đúng/sai tổng) — FE dùng để tô checklist. */
export function checkPassword(pw: string, minLength = 8): PasswordChecks {
  return {
    minLength: pw.length >= minLength,
    lower: /[a-z]/.test(pw),
    upper: /[A-Z]/.test(pw),
    digit: /[0-9]/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw),
  };
}

/** Hợp lệ khi ĐỦ 4 loại + đủ độ dài (FR-32). */
export function passwordValid(pw: string, minLength = 8): boolean {
  return Object.values(checkPassword(pw, minLength)).every(Boolean);
}

// ---- Tên sự kiện webhook (FR-27/FR-28) — hằng số dùng chung ----
export const WEBHOOK_EVENTS = {
  USER_CREATED: "user.created",
  USER_UPDATED: "user.updated",
  USER_DELETED: "user.deleted",
  USER_PASSWORD_RESET: "user.password_reset",
  USER_LOCKED: "user.locked",
  USER_GROUPS_CHANGED: "user.groups_changed",
} as const;

export type WebhookEvent =
  (typeof WEBHOOK_EVENTS)[keyof typeof WEBHOOK_EVENTS];
