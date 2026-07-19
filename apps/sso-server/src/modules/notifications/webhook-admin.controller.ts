import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { AdminGuard } from "../../common/admin/admin.guard";
import { CurrentAdmin } from "../../common/admin/current-admin.decorator";
import type { AdminContext } from "../../common/admin/admin.types";
import { Roles } from "../../common/admin/roles.decorator";
import { AuditService } from "../../common/audit.service";
import { WebhookWorker } from "./webhook-worker.service";

/**
 * Dead-letter webhook (E7): SSA soi các delivery đã BỎ HẲN và gửi lại. Trước đây
 * delivery 'failed' (vd 'khóa user' không giao được sau hết retry) mất vĩnh viễn,
 * không endpoint nào thấy. Chỉ SSA — sự kiện toàn hệ, và requeue chạm mọi tenant.
 */
@Controller("admin/webhooks")
@UseGuards(AdminGuard)
@Roles("ssa")
export class WebhookAdminController {
  constructor(
    private readonly webhooks: WebhookWorker,
    private readonly audit: AuditService,
  ) {}

  /** Danh sách delivery đã bỏ hẳn (dead-letter). */
  @Get("failed")
  listFailed(@Query("limit") limit?: string) {
    return this.webhooks.listFailed(
      Number.parseInt(limit ?? "100", 10) || 100,
    );
  }

  /** Gửi lại một delivery đã bỏ. 404 nếu id không phải delivery 'failed'. */
  @Post(":id/requeue")
  async requeue(
    @Param("id") id: string,
    @CurrentAdmin() admin: AdminContext,
    @Req() req: Request,
  ): Promise<{ ok: true }> {
    const ok = await this.webhooks.requeue(id);
    if (!ok) throw new NotFoundException("không có delivery đã bỏ với id này");
    await this.audit.record({
      actorUserId: admin.userId,
      action: "webhook.requeued",
      targetType: "webhook_delivery",
      targetId: id,
      ip: req.ip ?? null,
    });
    return { ok: true };
  }
}
