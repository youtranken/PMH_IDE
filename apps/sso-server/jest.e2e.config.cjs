/**
 * Jest E2E authz (cụm A01) — BLACK-BOX qua HTTP, KHÔNG boot app (né ESM
 * oidc-provider). Chạy ở host, gọi edge (E2E_BASE_URL, mặc định
 * https://id.pmh.com.vn). Seed/teardown + ký token qua `docker exec` để bí mật
 * (DB creds, khóa ký) KHÔNG rời container. Cần stack dev đang chạy.
 *
 *   pnpm --filter @pmh/sso-server test:e2e
 *
 * Tách khỏi jest.config.cjs (unit thuần, *.spec.ts) bằng testMatch *.e2e-spec.ts.
 */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/test"],
  testMatch: ["**/*.e2e-spec.ts"],
  testTimeout: 60000,
  moduleNameMapper: {
    "^@pmh/shared$": "<rootDir>/../../packages/shared/src/index.ts",
  },
};
