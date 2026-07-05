import { randomBytes } from "node:crypto";
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import * as argon2 from "argon2";
import { Pool } from "pg";
import type { AdminContext } from "../../common/admin/admin.types";
import { AuditService } from "../../common/audit.service";
import { SettingsService } from "../../config/settings.service";
import { PG_POOL } from "../../database/database.module";

export interface ClientRow {
  id: string;
  project_id: string;
  client_id: string;
  name: string;
  env: string;
  redirect_uris: string[];
  app_url: string | null;
  allow_all_groups: boolean;
  disabled: boolean;
  created_at: Date;
}

const CLIENT_COLS =
  "id, project_id, client_id, name, env, redirect_uris, app_url, allow_all_groups, disabled, created_at";

/**
 * client_id dành riêng cho client TĨNH của provider (demo-app, pmh-portal). Tạo
 * DB client trùng sẽ làm cổng login (isAllowedForClient coi "có trong bảng
 * clients" = cần group) chặn nhầm portal → khóa admin ngoài. Cấm ở tạo.
 */
const RESERVED_CLIENT_IDS = new Set(["pmh-portal", "demo-app"]);

/**
 * Client CRUD + client_secret + client_groups (E5-S5/S6/S3). Secret dev sinh,
 * HIỆN MỘT LẦN, lưu HASH (AD-11). Rotate = thêm active + đặt cũ retiring có hạn
 * (AD-12). oidc-provider dùng internal secret KEK-derived (Path A) — không thấy
 * secret dev. project_admin chỉ đụng client trong project mình.
 */
@Injectable()
export class ClientsService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
  ) {}

  private genSecret(): string {
    return randomBytes(32).toString("base64url");
  }

  private scopeClause(admin: AdminContext, param: string): string {
    return admin.isSsa ? "TRUE" : `project_id = ANY(${param}::uuid[])`;
  }

  async list(admin: AdminContext): Promise<ClientRow[]> {
    const { rows } = await this.pool.query<ClientRow>(
      `SELECT ${CLIENT_COLS} FROM clients
       WHERE ${this.scopeClause(admin, "$1")} ORDER BY created_at DESC`,
      admin.isSsa ? [] : [admin.projectIds],
    );
    return rows;
  }

  /** Lấy client + kiểm phạm vi (project_admin chỉ project mình). */
  async getScoped(id: string, admin: AdminContext): Promise<ClientRow> {
    const { rows } = await this.pool.query<ClientRow>(
      `SELECT ${CLIENT_COLS} FROM clients WHERE id = $1`,
      [id],
    );
    if (rows.length === 0) throw new NotFoundException("client không tồn tại");
    const c = rows[0];
    if (!admin.isSsa && !admin.projectIds.includes(c.project_id)) {
      throw new ForbiddenException("client ngoài phạm vi project của bạn");
    }
    return c;
  }

  async create(
    input: {
      projectId: string;
      clientId: string;
      name: string;
      env: string;
      redirectUris: string[];
      appUrl?: string;
    },
    admin: AdminContext,
    ip: string | null,
  ): Promise<{ client: ClientRow; secret: string }> {
    if (!admin.isSsa && !admin.projectIds.includes(input.projectId)) {
      throw new ForbiddenException("project ngoài phạm vi của bạn");
    }
    if (RESERVED_CLIENT_IDS.has(input.clientId.trim())) {
      throw new ConflictException("client_id này dành riêng cho hệ thống");
    }
    const secret = this.genSecret();
    const hash = await argon2.hash(secret);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const { rows } = await client.query<ClientRow>(
        `INSERT INTO clients (project_id, client_id, name, env, redirect_uris, app_url)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${CLIENT_COLS}`,
        [
          input.projectId,
          input.clientId.trim(),
          input.name.trim(),
          input.env,
          input.redirectUris,
          input.appUrl?.trim() ?? null,
        ],
      );
      await client.query(
        `INSERT INTO client_secrets (client_id, secret_hash, status)
         VALUES ($1, $2, 'active')`,
        [rows[0].id, hash],
      );
      await client.query("COMMIT");
      await this.audit.record({
        actorUserId: admin.userId,
        action: "client.created",
        targetType: "client",
        targetId: rows[0].id,
        projectId: input.projectId,
        ip,
        detail: { client_id: input.clientId, env: input.env },
      });
      return { client: rows[0], secret };
    } catch (e) {
      await client.query("ROLLBACK");
      if ((e as { code?: string }).code === "23505") {
        throw new ConflictException("client_id đã tồn tại");
      }
      throw e;
    } finally {
      client.release();
    }
  }

  async update(
    id: string,
    input: { name?: string; redirectUris?: string[]; appUrl?: string },
    admin: AdminContext,
    ip: string | null,
  ): Promise<ClientRow> {
    await this.getScoped(id, admin);
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (input.name !== undefined) {
      sets.push(`name = $${++i}`);
      vals.push(input.name.trim());
    }
    if (input.redirectUris !== undefined) {
      sets.push(`redirect_uris = $${++i}`);
      vals.push(input.redirectUris);
    }
    if (input.appUrl !== undefined) {
      sets.push(`app_url = $${++i}`);
      vals.push(input.appUrl.trim());
    }
    if (sets.length === 0) return this.getScoped(id, admin);
    const { rows } = await this.pool.query<ClientRow>(
      `UPDATE clients SET ${sets.join(", ")} WHERE id = $1 RETURNING ${CLIENT_COLS}`,
      [id, ...vals],
    );
    await this.audit.record({
      actorUserId: admin.userId,
      action: "client.updated",
      targetType: "client",
      targetId: id,
      projectId: rows[0].project_id,
      ip,
      detail: input as Record<string, unknown>,
    });
    return rows[0];
  }

  /** Bật/tắt client — disabled = oidc-provider coi như không tồn tại (chặn token mới). */
  async setDisabled(
    id: string,
    disabled: boolean,
    admin: AdminContext,
    ip: string | null,
  ): Promise<ClientRow> {
    const c = await this.getScoped(id, admin);
    const { rows } = await this.pool.query<ClientRow>(
      `UPDATE clients SET disabled = $2 WHERE id = $1 RETURNING ${CLIENT_COLS}`,
      [id, disabled],
    );
    await this.audit.record({
      actorUserId: admin.userId,
      action: disabled ? "client.disabled" : "client.enabled",
      targetType: "client",
      targetId: id,
      projectId: c.project_id,
      ip,
    });
    return rows[0];
  }

  // ---- secret (E5-S6) ----

  async listSecrets(
    id: string,
    admin: AdminContext,
  ): Promise<
    {
      id: string;
      status: string;
      created_at: Date;
      expires_at: Date | null;
      revoked_at: Date | null;
    }[]
  > {
    await this.getScoped(id, admin);
    const { rows } = await this.pool.query(
      `SELECT id, status, created_at, expires_at, revoked_at
       FROM client_secrets WHERE client_id = $1 ORDER BY created_at DESC`,
      [id],
    );
    return rows;
  }

  /** Rotate: secret mới active; secret active cũ → retiring có hạn ân hạn (AD-12). */
  async rotateSecret(
    id: string,
    admin: AdminContext,
    ip: string | null,
  ): Promise<{ secret: string; graceHours: number }> {
    const c = await this.getScoped(id, admin);
    const graceHours = await this.settings.getInt("client_secret_grace_hours", 48);
    const secret = this.genSecret();
    const hash = await argon2.hash(secret);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `UPDATE client_secrets
         SET status = 'retiring', retiring_at = now(),
             expires_at = now() + make_interval(hours => $2)
         WHERE client_id = $1 AND status = 'active'`,
        [id, graceHours],
      );
      await client.query(
        `INSERT INTO client_secrets (client_id, secret_hash, status)
         VALUES ($1, $2, 'active')`,
        [id, hash],
      );
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
    await this.audit.record({
      actorUserId: admin.userId,
      action: "client.secret_rotated",
      targetType: "client",
      targetId: id,
      projectId: c.project_id,
      ip,
      detail: { grace_hours: graceHours },
    });
    return { secret, graceHours };
  }

  /** Thu hồi NGAY một secret (lộ) — giữ dấu vết revoked_at (AD-12). */
  async revokeSecret(
    id: string,
    secretId: string,
    admin: AdminContext,
    ip: string | null,
  ): Promise<void> {
    const c = await this.getScoped(id, admin);
    const { rowCount } = await this.pool.query(
      `UPDATE client_secrets SET status = 'revoked', revoked_at = now()
       WHERE id = $1 AND client_id = $2 AND status <> 'revoked'`,
      [secretId, id],
    );
    if (rowCount === 0) {
      throw new NotFoundException("secret không tồn tại hoặc đã thu hồi");
    }
    await this.audit.record({
      actorUserId: admin.userId,
      action: "client.secret_revoked",
      targetType: "client",
      targetId: id,
      projectId: c.project_id,
      ip,
      detail: { secret_id: secretId },
    });
  }

  // ---- client_groups (E5-S3) ----

  async listGroups(
    id: string,
    admin: AdminContext,
  ): Promise<{ group_id: string; name: string }[]> {
    await this.getScoped(id, admin);
    const { rows } = await this.pool.query<{ group_id: string; name: string }>(
      `SELECT g.id AS group_id, g.name
       FROM client_groups cg JOIN groups g ON g.id = cg.group_id
       WHERE cg.client_id = $1 ORDER BY g.name`,
      [id],
    );
    return rows;
  }

  async addGroup(
    id: string,
    groupId: string,
    admin: AdminContext,
    ip: string | null,
  ): Promise<void> {
    const c = await this.getScoped(id, admin);
    const { rowCount } = await this.pool.query(
      `SELECT 1 FROM groups WHERE id = $1`,
      [groupId],
    );
    if (rowCount === 0) throw new NotFoundException("group không tồn tại");
    await this.pool.query(
      `INSERT INTO client_groups (client_id, group_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [id, groupId],
    );
    await this.audit.record({
      actorUserId: admin.userId,
      action: "client.group_added",
      targetType: "client",
      targetId: id,
      projectId: c.project_id,
      ip,
      detail: { group_id: groupId },
    });
  }

  async removeGroup(
    id: string,
    groupId: string,
    admin: AdminContext,
    ip: string | null,
  ): Promise<void> {
    const c = await this.getScoped(id, admin);
    await this.pool.query(
      `DELETE FROM client_groups WHERE client_id = $1 AND group_id = $2`,
      [id, groupId],
    );
    await this.audit.record({
      actorUserId: admin.userId,
      action: "client.group_removed",
      targetType: "client",
      targetId: id,
      projectId: c.project_id,
      ip,
      detail: { group_id: groupId },
    });
  }

  /** Bật/tắt allow_all_groups — nới quyền LOGIN, KHÔNG nới scope Directory (AD-11). */
  async setAllowAll(
    id: string,
    allowAll: boolean,
    admin: AdminContext,
    ip: string | null,
  ): Promise<ClientRow> {
    const c = await this.getScoped(id, admin);
    const { rows } = await this.pool.query<ClientRow>(
      `UPDATE clients SET allow_all_groups = $2 WHERE id = $1 RETURNING ${CLIENT_COLS}`,
      [id, allowAll],
    );
    await this.audit.record({
      actorUserId: admin.userId,
      action: "client.allow_all_set",
      targetType: "client",
      targetId: id,
      projectId: c.project_id,
      ip,
      detail: { allow_all_groups: allowAll },
    });
    return rows[0];
  }
}
