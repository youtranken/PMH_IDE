# Build context = repo root (monorepo pnpm).
# Đa tầng: `dev` = Vite dev server (stack dev, target mặc định = tầng cuối);
#          `prod` = build tĩnh + Nginx phục vụ (dùng cho triển khai thật).

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/portal-fe/package.json apps/portal-fe/
RUN pnpm install --filter @pmh/portal-fe... --frozen-lockfile=false

COPY packages/shared packages/shared
COPY apps/portal-fe apps/portal-fe
RUN pnpm --filter @pmh/shared build

# ---- Build tĩnh cho prod (tsc -b && vite build → dist) ----
FROM base AS build
RUN pnpm --filter @pmh/portal-fe build

# ---- PROD: Nginx phục vụ tĩnh, SPA fallback. Nghe 5173 (khớp upstream nginx chính). ----
FROM nginx:1.27-alpine AS prod
COPY apps/portal-fe/nginx-static.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/portal-fe/dist /usr/share/nginx/html
EXPOSE 5173

# ---- DEV: Vite dev server (target mặc định = tầng cuối, giữ stack dev không đổi) ----
FROM base AS dev
WORKDIR /repo/apps/portal-fe
EXPOSE 5173
CMD ["pnpm", "dev"]
