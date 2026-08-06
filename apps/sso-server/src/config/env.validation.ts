import { plainToInstance } from "class-transformer";
import { IsIn, IsNotEmpty, IsString, validateSync } from "class-validator";

/**
 * Tầng BÍ MẬT hạ tầng (.env, AD-15). Khởi động FAIL-FAST nếu thiếu biến
 * bắt buộc — không cho app chạy với secret rỗng. Tham số vận hành runtime
 * KHÔNG ở đây (nằm ở bảng `settings`).
 */
export class EnvVars {
  @IsIn(["development", "production", "test"])
  NODE_ENV!: string;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  OIDC_ISSUER!: string;

  @IsString()
  @IsNotEmpty()
  COOKIE_KEYS!: string;

  @IsString()
  @IsNotEmpty()
  SIGNING_KEYS_DIR!: string;

  @IsString()
  @IsNotEmpty()
  KEK_BASE64!: string;

  // SMTP_HOST/PORT/USER/PASSWORD tùy chọn (KHÔNG bắt buộc ở đây): ưu tiên bảng
  // settings (SSA chỉnh runtime qua FE), FALLBACK về .env nếu setting rỗng
  // (MailerService.resolve). SMTP_FROM bắt buộc để email có địa chỉ gửi hợp lệ.
  @IsString()
  @IsNotEmpty()
  SMTP_FROM!: string;
}

/**
 * Giá trị secret MẪU trong .env.example — TUYỆT ĐỐI không được lọt lên prod.
 * Ops copy .env.example→.env rồi quên đổi là kịch bản thường gặp; lộ KEK =
 * giải mã được TOTP secret → vượt MFA của SSA (AD-10/AD-15).
 */
const SAMPLE_SECRETS: Record<string, string> = {
  COOKIE_KEYS: "dev_cookie_key_change_me_0123456789abcdef",
  KEK_BASE64: "ZGV2X2tla19jaGFuZ2VfbWVfMDEyMzQ1Njc4OWFiY2Q=",
  // Không phải biến app dùng, nhưng ở CHUNG .env → gate luôn để backup prod
  // không mã hóa bằng passphrase mẫu (rò .env = mở mọi bản backup).
  BACKUP_PASSPHRASE: "dev_backup_passphrase_change_me",
};

/**
 * "Tư thế production" cho các quyết định bảo mật — dùng CHUNG để không nơi nào
 * còn gate riêng bằng NODE_ENV (biến ops copy, dễ sai). true nếu NODE_ENV là
 * production HOẶC issuer chạy https (hạ tầng thật có TLS = đang phục vụ prod).
 */
export function isProdPosture(nodeEnv: unknown, oidcIssuer: string): boolean {
  if (nodeEnv === "production") return true;
  if (!oidcIssuer.startsWith("https://")) return false;
  // https = prod TRỪ khi issuer là loopback: dev có thể chạy https://localhost để
  // test cookie Secure mà KHÔNG bị coi là prod (nếu không, `.env.example` dev sẽ bị
  // các chốt fail-fast từ chối khởi động). Cookie Secure dùng issuerIsHttps trực
  // tiếp nên vẫn bật đúng ở dev https.
  try {
    const h = new URL(oidcIssuer).hostname;
    return h !== "localhost" && h !== "127.0.0.1" && h !== "::1";
  } catch {
    return true; // https nhưng URL không parse được → coi như prod (an toàn)
  }
}

export function validateEnv(config: Record<string, unknown>): EnvVars {
  const validated = plainToInstance(EnvVars, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, {
    skipMissingProperties: false,
    whitelist: false,
  });
  if (errors.length > 0) {
    const missing = errors
      .map((e) => e.property)
      .join(", ");
    throw new Error(
      `[config] Thiếu/không hợp lệ biến .env bắt buộc: ${missing}. ` +
        `Xem .env.example (AD-15).`,
    );
  }

  // FAIL-FAST ở prod nếu còn dùng secret mẫu (guard footgun copy .env.example).
  // Kiểm trên raw config để bắt cả biến không khai trong EnvVars (BACKUP_PASSPHRASE).
  // "Tư thế prod" = NODE_ENV production HOẶC issuer https — KHÔNG tin mỗi NODE_ENV
  // (biến do ops copy, đặt sai `development` vẫn lọt @IsIn rồi âm thầm bỏ chốt này);
  // issuer https là tín hiệu hạ tầng thật (cùng cách suy như cookie Secure).
  if (isProdPosture(validated.NODE_ENV, String(config.OIDC_ISSUER ?? ""))) {
    const offenders = Object.entries(SAMPLE_SECRETS)
      .filter(([key, sample]) => config[key] === sample)
      .map(([key]) => key);
    if (offenders.length > 0) {
      throw new Error(
        `[config] TỪ CHỐI KHỞI ĐỘNG PROD: các secret sau còn là giá trị mẫu .env.example: ` +
          `${offenders.join(", ")}. Sinh giá trị thật trước khi chạy production (AD-15).`,
      );
    }
  }

  return validated;
}
