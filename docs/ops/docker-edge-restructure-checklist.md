# PLAN CHỐT (Model B) — Một cổng EDGE giữ HTTPS, backend chạy HTTP nội bộ

> ✅ ĐÃ THỰC HIỆN 2026-07-16 (dev machine). Kết quả verify:
> - Edge `pmh-edge-nginx-1` độc quyền 80/443, cert wildcard. `id.` + `qlts.` chạy qua edge.
> - `/api/health`=200 (db:up); OIDC issuer=`https://id.pmh.com.vn/oidc` (đã bỏ :9443).
> - Front-channel: mở qlts.pmh.com.vn → đá sang PMH ID login ("để tiếp tục vào Quản lý Tài sản").
> - Back-channel: qlts-api fetch id.pmh.com.vn/oidc OK (host-gateway→edge, TLS trust OK).
> - Cô lập DB: qlts↔pmhid postgres chéo đều BLOCKED.
> - CÒN LẠI: 1 lần login thật của user để chốt cookie Secure round-trip (cần credential).
> - ⚠️ BÀI HỌC: PMH ID phải chạy compose kèm `--env-file .env` (biến POSTGRES_* ở repo root,
>   không nằm trong deploy/). Thiếu cờ này → DATABASE_URL rỗng → sso-server crash auth 28000.


> Đã kiểm thực tế bằng `docker ps` + đọc compose/nginx của cả 2 project.
> Model đã chốt: **B** — edge nginx MỚI giữ cert wildcard, terminate TLS cho TẤT CẢ;
> backend (kể cả QLTS) phục vụ HTTP thuần sau edge. QLHS để sau. NAT/DNS P.A làm sau.

## Mô hình (hình dung "compound một cổng")
```
Trình duyệt ── HTTPS (cert *.pmh.com.vn) ──▶ [EDGE nginx] ── HTTP nội bộ ──▶ backend
      (ngoài internet, LUÔN https, khóa xanh)   :80/:443         (trong máy, sau tường)
   id.pmh.com.vn   → sso-server:3000 (/oidc /api /docs) + portal-fe:5173 (còn lại)
   qlts.pmh.com.vn → qlts-web:80 (SPA + /api → api:3000)

- CHỈ edge giữ cert wildcard + làm TLS. 1 cert phủ mọi subdomain (wildcard).
- Trong máy đi HTTP thường vì nằm trên mạng docker riêng, không ra internet.
- DB/redis mỗi project ở mạng riêng, KHÔNG lên mạng edge.
```

## Điều then chốt cho người mới
- **PMH ID vốn ĐÃ "hình dạng B"**: `sso-server`/`portal-fe` xưa nay chạy HTTP thuần, chỉ có nginx PMH ID
  làm TLS. → Chỉ cần **dời cấu hình vhost sang edge**, KHÔNG sửa app PMH ID.
- **QLTS phải "phẳng hóa" một lần**: `qlts-web` đang tự làm TLS (giữ cert). Đổi nó thành **nginx HTTP thuần**
  (bỏ TLS, bỏ cert), việc HTTPS giao cho edge. Sửa 2 file nhỏ + build lại image `qlts-web`. Làm 1 lần.
- **Cạm bẫy cookie (BẮT BUỘC đúng):** `qlts-web/proxy-api-headers.conf` đang gửi `X-Forwarded-Proto $scheme`.
  Khi qlts-web chạy cổng 80, `$scheme=http` → api tưởng không HTTPS → cookie `Secure` gãy. → Phải sửa để
  qlts-web **chuyển tiếp giá trị edge gửi** (edge luôn báo `https`).

## Files sẽ đụng
| Repo | File | Thay đổi |
|---|---|---|
| CT | `deploy/edge/docker-compose.yml` (MỚI) | stack nginx edge, publish 80/443, mạng edge external + alias |
| CT | `deploy/edge/conf.d/id.conf` (MỚI) | bê từ `deploy/nginx/default.conf.template`, listen 443, +HSTS |
| CT | `deploy/edge/conf.d/qlts.conf` (MỚI) | server_name qlts → `proxy_pass http://qlts-web:80` + set `X-Forwarded-Proto https` |
| CT | `deploy/edge/certs/` (MỚI) | copy cert wildcard từ `deploy/nginx/certs/` |
| CT | `deploy/docker-compose.yml` | GỠ `nginx`; thêm `networks: edge(external)+pmhid-internal`; gán mạng; bỏ `extra_hosts` thừa |
| CT | `.env` | `OIDC_ISSUER=https://id.pmh.com.vn/oidc` (bỏ `:9443`) |
| QLTS | `web/nginx.conf` | Đổi block `listen 443 ssl` → **`listen 80` phục vụ thẳng** SPA + /api; bỏ redirect 80; bỏ ssl/cert; giữ security header (HSTS chuyển lên edge) |
| QLTS | `web/proxy-api-headers.conf` | `X-Forwarded-Proto` honor giá trị edge (không dùng `$scheme` cứng) |
| QLTS | `docker-compose.yml`/override | `web`: bỏ `ports:80/443`, bỏ mount cert `../pmh.com.vn`, join `edge` (alias `qlts-web`) |
| QLTS | `.env` | `PMH_ISSUER_URL=https://id.pmh.com.vn/oidc` (bỏ `:9443`) |

---

## CÁC BƯỚC (thứ tự — mỗi bước có verify)

### B0. An toàn
- [ ] CT: `git checkout -b infra/edge-split`. QLTS: commit/stash sạch trong repo QLTS.
- [ ] Backup DB PMH ID: `docker compose -f deploy/docker-compose.yml --profile backup run --rm backup`.
- [ ] Lưu `docker ps -a` + `docker network ls` để đối chiếu rollback.

### B1. Mạng chung
- [ ] `docker network create --subnet 172.20.0.0/16 --gateway 172.20.0.1 edge` → verify `docker network ls`.
      (PIN subnet cố định: webhook/BCL tới app sau edge resolve ra IP dải này; `WEBHOOK_ALLOWLIST_CIDR`
      phải chứa `172.20.0.0/16`. Nếu tạo mạng không kèm `--subnet`, Docker cấp subnet khác → allowlist vỡ.)

### B2. Tạo stack EDGE (viết file, chưa bật)
- [ ] `deploy/edge/docker-compose.yml`: `nginx:1.27-alpine`, `ports:[80:80,443:443]`, mount `./conf.d`+`./certs`,
      `networks: edge:{external:true}` alias `id.pmh.com.vn`,`qlts.pmh.com.vn`.
- [ ] Copy cert `deploy/nginx/certs/{fullchain,privkey}.pem` → `deploy/edge/certs/`.
- [ ] `conf.d/id.conf`: theo `default.conf.template` (redirect 80→443; 443 ssl; sanitize X-Forwarded-*;
      `/oidc/ /api/ =/docs`→sso-server; `/interaction/`+`/`→portal-fe; Host giữ `$http_host`; +HSTS).
- [ ] `conf.d/qlts.conf` (nội dung chốt):
      ```nginx
      server { listen 80; server_name qlts.pmh.com.vn; return 308 https://$host$request_uri; }
      server {
        listen 443 ssl; http2 on; server_name qlts.pmh.com.vn;
        ssl_certificate /etc/nginx/certs/fullchain.pem; ssl_certificate_key /etc/nginx/certs/privkey.pem;
        add_header Strict-Transport-Security 'max-age=31536000' always;
        resolver 127.0.0.11 valid=10s ipv6=off;
        client_max_body_size 21m;
        location / {
          proxy_pass http://qlts-web:80;
          proxy_set_header Host qlts.pmh.com.vn;
          proxy_set_header X-Real-IP $remote_addr;
          proxy_set_header X-Forwarded-For $remote_addr;
          proxy_set_header X-Forwarded-Proto https;   # ← mẩu ghi chú HTTPS
        }
      }
      ```
- [ ] Verify: `docker run --rm -v <conf.d>:/etc/nginx/conf.d -v <certs>:/etc/nginx/certs nginx nginx -t` PASS.

### B3. Phẳng hóa QLTS web (sửa + build, CHƯA đổi cổng)  (repo E:\PMH\Project_QLTS\qlts)
- [ ] `web/nginx.conf` → thay TOÀN BỘ 2 server block bằng MỘT block HTTP:
      ```nginx
      server {
        listen 80; server_name qlts.pmh.com.vn;
        add_header X-Frame-Options 'DENY' always;
        add_header X-Content-Type-Options 'nosniff' always;
        add_header Referrer-Policy 'strict-origin-when-cross-origin' always;
        add_header Permissions-Policy 'geolocation=(), camera=(), microphone=()' always;
        resolver 127.0.0.11 valid=10s ipv6=off;
        root /usr/share/nginx/html; index index.html;
        location / { try_files $uri $uri/ /index.html; }
        location = /api  { set $u http://api:3000; proxy_pass $u; include /etc/nginx/proxy-api-headers.conf; }
        location /api/   { set $u http://api:3000; proxy_pass $u; include /etc/nginx/proxy-api-headers.conf; client_max_body_size 21m; }
      }
      ```
      (Bỏ TLS/cert/HSTS/redirect — edge lo. Giữ 4 security header vì chúng không phụ thuộc TLS.)
- [ ] `web/proxy-api-headers.conf` → sửa dòng `X-Forwarded-Proto`:
      thêm ở ĐẦU file (ngoài server, hợp lệ vì file include trong http{}):
      `map $http_x_forwarded_proto $fwd_proto { default $http_x_forwarded_proto; '' $scheme; }`
      và đổi dòng 6 thành: `proxy_set_header X-Forwarded-Proto $fwd_proto;`
      (→ ưu tiên giá trị edge gửi `https`; nếu gọi thẳng thì fallback $scheme.)
- [ ] `web/Dockerfile`: `EXPOSE 80` (bỏ 443, không bắt buộc nhưng gọn).
- [ ] Build lại: `docker compose build web` (chưa up).

### B4. QLTS compose — nhả cổng + join edge  (repo QLTS)
- [ ] `web`: xóa `ports:['80:80','443:443']`; xóa mount `../pmh.com.vn:/etc/nginx/ssl:ro`;
      thêm `networks:[default, edge]` alias `qlts-web`; khai `networks: { edge:{external:true}, default:{} }`.
- [ ] `.env`: `PMH_ISSUER_URL=https://id.pmh.com.vn/oidc`.
- [ ] Áp: `docker compose -f docker-compose.yml -f docker-compose.override.yml up -d`
      → qlts-web thành HTTP thuần, KHÔNG giữ 80/443 nữa. **QLTS tạm không vào từ ngoài tới khi edge lên.**
- [ ] Verify: `docker ps` qlts-web không còn `0.0.0.0:443`; `docker network inspect edge` thấy `qlts-web`.

### B5. PMHID — gỡ nginx cũ + tách mạng  (repo CT)
- [ ] `deploy/docker-compose.yml`: xóa service `nginx`; bỏ `extra_hosts` sso-server;
      thêm `networks: edge:{external:true}` + `pmhid-internal:`; gán
      `sso-server→[edge,pmhid-internal]`, `portal-fe→[edge]`, `postgres/mailpit/backup→[pmhid-internal]`.
- [ ] `.env`: `OIDC_ISSUER=https://id.pmh.com.vn/oidc`.
- [ ] Áp: `docker compose -f deploy/docker-compose.yml [-f deploy/docker-compose.dev.yml] up -d --remove-orphans`
      → `pmh-id-nginx` biến mất (giải phóng 9080/9443).
- [ ] Verify: không còn `pmh-id-nginx`; `docker network inspect edge` thấy `sso-server`,`portal-fe`.

### B6. Bật EDGE (chiếm 80/443)
- [ ] `docker compose -f deploy/edge/docker-compose.yml up -d`.
- [ ] Verify: chỉ edge nginx publish `0.0.0.0:80,443`; không container nào khác giữ 80/443.

### B7. VERIFY THẬT (trình duyệt/playwright — không tin "up thành công")
- [ ] hosts Windows: `127.0.0.1 id.pmh.com.vn qlts.pmh.com.vn`.
- [ ] `https://id.pmh.com.vn/` (443, không port) → PMH ID, cert khóa xanh, login OK.
- [ ] `https://qlts.pmh.com.vn/` → app QLTS qua edge.
- [ ] **Đăng nhập QLTS end-to-end** → phải giữ được phiên (chứng minh cookie `Secure` không gãy = X-Forwarded-Proto đúng).
- [ ] **Cô lập DB**: `docker exec qlts-web-1 sh -c "nc -zv pmh-id-postgres-1 5432"` PHẢI fail;
      `docker exec pmh-id-sso-server-1 sh -c "nc -zv qlts-postgres-1 5432"` PHẢI fail.
- [ ] `docker ps --format "{{.Names}} {{.Ports}}"` → duy nhất edge có 80/443. Không container nào mount cert nữa (trừ edge).

### B8. Rollback nếu hỏng
- [ ] QLTS: `git checkout web/ docker-compose*.yml .env` → `docker compose build web && up -d` (QLTS về TLS riêng, 443).
- [ ] CT: `git checkout deploy/ .env` → `up -d` (nginx pmh-id cũ về 9080/9443).
- [ ] `docker network rm edge` sau khi hạ edge. Volume DB không đụng → dữ liệu nguyên.

---
## Rủi ro đã lường
- **QLTS gián đoạn** từ B4 đến khi B6 xong (vài phút) — đã đồng ý.
- **Đổi issuer PMH ID** `:9443`→`:443`: phiên/token PMH ID hiện tại mất hiệu lực (phải login lại — chấp nhận).
- **Cookie QLTS**: điểm rủi ro DUY NHẤT là `X-Forwarded-Proto`. Đã xử lý ở B3 + verify kỹ ở B7.
- **Cert self-signed?** qlts-api gọi `https://id.pmh.com.vn` (token-exchange) qua host-gateway:443 → edge.
  Hành vi tin-cert giống hôm nay (cùng cert) nên không phát sinh mới.
```
