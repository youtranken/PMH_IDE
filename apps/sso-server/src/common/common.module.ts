import { Global, Module } from "@nestjs/common";
import { AuditService } from "./audit.service";
import { KekService } from "./kek.service";
import { SessionRevocationService } from "./session-revocation.service";
import { UserEventsService } from "./user-events.service";

/**
 * Tiện ích dùng chung: mã hóa KEK (AD-15) + ghi audit (FR-29) + thu hồi phiên
 * (FR-05) + phát user_events (FR-27, dùng bởi Users/Groups/self-service).
 */
@Global()
@Module({
  providers: [
    KekService,
    AuditService,
    SessionRevocationService,
    UserEventsService,
  ],
  exports: [
    KekService,
    AuditService,
    SessionRevocationService,
    UserEventsService,
  ],
})
export class CommonModule {}
