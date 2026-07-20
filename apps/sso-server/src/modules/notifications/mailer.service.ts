import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash } from "node:crypto";
import { createTransport, type Transporter } from "nodemailer";
import { KekService } from "../../common/kek.service";
import { SettingsService } from "../../config/settings.service";

/**
 * Gửi 1 email qua SMTP (AD-13/AD-15). TẤT CẢ cấu hình đọc từ bảng `settings`
 * (SSA chỉnh runtime qua FE — E6-S5): host, port, user, from, và password (mã
 * hóa KEK). Fallback về .env (SMTP_USER/PASSWORD/FROM) nếu setting rỗng — giữ
 * tương thích với triển khai cũ. Dev trỏ Mailpit (không auth).
 *
 * Transporter cache theo cấu hình — dựng lại khi SSA đổi, không dựng mới mỗi
 * lần gửi (nodemailer khuyến nghị tái dùng transport).
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private transporter?: Transporter;
  private cacheKey = "";
  private static readonly ENC_PREFIX = "enc:v1:";

  constructor(
    private readonly config: ConfigService,
    private readonly settings: SettingsService,
    private readonly kek: KekService,
  ) {}

  /** Mật khẩu SMTP: ưu tiên settings (giải mã KEK), fallback .env. */
  private async smtpPassword(): Promise<string> {
    const stored = (await this.settings.get("smtp_password", "")) ?? "";
    if (stored.startsWith(MailerService.ENC_PREFIX)) {
      try {
        return this.kek.decrypt(
          Buffer.from(stored.slice(MailerService.ENC_PREFIX.length), "base64"),
        );
      } catch (e) {
        this.logger.error(`giải mã smtp_password lỗi: ${String(e)}`);
        return "";
      }
    }
    return this.config.get<string>("SMTP_PASSWORD") ?? "";
  }

  private async resolve(): Promise<Transporter> {
    const host = (await this.settings.get("smtp_host", "mailpit")) ?? "mailpit";
    const port = await this.settings.getInt("smtp_port", 1025);
    const user =
      (await this.settings.get("smtp_user", "")) ||
      this.config.get<string>("SMTP_USER") ||
      "";
    const pass = await this.smtpPassword();
    // Cache key gồm HASH của pass (không để pass thô trong biến cacheKey) → đổi
    // mật khẩu ở FE là transport dựng lại.
    const passTag = pass ? createHash("sha256").update(pass).digest("hex").slice(0, 8) : "-";
    const key = `${host}:${port}:${user}:${passTag}`;
    if (this.transporter && this.cacheKey === key) return this.transporter;

    this.transporter = createTransport({
      host,
      port,
      // 465 = SMTPS ngầm; 587/1025 = STARTTLS/none. Mailpit dev không cần auth.
      secure: port === 465,
      auth: user ? { user, pass } : undefined,
      // SMTP chết KHÔNG được treo worker (mặc định nodemailer ~2') — cắt sau 10s
      // để job vào retry-backoff, cả lô không đứng vì 1 đích lỗi.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 10_000,
    });
    this.cacheKey = key;
    this.logger.log(`SMTP transport: ${host}:${port}${user ? " (auth)" : ""}`);
    return this.transporter;
  }

  /** Gửi email. Ném lỗi nếu SMTP từ chối — nơi gọi (worker) quyết định retry. */
  async send(to: string, subject: string, html: string): Promise<void> {
    const from =
      (await this.settings.get("smtp_from", "")) ||
      this.config.get<string>("SMTP_FROM") ||
      "no-reply@pmh.com.vn";
    const transporter = await this.resolve();
    await transporter.sendMail({ from, to, subject, html });
  }
}
