import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { KekService } from "../common/kek.service";
import { generateRsaJwk, type RsaPrivateJwk } from "./jwk.util";

export type { RsaPrivateJwk };

/** Tiền tố đánh dấu file khóa ký đã mã hóa KEK (phân biệt plaintext legacy). */
const ENC_PREFIX = "enc:v1:";

/**
 * Khóa ký JWT (AD-8): mảng JWK trong file `jwks.json` tại SIGNING_KEYS_DIR
 * (volume mount — ngoài image/git, KHÔNG trong DB). Khóa ĐẦU mảng là khóa ký
 * hiện hành; các khóa sau giữ lại để verify (rotate publish-trước-ký-sau,
 * CLI rotate ở Epic 3).
 *
 * MÃ HÓA AT-REST (M1): file lưu dạng `enc:v1:<base64 KEK-blob>` — khóa PRIVATE
 * không nằm plaintext trên volume/backup nữa (ai đọc được đĩa mà không có KEK
 * thì không giả được token). File plaintext cũ được TỰ mã hóa tại chỗ khi nạp
 * (giữ nguyên kid → token đang sống vẫn verify được).
 *
 * Dev: thiếu file → tự sinh RSA-2048 (ghi đã mã hóa). Prod: thiếu file → fail-fast.
 */
@Injectable()
export class KeysService {
  private readonly logger = new Logger(KeysService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly kek: KekService,
  ) {}

  /** Đọc (hoặc dev-sinh) mảng JWK private cho provider.jwks.keys. */
  loadOrCreate(): RsaPrivateJwk[] {
    const dir = this.config.getOrThrow<string>("SIGNING_KEYS_DIR");
    const file = join(dir, "jwks.json");

    if (existsSync(file)) {
      const raw = readFileSync(file, "utf8").trim();
      let keys: RsaPrivateJwk[];
      if (raw.startsWith(ENC_PREFIX)) {
        const blob = Buffer.from(raw.slice(ENC_PREFIX.length), "base64");
        keys = JSON.parse(this.kek.decrypt(blob)) as RsaPrivateJwk[];
      } else {
        // Legacy plaintext → nạp rồi MÃ HÓA tại chỗ (không đổi khóa → token đang
        // sống vẫn verify được). Chỉ chạy một lần; lần sau file đã là enc:v1:.
        keys = JSON.parse(raw) as RsaPrivateJwk[];
        if (Array.isArray(keys) && keys.length > 0) {
          this.writeEncrypted(file, keys);
          this.logger.warn(
            `Khóa ký ${file} đang plaintext → đã mã hóa KEK tại chỗ (kid giữ nguyên)`,
          );
        }
      }
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
    this.writeEncrypted(file, [jwk]);
    return [jwk];
  }

  /** Ghi mảng JWK ra file dạng mã hóa KEK (`enc:v1:<base64>`), quyền 0600. */
  private writeEncrypted(file: string, keys: RsaPrivateJwk[]): void {
    const blob = this.kek.encrypt(JSON.stringify(keys));
    writeFileSync(file, ENC_PREFIX + blob.toString("base64"), { mode: 0o600 });
  }
}
