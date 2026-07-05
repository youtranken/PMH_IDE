import { Module } from "@nestjs/common";
import { DocsController } from "./docs.controller";

/** Cổng tài liệu tích hợp gate Developers (E8-S1). UserGuard @Global. */
@Module({
  controllers: [DocsController],
})
export class DocsModule {}
