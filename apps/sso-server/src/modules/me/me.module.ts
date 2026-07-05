import { Module } from "@nestjs/common";
import { AuthOidcModule } from "../auth-oidc/auth-oidc.module";
import { MeController } from "./me.controller";
import { MeService } from "./me.service";

/**
 * Tự phục vụ user (E6-S1/S2): launcher, group, phiên, đổi MK. Dùng lại
 * LoginService/PasswordPolicy từ AuthOidcModule; UserGuard @Global.
 */
@Module({
  imports: [AuthOidcModule],
  controllers: [MeController],
  providers: [MeService],
})
export class MeModule {}
