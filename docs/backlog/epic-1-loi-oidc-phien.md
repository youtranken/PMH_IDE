# Epic 1 — Lõi OIDC & phiên

**Phase:** 1 (tim của hệ thống)
**Mục tiêu:** Một app demo đăng nhập được qua PMH ID theo chuẩn OIDC, nhận JWT verify offline được; phiên tuân đúng idle 15'/cap 12h; thu hồi hoạt động thật. Đây là phần khó và load-bearing nhất.
**Tham chiếu chính:** AD-3, AD-5, AD-6, AD-7, AD-8, FR-01..06.

---

### [E1-S1] Nhúng oidc-provider v9 vào NestJS
- **Story:** Là hệ thống, cần tích hợp thư viện OIDC certified để không tự viết lõi crypto/authorize.
- **Tiêu chí nghiệm thu:**
  - `oidc-provider` v9 (pin patch) nạp được vào NestJS (CJS) qua **dynamic `import()`**.
  - Các endpoint sống: `/.well-known/openid-configuration`, `/oidc/authorize`, `/oidc/token`, `/oidc/jwks`, `/oidc/userinfo`, `/oidc/logout`.
  - Bật `features.clientCredentials`; cấu hình cookies.keys từ .env, `provider.proxy=true`.
- **Tham chiếu:** AD-5, AD-4 | **Phụ thuộc:** E0-S3, E0-S4 | **Ước lượng:** M

### [E1-S2] Khóa ký JWT + JWKS + kid
- **Story:** Là project tích hợp, cần verify JWT offline bằng khóa công khai ổn định.
- **Tiêu chí nghiệm thu:**
  - Khóa ký (RS256) load từ **file mount ngoài image/git**; KHÔNG trong DB.
  - `jwks.keys` là mảng nhiều khóa, mỗi khóa có `kid`; JWKS endpoint publish tất cả public key.
  - JWT phát ra có `kid` trong header; verify được bằng JWKS.
- **Tham chiếu:** AD-8, FR-03 | **Phụ thuộc:** E1-S1 | **Ước lượng:** M

### [E1-S3] Tự viết Postgres Adapter cho oidc-provider
- **Story:** Là hệ thống, cần Adapter lưu artifact OIDC trong Postgres để token/session bền qua restart và thu hồi được.
- **Tiêu chí nghiệm thu:**
  - Implement đủ: `upsert/find/findByUid/findByUserCode/consume/destroy/revokeByGrantId`, tự lo TTL.
  - **`consume()` atomic** (`UPDATE ... WHERE consumed IS NULL RETURNING`).
  - **`revokeByGrantId` xóa trọn** session+access+refresh+code cùng grant trong một transaction.
  - Mỗi grant/session gắn `client_id` (phục vụ revoke theo project).
  - **Test replay** (dùng lại refresh đã consume → thu hồi cả grant) + **test thu hồi** pass.
- **Tham chiếu:** AD-6, FR-05 | **Phụ thuộc:** E0-S5, E1-S1 | **Ước lượng:** L

### [E1-S4] Login interaction (Nginx → SPA → API)
- **Story:** Là user, cần một trang đăng nhập để gõ email + mật khẩu khi app đẩy sang PMH ID.
- **Tiêu chí nghiệm thu:**
  - `oidc-provider` redirect tới `/interaction/:uid`; Nginx trả `index.html` của SPA cho path đó.
  - SPA render form login; submit gọi `POST /api/interaction/:uid` (NestJS) xác thực email+mật khẩu (Argon2).
  - Đăng nhập đúng → hoàn tất interaction → redirect về app với code; sai → báo lỗi (đồng nhất, không lộ email tồn tại).
- **Tham chiếu:** AD-3, FR-01 | **Phụ thuộc:** E1-S1, E1-S3 | **Ước lượng:** L

### [E1-S5] Phiên: idle 15' + cap tuyệt đối 12h
- **Story:** Là hệ thống, cần phiên hết hạn đúng nghĩa để tab để mở không sống bất tận.
- **Tiêu chí nghiệm thu:**
  - Session lưu `auth_time` + `last_seen_at` (UTC); `ttl.Session` là hàm tính idle + cap.
  - Idle reset **chỉ khi user tương tác thật tại IdP**, không reset bởi refresh ngầm.
  - Cap tuyệt đối 12h; thiếu `auth_time`/`last_seen_at` → **fail-closed** (coi hết hạn).
  - Các con số nằm trong Settings.
- **Tham chiếu:** AD-7, FR-04 | **Phụ thuộc:** E1-S3 | **Ước lượng:** M

### [E1-S6] Refresh token trói vào phiên
- **Story:** Là hệ thống, cần refresh token không sống quá phiên để chống phiên bất tử qua ngả refresh.
- **Tiêu chí nghiệm thu:**
  - Mỗi lần dùng refresh, kiểm session còn hợp lệ (idle + cap) tại thời điểm đó; hết phiên → từ chối.
  - Refresh validity ≤ absolute cap; `rotateRefreshToken` bật (replay detection).
  - Test: app refresh mỗi 5' trong tab mở, sau 15' không tương tác → refresh bị từ chối.
- **Tham chiếu:** AD-7, FR-04 | **Phụ thuộc:** E1-S5 | **Ước lượng:** M

### [E1-S7] Logout
- **Story:** Là user, cần đăng xuất khỏi PMH ID.
- **Tiêu chí nghiệm thu:**
  - Endpoint logout chấm dứt phiên SSO; logout từng app riêng (không single-logout toàn cục).
- **Tham chiếu:** FR-06 | **Phụ thuộc:** E1-S5 | **Ước lượng:** S

### [E1-S8] Nạp claims user vào JWT (findAccount)
- **Story:** Là project tích hợp, cần JWT chứa đúng thông tin user để phân quyền — đây là hợp đồng API cốt lõi.
- **Tiêu chí nghiệm thu:**
  - Implement `findAccount`/`claims` của oidc-provider: map user record → `sub` (id nội bộ), `email`, `employee_code`, `full_name`, `groups[]` (từ user_groups), `ver` (từ `shared`).
  - `sub` là id nội bộ ổn định, KHÔNG phải email; `groups[]` phản ánh group hiện tại của user.
  - Test: token phát ra chứa đủ 6 claim đúng giá trị; đổi group của user → token mới phản ánh.
- **Tham chiếu:** FR-02, AD-2 | **Phụ thuộc:** E1-S1, E5-S1 (group) hoặc seed group tối thiểu | **Ước lượng:** M

### [E1-S9] App demo đăng nhập được (nghiệm thu Phase 1 sớm)
- **Story:** Là dev, cần một app mẫu chứng minh luồng OIDC chạy end-to-end.
- **Tiêu chí nghiệm thu:**
  - `apps/demo-app` (Express + openid-client) đăng nhập qua PMH ID, nhận JWT, verify offline qua JWKS.
  - Hiển thị claims (`sub, email, groups`) sau đăng nhập.
  - (Bản đầy đủ Directory API/webhook để Epic 8.)
- **Tham chiếu:** FR-34, G4 | **Phụ thuộc:** E1-S2, E1-S4, E1-S8 | **Ước lượng:** M
