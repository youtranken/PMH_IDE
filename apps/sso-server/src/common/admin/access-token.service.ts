import { createPublicKey, verify, type KeyObject } from "node:crypto";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { KeysService } from "../../oidc/keys.service";

interface AccessClaims {
  sub: string;
  iss?: string;
  aud?: string | string[];
  exp?: number;
  [k: string]: unknown;
}

/**
 * Verify access token (JWT RS256) OFFLINE — cùng cơ chế app ngoài dùng (FR-03),
 * nhưng bằng khóa CÔNG local (KeysService) thay vì gọi JWKS mạng: API quản trị
 * nằm ngay trên IdP nên tự verify được. Không thêm phụ thuộc (dùng node:crypto).
 *
 * Chỉ chấp access token của client portal (aud) → token của app khác (demo-app)
 * KHÔNG vào được API quản trị dù chủ token là admin. admin_roles vẫn là chốt
 * uỷ quyền thật (AdminGuard).
 */
@Injectable()
export class AccessTokenService {
  private readonly keysByKid = new Map<string, KeyObject>();
  private readonly issuer: string;
  private readonly portalClientId: string;

  constructor(keys: KeysService, config: ConfigService) {
    this.issuer = config.getOrThrow<string>("OIDC_ISSUER");
    this.portalClientId = config.get<string>("PORTAL_CLIENT_ID") ?? "pmh-portal";
    // Khóa ký nạp lúc boot (rotate → restart, AD-8). Chỉ giữ phần công n/e/kty.
    for (const jwk of keys.loadOrCreate()) {
      this.keysByKid.set(
        jwk.kid,
        createPublicKey({
          key: { kty: jwk.kty, n: jwk.n, e: jwk.e },
          format: "jwk",
        }),
      );
    }
  }

  /** Verify chữ ký + iss + aud=portal + hạn (token người dùng qua portal). */
  verify(token: string): AccessClaims {
    const claims = this.verifyCore(token);
    const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!aud.includes(this.portalClientId)) {
      throw new UnauthorizedException("token không dành cho portal");
    }
    if (!claims.sub) throw new UnauthorizedException("token thiếu sub");
    return claims;
  }

  /**
   * Verify access token M2M (client-credentials, Directory API — E7-S1). Không
   * đòi aud=portal; định danh = client_id (chữ ký của ta là thẩm quyền). Trả
   * client_id hoặc ném 401.
   */
  verifyM2M(token: string): string {
    const claims = this.verifyCore(token);
    const clientId = claims.client_id as string | undefined;
    if (!clientId) throw new UnauthorizedException("token thiếu client_id");
    // CHỈ client-credentials: token đó có sub === client_id. Token người dùng
    // (authorization_code) có sub = userId ≠ client_id → chặn, không cho user
    // mượn access token app để gọi Directory.
    if (claims.sub !== clientId) {
      throw new UnauthorizedException("Directory chỉ nhận token client-credentials");
    }
    return clientId;
  }

  /** Bước chung: chữ ký RS256 + kid + typ=at+jwt + iss + hạn. */
  private verifyCore(token: string): AccessClaims {
    const parts = token.split(".");
    if (parts.length !== 3) throw new UnauthorizedException("token sai định dạng");
    const [h, p, s] = parts;

    let header: { kid?: string; alg?: string; typ?: string };
    let claims: AccessClaims;
    try {
      header = JSON.parse(Buffer.from(h, "base64url").toString("utf8"));
      claims = JSON.parse(Buffer.from(p, "base64url").toString("utf8"));
    } catch {
      throw new UnauthorizedException("token không giải mã được");
    }
    if (header.alg !== "RS256" || !header.kid) {
      throw new UnauthorizedException("alg/kid không hợp lệ");
    }
    // PHẢI là access token (RFC 9068 typ=at+jwt). Chặn id_token bị dùng làm
    // chứng chỉ API: id_token cùng khóa/iss/aud=portal, KHÔNG có typ này, và lộ
    // nhiều hơn (nằm ở client/JS) — không được coi là uỷ quyền gọi API quản trị.
    if (header.typ !== "at+jwt") {
      throw new UnauthorizedException("không phải access token");
    }

    const key = this.keysByKid.get(header.kid);
    if (!key) throw new UnauthorizedException("kid không khớp khóa ký");

    const ok = verify(
      "RSA-SHA256",
      Buffer.from(`${h}.${p}`),
      key,
      Buffer.from(s, "base64url"),
    );
    if (!ok) throw new UnauthorizedException("chữ ký token sai");

    const now = Math.floor(Date.now() / 1000);
    // BẮT BUỘC có exp: token hợp lệ (portal/M2M do provider phát) luôn có exp;
    // từ chối token thiếu hạn (phòng token bất tử khi khóa bị lộ/token dị dạng).
    if (typeof claims.exp !== "number") {
      throw new UnauthorizedException("token thiếu hạn (exp)");
    }
    if (claims.exp < now) {
      throw new UnauthorizedException("token hết hạn");
    }
    if (claims.iss !== this.issuer) {
      throw new UnauthorizedException("iss không hợp lệ");
    }
    return claims;
  }
}
