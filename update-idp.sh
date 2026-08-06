#!/usr/bin/env bash
# update-idp — cập nhật PMH ID lên code mới nhất trên GitHub.
# Backup an toàn → git pull (ff-only) → rebuild + recreate (migration tự chạy lúc boot) → chờ health.
# Chạy:  bash ~/PMH_IDE/update-idp.sh
set -euo pipefail

IDP="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"   # script nằm ở gốc PMH_IDE
cd "$IDP"
C=(docker compose --env-file .env -f deploy/docker-compose.yml -f deploy/docker-compose.prod.yml)

echo "==> [1/5] Backup an toàn TRƯỚC khi cập nhật (có đường lùi nếu bản mới hỏng)"
"${C[@]}" --profile backup run --rm backup \
  || { echo "!! Backup lỗi — DỪNG, không cập nhật khi chưa có bản lùi." >&2; exit 1; }

echo "==> [2/5] Kiểm repo sạch rồi kéo code mới (ff-only)"
if [[ -n "$(git status --porcelain)" ]]; then
  echo "!! ${IDP} có thay đổi cục bộ chưa commit — dừng để không mất. Xem: git -C ${IDP} status" >&2
  exit 1
fi
git pull --ff-only

echo "==> [3/5] Build lại image"
"${C[@]}" build

echo "==> [4/5] Recreate container"
"${C[@]}" up -d

echo "==> [5/5] Chờ /api/health"
ok=0
for i in $(seq 1 30); do
  code=$(curl -sk -o /dev/null -w '%{http_code}' -H 'Host: de-admin.pmh.com.vn' https://localhost:8443/api/health || true)
  [[ "$code" == "200" ]] && { ok=1; echo "    health OK (200)"; break; }
  echo "    ...chờ (HTTP ${code:-x}) ${i}/30"; sleep 3
done
echo
"${C[@]}" ps
[[ "$ok" == 1 ]] || { echo "!! Chưa lên 200 — xem log: cd ${IDP} && ${C[*]} logs -f sso-server" >&2; exit 1; }
echo "XONG update PMH ID."
