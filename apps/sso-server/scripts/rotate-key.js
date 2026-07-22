/**
 * CLI xoay khóa ký JWT (E3-S5, AD-8). Sửa mảng jwks.json tại SIGNING_KEYS_DIR
 * (mã hóa KEK at-rest, enc:v1:). Cần KEK_BASE64 trong môi trường.
 *
 *   node scripts/rotate-key.js init                # HOST TRẮNG: tạo khóa ĐẦU TIÊN
 *
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
const crypto = require("node:crypto");
// NGUỒN DUY NHẤT sinh khóa/kid — dùng chung với KeysService của app (Yui:
// tránh 2 công thức kid lệch nhau âm thầm).
const { generateRsaJwk } = require("../dist/oidc/jwk.util");

const DIR = process.env.SIGNING_KEYS_DIR || "/run/secrets/signing-keys";
const FILE = path.join(DIR, "jwks.json");

// Khóa ký MÃ HÓA at-rest bằng KEK (M1): file dạng `enc:v1:<base64 iv|tag|ct>`
// AES-256-GCM — CÙNG scheme với KekService/KeysService. rotate-key PHẢI giải mã
// khi đọc và mã hóa khi ghi; nếu không sẽ crash (JSON.parse blob mã hóa) hoặc
// hạ cấp file về plaintext (mất mã hóa at-rest).
const ENC_PREFIX = "enc:v1:";
function kekKey() {
  const b64 = process.env.KEK_BASE64;
  const key = b64 ? Buffer.from(b64, "base64") : Buffer.alloc(0);
  if (key.length !== 32) {
    console.error("Thiếu/sai KEK_BASE64 (phải giải ra 32 byte AES-256).");
    process.exit(1);
  }
  return key;
}
function kekDecrypt(raw) {
  const blob = Buffer.from(raw.slice(ENC_PREFIX.length), "base64");
  const d = crypto.createDecipheriv("aes-256-gcm", kekKey(), blob.subarray(0, 12));
  d.setAuthTag(blob.subarray(12, 28));
  return Buffer.concat([d.update(blob.subarray(28)), d.final()]).toString("utf8");
}
function kekEncrypt(plain) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", kekKey(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ENC_PREFIX + Buffer.concat([iv, c.getAuthTag(), enc]).toString("base64");
}

function load() {
  if (!fs.existsSync(FILE)) {
    console.error(`Không thấy ${FILE}. Host trắng? Dùng 'init' để tạo khóa đầu tiên.`);
    process.exit(1);
  }
  const raw = fs.readFileSync(FILE, "utf8").trim();
  // Chấp nhận file plaintext legacy (nạp rồi 'save' kế sẽ mã hóa lại).
  return JSON.parse(raw.startsWith(ENC_PREFIX) ? kekDecrypt(raw) : raw);
}
// Ghi NGUYÊN TỬ (mã hóa KEK): sao lưu .bak → ghi .tmp → rename đè. Crash giữa
// chừng không bao giờ để lại jwks.json cụt (provider không boot = cả hệ chết).
function save(keys) {
  if (fs.existsSync(FILE)) fs.copyFileSync(FILE, FILE + ".bak");
  const tmp = FILE + ".tmp";
  fs.writeFileSync(tmp, kekEncrypt(JSON.stringify(keys)), { mode: 0o600 });
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

  if (cmd === "init") {
    // Host TRẮNG (chưa có backup để restore): tạo khóa ký ĐẦU TIÊN. Prod fail-fast
    // khi thiếu jwks.json (AD-8) nên bước này CHẶN go-live greenfield.
    if (fs.existsSync(FILE)) {
      console.error(`${FILE} đã tồn tại — 'init' chỉ dùng cho host trắng. Dùng 'add' để thêm khóa.`);
      process.exit(1);
    }
    fs.mkdirSync(DIR, { recursive: true });
    const k = genKey();
    save([k]); // save() mã hóa KEK at-rest
    console.log(`Đã tạo khóa ký đầu tiên (mã hóa KEK at-rest): ${k.kid}`);
    console.log("→ Start sso-server. CẤT KEK_BASE64 offline — mất KEK = mất khóa ký.");
    return;
  }

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

  console.error("Lệnh: init | list | add | promote <kid> | retire <kid> | emergency --leaked <kid>");
  process.exit(1);
}
main();
