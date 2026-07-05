import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Pool } from "pg";
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

  async get(id: string): Promise<ProjectRow> {
    const { rows } = await this.pool.query<ProjectRow>(
      `SELECT id, name, description, created_at FROM projects WHERE id = $1`,
      [id],
    );
    if (rows.length === 0) throw new NotFoundException("project không tồn tại");
    return rows[0];
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
       WHERE ap.project_id = $1 AND u.deleted_at IS NULL
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
      `SELECT 1 FROM users WHERE id = $1 AND deleted_at IS NULL`,
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
