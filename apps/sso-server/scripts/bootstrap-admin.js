/**
 * Bootstrap tài khoản quản trị ĐẦU TIÊN cho PROD (thay cho seed-dev vốn là dev).
 * KHÔNG hardcode mật khẩu, KHÔNG ghi đè user đã tồn tại.
 *
 * Chạy trong container sso-server (có sẵn argon2 + pg + DATABASE_URL):
 *   docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.prod.yml \
 *     exec -e ADMIN_EMAIL=admin@pmh.com.vn -e ADMIN_NAME="Quản trị hệ thống" \
 *          -e ADMIN_CODE=NV000 -e ADMIN_PASSWORD='<mật khẩu mạnh>' \
 *          sso-server node scripts/bootstrap-admin.js
 *
 * Tài khoản break-glass (bypass MFA khi SSO/MFA kẹt — xem runbook §3):
 *   ... -e BREAKGLASS=true -e ADMIN_EMAIL=breakglass@pmh.com.vn -e ADMIN_CODE=NV999 ...
 *
 * Biến: ADMIN_EMAIL, ADMIN_NAME, ADMIN_CODE, ADMIN_PASSWORD (bắt buộc);
 *       ROLE=ssa|project_admin (mặc định ssa); BREAKGLASS=true|false (mặc định false).
 */
const argon2 = require("argon2");
const { Pool } = require("pg");

const {
  DATABASE_URL,
  ADMIN_EMAIL,
  ADMIN_NAME,
  ADMIN_CODE,
  ADMIN_PASSWORD,
  ROLE = "ssa",
  BREAKGLASS = "false",
} = process.env;

function die(msg) {
  console.error("✗ " + msg);
  process.exit(1);
}

async function main() {
  if (!DATABASE_URL) die("Thiếu DATABASE_URL.");
  if (!ADMIN_EMAIL || !ADMIN_NAME || !ADMIN_CODE || !ADMIN_PASSWORD)
    die("Thiếu ADMIN_EMAIL / ADMIN_NAME / ADMIN_CODE / ADMIN_PASSWORD.");
  if (!["ssa", "project_admin"].includes(ROLE)) die("ROLE phải là 'ssa' hoặc 'project_admin'.");
  if (ADMIN_PASSWORD.length < 12) die("ADMIN_PASSWORD nên tối thiểu 12 ký tự.");

  const breakglass = BREAKGLASS === "true";
  const pool = new Pool({ connectionString: DATABASE_URL });
  const hash = await argon2.hash(ADMIN_PASSWORD);

  // KHÔNG ghi đè: chèn mới, nếu trùng email/mã NV thì báo và dừng.
  const ins = await pool.query(
    `INSERT INTO users (email, employee_code, full_name, password_hash, status,
                        password_updated_at, is_breakglass)
     VALUES ($1, $2, $3, $4, 'active', now(), $5)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [ADMIN_EMAIL, ADMIN_CODE, ADMIN_NAME, hash, breakglass],
  );
  if (ins.rows.length === 0) {
    await pool.end();
    die(`Đã tồn tại user trùng email (${ADMIN_EMAIL}) hoặc mã NV (${ADMIN_CODE}). Không ghi đè.`);
  }
  const userId = ins.rows[0].id;

  await pool.query(
    `INSERT INTO admin_roles (user_id, role) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [userId, ROLE],
  );

  console.log("✓ Đã tạo tài khoản quản trị:");
  console.log(`  ${ADMIN_EMAIL}  (${ADMIN_CODE})  vai=${ROLE}  break-glass=${breakglass}  id=${userId}`);
  console.log("  → Đăng nhập ngay và (khuyến nghị) bật MFA. Cất credential ở nơi an toàn.");
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
