import { Global, Module } from "@nestjs/common";
import { SettingsService } from "./settings.service";

/**
 * Tầng THAM SỐ VẬN HÀNH runtime (bảng `settings`, AD-15): TTL token, idle,
 * policy MK, hạn MK tạm, path backup, SMTP host/port, tham số chống dò.
 * SSA chỉnh trong Settings; đọc có cache, đổi thì invalidate.
 */
@Global()
@Module({
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
