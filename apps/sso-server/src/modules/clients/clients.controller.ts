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
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
} from "class-validator";

// redirect_uri phải TUYỆT ĐỐI có http(s):// (require_protocol) — không thì
// isURL coi "not-a-url" là host hợp lệ. localhost dev không TLD → require_tld:false.
const URI_OPTS = {
  require_tld: false,
  require_protocol: true,
  protocols: ["http", "https"],
};
import type { Request } from "express";
import { AdminGuard } from "../../common/admin/admin.guard";
import { CurrentAdmin } from "../../common/admin/current-admin.decorator";
import type { AdminContext } from "../../common/admin/admin.types";
import { ClientsService } from "./clients.service";

class CreateClientDto {
  @IsUUID() projectId!: string;
  @IsString() @IsNotEmpty() clientId!: string;
  @IsString() @IsNotEmpty() name!: string;
  @IsIn(["dev", "prod"]) env!: string;
  @IsArray() @IsUrl(URI_OPTS, { each: true }) redirectUris: string[] = [];
  @IsOptional() @IsUrl(URI_OPTS) appUrl?: string;
}
class UpdateClientDto {
  @IsOptional() @IsString() @IsNotEmpty() name?: string;
  @IsOptional() @IsArray() @IsUrl(URI_OPTS, { each: true }) redirectUris?: string[];
  @IsOptional() @IsUrl(URI_OPTS) appUrl?: string;
}
class GroupDto {
  @IsUUID() groupId!: string;
}
class AllowAllDto {
  @IsBoolean() allowAll!: boolean;
}

/**
 * Client CRUD + secret + client_groups (E5-S5/S6/S3). SSA và project_admin
 * (phạm vi project) — kiểm phạm vi trong service. Secret hiện MỘT LẦN ở response
 * create/rotate; các API khác không bao giờ trả secret.
 */
@Controller("admin/clients")
@UseGuards(AdminGuard)
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Get()
  list(@CurrentAdmin() admin: AdminContext) {
    return this.clients.list(admin);
  }

  @Get(":id")
  get(@Param("id") id: string, @CurrentAdmin() admin: AdminContext) {
    return this.clients.getScoped(id, admin);
  }

  @Post()
  create(
    @Body() dto: CreateClientDto,
    @CurrentAdmin() admin: AdminContext,
    @Req() req: Request,
  ) {
    return this.clients.create(
      {
        projectId: dto.projectId,
        clientId: dto.clientId,
        name: dto.name,
        env: dto.env,
        redirectUris: dto.redirectUris,
        appUrl: dto.appUrl,
      },
      admin,
      req.ip ?? null,
    );
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateClientDto,
    @CurrentAdmin() admin: AdminContext,
    @Req() req: Request,
  ) {
    return this.clients.update(id, dto, admin, req.ip ?? null);
  }

  @Post(":id/disable")
  disable(
    @Param("id") id: string,
    @CurrentAdmin() admin: AdminContext,
    @Req() req: Request,
  ) {
    return this.clients.setDisabled(id, true, admin, req.ip ?? null);
  }

  @Post(":id/enable")
  enable(
    @Param("id") id: string,
    @CurrentAdmin() admin: AdminContext,
    @Req() req: Request,
  ) {
    return this.clients.setDisabled(id, false, admin, req.ip ?? null);
  }

  @Get(":id/secrets")
  listSecrets(@Param("id") id: string, @CurrentAdmin() admin: AdminContext) {
    return this.clients.listSecrets(id, admin);
  }

  @Post(":id/rotate-secret")
  rotate(
    @Param("id") id: string,
    @CurrentAdmin() admin: AdminContext,
    @Req() req: Request,
  ) {
    return this.clients.rotateSecret(id, admin, req.ip ?? null);
  }

  @Delete(":id/secrets/:secretId")
  revokeSecret(
    @Param("id") id: string,
    @Param("secretId") secretId: string,
    @CurrentAdmin() admin: AdminContext,
    @Req() req: Request,
  ) {
    return this.clients.revokeSecret(id, secretId, admin, req.ip ?? null);
  }

  @Get(":id/groups")
  listGroups(@Param("id") id: string, @CurrentAdmin() admin: AdminContext) {
    return this.clients.listGroups(id, admin);
  }

  @Post(":id/groups")
  addGroup(
    @Param("id") id: string,
    @Body() dto: GroupDto,
    @CurrentAdmin() admin: AdminContext,
    @Req() req: Request,
  ) {
    return this.clients.addGroup(id, dto.groupId, admin, req.ip ?? null);
  }

  @Delete(":id/groups/:groupId")
  removeGroup(
    @Param("id") id: string,
    @Param("groupId") groupId: string,
    @CurrentAdmin() admin: AdminContext,
    @Req() req: Request,
  ) {
    return this.clients.removeGroup(id, groupId, admin, req.ip ?? null);
  }

  @Post(":id/allow-all")
  allowAll(
    @Param("id") id: string,
    @Body() dto: AllowAllDto,
    @CurrentAdmin() admin: AdminContext,
    @Req() req: Request,
  ) {
    return this.clients.setAllowAll(id, dto.allowAll, admin, req.ip ?? null);
  }
}
