import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
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
@Controller("v1")
@UseGuards(DirectoryGuard)
export class DirectoryController {
  constructor(private readonly dir: DirectoryService) {}

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

  @Get("users/:id")
  user(
    @Req() req: Request,
    @Param("id") id: string,
    @Query("include_deleted") includeDeleted?: string,
  ) {
    return this.dir.getUser(dirClient(req), id, truthy(includeDeleted), req.ip ?? null);
  }

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

  @Get("groups")
  groups(@Req() req: Request) {
    return this.dir.listGroups(dirClient(req));
  }
}
