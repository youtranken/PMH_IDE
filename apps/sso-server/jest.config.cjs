/** Jest cho unit test logic bảo mật thuần (không DB): egress, client-secret, CSV. */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/test"],
  testMatch: ["**/*.spec.ts"],
  moduleNameMapper: {
    "^@pmh/shared$": "<rootDir>/../../packages/shared/src/index.ts",
  },
};
