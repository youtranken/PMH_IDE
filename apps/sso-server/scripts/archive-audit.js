/**
 * Kích hoạt tay việc nén & lưu trữ audit (E3-S6) — gọi CHÍNH service của app.
 *   node scripts/archive-audit.js [days=365]
 */
const { Pool } = require("pg");
const { AuditArchiveService } = require("../dist/modules/jobs/audit-archive.service");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const settings = {
  async get(key, fallback) {
    const { rows } = await pool.query("SELECT value FROM settings WHERE key=$1", [key]);
    return rows[0]?.value ?? fallback;
  },
};

const days = Number.parseInt(process.argv[2] ?? "365", 10);
new AuditArchiveService(pool, settings)
  .archiveOlderThan(days)
  .then((n) => {
    console.log(`archived ${n} bản ghi (cũ hơn ${days} ngày)`);
    return pool.end();
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
