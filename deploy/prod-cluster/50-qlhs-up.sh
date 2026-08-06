#!/usr/bin/env bash
# 50 — Lên QLHS trong cụm edge (base + prod overlay). Yêu cầu: đã đăng ký client QLHS ở PMH ID,
# điền apps/api/.env, đặt cert vào QLHS_DE/pmh.com.vn. Chạy: bash 50-qlhs-up.sh
set -euo pipefail

PMH_ROOT="${PMH_ROOT:-$HOME}"
QLHS="${PMH_ROOT}/QLHS_DE"
cd "$QLHS"
# .env Ở GỐC repo: compose QLHS `env_file: - .env` + update-qlhs.sh đều đọc GỐC. Ở prod
# (NODE_ENV=production) dotenv KHÔNG override nên env container = file gốc này (KHÔNG phải apps/api/.env).
ENVF=".env"
CJ=(docker compose -f docker-compose.yml -f docker-compose.prod.yml)

echo "==> [0/4] Kiểm .env + cert"
if [ ! -f "$ENVF" ]; then
  echo "!! Chưa có ${QLHS}/${ENVF} — copy template rồi điền:" >&2
  echo "   cp ${PMH_ROOT}/PMH_IDE/deploy/prod-cluster/env-templates/qlhs.env.example ${QLHS}/${ENVF} && nano ${QLHS}/${ENVF}" >&2
  exit 1
fi
if grep -vE '^[[:space:]]*#' "$ENVF" | grep -q CHANGE_ME; then
  echo "!! ${ENVF} còn CHANGE_ME (OIDC_CLIENT_SECRET + QLHS_LOCAL_ADMIN_PASSWORD) — điền trước." >&2
  exit 1
fi
# KHÔNG cần cert riêng cho QLHS: prod overlay cho web chạy chỉ :80, edge lo cert chung.
grep -q 'OIDC_ISSUER=https://de-admin.pmh.com.vn:8443/oidc' "$ENVF" || echo "   ⚠️ OIDC_ISSUER nên là https://de-admin.pmh.com.vn:8443/oidc"
grep -q 'OIDC_CLIENT_ID=project-qlhs' "$ENVF" || echo "   ⚠️ OIDC_CLIENT_ID phải KHỚP client đăng ký ở PMH ID (đặt 'project-qlhs')."

echo "==> [1/4] Kiểm mạng edge"
docker network inspect edge >/dev/null 2>&1 || { echo "!! Chưa có mạng edge (dựng PMH ID trước)." >&2; exit 1; }

echo "==> [2/4] Lên QLHS (base + prod overlay — web+api join edge)"
# Bắc cầu mật khẩu DB từ .env (gốc) vào shell để compose thay ${POSTGRES_PASSWORD}/${QLHS_APP_PASSWORD}
set -a; . <(grep -E '^(POSTGRES_PASSWORD|QLHS_APP_PASSWORD)=' "$ENVF" || true); set +a
{ [ -n "${POSTGRES_PASSWORD:-}" ] && [ -n "${QLHS_APP_PASSWORD:-}" ]; } || {
  echo "!! ${ENVF} thiếu POSTGRES_PASSWORD / QLHS_APP_PASSWORD — sinh bằng gen-secrets.sh rồi dán vào." >&2; exit 1; }
"${CJ[@]}" up -d --build

echo "==> [3/4] Chờ QLHS health qua edge (~90s: migrate + boot)"
ok=0
for i in $(seq 1 30); do
  code=$(curl -sk -o /dev/null -w '%{http_code}' -H 'Host: de-qlhs.pmh.com.vn' https://localhost:8443/api/health || true)
  [[ "$code" == "200" ]] && { ok=1; echo "    health OK (200)"; break; }
  echo "    ...chờ (HTTP ${code:-x}) ${i}/30"; sleep 3
done
echo
"${CJ[@]}" ps
[[ "$ok" == 1 ]] || { echo "!! Chưa 200 — log: cd ${QLHS} && ${CJ[*]} logs -f api" >&2; exit 1; }
echo "==> [4/4] XONG 50. Test đăng nhập SSO trên trình duyệt: https://de-qlhs.pmh.com.vn:8443"
