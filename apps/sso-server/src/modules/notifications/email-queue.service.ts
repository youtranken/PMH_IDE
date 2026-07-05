import { Inject, Injectable } from "@nestjs/common";
import { Pool } from "pg";
import { PG_POOL } from "../../database/database.module";

/**
 * Xếp email vào hàng đợi Postgres (AD-13). Việc tạo user / reset MK / cảnh báo
 * hạn chỉ INSERT một dòng rồi trả về NGAY — không chờ SMTP. Worker (EmailWorker)
 * gửi ngầm. Tách rời này để tạo user không rớt khi SMTP nghẽn (E4-S3/S5/S6).
 */
@Injectable()
export class EmailQueueService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /** Đưa 1 email vào hàng đợi (trạng thái 'pending', gửi ngay lượt worker kế). */
  async enqueue(toAddr: string, subject: string, bodyHtml: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO email_queue (to_addr, subject, body_html)
       VALUES ($1, $2, $3)`,
      [toAddr, subject, bodyHtml],
    );
  }
}
