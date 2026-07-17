import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Pool } from "pg";
import type { AdminContext } from "../../common/admin/admin.types";
import { AuditService } from "../../common/audit.service";
import { SessionRevocationService } from "../../common/session-revocation.service";
import { UserEventsService } from "../../common/user-events.service";
import { PG_POOL } from "../../database/database.module";

export interface GroupRow {
  id: string;
  name: string;
  description: string | null;
  created_at: Date;
}

/**
 * Group CRUD + thành viên (E5-S1/S2, FR-19/20). Group TOÀN CỤC (không thuộc
 * project) — chỉ có nghĩa truy cập khi gán cho client (client_groups, E5-S3).
 * SSA quản mọi group; project_admin chỉ group đang gán cho client trong project
 * mình. Gỡ member bởi project_admin → thu hồi phiên phạm vi project (FR-05).
 */
@Injectable()
export class GroupsService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly audit: AuditService,
    private readonly revocation: SessionRevocationService,
    private readonly events: UserEventsService,
  ) {}

  list(): Promise<GroupRow[]> {
    return this.pool
      .query<GroupRow>(
        `SELECT id, name, description, created_at FROM groups ORDER BY name`,
      )
      .then((r) => r.rows);
  }

  /**
   * Map group_id → tên các ứng dụng mà nhóm đó MỞ QUYỀN vào (qua client_groups,
   * client còn bật). Dùng ở màn Tạo user: chọn nhóm là thấy ngay "vào được app nào".
   */
  async accessMap(): Promise<Record<string, string[]>> {
    const { rows } = await this.pool.query<{ group_id: string; app_name: string }>(
      `SELECT cg.group_id, c.name AS app_name
       FROM client_groups cg JOIN clients c ON c.id = cg.client_id
       WHERE c.disabled = false
       ORDER BY c.name`,
    );
    const map: Record<string, string[]> = {};
    for (const r of rows) (map[r.group_id] ??= []).push(r.app_name);
    return map;
  }

  async get(id: string): Promise<GroupRow> {
    const { rows } = await this.pool.query<GroupRow>(
      `SELECT id, name, description, created_at FROM groups WHERE id = $1`,
      [id],
    );
    if (rows.length === 0) throw new NotFoundException("group không tồn tại");
    return rows[0];
  }

  async create(
    name: string,
    description: string | null,
    actorUserId: string,
    ip: string | null,
  ): Promise<GroupRow & { warning?: string }> {
    try {
      const { rows } = await this.pool.query<GroupRow>(
        `INSERT INTO groups (name, description) VALUES ($1, $2)
         RETURNING id, name, description, created_at`,
        [name.trim(), description?.trim() ?? null],
      );
      // E5-S3: client bật allow_all_groups sẽ TỰ thấy group mới này (nới LOGIN)
      // → cảnh báo + ghi audit để không vô tình mở quyền đăng nhập.
      const { rows: aa } = await this.pool.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM clients
         WHERE allow_all_groups AND NOT disabled`,
      );
      const allowAllCount = Number.parseInt(aa[0].n, 10);
      await this.audit.record({
        actorUserId,
        action: "group.created",
        targetType: "group",
        targetId: rows[0].id,
        ip,
        detail: { name, allow_all_clients_notified: allowAllCount },
      });
      return allowAllCount > 0
        ? {
            ...rows[0],
            warning: `${allowAllCount} client đang bật "cho tất cả group" sẽ tự cho phép group này đăng nhập.`,
          }
        : rows[0];
    } catch (e) {
      if ((e as { code?: string }).code === "23505") {
        throw new ConflictException("tên group đã tồn tại");
      }
      throw e;
    }
  }

  async update(
    id: string,
    input: { name?: string; description?: string },
    actorUserId: string,
    ip: string | null,
  ): Promise<GroupRow> {
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
      const { rows } = await this.pool.query<GroupRow>(
        `UPDATE groups SET ${sets.join(", ")} WHERE id = $1
         RETURNING id, name, description, created_at`,
        [id, ...vals],
      );
      await this.audit.record({
        actorUserId,
        action: "group.updated",
        targetType: "group",
        targetId: id,
        ip,
        detail: input,
      });
      return rows[0];
    } catch (e) {
      if ((e as { code?: string }).code === "23505") {
        throw new ConflictException("tên group đã tồn tại");
      }
      throw e;
    }
  }

  /** get() có kiểm phạm vi project_admin (như addMember) — cho endpoint đọc. */
  async getScoped(id: string, admin: AdminContext): Promise<GroupRow> {
    await this.assertCanManage(admin, id);
    return this.get(id);
  }

  async listMembers(
    groupId: string,
    admin: AdminContext,
  ): Promise<{ user_id: string; email: string; full_name: string }[]> {
    await this.assertCanManage(admin, groupId);
    const { rows } = await this.pool.query<{
      user_id: string;
      email: string;
      full_name: string;
    }>(
      `SELECT u.id AS user_id, u.email, u.full_name
       FROM user_groups ug JOIN users u ON u.id = ug.user_id
       WHERE ug.group_id = $1 AND u.deleted_at IS NULL
       ORDER BY u.full_name`,
      [groupId],
    );
    return rows;
  }

  async addMember(
    groupId: string,
    userId: string,
    admin: AdminContext,
    ip: string | null,
  ): Promise<void> {
    await this.assertCanManage(admin, groupId);
    const { rowCount } = await this.pool.query(
      `SELECT 1 FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [userId],
    );
    if (rowCount === 0) throw new NotFoundException("user không tồn tại");
    await this.pool.query(
      `INSERT INTO user_groups (user_id, group_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [userId, groupId],
    );
    await this.events.emit(userId, "user.groups_changed", {
      added: groupId,
    });
    await this.audit.record({
      actorUserId: admin.userId,
      action: "group.member_added",
      targetType: "group",
      targetId: groupId,
      ip,
      detail: { user_id: userId },
    });
  }

  /** Gỡ member; project_admin gỡ → thu hồi phiên user trên client của project mình. */
  async removeMember(
    groupId: string,
    userId: string,
    admin: AdminContext,
    ip: string | null,
  ): Promise<{ revoked: number }> {
    await this.assertCanManage(admin, groupId);
    await this.pool.query(
      `DELETE FROM user_groups WHERE user_id = $1 AND group_id = $2`,
      [userId, groupId],
    );
    await this.events.emit(userId, "user.groups_changed", {
      removed: groupId,
    });
    const revoked = admin.isSsa
      ? await this.revocation.revokeAllForUser(userId)
      : await this.revocation.revokeForUserInProjects(userId, admin.projectIds);
    await this.audit.record({
      actorUserId: admin.userId,
      action: "group.member_removed",
      targetType: "group",
      targetId: groupId,
      ip,
      detail: { user_id: userId, revoked },
    });
    return { revoked };
  }

  /**
   * project_admin chỉ được đụng group ĐANG gán cho client thuộc project mình
   * (E5-S2). SSA bỏ qua. Group dùng chung nhiều project → admin các project đó
   * đều sửa được.
   */
  private async assertCanManage(
    admin: AdminContext,
    groupId: string,
  ): Promise<void> {
    await this.get(groupId);
    if (admin.isSsa) return;
    const { rowCount } = await this.pool.query(
      `SELECT 1 FROM client_groups cg JOIN clients c ON c.id = cg.client_id
       WHERE cg.group_id = $1 AND c.project_id = ANY($2::uuid[]) LIMIT 1`,
      [groupId, admin.projectIds],
    );
    if (rowCount === 0) {
      throw new ForbiddenException(
        "group không thuộc phạm vi project của bạn",
      );
    }
  }
}
