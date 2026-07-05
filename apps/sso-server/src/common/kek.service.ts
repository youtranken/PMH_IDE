import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { deriveProviderSecret } from "../oidc/client-secret.util";

/**
 * Mã hóa bí mật ứng dụng (TOTP secret — AD-10, webhook secret — AD-14) bằng
 * KEK lấy từ `.env` (KEK_BASE64), TÁCH khỏi ciphertext trong DB (AD-15). Ai chỉ
 * đọc được DB thì không giải mã được; phải có cả KEK ở tầng .env.
 *
 * Định dạng ciphertext lưu bytea: [iv(12) | authTag(16) | ciphertext].
 * AES-256-GCM (có xác thực toàn vẹn).
 */
@Injectable()
export class KekService {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const b64 = config.getOrThrow<string>("KEK_BASE64");
    const key = Buffer.from(b64, "base64");
    if (key.length !== 32) {
      throw new Error(
        `[kek] KEK_BASE64 phải giải ra 32 byte (AES-256), hiện ${key.length} byte`,
      );
    }
    this.key = key;
  }

  encrypt(plain: string): Buffer {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]);
  }

  decrypt(blob: Buffer): string {
    const iv = blob.subarray(0, 12);
    const tag = blob.subarray(12, 28);
    const enc = blob.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString(
      "utf8",
    );
  }

  /** Internal secret của DB client cho oidc-provider (Path A, E5-S5). */
  deriveClientProviderSecret(clientId: string): string {
    return deriveProviderSecret(this.key, clientId);
  }
}
