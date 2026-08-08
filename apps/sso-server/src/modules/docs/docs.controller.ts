import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Param,
  UseGuards,
} from "@nestjs/common";
import { Pool } from "pg";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { UserGuard } from "../../common/auth/user.guard";
import { PG_POOL } from "../../database/database.module";

// Nguồn tài liệu người dùng theo dự án: docs-content/<client_id>/*.md
// (dev: mount docs/projects; prod: COPY docs/projects → docs-content trong image).
const DOCS_CONTENT_DIR =
  process.env.DOCS_CONTENT_DIR ?? join(process.cwd(), "docs-content");
// Chặn path-traversal: client_id chỉ chữ/số/gạch (khớp định dạng client_id OIDC).
const CLIENT_ID_RE = /^[A-Za-z0-9_-]+$/;

interface DocItem {
  slug: string;
  title: string;
  content: string;
  audience: "admin" | "user";
}

/**
 * Cổng tài liệu người dùng theo DỰ ÁN. Mọi member (UserGuard) đều vào được cổng,
 * nhưng chỉ lấy được tài liệu của dự án mình CÓ QUYỀN (cùng vị từ /api/me/apps:
 * allow_all_groups hoặc thuộc group của client) — không đọc trộm docs dự án khác.
 * Tài liệu tích hợp kỹ thuật (OIDC/webhook/API) KHÔNG thuộc cổng này.
 */
@Controller("docs")
@UseGuards(UserGuard)
export class DocsController {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  @Get(":clientId")
  async projectDocs(
    @CurrentUser() userId: string,
    @Param("clientId") clientId: string,
  ): Promise<{ documents: DocItem[] }> {
    if (!CLIENT_ID_RE.test(clientId)) {
      throw new BadRequestException("client_id không hợp lệ");
    }
    const { rowCount } = await this.pool.query(
      `SELECT 1 FROM clients c
       WHERE c.client_id = $2 AND NOT c.disabled
         AND ( c.allow_all_groups
               OR EXISTS (
                 SELECT 1 FROM client_groups cg
                 JOIN user_groups ug ON ug.group_id = cg.group_id
                 WHERE cg.client_id = c.id AND ug.user_id = $1) )`,
      [userId, clientId],
    );
    if (rowCount === 0) {
      throw new ForbiddenException("bạn không có quyền xem tài liệu dự án này");
    }
    // Admin của DỰ ÁN = SSA (toàn hệ) HOẶC project_admin của project sở hữu client
    // này. Chỉ họ mới thấy tài liệu admin-*.md; member thường chỉ thấy user-*/không tiền tố.
    const { rowCount: adm } = await this.pool.query(
      `SELECT 1 WHERE
         EXISTS (SELECT 1 FROM admin_roles r WHERE r.user_id = $1 AND r.role = 'ssa')
         OR EXISTS (SELECT 1 FROM admin_projects ap
                    JOIN clients c ON c.project_id = ap.project_id
                    WHERE ap.user_id = $1 AND c.client_id = $2)`,
      [userId, clientId],
    );
    const isProjectAdmin = (adm ?? 0) > 0;
    const documents = readProjectDocs(clientId).filter(
      (d) => isProjectAdmin || d.audience === "user",
    );
    return { documents };
  }
}

/** Đọc mọi *.md trong docs-content/<clientId>/ (sắp theo tên file). Title = dòng
 *  `# …` đầu, fallback tên file. Thiếu thư mục / không có .md → [] (FE: "chờ cập nhật"). */
export function readProjectDocs(clientId: string): DocItem[] {
  const dir = join(DOCS_CONTENT_DIR, clientId);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];
  return readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".md"))
    .sort()
    .map((f) => {
      const content = readFileSync(join(dir, f), "utf8");
      const h1 = content.match(/^#\s+(.+)$/m);
      const fallback = f.replace(/\.md$/i, "");
      // Tiền tố tên file phân đối tượng: admin-*.md = chỉ quản trị; còn lại
      // (user-*.md hoặc không tiền tố) = mọi thành viên dự án.
      const audience: DocItem["audience"] = /^admin-/i.test(f) ? "admin" : "user";
      return { slug: fallback, title: (h1?.[1] ?? fallback).trim(), content, audience };
    });
}
