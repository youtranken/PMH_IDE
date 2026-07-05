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

/**
 * Tham số cho SSA chỉnh — whitelist chặn ghi key lạ + SÀN cho số để tránh
 * footgun (vd password_min_length=0 mở toang policy, TTL=0 phiên chết ngay).
 * Creds SMTP ở .env. int có `min`; string bỏ trống.
 */
const ALLOWED: Record<string, { type: "int" | "string"; min?: number }> = {
  access_token_ttl_seconds: { type: "int", min: 30 },
  session_idle_seconds: { type: "int", min: 60 },
  session_absolute_cap_seconds: { type: "int", min: 300 },
  password_min_length: { type: "int", min: 8 },
  password_max_age_days: { type: "int", min: 1 },
  temp_password_ttl_hours: { type: "int", min: 1 },
  client_secret_grace_hours: { type: "int", min: 0 },
  bruteforce_account_threshold: { type: "int", min: 1 },
  bruteforce_backoff_seconds: { type: "int", min: 1 },
  expiry_warning_days: { type: "int", min: 0 },
  smtp_host: { type: "string" },
  smtp_port: { type: "int", min: 1 },
  backup_path: { type: "string" },
  audit_archive_path: { type: "string" },
  // Vai (phẩy) bắt buộc bật MFA — trống = không ép. VD "ssa,project_admin".
  require_mfa_roles: { type: "string" },
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
    const spec = ALLOWED[dto.key];
    if (!spec) throw new BadRequestException(`tham số không cho phép: ${dto.key}`);
    if (spec.type === "int") {
      const n = Number.parseInt(dto.value, 10);
      const min = spec.min ?? 0;
      if (Number.isNaN(n) || String(n) !== dto.value.trim() || n < min) {
        throw new BadRequestException(`${dto.key} phải là số nguyên ≥ ${min}`);
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
