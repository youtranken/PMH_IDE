import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { IsNotEmpty, IsString } from "class-validator";
import type { Request } from "express";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { UserGuard } from "../../common/auth/user.guard";
import { MeService } from "./me.service";

class ChangePasswordDto {
  @IsString() @IsNotEmpty() currentPassword!: string;
  @IsString() @IsNotEmpty() newPassword!: string;
}
class MfaCodeDto {
  @IsString() @IsNotEmpty() code!: string;
}

/**
 * API tự phục vụ (/api/me, E6-S1/S2). UserGuard: chỉ cần token portal hợp lệ +
 * user còn sống. Mọi thao tác trên CHÍNH user gọi.
 */
@Controller("me")
@UseGuards(UserGuard)
export class MeController {
  constructor(private readonly me: MeService) {}

  @Get()
  profile(@CurrentUser() userId: string) {
    return this.me.profile(userId);
  }

  @Get("apps")
  apps(@CurrentUser() userId: string) {
    return this.me.apps(userId);
  }

  @Get("sessions")
  sessions(@CurrentUser() userId: string) {
    return this.me.sessions(userId);
  }

  @Post("sessions/:uid/revoke")
  revokeSession(
    @CurrentUser() userId: string,
    @Param("uid") uid: string,
    @Req() req: Request,
  ) {
    return this.me.revokeSession(userId, uid, req.ip ?? null);
  }

  @Get("mfa")
  mfaStatus(@CurrentUser() userId: string) {
    return this.me.mfaStatus(userId);
  }

  @Post("mfa/setup")
  mfaSetup(@CurrentUser() userId: string) {
    return this.me.mfaSetup(userId);
  }

  @Post("mfa/enable")
  mfaEnable(
    @CurrentUser() userId: string,
    @Body() dto: MfaCodeDto,
    @Req() req: Request,
  ) {
    return this.me.mfaEnable(userId, dto.code, req.ip ?? null);
  }

  @Post("mfa/disable")
  mfaDisable(
    @CurrentUser() userId: string,
    @Body() dto: MfaCodeDto,
    @Req() req: Request,
  ) {
    return this.me.mfaDisable(userId, dto.code, req.ip ?? null);
  }

  @Post("change-password")
  changePassword(
    @CurrentUser() userId: string,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ) {
    // Phiên hiện tại = cookie _session của oidc-provider (same-origin gửi kèm).
    const keep =
      (req.cookies as Record<string, string> | undefined)?._session ?? null;
    return this.me.changePassword(
      userId,
      dto.currentPassword,
      dto.newPassword,
      keep,
      req.ip ?? null,
    );
  }
}
