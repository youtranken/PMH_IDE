# Build context = repo root (monorepo pnpm). Pin Node 22 LTS cho khớp
# oidc-provider v9 (^22.12) — AD-5 yêu cầu pin patch, siết thêm khi lên Epic 1.
FROM node:22-alpine

RUN corepack enable
WORKDIR /repo

# Cài deps theo workspace (cache tốt hơn khi tách manifest trước source)
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/sso-server/package.json apps/sso-server/
RUN pnpm install --filter @pmh/sso-server... --frozen-lockfile=false

# Source + build
COPY packages/shared packages/shared
COPY apps/sso-server apps/sso-server
RUN pnpm --filter @pmh/shared build && pnpm --filter @pmh/sso-server build

# Tài liệu tích hợp cho cổng docs (E8-S1) — bundle vào image cho prod.
COPY docs/integration apps/sso-server/docs-integration

WORKDIR /repo/apps/sso-server
EXPOSE 3000

# Chạy migrate rồi start (dev). Prod: tách bước migrate ra pipeline riêng.
CMD ["sh", "-c", "pnpm migrate:up && node dist/main.js"]
