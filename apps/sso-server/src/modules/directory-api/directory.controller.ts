import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import type { Request } from "express";
import { DirectoryGuard, type DirClient } from "./directory.guard";
import { DirectoryService } from "./directory.service";

function dirClient(req: Request): DirClient {
  return (req as Request & { dirClient: DirClient }).dirClient;
}
const truthy = (v?: string) => v === "true" || v === "1";

/**
 * Directory API cho project ngoài (E7-S1, FR-26). client-credentials + scope
 * theo client_groups. Mount /api/v1 (global prefix 'api'). Không trả password.
 */
@ApiTags("Directory API (M2M)")
@ApiBearerAuth("client-credentials")
@Controller("v1")
@UseGuards(DirectoryGuard)
export class DirectoryController {
  constructor(private readonly dir: DirectoryService) {}

  @ApiOperation({
    summary: "Danh bạ user trong scope client",
    description:
      "Trả user thuộc các group được gán cho client (client_groups). KHÔNG có password. Phân trang bằng limit/offset.",
  })
  @ApiQuery({ name: "include_deleted", required: false, description: "true → gồm user đã xóa mềm" })
  @ApiQuery({ name: "limit", required: false, description: "Số dòng tối đa (mặc định 100)" })
  @ApiQuery({ name: "offset", required: false, description: "Bỏ qua N dòng đầu (mặc định 0)" })
  @Get("users")
  users(
    @Req() req: Request,
    @Query("include_deleted") includeDeleted?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.dir.listUsers(
      dirClient(req),
      {
        includeDeleted: truthy(includeDeleted),
        limit: Number.parseInt(limit ?? "100", 10) || 100,
        offset: Number.parseInt(offset ?? "0", 10) || 0,
        nowMs: Date.now(),
      },
      req.ip ?? null,
    );
  }

  @ApiOperation({
    summary: "Chi tiết một user theo id nội bộ",
    description: "404 đồng nhất 'ngoài phạm vi hoặc không tồn tại' (chống dò).",
  })
  @ApiQuery({ name: "include_deleted", required: false, description: "true → cho phép đọc user đã xóa mềm" })
  @Get("users/:id")
  user(
    @Req() req: Request,
    @Param("id") id: string,
    @Query("include_deleted") includeDeleted?: string,
  ) {
    return this.dir.getUser(dirClient(req), id, truthy(includeDeleted), req.ip ?? null);
  }

  @ApiOperation({
    summary: "Feed sự kiện user (khóa/xóa/đổi nhóm) để đồng bộ tăng dần",
    description:
      "Trả sự kiện có id > since (cursor). Giữ 90 ngày; cursor quá cũ → 410 (resync toàn bộ).",
  })
  @ApiQuery({ name: "since", required: false, description: "Cursor: chỉ lấy sự kiện id lớn hơn (mặc định 0)" })
  @ApiQuery({ name: "limit", required: false, description: "Số sự kiện tối đa (mặc định 100)" })
  @Get("events")
  events(
    @Req() req: Request,
    @Query("since") since?: string,
    @Query("limit") limit?: string,
  ) {
    return this.dir.listEvents(
      dirClient(req),
      Number.parseInt(since ?? "0", 10) || 0,
      Number.parseInt(limit ?? "100", 10) || 100,
      Date.now(),
    );
  }

  @ApiOperation({
    summary: "Các group được gán cho client này",
    description: "Dùng để biết scope danh bạ mà client được phép đọc.",
  })
  @Get("groups")
  groups(@Req() req: Request) {
    return this.dir.listGroups(dirClient(req));
  }
}
