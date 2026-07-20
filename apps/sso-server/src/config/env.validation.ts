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

  // SMTP_HOST/SMTP_PORT KHÔNG khai ở đây: host/port đọc từ bảng settings (SSA
  // chỉnh runtime qua FE — MailerService.resolve), không phải .env. Trước đây
  // bắt buộc ở .env nhưng KHÔNG code nào đọc → biến chết gây hiểu nhầm "host
  // nhập ở .env". Creds (SMTP_USER/PASSWORD) tùy chọn; SMTP_FROM bắt buộc.
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
  if (validated.NODE_ENV === "production") {
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
