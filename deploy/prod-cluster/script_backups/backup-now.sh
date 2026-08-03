#!/usr/bin/env bash
# backup-now — chạy 1 bản backup NGAY (trong docker, cùng backup.sh với lịch backup-cron).
# LƯU Ý: backup TỰ ĐỘNG đã chạy sẵn trong container `backup-cron` (mốc BACKUP_AT, mặc định
# 02:00) — KHÔNG cần cron host. Script này chỉ để bấm thêm 1 bản tức thì khi muốn.
# Chạy: bash backup-now.sh
set -euo pipefail

# Tự suy PMH_IDE từ vị trí script (script_backups → prod-cluster → deploy → PMH_IDE)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IDP="${IDP:-$(cd "$SCRIPT_DIR/../../.." && pwd)}"
cd "$IDP"
CJ=(docker compose --env-file .env -f deploy/docker-compose.yml -f deploy/docker-compose.prod.yml)

echo "==> Chạy backup 1 lần (trong docker)…"
"${CJ[@]}" --profile backup run --rm backup

DIR=$(grep -E '^BACKUP_DIR=' .env | cut -d= -f2- | tr -d '\r' || true)
echo
echo "==> Bản backup mã hóa mới nhất trong ${DIR:-BACKUP_DIR}:"
[ -n "${DIR:-}" ] && ls -lht "$DIR"/pmhid-backup-*.tar.gz.enc 2>/dev/null | head -3 || \
  echo "  (không đọc được BACKUP_DIR từ .env — kiểm lại)"
