# Triển khai PROD cụm PMH — EDGE + PMH ID (admin-de) + QLTS

> Bộ script cho **người mới**, chỉ lo **hạ tầng**. Nghiệp vụ từng app nằm ngoài phạm vi.
> Phạm vi đợt này: **EDGE nginx + PMH ID (admin-de.pmh.com.vn) + QLTS**. QLHS làm sau.
> Cổng công khai của cụm = **8443** (không dùng 443). Mọi URL công khai mang `:8443`.

---

## 0. Trước khi bắt đầu — 3 việc của ĐỘI MẠNG (không phải script)

Làm xong 3 việc này rồi mới chạy script. Chi tiết trong `docs/ops/TRIEN_KHAI_PROD_CLUSTER_8443.md` §4 (bước A–E).

1. **DNS nội bộ (AD):** tạo 3 zone FQDN riêng, mỗi zone 1 record A tại gốc `@` → **IP host prod**
   (`admin-de.pmh.com.vn`, `qlts.pmh.com.vn`, và sau này `qlhs.pmh.com.vn`).
   ⚠️ ĐỪNG tạo nguyên zone `pmh.com.vn` (sẽ chiếm hết `*.pmh.com.vn`).
2. **DNS công cộng (PA):** 3 record A cùng trỏ **IP public**.
3. **Firewall Sophos:** DNAT `#Port2:8443 → <IP host>:8443` — **giữ 8443, KHÔNG dịch về 443**;
   thêm policy cho LAN → host:8443 Allow.

**Chứng chỉ:** bạn đã có cert thật `*.pmh.com.vn`. Đặt 2 file vào host prod (script `20` sẽ kiểm):
```
/opt/pmh/PMH_IDE/deploy/nginx/certs/fullchain.pem
/opt/pmh/PMH_IDE/deploy/nginx/certs/privkey.pem
```

---

## 1. Bootstrap máy prod (chạy 1 lần)

Copy 2 file `00-prep-ubuntu.sh` và `10-clone.sh` sang máy prod (scp hoặc curl raw từ GitHub), rồi:

```bash
sudo bash 00-prep-ubuntu.sh      # cài Docker + git + mở firewall OS
newgrp docker                    # nạp lại quyền docker cho user (hoặc logout/login)
bash 10-clone.sh                 # clone PMH_IDE + QLTS_DE về /opt/pmh
```

Sau bước này mọi script còn lại nằm sẵn ở `/opt/pmh/PMH_IDE/deploy/prod-cluster/`.
`cd /opt/pmh/PMH_IDE/deploy/prod-cluster` để chạy tiếp.

---

## 2. Thứ tự chạy (ĐÚNG THỨ TỰ — sai thứ tự là lỗi khó hiểu)

```
bash gen-secrets.sh          # in ra các secret ngẫu nhiên để dán vào .env (không tự ghi)

# --- Điền .env cho PMH ID ---
cp env-templates/idp.env.example  /opt/pmh/PMH_IDE/.env
nano /opt/pmh/PMH_IDE/.env        # dán secret từ gen-secrets, sửa CHANGE_ME

# --- Đặt cert thật vào /opt/pmh/PMH_IDE/deploy/nginx/certs/ (xem mục 0) ---

bash 20-edge-up.sh           # tạo network edge (subnet ghim) + dựng EDGE nginx
bash 30-idp-up.sh            # build + init khóa ký (host trắng) + lên PMH ID + chờ health
bash 31-idp-bootstrap-admin.sh   # tạo tài khoản quản trị SSA đầu tiên (hỏi email/mật khẩu)
```

**➡️ Bước thủ công giữa chừng — ĐĂNG KÝ CLIENT QLTS trong UI PMH ID:**
1. Mở `https://admin-de.pmh.com.vn:8443`, đăng nhập bằng SSA vừa tạo.
2. Vào **Ứng dụng SSO → tạo client** cho QLTS:
   - `redirect_uri` = `https://qlts.pmh.com.vn:8443/api/auth/callback` (đúng từng ký tự, có `:8443`).
   - Lưu lại `client_id` + `client_secret` (secret chỉ hiện 1 lần).
3. Nếu có webhook offboarding: đặt `PMH_WEBHOOK_SECRET` chung cho QLTS.

```bash
# --- Điền .env cho QLTS (dùng client_id/secret vừa lấy) ---
cp env-templates/qlts.env.example  /opt/pmh/QLTS_DE/.env
nano /opt/pmh/QLTS_DE/.env        # dán PMH_CLIENT_ID/SECRET + secret DB/Redis + hash SA

bash 40-qlts-up.sh           # lên QLTS (prod, không nạp override)
bash 90-verify.sh            # kiểm health admin-de + qlts qua cổng 8443
```

Cuối cùng **verify THẬT** từ trình duyệt (cả ngoài Internet lẫn trong LAN):
- `https://admin-de.pmh.com.vn:8443` → trang login + khóa xanh.
- `https://qlts.pmh.com.vn:8443` → bấm đăng nhập → nhảy sang admin-de → quay về QLTS (SSO chạy).

---

## 3. Bất biến OIDC — 3 nơi phải KHỚP `:8443` (lệch 1 là gãy login)

| Nơi | Giá trị đúng |
|---|---|
| `PMH_IDE/.env` → `OIDC_ISSUER` | `https://admin-de.pmh.com.vn:8443/oidc` |
| `QLTS_DE/.env` → `PMH_ISSUER_URL` | `https://admin-de.pmh.com.vn:8443/oidc` |
| `QLTS_DE/.env` → `APP_BASE_URL` | `https://qlts.pmh.com.vn:8443` |
| redirect_uri đăng ký ở PMH ID | `https://qlts.pmh.com.vn:8443/api/auth/callback` |

> Lưu ý: `.env.example` gốc của QLTS ghi `id.pmh.com.vn` và `APP_BASE_URL` thiếu `:8443` —
> đó là giá trị **dev cũ**. Template ở đây (`qlts.env.example`) đã sửa đúng cho cụm.

---

## 4. Rủi ro cần VERIFY (kênh back-channel QLTS → admin-de)

Khi login QLTS, `qlts-api` phải gọi ngược `https://admin-de.pmh.com.vn:8443/oidc` (đổi code→token, lấy JWKS).
`qlts-api` **không** nằm trên mạng `edge`, nên nó resolve `admin-de.pmh.com.vn` qua **DNS nội bộ → IP host →
hairpin về cổng 8443** của edge. Cách này chạy được **nếu** host prod dùng DNS nội bộ có zone admin-de.

**Nếu login QLTS treo/timeout hoặc báo lỗi token**, áp patch sau vào `QLTS_DE/docker-compose.yml`
(cho `api` **và** `worker` join thẳng mạng edge để resolve alias `admin-de.pmh.com.vn` về nginx — chắc ăn hơn),
rồi `git commit && git push`, và trên prod `bash 40-qlts-up.sh` lại:

```yaml
  api:
    # ...giữ nguyên phần trên...
    networks:          # THÊM khối này
      default: {}
      edge: {}
  worker:
    # ...giữ nguyên phần trên...
    networks:          # THÊM khối này
      default: {}
      edge: {}
```
(Mạng `edge` đã khai `external: true` ở cuối file QLTS — không cần khai thêm.)

---

## 5. Ghi chú vận hành

- **Prod luôn dùng `-f docker-compose.yml` (QLTS) / thêm `-f docker-compose.prod.yml` (admin-de)** — KHÔNG nạp
  `docker-compose.override.yml` (dev). Các script đã làm đúng.
- **Backup:** PMH ID có `backup-cron` chạy nền (mốc `BACKUP_AT`, mặc định 02:00). Kiểm `BACKUP_DIR`
  trỏ đĩa **khác** đĩa Docker. QLTS backup theo tài liệu QLTS.
- **Cập nhật code sau này:** `cd /opt/pmh/<repo> && git pull` rồi chạy lại script `up` tương ứng.
- Sao lưu **KEK_BASE64 + COOKIE_KEYS + BACKUP_PASSPHRASE** ra nơi an toàn tách khỏi host —
  mất KEK = mất mọi secret đã mã hóa (TOTP/webhook/SMTP).
