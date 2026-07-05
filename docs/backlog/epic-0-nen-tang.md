# Epic 0 — Nền tảng & khung dự án

**Phase:** 1 (enabler — mọi epic khác phụ thuộc)
**Mục tiêu:** Có bộ khung monorepo chạy được bằng `docker compose up`: Postgres + Nginx + NestJS rỗng + React rỗng + Mailpit, cấu hình 2 tầng đúng chuẩn, base schema migrate được. Xong epic này là có "sân" để xây mọi thứ.
**Tham chiếu chính:** AD-1, AD-2, AD-3, AD-4, AD-15, Seed.

---

### [E0-S1] Khởi tạo monorepo skeleton
- **Story:** Là dev, cần cấu trúc monorepo chuẩn để mọi phần (server, portal, demo, shared) nằm cùng chỗ và chia sẻ type.
- **Tiêu chí nghiệm thu:**
  - Cây thư mục: `apps/sso-server`, `apps/portal-fe`, `apps/demo-app`, `packages/shared`, `deploy/`.
  - Workspace tool (pnpm/npm workspaces) build được cả 4 package.
  - `packages/shared` import được từ `apps/*`.
- **Tham chiếu:** AD-1, AD-2, Seed | **Phụ thuộc:** — | **Ước lượng:** S

### [E0-S2] Docker Compose hạ tầng dev
- **Story:** Là dev, cần một lệnh dựng cả bộ hạ tầng local để chạy thử.
- **Tiêu chí nghiệm thu:**
  - `docker compose up` khởi động: Postgres 16, Nginx, Mailpit, sso-server, portal-fe.
  - Postgres có volume bền; Mailpit UI truy cập được để xem email dev.
  - Healthcheck cho Postgres; service phụ thuộc chờ Postgres ready.
  - **Sơ đồ cổng host (né project `app` đang chiếm 8080/8443):** Nginx `9443:443` + `9080:80`; Postgres `5433:5432` (chỉ dev, prod bỏ publish); Mailpit `8026:8025` (UI) + `1026:1025` (SMTP); NestJS/worker KHÔNG publish (chỉ sau Nginx). Cổng trong container giữ chuẩn — chỉ đổi cổng host bên trái dấu `:`. Đặt qua biến `.env` (`HOST_HTTPS_PORT=9443`…) để đổi không sửa compose.
- **Tham chiếu:** Seed, AD-16 (Mailpit dev) | **Phụ thuộc:** E0-S1 | **Ước lượng:** M

### [E0-S3] Nginx reverse proxy + TLS + routing
- **Story:** Là hệ thống, cần Nginx làm điểm vào duy nhất để phân luồng và bảo vệ đúng chuẩn.
- **Tiêu chí nghiệm thu:**
  - Route: `/` → portal SPA; `/oidc/*`, `/api/*`, `/interaction/*`, `/docs` → sso-server.
  - TLS termination (dev dùng self-signed; prod tài liệu hóa cert thật).
  - **Sanitize `X-Forwarded-*`** (không tin blind từ client); chỉ tin proxy đã biết.
  - sso-server đặt `provider.proxy = true`; issuer luôn ra `https`.
- **Tham chiếu:** AD-4, AD-3 | **Phụ thuộc:** E0-S2 | **Ước lượng:** M

### [E0-S4] NestJS bootstrap + cấu hình 2 tầng
- **Story:** Là hệ thống, cần khung NestJS với ranh giới cấu hình rõ để bí mật không lẫn tham số runtime.
- **Tiêu chí nghiệm thu:**
  - NestJS chạy, có module rỗng: auth/oidc, users, groups, projects, directory-api, audit, jobs, settings, notifications (AD-1).
  - `.env` giữ bí mật hạ tầng (DB creds, cookie keys, SMTP creds, đường dẫn khóa ký, KEK TOTP).
  - Bảng `settings` giữ tham số runtime; service đọc settings từ DB có cache.
  - Khởi động fail-fast nếu thiếu biến `.env` bắt buộc.
- **Tham chiếu:** AD-15, AD-1 | **Phụ thuộc:** E0-S1 | **Ước lượng:** M

### [E0-S5] Migration + base schema
- **Story:** Là hệ thống, cần schema DB khởi tạo bằng migration để mọi môi trường giống nhau.
- **Tiêu chí nghiệm thu:**
  - Công cụ migration (vd node-pg-migrate/Prisma migrate) chạy `up`/`down`.
  - Tạo đủ bảng theo addendum: `users` (soft-delete, is_breakglass), `groups`, `user_groups`, `projects`, `clients`, `client_secrets`, `client_groups`, `admin_roles`, `admin_projects`, `mfa_totp`, `mfa_recovery`, `sessions`, `login_attempts`, `oidc_payloads`, `audit_logs`, `user_events`, `email_queue`, `webhook_deliveries`, `settings`.
  - UNIQUE(email)/(employee_code) trên toàn bảng; index `oidc_payloads(uid, grant_id, client_id)`.
- **Tham chiếu:** addendum schema, AD-6 | **Phụ thuộc:** E0-S4 | **Ước lượng:** L

### [E0-S6] packages/shared — hợp đồng API
- **Story:** Là dev FE/BE và dev project ngoài, cần một nguồn định nghĩa hợp đồng để không lệch nhau.
- **Tiêu chí nghiệm thu:**
  - Định nghĩa kiểu JWT claims (`sub, email, employee_code, full_name, groups[], ver`) — một nơi duy nhất.
  - Hằng số hợp đồng: `JWT_CLAIMS_VERSION`, `MAX_JWKS_CACHE_SECONDS = 600` (10'), tên webhook event.
  - FE, BE, demo-app đều import từ đây; đổi hợp đồng phá vỡ buộc tăng `ver`.
- **Tham chiếu:** AD-2, AD-8, FR-02 | **Phụ thuộc:** E0-S1 | **Ước lượng:** S
