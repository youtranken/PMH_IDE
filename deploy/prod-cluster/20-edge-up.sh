#!/usr/bin/env bash
# 20 — Tạo mạng edge (subnet GHIM) + dựng EDGE nginx (cổng vào 80 + 8443).
# Chạy: bash 20-edge-up.sh
set -euo pipefail

PMH_ROOT="${PMH_ROOT:-$HOME}"
IDP="${PMH_ROOT}/PMH_IDE"
CERT_DIR="${IDP}/deploy/nginx/certs"

echo "==> [1/3] Kiểm chứng chỉ TLS thật"
for f in fullchain.pem privkey.pem; do
  if [[ ! -s "${CERT_DIR}/${f}" ]]; then
    echo "!! Thiếu ${CERT_DIR}/${f}" >&2
    echo "   Đặt cert thật *.pmh.com.vn vào thư mục này rồi chạy lại (xem README mục 0)." >&2
    exit 1
  fi
done
# Cảnh báo nếu cert sắp/đã hết hạn (không chặn)
if command -v openssl >/dev/null 2>&1; then
  if ! openssl x509 -checkend 604800 -noout -in "${CERT_DIR}/fullchain.pem" >/dev/null 2>&1; then
    echo "   ⚠️  CẢNH BÁO: cert hết hạn trong <7 ngày (hoặc đã hết hạn). Nên gia hạn."
  fi
  echo "   Cert CN/SAN: $(openssl x509 -noout -subject -in "${CERT_DIR}/fullchain.pem" 2>/dev/null || true)"
fi

echo "==> [2/3] Tạo mạng docker 'edge' (subnet ghim 172.20.0.0/16)"
if docker network inspect edge >/dev/null 2>&1; then
  echo "    mạng 'edge' đã tồn tại — bỏ qua."
else
  docker network create --subnet 172.20.0.0/16 --gateway 172.20.0.1 edge
fi

echo "==> [3/3] Dựng EDGE nginx"
docker compose -f "${IDP}/deploy/edge/docker-compose.yml" up -d

echo
docker compose -f "${IDP}/deploy/edge/docker-compose.yml" ps
echo "XONG 20. EDGE đang nghe 80 + 8443. Tiếp theo: điền PMH_IDE/.env rồi bash 30-idp-up.sh"
