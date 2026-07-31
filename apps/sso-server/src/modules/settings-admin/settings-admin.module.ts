import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { SettingsAdminController } from "./settings-admin.controller";

/** API Settings cho SSA (E6-S5). SettingsService + AuditService + AdminGuard @Global.
 *  NotificationsModule cho MailerService (nút "Gửi thử" email). */
@Module({
  imports: [NotificationsModule],
  controllers: [SettingsAdminController],
})
export class SettingsAdminModule {}
