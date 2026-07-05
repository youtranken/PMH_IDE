# Brainstorming — Hệ thống SSO quản lý user tập trung (PMH)

> Tài liệu chốt ý tưởng trước khi code. Cập nhật lần cuối: 2026-07-04.

## 1. Mục tiêu

Xây một **Identity Provider (IdP) nội bộ** — tương tự Keycloak nhưng nhỏ gọn, tự chủ:

- Quản lý tập trung toàn bộ vòng đời user (~1000 người trở lại).
- Các project khác (QL tài sản, QL hồ sơ, QL văn phòng phẩm, ... do dev khác làm) **không tự quản user** — dùng user từ SSO qua API được cấp.
- Người mới vào công ty: tạo trên SSO, gán vào group. Mỗi project được gán các group được phép truy cập (hoặc gán tất cả group cho nhanh).
- **Quyết định: tự build** (không dựng trên Keycloak — tránh thừa tính năng, khó kiểm soát), nhưng phần lõi OIDC bắt buộc dùng thư viện đã kiểm chứng, không tự viết.

## 2. Khái niệm cốt lõi

| Thuật ngữ | Nghĩa trong hệ thống |
|---|---|
| **User** | Nhân viên, định danh bằng **email công ty** (Gmail công ty cấp) + **mã nhân viên** |
| **Group** | Nhóm user (toàn cục, không gắn phòng ban). 1 user thuộc nhiều group |
| **Project** | Một hệ thống bên ngoài tích hợp SSO (QL tài sản, QL hồ sơ, ...) |
| **Client** | Credential cấp cho project: `client_id` + `client_secret`. Một project có thể có nhiều client (dev/prod). **Admin tạo và cấp cho dev — dev không tự đăng ký** |
| **JWT (access token)** | Vé của user, sinh mỗi lần đăng nhập, sống 5 phút, project verify offline |
| **SSA** | Super admin — toàn quyền hệ thống |
| **project_admin** | Admin phụ: quản các project được phân công, kéo theo group + member của project đó |

Phân tầng quyền (đã chốt): SSO chỉ quyết **"group nào vào được project nào"**. Còn user là admin/viewer/role gì *bên trong* project là việc của project — họ tự đọc claim `groups` trong JWT mà định nghĩa.

## 3. Kiến trúc & luồng

```
                    ┌──────────────────────────────┐
                    │   SSO (sso.pmh.com.vn)       │
   User ──login──▶  │  - OIDC provider             │
                    │  - Admin Portal (FE riêng)   │
                    │  - Directory API             │
                    │  - Webhook dispatcher        │
                    │  - PostgreSQL                │
                    └──────┬───────────────┬───────┘
              JWT + JWKS   │               │  webhook (user.locked, ...)
                           ▼               ▼
              x.pmh.com.vn/projectA   x.pmh.com.vn/projectB   ...
```

### 3.1 Luồng đăng nhập user (OIDC Authorization Code)
1. User mở project A → chưa có phiên → redirect sang trang login của SSO.
2. SSO xác thực (email + mật khẩu; OTP sẽ bật cố định ở phase sau).
3. SSO redirect về project A kèm `code`; BE project A cầm `client_secret` đổi `code` lấy **access token (JWT)** + **refresh token**.
4. JWT chứa: `sub` (**id nội bộ, không phải email** — email có thể đổi), `email`, `employee_code`, `full_name`, `groups[]`, `ver` (version của cấu trúc claims — đây là hợp đồng API với các project, thay đổi phá vỡ phải tăng version và báo trước). Project **verify offline** bằng public key (JWKS) — không gọi về SSO mỗi request → SSO có sập thì user đã login vẫn làm việc tiếp.

### 3.2 Luồng service-to-service (Directory API)
Project dùng `client_id/secret` (client-credentials flow) lấy token gọi Directory API — kéo **danh bạ** user thuộc các group đã gán cho mình (phục vụ nghiệp vụ kiểu "gán tài sản cho nhân viên chưa từng đăng nhập"). Directory API **không bao giờ** trả mật khẩu.

### 3.3 Phiên & token (đã chốt: KHÔNG có remember me)
3 lớp:
| Lớp | Sống ở đâu | TTL |
|---|---|---|
| SSO session cookie | Trình duyệt ↔ sso.pmh.com.vn | Session cookie (đóng trình duyệt là hết) + idle 15 phút |
| Refresh token | BE mỗi project | **Sliding 15 phút** — không thao tác 15 phút là hết phiên, phải đăng nhập lại |
| Access token (JWT) | Mỗi project | **5 phút**, app tự refresh ngầm |

Khóa user / reset mật khẩu → SSO hủy toàn bộ session + refresh token của user → văng khỏi mọi app sau tối đa 5 phút, **cộng webhook (tùy chọn) để app đá ngay lập tức** (mục 6).

> Đã review và chốt giữ nguyên: idle 15 phút là đăng nhập lại, không remember me, không federate Google Workspace — tự quản mật khẩu hoàn toàn. Chấp nhận user gõ mật khẩu nhiều lần/ngày.

## 4. Tech stack (đã chốt đề xuất)

| Tầng | Chọn |
|---|---|
| BE | Node.js + TypeScript (NestJS) + **`node-oidc-provider`** (thư viện OIDC certified) |
| FE | React + Vite + Ant Design (admin portal) |
| DB | PostgreSQL 16 (kèm adapter Postgres cho node-oidc-provider, không cần Redis) |
| Email | Nodemailer — dev: **Mailpit**, prod: **Gmail SMTP** |
| Hash | Argon2 (password), hash cả `client_secret` — secret chỉ hiển thị 1 lần lúc tạo |
| Deploy | Docker Compose: sso-server, admin-portal, postgres, mailpit |

(Phương án thay thế nếu team quen C#: .NET 8 + OpenIddict.)

## 5. Schema DB

```sql
-- Danh tính
users          (id, email UNIQUE, employee_code UNIQUE, full_name,
                status[active|locked], password_hash,
                must_change_password BOOL, temp_password_expires_at,
                expires_at,                 -- NULL = vô hạn; đặt cho NV thời vụ/thử việc
                created_at, updated_at)
groups         (id, name UNIQUE, description, created_at)
user_groups    (user_id, group_id)

-- Project & client
projects       (id, name, slug UNIQUE, description, status, created_at)
clients        (id, project_id, client_id UNIQUE, client_secret_hash,
                env[dev|prod], redirect_uris JSONB, status[active|disabled],
                allow_all_groups BOOL,              -- nút "gán all group"
                webhook_url, webhook_secret, last_rotated_at, created_at)
client_groups  (client_id, group_id)

-- Phân cấp admin (admin cũng là user, login qua chính SSO)
admin_roles    (user_id, role[ssa|project_admin])
admin_projects (user_id, project_id)                -- project_admin quản project nào

-- Phiên & bảo mật
sessions       (id, user_id, ip, user_agent, last_seen_at, expires_at, created_at)
otp_codes      (id, user_id, code_hash, purpose[login|reset], expires_at, used_at)
login_attempts (id, email, ip, success BOOL, created_at)   -- rate-limit/brute-force
oidc_payloads  (...)   -- bảng nội bộ của node-oidc-provider (code, grant, refresh)

-- Vận hành
audit_logs         (id, actor_user_id, actor_client_id, action,
                    target_type, target_id, detail JSONB, ip, created_at)
webhook_deliveries (id, client_id, event, payload JSONB,
                    status[pending|ok|failed], attempts, next_retry_at, created_at)
settings           (key PK, value JSONB)   -- TTL, idle, policy mật khẩu... SSA chỉnh được
```

Lưu ý đã chấp nhận: group là toàn cục — nếu group X gán cho cả project A và B thì admin của A lẫn B đều sửa được member group X; audit log ghi lại mọi thay đổi, SSA phân xử khi va chạm.

## 6. Endpoint

**OIDC (thư viện lo):** `/.well-known/openid-configuration`, `/oidc/authorize`, `/oidc/token`, `/oidc/jwks`, `/oidc/userinfo`, `/oidc/logout`
— Logout: chỉ logout từng app (không single-logout toàn cục — đã chốt).

**Directory API** (client-credentials, chỉ thấy user thuộc group đã gán):
```
GET /api/v1/users?group=&search=&page=
GET /api/v1/users/:id
GET /api/v1/groups
GET /api/v1/events?since=<cursor>        -- polling dự phòng khi webhook rớt
```

**Webhook (SSO → project, ký HMAC-SHA256 bằng webhook_secret, retry 1m/5m/30m):**
- `user.locked` / `user.unlocked` — app nhận được thì hủy phiên local, buộc logout ngay
- `user.password_changed` — tương tự
- `user.groups_changed`

> **Webhook là TÙY CHỌN** (đã chốt): hệ thống triển khai sẵn, project nào cần đá user tức thì thì đăng ký `webhook_url`; project không làm webhook vẫn an toàn nhờ lưới đỡ mặc định — access token 5 phút tự hết + refresh token đã bị hủy.

**Admin API (phân quyền SSA vs project_admin):**
```
POST   /admin/users                     POST /admin/users/import        -- CSV
POST   /admin/users/:id/lock|unlock     POST /admin/users/:id/reset-password
                                        -- body {mode: "manual" | "email_temp"}
CRUD   /admin/groups                    PUT  /admin/groups/:id/members
CRUD   /admin/projects                  CRUD /admin/projects/:id/clients
POST   /admin/clients/:id/rotate-secret POST /admin/clients/:id/disable
PUT    /admin/clients/:id/groups        -- gán group / bật allow_all_groups
CRUD   /admin/admins                    -- SSA only
GET    /admin/audit-logs?actor=&target=&from=
GET|PUT /admin/settings                 -- SSA only
```

## 7. Nghiệp vụ vòng đời user (đã chốt)

- **Tạo user**: admin tạo tay trên portal hoặc **import CSV**. Hệ thống sinh mật khẩu tạm có thời hạn, gửi email, bắt đổi ở lần đăng nhập đầu.
- **Template CSV** (không có phone — dùng mã nhân viên):
  ```csv
  employee_code,email,full_name,groups
  NV001,an.nguyen@pmh.com.vn,Nguyễn Văn An,"Kế toán;Hành chính"
  NV002,binh.tran@pmh.com.vn,Trần Thị Bình,Kế toán
  ```
  Luồng import: upload → preview báo lỗi từng dòng (trùng email/mã NV, group chưa tồn tại — tick "tự tạo group") → xác nhận → gửi mail hàng loạt.
- **Quên mật khẩu**: user tự yêu cầu → hệ thống gửi mật khẩu tạm có thời hạn qua email, bắt đổi lần đăng nhập sau.
- **Admin reset**: đặt tay, hoặc tick "cấp mật khẩu tạm gửi email".
- **Nghỉ việc**: khóa user → hủy toàn bộ phiên + refresh token + bắn webhook (nếu project có đăng ký) → bị đá khỏi mọi app trong tối đa 5 phút.
- Không đồng bộ AD/LDAP, không federate Google Workspace — tự quản mật khẩu hoàn toàn (đã chốt).
- **Quy trình con người** (ai yêu cầu tạo tài khoản, ai duyệt, HR báo nghỉ việc qua kênh nào): xử lý **bên ngoài hệ thống**, không hệ thống hóa — hệ thống chỉ cung cấp công cụ cho admin thao tác.

## 8. Bảo mật (hệ thống ra internet public)

- **Rate-limit đăng nhập** (middleware, đếm qua bảng `login_attempts`), hai lớp: (1) theo email+IP — sai 5 lần trong 15 phút → khóa tạm 15 phút; (2) **theo email bất kể IP** — sai 10 lần trong 15 phút → khóa tạm, chặn kẻ tấn công xoay vòng IP. ✅ đã chốt làm.
- Cookie `Secure + HttpOnly + SameSite`; HTTPS bắt buộc toàn hệ thống.
- **OTP qua email**: thiết kế sẵn (bảng `otp_codes`), **phase sau bật cố định** — ưu tiên bắt buộc cho SSA/project_admin trước.
- JWT ký RS256, public key phát qua JWKS.
- Audit log mọi thao tác admin + mọi lần đăng nhập.

## 9. Sản phẩm bàn giao cho dev các project

Khách hàng của SSO là dev các project khác → ngoài API phải có:
1. **Tài liệu tích hợp** (integration guide): các bước, endpoint, cấu hình thư viện OIDC client, verify JWT, nhận webhook.
2. **App demo mẫu** để dev copy — giảm tối đa hỗ trợ thủ công.
3. Quy trình cấp phát (đã chốt): dev gửi yêu cầu → **admin tạo project + client trên portal, copy secret (chỉ hiện 1 lần) và gửi trực tiếp cho dev** — nên qua kênh riêng tư, tránh email nhóm; dev không có tài khoản portal.

## 10. Lộ trình

1. **Phase 1 — Lõi**: monorepo skeleton, Postgres + Mailpit (Docker Compose), OIDC provider chạy được với 1 app demo, login/logout, JWT + JWKS.
2. **Phase 2 — Portal**: CRUD user/group/project/client, import CSV, gán group→client, rotate/disable secret, reset mật khẩu, audit log, phân quyền SSA/project_admin.
3. **Phase 3 — Tích hợp**: Directory API, webhook + retry, rate-limit, tài liệu + demo cho dev, tích hợp project thật đầu tiên.
4. **Phase sau**: bật OTP cố định, cân nhắc single-logout nếu phát sinh nhu cầu.

## 11. Nhật ký quyết định (review roundtable 2026-07-04)

| Quyết định | Kết luận |
|---|---|
| Federate Google Workspace? | **Không** — tự quản mật khẩu bằng email công ty |
| Idle 15 phút, không remember me | **Giữ nguyên** — không thao tác là đăng nhập lại |
| Webhook | **Tùy chọn** — triển khai sẵn, project cần thì đăng ký; mặc định dựa TTL 5 phút |
| Giao client_secret cho dev | Admin copy (hiện 1 lần) gửi trực tiếp; dev không có tài khoản portal |
| Quy trình tạo/khóa user (ai duyệt) | Xử lý bên ngoài, không hệ thống hóa |
| Directory API cho các project | Giữ Phase 3 — project do dev khác làm, nhu cầu cụ thể chưa rõ; kéo lên sớm nếu có project cần |
| `sub` trong JWT | Id nội bộ, không dùng email; claims có version (`ver`) |
| Rate-limit | Hai lớp: email+IP và email-bất-kể-IP |
| Tài khoản thời vụ | Thêm `users.expires_at` |

## 12. Câu hỏi còn mở

- [ ] Directory API cần trả thêm field gì ngoài mã NV / tên / email / groups? (chờ project thật — dev khác làm, chưa rõ nhu cầu)
- [ ] Tên miền chính thức của SSO (`sso.pmh.com.vn`?)
- [ ] Chính sách độ dài/độ phức tạp mật khẩu, thời hạn mật khẩu tạm (24h?)
- [ ] Thời gian lưu audit log (1 năm?)
