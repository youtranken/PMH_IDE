import { Inject, Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { Pool } from "pg";
import { PG_POOL } from "../../database/database.module";
import { MailerService } from "./mailer.service";

interface EmailJob {
  id: string;
  to_addr: string;
  subject: string;
  body_html: string;
  attempts: number;
}

/**
 * Worker gửi email nền (AD-13). Mỗi nhịp claim một lô job bằng
 * `FOR UPDATE SKIP LOCKED` (nhiều worker/instance không giành nhau), gửi tuần
 * tự (dịu SMTP), lỗi thì retry GIÃN DẦN tới hạn rồi bỏ. Throttle = cỡ lô ×
 * nhịp: BATCH email mỗi POLL_MS → an toàn dưới giới hạn Gmail SMTP.
 */
@Injectable()
export class EmailWorker {
  private readonly logger = new Logger(EmailWorker.name);
  private running = false;

  /** Cỡ lô mỗi nhịp — throttle: BATCH×(60000/POLL_MS) email/phút tối đa. */
  private static readonly BATCH = 10;
  private static readonly POLL_MS = 15_000;
  private static readonly MAX_ATTEMPTS = 5;
  /** Job kẹt 'sending' (worker chết giữa chừng) quá ngưỡng này → claim lại. */
  private static readonly STALE = "5 minutes";

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly mailer: MailerService,
  ) {}

  @Interval(EmailWorker.POLL_MS)
  async tick(): Promise<void> {
    if (this.running) return; // chống chồng lượt khi lô trước gửi lâu
    this.running = true;
    try {
      const jobs = await this.claim();
      for (const job of jobs) await this.deliver(job);
    } catch (e) {
      this.logger.error(`email worker lỗi: ${String(e)}`);
    } finally {
      this.running = false;
    }
  }

  /** Chiếm một lô job sẵn-sàng (pending tới hạn hoặc 'sending' kẹt) — atomic. */
  private async claim(): Promise<EmailJob[]> {
    const { rows } = await this.pool.query<EmailJob>(
      `UPDATE email_queue SET status = 'sending', locked_at = now(),
              attempts = attempts + 1
       WHERE id IN (
         SELECT id FROM email_queue
         WHERE (status = 'pending'
                  AND (next_attempt_at IS NULL OR next_attempt_at <= now()))
            OR (status = 'sending' AND locked_at < now() - interval '${EmailWorker.STALE}')
         ORDER BY created_at
         FOR UPDATE SKIP LOCKED
         LIMIT $1
       )
       RETURNING id, to_addr, subject, body_html, attempts`,
      [EmailWorker.BATCH],
    );
    return rows;
  }

  private async deliver(job: EmailJob): Promise<void> {
    try {
      await this.mailer.send(job.to_addr, job.subject, job.body_html);
      await this.pool.query(
        `UPDATE email_queue
         SET status = 'sent', sent_at = now(), locked_at = NULL, last_error = NULL
         WHERE id = $1`,
        [job.id],
      );
    } catch (e) {
      const err = String(e).slice(0, 500);
      if (job.attempts >= EmailWorker.MAX_ATTEMPTS) {
        await this.pool.query(
          `UPDATE email_queue
           SET status = 'failed', locked_at = NULL, last_error = $2 WHERE id = $1`,
          [job.id, err],
        );
        this.logger.error(
          `email ${job.id} → ${job.to_addr} BỎ sau ${job.attempts} lần: ${err}`,
        );
      } else {
        // Backoff mũ: 60,120,240,480... trần 1h — không quay job lỗi liên tục.
        const delay = Math.min(3600, 30 * 2 ** job.attempts);
        await this.pool.query(
          `UPDATE email_queue
           SET status = 'pending', locked_at = NULL, last_error = $2,
               next_attempt_at = now() + make_interval(secs => $3)
           WHERE id = $1`,
          [job.id, err, delay],
        );
        this.logger.warn(
          `email ${job.id} lỗi lần ${job.attempts}, thử lại sau ${delay}s`,
        );
      }
    }
  }
}
