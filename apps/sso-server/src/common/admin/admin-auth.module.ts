import { Global, Module } from "@nestjs/common";
import { OidcModule } from "../../oidc/oidc.module";
import { UserGuard } from "../auth/user.guard";
import { AccessTokenService } from "./access-token.service";
import { AdminGuard } from "./admin.guard";

/**
 * Nền xác thực (Epic 4+): verify access token portal offline (AccessTokenService)
 * + AdminGuard (vai trò/phạm vi) + UserGuard (tự phục vụ, chỉ cần user sống).
 * @Global để mọi module dùng @UseGuards không phải import lại.
 */
@Global()
@Module({
  imports: [OidcModule], // KeysService (khóa công verify token)
  providers: [AccessTokenService, AdminGuard, UserGuard],
  exports: [AccessTokenService, AdminGuard, UserGuard],
})
export class AdminAuthModule {}
