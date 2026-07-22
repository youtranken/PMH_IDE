import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { CsvExportService } from "./csv-export.service";
import { CsvImportService } from "./csv-import.service";
import { ExpiryService } from "./expiry.service";
import { PasswordResetService } from "./password-reset.service";
import { TempPasswordService } from "./temp-password.service";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

/**
 * Quản lý user (Epic 4): CRUD, soft-delete/reactivate, khóa, thu hồi phiên
 * (E4-S1/S2); MK tạm/reset (E4-S5); import/export CSV (E4-S3/S4).
 * NotificationsModule cho email_queue. AdminGuard + SessionRevocation + Audit
 * đến từ module @Global.
 */
@Module({
  imports: [NotificationsModule],
  controllers: [UsersController],
  providers: [
    UsersService,
    TempPasswordService,
    PasswordResetService,
    CsvImportService,
    CsvExportService,
    ExpiryService,
  ],
  exports: [UsersService, TempPasswordService, PasswordResetService],
})
export class UsersModule {}
