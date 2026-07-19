import { Module } from "@nestjs/common";
import { EmailQueueService } from "./email-queue.service";
import { EmailWorker } from "./email-worker.service";
import { MailerService } from "./mailer.service";
import { WebhookAdminController } from "./webhook-admin.controller";
import { WebhookWorker } from "./webhook-worker.service";

/**
 * Gửi ngầm qua hàng đợi Postgres (AD-13): email (E4-S7) + webhook (E7-S3).
 * EmailWorker/WebhookWorker poll SKIP LOCKED + retry backoff. EmailQueueService
 * export cho MK tạm / import CSV / cảnh báo hạn.
 */
@Module({
  controllers: [WebhookAdminController],
  providers: [MailerService, EmailQueueService, EmailWorker, WebhookWorker],
  exports: [EmailQueueService],
})
export class NotificationsModule {}
