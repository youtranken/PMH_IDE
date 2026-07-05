import { Module } from "@nestjs/common";
import { DirectoryController } from "./directory.controller";
import { DirectoryGuard } from "./directory.guard";
import { DirectoryService } from "./directory.service";

/**
 * Directory API M2M (E7-S1) + events feed (E7-S2). client-credentials, scope
 * theo client_groups. AccessTokenService/Audit @Global.
 */
@Module({
  controllers: [DirectoryController],
  providers: [DirectoryService, DirectoryGuard],
})
export class DirectoryApiModule {}
