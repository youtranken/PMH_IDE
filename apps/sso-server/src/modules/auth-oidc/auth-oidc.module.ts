import { Module } from "@nestjs/common";
import { OidcModule } from "../../oidc/oidc.module";
import { UsersModule } from "../users/users.module";
import { ForgotPasswordController } from "./forgot-password.controller";
import { InteractionController } from "./interaction.controller";
import { LoginService } from "./login.service";
import { MfaService } from "./mfa.service";
import { PasswordPolicyService } from "./password-policy.service";
import { RateLimitService } from "./rate-limit.service";
import { StageService } from "./stage.service";

/**
 * Đăng nhập nhiều bước (E1-S4 + Epic 2): password → đổi MK bắt buộc → MFA.
 * + Quên MK (E4-S8) dùng MK tạm (UsersModule). KEK/Audit từ CommonModule.
 */
@Module({
  imports: [OidcModule, UsersModule],
  controllers: [InteractionController, ForgotPasswordController],
  providers: [
    LoginService,
    PasswordPolicyService,
    MfaService,
    RateLimitService,
    StageService,
  ],
  exports: [MfaService, RateLimitService, LoginService, PasswordPolicyService],
})
export class AuthOidcModule {}
