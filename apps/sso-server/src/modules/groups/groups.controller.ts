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
import { GroupsService } from "./groups.service";

class CreateGroupDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsOptional() @IsString() description?: string;
}
class UpdateGroupDto {
  @IsOptional() @IsString() @IsNotEmpty() name?: string;
  @IsOptional() @IsString() description?: string;
}
class MemberDto {
  @IsUUID() userId!: string;
}

/**
 * Group CRUD + thành viên (E5-S1/S2). Tạo: cả SSA lẫn project_admin (FR-19).
 * Sửa tên/mô tả (tài nguyên toàn cục): chỉ SSA. Thêm/bớt member: phạm vi kiểm
 * trong service (SSA mọi group; project_admin group thuộc project mình).
 */
@Controller("admin/groups")
@UseGuards(AdminGuard)
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  @Get()
  list() {
    return this.groups.list();
  }

  // Map nhóm → app mở quyền (màn Tạo user). PHẢI đứng trước @Get(":id").
  @Get("access-map")
  accessMap() {
    return this.groups.accessMap();
  }

  @Get(":id")
  get(@Param("id") id: string, @CurrentAdmin() admin: AdminContext) {
    return this.groups.getScoped(id, admin);
  }

  @Post()
  create(
    @Body() dto: CreateGroupDto,
    @CurrentAdmin() admin: AdminContext,
    @Req() req: Request,
  ) {
    return this.groups.create(
      dto.name,
      dto.description ?? null,
      admin.userId,
      req.ip ?? null,
    );
  }

  @Patch(":id")
  @Roles("ssa")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateGroupDto,
    @CurrentAdmin() admin: AdminContext,
    @Req() req: Request,
  ) {
    return this.groups.update(id, dto, admin.userId, req.ip ?? null);
  }

  // Xóa hẳn nhóm (SSA) — cascade gỡ member khỏi nhóm + gỡ grant khỏi client.
  @Delete(":id")
  @Roles("ssa")
  remove(
    @Param("id") id: string,
    @CurrentAdmin() admin: AdminContext,
    @Req() req: Request,
  ) {
    return this.groups.remove(id, admin.userId, req.ip ?? null);
  }

  @Get(":id/members")
  listMembers(@Param("id") id: string, @CurrentAdmin() admin: AdminContext) {
    return this.groups.listMembers(id, admin);
  }

  @Post(":id/members")
  addMember(
    @Param("id") id: string,
    @Body() dto: MemberDto,
    @CurrentAdmin() admin: AdminContext,
    @Req() req: Request,
  ) {
    return this.groups.addMember(id, dto.userId, admin, req.ip ?? null);
  }

  @Delete(":id/members/:userId")
  removeMember(
    @Param("id") id: string,
    @Param("userId") userId: string,
    @CurrentAdmin() admin: AdminContext,
    @Req() req: Request,
  ) {
    return this.groups.removeMember(id, userId, admin, req.ip ?? null);
  }
}
