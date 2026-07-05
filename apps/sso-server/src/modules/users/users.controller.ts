import {
  Body,
  Controller,
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
}
class UpdateUserDto {
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @IsNotEmpty() employeeCode?: string;
  @IsOptional() @IsString() @IsNotEmpty() fullName?: string;
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
  list() {
    return this.users.list();
  }

  // Khai TRƯỚC @Get(":id") để "export" không bị bắt làm :id.
  @Get("export")
  async export(
    @Query("group") group: string | undefined,
    @Query("status") status: string | undefined,
    @CurrentAdmin() admin: AdminContext,
    @Res({ passthrough: true }) res: Response,
  ) {
    const csv = await this.csvExport.exportCsv({ group, status }, admin);
    res.set({
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="users.csv"',
    });
    return csv;
  }

  @Post("import/preview")
  previewImport(@Body() dto: ImportDto) {
    return this.csvImport.preview(dto.csv, dto.autoCreateGroups ?? false);
  }

  @Post("import/commit")
  commitImport(@Body() dto: ImportDto) {
    return this.csvImport.commit(dto.csv, dto.autoCreateGroups ?? false);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.users.get(id);
  }

  @Post()
  create(
    @Body() dto: CreateUserDto,
    @CurrentAdmin() admin: AdminContext,
    @Req() req: Request,
  ) {
    return this.users.create(dto, admin.userId, req.ip ?? null);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateUserDto,
    @CurrentAdmin() admin: AdminContext,
    @Req() req: Request,
  ) {
    return this.users.update(id, dto, admin.userId, req.ip ?? null);
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
    @CurrentAdmin() admin: AdminContext,
    @Req() req: Request,
  ) {
    return this.users.resetPassword(id, admin, req.ip ?? null);
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
