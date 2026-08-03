/**
 * Seed PROD — tạo 2 tài khoản quản trị lõi: SSA (vận hành) + sysadmin (break-glass).
 * Chạy được TRÊN PROD, KHÔNG cần 3 điều kiện như seed-dev, VÌ nó an toàn:
 *   - Mật khẩu LẤY TỪ ENV (bạn tự đặt) — KHÔNG có mật khẩu công khai.
 *   - ON CONFLICT DO NOTHING — KHÔNG ghi đè tài khoản đã có (chạy lại vô hại).
 *
 *   docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.prod.yml exec \
 *     -e SSA_PASSWORD='<mk-mạnh-1>' -e SYSADMIN_PASSWORD='<mk-mạnh-2>' \
 *     sso-server node scripts/seed-prod.js
 *
 * Env: SSA_PASSWORD, SYSADMIN_PASSWORD (BẮT BUỘC, ≥12 ký tự). Còn lại có mặc định:
 *   SSA_EMAIL=ssa@pmh.com.vn         SSA_CODE=NV010       SSA_NAME="Super Admin"
 *   SYSADMIN_EMAIL=sysadmin@pmh.com.vn SYSADMIN_CODE=NV000 SYSADMIN_NAME="Quản trị hệ thống (break-glass)"
 */
const argon2 = require("argon2");
const { Pool } = require("pg");

const E = process.env;
const DATABASE_URL = E.DATABASE_URL;

function die(msg) {
  console.error("✗ " + msg);
  process.exit(1);
}

// sysadmin = SSA + break-glass (ẩn khỏi UI, đăng nhập bỏ qua MFA — lối cứu hộ offline).
// ssa      = SSA hiển thị, dùng vận hành hằng ngày (bật MFA sau khi tạo).
const accounts = [
  {
    email: E.SSA_EMAIL || "ssa@pmh.com.vn",
    code: E.SSA_CODE || "NV010",
    name: E.SSA_NAME || "Super Admin",
    password: E.SSA_PASSWORD,
    breakglass: false,
    envName: "SSA_PASSWORD",
  },
  {
    email: E.SYSADMIN_EMAIL || "sysadmin@pmh.com.vn",
    code: E.SYSADMIN_CODE || "NV000",
    name: E.SYSADMIN_NAME || "Quản trị hệ thống (break-glass)",
    password: E.SYSADMIN_PASSWORD,
    breakglass: true,
    envName: "SYSADMIN_PASSWORD",
  },
];

async function main() {
  if (!DATABASE_URL) die("Thiếu DATABASE_URL.");
  for (const a of accounts) {
    if (!a.password) die(`Thiếu mật khẩu cho ${a.email} — đặt biến ${a.envName}.`);
    if (a.password.length < 12) die(`${a.envName} (${a.email}) phải tối thiểu 12 ký tự.`);
  }

  const pool = new Pool({ connectionString: DATABASE_URL });
  for (const a of accounts) {
    const hash = await argon2.hash(a.password);
    // KHÔNG ghi đè: trùng email hoặc mã NV thì bỏ qua (giữ nguyên tài khoản cũ).
    const ins = await pool.query(
      `INSERT INTO users (email, employee_code, full_name, password_hash, status,
                          password_updated_at, is_breakglass)
       VALUES ($1, $2, $3, $4, 'active', now(), $5)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [a.email, a.code, a.name, hash, a.breakglass],
    );
    if (ins.rows.length === 0) {
      console.log(`• Bỏ qua ${a.email} — đã tồn tại (KHÔNG ghi đè).`);
      continue;
    }
    await pool.query(
      `INSERT INTO admin_roles (user_id, role) VALUES ($1, 'ssa') ON CONFLICT DO NOTHING`,
      [ins.rows[0].id],
    );
    console.log(
      `✓ Tạo ${a.email} (${a.code}) vai=ssa break-glass=${a.breakglass} id=${ins.rows[0].id}`,
    );
  }
  await pool.end();
  console.log(
    "Xong. → Đăng nhập ssa@ và BẬT MFA. Mật khẩu sysadmin@ (break-glass) cất OFFLINE, không đăng nhập hằng ngày.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
