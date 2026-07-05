import { Module } from "@nestjs/common";
import { SettingsAdminController } from "./settings-admin.controller";

/** API Settings cho SSA (E6-S5). SettingsService + AuditService + AdminGuard @Global. */
@Module({
  controllers: [SettingsAdminController],
})
export class SettingsAdminModule {}
