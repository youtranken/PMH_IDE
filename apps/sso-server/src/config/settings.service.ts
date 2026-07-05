import { Inject, Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { Pool } from "pg";
import { PG_POOL } from "../database/database.module";

/**
 * Đọc/ghi tham số vận hành runtime từ bảng `settings` (AD-15), có cache
 * in-memory. Cache invalidate khi SSA đổi giá trị (Settings page — E6-S5).
 *
 * Giá trị mặc định seed sẵn ở migration; service chỉ đọc/ghi + cache.
 */
@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);
  private cache = new Map<string, string>();
  private loaded = false;

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    const { rows } = await this.pool.query<{ key: string; value: string }>(
      "SELECT key, value FROM settings",
    );
    this.cache.clear();
    for (const r of rows) this.cache.set(r.key, r.value);
    this.loaded = true;
  }

  /** Nạp toàn bộ settings vào cache (gọi lúc boot để getIntSync đọc đồng bộ). */
  async preload(): Promise<void> {
    await this.ensureLoaded();
  }

  /**
   * Đọc số ĐỒNG BỘ từ cache (cho closure sync như ttl của oidc-provider).
   * Yêu cầu đã preload(); cache luôn cập nhật nhờ set() ghi in-place → giá trị
   * live, không cần restart. Chưa nạp → trả fallback (an toàn dùng mặc định).
   */
  getIntSync(key: string, fallback: number): number {
    const v = this.cache.get(key);
    if (v === undefined) return fallback;
    const n = Number.parseInt(v, 10);
    return Number.isNaN(n) ? fallback : n;
  }

  /** Lấy giá trị chuỗi; trả `fallback` nếu chưa cấu hình. */
  async get(key: string, fallback?: string): Promise<string | undefined> {
    await this.ensureLoaded();
    return this.cache.get(key) ?? fallback;
  }

  /** Lấy số nguyên (vd TTL giây). */
  async getInt(key: string, fallback: number): Promise<number> {
    const v = await this.get(key);
    if (v === undefined) return fallback;
    const n = Number.parseInt(v, 10);
    return Number.isNaN(n) ? fallback : n;
  }

  /** Ghi giá trị + invalidate cache (chỉ SSA gọi qua Settings). */
  async set(key: string, value: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [key, value],
    );
    // Cập nhật cache IN-PLACE (giữ loaded=true) → getIntSync đọc ngay giá trị
    // mới, TTL/policy có hiệu lực runtime không cần restart.
    if (this.loaded) this.cache.set(key, value);
    this.logger.log(`setting updated: ${key}=${value}`);
  }

  /** Buộc nạp lại từ DB lần đọc kế (dùng khi nghi cache lệch, vd đa tiến trình). */
  invalidate(): void {
    this.loaded = false;
    this.cache.clear();
  }

  /**
   * Nạp lại cache định kỳ (HA multi-instance): SSA đổi setting ở node khác →
   * node này thấy sau ≤30s. Thay nguyên map (assignment atomic trong JS) nên
   * getIntSync luôn đọc được giá trị nhất quán, không có khoảng cache rỗng.
   */
  @Interval(30_000)
  async reload(): Promise<void> {
    if (!this.loaded) return;
    try {
      const { rows } = await this.pool.query<{ key: string; value: string }>(
        "SELECT key, value FROM settings",
      );
      this.cache = new Map(rows.map((r) => [r.key, r.value]));
    } catch (e) {
      this.logger.error(`reload settings lỗi: ${String(e)}`);
    }
  }

  /** Liệt kê toàn bộ tham số (Settings page — E6-S5). */
  async list(): Promise<{ key: string; value: string }[]> {
    const { rows } = await this.pool.query<{ key: string; value: string }>(
      "SELECT key, value FROM settings ORDER BY key",
    );
    return rows;
  }
}
