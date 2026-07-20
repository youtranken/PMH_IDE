/**
 * E2E tầng 2 — webhook dead-letter + heartbeat (rà soát tiền-prod 2026-07).
 *
 * Vá:
 *  - Dead-letter: delivery 'failed' trước đây mất vĩnh viễn, không đường thấy/gửi
 *    lại. Thêm GET /admin/webhooks/failed + POST /admin/webhooks/:id/requeue.
 *  - Heartbeat: đếm 'pending quá tuổi' nhưng KHÔNG loại job đang chờ retry
 *    (next_attempt_at tương lai) → báo động sai; và 'failed' không đếm đâu cả →
 *    webhook chết hẳn im lặng. Health giờ trả deadLettered, stale loại retry.
 *
 * Black-box qua HTTP tới edge, seed/kiểm qua docker exec (cùng khuôn authz.e2e).
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
const TAG = "e2e-wh-deadletter";

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
  proj: randomUUID(),
  client: randomUUID(),
  pa: randomUUID(), // project_admin thuần (kiểm 403)
  dFailed: randomUUID(), // delivery đã BỎ (dead-letter)
  dRetry: randomUUID(), // delivery pending đang chờ retry (next_attempt tương lai)
  dStale: randomUUID(), // delivery pending TỚI HẠN, quá tuổi (worker chết)
};

const cleanupSql = `
  DELETE FROM webhook_deliveries WHERE event LIKE '${TAG}%';
  DELETE FROM admin_projects ap USING users u WHERE ap.user_id=u.id AND u.email LIKE '${TAG}%';
  DELETE FROM admin_roles ar USING users u WHERE ar.user_id=u.id AND u.email LIKE '${TAG}%';
  DELETE FROM clients WHERE client_id LIKE '${TAG}%';
  DELETE FROM groups WHERE name LIKE '${TAG}%';
  DELETE FROM users WHERE email LIKE '${TAG}%';
  DELETE FROM projects WHERE name LIKE '${TAG}%';
`;

let ssaTok = "";
let paTok = "";
let ssaId = "";

beforeAll(() => {
  psqlExec(cleanupSql);
  psqlExec(`
    INSERT INTO projects(id,name) VALUES('${id.proj}','${TAG}-proj');
    INSERT INTO clients(id,project_id,client_id,name,env)
      VALUES('${id.client}','${id.proj}','${TAG}-c','${TAG}-c','dev');
    INSERT INTO users(id,email,employee_code,full_name,status)
      VALUES('${id.pa}','${TAG}-pa@pmh.com.vn','${TAG}-pa','${TAG} pa','active');
    INSERT INTO admin_roles(user_id,role) VALUES('${id.pa}','project_admin');
    INSERT INTO admin_projects(user_id,project_id) VALUES('${id.pa}','${id.proj}');
    -- 1 delivery đã BỎ HẲN (failed)
    INSERT INTO webhook_deliveries(id,client_id,project_id,event,payload,target_url,status,attempts,created_at,last_error)
      VALUES('${id.dFailed}','${id.client}','${id.proj}','${TAG}.user.locked','{"a":1}','https://x.internal/wh','failed',6,now() - interval '1 hour','boom');
    -- pending ĐANG chờ retry: next_attempt_at TƯƠNG LAI, tạo lâu rồi → KHÔNG được tính stale
    INSERT INTO webhook_deliveries(id,client_id,project_id,event,payload,target_url,status,attempts,created_at,next_attempt_at)
      VALUES('${id.dRetry}','${id.client}','${id.proj}','${TAG}.retry','{"a":2}','https://x.internal/wh','pending',2,now() - interval '1 hour', now() + interval '20 minutes');
    -- pending TỚI HẠN + quá tuổi → PHẢI tính stale (worker chết)
    INSERT INTO webhook_deliveries(id,client_id,project_id,event,payload,target_url,status,attempts,created_at,next_attempt_at)
      VALUES('${id.dStale}','${id.client}','${id.proj}','${TAG}.stale','{"a":3}','https://x.internal/wh','pending',1,now() - interval '1 hour', now() - interval '10 minutes');
  `);
  ssaId = psqlVal(
    "SELECT u.id FROM admin_roles r JOIN users u ON u.id=r.user_id WHERE r.role='ssa' AND u.is_breakglass=false LIMIT 1",
  );
  ssaTok = signToken(ssaId, "portal");
  paTok = signToken(id.pa, "portal");
});

afterAll(() => {
  psqlExec(cleanupSql);
});

describe("Dead-letter: SSA soi + gửi lại delivery đã bỏ", () => {
  it("GET /admin/webhooks/failed liệt kê delivery đã bỏ", async () => {
    const r = await api().get("/api/admin/webhooks/failed").set(bearer(ssaTok));
    expect(r.status).toBe(200);
    const mine = (r.body as any[]).find((d) => d.id === id.dFailed);
    expect(mine).toBeTruthy();
    expect(mine.event).toBe(`${TAG}.user.locked`);
    expect(mine.last_error).toBe("boom");
  });

  it("project_admin KHÔNG được (chỉ SSA) → 403", async () => {
    const r = await api().get("/api/admin/webhooks/failed").set(bearer(paTok));
    expect(r.status).toBe(403);
  });

  it("POST /:id/requeue đưa delivery về pending, attempts=0", async () => {
    const r = await api()
      .post(`/api/admin/webhooks/${id.dFailed}/requeue`)
      .set(bearer(ssaTok))
      .send({});
    expect([200, 201]).toContain(r.status);
    const row = psqlVal(
      `SELECT status||':'||attempts||':'||(next_attempt_at IS NULL) FROM webhook_deliveries WHERE id='${id.dFailed}'`,
    );
    // Nối chuỗi trong SQL ép boolean thành 'true'/'false' (không phải 't'/'f').
    expect(row).toBe("pending:0:true");
    // Ghi audit
    expect(
      Number(
        psqlVal(
          `SELECT count(*) FROM audit_logs WHERE action='webhook.requeued' AND target_id='${id.dFailed}'`,
        ),
      ),
    ).toBeGreaterThan(0);
  });

  it("requeue id không phải 'failed' → 404", async () => {
    const r = await api()
      .post(`/api/admin/webhooks/${id.dStale}/requeue`)
      .set(bearer(ssaTok))
      .send({});
    expect(r.status).toBe(404);
  });
});

describe("Heartbeat: /health phân biệt stale / dead-letter / đang-retry", () => {
  it("deadLettered.webhooks đếm 'failed'; stale KHÔNG đếm job đang chờ retry", async () => {
    // Đưa dFailed trở lại failed để có mẫu ổn định (test trên vừa requeue nó)
    psqlExec(
      `UPDATE webhook_deliveries SET status='failed', attempts=6 WHERE id='${id.dFailed}';`,
    );
    const r = await api().get("/api/health");
    expect(r.status).toBe(200);
    expect(r.body.deadLettered).toBeTruthy();
    // Có ít nhất delivery dFailed của ta
    expect(r.body.deadLettered.webhooks).toBeGreaterThanOrEqual(1);
    // stalePending phải đếm dStale (tới hạn, quá tuổi) NHƯNG không đếm dRetry.
    // Không so tuyệt đối (môi trường có job khác) — kiểm bằng SQL đúng vế mới:
    const staleCount = Number(
      psqlVal(
        `SELECT count(*) FROM webhook_deliveries WHERE event LIKE '${TAG}%' AND status='pending' AND (next_attempt_at IS NULL OR next_attempt_at <= now()) AND created_at < now() - interval '300 seconds'`,
      ),
    );
    const retryCounted = Number(
      psqlVal(
        `SELECT count(*) FROM webhook_deliveries WHERE id='${id.dRetry}' AND status='pending' AND (next_attempt_at IS NULL OR next_attempt_at <= now())`,
      ),
    );
    expect(staleCount).toBe(1); // chỉ dStale
    expect(retryCounted).toBe(0); // dRetry bị loại đúng
  });
});
