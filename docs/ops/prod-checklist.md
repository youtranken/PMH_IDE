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
- [ ] `NODE_ENV=production`.
- [ ] `OIDC_ISSUER=https://id.pmh.com.vn/oidc` (KHÔNG localhost). Issuer đổi = mọi client phải cập nhật.
- [ ] DNS `id.pmh.com.vn` → IP host prod.
- [ ] **Cert TLS thật** đặt vào `deploy/nginx/certs/` (thay cert tự ký của `gen-certs.sh`). Tên file khớp `deploy/nginx/default.conf.template`.
- [ ] Kiểm `allowedHosts` FE đã có `id.pmh.com.vn` (đã có sẵn trong `vite.config.ts`, chỉ ảnh hưởng dev).

### 3. SMTP thật
- [ ] `SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASSWORD/SMTP_FROM` trỏ mail server thật (không mailpit).
- [ ] Gửi thử 1 mail (reset mật khẩu 1 user) và nhận được.

### 4. Compose prod
- [ ] Xoá dòng `ports:` của service **postgres** trong `deploy/docker-compose.yml` (không mở DB ra host — file đã ghi chú "chỉ dev; prod bỏ dòng này").
- [ ] Lên bằng override prod (FE build tĩnh, tắt mailpit):
  ```bash
  docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.prod.yml up -d --build
  ```

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
