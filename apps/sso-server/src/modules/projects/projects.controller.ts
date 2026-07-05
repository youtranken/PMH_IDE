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
import { IsNotEmpty, IsOptional, IsString, IsUUID } from "class-validator";
import type { Request } from "express";
import { AdminGuard } from "../../common/admin/admin.guard";
import { CurrentAdmin } from "../../common/admin/current-admin.decorator";
import type { AdminContext } from "../../common/admin/admin.types";
import { Roles } from "../../common/admin/roles.decorator";
import { ProjectsService } from "./projects.service";

class CreateProjectDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsOptional() @IsString() description?: string;
}
class UpdateProjectDto {
  @IsOptional() @IsString() @IsNotEmpty() name?: string;
  @IsOptional() @IsString() description?: string;
}
class AppointDto {
  @IsUUID() userId!: string;
}

/**
 * Quản project + bổ nhiệm project_admin (E5-S4/S7, FR-22/25). CHỈ SSA
 * (@Roles("ssa") toàn controller) — project_admin không tạo/sửa project.
 */
@Controller("admin/projects")
@UseGuards(AdminGuard)
@Roles("ssa")
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  list() {
    return this.projects.list();
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.projects.get(id);
  }

  @Post()
  create(
    @Body() dto: CreateProjectDto,
    @CurrentAdmin() admin: AdminContext,
    @Req() req: Request,
  ) {
    return this.projects.create(
      dto.name,
      dto.description ?? null,
      admin.userId,
      req.ip ?? null,
    );
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateProjectDto,
    @CurrentAdmin() admin: AdminContext,
    @Req() req: Request,
  ) {
    return this.projects.update(id, dto, admin.userId, req.ip ?? null);
  }

  @Get(":id/admins")
  listAdmins(@Param("id") id: string) {
    return this.projects.listAdmins(id);
  }

  @Post(":id/admins")
  appoint(
    @Param("id") id: string,
    @Body() dto: AppointDto,
    @CurrentAdmin() admin: AdminContext,
    @Req() req: Request,
  ) {
    return this.projects.appointAdmin(id, dto.userId, admin.userId, req.ip ?? null);
  }

  @Delete(":id/admins/:userId")
  removeAdmin(
    @Param("id") id: string,
    @Param("userId") userId: string,
    @CurrentAdmin() admin: AdminContext,
    @Req() req: Request,
  ) {
    return this.projects.removeAdmin(id, userId, admin.userId, req.ip ?? null);
  }
}
