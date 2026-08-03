#!/usr/bin/env bash
# 40 — Lên QLTS ở chế độ prod (KHÔNG nạp docker-compose.override.yml của dev).
# Yêu cầu: đã đăng ký client QLTS trong PMH ID và điền QLTS_DE/.env. Chạy: bash 40-qlts-up.sh
set -euo pipefail

PMH_ROOT="${PMH_ROOT:-/opt/pmh}"
QLTS="${PMH_ROOT}/QLTS_DE"
cd "${QLTS}"

echo "==> [0/3] Kiểm .env"
if [[ ! -f "${QLTS}/.env" ]]; then
  echo "!! Chưa có ${QLTS}/.env — copy template rồi điền:" >&2
  echo "   cp ${PMH_ROOT}/PMH_IDE/deploy/prod-cluster/env-templates/qlts.env.example ${QLTS}/.env && nano ${QLTS}/.env" >&2
  exit 1
fi
if grep -q "CHANGE_ME" "${QLTS}/.env"; then
  echo "!! ${QLTS}/.env còn CHANGE_ME — cần PMH_CLIENT_ID/SECRET (từ UI PMH ID), secret DB/Redis, LOCAL_SA_PASSWORD_HASH." >&2
  exit 1
fi
# Cảnh báo bất biến :8443
grep -q 'APP_BASE_URL=https://qlts.pmh.com.vn:8443' "${QLTS}/.env" || echo "   ⚠️  APP_BASE_URL nên là https://qlts.pmh.com.vn:8443 (có :8443)."
grep -q 'PMH_ISSUER_URL=https://admin-de.pmh.com.vn:8443/oidc' "${QLTS}/.env" || echo "   ⚠️  PMH_ISSUER_URL nên là https://admin-de.pmh.com.vn:8443/oidc."

echo "==> [1/3] Kiểm mạng edge"
docker network inspect edge >/dev/null 2>&1 || { echo "!! Chưa có mạng edge (chạy 20-edge-up.sh)." >&2; exit 1; }

echo "==> [2/3] Lên QLTS (prod, chỉ -f docker-compose.yml)"
docker compose -f docker-compose.yml up -d --build

echo "==> [3/3] Chờ QLTS health (~90s: migrate + boot)"
ok=0
for i in $(seq 1 30); do
  code=$(curl -sk -o /dev/null -w '%{http_code}' -H 'Host: qlts.pmh.com.vn' https://localhost:8443/api/health || true)
  if [[ "${code}" == "200" ]]; then ok=1; echo "    health OK (200)"; break; fi
  echo "    ...chưa sẵn sàng (HTTP ${code:-x}), thử lại ${i}/30"; sleep 3
done

echo
docker compose -f docker-compose.yml ps
if [[ "${ok}" -ne 1 ]]; then
  echo "!! Chưa lên 200. Log:  cd ${QLTS} && docker compose -f docker-compose.yml logs -f api" >&2
  exit 1
fi
echo "XONG 40. Tiếp theo: bash 90-verify.sh và test đăng nhập SSO trên trình duyệt."
