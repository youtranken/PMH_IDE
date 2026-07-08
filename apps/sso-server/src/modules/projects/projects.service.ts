import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Pool } from "pg";
import type { AdminContext } from "../../common/admin/admin.types";
import { AuditService } from "../../common/audit.service";
import { PG_POOL } from "../../database/database.module";

export interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  created_at: Date;
}

/**
 * Project + bổ nhiệm project_admin (E5-S4/S7, FR-22/25). Chỉ SSA tạo/sửa
 * project (guard ở controller). Bổ nhiệm = vai project_admin (admin_roles) +
 * phạm vi (admin_projects) — nguồn cho mọi kiểm phạm vi ở Epic 4/5/6.
 */
@Injectable()
export class ProjectsService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly audit: AuditService,
  ) {}

  list(): Promise<ProjectRow[]> {
    return this.pool
      .query<ProjectRow>(
        `SELECT id, name, description, created_at FROM projects ORDER BY name`,
      )
      .then((r) => r.rows);
  }

  /** Dự án theo phạm vi admin: SSA → tất cả; project_admin → chỉ dự án được gán. */
  listForAdmin(admin: AdminContext): Promise<ProjectRow[]> {
    if (admin.isSsa) return this.list();
    if (admin.projectIds.length === 0) return Promise.resolve([]);
    return this.pool
      .query<ProjectRow>(
        `SELECT id, name, description, created_at FROM projects
         WHERE id = ANY($1) ORDER BY name`,
        [admin.projectIds],
      )
      .then((r) => r.rows);
  }

  async get(id: string): Promise<ProjectRow> {
    const { rows } = await this.pool.query<ProjectRow>(
      `SELECT id, name, description, created_at FROM projects WHERE id = $1`,
      [id],
    );
    if (rows.length === 0) throw new NotFoundException("project không tồn tại");
    return rows[0];
  }

  /**
   * Tổng hợp cho màn "Dự án & Ứng dụng" (cây xổ): mỗi dự án kèm ứng dụng, nhóm
   * được vào của từng app, và danh sách QTDA — để nhìn lướt là biết ngay, không
   * phải mở modal từng cái. Theo phạm vi admin (SSA tất cả, project_admin dự án mình).
   */
  async overview(admin: AdminContext): Promise<
    (ProjectRow & {
      admins: { user_id: string; full_name: string }[];
      apps: {
        id: string; client_id: string; name: string; env: string;
        disabled: boolean; allow_all_groups: boolean; app_url: string | null;
        groups: { id: string; name: string }[];
      }[];
    })[]
  > {
    const projects = await this.listForAdmin(admin);
    if (projects.length === 0) return [];
    const ids = projects.map((p) => p.id);

    const { rows: clients } = await this.pool.query<{
      id: string; project_id: string; client_id: string; name: string;
      env: string; disabled: boolean; allow_all_groups: boolean; app_url: string | null;
    }>(
      `SELECT id, project_id, client_id, name, env, disabled, allow_all_groups, app_url
       FROM clients WHERE project_id = ANY($1) ORDER BY name`,
      [ids],
    );
    const clientPks = clients.map((c) => c.id);

    const cgroups = clientPks.length
      ? (
          await this.pool.query<{ client_id: string; group_id: string; name: string }>(
            `SELECT cg.client_id, g.id AS group_id, g.name
             FROM client_groups cg JOIN groups g ON g.id = cg.group_id
             WHERE cg.client_id = ANY($1) ORDER BY g.name`,
            [clientPks],
          )
        ).rows
      : [];

    const { rows: admins } = await this.pool.query<{
      project_id: string; user_id: string; full_name: string;
    }>(
      `SELECT ap.project_id, u.id AS user_id, u.full_name
       FROM admin_projects ap JOIN users u ON u.id = ap.user_id
       WHERE ap.project_id = ANY($1) AND u.deleted_at IS NULL AND u.is_breakglass = false
       ORDER BY u.full_name`,
      [ids],
    );

    const groupsByClient: Record<string, { id: string; name: string }[]> = {};
    for (const g of cgroups)
      (groupsByClient[g.client_id] ??= []).push({ id: g.group_id, name: g.name });
    const adminsByProject: Record<string, { user_id: string; full_name: string }[]> = {};
    for (const a of admins)
      (adminsByProject[a.project_id] ??= []).push({ user_id: a.user_id, full_name: a.full_name });
    const appsByProject: Record<string, typeof clients> = {};
    for (const c of clients) (appsByProject[c.project_id] ??= []).push(c);

    return projects.map((p) => ({
      ...p,
      admins: adminsByProject[p.id] ?? [],
      apps: (appsByProject[p.id] ?? []).map((c) => ({
        ...c,
        groups: groupsByClient[c.id] ?? [],
      })),
    }));
  }

  async create(
    name: string,
    description: string | null,
    actorUserId: string,
    ip: string | null,
  ): Promise<ProjectRow> {
    try {
      const { rows } = await this.pool.query<ProjectRow>(
        `INSERT INTO projects (name, description) VALUES ($1, $2)
         RETURNING id, name, description, created_at`,
        [name.trim(), description?.trim() ?? null],
      );
      await this.audit.record({
        actorUserId,
        action: "project.created",
        targetType: "project",
        targetId: rows[0].id,
        projectId: rows[0].id,
        ip,
        detail: { name },
      });
      return rows[0];
    } catch (e) {
      if ((e as { code?: string }).code === "23505") {
        throw new ConflictException("tên project đã tồn tại");
      }
      throw e;
    }
  }

  async update(
    id: string,
    input: { name?: string; description?: string },
    actorUserId: string,
    ip: string | null,
  ): Promise<ProjectRow> {
    await this.get(id);
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (input.name !== undefined) {
      sets.push(`name = $${++i}`);
      vals.push(input.name.trim());
    }
    if (input.description !== undefined) {
      sets.push(`description = $${++i}`);
      vals.push(input.description.trim());
    }
    if (sets.length === 0) return this.get(id);
    try {
      const { rows } = await this.pool.query<ProjectRow>(
        `UPDATE projects SET ${sets.join(", ")} WHERE id = $1
         RETURNING id, name, description, created_at`,
        [id, ...vals],
      );
      await this.audit.record({
        actorUserId,
        action: "project.updated",
        targetType: "project",
        targetId: id,
        projectId: id,
        ip,
        detail: input,
      });
      return rows[0];
    } catch (e) {
      if ((e as { code?: string }).code === "23505") {
        throw new ConflictException("tên project đã tồn tại");
      }
      throw e;
    }
  }

  /**
   * Xóa dự án (SSA). CHẶN nếu còn ứng dụng — tránh xóa nhầm hàng loạt qua cascade
   * (clients ON DELETE CASCADE). Cascade tự gỡ admin_projects; sau đó dọn vai
   * project_admin cho ai không còn dự án nào. Audit không gắn projectId (dự án đã
   * biến mất → tránh vi phạm FK, giữ tên trong detail).
   */
  async remove(
    id: string,
    actorUserId: string,
    ip: string | null,
  ): Promise<{ ok: true }> {
    const project = await this.get(id); // 404 nếu không có
    const { rows: cnt } = await this.pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM clients WHERE project_id = $1`,
      [id],
    );
    if (cnt[0].n > 0) {
      throw new ConflictException(
        "dự án còn ứng dụng — xóa hết ứng dụng trước khi xóa dự án",
      );
    }
    const { rows: admins } = await this.pool.query<{ user_id: string }>(
      `SELECT user_id FROM admin_projects WHERE project_id = $1`,
      [id],
    );
    await this.pool.query(`DELETE FROM projects WHERE id = $1`, [id]);
    // Dọn vai project_admin mồ côi (mất dự án cuối cùng) — như removeAdmin.
    for (const a of admins) {
      const { rowCount } = await this.pool.query(
        `SELECT 1 FROM admin_projects WHERE user_id = $1`,
        [a.user_id],
      );
      if (rowCount === 0) {
        await this.pool.query(
          `DELETE FROM admin_roles WHERE user_id = $1 AND role = 'project_admin'`,
          [a.user_id],
        );
      }
    }
    await this.audit.record({
      actorUserId,
      action: "project.deleted",
      targetType: "project",
      targetId: id,
      ip,
      detail: { name: project.name },
    });
    return { ok: true };
  }

  async listAdmins(
    projectId: string,
  ): Promise<{ user_id: string; email: string; full_name: string }[]> {
    await this.get(projectId);
    const { rows } = await this.pool.query<{
      user_id: string;
      email: string;
      full_name: string;
    }>(
      `SELECT u.id AS user_id, u.email, u.full_name
       FROM admin_projects ap JOIN users u ON u.id = ap.user_id
       WHERE ap.project_id = $1 AND u.deleted_at IS NULL AND u.is_breakglass = false
       ORDER BY u.full_name`,
      [projectId],
    );
    return rows;
  }

  /** Bổ nhiệm user làm project_admin của project (SSA). */
  async appointAdmin(
    projectId: string,
    userId: string,
    actorUserId: string,
    ip: string | null,
  ): Promise<void> {
    await this.get(projectId);
    const { rowCount } = await this.pool.query(
      // is_breakglass = false: không cho bổ nhiệm tài khoản khẩn cấp làm QTDA
      // (vừa lộ nó qua listAdmins, vừa gán vai đứng-tên ngoài ý muốn).
      `SELECT 1 FROM users WHERE id = $1 AND deleted_at IS NULL AND is_breakglass = false`,
      [userId],
    );
    if (rowCount === 0) throw new NotFoundException("user không tồn tại");

    await this.pool.query(
      `INSERT INTO admin_roles (user_id, role) VALUES ($1, 'project_admin')
       ON CONFLICT DO NOTHING`,
      [userId],
    );
    await this.pool.query(
      `INSERT INTO admin_projects (user_id, project_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [userId, projectId],
    );
    await this.audit.record({
      actorUserId,
      action: "project.admin_appointed",
      targetType: "user",
      targetId: userId,
      projectId,
      ip,
    });
  }

  /** Gỡ project_admin khỏi project; hết project thì bỏ luôn vai (giữ 'ssa'). */
  async removeAdmin(
    projectId: string,
    userId: string,
    actorUserId: string,
    ip: string | null,
  ): Promise<void> {
    await this.pool.query(
      `DELETE FROM admin_projects WHERE user_id = $1 AND project_id = $2`,
      [userId, projectId],
    );
    const { rowCount } = await this.pool.query(
      `SELECT 1 FROM admin_projects WHERE user_id = $1`,
      [userId],
    );
    if (rowCount === 0) {
      await this.pool.query(
        `DELETE FROM admin_roles WHERE user_id = $1 AND role = 'project_admin'`,
        [userId],
      );
    }
    await this.audit.record({
      actorUserId,
      action: "project.admin_removed",
      targetType: "user",
      targetId: userId,
      projectId,
      ip,
    });
  }
}
