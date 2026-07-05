import { createHash, generateKeyPairSync } from "node:crypto";

/** JWK RSA private (đủ trường để ký RS256). */
export interface RsaPrivateJwk {
  kty: "RSA";
  kid: string;
  use: "sig";
  alg: "RS256";
  n: string;
  e: string;
  d: string;
  p: string;
  q: string;
  dp: string;
  dq: string;
  qi: string;
}

/** kid = RFC 7638 JWK thumbprint (SHA-256 trên {e,kty,n} thứ tự từ điển). */
export function jwkThumbprint(jwk: { e: string; kty: string; n: string }): string {
  return createHash("sha256")
    .update(JSON.stringify({ e: jwk.e, kty: jwk.kty, n: jwk.n }))
    .digest("base64url");
}

/**
 * Sinh khóa ký RSA-2048 dạng JWK có kid. NGUỒN DUY NHẤT — cả KeysService (app)
 * lẫn CLI rotate-key đều dùng để kid luôn nhất quán (Yui: tránh 2 công thức).
 */
export function generateRsaJwk(): RsaPrivateJwk {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = privateKey.export({ format: "jwk" }) as Omit<
    RsaPrivateJwk,
    "kid" | "use" | "alg"
  >;
  return {
    ...jwk,
    kid: jwkThumbprint(jwk),
    use: "sig",
    alg: "RS256",
  };
}
