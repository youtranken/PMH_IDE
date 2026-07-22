// Ký access token test (RS256, typ=at+jwt) bằng khóa ký hiện hành — CHẠY TRONG
// CONTAINER để khóa riêng KHÔNG rời container. Dùng bởi test authz e2e.
//   node scripts/sign-e2e-token.mjs <sub> <portal|m2m>
// portal: aud=pmh-portal (token người dùng qua portal — API quản trị).
// m2m:    sub=client_id=aud (client-credentials — Directory API).
import { readFileSync } from "node:fs";
import { createDecipheriv, createPrivateKey, sign as cryptoSign } from "node:crypto";

const [sub, mode = "portal"] = process.argv.slice(2);
const ISS = process.env.OIDC_ISSUER || "https://id.pmh.com.vn/oidc";
const dir = process.env.SIGNING_KEYS_DIR || "/run/secrets/signing-keys";

// Khóa ký nay MÃ HÓA at-rest bằng KEK (M1): file dạng `enc:v1:<base64 iv|tag|ct>`
// AES-256-GCM. Giải mã như KekService.decrypt trước khi parse (script chạy trong
// container nên có KEK_BASE64). Vẫn đọc được file plaintext legacy.
const ENC_PREFIX = "enc:v1:";
function loadKeys() {
  const raw = readFileSync(`${dir}/jwks.json`, "utf8").trim();
  if (!raw.startsWith(ENC_PREFIX)) return JSON.parse(raw);
  const key = Buffer.from(process.env.KEK_BASE64, "base64");
  const blob = Buffer.from(raw.slice(ENC_PREFIX.length), "base64");
  const d = createDecipheriv("aes-256-gcm", key, blob.subarray(0, 12));
  d.setAuthTag(blob.subarray(12, 28));
  const pt = Buffer.concat([d.update(blob.subarray(28)), d.final()]).toString("utf8");
  return JSON.parse(pt);
}
const jwk = loadKeys()[0];
const key = createPrivateKey({ key: jwk, format: "jwk" });
const b64 = (b) => Buffer.from(b).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const payload =
  mode === "m2m"
    ? { sub, client_id: sub, iss: ISS, aud: sub, iat: now, exp: now + 600 }
    : { sub, iss: ISS, aud: "pmh-portal", iat: now, exp: now + 600 };
const h = b64(JSON.stringify({ alg: "RS256", kid: jwk.kid, typ: "at+jwt" }));
const p = b64(JSON.stringify(payload));
const s = b64(cryptoSign("RSA-SHA256", Buffer.from(`${h}.${p}`), key));
process.stdout.write(`${h}.${p}.${s}`);
