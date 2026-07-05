import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  Controller,
  ForbiddenException,
  Get,
  Inject,
  UseGuards,
} from "@nestjs/common";
import { Pool } from "pg";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { UserGuard } from "../../common/auth/user.guard";
import { PG_POOL } from "../../database/database.module";

const DOCS_PATH =
  process.env.DOCS_INTEGRATION_PATH ??
  join(process.cwd(), "docs-integration", "README.md");

/**
 * Cổng tài liệu tích hợp (E8-S1, FR-33). SAU đăng nhập (UserGuard) + CHỈ user
 * thuộc group "Developers" — kiểm ở BE (không phải magic-string FE): non-
 * Developer không lấy được nội dung. Nguồn: docs/integration/README.md.
 */
@Controller("docs")
@UseGuards(UserGuard)
export class DocsController {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  @Get()
  async docs(@CurrentUser() userId: string): Promise<{ content: string }> {
    const { rowCount } = await this.pool.query(
      `SELECT 1 FROM user_groups ug JOIN groups g ON g.id = ug.group_id
       WHERE ug.user_id = $1 AND lower(g.name) = 'developers'`,
      [userId],
    );
    if (rowCount === 0) {
      throw new ForbiddenException("chỉ nhóm Developers xem được tài liệu này");
    }
    const content = existsSync(DOCS_PATH)
      ? readFileSync(DOCS_PATH, "utf8")
      : "# Tài liệu tích hợp\n\n(Chưa cấu hình DOCS_INTEGRATION_PATH.)";
    return { content };
  }
}
