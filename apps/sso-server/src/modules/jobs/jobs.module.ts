import { Module } from "@nestjs/common";
import { AuditArchiveService } from "./audit-archive.service";
import { CleanupService } from "./cleanup.service";
import { HeartbeatService } from "./heartbeat.service";

/**
 * Xử lý nền: @nestjs/schedule (cron) + hàng đợi bảng Postgres
 * (SELECT FOR UPDATE SKIP LOCKED — AD-13), worker in-process. KHÔNG Redis.
 * Epic 3: heartbeat (E3-S4) + nén audit (E3-S6). Email/webhook worker: E4/E7.
 */
@Module({
  providers: [HeartbeatService, AuditArchiveService, CleanupService],
  exports: [HeartbeatService, AuditArchiveService],
})
export class JobsModule {}
