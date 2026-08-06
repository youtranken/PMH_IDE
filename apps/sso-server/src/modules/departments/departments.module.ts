import { Module } from "@nestjs/common";
import { DepartmentsController } from "./departments.controller";
import { DepartmentsService } from "./departments.service";

/** Danh mục Phòng ban (nhãn tổ chức) — nguồn cho dropdown khi tạo/sửa user. */
@Module({
  controllers: [DepartmentsController],
  providers: [DepartmentsService],
  exports: [DepartmentsService],
})
export class DepartmentsModule {}
