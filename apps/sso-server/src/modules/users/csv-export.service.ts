import { Inject, Injectable } from "@nestjs/common";
import { Pool } from "pg";
import { PG_POOL } from "../../database/database.module";
import type { AdminContext } from "../../common/admin/admin.types";

export interface ExportFilter {
  group?: string;
  status?: string;
}

interface ExportRow {
  employee_code: string;
  email: string;
  full_name: string;
  status: string;
  groups: string[];
}

/**
 * Xuất danh sách user ra CSV (E4-S4, FR-14). SSA xuất tất cả; project_admin chỉ
 * user TRONG PHẠM VI project mình (AD-1) — tức user đăng nhập được app của
 * project (đồ thị group→client_groups→client→project, hoặc client allow_all).
 */
@Injectable()
export class CsvExportService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async exportCsv(
    filter: ExportFilter,
    admin: AdminContext,
  ): Promise<string> {
    const where: string[] = ["u.deleted_at IS NULL"];
    const params: unknown[] = [];
    let p = 0;

    if (filter.status) {
      where.push(`u.status = $${++p}`);
      params.push(filter.status);
    }
    if (filter.group) {
      where.push(
        `EXISTS (SELECT 1 FROM user_groups ug2 JOIN groups g2 ON g2.id = ug2.group_id
                 WHERE ug2.user_id = u.id AND lower(g2.name) = lower($${++p}))`,
      );
      params.push(filter.group);
    }
    // Phạm vi project_admin (SSA bỏ qua = toàn cục)
    if (!admin.isSsa) {
      const $proj = `$${++p}`;
      params.push(admin.projectIds);
      where.push(`(
        EXISTS (SELECT 1 FROM clients c WHERE c.project_id = ANY(${$proj}::uuid[])
                AND c.allow_all_groups AND NOT c.disabled)
        OR EXISTS (
          SELECT 1 FROM user_groups ug3
          JOIN client_groups cg ON cg.group_id = ug3.group_id
          JOIN clients c3 ON c3.id = cg.client_id
          WHERE ug3.user_id = u.id AND c3.project_id = ANY(${$proj}::uuid[])
                AND NOT c3.disabled)
      )`);
    }

    const { rows } = await this.pool.query<ExportRow>(
      `SELECT u.employee_code, u.email, u.full_name, u.status,
              COALESCE(array_agg(DISTINCT g.name) FILTER (WHERE g.name IS NOT NULL), '{}') AS groups
       FROM users u
       LEFT JOIN user_groups ug ON ug.user_id = u.id
       LEFT JOIN groups g ON g.id = ug.group_id
       WHERE ${where.join(" AND ")}
       GROUP BY u.id, u.employee_code, u.email, u.full_name, u.status
       ORDER BY u.employee_code`,
      params,
    );

    const lines = ["employee_code,email,full_name,status,groups"];
    for (const r of rows) {
      lines.push(
        [
          r.employee_code,
          r.email,
          r.full_name,
          r.status,
          r.groups.join(";"),
        ]
          .map(csvCell)
          .join(","),
      );
    }
    return lines.join("\r\n");
  }
}

/**
 * Bọc ô CSV (RFC4180) + chống FORMULA INJECTION: ô mở đầu bằng = + - @ (hoặc
 * tab/CR) bị Excel/Sheets thực thi như công thức → chèn dấu ' phía trước. Dữ
 * liệu như full_name do người dùng/CSV nhập nên phải trung hòa trước khi xuất.
 */
function csvCell(v: string): string {
  const guarded = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\n\r]/.test(guarded)
    ? `"${guarded.replace(/"/g, '""')}"`
    : guarded;
}
