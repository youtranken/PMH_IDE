/**
 * Bật MFA TOTP cho một tài khoản (SSA tự chạy trên server — E2-S1/S2).
 * DÙNG CHÍNH KekService + MfaService của app (không chép crypto — tránh lệch
 * format làm TOTP không giải mã được).
 *
 *   node scripts/enroll-mfa.js <email>                    # bước 1: sinh QR
 *   node scripts/enroll-mfa.js <email> --confirm 123456   # bước 2: xác nhận + bật
 */
const { Pool } = require("pg");
const qrcode = require("qrcode");
const { KekService } = require("../dist/common/kek.service");
const { MfaService } = require("../dist/modules/auth-oidc/mfa.service");

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgres://pmhid:change_me_dev_only@localhost:5433/pmhid";

// Shim ConfigService: KekService chỉ cần getOrThrow(key)
const config = {
  getOrThrow(key) {
    const v = process.env[key];
    if (v == null) throw new Error(`thiếu biến môi trường ${key}`);
    return v;
  },
  get(key) {
    return process.env[key];
  },
};

async function main() {
  const email = process.argv[2];
  const ci = process.argv.indexOf("--confirm");
  const confirmCode = ci > -1 ? process.argv[ci + 1] : null;
  if (!email) {
    console.error("Dùng: node scripts/enroll-mfa.js <email> [--confirm <code>]");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: DATABASE_URL });
  const mfa = new MfaService(pool, new KekService(config));

  const { rows } = await pool.query(
    "SELECT id, email FROM users WHERE lower(email)=lower($1) AND deleted_at IS NULL",
    [email],
  );
  if (rows.length === 0) {
    console.error(`Không thấy user: ${email}`);
    process.exit(1);
  }
  const user = rows[0];

  if (!confirmCode) {
    const uri = await mfa.beginEnroll(user.id, user.email);
    console.log("\n=== Bước 1: quét QR bằng authenticator app ===\n");
    console.log(await qrcode.toString(uri, { type: "terminal", small: true }));
    console.log("otpauth URI:", uri);
    console.log(`\nSau đó: node scripts/enroll-mfa.js ${email} --confirm <mã 6 số>\n`);
  } else {
    if (!(await mfa.confirmEnroll(user.id, confirmCode))) {
      console.error("Mã không đúng (kiểm tra đồng hồ thiết bị). Thử lại.");
      process.exit(1);
    }
    const codes = await mfa.generateRecoveryCodes(user.id);
    console.log(`\n✓ MFA đã BẬT cho ${user.email}.`);
    console.log("\n=== 10 RECOVERY CODE (hiện MỘT LẦN — in giấy cất két) ===");
    codes.forEach((c) => console.log("   " + c));
    console.log();
  }
  await pool.end();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
