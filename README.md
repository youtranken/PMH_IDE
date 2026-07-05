# PMH ID — SSO/IdP nội bộ

Hệ quản lý user tập trung (OIDC/OAuth2) cho các project nội bộ PMH. Monorepo pnpm, modular monolith NestJS + React/AntD, Postgres 16, sau Nginx (TLS). Xem thiết kế trong `docs/` (PRD, Architecture Spine, backlog).

## Yêu cầu
- Docker + Docker Compose v2
- Node ≥ 22.12, pnpm ≥ 9 (chỉ cần khi build/dev ngoài Docker)
- openssl (sinh cert dev)

## Chạy lần đầu (dev)

```bash
cp .env.example .env        # sửa secret nếu cần (bắt buộc cho prod)
bash deploy/gen-certs.sh     # sinh cert TLS self-signed cho Nginx
pnpm dev                     # = docker compose up --build
```

Sau khi lên:

| Dịch vụ | URL |
|---|---|
| Portal (qua Nginx TLS) | https://localhost:9443 |
| Health API | https://localhost:9443/api/health |
| Mailpit (xem mail dev) | http://localhost:8026 |
| Postgres (dev) | localhost:5433 |

> Cert dev là self-signed → trình duyệt cảnh báo, bấm bỏ qua. HTTP :9080 tự chuyển sang HTTPS :9443.

## Thử đăng nhập SSO (Epic 1)

```bash
pnpm --filter @pmh/sso-server exec node scripts/seed-dev.js   # seed user dev (1 lần)
pnpm --filter @pmh/demo-app build
cd apps/demo-app && NODE_TLS_REJECT_UNAUTHORIZED=0 node dist/index.js
```

Mở http://localhost:4000 → "Đăng nhập qua PMH ID" → nhập `an.nguyen@pmh.com.vn` / `Passw0rd!` (chấp nhận cert self-signed nếu trình duyệt hỏi) → quay về demo-app hiển thị claims đã **verify offline** qua JWKS.

## Cổng host (né project khác đang chiếm 8080/8443)

Đặt trong `.env`: `HOST_HTTPS_PORT=9443`, `HOST_HTTP_PORT=9080`, `HOST_PG_PORT=5433`, `HOST_MAILPIT_UI_PORT=8026`, `HOST_MAILPIT_SMTP_PORT=1026`. Đổi ở `.env`, không sửa compose.

## Cấu trúc

```
apps/sso-server   NestJS — OIDC provider + API (modular monolith, AD-1)
apps/portal-fe    React + Vite + AntD — portal/launcher/admin
apps/demo-app     Node/Express — app demo tích hợp (Epic 1/8)
packages/shared   Hợp đồng JWT claims + hằng số dùng chung
deploy/           docker-compose, Nginx, script cert
docs/             PRD, architecture, backlog, integration
```

## Lệnh hay dùng

```bash
pnpm dev            # dựng cả bộ + build image (docker compose up --build) — chậm
pnpm dev:fast       # mount source + watch: sửa code reload vài giây, KHÔNG build image
pnpm down           # tắt
pnpm logs           # xem log
pnpm migrate:up     # chạy migration (tự chạy khi sso-server khởi động)
pnpm build          # build mọi package (ngoài Docker)
```

### Khi nào dùng gì
- **Sửa code `.ts`/`.tsx`** → `pnpm dev:fast` một lần, sau đó cứ sửa file là tự reload (backend ~9s, frontend HMR tức thì). Không cần chạy lại gì.
- **Đổi `package.json`** (thêm/bớt dependency) → `pnpm dev` (rebuild image) một lần, rồi quay lại `dev:fast`.
- Lần đầu clone máy mới → `pnpm dev` để có image, rồi `dev:fast` cho các phiên sau.

## Cấu hình 2 tầng (AD-15)
- **`.env`** — bí mật hạ tầng (DB creds, cookie keys, SMTP creds, đường dẫn khóa ký, KEK). KHÔNG commit.
- **Bảng `settings`** — tham số vận hành runtime (TTL, policy MK, path backup, SMTP host/port…), SSA chỉnh trong Settings. Seed mặc định ở migration base.
