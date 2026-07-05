import { randomBytes } from "node:crypto";
import { deriveProviderSecret } from "../src/oidc/client-secret.util";

describe("deriveProviderSecret (Path A internal secret)", () => {
  const kek = randomBytes(32);

  it("xác định (deterministic) theo (kek, clientId)", () => {
    expect(deriveProviderSecret(kek, "app-1")).toBe(deriveProviderSecret(kek, "app-1"));
  });

  it("khác client_id → khác secret", () => {
    expect(deriveProviderSecret(kek, "app-1")).not.toBe(deriveProviderSecret(kek, "app-2"));
  });

  it("khác KEK → khác secret (rò DB không lộ)", () => {
    expect(deriveProviderSecret(kek, "app-1")).not.toBe(
      deriveProviderSecret(randomBytes(32), "app-1"),
    );
  });

  it("trả hex 64 ký tự (HMAC-SHA256)", () => {
    expect(deriveProviderSecret(kek, "app-1")).toMatch(/^[0-9a-f]{64}$/);
  });
});
