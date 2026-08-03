# Checklist lên PROD — PMH ID (SSO/IdP)

> Trạng thái code (2026-07): **ứng dụng prod-ready** — build nghiêm ngặt (`tsc -b`)
> + 22 test backend pass, đã verify chức năng bằng browser. Việc còn lại dưới đây
> là **cấu hình/vận hành môi trường prod** — phần của người triển khai.
>
> Liên quan: `docs/ops/runbook-recovery.md` (phục hồi, break-glass, rotate, backup).

Đánh dấu ✅ khi xong. Đừng bỏ mục nào ở phần "chặn go-live".

---

## A. CHẶN GO-LIVE (bắt buộc)

### 1. Bí mật — sinh MỚI, KHÔNG dùng giá trị dev
Trên máy prod, sửa `.env`:

```bash
# KEK mã hóa (AES-256 → 32 byte)
openssl rand -base64 32                 # → KEK_BASE64=...

# Khóa ký cookie oidc-provider (2 khóa, phẩy phân tách)
echo "$(openssl rand -base64 32),$(openssl rand -base64 32)"   # → COOKIE_KEYS=...

# Mật khẩu Postgres mạnh
openssl rand -base64 24                 # → POSTGRES_PASSWORD=... (và cập nhật DATABASE_URL)

# Passphrase mã hóa backup
openssl rand -base64 24                 # → BACKUP_PASSPHRASE=...
```

- [ ] `KEK_BASE64` mới (KHÔNG phải giá trị dev — mất KEK = mất toàn bộ secret đã mã hóa).
- [ ] `COOKIE_KEYS` mới.
- [ ] `POSTGRES_PASSWORD` mạnh + `DATABASE_URL` khớp (bỏ `change_me_dev_only`).
- [ ] `BACKUP_PASSPHRASE` mới, **cất offline** (cần để giải mã backup — xem runbook §1).

### 2. Domain, môi trường, TLS
> Domain công khai = **`admin-de.pmh.com.vn`**, cổng **`8443`**. Mọi URL công khai mang `:8443`.
- [ ] `NODE_ENV=production`.
- [ ] `OIDC_ISSUER=https://admin-de.pmh.com.vn:8443/oidc` (KHÔNG localhost, PHẢI có `:8443`). Issuer đổi = mọi client (QLTS/QLHS) phải cập nhật khớp cả cổng.
- [ ] `PORTAL_REDIRECT_URI=https://admin-de.pmh.com.vn:8443/auth/callback` (redirect_uris/post-logout của portal suy từ đây; sai cổng = `invalid_redirect_uri`).
- [ ] DNS `admin-de.pmh.com.vn` → IP host prod.
- [ ] Edge nginx `listen 8443` và publish **`8443:8443`** (không `8443:443`) — để app nội bộ gọi issuer `:8443` cũng trúng. Cert wildcard phủ `admin-de.pmh.com.vn`.
- [ ] **Cert TLS thật** đặt vào `deploy/nginx/certs/` (thay cert tự ký của `gen-certs.sh`). Tên file `fullchain.pem`/`privkey.pem` khớp `deploy/edge/conf.d/*.conf`; EDGE mount thư mục này.
- [ ] Kiểm `allowedHosts` FE đã có `admin-de.pmh.com.vn` (đã có sẵn trong `vite.config.ts`, chỉ ảnh hưởng dev).

### 3. SMTP thật (cấu hình ở FE: Cấu hình → Email)
- [ ] Vào **Cấu hình → Email** đặt: `smtp_host` (Gmail: `smtp.gmail.com`), `smtp_port`
  (`587`), `smtp_user` (địa chỉ Gmail), `smtp_password` (**App password 16 ký tự** —
  Google Account → Bảo mật → Xác minh 2 bước → Mật khẩu ứng dụng; KHÔNG dùng mật khẩu
  Gmail thường), `smtp_from`. Mật khẩu lưu **mã hóa KEK**, chỉ nhập được, không hiện lại.
- [ ] Gửi thử 1 mail (reset mật khẩu 1 user) và nhận được.
- [ ] (Tùy chọn) `.env` có `SMTP_USER/PASSWORD/FROM` làm fallback — chỉ dùng khi setting để trống.

### 4. Compose prod
- [ ] Xoá dòng `ports:` của service **postgres** trong `deploy/docker-compose.yml` (không mở DB ra host — file đã ghi chú "chỉ dev; prod bỏ dòng này").
- [ ] **Khóa ký — CHẶN GO-LIVE (host trắng):** nếu đây là host TRẮNG chưa có backup để
  restore, phải tạo khóa ký ĐẦU TIÊN **trước khi** sso-server phục vụ (prod fail-fast khi
  thiếu `jwks.json`). Build image rồi provision vào volume `signing_keys`:
  ```bash
  docker compose --env-file .env -f deploy/docker-compose.yml \
    -f deploy/docker-compose.prod.yml build sso-server
  docker compose --env-file .env -f deploy/docker-compose.yml \
    -f deploy/docker-compose.prod.yml run --rm sso-server node scripts/rotate-key.js init
  ```
  Khóa ghi dạng mã hóa KEK (`enc:v1:`). Đường RESTORE thì BỎ QUA bước này — `jwks.json`
  khôi phục từ backup (runbook §2).
- [ ] Lên bằng override prod (FE build tĩnh, tắt mailpit). **Phải có `--env-file .env`**
  — compose tìm `.env` cạnh file compose (`deploy/.env`, không tồn tại), không phải
  thư mục đang đứng; thiếu cờ này thì `DATABASE_URL` nội suy rỗng và container chết
  với `no PostgreSQL user name specified in startup packet`:
  ```bash
  docker network create --subnet 172.20.0.0/16 --gateway 172.20.0.1 edge   # 1 lần
  docker compose --env-file .env -f deploy/docker-compose.yml \
    -f deploy/docker-compose.prod.yml up -d --build
  docker compose --env-file .env -f deploy/edge/docker-compose.yml up -d
  ```
- [ ] `BACKUP_DIR` trỏ thư mục host **khác đĩa** với Docker/pg_data (mặc định named
  volume = backup nằm cùng đĩa với DB, hỏng đĩa mất cả hai).

### 5. Migrate DB
- [ ] `docker compose ... exec sso-server pnpm migrate:up` (hoặc để CMD tự chạy lần đầu). Kiểm `migrations` chạy hết, không lỗi.

### 6. Tài khoản quản trị đầu tiên (BOOTSTRAP)
> ⚠️ `scripts/seed-dev.js` là DỮ LIỆU DEV (mật khẩu `Passw0rd!`) — **TUYỆT ĐỐI KHÔNG
> chạy ở prod**. Dùng `scripts/bootstrap-admin.js` (không hardcode mật khẩu, không ghi đè).
- [ ] Tạo 1 tài khoản **SSA**:
  ```bash
  docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.prod.yml \
    exec -e ADMIN_EMAIL=admin@pmh.com.vn -e ADMIN_NAME="Quản trị hệ thống" \
         -e ADMIN_CODE=NV000 -e ADMIN_PASSWORD='<mật khẩu mạnh>' \
         sso-server node scripts/bootstrap-admin.js
  ```
- [ ] Tạo 1 tài khoản **break-glass** (thêm `-e BREAKGLASS=true`, email/mã NV khác — bypass MFA khi kẹt, runbook §3). Cất credential offline.
- [ ] Đăng nhập SSA, bật MFA, đổi sang mật khẩu chỉ mình biết.
- [ ] KHÔNG chạy `seed-dev.js`.

### 7. Client & user thật
- [ ] Với mỗi ứng dụng: tạo client ở màn **Ứng dụng SSO**, `redirect_uris` dùng **https domain thật** (không localhost), lưu `client_secret` (hiện một lần).
- [ ] Import user thật qua **Người dùng → Nhập CSV** (xem trước rồi ghi). Không giữ user demo.

### 8. Smoke test trên staging/prod TRƯỚC khi mở cho toàn công ty
- [ ] `GET /api/health` trả 200.
- [ ] Đăng nhập bằng 1 user thật qua đúng domain https.
- [ ] Một client thật chạy được luồng OIDC (authorize → token → userinfo).
- [ ] Reset mật khẩu → nhận mail thật.
- [ ] project_admin (nếu dùng) đăng nhập, chỉ thấy phạm vi của mình.

---

## B. NÊN CÓ TRƯỚC/NGAY SAU GO-LIVE

- [ ] **Backup hằng đêm**: đặt cron host chạy `docker compose --profile backup run --rm backup` (runbook §6), giữ 30 bản, kiểm 1 bản **restore thử** thành công.
- [ ] **Diễn tập break-glass** một lần (runbook §3, §7) — đảm bảo vào được khi MFA/SSO kẹt.
- [ ] **Cảnh báo out-of-band**: cron ngoài container gọi `/api/health` → Telegram/Zalo khi lỗi (runbook §5).
- [ ] Quy trình **rotate khóa ký** đã đọc/hiểu (runbook §4).
- [ ] Sao lưu **KEK_BASE64 + COOKIE_KEYS + BACKUP_PASSPHRASE** ở nơi an toàn, tách khỏi host.

---

## C. Tùy chọn (không chặn)

- [ ] Tách bước `migrate:up` khỏi lệnh start của sso-server (chạy 1 job riêng) để tránh đua khi chạy nhiều instance.
- [ ] Giảm cỡ bundle FE (hiện 367 KB gzip — ổn cho nội bộ): `manualChunks` tách vendor antd, hoặc nâng `chunkSizeWarningLimit`. Chỉ là cảnh báo, không lỗi.
