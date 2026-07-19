import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Pool } from "pg";
import { PG_POOL } from "../../database/database.module";

export interface SystemStatus {
  scheduler: { lastBeatAgeSeconds: number | null; alive: boolean };
  // Job TỚI HẠN mà vẫn pending quá lâu = worker chết (không đếm job đang chờ
  // retry — next_attempt_at ở tương lai).
  stalePending: { emailQueue: number; webhooks: number };
  // Job đã BỎ HẲN (failed) = sự kiện MẤT, cần người xử lý/requeue. Trước đây
  // không lộ ra đâu cả → webhook 'khóa user' chết âm thầm.
  deadLettered: { emailQueue: number; webhooks: number };
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

    // "Pending TỚI HẠN mà vẫn kẹt" = worker chết. Retry job đặt status='pending'
    // với next_attempt_at TƯƠNG LAI (email/webhook worker) → phải loại bằng
    // (next_attempt_at IS NULL OR <= now()), nếu không job đang chờ retry bình
    // thường bị đếm là stale = báo động sai vĩnh viễn (bug cũ: thiếu đúng vế này).
    const stale = HeartbeatService.STALE_SECONDS;
    const { rows: eq } = await this.pool.query<{ n: string }>(
      `SELECT count(*) AS n FROM email_queue
       WHERE status = 'pending'
         AND (next_attempt_at IS NULL OR next_attempt_at <= now())
         AND created_at < now() - interval '${stale} seconds'`,
    );
    const { rows: wh } = await this.pool.query<{ n: string }>(
      `SELECT count(*) AS n FROM webhook_deliveries
       WHERE status = 'pending'
         AND (next_attempt_at IS NULL OR next_attempt_at <= now())
         AND created_at < now() - interval '${stale} seconds'`,
    );
    // Job đã BỎ HẲN (failed) — sự kiện MẤT. Bug cũ: 'failed' không được đếm ở
    // đâu → webhook chết hẳn hoàn toàn im lặng. Requeue qua /admin/webhooks.
    const { rows: eqd } = await this.pool.query<{ n: string }>(
      `SELECT count(*) AS n FROM email_queue WHERE status = 'failed'`,
    );
    const { rows: whd } = await this.pool.query<{ n: string }>(
      `SELECT count(*) AS n FROM webhook_deliveries WHERE status = 'failed'`,
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
      deadLettered: {
        emailQueue: Number.parseInt(eqd[0].n, 10),
        webhooks: Number.parseInt(whd[0].n, 10),
      },
    };
  }
}
