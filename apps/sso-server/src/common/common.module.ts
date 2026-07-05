import { Global, Module } from "@nestjs/common";
import { AuditService } from "./audit.service";
import { KekService } from "./kek.service";
import { SessionRevocationService } from "./session-revocation.service";

/**
 * Tiện ích dùng chung: mã hóa KEK (AD-15) + ghi audit (FR-29) + thu hồi phiên
 * (FR-05, dùng bởi Users/self-service).
 */
@Global()
@Module({
  providers: [KekService, AuditService, SessionRevocationService],
  exports: [KekService, AuditService, SessionRevocationService],
})
export class CommonModule {}
