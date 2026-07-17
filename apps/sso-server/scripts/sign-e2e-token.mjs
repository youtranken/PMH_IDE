// Ký access token test (RS256, typ=at+jwt) bằng khóa ký hiện hành — CHẠY TRONG
// CONTAINER để khóa riêng KHÔNG rời container. Dùng bởi test authz e2e.
//   node scripts/sign-e2e-token.mjs <sub> <portal|m2m>
// portal: aud=pmh-portal (token người dùng qua portal — API quản trị).
// m2m:    sub=client_id=aud (client-credentials — Directory API).
import { readFileSync } from "node:fs";
import { createPrivateKey, sign as cryptoSign } from "node:crypto";

const [sub, mode = "portal"] = process.argv.slice(2);
const ISS = process.env.OIDC_ISSUER || "https://id.pmh.com.vn/oidc";
const dir = process.env.SIGNING_KEYS_DIR || "/run/secrets/signing-keys";
const jwk = JSON.parse(readFileSync(`${dir}/jwks.json`, "utf8"))[0];
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
