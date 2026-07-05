/**
 * Test tích hợp PgAdapter (E1-S3) — chạy trên Postgres THẬT (dev 5433).
 *   node scripts/adapter.test.js
 * Yêu cầu: đã `pnpm build`; DATABASE_URL trỏ DB dev (mặc định localhost:5433).
 * Kiểm: round-trip, TTL fail-closed, consume nguyên tử, replay → thu hồi
 * trọn grant, revokeByGrantId, findByUid.
 */
const { Pool } = require("pg");
const { PgAdapter, setAdapterPool } = require("../dist/oidc/pg-adapter");

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgres://pmhid:change_me_dev_only@localhost:5433/pmhid";

let passed = 0;
let failed = 0;
function assert(cond, name) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`);
  }
}

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL, max: 4 });
  setAdapterPool(pool);
  const P = "adapter-test:"; // tiền tố id để dọn sạch sau test

  await pool.query(`DELETE FROM oidc_payloads WHERE id LIKE 'adapter-test:%'`);

  // --- 1. upsert + find round-trip ---
  console.log("1. upsert/find round-trip");
  const at = new PgAdapter("AccessToken");
  await at.upsert(`${P}at1`, { grantId: `${P}g1`, clientId: "demo", foo: 1 }, 60);
  const found = await at.find(`${P}at1`);
  assert(found && found.foo === 1 && found.clientId === "demo", "payload giữ nguyên");
  assert(found.consumed === undefined, "chưa consumed");

  // --- 2. TTL fail-closed ---
  console.log("2. TTL hết hạn => find undefined");
  await at.upsert(`${P}at-exp`, { grantId: `${P}g1` }, 1);
  await pool.query(
    `UPDATE oidc_payloads SET expires_at = now() - interval '5 seconds'
     WHERE id = $1`,
    [`${P}at-exp`],
  );
  assert((await at.find(`${P}at-exp`)) === undefined, "bản ghi quá hạn không trả về");

  // --- 3. consume nguyên tử ---
  console.log("3. consume đặt consumed (epoch)");
  const rt = new PgAdapter("RefreshToken");
  await rt.upsert(`${P}rt1`, { grantId: `${P}g2`, clientId: "demo" }, 3600);
  await rt.consume(`${P}rt1`);
  const consumed = await rt.find(`${P}rt1`);
  assert(
    consumed && typeof consumed.consumed === "number" && consumed.consumed > 0,
    "consumed là epoch giây",
  );

  // --- 4. REPLAY: consume lần 2 => thu hồi TRỌN grant ---
  console.log("4. replay consume => revoke cả grant");
  const sess = new PgAdapter("Session");
  await sess.upsert(`${P}sess2`, { grantId: `${P}g2`, uid: `${P}uid2` }, 3600);
  await at.upsert(`${P}at2`, { grantId: `${P}g2`, clientId: "demo" }, 3600);
  await rt.consume(`${P}rt1`); // lần 2 — replay
  const { rows: leftover } = await pool.query(
    `SELECT id FROM oidc_payloads WHERE grant_id = $1`,
    [`${P}g2`],
  );
  assert(leftover.length === 0, `mọi artifact grant g2 bị xóa (còn ${leftover.length})`);

  // --- 5. revokeByGrantId xóa trọn ---
  console.log("5. revokeByGrantId");
  const code = new PgAdapter("AuthorizationCode");
  await code.upsert(`${P}c3`, { grantId: `${P}g3` }, 600);
  await at.upsert(`${P}at3`, { grantId: `${P}g3`, clientId: "demo" }, 600);
  await rt.upsert(`${P}rt3`, { grantId: `${P}g3`, clientId: "demo" }, 600);
  await new PgAdapter("Grant").revokeByGrantId(`${P}g3`);
  const { rows: g3 } = await pool.query(
    `SELECT id FROM oidc_payloads WHERE grant_id = $1`,
    [`${P}g3`],
  );
  assert(g3.length === 0, "code+access+refresh cùng grant bị xóa hết");

  // --- 6. findByUid ---
  console.log("6. findByUid (Session)");
  await sess.upsert(`${P}sess4`, { uid: `${P}uid4`, data: "x" }, 600);
  const byUid = await sess.findByUid(`${P}uid4`);
  assert(byUid && byUid.data === "x", "tìm session theo uid");

  // --- 7. destroy ---
  await sess.destroy(`${P}sess4`);
  assert((await sess.find(`${P}sess4`)) === undefined, "destroy xóa bản ghi");

  await pool.query(`DELETE FROM oidc_payloads WHERE id LIKE 'adapter-test:%'`);
  await pool.end();

  console.log(`\nKẾT QUẢ: ${passed} pass, ${failed} fail`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
