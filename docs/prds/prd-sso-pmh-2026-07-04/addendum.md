# Addendum — Chi tiết kỹ thuật (không thuộc PRD)

> Nội dung mức implementation trích từ `BRAINSTORMING.md` (khóa sổ 2026-07-04), giữ ngoài PRD để PRD ở mức capability. Đây là input cho bước Architecture.

## Tech stack đã chốt đề xuất

| Tầng | Chọn | Ghi chú |
|---|---|---|
| BE | Node.js + TypeScript (NestJS) + `oidc-provider` v9 (panva) | Thư viện OIDC certified — không tự viết lõi authorize/token/ký. **ESM-only** → nhúng vào NestJS (CJS) qua dynamic `import()`. Pin version tới patch. |
| FE | React + Vite + Ant Design | Portal admin + Launcher + trang login |
| DB | PostgreSQL 16 | **Tự viết** Adapter Postgres cho `oidc-provider` (không có adapter chính thức); không cần Redis |
| Email | Nodemailer — dev: Mailpit, prod: Gmail SMTP | |
| Hash | Argon2 (password), hash cả client_secret | Secret hiển thị 1 lần lúc tạo |
| Deploy | Docker Compose: sso-server, portal, postgres, mailpit | On-premise, sau reverse proxy công ty |

Phương án thay thế nếu đổi sang C#: .NET 8 + OpenIddict.

## Cơ chế phiên & token (3 lớp)

| Lớp | Sống ở đâu | TTL |
|---|---|---|
| SSO session (nguồn sự thật) | `oidc_payloads` tại IdP | Idle 15' (reset khi user tương tác thật) + cap tuyệt đối 12h |
| Refresh token | BE mỗi client | **Trói vào session** — mỗi lần dùng kiểm session còn hợp lệ; validity ≤ cap 12h; KHÔNG tự trượt độc lập |
| Access token (JWT) | Mỗi client | 5 phút, verify offline qua JWKS |

> **Quan trọng (gap#1):** "sliding" = hệ quả của session còn sống, không phải refresh token tự gia hạn vô hạn. App để tab mở tự refresh access mỗi 5' KHÔNG kéo dài phiên quá idle 15'/cap 12h — vì mỗi lần refresh, BE kiểm session tại IdP; session hết idle thì refresh bị từ chối, user phải đăng nhập lại. Đây là chỗ chống "phiên bất tử".

Khóa user/reset mật khẩu → hủy sessions + refresh tokens (qua `revokeByGrantId`) → văng mọi app ≤5 phút; webhook (nếu có) đá ngay.

## Schema DB

```sql
users          (id, email UNIQUE, employee_code UNIQUE, full_name,
                status[active|locked|deleted],       -- soft-delete (FR-17)
                deleted_at,                           -- timestamp để audit/reactivate
                password_hash,
                must_change_password BOOL, temp_password_expires_at,
                password_changed_at,                  -- phục vụ bắt đổi 90 ngày
                expires_at,                           -- NULL = vô hạn; NV thời vụ (UTC)
                is_breakglass BOOL DEFAULT false,      -- gap#9: cờ để enforcement MFA-SSA bỏ qua tài khoản break-glass (AD-10); không hard-code email
                created_at, updated_at)
                -- UNIQUE(email)/(employee_code) giữ trên TOÀN bảng kể cả deleted;
                -- NV quay lại = reactivate bản ghi cũ, không tạo trùng.
groups         (id, name UNIQUE, description, created_by, created_at)
user_groups    (user_id, group_id)

projects       (id, name, slug UNIQUE, description, status, created_at)
clients        (id, project_id, client_id UNIQUE,
                env[dev|prod], redirect_uris JSONB, app_url,   -- app_url cho Launcher
                status[active|disabled], allow_all_groups BOOL,
                webhook_url, webhook_secret_enc, created_at)    -- gap#7: webhook_secret MÃ HÓA bằng KEK (AD-15), không lưu trần
client_secrets (id, client_id, secret_hash,           -- rotate có ân hạn (FR-24)
                status[active|retiring|revoked], expires_at, revoked_at, created_at)  -- gap#15: thêm revoked để giữ dấu vết khi thu hồi vì lộ
client_groups  (client_id, group_id)                  -- NGUỒN SỰ THẬT DUY NHẤT của quyền truy cập

admin_roles    (user_id, role[ssa|project_admin])     -- hỗ trợ 2 SSA
admin_projects (user_id, project_id)
mfa_totp       (user_id, totp_secret_enc, enabled_at)          -- TOTP cho SSA (FR-07); enc bằng KEK tách khỏi DB (AD-15)
mfa_recovery   (id, user_id, code_hash, used_at)               -- recovery code in giấy

-- PHIÊN: oidc_payloads là NGUỒN SỰ THẬT (oidc-provider quản qua Adapter, AD-6).
-- Bảng sessions dưới đây là PROJECTION một chiều phục vụ self-service FR-10 (liệt kê/đăng xuất phiên),
-- KHÔNG phải nguồn sự thật; revoke luôn đi qua oidc_payloads (revokeByGrantId), sessions chỉ mirror lại.
sessions       (id, oidc_session_uid,                 -- gap#2: khóa liên kết tới Session trong oidc_payloads
                user_id, auth_time,                   -- gap#3: auth_time cho AD-7 (idle + step-up re-auth); fail-closed nếu thiếu
                ip, user_agent, last_seen_at, expires_at,
                absolute_expires_at, created_at)      -- idle bám session + cap tuyệt đối (UTC)
login_attempts (id, email, client_id,                 -- gap#8: client_id cho chống brute tại /oidc/token (AD-9)
                ip, success BOOL, created_at)         -- input cho chống dò mật khẩu
oidc_payloads  (id, kind, uid, grant_id, client_id,   -- gap#3: các cột AD-6 đặt invariant (index uid/grant_id; revoke theo project qua client_id)
                consumed BOOL, payload JSONB, expires_at, created_at)
                -- bảng nội bộ oidc-provider (session/token/grant/code); consume() atomic trên cột consumed (AD-6)
                -- KHÓA KÝ JWT KHÔNG nằm ở đây: lưu file mount ngoài image/git (AD-8)

audit_logs         (id, actor_user_id, actor_client_id, action,
                    target_type, target_id, project_id,   -- gap#5: project_id để scope audit cho project_admin (FR-30); NULL = sự kiện toàn cục chỉ SSA xem
                    detail JSONB, ip, created_at)
user_events        (event_id BIGSERIAL, user_id, type, payload JSONB, created_at)
                    -- feed cho GET /events?since (FR-27); giữ 90 ngày
email_queue        (id, to_addr, template, payload JSONB,  -- gap#3: hàng đợi email async (AD-13); worker throttle theo Gmail SMTP
                    status[pending|sent|failed], attempts, locked_at, next_retry_at, created_at)
webhook_deliveries (id, client_id, event, payload JSONB,
                    status[pending|ok|failed], attempts,
                    locked_at,                            -- gap#15: cột claim cho SELECT FOR UPDATE SKIP LOCKED (AD-13)
                    next_retry_at, created_at)
settings           (key PK, value JSONB)              -- gap#6: SMTP host/port ở đây; SMTP creds ở .env
-- (otp_codes ĐÃ BỎ — gap#13: quyết định FR-07 không dùng OTP email; reset qua mật khẩu tạm trên bảng users)
```

**Điểm thiết kế chốt từ 2 vòng review (chi tiết ở bước Architecture):**
- Quyền truy cập: chỉ `client_groups`. Bỏ mọi quan hệ "group↔project" tách rời. "User thuộc project P" = JOIN `users→user_groups→client_groups→clients(project_id=P)`.
- MFA SSA = TOTP; recovery code in giấy + tài khoản break-glass offline.
- Chống dò mật khẩu: yêu cầu backoff + không tự-DoS; SSA miễn khóa từ ngoài. Số lớp/thuật toán theo metric thật (Anti-Consensus cảnh báo đừng cargo-cult tầm Okta).
- Rotate khóa ký JWT: `kid` + nhiều khóa JWKS + overlap ≥ (TTL access + JWKS cache); publish-trước-ký-sau; CLI rút khóa lộ khẩn cấp. `oidc-provider` KHÔNG auto-rotate — tự quản mảng `jwks.keys`. **Max JWKS cache TTL của client = 10 phút, ràng buộc trong hợp đồng tích hợp (`shared`) — SSA dựa số này để tính cửa sổ overlap khi rotate** (gap#4).
- Rotate `client_secret`: bảng `client_secrets` nhiều secret song song, cũ `retiring` hết hạn sau khoảng cấu hình; trạng thái `revoked` giữ dấu vết khi thu hồi vì lộ.
- Webhook egress: chỉ https + allowlist CIDR nội bộ + chặn dải private + connect IP đã pin — mức tối thiểu (pin-IP hoãn, xem spine Deferred).
- **Phiên (gap#1, gap#2):** `oidc_payloads` là nguồn sự thật. **Refresh token TRÓI vào session** — mỗi lần dùng refresh phải kiểm session còn hợp lệ (idle 15' + cap 12h); refresh validity ≤ absolute cap. Chữ "sliding" chỉ là hệ quả của session còn sống, KHÔNG phải TTL độc lập tự trượt vô hạn. Bảng `sessions` là projection cho self-service, không phải nguồn sự thật.
- events `since` quá 90 ngày → 410 Gone + cờ resync toàn bộ.
- CSV import: preview bắt trùng nội-bộ-file; commit per-row + hàng đợi email async (bảng `email_queue`).
- Thời gian lưu UTC; cron: auto-lock `expires_at` + email cảnh báo T-N ngày (cột đánh dấu đã-gửi để không trùng) + **dọn TTL `oidc_payloads` hết hạn** (gap#15) + nén audit tháng.
- SMTP: host/port trong `settings` (SSA chỉnh), credentials trong `.env` (gap#6).

## Endpoint

**OIDC (thư viện lo):** `/.well-known/openid-configuration`, `/oidc/authorize`, `/oidc/token`, `/oidc/jwks`, `/oidc/userinfo`, `/oidc/logout`

**Directory API (client-credentials, scope theo client_groups):**
```
GET /api/v1/users?group=&search=&page=
GET /api/v1/users/:id
GET /api/v1/groups
GET /api/v1/events?since=<event_id>
```
Hợp đồng v1: user trả về `{id, employee_code, email, full_name, groups[], status}`; events dùng `event_id` tăng dần, trả theo thứ tự tăng, lưu 90 ngày trong bảng `user_events` (đã chốt — không tái dùng `audit_logs`).

**Webhook events:** `user.locked|unlocked|user.deleted|password_changed|groups_changed` — HMAC-SHA256, retry giãn dần. (`user.deleted` là sự kiện lõi của offboarding — không được rơi.)

**Admin API:** users CRUD + import/export CSV + lock/unlock + reset-password; groups CRUD + members; projects/clients CRUD + rotate-secret + disable + gán group/allow_all; admins (SSA only); audit-logs (SSA xem tất; project_admin lọc theo `audit_logs.project_id` thuộc phạm vi mình — gap#5) + archive viewer; settings (SSA only). Self-service: đổi mật khẩu, xem group, quản lý phiên (liệt kê/đăng xuất từ bảng `sessions`, revoke đi qua `oidc_payloads`).

## Template CSV

```csv
employee_code,email,full_name,groups
NV001,an.nguyen@pmh.com.vn,Nguyễn Văn An,"Kế toán;Hành chính"
NV002,binh.tran@pmh.com.vn,Trần Thị Bình,Kế toán
```

## Vận hành

- Backup: **trọn bộ cùng nhịp đêm** (AD-16) → pg_dump **+ `.env` (cookie keys, KEK TOTP) + file khóa ký**, mã hóa at-rest, path cấu hình trong Settings (ổ mạng/máy khác), giữ 30 bản. Chỉ backup DB → restore xong `totp_secret_enc`/cookie signed thành rác, cả 2 SSA kẹt ngoài. Restore + break-glass login **diễn tập định kỳ**, không chỉ trước golive.
- **Cảnh báo mất-auth phải qua kênh out-of-band** (gap#11): script/cron NGOÀI container (không dùng email worker của chính hệ thống, vì SSO chết thì kênh đó chết cùng) → bắn Telegram/Zalo cho SSA.
- Audit archive: job tháng nén log >1 năm thành `audit-YYYY-MM.jsonl.gz` vào thư mục lưu trữ; portal đọc lại file để hiển thị.
- Giám sát: `/health`; cảnh báo khi webhook_deliveries failed dồn.

## Phương án đã loại (lý do lưu để khỏi bàn lại)

- **Federate Google Workspace:** loại — chủ dự án muốn tự quản hoàn toàn, không phụ thuộc Google (roundtable 2026-07-04).
- **Project kéo credential user về login local:** loại — phân phối password hash là rủi ro nghiêm trọng, mất khả năng thu hồi tức thì. Nhu cầu thật (danh bạ) được đáp ứng bằng Directory API.
- **Dựng trên Keycloak/Zitadel:** loại — lo thừa tính năng khó kiểm soát; đổi lại bắt buộc dùng thư viện OIDC certified cho phần lõi.
- **Remember me:** loại — mâu thuẫn với luật idle 15 phút.
- **Docs công khai không login:** loại theo yêu cầu chủ dự án (dù OIDC là chuẩn công khai, bí mật nằm ở client_secret) — chuyển thành sau login + group Developers.
