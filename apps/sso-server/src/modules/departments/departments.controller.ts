import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { IsNotEmpty, IsString } from "class-validator";
import type { Request } from "express";
import { AdminGuard } from "../../common/admin/admin.guard";
import { CurrentAdmin } from "../../common/admin/current-admin.decorator";
import type { AdminContext } from "../../common/admin/admin.types";
import { Roles } from "../../common/admin/roles.decorator";
import { DepartmentsService } from "./departments.service";

class CreateDepartmentDto {
  @IsString() @IsNotEmpty() name!: string;
}

/**
 * Danh mục Phòng ban. Liệt kê + tạo: mọi admin (giống tạo nhóm, để có tên mà gán
 * khi tạo user). Xóa (tài nguyên toàn cục): chỉ SSA, và chỉ khi không còn user.
 */
@Controller("admin/departments")
@UseGuards(AdminGuard)
export class DepartmentsController {
  constructor(private readonly departments: DepartmentsService) {}

  @Get()
  list() {
    return this.departments.list();
  }

  @Post()
  create(
    @Body() dto: CreateDepartmentDto,
    @CurrentAdmin() admin: AdminContext,
    @Req() req: Request,
  ) {
    return this.departments.create(dto.name, admin.userId, req.ip ?? null);
  }

  @Patch(":id")
  @Roles("ssa")
  rename(
    @Param("id") id: string,
    @Body() dto: CreateDepartmentDto,
    @CurrentAdmin() admin: AdminContext,
    @Req() req: Request,
  ) {
    return this.departments.rename(id, dto.name, admin.userId, req.ip ?? null);
  }

  @Delete(":id")
  @Roles("ssa")
  remove(
    @Param("id") id: string,
    @CurrentAdmin() admin: AdminContext,
    @Req() req: Request,
  ) {
    return this.departments.remove(id, admin.userId, req.ip ?? null);
  }
}
