import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Pool } from "pg";
import { PG_POOL } from "../../database/database.module";

export interface SystemStatus {
  scheduler: { lastBeatAgeSeconds: number | null; alive: boolean };
  stalePending: { emailQueue: number; webhooks: number };
}

/**
 * Nhịp sống scheduler (E3-S4, AD-13/AD-16): mỗi phút ghi heartbeat + đếm job
 * "pending quá tuổi" (không chỉ failed — job kẹt pending nghĩa là worker chết).
 * Giám sát out-of-band (E3-S3) đọc trạng thái này.
 */
@Injectable()
export class HeartbeatService {
  private readonly logger = new Logger(HeartbeatService.name);
  private static readonly STALE_SECONDS = 300; // job pending > 5' = nghi worker chết
  private static readonly ALIVE_SECONDS = 180; // heartbeat cũ hơn = scheduler chết

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async beat(): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO heartbeats (component, last_beat) VALUES ('scheduler', now())
         ON CONFLICT (component) DO UPDATE SET last_beat = now()`,
      );
    } catch (e) {
      this.logger.error(`heartbeat lỗi: ${String(e)}`);
    }
  }

  /** Trạng thái nền cho /health + giám sát. */
  async status(): Promise<SystemStatus> {
    const { rows: hb } = await this.pool.query<{ age: number | null }>(
      `SELECT EXTRACT(EPOCH FROM now() - last_beat)::int AS age
       FROM heartbeats WHERE component = 'scheduler'`,
    );
    const age = hb[0]?.age ?? null;

    const { rows: eq } = await this.pool.query<{ n: string }>(
      `SELECT count(*) AS n FROM email_queue
       WHERE status = 'pending'
         AND created_at < now() - interval '${HeartbeatService.STALE_SECONDS} seconds'`,
    );
    // Chỉ tính "pending quá tuổi" = worker chết (E3-S4). KHÔNG tính 'failed'
    // đang retry (có next_attempt_at) — nếu không sẽ báo động vĩnh viễn khi
    // một endpoint webhook chết hẳn (alert fatigue).
    const { rows: wh } = await this.pool.query<{ n: string }>(
      `SELECT count(*) AS n FROM webhook_deliveries
       WHERE status = 'pending'
         AND created_at < now() - interval '${HeartbeatService.STALE_SECONDS} seconds'`,
    );

    return {
      scheduler: {
        lastBeatAgeSeconds: age,
        alive: age !== null && age <= HeartbeatService.ALIVE_SECONDS,
      },
      stalePending: {
        emailQueue: Number.parseInt(eq[0].n, 10),
        webhooks: Number.parseInt(wh[0].n, 10),
      },
    };
  }
}
