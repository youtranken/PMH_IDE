#!/usr/bin/env bash
# 30 — Lên PMH ID (admin-de) theo overlay prod: build → init khóa ký (nếu host trắng) →
#      up → chờ /api/health. Chạy: bash 30-idp-up.sh
set -euo pipefail

PMH_ROOT="${PMH_ROOT:-/opt/pmh}"
IDP="${PMH_ROOT}/PMH_IDE"
cd "${IDP}"

COMPOSE=(docker compose --env-file .env -f deploy/docker-compose.yml -f deploy/docker-compose.prod.yml)

echo "==> [0/5] Kiểm .env"
if [[ ! -f "${IDP}/.env" ]]; then
  echo "!! Chưa có ${IDP}/.env — copy template rồi điền:" >&2
  echo "   cp deploy/prod-cluster/env-templates/idp.env.example ${IDP}/.env && nano ${IDP}/.env" >&2
  exit 1
fi
if grep -q "CHANGE_ME" "${IDP}/.env"; then
  echo "!! ${IDP}/.env còn giá trị CHANGE_ME — điền hết secret trước (bash gen-secrets.sh)." >&2
  exit 1
fi

echo "==> [1/5] Kiểm mạng edge (phải chạy 20-edge-up.sh trước)"
docker network inspect edge >/dev/null 2>&1 || { echo "!! Chưa có mạng edge. Chạy 20-edge-up.sh." >&2; exit 1; }

echo "==> [2/5] Build image sso-server"
"${COMPOSE[@]}" build sso-server

echo "==> [3/5] Khóa ký JWT — init nếu đây là host trắng (chưa có jwks.json)"
if "${COMPOSE[@]}" run --rm sso-server sh -c 'test -f /run/secrets/signing-keys/jwks.json' >/dev/null 2>&1; then
  echo "    Đã có khóa ký — bỏ qua init (không rotate)."
else
  echo "    Chưa có khóa ký → init lần đầu (ghi dạng mã hóa KEK)."
  "${COMPOSE[@]}" run --rm sso-server node scripts/rotate-key.js init
fi

echo "==> [4/5] Lên toàn stack PMH ID (prod: FE tĩnh, tắt mailpit)"
"${COMPOSE[@]}" up -d --build

echo "==> [5/5] Chờ /api/health (tối đa ~90s; migration chạy lần đầu có thể lâu)"
ok=0
for i in $(seq 1 30); do
  code=$(curl -sk -o /dev/null -w '%{http_code}' -H 'Host: admin-de.pmh.com.vn' https://localhost:8443/api/health || true)
  if [[ "${code}" == "200" ]]; then ok=1; echo "    health OK (200)"; break; fi
  echo "    ...chưa sẵn sàng (HTTP ${code:-x}), thử lại ${i}/30"; sleep 3
done

echo
"${COMPOSE[@]}" ps
if [[ "${ok}" -ne 1 ]]; then
  echo "!! Chưa lên 200. Xem log:  docker compose --env-file .env -f deploy/docker-compose.yml -f deploy/docker-compose.prod.yml logs -f sso-server" >&2
  exit 1
fi
echo "XONG 30. Tiếp theo: bash 31-idp-bootstrap-admin.sh để tạo tài khoản quản trị SSA."
