/**
 * Seed dữ liệu DEV để test đăng nhập + quản trị (E1-S4, Epic 4). Idempotent.
 *   node scripts/seed-dev.js
 *
 * Tài khoản (mật khẩu chung: Passw0rd!):
 *   an.nguyen@pmh.com.vn  NV001  user thường (groups Developers, Kế toán)
 *   sysadmin@pmh.com.vn   NV000  SSA + break-glass (đăng nhập không cần MFA — dev)
 *   padmin@pmh.com.vn     NV002  project_admin của "Demo Project"
 */
const argon2 = require("argon2");
const { Pool } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgres://pmhid:change_me_dev_only@localhost:5433/pmhid";

async function upsertUser(pool, hash, { email, code, name, breakglass = false }) {
  const { rows } = await pool.query(
    `INSERT INTO users (email, employee_code, full_name, password_hash, status,
                        password_updated_at, is_breakglass)
     VALUES ($1, $2, $3, $4, 'active', now(), $5)
     ON CONFLICT (employee_code) DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       password_updated_at = now(),
       is_breakglass = EXCLUDED.is_breakglass,
       must_change_password = false,
       temp_password_expires_at = NULL,
       deleted_at = NULL,
       status = 'active'
     RETURNING id`,
    [email, code, name, hash, breakglass],
  );
  return rows[0].id;
}

async function addToGroup(pool, userId, name) {
  const { rows } = await pool.query(
    `INSERT INTO groups (name) VALUES ($1)
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
    [name],
  );
  await pool.query(
    `INSERT INTO user_groups (user_id, group_id) VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [userId, rows[0].id],
  );
}

async function grantRole(pool, userId, role) {
  await pool.query(
    `INSERT INTO admin_roles (user_id, role) VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [userId, role],
  );
}

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const hash = await argon2.hash("Passw0rd!");

  // User thường
  const anId = await upsertUser(pool, hash, {
    email: "an.nguyen@pmh.com.vn",
    code: "NV001",
    name: "Nguyễn Văn An",
  });
  await addToGroup(pool, anId, "Developers");
  await addToGroup(pool, anId, "Kế toán");

  // SSA break-glass (dev: đăng nhập password-only để test API quản trị)
  const ssaId = await upsertUser(pool, hash, {
    email: "sysadmin@pmh.com.vn",
    code: "NV000",
    name: "Quản trị hệ thống",
    breakglass: true,
  });
  await grantRole(pool, ssaId, "ssa");

  // Project + project_admin
  const { rows: proj } = await pool.query(
    `INSERT INTO projects (name, description) VALUES ('Demo Project', 'Dự án mẫu dev')
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
  );
  const projectId = proj[0].id;
  const padminId = await upsertUser(pool, hash, {
    email: "padmin@pmh.com.vn",
    code: "NV002",
    name: "Trần Project Admin",
  });
  await grantRole(pool, padminId, "project_admin");
  await pool.query(
    `INSERT INTO admin_projects (user_id, project_id) VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [padminId, projectId],
  );

  // Client của Demo Project + gán group Developers → padmin thấy user Developers
  // trong phạm vi (đồ thị group→client_groups→client→project cho export E4-S4).
  const { rows: cli } = await pool.query(
    `INSERT INTO clients (project_id, client_id, name, env, redirect_uris)
     VALUES ($1, 'demo-project-app', 'Demo Project App', 'dev', '{}')
     ON CONFLICT (client_id) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
    [projectId],
  );
  const { rows: devGrp } = await pool.query(
    `SELECT id FROM groups WHERE name = 'Developers'`,
  );
  if (devGrp[0]) {
    await pool.query(
      `INSERT INTO client_groups (client_id, group_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [cli[0].id, devGrp[0].id],
    );
  }

  console.log("Seed OK:");
  console.log(`  user  an.nguyen@pmh.com.vn / Passw0rd!  (${anId})`);
  console.log(`  SSA   sysadmin@pmh.com.vn  / Passw0rd!  (${ssaId})`);
  console.log(`  padmin padmin@pmh.com.vn   / Passw0rd!  (${padminId}) → Demo Project ${projectId}`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
