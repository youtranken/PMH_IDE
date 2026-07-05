import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { generateRsaJwk, type RsaPrivateJwk } from "./jwk.util";

export type { RsaPrivateJwk };

/**
 * Khóa ký JWT (AD-8): mảng JWK trong file `jwks.json` tại SIGNING_KEYS_DIR
 * (volume mount — ngoài image/git, KHÔNG trong DB). Khóa ĐẦU mảng là khóa ký
 * hiện hành; các khóa sau giữ lại để verify (rotate publish-trước-ký-sau,
 * CLI rotate ở Epic 3).
 *
 * Dev: thiếu file → tự sinh RSA-2048. Prod: thiếu file → fail-fast.
 */
@Injectable()
export class KeysService {
  private readonly logger = new Logger(KeysService.name);

  constructor(private readonly config: ConfigService) {}

  /** Đọc (hoặc dev-sinh) mảng JWK private cho provider.jwks.keys. */
  loadOrCreate(): RsaPrivateJwk[] {
    const dir = this.config.getOrThrow<string>("SIGNING_KEYS_DIR");
    const file = join(dir, "jwks.json");

    if (existsSync(file)) {
      const keys = JSON.parse(readFileSync(file, "utf8")) as RsaPrivateJwk[];
      if (!Array.isArray(keys) || keys.length === 0) {
        throw new Error(`[keys] ${file} rỗng/không hợp lệ`);
      }
      this.logger.log(
        `Nạp ${keys.length} khóa ký từ ${file} (kid ký: ${keys[0].kid})`,
      );
      return keys;
    }

    if (this.config.get("NODE_ENV") === "production") {
      // Prod không tự sinh khóa — phải provision qua quy trình rotate (AD-8)
      throw new Error(
        `[keys] Không thấy ${file}. Prod bắt buộc provision khóa ký trước khi chạy.`,
      );
    }

    this.logger.warn(`Chưa có khóa ký — sinh RSA-2048 dev tại ${file}`);
    const jwk = generateRsaJwk();
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, JSON.stringify([jwk], null, 2), { mode: 0o600 });
    return [jwk];
  }
}
