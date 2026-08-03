#!/usr/bin/env bash
# restore — phục hồi PMH ID từ 1 bản backup mã hóa (giải mã → nạp lại DB + khóa ký).
# Bám theo docs/ops/runbook-recovery.md §2. ⚠️ XÓA & TẠO LẠI database 'pmhid' rồi nạp backup.
# Dùng:  bash restore.sh                 # chọn bản MỚI NHẤT trong data-backups
#        bash restore.sh <tên-file.enc>  # chọn 1 bản cụ thể
set -euo pipefail

# Tự suy PMH_IDE từ vị trí script (script_backups → prod-cluster → deploy → PMH_IDE)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IDP="${IDP:-$(cd "$SCRIPT_DIR/../../.." && pwd)}"
cd "$IDP"
CJ=(docker compose --env-file .env -f deploy/docker-compose.yml -f deploy/docker-compose.prod.yml)

BACKUP_DIR=$(grep -E '^BACKUP_DIR=' .env | cut -d= -f2- | tr -d '\r')
PASS=$(grep -E '^BACKUP_PASSPHRASE=' .env | cut -d= -f2- | tr -d '\r')
PW=$(grep -E '^POSTGRES_PASSWORD=' .env | cut -d= -f2- | tr -d '\r')
[ -n "$BACKUP_DIR" ] || { echo "!! .env thiếu BACKUP_DIR"; exit 1; }
[ -n "$PASS" ]       || { echo "!! .env thiếu BACKUP_PASSPHRASE"; exit 1; }
[ -n "$PW" ]         || { echo "!! .env thiếu POSTGRES_PASSWORD"; exit 1; }

# Chọn archive
ARCHIVE="${1:-}"
if [ -z "$ARCHIVE" ]; then
  ARCHIVE=$(ls -1t "$BACKUP_DIR"/pmhid-backup-*.tar.gz.enc 2>/dev/null | head -1 || true)
elif [ ! -f "$ARCHIVE" ]; then
  ARCHIVE="$BACKUP_DIR/$ARCHIVE"
fi
[ -f "$ARCHIVE" ] || { echo "!! Không thấy bản backup: ${1:-<mới nhất>} (trong $BACKUP_DIR)"; exit 1; }

echo "Phục hồi TỪ : $ARCHIVE"
echo "⚠️  Sẽ DROP database 'pmhid' hiện tại và nạp lại từ backup này."
read -rp "Gõ đúng chữ RESTORE để tiếp tục: " ok
[ "$ok" = "RESTORE" ] || { echo "Đã hủy."; exit 1; }

WORK=$(mktemp -d); trap 'rm -rf "$WORK"' EXIT
export BACKUP_PASSPHRASE="$PASS"   # dùng env (không lộ passphrase trên dòng lệnh)

echo "==> [1/6] Giải mã + giải nén (iter 200000 khớp backup.sh)…"
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE -in "$ARCHIVE" \
  | tar -xzf - -C "$WORK"
[ -f "$WORK/db.sql" ] || { echo "!! Backup thiếu db.sql — dừng."; exit 1; }
ls -la "$WORK"

echo "==> [2/6] Dừng app để không còn kết nối tới DB…"
"${CJ[@]}" stop sso-server backup-cron portal-fe 2>/dev/null || true

echo "==> [3/6] Đảm bảo postgres chạy…"
"${CJ[@]}" up -d postgres
until "${CJ[@]}" ps postgres | grep -q healthy; do sleep 2; done

echo "==> [4/6] Tạo lại database pmhid (FORCE cắt kết nối còn sót)…"
"${CJ[@]}" exec -T -e PGPASSWORD="$PW" postgres \
  psql -h 127.0.0.1 -U pmhid -d postgres -v ON_ERROR_STOP=1 \
  -c "DROP DATABASE IF EXISTS pmhid WITH (FORCE);" \
  -c "CREATE DATABASE pmhid OWNER pmhid;"

echo "==> [5/6] Nạp db.sql (ON_ERROR_STOP=1)…"
cat "$WORK/db.sql" | "${CJ[@]}" exec -T -e PGPASSWORD="$PW" postgres \
  psql -h 127.0.0.1 -U pmhid -d pmhid -v ON_ERROR_STOP=1

if [ -f "$WORK/signing-keys/jwks.json" ]; then
  echo "==> [6/6] Nạp khóa ký vào volume signing_keys…"
  "${CJ[@]}" run --rm --no-deps -v "$WORK/signing-keys:/src:ro" --entrypoint sh sso-server \
    -c "cp /src/jwks.json /run/secrets/signing-keys/jwks.json"
else
  echo "==> [6/6] (backup không có signing-keys/jwks.json — bỏ qua)"
fi

echo "==> Khởi động lại toàn stack…"
"${CJ[@]}" up -d --build

echo
echo "XONG restore. Kiểm: bash $IDP/deploy/prod-cluster/90-verify.sh  và đăng nhập thử."
echo "⚠️  KEK_BASE64 trong .env HIỆN TẠI phải TRÙNG lúc tạo backup, nếu không TOTP/secret không giải mã được."
echo "   Backup có kèm .env gốc. Nếu KEK lệch, lấy KEK cũ ra bằng:"
echo "   openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass pass:'\$BACKUP_PASSPHRASE' -in '$ARCHIVE' | tar -xzOf - ./.env | grep KEK_BASE64"
