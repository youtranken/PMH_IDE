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
  // Tách khóa: KEK còn dùng cho AES-GCM (TOTP/webhook). Dẫn một sub-key MAC
  // riêng (domain-separated) rồi mới MAC client_id → không dùng chung byte khóa
  // giữa hai primitive. Internal secret không lưu đâu nên đổi công thức vô hại.
  const macKey = createHmac("sha256", kek)
    .update("pmh:client-secret-mac-key:v1")
    .digest();
  return createHmac("sha256", macKey).update(clientId).digest("hex");
}
