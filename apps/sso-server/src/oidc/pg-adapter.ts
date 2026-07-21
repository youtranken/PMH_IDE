import { Logger } from "@nestjs/common";
import { Pool } from "pg";
import { deriveProviderSecret } from "./client-secret.util";

/**
 * Adapter Postgres cho oidc-provider (AD-6) — lưu mọi artifact stateful
 * (Session, Grant, AccessToken, RefreshToken, AuthorizationCode, Interaction,
 * ...) vào bảng `oidc_payloads` (PK (type,id)). Đây là NGUỒN SỰ THẬT về
 * token/phiên; bảng `sessions` chỉ là projection (AD-7).
 *
 * Bất biến an toàn:
 * - `consume()` NGUYÊN TỬ: UPDATE ... WHERE consumed_at IS NULL RETURNING.
 *   Thua race (0 row) = replay → chủ động thu hồi trọn grant.
 * - `revokeByGrantId` xóa MỌI artifact cùng grant trong một câu lệnh
 *   (1 statement = 1 transaction).
 * - `find` không trả bản ghi đã quá expires_at (fail-closed về TTL).
 * - Mỗi dòng gắn client_id (nếu có) → phục vụ thu hồi theo project (FR-05).
 *
 * Client KHÔNG đi qua adapter ở Epic 1 (client tĩnh dev từ env); E5-S5 sẽ
 * chuyển client sang DB.
 */

let pool: Pool | undefined;
let adapterKek: Buffer | undefined;
let idleSecondsFn: (() => number) | undefined;
let capSecondsFn: (() => number) | undefined;
const logger = new Logger("PgAdapter");

/** Gọi một lần ở provider factory trước khi provider dùng adapter. */
export function setAdapterPool(p: Pool): void {
  pool = p;
}

/** KEK để dẫn xuất internal secret của DB client (Path A, E5-S5). */
export function setAdapterKek(kek: Buffer): void {
  adapterKek = kek;
}

/**
 * Tham số idle/cap (giây) đọc LIVE từ Settings — để adapter gia hạn phiên theo
 * hoạt động (idle trượt, AD-7). Truyền hàm (không phải giá trị) để SSA đổi runtime
 * có hiệu lực ngay.
 */
export function setAdapterSessionTtls(
  idle: () => number,
  cap: () => number,
): void {
  idleSecondsFn = idle;
  capSecondsFn = cap;
}

/**
 * Đọc DB client cho oidc-provider (E5-S5, AD-6). Client TĨNH (demo-app, portal)
 * ở mảng `clients` của provider — không vào đây. Client DB đưa metadata + internal
 * secret (KEK-derived); client bị disable → undefined (khóa authorize + token).
 * grant/response_types suy từ redirect_uris; luôn cho client_credentials (M2M
 * Directory API — Epic 7). Secret dev thật validate ở middleware /oidc/token.
 */
async function findClient(clientId: string): Promise<OidcPayload | undefined> {
  const { rows } = await db().query<{
    client_id: string;
    redirect_uris: string[];
    app_url: string | null;
    backchannel_logout_uri: string | null;
    m2m_enabled: boolean;
  }>(
    `SELECT client_id, redirect_uris, app_url, backchannel_logout_uri, m2m_enabled
     FROM clients WHERE client_id = $1 AND disabled = false`,
    [clientId],
  );
  if (rows.length === 0) return undefined;
  const c = rows[0];
  if (!adapterKek) throw new Error("[PgAdapter] adapterKek chưa set");

  const grantTypes: string[] = [];
  const responseTypes: string[] = [];
  if (c.redirect_uris.length > 0) {
    grantTypes.push("authorization_code", "refresh_token");
    responseTypes.push("code");
  }
  // M3: chỉ cấp M2M (Directory API) cho client được bật cờ — không mặc định mở
  // cho mọi client có secret.
  if (c.m2m_enabled) {
    grantTypes.push("client_credentials");
  }

  const meta: OidcPayload = {
    client_id: c.client_id,
    client_secret: deriveProviderSecret(adapterKek, c.client_id),
    token_endpoint_auth_method: "client_secret_basic",
    grant_types: grantTypes,
    response_types: responseTypes,
    redirect_uris: c.redirect_uris,
    // App gọi RP-initiated logout với post_logout_redirect_uri = app_url. Phải
    // khai ở đây, nếu không oidc-provider từ chối ("not registered") → trang lỗi
    // và phiên SSO KHÔNG bị hủy (single-logout hỏng).
    post_logout_redirect_uris: c.app_url ? [c.app_url] : [],
    // Back-Channel Logout: khai URI → oidc-provider POST logout_token tới đây khi
    // phiên SSO kết thúc (end_session) → app đá user ra tức thì (OIDC BCL).
    ...(c.backchannel_logout_uri
      ? { backchannel_logout_uri: c.backchannel_logout_uri }
      : {}),
  };
  return meta;
}

function db(): Pool {
  if (!pool) throw new Error("[PgAdapter] pool chưa được set (setAdapterPool)");
  return pool;
}

type OidcPayload = Record<string, unknown> & {
  grantId?: string;
  userCode?: string;
  uid?: string;
  clientId?: string;
  accountId?: string;
  loginTs?: number;
};

/** Chuyển consumed_at (Date) → claim `consumed` (epoch giây) provider hiểu. */
function withConsumed(
  payload: OidcPayload,
  consumedAt: Date | null,
): OidcPayload {
  return consumedAt
    ? { ...payload, consumed: Math.floor(consumedAt.getTime() / 1000) }
    : payload;
}

export class PgAdapter {
  constructor(private readonly name: string) {}

  async upsert(
    id: string,
    payload: OidcPayload,
    expiresIn?: number,
  ): Promise<void> {
    await db().query(
      `INSERT INTO oidc_payloads
         (type, id, payload, grant_id, user_code, uid, client_id, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7,
               CASE WHEN $8::int IS NULL THEN NULL
                    ELSE now() + make_interval(secs => $8::int) END)
       ON CONFLICT (type, id) DO UPDATE SET
         payload = EXCLUDED.payload,
         grant_id = EXCLUDED.grant_id,
         user_code = EXCLUDED.user_code,
         uid = EXCLUDED.uid,
         client_id = EXCLUDED.client_id,
         expires_at = EXCLUDED.expires_at`,
      [
        this.name,
        id,
        JSON.stringify(payload),
        payload.grantId ?? null,
        payload.userCode ?? null,
        payload.uid ?? null,
        payload.clientId ?? null,
        expiresIn ?? null,
      ],
    );

    // Projection MỘT CHIỀU sang bảng `sessions` (AD-7): oidc_payloads là
    // nguồn sự thật; sessions chỉ phục vụ self-service (E6-S2) xem/thu hồi.
    if (this.name === "Session" && payload.accountId && payload.uid) {
      await db().query(
        `INSERT INTO sessions (user_id, oidc_session_uid, auth_time, last_activity)
         VALUES ($1, $2, to_timestamp($3), now())
         ON CONFLICT (oidc_session_uid) DO UPDATE SET
           last_activity = now(), revoked_at = NULL`,
        [payload.accountId, payload.uid, payload.loginTs ?? 0],
      );
    }

    // IDLE TRƯỢT (AD-7): token bound theo phiên được cấp/xoay (login hoặc mỗi lần
    // refresh khi user còn thao tác) = CÓ hoạt động → gia hạn phiên tới now()+idle,
    // chặn trần loginTs+cap. Chỉ NỚI phiên còn sống (không hồi sinh phiên đã hết);
    // đồng bộ cả cột expires_at LẪN payload.exp để provider không coi là hết hạn.
    if (
      this.name === "RefreshToken" &&
      typeof payload.sessionUid === "string" &&
      idleSecondsFn &&
      capSecondsFn
    ) {
      const idle = idleSecondsFn();
      const cap = capSecondsFn();
      await db().query(
        // COALESCE(loginTs,0): thiếu loginTs → trần = 1970 → LEAST cắt phiên về
        // quá khứ (fail-CLOSED, khớp ttl.Session), không bỏ trần (fail-open).
        `UPDATE oidc_payloads
           SET expires_at = LEAST(
                 now() + make_interval(secs => $2::int),
                 to_timestamp(COALESCE((payload->>'loginTs')::bigint, 0)) + make_interval(secs => $3::int)),
               payload = jsonb_set(payload, '{exp}', to_jsonb(
                 floor(extract(epoch FROM LEAST(
                   now() + make_interval(secs => $2::int),
                   to_timestamp(COALESCE((payload->>'loginTs')::bigint, 0)) + make_interval(secs => $3::int)
                 )))::bigint))
         WHERE type = 'Session' AND uid = $1 AND expires_at > now()`,
        [payload.sessionUid, idle, cap],
      );
      await db().query(
        `UPDATE sessions SET last_activity = now()
         WHERE oidc_session_uid = $1 AND revoked_at IS NULL`,
        [payload.sessionUid],
      );
    }
  }

  async find(id: string): Promise<OidcPayload | undefined> {
    // Client đọc từ bảng `clients` (E5-S5), KHÔNG ở oidc_payloads.
    if (this.name === "Client") return findClient(id);
    const { rows } = await db().query<{
      payload: OidcPayload;
      consumed_at: Date | null;
    }>(
      `SELECT payload, consumed_at FROM oidc_payloads
       WHERE type = $1 AND id = $2
         AND (expires_at IS NULL OR expires_at > now())`,
      [this.name, id],
    );
    if (rows.length === 0) return undefined;
    return withConsumed(rows[0].payload, rows[0].consumed_at);
  }

  async findByUid(uid: string): Promise<OidcPayload | undefined> {
    const { rows } = await db().query<{
      payload: OidcPayload;
      consumed_at: Date | null;
    }>(
      `SELECT payload, consumed_at FROM oidc_payloads
       WHERE type = $1 AND uid = $2
         AND (expires_at IS NULL OR expires_at > now())`,
      [this.name, uid],
    );
    if (rows.length === 0) return undefined;
    return withConsumed(rows[0].payload, rows[0].consumed_at);
  }

  async findByUserCode(userCode: string): Promise<OidcPayload | undefined> {
    const { rows } = await db().query<{
      payload: OidcPayload;
      consumed_at: Date | null;
    }>(
      `SELECT payload, consumed_at FROM oidc_payloads
       WHERE type = $1 AND user_code = $2
         AND (expires_at IS NULL OR expires_at > now())`,
      [this.name, userCode],
    );
    if (rows.length === 0) return undefined;
    return withConsumed(rows[0].payload, rows[0].consumed_at);
  }

  /**
   * NGUYÊN TỬ: chỉ một request thắng câu UPDATE. Thua race (đã consumed) = token
   * bị dùng lại → thu hồi trọn grant. Đọc-grant-rồi-xóa nằm TRONG một
   * transaction (AD-6/E1-S3) nên không có cửa sổ SELECT-then-DELETE bị chen.
   *
   * Residual đã biết: token winner xoay ra SAU khi loser đã DELETE có thể sống
   * sót; oidc-provider tự phát hiện tái dùng ở lần kế (grant/token mồ côi bị
   * chối) làm phòng thủ tầng hai.
   */
  async consume(id: string): Promise<void> {
    const client = await db().connect();
    try {
      await client.query("BEGIN");
      const { rowCount, rows } = await client.query<{
        grant_id: string | null;
      }>(
        `UPDATE oidc_payloads SET consumed_at = now()
         WHERE type = $1 AND id = $2 AND consumed_at IS NULL
         RETURNING grant_id`,
        [this.name, id],
      );
      if (rowCount === 0) {
        // Replay: khóa dòng để đọc grant nhất quán rồi xóa cả cụm trong txn
        const { rows: existing } = await client.query<{
          grant_id: string | null;
          acct: string | null;
        }>(
          `SELECT grant_id, payload->>'accountId' AS acct FROM oidc_payloads
           WHERE type = $1 AND id = $2 FOR UPDATE`,
          [this.name, id],
        );
        const grantId = existing[0]?.grant_id;
        if (grantId) {
          logger.warn(
            `consume() race trên ${this.name}:${id} — thu hồi grant ${grantId}`,
          );
          // Thu hồi grant là VIỆC CHÍNH — phải luôn thắng.
          await client.query(`DELETE FROM oidc_payloads WHERE grant_id = $1`, [
            grantId,
          ]);
          // Sự kiện BẢO MẬT: sau khi FE gộp refresh (single-flight), double-use
          // lành tính đã hết → replay còn lại là BẤT THƯỜNG (nghi trộm refresh
          // token). Ghi audit để không "nuốt im" tín hiệu (review Medium).
          // Best-effort: bọc SAVEPOINT để lỗi audit (vd accountId đã bị hard-
          // delete → vi phạm FK actor_user_id) KHÔNG rollback việc thu hồi.
          try {
            await client.query("SAVEPOINT audit_replay");
            await client.query(
              `INSERT INTO audit_logs (actor_user_id, action, target_type, target_id, detail)
               VALUES ($1::uuid, 'security.refresh_replay', 'grant', $2, $3::jsonb)`,
              [
                existing[0]?.acct ?? null,
                grantId,
                JSON.stringify({ token_type: this.name, token_id: id }),
              ],
            );
            await client.query("RELEASE SAVEPOINT audit_replay");
          } catch (auditErr) {
            await client.query("ROLLBACK TO SAVEPOINT audit_replay");
            logger.error(`ghi audit refresh_replay thất bại: ${String(auditErr)}`);
          }
        }
      }
      void rows;
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  async destroy(id: string): Promise<void> {
    if (this.name === "Session") {
      // Đánh dấu projection trước khi xóa nguồn (giữ dấu vết cho self-service)
      await db().query(
        `UPDATE sessions SET revoked_at = now()
         WHERE oidc_session_uid = (
           SELECT uid FROM oidc_payloads WHERE type = 'Session' AND id = $1
         ) AND revoked_at IS NULL`,
        [id],
      );
    }
    await db().query(`DELETE FROM oidc_payloads WHERE type = $1 AND id = $2`, [
      this.name,
      id,
    ]);
  }

  /** Xóa TRỌN mọi artifact cùng grant — 1 câu lệnh = nguyên tử (AD-6). */
  async revokeByGrantId(grantId: string): Promise<void> {
    await db().query(`DELETE FROM oidc_payloads WHERE grant_id = $1`, [
      grantId,
    ]);
  }
}
