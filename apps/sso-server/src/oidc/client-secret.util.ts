import { createHmac } from "node:crypto";

/**
 * "Internal secret" của một DB client mà oidc-provider dùng để so khớp (Path A,
 * AD-11/AD-12). KHÔNG phải secret dev cầm — secret dev lưu HASH trong
 * client_secrets và ta tự validate; sau khi validate, middleware trình internal
 * secret này cho oidc-provider (nó chỉ so 1 secret plaintext). Dẫn xuất từ KEK
 * (đã bảo vệ ở .env, AD-15) → không lưu đâu cả, rò DB không lộ.
 *
 * NGUỒN DUY NHẤT — cả middleware /oidc/token lẫn adapter Client.find gọi hàm này
 * để giá trị luôn khớp.
 */
export function deriveProviderSecret(kek: Buffer, clientId: string): string {
  return createHmac("sha256", kek)
    .update(`client-provider-secret:${clientId}`)
    .digest("hex");
}
