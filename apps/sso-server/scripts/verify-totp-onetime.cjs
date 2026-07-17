// Regression M5 — TOTP one-time (chống replay). CHẠY TRONG CONTAINER (cần dist
// đã build + DATABASE_URL + KEK_BASE64 + otplib). Dùng chính MfaService thật.
//   docker exec -w /repo/apps/sso-server pmh-id-sso-server-1 node scripts/verify-totp-onetime.cjs
const pg = require("pg");
const { randomUUID } = require("node:crypto");
const { authenticator } = require("otplib");
const { KekService } = require("../dist/common/kek.service.js");
const { MfaService } = require("../dist/modules/auth-oidc/mfa.service.js");

(async () => {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const cfg = {
    getOrThrow: (k) => {
      const v = process.env[k];
      if (!v) throw new Error("missing " + k);
      return v;
    },
    get: (k) => process.env[k],
  };
  const kek = new KekService(cfg);
  const mfa = new MfaService(pool, kek);
  const uid = randomUUID();
  await pool.query(`DELETE FROM users WHERE email='e2e-m5@pmh.com.vn'`);
  await pool.query(
    `INSERT INTO users(id,email,employee_code,full_name,status)
     VALUES($1,'e2e-m5@pmh.com.vn','e2e-m5','e2e m5','active')`,
    [uid],
  );
  let ok = true;
  const check = (n, c) => {
    console.log((c ? "  PASS  " : "  FAIL  ") + n);
    if (!c) ok = false;
  };
  try {
    const uri = await mfa.beginEnroll(uid, "e2e-m5");
    const secret = new URL(uri).searchParams.get("secret");
    const code = authenticator.generate(secret);

    check("confirmEnroll(mã đúng) = true", (await mfa.confirmEnroll(uid, code)) === true);
    // confirm đã ghi step → mã đó KHÔNG dùng lại làm mã login được.
    check("verifyTotp(replay mã enroll) = false", (await mfa.verifyTotp(uid, code)) === false);

    // Reset để test one-time NGAY trong một bước: lần 1 nhận, lần 2 replay bị chặn.
    await pool.query(`UPDATE mfa_totp SET last_totp_step=NULL WHERE user_id=$1`, [uid]);
    check("verifyTotp(lần 1) = true", (await mfa.verifyTotp(uid, code)) === true);
    check("verifyTotp(lần 2 replay) = false", (await mfa.verifyTotp(uid, code)) === false);
    check("verifyTotp(mã sai) = false", (await mfa.verifyTotp(uid, "000000")) === false);

    const step = Number(
      (await pool.query(`SELECT last_totp_step FROM mfa_totp WHERE user_id=$1`, [uid])).rows[0]
        .last_totp_step,
    );
    check("last_totp_step được ghi (>0)", step > 0);

    console.log(ok ? "\nM5 PASS" : "\nM5 FAIL");
  } finally {
    await pool.query(`DELETE FROM users WHERE id=$1`, [uid]); // cascade mfa_totp
    await pool.end();
    process.exit(ok ? 0 : 1);
  }
})();
