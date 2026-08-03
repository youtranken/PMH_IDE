#!/usr/bin/env bash
# diag-qlts.sh — CHẨN ĐOÁN QLTS 404 (KHÔNG sửa gì, chỉ đọc). Chạy trên máy prod:
#   cd ~/PMH_IDE && git pull && bash deploy/prod-cluster/diag-qlts.sh 2>&1 | tee ~/diag-qlts.txt
# rồi copy toàn bộ output (hoặc gửi file ~/diag-qlts.txt).
set +e

PMH="${PMH:-$HOME/PMH_IDE}"
QLTS="${QLTS:-$HOME/QLTS_DE}"
EDGE_F="$PMH/deploy/edge/docker-compose.yml"
line(){ echo; echo "================ $1 ================"; }

line "0) Vị trí"
echo "PMH=$PMH   QLTS=$QLTS"

line "1) Trạng thái container (edge + qlts)"
docker compose -f "$EDGE_F" ps 2>/dev/null
echo "--- qlts ---"
( cd "$QLTS" && docker compose -f docker-compose.yml ps 2>/dev/null )

line "2) Health qua EDGE (so admin-de / qlts / qlhs)"
for h in admin-de.pmh.com.vn qlts.pmh.com.vn qlhs.pmh.com.vn; do
  echo -n "  $h/api/health -> "
  curl -sk -o /dev/null -w '%{http_code}\n' -H "Host: $h" https://localhost:8443/api/health
done
echo -n "  qlts.pmh.com.vn/api/auth/me -> "
curl -sk -o /dev/null -w '%{http_code}\n' -H "Host: qlts.pmh.com.vn" https://localhost:8443/api/auth/me

line "3) QLTS api TRỰC TIẾP (bỏ qua edge/web) — chứng minh api có route"
( cd "$QLTS"
  echo -n "  /api/health  -> "; docker compose -f docker-compose.yml exec -T api wget -S -O /dev/null http://127.0.0.1:3000/api/health  2>&1 | grep -oE 'HTTP/[0-9.]+ [0-9]+' | head -1
  echo -n "  /api/auth/me -> "; docker compose -f docker-compose.yml exec -T api wget -S -O /dev/null http://127.0.0.1:3000/api/auth/me 2>&1 | grep -oE 'HTTP/[0-9.]+ [0-9]+' | head -1
)

line "4) Path mà api QLTS NHẬN khi request đi QUA edge (probe ZQZ777)"
curl -sk -H "Host: qlts.pmh.com.vn" "https://localhost:8443/api/ZQZ777" >/dev/null 2>&1
sleep 1
( cd "$QLTS" && docker compose -f docker-compose.yml logs --since 30s api 2>/dev/null | grep -oiE '"url":"[^"]*"' | grep -i zqz ) \
  || echo "  → api QLTS KHÔNG nhận ZQZ777 (edge gửi đi backend khác)"

line "4b) sso-server (PMH ID) có nhận ZQZ777 không? (nghi edge định tuyến NHẦM sang PMH ID)"
( cd "$PMH" && docker compose --env-file .env -f deploy/docker-compose.yml -f deploy/docker-compose.prod.yml logs --since 30s sso-server 2>/dev/null | grep -i zqz777 ) \
  || echo "  → sso-server KHÔNG nhận"

line "5) Edge access log cho probe (xem edge trả gì / gửi đâu)"
docker compose -f "$EDGE_F" logs --since 30s nginx 2>/dev/null | grep -i 'zqz777\|qlts' | tail -10 || echo "  → không có dòng liên quan"

line "6) Edge conf.d (host-mounted) — server_name / proxy_pass / default_server"
ls -la "$PMH/deploy/edge/conf.d/"
echo "--- nội dung khớp Host qlts ---"
grep -rnE 'server_name|proxy_pass|listen 8443|default_server|set \$' "$PMH/deploy/edge/conf.d/"

line "7) qlts-web nginx (trong repo QLTS) — proxy /api thế nào"
find "$QLTS/web" -iname '*.conf' 2>/dev/null | grep -v node_modules | while read -r f; do
  echo "--- $f ---"; grep -nE 'location|proxy_pass|rewrite|api_upstream|api:3000' "$f"
done

line "8) qlts-web + qlhs-web trên mạng edge?"
docker network inspect edge 2>/dev/null | grep -E 'qlts-web|qlhs-web'

line "9) So sánh qlhs (chạy được) vs qlts — nginx.prod.conf QLHS proxy /api"
grep -nE 'location|proxy_pass|api:3000' "$HOME/QLHS_DE/apps/web/nginx.prod.conf" 2>/dev/null || echo "  (không đọc được nginx.prod.conf QLHS)"

line "XONG — copy TOÀN BỘ output ở trên gửi lại (hoặc gửi file ~/diag-qlts.txt)"
