# Build context = repo root. Dev: chạy Vite dev server, Nginx proxy `/` vào.
FROM node:22-alpine

RUN corepack enable
WORKDIR /repo

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/portal-fe/package.json apps/portal-fe/
RUN pnpm install --filter @pmh/portal-fe... --frozen-lockfile=false

COPY packages/shared packages/shared
COPY apps/portal-fe apps/portal-fe
RUN pnpm --filter @pmh/shared build

WORKDIR /repo/apps/portal-fe
EXPOSE 5173
CMD ["pnpm", "dev"]
