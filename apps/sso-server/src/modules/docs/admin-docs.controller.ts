import { Controller, Get, UseGuards } from "@nestjs/common";
import { AdminGuard } from "../../common/admin/admin.guard";
import { readProjectDocs } from "./docs.controller";

/**
 * Tài liệu QUẢN TRỊ PMH ID (handover — cách dùng Người dùng/Nhóm/Nhật ký/Cấu hình).
 * Chỉ ADMIN (AdminGuard: cần có vai project_admin hoặc ssa). Đọc folder cố định
 * docs-content/pmh-portal/ — KHÔNG qua kiểm quyền-client như docs dự án (pmh-portal
 * là client nội bộ, không có app_url nên không xuất hiện ở /api/me/apps).
 */
@Controller("admin/docs")
@UseGuards(AdminGuard)
export class AdminDocsController {
  @Get()
  pmhIdDocs(): { documents: ReturnType<typeof readProjectDocs> } {
    return { documents: readProjectDocs("pmh-portal") };
  }
}
