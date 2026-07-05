import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { AdminGuard } from "../../common/admin/admin.guard";
import { CurrentAdmin } from "../../common/admin/current-admin.decorator";
import type { AdminContext } from "../../common/admin/admin.types";
import { Roles } from "../../common/admin/roles.decorator";
import { AuditService } from "../../common/audit.service";
import { AuditArchiveService } from "../jobs/audit-archive.service";

/**
 * Xem audit theo phạm vi + trình xem lưu trữ (E6-S4, FR-30/31). SSA xem tất;
 * project_admin chỉ project mình (kiểm trong AuditService.query). Lưu trữ tháng
 * (nén) chỉ SSA — sự kiện toàn hệ thống.
 */
@Controller("admin/audit")
@UseGuards(AdminGuard)
export class AuditController {
  constructor(
    private readonly audit: AuditService,
    private readonly archive: AuditArchiveService,
  ) {}

  @Get()
  query(
    @CurrentAdmin() admin: AdminContext,
    @Query("action") action?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    const lim = Math.min(Math.max(Number.parseInt(limit ?? "100", 10) || 100, 1), 500);
    const off = Math.max(Number.parseInt(offset ?? "0", 10) || 0, 0);
    return this.audit.query({
      isSsa: admin.isSsa,
      projectIds: admin.projectIds,
      action: action || undefined,
      limit: lim,
      offset: off,
    });
  }

  @Get("archives")
  @Roles("ssa")
  listArchives() {
    return this.archive.listArchives();
  }

  @Get("archives/:month")
  @Roles("ssa")
  readArchive(@Param("month") month: string) {
    return this.archive.readArchive(month);
  }
}
