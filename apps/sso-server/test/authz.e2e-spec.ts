/**
 * E2E authz cụm A01 (OWASP A01 Broken Access Control) — jest + supertest.
 *
 * Kiểm phạm vi project_admin ở admin/users, admin/groups, directory events sau
 * khi vá C1/H1/H2/M1/M2/M3. BLACK-BOX qua HTTP tới edge (KHÔNG boot app → né ESM
 * oidc-provider). Seed/teardown qua `docker exec psql` và ký token qua
 * `docker exec node sign-e2e-token` để DB creds + khóa ký KHÔNG rời container.
 *
 * Cần: stack dev đang chạy (pmh-id-postgres-1, pmh-id-sso-server-1, edge 443).
 * Chạy: pnpm --filter @pmh/sso-server test:e2e
 */
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import request from "supertest";

// Cert wildcard tự ký ở edge dev → tắt verify cho tiến trình test.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const BASE = process.env.E2E_BASE_URL || "https://id.pmh.com.vn";
const PG = process.env.E2E_PG_CONTAINER || "pmh-id-postgres-1";
const SSO = process.env.E2E_SSO_CONTAINER || "pmh-id-sso-server-1";
const DBU = process.env.E2E_DB_USER || "pmhid";
const DB = process.env.E2E_DB_NAME || "pmhid";
const TAG = "e2e-authz-jest";

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

// UUID sinh phía test → biết trước id, không cần parse output seed.
const id = {
  projA: randomUUID(),
  projB: randomUUID(),
  gA: randomUUID(),
  gB: randomUUID(),
  cA: randomUUID(),
  cB: randomUUID(),
  PA: randomUUID(), // project_admin của projA
  UA: randomUUID(), // member gA → trong phạm vi PA
  UB: randomUUID(), // member gB → ngoài phạm vi PA
  AA: randomUUID(), // member gA (in scope) + admin_role → chặn sửa (403)
};
const gAname = `${TAG}-gA`;
const gBname = `${TAG}-gB`;
const cleanupSql = `
  DELETE FROM user_groups ug USING users u WHERE ug.user_id=u.id AND u.email LIKE '${TAG}%';
  DELETE FROM admin_projects ap USING users u WHERE ap.user_id=u.id AND u.email LIKE '${TAG}%';
  DELETE FROM admin_roles ar USING users u WHERE ar.user_id=u.id AND u.email LIKE '${TAG}%';
  DELETE FROM client_groups cg USING clients c WHERE cg.client_id=c.id AND c.client_id LIKE '${TAG}%';
  DELETE FROM clients WHERE client_id LIKE '${TAG}%';
  DELETE FROM groups WHERE name LIKE '${TAG}%';
  DELETE FROM users WHERE email LIKE '${TAG}%';
  DELETE FROM projects WHERE name LIKE '${TAG}%';
`;

let paTok = "";
let ssaTok = "";
let m2mTok = "";
let ssaId = "";
let minSeq = 0;

beforeAll(() => {
  psqlExec(cleanupSql); // dọn tàn dư lần trước
  const u = (uid: string, tag: string) =>
    `INSERT INTO users(id,email,employee_code,full_name,status) VALUES('${uid}','${TAG}-${tag}@pmh.com.vn','${TAG}-${tag}','${TAG} ${tag}','active');`;
  psqlExec(`
    INSERT INTO projects(id,name) VALUES('${id.projA}','${TAG}-projA'),('${id.projB}','${TAG}-projB');
    INSERT INTO groups(id,name) VALUES('${id.gA}','${gAname}'),('${id.gB}','${gBname}');
    INSERT INTO clients(id,project_id,client_id,name,env) VALUES
      ('${id.cA}','${id.projA}','${TAG}-cA','${TAG}-cA','dev'),
      ('${id.cB}','${id.projB}','${TAG}-cB','${TAG}-cB','dev');
    INSERT INTO client_groups(client_id,group_id) VALUES('${id.cA}','${id.gA}'),('${id.cB}','${id.gB}');
    UPDATE clients SET m2m_enabled = true WHERE id IN ('${id.cA}','${id.cB}');
    ${u(id.PA, "admin")}${u(id.UA, "userA")}${u(id.UB, "userB")}${u(id.AA, "adminInScope")}
    INSERT INTO admin_roles(user_id,role) VALUES('${id.PA}','project_admin'),('${id.AA}','project_admin');
    INSERT INTO admin_projects(user_id,project_id) VALUES('${id.PA}','${id.projA}'),('${id.AA}','${id.projB}');
    INSERT INTO user_groups(user_id,group_id) VALUES
      ('${id.PA}','${id.gA}'),('${id.UA}','${id.gA}'),('${id.UB}','${id.gB}'),('${id.AA}','${id.gA}');
  `);
  ssaId = psqlVal(
    "SELECT u.id FROM admin_roles r JOIN users u ON u.id=r.user_id WHERE r.role='ssa' AND u.is_breakglass=false LIMIT 1",
  );
  minSeq = Number(psqlVal("SELECT COALESCE(min(seq),1) FROM user_events"));
  paTok = signToken(id.PA, "portal");
  ssaTok = signToken(ssaId, "portal");
  m2mTok = signToken(`${TAG}-cA`, "m2m");
});

afterAll(() => {
  psqlExec(cleanupSql);
});

describe("A01 — admin/users lọc phạm vi (H1)", () => {
  it("PA chỉ thấy user trong phạm vi; SSA toàn cục", async () => {
    const r = await api().get("/api/admin/users").set(bearer(paTok));
    expect(r.status).toBe(200);
    const ids = r.body.map((x: any) => x.id);
    expect(ids).toContain(id.UA);
    expect(ids).not.toContain(id.UB);
    expect(ids).not.toContain(ssaId);

    const rs = await api().get("/api/admin/users").set(bearer(ssaTok));
    const sids = rs.body.map((x: any) => x.id);
    expect(sids).toContain(id.UB);
    expect(sids).toContain(ssaId);
  });

  it("GET /:id — trong phạm vi 200, ngoài 404", async () => {
    expect((await api().get(`/api/admin/users/${id.UA}`).set(bearer(paTok))).status).toBe(200);
    expect((await api().get(`/api/admin/users/${id.UB}`).set(bearer(paTok))).status).toBe(404);
    expect((await api().get(`/api/admin/users/${ssaId}`).set(bearer(paTok))).status).toBe(404);
  });
});

describe("A01 — PATCH /admin/users/:id (C1 leo thang)", () => {
  it("sửa user trong phạm vi = 200", async () => {
    const r = await api()
      .patch(`/api/admin/users/${id.UA}`)
      .set(bearer(paTok))
      .send({ fullName: `${TAG} edited` });
    expect(r.status).toBe(200);
  });

  it("sửa user ngoài phạm vi = 404", async () => {
    const r = await api()
      .patch(`/api/admin/users/${id.UB}`)
      .set(bearer(paTok))
      .send({ email: `${TAG}-hack@evil.com` });
    expect(r.status).toBe(404);
  });

  it("đổi email SSA (ngoài phạm vi) bị CHẶN + email nguyên vẹn", async () => {
    const r = await api()
      .patch(`/api/admin/users/${ssaId}`)
      .set(bearer(paTok))
      .send({ email: `${TAG}-hack@evil.com` });
    expect(r.status).toBe(404);
    const em = psqlVal(`SELECT email FROM users WHERE id='${ssaId}'`);
    expect(em).not.toContain("evil.com");
  });

  it("sửa admin trong phạm vi = 403 (không sửa được tài khoản quản trị khác)", async () => {
    const r = await api()
      .patch(`/api/admin/users/${id.AA}`)
      .set(bearer(paTok))
      .send({ email: `${TAG}-hack@evil.com` });
    expect(r.status).toBe(403);
  });

  it("C1a — PA đổi EMAIL user THƯỜNG trong phạm vi = 403 + email nguyên vẹn", async () => {
    const before = psqlVal(`SELECT email FROM users WHERE id='${id.UA}'`);
    const r = await api()
      .patch(`/api/admin/users/${id.UA}`)
      .set(bearer(paTok))
      .send({ email: `${TAG}-hijack@evil.com` });
    expect(r.status).toBe(403);
    expect(psqlVal(`SELECT email FROM users WHERE id='${id.UA}'`)).toBe(before);
  });

  it("C1a — PA đổi MÃ NV user trong phạm vi = 403", async () => {
    const r = await api()
      .patch(`/api/admin/users/${id.UA}`)
      .set(bearer(paTok))
      .send({ employeeCode: `${TAG}-newcode` });
    expect(r.status).toBe(403);
  });

  it("C1a — SSA đổi email in-scope vẫn được = 200", async () => {
    const r = await api()
      .patch(`/api/admin/users/${id.UA}`)
      .set(bearer(ssaTok))
      .send({ email: `${TAG}-userA2@pmh.com.vn` });
    expect(r.status).toBe(200);
  });
});

describe("A01 — client_groups chặn chiếm group project khác (C1b)", () => {
  it("PA gán group của project KHÁC (gB) vào client mình (cA) = 403", async () => {
    const r = await api()
      .post(`/api/admin/clients/${id.cA}/groups`)
      .set(bearer(paTok))
      .send({ groupId: id.gB });
    expect(r.status).toBe(403);
  });

  it("PA gán group TỰ DO (mới tạo, chưa gắn client) vào cA = 201", async () => {
    const g = await api()
      .post("/api/admin/groups")
      .set(bearer(paTok))
      .send({ name: `${TAG}-freeG` });
    expect(g.status).toBe(201);
    const r = await api()
      .post(`/api/admin/clients/${id.cA}/groups`)
      .set(bearer(paTok))
      .send({ groupId: g.body.id });
    expect(r.status).toBe(201);
  });

  it("SSA gán gB vào cA = 201 (thiết lập chia sẻ xuyên project)", async () => {
    const r = await api()
      .post(`/api/admin/clients/${id.cA}/groups`)
      .set(bearer(ssaTok))
      .send({ groupId: id.gB });
    expect(r.status).toBe(201);
    // Dọn NGAY attachment gB→cA (projA): nếu để lại, các describe sau (H2 CSV,
    // M3 groups) sẽ coi gB in-scope của PA → false-fail. Cô lập test.
    psqlExec(`DELETE FROM client_groups WHERE client_id='${id.cA}' AND group_id='${id.gB}';`);
  });
});

describe("A01 — quên/đặt lại mật khẩu bằng link (C2)", () => {
  it("forgot-password KHÔNG đổi password_hash + tạo reset token", async () => {
    const before = psqlVal(
      `SELECT COALESCE(password_hash,'∅') FROM users WHERE id='${id.UA}'`,
    );
    // Lấy email HIỆN TẠI của UA (test C1a-SSA phía trên có thể đã đổi).
    const email = psqlVal(`SELECT email FROM users WHERE id='${id.UA}'`);
    const r = await api().post("/api/auth/forgot-password").send({ email });
    expect(r.status).toBe(201);
    // MK hiện tại KHÔNG bị đụng (mắt xích DoS/takeover đã cắt).
    expect(
      psqlVal(`SELECT COALESCE(password_hash,'∅') FROM users WHERE id='${id.UA}'`),
    ).toBe(before);
    // Có phát hành token đặt lại.
    const cnt = psqlVal(
      `SELECT count(*) FROM password_reset_tokens WHERE user_id='${id.UA}' AND used_at IS NULL`,
    );
    expect(Number(cnt)).toBeGreaterThan(0);
  });

  it("reset-password với token sai = 400", async () => {
    const r = await api()
      .post("/api/auth/reset-password")
      .send({ token: `deadbeef-${randomUUID()}`, password: "Abcd1234!@#$" });
    expect(r.status).toBe(400);
  });
});

describe("A01 — CSV import chặn group ngoài phạm vi (H2)", () => {
  const csv = `employee_code,email,full_name,groups\n${TAG}-imp1,${TAG}-imp1@pmh.com.vn,Imp One,${gAname}\n${TAG}-imp2,${TAG}-imp2@pmh.com.vn,Imp Two,${gBname}`;

  it("PA: row group in-scope ok, row out-of-scope error", async () => {
    const r = await api()
      .post("/api/admin/users/import/preview")
      .set(bearer(paTok))
      .send({ csv, autoCreateGroups: false });
    expect(r.status).toBe(201);
    const rows = r.body.rows as any[];
    const row1 = rows.find((x) => x.data.employee_code === `${TAG}-imp1`);
    const row2 = rows.find((x) => x.data.employee_code === `${TAG}-imp2`);
    expect(row1.status).toBe("ok");
    expect(row2.status).toBe("error");
    expect(row2.errors.some((e: string) => e.includes("ngoài phạm vi"))).toBe(true);
  });

  it("SSA: cả hai row ok (toàn cục)", async () => {
    const r = await api()
      .post("/api/admin/users/import/preview")
      .set(bearer(ssaTok))
      .send({ csv, autoCreateGroups: false });
    expect((r.body.rows as any[]).every((x) => x.status === "ok")).toBe(true);
  });
});

describe("A01 — admin/groups đọc theo phạm vi (M3)", () => {
  it("group in-scope 200, out-of-scope 403 (get + members)", async () => {
    expect((await api().get(`/api/admin/groups/${id.gA}`).set(bearer(paTok))).status).toBe(200);
    expect((await api().get(`/api/admin/groups/${id.gB}`).set(bearer(paTok))).status).toBe(403);
    expect((await api().get(`/api/admin/groups/${id.gB}/members`).set(bearer(paTok))).status).toBe(403);
  });
});

describe("A01 — directory events không lộ detail (M2)", () => {
  it("feed chỉ {seq,user_id,event_type}", async () => {
    const r = await api()
      .get(`/api/v1/events?since=${minSeq - 1}&limit=50`)
      .set(bearer(m2mTok));
    expect(r.status).toBe(200);
    const evs = (r.body.events || []) as any[];
    for (const e of evs) {
      expect(Object.keys(e).sort()).toEqual(["event_type", "seq", "user_id"]);
    }
  });
});
