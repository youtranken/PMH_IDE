import { createHmac } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { Pool } from "pg";
import { KekService } from "../../common/kek.service";
import { SettingsService } from "../../config/settings.service";
import { PG_POOL } from "../../database/database.module";
import { assertEgressAllowed } from "./egress.util";

interface Delivery {
  id: string;
  client_id: string;
  event: string;
  payload: unknown;
  target_url: string;
  attempts: number;
}

/**
 * Gửi webhook (E7-S3, AD-14). Claim `webhook_deliveries` bằng FOR UPDATE SKIP
 * LOCKED, KIỂM egress lại lúc gửi (chống SSRF/đổi cấu hình), ký HMAC-SHA256 bằng
 * webhook_secret (giải mã KEK), POST https có timeout. Lỗi tạm → retry giãn dần;
 * đích bị chặn/thiếu secret → bỏ ngay (lỗi cấu hình, không retry vô ích).
 */
@Injectable()
export class WebhookWorker {
  private readonly logger = new Logger(WebhookWorker.name);
  private running = false;
  private static readonly BATCH = 10;
  private static readonly POLL_MS = 15_000;
  private static readonly MAX_ATTEMPTS = 6;
  private static readonly TIMEOUT_MS = 10_000;

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly kek: KekService,
    private readonly settings: SettingsService,
  ) {}

  @Interval(WebhookWorker.POLL_MS)
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const jobs = await this.claim();
      for (const j of jobs) await this.deliver(j);
    } catch (e) {
      this.logger.error(`webhook worker lỗi: ${String(e)}`);
    } finally {
      this.running = false;
    }
  }

  private async claim(): Promise<Delivery[]> {
    const { rows } = await this.pool.query<Delivery>(
      `UPDATE webhook_deliveries SET status = 'sending', locked_at = now(),
              attempts = attempts + 1
       WHERE id IN (
         SELECT id FROM webhook_deliveries
         WHERE (status = 'pending'
                  AND (next_attempt_at IS NULL OR next_attempt_at <= now()))
            OR (status = 'sending' AND locked_at < now() - interval '5 minutes')
         ORDER BY created_at
         FOR UPDATE SKIP LOCKED
         LIMIT $1
       )
       RETURNING id, client_id, event, payload, target_url, attempts`,
      [WebhookWorker.BATCH],
    );
    return rows;
  }

  private async deliver(job: Delivery): Promise<void> {
    try {
      // Secret + egress kiểm LẠI lúc gửi (cấu hình/DNS có thể đã đổi).
      const { rows } = await this.pool.query<{ webhook_secret_enc: Buffer | null }>(
        `SELECT webhook_secret_enc FROM clients WHERE id = $1 AND NOT disabled`,
        [job.client_id],
      );
      const enc = rows[0]?.webhook_secret_enc;
      if (!enc) return this.fail(job.id, "client tắt/không có webhook secret", true);
      const allowlist = (await this.settings.get("webhook_allowlist_cidr", "")) ?? "";
      try {
        await assertEgressAllowed(job.target_url, allowlist);
      } catch (e) {
        return this.fail(job.id, `egress chặn: ${(e as Error).message}`, true);
      }

      const secret = this.kek.decrypt(enc);
      const body = JSON.stringify(job.payload);
      const sig = createHmac("sha256", secret).update(body).digest("hex");
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), WebhookWorker.TIMEOUT_MS);
      let ok = false;
      let status = 0;
      try {
        const r = await fetch(job.target_url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-PMH-Event": job.event,
            "X-PMH-Signature": `sha256=${sig}`,
          },
          body,
          signal: ctrl.signal,
        });
        status = r.status;
        ok = r.ok;
      } finally {
        clearTimeout(timer);
      }

      if (ok) {
        await this.pool.query(
          `UPDATE webhook_deliveries
           SET status = 'delivered', delivered_at = now(), locked_at = NULL,
               last_error = NULL WHERE id = $1`,
          [job.id],
        );
      } else {
        await this.retryOrFail(job, `HTTP ${status}`);
      }
    } catch (e) {
      await this.retryOrFail(job, String((e as Error).message ?? e).slice(0, 300));
    }
  }

  /** Lỗi tạm → retry backoff tới hạn rồi failed. */
  private async retryOrFail(job: Delivery, err: string): Promise<void> {
    if (job.attempts >= WebhookWorker.MAX_ATTEMPTS) {
      await this.fail(job.id, err, false);
      this.logger.warn(`webhook ${job.id} BỎ sau ${job.attempts} lần: ${err}`);
      return;
    }
    const delay = Math.min(3600, 30 * 2 ** job.attempts);
    await this.pool.query(
      `UPDATE webhook_deliveries
       SET status = 'pending', locked_at = NULL, last_error = $2,
           next_attempt_at = now() + make_interval(secs => $3)
       WHERE id = $1`,
      [job.id, err, delay],
    );
  }

  /** Bỏ hẳn (terminal). `config` = lỗi cấu hình, không phải lỗi mạng tạm. */
  private async fail(id: string, err: string, config: boolean): Promise<void> {
    await this.pool.query(
      `UPDATE webhook_deliveries
       SET status = 'failed', locked_at = NULL, last_error = $2 WHERE id = $1`,
      [id, (config ? "[config] " : "") + err],
    );
  }
}
