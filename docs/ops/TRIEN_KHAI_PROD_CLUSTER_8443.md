# Kế hoạch triển khai PRODUCTION — Cụm PMH (qlts / ide / qlhs) qua 1 IP, cổng 8443

> **Trạng thái:** BẢN KẾ HOẠCH — chưa thực thi. Dùng để rà soát trước khi làm.
> **Ngày lập:** 2026-07-31
> **Phạm vi:** hạ tầng cổng-vào dùng chung (edge) cho 3 app + phần cấu hình riêng của QLTS.
> IDE (`ide.pmh.com.vn`) và QLHS (`qlhs.pmh.com.vn`) do dự án tương ứng cấu hình, tài liệu này chỉ nêu phần liên quan cổng-vào chung.

---

## 1. Bối cảnh & ràng buộc

- **1 IP public** duy nhất.
- **Cổng 443 đã bị dự án khác chiếm** (NAT về host `172.16.6.22`) → cụm này **không dùng được 443**.
- Docker host chạy cả cụm: **Ubuntu `172.16.150.23`**.
- Firewall: **Sophos** (dùng NAT "Translation settings": DNAT + PAT).
- **Mục tiêu:** cả **ngoài Internet** lẫn **trong LAN** đều vào được `qlts / ide / qlhs.pmh.com.vn`, và **SSO (OIDC) chạy đúng cho cả hai phía**.

## 2. Nguyên tắc bất biến (sai là hỏng)

1. **Cổng 8443 giữ nguyên xuyên suốt** — firewall **DNAT 8443 → 8443**, **KHÔNG** dịch (PAT) về 443. Edge nginx nghe **8443**.
2. **Một URL chuẩn duy nhất cho mỗi app**, dùng chung cho trong lẫn ngoài:
   `https://qlts.pmh.com.vn:8443`, `https://ide.pmh.com.vn:8443`, `https://qlhs.pmh.com.vn:8443`.
3. **Chỉ mở đúng 1 cổng ra ngoài (edge:8443).** postgres / redis / api / worker **không bao giờ NAT**, chỉ nói chuyện nội bộ qua edge.
4. Mọi **URL tuyệt đối phải mang `:8443`** (xem §9) — `APP_BASE_URL`, `redirect_uri`, `iss`.

## 3. Kiến trúc (split-horizon DNS)

```
                     ┌────────── NGOÀI INTERNET ──────────┐
  User ngoài  ──►  DNS công cộng (PA): qlts/ide/qlhs → IP_public
              ──►  Sophos  #Port2:8443  ──DNAT (giữ 8443)──►  172.16.150.23:8443
                                                                      │
   ┌──────────── TRONG LAN ────────────┐                              ▼
  User nội bộ ──►  DNS nội bộ (AD): qlts/ide/qlhs → 172.16.150.23  ──trực tiếp──► :8443
                                                                      │
                                                          ┌───────────┴───────────┐
                                                          │   EDGE nginx  :8443    │
                                                          │  cert *.pmh.com.vn     │
                                                          │  route theo Host:      │
                                                          │   qlts → qlts-web:80   │
                                                          │   ide  → ide-web:80    │
                                                          │   qlhs → qlhs-web:80   │
                                                          └────────────────────────┘
```

- **Ngoài**: qua firewall (DNAT giữ cổng).
- **Trong**: DNS nội bộ trả **IP nội bộ** → đi **thẳng** tới server, **không qua NAT, không cần hairpin**.
- Cả hai gõ **cùng** `:8443` → cùng URL chuẩn → SSO đúng cho cả hai phía.

---

## 4. Các bước theo thứ tự

> Thứ tự phụ thuộc: **DNS → NAT/cert → EDGE → từng app**. Làm sai thứ tự sẽ báo lỗi khó hiểu ở bước kiểm thử.

### Bước A — DNS công cộng (trên PA)
Thêm 3 bản ghi **A**, cùng trỏ **IP public**:
```
qlts.pmh.com.vn   A   <IP_public>
ide.pmh.com.vn    A   <IP_public>
qlhs.pmh.com.vn   A   <IP_public>
```
> DNS chỉ map **tên → IP**, KHÔNG chứa port. Port `:8443` nằm trong URL.
> Kiểm: từ mạng ngoài, `ping qlts.pmh.com.vn` ra đúng IP public.

### Bước B — DNS nội bộ (AD / directory domain)
Trỏ 3 tên về **`172.16.150.23`**:
```
qlts.pmh.com.vn   A   172.16.150.23
ide.pmh.com.vn    A   172.16.150.23
qlhs.pmh.com.vn   A   172.16.150.23
```
> ⚠️ **Tránh "cướp" cả `pmh.com.vn` nội bộ:** ĐỪNG tạo nguyên zone `pmh.com.vn` trong AD (sẽ biến AD thành authoritative cho **mọi** `*.pmh.com.vn` → có thể chết mail và dịch vụ khác).
> **Thay vào đó tạo 3 zone riêng**, mỗi zone đặt tên đúng bằng FQDN, thêm 1 record **A tại gốc (@)**:
> - Forward Lookup Zone `qlts.pmh.com.vn` → A `@` → `172.16.150.23`
> - Forward Lookup Zone `ide.pmh.com.vn`  → A `@` → `172.16.150.23`
> - Forward Lookup Zone `qlhs.pmh.com.vn` → A `@` → `172.16.150.23`
>
> Cách này chỉ ghi đè đúng 3 tên đó; các `*.pmh.com.vn` khác vẫn ra Internet bình thường.

### Bước C — Firewall NAT (Sophos "Translation settings")
Tạo **1 luật DNAT** cho cả 3 app (phân biệt bằng hostname, nên chỉ cần 1 luật):

| Ô trong form | Giá trị |
|---|---|
| Original source | **Any** |
| Original destination | **#Port2** (interface / IP public) |
| Original service | **TCP 8443** *(tạo custom service, vd "PMH-8443")* |
| Translated source (SNAT) | **None / Original** *(để server thấy IP thật; chỉ chọn MASQ nếu routing bất đối xứng)* |
| Translated destination (DNAT) | **172.16.150.23** |
| **Translated service (PAT)** | **8443** ⟵ **GIỮ NGUYÊN, KHÔNG chọn HTTPS/443** |

> Đây là điểm khác với luật cũ (`8030 → HTTPS/443`). Với cụm này **giữ 8443 → 8443**.

### Bước D — Firewall Policy (cho phép LAN đi thẳng vào server)
Vì user nội bộ vào **thẳng** `172.16.150.23`, thêm rule cho phép:
```
LAN zone  →  Host 172.16.150.23  →  TCP/8443  :  Allow
```
> Nếu client LAN **cùng subnet** với server thì không cần; **khác VLAN** thì bắt buộc.

### Bước E — Chứng chỉ SSL
- Cert **`*.pmh.com.vn`** (`fullchain.pem` + `private.key`), phủ cả 3 tên. Kiểm còn hạn.
- Đặt ở host, mount **read-only** vào container edge tại `/etc/nginx/ssl/`.

### Bước F — EDGE nginx (cổng-vào dùng chung)
1. Tạo mạng dùng chung (chạy 1 lần):
   ```bash
   docker network create edge
   ```
2. Config edge — file `edge/nginx/conf.d/pmh-edge.conf` (bản mẫu, chưa áp):

```nginx
# EDGE reverse proxy cụm PMH — nghe 8443, TLS terminate tại đây, route theo Host.
# App phía sau chạy HTTP thuần, join mạng docker "edge" với alias tương ứng.

# Hỗ trợ WebSocket/SSE nếu app cần (vô hại nếu không dùng)
map $http_upgrade $conn_upgrade { default upgrade; '' close; }

# ---- QLTS ----
server {
    listen 8443 ssl;
    listen [::]:8443 ssl;
    http2 on;
    server_name qlts.pmh.com.vn;

    ssl_certificate     /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;

    # HSTS (khuyến nghị M-9) — bật khi HTTPS đã chạy ổn định
    add_header Strict-Transport-Security "max-age=31536000" always;

    client_max_body_size 25m;   # cho upload ảnh biên bản

    location / {
        proxy_pass http://qlts-web:80;
        proxy_set_header Host              $http_host;   # GIỮ :8443 — KHÔNG dùng $host
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-Host  $http_host;
        proxy_http_version 1.1;
        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection $conn_upgrade;
        proxy_read_timeout 120s;
    }
}

# ---- IDE ---- (target tuỳ cách IDE expose service)
server {
    listen 8443 ssl;
    http2 on;
    server_name ide.pmh.com.vn;
    ssl_certificate     /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    location / {
        proxy_pass http://ide-web:80;
        proxy_set_header Host              $http_host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_http_version 1.1;
    }
}

# ---- QLHS ----
server {
    listen 8443 ssl;
    http2 on;
    server_name qlhs.pmh.com.vn;
    ssl_certificate     /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    location / {
        proxy_pass http://qlhs-web:80;
        proxy_set_header Host              $http_host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_http_version 1.1;
    }
}

# ---- SNI/Host lạ → đóng, không lộ app mặc định ----
server {
    listen 8443 ssl default_server;
    server_name _;
    ssl_certificate     /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/private.key;
    return 444;
}
```

3. `docker-compose.yml` cho edge (bản mẫu):
```yaml
services:
  edge:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "8443:8443"        # cổng duy nhất phơi ra host
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - /etc/pmh/ssl:/etc/nginx/ssl:ro   # nơi đặt fullchain.pem + private.key
    networks:
      - edge
networks:
  edge:
    external: true
```
> **Quan trọng:** `web` của mỗi app phải join mạng `edge` với alias `qlts-web` / `ide-web` / `qlhs-web`
> (QLTS đã cấu hình sẵn alias `qlts-web` trong `qlts/docker-compose.yml`).

### Bước G — `.env` prod của QLTS
Trên host, file `qlts/.env` (KHÔNG commit). Các khoá **bắt buộc đúng cho prod**:
```dotenv
NODE_ENV=production
AUTH_DEV_MODE=false

# URL chuẩn — PHẢI kèm :8443
APP_BASE_URL=https://qlts.pmh.com.vn:8443

# SSO — issuer của IDE, PHẢI kèm :8443, khớp đúng iss mà IDE quảng bá
PMH_ISSUER_URL=https://ide.pmh.com.vn:8443/oidc
PMH_CLIENT_ID=<client_id prod do IDE cấp>
PMH_CLIENT_SECRET=<secret prod — KHÁC dev>
PMH_WEBHOOK_SECRET=<rotate mới cho prod>

# DB / Redis — mật khẩu mạnh (chỉ [A-Za-z0-9-_], tránh @ : # % làm hỏng URL)
POSTGRES_USER=qlts
POSTGRES_PASSWORD=<mật khẩu mạnh, KHÁC dev>
POSTGRES_DB=qlts
REDIS_PASSWORD=<mật khẩu mạnh>

# SA break-glass — sinh hash: cd api && npm run sa:hash -- '<mật-khẩu-mạnh>'
LOCAL_SA_USERNAME=sa
LOCAL_SA_PASSWORD_HASH=<scrypt.saltHex.hashHex>

# Khoá mã hoá secret SMTP — đặt Ở CẢ api LẪN worker, KHÔNG đổi sau khi lưu mật khẩu mail
MAIL_ENC_KEY=<chuỗi ngẫu nhiên đủ dài>

# SMTP (nếu bật email digest) — điền qua UI Cấu hình › Email hoặc env
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=

# GEMINI_API_KEY: KHÔNG cần nữa (chatbot đã bỏ Gemini, chuyển router luật)
```

### Bước H — Đăng ký OIDC client ở IDE (bên `ide.pmh.com.vn`)
- Tạo/cập nhật client cho QLTS, khai **redirect_uri** đúng từng ký tự:
  `https://qlts.pmh.com.vn:8443/api/auth/callback`
- Lấy `client_id` + `client_secret` → điền vào `.env` (Bước G).
- Đảm bảo **IDE tự quảng bá `iss = https://ide.pmh.com.vn:8443/oidc`** trong discovery
  (tức `APP_BASE_URL`/issuer của IDE cũng phải kèm `:8443`).

### Bước I — Deploy QLTS (lệnh prod)
```bash
cd qlts
docker compose -f docker-compose.yml up -d --build
```
> **Bắt buộc có `-f docker-compose.yml`** để KHÔNG nạp `docker-compose.override.yml` (dev —
> file đó phơi Postgres/Redis ra host và ghi đè DNS). Áp dụng tương tự khi dựng edge.

### Bước J — Kiểm thử THẬT (bắt buộc, cả 2 phía)
Từ **ngoài Internet**:
1. `https://qlts.pmh.com.vn:8443` → thấy trang login + khoá xanh (cert hợp lệ).
2. `https://qlts.pmh.com.vn:8443/api/health` → trả OK.
3. Bấm đăng nhập → nhảy sang IDE → quay về đúng app (SSO chạy).

Từ **trong LAN** (máy nội bộ): lặp lại 1–3, xác nhận vào **cùng URL `:8443`** và cũng đăng nhập được.
Lặp cho `ide` và `qlhs`. Nếu bật SMTP: gửi 1 mail thử, kiểm link trong mail có `:8443`.

---

## 5. Bất biến OIDC — 3 nơi phải KHỚP `:8443`

| Nơi | Giá trị |
|---|---|
| `qlts/.env` → `APP_BASE_URL` | `https://qlts.pmh.com.vn:8443` |
| redirect_uri đăng ký ở IDE | `https://qlts.pmh.com.vn:8443/api/auth/callback` |
| IDE quảng bá `iss` + `qlts/.env` `PMH_ISSUER_URL` | `https://ide.pmh.com.vn:8443/oidc` |

Lệch 1 trong 3 (thiếu port, sai host, thừa/thiếu `/`) → đăng nhập lỗi `redirect_uri mismatch` hoặc `iss` không hợp lệ.

## 6. Cạm bẫy đã biết

- **PAT về 443:** nếu firewall dịch 8443→443, edge phải nghe 443, khi đó user nội bộ (DNS→IP nội bộ) sẽ vào `:443` = URL không port, còn ngoài là `:8443` → **2 URL → SSO vỡ**. → Giữ **8443→8443**.
- **`$host` vs `$http_host`:** nginx dùng `$host` sẽ **rớt `:8443`** khi sinh redirect → nhảy về 443 (không NAT) → gãy. Luôn dùng `$http_host`.
- **Hairpin:** vì DNS nội bộ trỏ IP nội bộ, user nội bộ **không** đi qua NAT nên **không cần hairpin**. Chỉ cần hairpin nếu (vì lý do nào đó) DNS nội bộ trỏ về IP public.
- **AD zone `pmh.com.vn`:** đừng tạo cả zone — tạo 3 zone FQDN riêng (Bước B).
- **Override compose:** luôn `-f docker-compose.yml` ở prod.
- **Secret dev/prod:** rotate `PMH_CLIENT_SECRET`, `PMH_WEBHOOK_SECRET`; đổi mật khẩu Postgres/Redis khác dev (finding M-3 trong audit 2026-07-19).

## 7. Checklist

- [ ] PA: 3 A record → IP public
- [ ] AD: 3 zone FQDN → 172.16.150.23
- [ ] Sophos: DNAT #Port2:8443 → 172.16.150.23:8443 (PAT giữ 8443, **không** 443)
- [ ] Sophos: policy LAN → 172.16.150.23:8443 Allow
- [ ] Cert `*.pmh.com.vn` đặt ở host, còn hạn
- [ ] `docker network create edge`
- [ ] Dựng edge nginx (:8443, 3 server_name, `$http_host`)
- [ ] `qlts/.env` prod (APP_BASE_URL/PMH_ISSUER_URL kèm :8443, secret rotate)
- [ ] IDE: đăng ký client QLTS + redirect_uri :8443; iss :8443
- [ ] Deploy QLTS `-f docker-compose.yml`
- [ ] Verify NGOÀI Internet (login SSO OK, /api/health OK)
- [ ] Verify TRONG LAN (cùng URL :8443, login OK)
- [ ] (nếu bật) mail thử: link có :8443

## 8. Việc còn nợ (không chặn go-live, nên làm tuần đầu)
- Vá **FL-4** (listBoard nhân N dòng chuỗi định kỳ — lỗi hiện trên trang chính) + các finding deep-scan 2026-07-29.
- HSTS (M-9) + CSP (M-10) ở edge; `npm audit fix` multer.
- Backup định kỳ `pgdata` + `filesdata` (và **test restore**).
- Giám sát: alert khi container down / mail vào DLQ / worker lỗi.
