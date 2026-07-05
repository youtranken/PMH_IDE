import { Module } from "@nestjs/common";
import { EmailQueueService } from "./email-queue.service";
import { EmailWorker } from "./email-worker.service";
import { MailerService } from "./mailer.service";

/**
 * Gửi email ngầm qua hàng đợi Postgres (E4-S7, AD-13): MailerService (SMTP) +
 * EmailQueueService (enqueue) + EmailWorker (poll SKIP LOCKED, retry backoff).
 * Webhook (Epic 7) sẽ thêm ở đây. EmailQueueService export cho các story dùng
 * MK tạm / import CSV / cảnh báo hạn (E4-S3/S5/S6/S8).
 */
@Module({
  providers: [MailerService, EmailQueueService, EmailWorker],
  exports: [EmailQueueService],
})
export class NotificationsModule {}
