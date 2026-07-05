import { Module } from "@nestjs/common";
import { ClientsController } from "./clients.controller";
import { ClientsService } from "./clients.service";

/**
 * Client CRUD + client_secret rotate/thu hồi (E5-S5/S6) + client_groups (E5-S3).
 * oidc-provider đọc client DB qua adapter (Path A); secret dev validate ở
 * middleware /oidc/token. AdminGuard/Audit @Global.
 */
@Module({
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}
