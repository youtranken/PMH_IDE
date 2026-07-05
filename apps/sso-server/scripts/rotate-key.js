/**
 * CLI xoay khóa ký JWT (E3-S5, AD-8). Sửa mảng jwks.json tại SIGNING_KEYS_DIR.
 * Quy trình PUBLISH-TRƯỚC-KÝ-SAU (không gãy token đang sống):
 *
 *   node scripts/rotate-key.js list
 *   node scripts/rotate-key.js add                 # thêm khóa mới CUỐI mảng (chỉ publish)
 *   <restart sso-server>                            # JWKS công bố khóa mới, chưa ký bằng nó
 *   node scripts/rotate-key.js promote <kid>        # đưa lên ĐẦU = bắt đầu ký
 *   <restart sso-server>
 *   ... giữ khóa cũ ≥ (access TTL + JWKS cache 10') rồi:
 *   node scripts/rotate-key.js retire <kid>         # gỡ khóa cũ
 *
 *   node scripts/rotate-key.js emergency --leaked <kid>   # ký khóa mới NGAY + rút kid lộ + audit
 *
 * Sau mỗi lệnh sửa mảng: PHẢI restart sso-server để provider nạp lại.
 */
const fs = require("node:fs");
const path = require("node:path");
// NGUỒN DUY NHẤT sinh khóa/kid — dùng chung với KeysService của app (Yui:
// tránh 2 công thức kid lệch nhau âm thầm).
const { generateRsaJwk } = require("../dist/oidc/jwk.util");

const DIR = process.env.SIGNING_KEYS_DIR || "/run/secrets/signing-keys";
const FILE = path.join(DIR, "jwks.json");

function load() {
  if (!fs.existsSync(FILE)) {
    console.error(`Không thấy ${FILE}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(FILE, "utf8"));
}
// Ghi NGUYÊN TỬ: sao lưu .bak → ghi .tmp → rename đè. Crash giữa chừng không
// bao giờ để lại jwks.json cụt (làm provider không boot = cả hệ chết).
function save(keys) {
  if (fs.existsSync(FILE)) fs.copyFileSync(FILE, FILE + ".bak");
  const tmp = FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(keys, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, FILE);
}
const genKey = generateRsaJwk;
async function audit(action, detail) {
  try {
    const { Pool } = require("pg");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query(
      `INSERT INTO audit_logs (action, target_type, detail) VALUES ($1,'signing_key',$2)`,
      [action, JSON.stringify(detail)],
    );
    await pool.end();
  } catch (e) {
    console.error("(cảnh báo) ghi audit thất bại:", String(e));
  }
}

async function main() {
  const [cmd, arg] = process.argv.slice(2);
  const keys = fs.existsSync(FILE) ? load() : [];

  if (cmd === "list") {
    keys.forEach((k, i) =>
      console.log(`${i === 0 ? "* KÝ  " : "  verify"}  ${k.kid}`),
    );
    console.log(`\n(* = khóa đang ký. Tổng ${keys.length} khóa.)`);
    return;
  }

  if (cmd === "add") {
    const k = genKey();
    keys.push(k); // CUỐI mảng — chỉ publish, chưa ký
    save(keys);
    console.log(`Đã thêm khóa mới (publish): ${k.kid}`);
    console.log("→ Restart sso-server, rồi: promote " + k.kid);
    return;
  }

  if (cmd === "promote") {
    const i = keys.findIndex((k) => k.kid === arg);
    if (i < 0) return console.error(`Không thấy kid ${arg}`);
    const [k] = keys.splice(i, 1);
    keys.unshift(k); // lên ĐẦU = bắt đầu ký
    save(keys);
    console.log(`Đã đưa ${arg} lên đầu (bắt đầu ký). Restart sso-server.`);
    return;
  }

  if (cmd === "retire") {
    if (keys[0]?.kid === arg)
      return console.error("Không gỡ khóa đang ký. Promote khóa khác trước.");
    const before = keys.length;
    const left = keys.filter((k) => k.kid !== arg);
    if (left.length === before) return console.error(`Không thấy kid ${arg}`);
    save(left);
    console.log(`Đã gỡ khóa ${arg}. Restart sso-server.`);
    return;
  }

  if (cmd === "emergency") {
    const leakedIdx = process.argv.indexOf("--leaked");
    const leaked = leakedIdx > -1 ? process.argv[leakedIdx + 1] : null;
    // Validate kid lộ có thật — gõ sai sẽ KHÔNG rút gì mà audit lại ghi "đã rút"
    if (leaked && !keys.some((x) => x.kid === leaked)) {
      return console.error(`Không thấy kid ${leaked} trong JWKS — kiểm lại (dùng 'list').`);
    }
    const k = genKey();
    let left = keys;
    if (leaked) left = keys.filter((x) => x.kid !== leaked); // RÚT kid lộ ngay
    left.unshift(k); // ký bằng khóa mới NGAY
    save(left);
    await audit("signing_key.emergency_rotate", { newKid: k.kid, revokedKid: leaked });
    console.log(`KHẨN: ký bằng khóa mới ${k.kid}; đã rút ${leaked ?? "(không)"}.`);
    console.log("→ Restart sso-server NGAY.");
    return;
  }

  console.error("Lệnh: list | add | promote <kid> | retire <kid> | emergency --leaked <kid>");
  process.exit(1);
}
main();
