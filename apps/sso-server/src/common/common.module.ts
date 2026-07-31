import { Global, Module } from "@nestjs/common";
import { AuditService } from "./audit.service";
import { BackchannelLogoutService } from "./backchannel-logout.service";
import { KekService } from "./kek.service";
import { SessionRevocationService } from "./session-revocation.service";
import { UserEventsService } from "./user-events.service";

/**
 * Tiện ích dùng chung: mã hóa KEK (AD-15) + ghi audit (FR-29) + thu hồi phiên
 * (FR-05) + phát user_events (FR-27, dùng bởi Users/Groups/self-service) +
 * Back-Channel Logout (E1-S7). BCL cần OIDC_PROVIDER nhưng KHÔNG import OidcModule
 * (sẽ tạo cycle: OidcModule→KeysService→KekService nằm trong CommonModule) — thay
 * vào đó resolve provider lazy qua ModuleRef lúc chạy.
 */
@Global()
@Module({
  providers: [
    KekService,
    AuditService,
    BackchannelLogoutService,
    SessionRevocationService,
    UserEventsService,
  ],
  exports: [
    KekService,
    AuditService,
    BackchannelLogoutService,
    SessionRevocationService,
    UserEventsService,
  ],
})
export class CommonModule {}
