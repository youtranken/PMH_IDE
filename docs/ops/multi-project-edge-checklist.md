# Checklist — Đưa PMH ID + QLTS (+ project sau) ra internet qua 1 cổng nginx chung

> Mục tiêu: 1 máy Windows chạy Docker, **nhiều cụm project riêng**, **một nginx làm cổng vào duy nhất**.
> Người ngoài internet vào được qlts/pmhid; QLTS bắt buộc đăng nhập qua PMH ID (SSO).
> Ví dụ dùng: LAN `192.168.1.10`, IP public `172.19.0.76`, domain `*.pmh.com.vn` ở P.A.
> Liên quan: `deploy/nginx/default.conf.template`, `docs/ops/prod-checklist.md`.

## Mô hình chốt
- **1 cổng vào:** chỉ container `nginx` publish `80/443` ra host. Mọi web container khác chỉ `expose`.
- **3 cụm compose riêng:** `edge` (nginx) · `pmhid` (sso-server/portal-fe/postgres) · `qlts` (qlts-web/qlts-db).
- **1 mạng chung `edge` (external):** để nginx gọi được container project theo tên.
- **Mạng DB riêng mỗi project (`*-internal`):** nginx & project khác không chạm tới DB.
- **1 DNS wildcard + 1 cert wildcard** phủ mọi subdomain.

---

## A. DNS & Chứng chỉ (làm 1 lần)
- [ ] **Xác minh IP public THẬT.** `172.19.0.76` (dải 172.16–172.31) là IP *private* → nếu ISP cấp đúng con này, khả năng bị **CGNAT**, port-forward thường không ra internet được. Hỏi ISP cấp **public IP tĩnh** (vd `113.x`, `171.x`), hoặc dùng tunnel (Cloudflare Tunnel / frp / WireGuard).
- [ ] **Bản ghi DNS wildcard tại P.A:** `*.pmh.com.vn  A  <IP_PUBLIC>` — một dòng phủ id, qlts, project sau. (Thêm `pmh.com.vn A <IP_PUBLIC>` nếu cần tên trần.)
- [ ] **Cert wildcard `*.pmh.com.vn`** đặt ở nginx (`deploy/nginx/certs/fullchain.pem` + `privkey.pem`). 1 cert dùng chung mọi subdomain; không cần cert riêng từng project.

## B. NAT & Firewall (trên router + Windows)
- [ ] **Port-forward tại router:** `IP_PUBLIC:80 → 192.168.1.10:80` và `:443 → :443`.
- [ ] **Windows Firewall:** mở inbound `80`, `443`. KHÔNG mở cổng DB (5432) hay cổng app (3000/5173/8080) ra ngoài.
- [ ] **IP LAN tĩnh** cho máy `192.168.1.10` (DHCP reservation) để NAT không lệch khi reboot.

## C. Mạng Docker chung (làm 1 lần)
- [ ] Tạo mạng external: `docker network create edge`
- [ ] Quy ước: web container join `edge`; DB container chỉ join `*-internal`.

## D. Tách cụm EDGE (nginx) ra riêng
- [ ] Tạo `deploy/edge/docker-compose.yml`: chỉ service `nginx`, `ports: ["80:80","443:443"]`, `networks: [edge]` với `edge: { external: true }`.
- [ ] Chuyển `nginx` ra khỏi `deploy/docker-compose.yml` (cụm pmhid không còn publish 80/443 nữa).
- [ ] nginx mount cert wildcard + thư mục vhost (`conf.d/`), mỗi project 1 file `.conf`.

## E. Cụm PMHID
- [ ] `sso-server`, `portal-fe`: bỏ mọi `ports:`, chỉ `expose`. `networks: [edge, pmhid-internal]`.
- [ ] `postgres`: `networks: [pmhid-internal]` (bỏ `ports: 5490:5432` ở prod).
- [ ] vhost nginx `id.pmh.com.vn` → `sso-server` (BE `/oidc/ /api/ /docs`) + `portal-fe` (FE) — bê nguyên logic `default.conf.template` hiện có.

## F. Cụm QLTS
- [ ] `qlts-web`: chỉ `expose`, `networks: [edge, qlts-internal]`.
- [ ] `qlts-db`: `networks: [qlts-internal]` (nginx không thấy).
- [ ] vhost nginx `qlts.pmh.com.vn` → `upstream { server qlts-web:<port>; }`.
- [ ] Trong PMH ID Admin, client QLTS: **App URL** = `https://qlts.pmh.com.vn`, **redirect_uri** = `https://qlts.pmh.com.vn/<callback>`.

## G. Xử lý HAIRPIN cho token-exchange (bắt buộc kiểm)
> Backend QLTS gọi `https://id.pmh.com.vn/token` (server→server). Nếu phân giải ra IP public → vòng ra router rồi ngược vào (NAT loopback) → nhiều setup FAIL.
- [ ] Cho container QLTS gọi PMH ID **qua đường nội bộ**: `extra_hosts: ["id.pmh.com.vn:host-gateway"]` hoặc split-horizon DNS trỏ IP nội bộ.
- [ ] **Issuer vẫn giữ URL công khai** `https://id.pmh.com.vn` (chỉ đổi đường đi mạng, KHÔNG đổi issuer — lệch issuer là token bị từ chối).
- [ ] Nếu PMH ID gửi webhook/BCL → QLTS: đảm bảo IP nội bộ QLTS nằm trong `WEBHOOK_ALLOWLIST_CIDR` (xem `docs/integration/qlts-group-access-notes.md`).

## H. Kiểm thử thật (Verify — không tin "chạy rồi")
- [ ] **Từ máy NGOÀI (4G, tắt wifi):** mở `https://qlts.pmh.com.vn` → phải bị đá sang `id.pmh.com.vn` login → đăng nhập → quay lại QLTS vào được.
- [ ] **Gõ thẳng link QLTS khi chưa login** → vẫn bị bắt qua PMH ID (không lọt).
- [ ] **Bấm tile QLTS trong PMH ID khi đã login** → vào thẳng, không hỏi login lại (SSO liền mạch).
- [ ] **Cert:** trình duyệt báo khóa xanh hợp lệ cho cả `id` và `qlts` (cùng cert wildcard).
- [ ] **DB kín:** từ ngoài thử nối cổng 5432 → phải từ chối/timeout.
- [ ] **Reboot máy** → docker tự lên (`restart: unless-stopped`), NAT vẫn đúng (IP LAN tĩnh).

## I. Cạm bẫy hay gặp (đọc trước khi kêu "sao lỗi")
- **502 từ nginx** → nginx & project chưa cùng mạng `edge`, hoặc sai tên/cổng upstream.
- **Bấm tile timeout từ internet** → project chưa có DNS/route công khai (mới public mỗi PMH ID).
- **Login xong QLTS báo lỗi token/issuer** → hairpin (mục G) hoặc issuer bị đổi thành tên nội bộ.
- **Redirect loop ở QLTS** → `redirect_uri` khai ở Admin không khớp callback thật của QLTS.
- **"IP public" 172.19.x.x** → thực ra private/CGNAT, không NAT ra internet thật được (mục A).

---
### Thêm project mới sau này (rút gọn)
1. Dựng compose project mới: web `expose` + `networks:[edge, <app>-internal]`, DB ở `<app>-internal`.
2. Thêm file vhost nginx `<app>.pmh.com.vn` → `<app>-web:<port>`, reload nginx.
3. Tạo client trong PMH ID Admin (App URL + redirect_uri = `https://<app>.pmh.com.vn/...`).
4. DNS wildcard đã phủ sẵn — **không phải thêm DNS**. Cert wildcard đã phủ sẵn — **không phải thêm cert**.
