import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import {
  IsBoolean,
  IsEmail,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";
import type { Request, Response } from "express";
import { AdminGuard } from "../../common/admin/admin.guard";
import { CurrentAdmin } from "../../common/admin/current-admin.decorator";
import { Roles } from "../../common/admin/roles.decorator";
import type { AdminContext } from "../../common/admin/admin.types";
import { CsvExportService } from "./csv-export.service";
import { CsvImportService } from "./csv-import.service";
import { UsersService } from "./users.service";

class CreateUserDto {
  @IsEmail() email!: string;
  @IsString() @IsNotEmpty() employeeCode!: string;
  @IsString() @IsNotEmpty() fullName!: string;
  @IsString() @IsNotEmpty() department!: string; // phòng ban (bắt buộc)
  // Tùy chọn: đặt MK thủ công ngay khi tạo. Policy kiểm ở service.
  @IsOptional() @IsString() @IsNotEmpty() password?: string;
  @IsOptional() @IsBoolean() mustChangePassword?: boolean;
}
class ResetPasswordDto {
  @IsOptional() @IsString() @IsNotEmpty() password?: string;
  @IsOptional() @IsBoolean() mustChangePassword?: boolean;
}
class UpdateUserDto {
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @IsNotEmpty() employeeCode?: string;
  @IsOptional() @IsString() @IsNotEmpty() fullName?: string;
  @IsOptional() @IsString() @IsNotEmpty() department?: string;
}
class ImportDto {
  @IsString() @IsNotEmpty() csv!: string;
  @IsOptional() @IsBoolean() autoCreateGroups?: boolean;
}
class SetExpiryDto {
  // null = gỡ hạn; ISO8601 = đặt hạn
  @IsOptional() @IsISO8601() expiresAt?: string | null;
}

/**
 * API quản trị user (E4-S1/S2). Cả SSA lẫn project_admin tạo/sửa (FR-12);
 * khóa/xóa/khôi phục/hủy-phiên toàn cục chỉ SSA (FR-17, @Roles("ssa")).
 */
@Controller("admin/users")
@UseGuards(AdminGuard)
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly csvImport: CsvImportService,
    private readonly csvExport: CsvExportService,
  ) {}

  @Get()
  list(
    @CurrentAdmin() admin: AdminContext,
    @Query("q") q?: string,
    @Query("department") department?: string,
  ) {
    return this.users.list(admin, q, department);
  }

  // File MẪU để nhập user (không phải dữ liệu thật). Khai TRƯỚC @Get(":id").
  @Get("export")
  exportTemplate(@Res({ passthrough: true }) res: Response) {
    res.set({
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="user-import-template.csv"',
    });
    return this.csvExport.template();
  }

  @Post("import/preview")
  previewImport(@Body() dto: ImportDto, @CurrentAdmin() admin: AdminContext) {
    return this.csvImport.preview(dto.csv, dto.autoCreateGroups ?? false, admin);
  }

  @Post("import/commit")
  commitImport(@Body() dto: ImportDto, @CurrentAdmin() admin: AdminContext) {
    return this.csvImport.commit(dto.csv, dto.autoCreateGroups ?? false, admin);
  }

  @Get(":id")
  get(@Param("id") id: string, @CurrentAdmin() admin: AdminContext) {
    return this.users.getScoped(id, admin);
  }

  @Post()
  create(
    @Body() dto: CreateUserDto,
    @CurrentAdmin() admin: AdminContext,
    @Req() req: Request,
  ) {
    return this.users.create(
      {
        email: dto.email,
        employeeCode: dto.employeeCode,
        fullName: dto.fullName,
        department: dto.department,
        password: dto.password,
        mustChangePassword: dto.mustChangePassword,
      },
      admin.userId,
      req.ip ?? null,
    );
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateUserDto,
    @CurrentAdmin() admin: AdminContext,
    @Req() req: Request,
  ) {
    return this.users.update(id, dto, admin, req.ip ?? null);
  }

  @Post(":id/delete")
  @Roles("ssa")
  remove(
    @Param("id") id: string,
    @CurrentAdmin() admin: AdminContext,
    @Req() req: Request,
  ) {
    return this.users.softDelete(id, admin.userId, req.ip ?? null);
  }

  // Xóa VĨNH VIỄN (không hoàn tác) — service chặn nếu user chưa khóa/chưa soft-delete.
  @Delete(":id/permanent")
  @Roles("ssa")
  hardDelete(
    @Param("id") id: string,
    @CurrentAdmin() admin: AdminContext,
    @Req() req: Request,
  ) {
    return this.users.hardDelete(id, admin.userId, req.ip ?? null);
  }

  @Post(":id/reactivate")
  @Roles("ssa")
  reactivate(
    @Param("id") id: string,
    @CurrentAdmin() admin: AdminContext,
    @Req() req: Request,
  ) {
    return this.users.reactivate(id, admin.userId, req.ip ?? null);
  }

  @Post(":id/lock")
  @Roles("ssa")
  lock(
    @Param("id") id: string,
    @CurrentAdmin() admin: AdminContext,
    @Req() req: Request,
  ) {
    return this.users.setLocked(id, true, admin.userId, req.ip ?? null);
  }

  @Post(":id/unlock")
  @Roles("ssa")
  unlock(
    @Param("id") id: string,
    @CurrentAdmin() admin: AdminContext,
    @Req() req: Request,
  ) {
    return this.users.setLocked(id, false, admin.userId, req.ip ?? null);
  }

  @Post(":id/set-expiry")
  @Roles("ssa")
  setExpiry(
    @Param("id") id: string,
    @Body() dto: SetExpiryDto,
    @CurrentAdmin() admin: AdminContext,
    @Req() req: Request,
  ) {
    return this.users.setExpiry(
      id,
      dto.expiresAt ?? null,
      admin.userId,
      req.ip ?? null,
    );
  }

  @Post(":id/reset-password")
  resetPassword(
    @Param("id") id: string,
    @Body() dto: ResetPasswordDto,
    @CurrentAdmin() admin: AdminContext,
    @Req() req: Request,
  ) {
    return this.users.resetPassword(id, admin, req.ip ?? null, {
      password: dto.password,
      mustChangePassword: dto.mustChangePassword,
    });
  }

  @Post(":id/ssa")
  @Roles("ssa")
  grantSsa(
    @Param("id") id: string,
    @CurrentAdmin() admin: AdminContext,
    @Req() req: Request,
  ) {
    return this.users.grantSsa(id, admin.userId, req.ip ?? null);
  }

  @Delete(":id/ssa")
  @Roles("ssa")
  revokeSsa(
    @Param("id") id: string,
    @CurrentAdmin() admin: AdminContext,
    @Req() req: Request,
  ) {
    return this.users.revokeSsa(id, admin.userId, req.ip ?? null);
  }

  @Post(":id/revoke-sessions")
  @Roles("ssa")
  revoke(
    @Param("id") id: string,
    @CurrentAdmin() admin: AdminContext,
    @Req() req: Request,
  ) {
    return this.users.revokeSessions(id, admin.userId, req.ip ?? null);
  }
}
