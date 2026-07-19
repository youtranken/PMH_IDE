/**
 * E2E hồi quy CỤM A (rà soát tiền-prod 2026-07) — jest + supertest.
 *
 * Bốn lỗ hổng được vá:
 *  A1  POST /api/me/mfa/setup ghi đè secret + enabled=false → TẮT MFA không cần
 *      chứng minh sở hữu (vòng qua mfaDisable).
 *  A2  POST /api/admin/users/:id/reset-password thiếu assertTargetNotAdmin →
 *      project_admin ép-đổi-MK + thu hồi phiên của một admin khác.
 *  A3  allow_all_groups (cờ nới ĐĂNG NHẬP) bị tính vào predicate phạm vi QUẢN
 *      TRỊ → project_admin tự bật cờ trên client mình rồi thấy/sửa toàn hệ.
 *  A4  /api/auth/forgot-password không loại break-glass → hòm thư thành đường
 *      MỘT yếu tố vào SSA (break-glass bypass MFA).
 *
 * Cùng khuôn với authz.e2e-spec.ts: BLACK-BOX qua HTTP tới edge, seed/teardown
 * và ký token qua `docker exec` để bí mật không rời container.
 *
 * Cần: stack dev đang chạy. Chạy: pnpm --filter @pmh/sso-server test:e2e
 */
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import request from "supertest";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const BASE = process.env.E2E_BASE_URL || "https://id.pmh.com.vn";
const PG = process.env.E2E_PG_CONTAINER || "pmh-id-postgres-1";
const SSO = process.env.E2E_SSO_CONTAINER || "pmh-id-sso-server-1";
const DBU = process.env.E2E_DB_USER || "pmhid";
const DB = process.env.E2E_DB_NAME || "pmhid";
const TAG = "e2e-groupa-jest";

const api = () => request(BASE);
const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

function psqlExec(sql: string): void {
  execSync(`docker exec -i ${PG} psql -U ${DBU} -d ${DB} -v ON_ERROR_STOP=1 -q`, {
    input: sql,
    stdio: ["pipe", "ignore", "pipe"],
  });
}
function psqlVal(sql: string): string {
  return execSync(`docker exec ${PG} psql -U ${DBU} -d ${DB} -tAc "${sql}"`)
    .toString()
    .trim();
}
function signToken(sub: string, mode: "portal" | "m2m"): string {
  return execSync(`docker exec ${SSO} node scripts/sign-e2e-token.mjs ${sub} ${mode}`)
    .toString()
    .trim();
}

const id = {
  projA: randomUUID(),
  projB: randomUUID(),
  gA: randomUUID(),
  gB: randomUUID(),
  cA: randomUUID(),
  cB: randomUUID(),
  PA: randomUUID(), // project_admin của projA
  UA: randomUUID(), // user thường trong gA → trong phạm vi PA
  UB: randomUUID(), // user thường trong gB → NGOÀI phạm vi PA
  AA: randomUUID(), // project_admin của projB nhưng là member gA → in scope PA
  MF: randomUUID(), // user đã BẬT MFA (kiểm A1)
  BG: randomUUID(), // tài khoản break-glass (kiểm A4)
};
const bgEmail = `${TAG}-bg@pmh.com.vn`;

const cleanupSql = `
  DELETE FROM mfa_totp m USING users u WHERE m.user_id=u.id AND u.email LIKE '${TAG}%';
  DELETE FROM user_groups ug USING users u WHERE ug.user_id=u.id AND u.email LIKE '${TAG}%';
  DELETE FROM admin_projects ap USING users u WHERE ap.user_id=u.id AND u.email LIKE '${TAG}%';
  DELETE FROM admin_roles ar USING users u WHERE ar.user_id=u.id AND u.email LIKE '${TAG}%';
  DELETE FROM client_groups cg USING clients c WHERE cg.client_id=c.id AND c.client_id LIKE '${TAG}%';
  DELETE FROM clients WHERE client_id LIKE '${TAG}%';
  DELETE FROM groups WHERE name LIKE '${TAG}%';
  DELETE FROM email_queue WHERE to_addr LIKE '${TAG}%';
  DELETE FROM users WHERE email LIKE '${TAG}%';
  DELETE FROM projects WHERE name LIKE '${TAG}%';
`;

let paTok = "";
let ssaTok = "";
let mfTok = "";
let ssaId = "";

beforeAll(() => {
  psqlExec(cleanupSql);
  const u = (uid: string, tag: string, extra = "") =>
    `INSERT INTO users(id,email,employee_code,full_name,status${extra ? ",is_breakglass" : ""}) VALUES('${uid}','${TAG}-${tag}@pmh.com.vn','${TAG}-${tag}','${TAG} ${tag}','active'${extra});`;
  psqlExec(`
    INSERT INTO projects(id,name) VALUES('${id.projA}','${TAG}-projA'),('${id.projB}','${TAG}-projB');
    INSERT INTO groups(id,name) VALUES('${id.gA}','${TAG}-gA'),('${id.gB}','${TAG}-gB');
    INSERT INTO clients(id,project_id,client_id,name,env) VALUES
      ('${id.cA}','${id.projA}','${TAG}-cA','${TAG}-cA','dev'),
      ('${id.cB}','${id.projB}','${TAG}-cB','${TAG}-cB','dev');
    INSERT INTO client_groups(client_id,group_id) VALUES('${id.cA}','${id.gA}'),('${id.cB}','${id.gB}');
    ${u(id.PA, "admin")}${u(id.UA, "userA")}${u(id.UB, "userB")}${u(id.AA, "adminInScope")}${u(id.MF, "mfa")}
    ${u(id.BG, "bg", ",true")}
    INSERT INTO admin_roles(user_id,role) VALUES('${id.PA}','project_admin'),('${id.AA}','project_admin');
    INSERT INTO admin_projects(user_id,project_id) VALUES('${id.PA}','${id.projA}'),('${id.AA}','${id.projB}');
    INSERT INTO user_groups(user_id,group_id) VALUES
      ('${id.PA}','${id.gA}'),('${id.UA}','${id.gA}'),('${id.UB}','${id.gB}'),
      ('${id.AA}','${id.gA}'),('${id.MF}','${id.gA}');
    -- MFA đã BẬT cho MF. Secret là bytea giả: status() chỉ đọc cột enabled,
    -- và test khẳng định secret KHÔNG bị ghi đè nên không cần giải mã được.
    INSERT INTO mfa_totp(user_id,totp_secret_enc,enabled)
      VALUES('${id.MF}','\\\\x0badc0de','true');
  `);
  ssaId = psqlVal(
    "SELECT u.id FROM admin_roles r JOIN users u ON u.id=r.user_id WHERE r.role='ssa' AND u.is_breakglass=false LIMIT 1",
  );
  paTok = signToken(id.PA, "portal");
  ssaTok = signToken(ssaId, "portal");
  mfTok = signToken(id.MF, "portal");
});

afterAll(() => {
  psqlExec(cleanupSql);
});

describe("A1 — /me/mfa/setup không được là đường tắt MFA", () => {
  it("MFA đang bật → setup bị từ chối (400) và secret KHÔNG đổi", async () => {
    const before = psqlVal(
      `SELECT encode(totp_secret_enc,'hex')||':'||enabled FROM mfa_totp WHERE user_id='${id.MF}'`,
    );
    const r = await api().post("/api/me/mfa/setup").set(bearer(mfTok));
    expect(r.status).toBe(400);

    const after = psqlVal(
      `SELECT encode(totp_secret_enc,'hex')||':'||enabled FROM mfa_totp WHERE user_id='${id.MF}'`,
    );
    expect(after).toBe(before);
    // Điểm mấu chốt: enabled vẫn true → isRequired() vẫn bắt MFA ở lần login
    // sau. (Nối chuỗi trong SQL ép boolean thành 'true', không phải 't'.)
    expect(after.endsWith(":true")).toBe(true);
  });

  it("MFA chưa bật → setup vẫn chạy bình thường (không chặn nhầm)", async () => {
    const uaTok = signToken(id.UA, "portal");
    const r = await api().post("/api/me/mfa/setup").set(bearer(uaTok));
    expect(r.status).toBe(201);
    expect(typeof r.body.otpauth).toBe("string");
    expect(r.body.qr).toMatch(/^data:image\/png;base64,/);
  });
});

describe("A2 — reset-password không đụng được tài khoản quản trị khác", () => {
  it("PA reset MK của admin TRONG phạm vi → 403", async () => {
    const r = await api()
      .post(`/api/admin/users/${id.AA}/reset-password`)
      .set(bearer(paTok))
      .send({});
    expect(r.status).toBe(403);
  });

  it("PA reset MK của user THƯỜNG trong phạm vi → vẫn được (không chặn nhầm)", async () => {
    const r = await api()
      .post(`/api/admin/users/${id.UA}/reset-password`)
      .set(bearer(paTok))
      .send({});
    expect([200, 201]).toContain(r.status);
  });

  it("SSA reset MK của admin → vẫn được", async () => {
    const r = await api()
      .post(`/api/admin/users/${id.AA}/reset-password`)
      .set(bearer(ssaTok))
      .send({});
    expect([200, 201]).toContain(r.status);
  });
});

describe("A3 — allow_all_groups không nới được phạm vi QUẢN TRỊ", () => {
  it("PA không tự bật được cờ allow-all (chỉ SSA) → 403", async () => {
    const r = await api()
      .post(`/api/admin/clients/${id.cA}/allow-all`)
      .set(bearer(paTok))
      .send({ allowAll: true });
    expect(r.status).toBe(403);
    expect(psqlVal(`SELECT allow_all_groups FROM clients WHERE id='${id.cA}'`)).toBe("f");
  });

  describe("kể cả khi cờ ĐÃ bật (SSA bật, hoặc dữ liệu cũ)", () => {
    beforeAll(() => {
      psqlExec(`UPDATE clients SET allow_all_groups=true WHERE id='${id.cA}';`);
    });
    afterAll(() => {
      psqlExec(`UPDATE clients SET allow_all_groups=false WHERE id='${id.cA}';`);
    });

    it("danh sách user của PA VẪN chỉ trong phạm vi (không lộ toàn hệ)", async () => {
      const r = await api().get("/api/admin/users").set(bearer(paTok));
      expect(r.status).toBe(200);
      const ids = r.body.map((x: { id: string }) => x.id);
      expect(ids).toContain(id.UA); // in scope → thấy
      expect(ids).not.toContain(id.UB); // ngoài scope → KHÔNG thấy
      expect(ids).not.toContain(ssaId); // SSA → KHÔNG thấy
    });

    it("GET user ngoài phạm vi VẪN 404", async () => {
      expect(
        (await api().get(`/api/admin/users/${id.UB}`).set(bearer(paTok))).status,
      ).toBe(404);
      expect(
        (await api().get(`/api/admin/users/${ssaId}`).set(bearer(paTok))).status,
      ).toBe(404);
    });

    it("reset MK user ngoài phạm vi VẪN 404 (mutation không lọt)", async () => {
      const r = await api()
        .post(`/api/admin/users/${id.UB}/reset-password`)
        .set(bearer(paTok))
        .send({});
      expect(r.status).toBe(404);
    });

    it("export CSV của PA VẪN không chứa user ngoài phạm vi", async () => {
      const r = await api().get("/api/admin/users/export").set(bearer(paTok));
      expect(r.status).toBe(200);
      expect(r.text).toContain(`${TAG}-userA`);
      expect(r.text).not.toContain(`${TAG}-userB`);
    });
  });
});

describe("A3c — addMember không kéo được tài khoản quản trị vào group", () => {
  it("PA thêm SSA vào group mình quản → 403", async () => {
    const r = await api()
      .post(`/api/admin/groups/${id.gA}/members`)
      .set(bearer(paTok))
      .send({ userId: ssaId });
    expect(r.status).toBe(403);
    expect(
      psqlVal(
        `SELECT count(*) FROM user_groups WHERE user_id='${ssaId}' AND group_id='${id.gA}'`,
      ),
    ).toBe("0");
  });

  it("PA thêm user THƯỜNG ngoài phạm vi vào group mình quản → vẫn được (onboarding)", async () => {
    const r = await api()
      .post(`/api/admin/groups/${id.gA}/members`)
      .set(bearer(paTok))
      .send({ userId: id.UB });
    expect([200, 201]).toContain(r.status);
    // Hoàn nguyên: UB vừa lọt vào phạm vi PA, đừng để rò sang test sau.
    psqlExec(
      `DELETE FROM user_groups WHERE user_id='${id.UB}' AND group_id='${id.gA}';`,
    );
  });
});

describe("A4 — forgot-password không chạm tài khoản break-glass", () => {
  it("break-glass: trả lời đồng nhất nhưng KHÔNG phát mail/MK tạm", async () => {
    const hashBefore = psqlVal(
      `SELECT COALESCE(password_hash,'none') FROM users WHERE id='${id.BG}'`,
    );
    const r = await api()
      .post("/api/auth/forgot-password")
      .send({ email: bgEmail });
    // Không lộ sự tồn tại: vẫn 2xx như email không tồn tại.
    expect(r.status).toBeLessThan(300);
    // Nhưng KHÔNG có tác dụng phụ nào:
    expect(
      psqlVal(`SELECT count(*) FROM email_queue WHERE to_addr='${bgEmail}'`),
    ).toBe("0");
    const hashAfter = psqlVal(
      `SELECT COALESCE(password_hash,'none') FROM users WHERE id='${id.BG}'`,
    );
    expect(hashAfter).toBe(hashBefore);
  });

  it("user thường: vẫn nhận được mail đặt lại (không chặn nhầm)", async () => {
    const r = await api()
      .post("/api/auth/forgot-password")
      .send({ email: `${TAG}-userA@pmh.com.vn` });
    expect(r.status).toBeLessThan(300);
    expect(
      Number(
        psqlVal(
          `SELECT count(*) FROM email_queue WHERE to_addr='${TAG}-userA@pmh.com.vn'`,
        ),
      ),
    ).toBeGreaterThan(0);
  });
});
