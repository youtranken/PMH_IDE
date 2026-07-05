import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import { IsNotEmpty, IsString } from "class-validator";
import type { Request } from "express";
import { AdminGuard } from "../../common/admin/admin.guard";
import { CurrentAdmin } from "../../common/admin/current-admin.decorator";
import type { AdminContext } from "../../common/admin/admin.types";
import { Roles } from "../../common/admin/roles.decorator";
import { AuditService } from "../../common/audit.service";
import { SettingsService } from "../../config/settings.service";

/** Tham số cho SSA chỉnh + kiểu — whitelist chặn ghi key lạ. Creds SMTP ở .env. */
const ALLOWED: Record<string, "int" | "string"> = {
  access_token_ttl_seconds: "int",
  session_idle_seconds: "int",
  session_absolute_cap_seconds: "int",
  password_min_length: "int",
  password_max_age_days: "int",
  temp_password_ttl_hours: "int",
  client_secret_grace_hours: "int",
  bruteforce_account_threshold: "int",
  bruteforce_backoff_seconds: "int",
  expiry_warning_days: "int",
  smtp_host: "string",
  smtp_port: "int",
  backup_path: "string",
  audit_archive_path: "string",
};

class SetSettingDto {
  @IsString() @IsNotEmpty() key!: string;
  @IsString() value!: string;
}

/**
 * Settings vận hành cho SSA (E6-S5, FR-32/AD-15). Đổi giá trị áp dụng RUNTIME
 * (SettingsService.set ghi cache in-place → TTL/policy hiệu lực ngay, không
 * restart). Chỉ key trong whitelist; số phải hợp lệ.
 */
@Controller("admin/settings")
@UseGuards(AdminGuard)
@Roles("ssa")
export class SettingsAdminController {
  constructor(
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list() {
    return this.settings.list();
  }

  @Put()
  async set(
    @Body() dto: SetSettingDto,
    @CurrentAdmin() admin: AdminContext,
    @Req() req: Request,
  ) {
    const type = ALLOWED[dto.key];
    if (!type) throw new BadRequestException(`tham số không cho phép: ${dto.key}`);
    if (type === "int") {
      const n = Number.parseInt(dto.value, 10);
      if (Number.isNaN(n) || n < 0 || String(n) !== dto.value.trim()) {
        throw new BadRequestException(`${dto.key} phải là số nguyên ≥ 0`);
      }
    }
    await this.settings.set(dto.key, dto.value.trim());
    await this.audit.record({
      actorUserId: admin.userId,
      action: "settings.updated",
      targetType: "setting",
      targetId: dto.key,
      ip: req.ip ?? null,
      detail: { value: dto.value },
    });
    return { ok: true, key: dto.key, value: dto.value.trim() };
  }
}
