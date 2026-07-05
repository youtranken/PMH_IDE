import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createTransport, type Transporter } from "nodemailer";
import { SettingsService } from "../../config/settings.service";

/**
 * Gửi 1 email qua SMTP (AD-13/AD-15). Host+port đọc từ bảng `settings` (SSA
 * chỉnh runtime — E6-S5); from + creds đọc từ .env (bí mật hạ tầng). Dev trỏ
 * Mailpit (không auth); prod trỏ Gmail SMTP (SMTP_USER/PASSWORD ở .env).
 *
 * Transporter cache theo "host:port" — dựng lại khi SSA đổi cấu hình, không
 * dựng mới mỗi lần gửi (nodemailer khuyến nghị tái dùng transport).
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private transporter?: Transporter;
  private cacheKey = "";

  constructor(
    private readonly config: ConfigService,
    private readonly settings: SettingsService,
  ) {}

  private async resolve(): Promise<Transporter> {
    const host = (await this.settings.get("smtp_host", "mailpit")) ?? "mailpit";
    const port = await this.settings.getInt("smtp_port", 1025);
    const user = this.config.get<string>("SMTP_USER") ?? "";
    const pass = this.config.get<string>("SMTP_PASSWORD") ?? "";
    const key = `${host}:${port}:${user}`;
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
      this.config.get<string>("SMTP_FROM") ?? "no-reply@pmh.com.vn";
    const transporter = await this.resolve();
    await transporter.sendMail({ from, to, subject, html });
  }
}
