import { Module } from "@nestjs/common";
import { AdminDocsController } from "./admin-docs.controller";
import { DocsController } from "./docs.controller";

/** Cổng tài liệu: docs dự án cho member (DocsController) + docs quản trị PMH ID
 *  cho admin (AdminDocsController). UserGuard/AdminGuard @Global. */
@Module({
  controllers: [DocsController, AdminDocsController],
})
export class DocsModule {}
