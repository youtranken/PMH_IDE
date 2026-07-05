import { Module } from "@nestjs/common";
import { JobsModule } from "../jobs/jobs.module";
import { AuditController } from "./audit.controller";

/**
 * Xem audit theo phạm vi + trình xem lưu trữ (E6-S4). Ghi audit dùng
 * AuditService @Global; đọc archive dùng AuditArchiveService (JobsModule).
 */
@Module({
  imports: [JobsModule],
  controllers: [AuditController],
})
export class AuditModule {}
