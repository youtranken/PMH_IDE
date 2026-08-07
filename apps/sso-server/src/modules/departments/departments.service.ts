import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Pool } from "pg";
import { AuditService } from "../../common/audit.service";
import { PG_POOL } from "../../database/database.module";

export interface DepartmentRow {
  id: string;
  name: string;
  created_at: Date;
  user_count?: number; // số user đang gắn phòng ban này (theo tên)
}

/**
 * Danh mục Phòng ban (Department) — nhãn tổ chức, KHÁC nhóm quyền. Chỉ là danh
 * sách tên để chọn khi tạo/sửa user (users.department lưu tên dạng text). Không
 * cho xóa phòng ban đang có user để tránh treo nhãn không còn trong danh mục.
 */
@Injectable()
export class DepartmentsService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<DepartmentRow[]> {
    const { rows } = await this.pool.query<DepartmentRow>(
      `SELECT d.id, d.name, d.created_at,
              (SELECT count(*)::int FROM users u
               WHERE lower(u.department) = lower(d.name)) AS user_count
       FROM departments d ORDER BY d.name`,
    );
    return rows;
  }

  async create(
    name: string,
    actorUserId: string,
    ip: string | null,
  ): Promise<DepartmentRow> {
    const trimmed = name.trim();
    if (!trimmed) throw new ConflictException("tên phòng ban trống");
    try {
      const { rows } = await this.pool.query<DepartmentRow>(
        `INSERT INTO departments (name) VALUES ($1)
         RETURNING id, name, created_at`,
        [trimmed],
      );
      await this.audit.record({
        actorUserId,
        action: "department.created",
        targetType: "department",
        targetId: rows[0].id,
        ip,
        detail: { name: trimmed },
      });
      return rows[0];
    } catch (e) {
      if ((e as { code?: string }).code === "23505") {
        throw new ConflictException("tên phòng ban đã tồn tại");
      }
      throw e;
    }
  }

  async remove(
    id: string,
    actorUserId: string,
    ip: string | null,
  ): Promise<{ ok: true }> {
    const { rows } = await this.pool.query<{ name: string }>(
      `SELECT name FROM departments WHERE id = $1`,
      [id],
    );
    if (rows.length === 0) throw new NotFoundException("phòng ban không tồn tại");
    const name = rows[0].name;
    // Chặn xóa phòng ban đang gắn cho user (theo tên) — tránh để user treo nhãn
    // không còn trong danh mục. Admin phải chuyển user sang phòng ban khác trước.
    const { rows: used } = await this.pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM users WHERE lower(department) = lower($1)`,
      [name],
    );
    if (used[0].n > 0) {
      throw new ConflictException(
        `còn ${used[0].n} user thuộc phòng ban này — chuyển họ sang phòng ban khác trước khi xóa`,
      );
    }
    await this.pool.query(`DELETE FROM departments WHERE id = $1`, [id]);
    await this.audit.record({
      actorUserId,
      action: "department.deleted",
      targetType: "department",
      targetId: id,
      ip,
      detail: { name },
    });
    return { ok: true };
  }

  /**
   * Đổi TÊN phòng ban + CASCADE cập nhật users.department (lưu tên text, KHÔNG FK)
   * trong CÙNG transaction — tránh user treo tên cũ. Đổi hoa/thường cũng được.
   */
  async rename(
    id: string,
    name: string,
    actorUserId: string,
    ip: string | null,
  ): Promise<DepartmentRow> {
    const trimmed = name.trim();
    if (!trimmed) throw new ConflictException("tên phòng ban trống");
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const { rows: cur } = await client.query<{ name: string }>(
        `SELECT name FROM departments WHERE id = $1 FOR UPDATE`,
        [id],
      );
      if (cur.length === 0) throw new NotFoundException("phòng ban không tồn tại");
      const oldName = cur[0].name;
      // Trùng tên (khác id) — tôn trọng UNIQUE lower(name)
      const { rows: dup } = await client.query<{ id: string }>(
        `SELECT id FROM departments WHERE lower(name) = lower($1) AND id <> $2`,
        [trimmed, id],
      );
      if (dup.length > 0) throw new ConflictException("tên phòng ban đã tồn tại");
      const { rows: updated } = await client.query<DepartmentRow>(
        `UPDATE departments SET name = $2 WHERE id = $1
         RETURNING id, name, created_at`,
        [id, trimmed],
      );
      const upd = await client.query(
        `UPDATE users SET department = $2 WHERE lower(department) = lower($1)`,
        [oldName, trimmed],
      );
      await client.query("COMMIT");
      await this.audit.record({
        actorUserId,
        action: "department.renamed",
        targetType: "department",
        targetId: id,
        ip,
        detail: { from: oldName, to: trimmed, users_updated: upd.rowCount ?? 0 },
      });
      return updated[0];
    } catch (e) {
      await client.query("ROLLBACK");
      if ((e as { code?: string }).code === "23505") {
        throw new ConflictException("tên phòng ban đã tồn tại");
      }
      throw e;
    } finally {
      client.release();
    }
  }

  /**
   * Trả TÊN CHUẨN trong danh mục (đúng hoa/thường đã lưu) nếu khớp không phân
   * biệt hoa/thường; null nếu không có. Dùng để CHUẨN HÓA casing khi ghi
   * users.department → tránh "Kế toán" vs "kế toán" trôi khỏi tên danh mục.
   */
  async canonical(name: string): Promise<string | null> {
    const { rows } = await this.pool.query<{ name: string }>(
      `SELECT name FROM departments WHERE lower(name) = lower($1)`,
      [name.trim()],
    );
    return rows[0]?.name ?? null;
  }
}
