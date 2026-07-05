#!/usr/bin/env sh
# Backup TRỌN BỘ PMH ID (E3-S1, AD-16): pg_dump + .env + khóa ký, mã hóa at-rest,
# giữ 30 bản. Chạy trong container có pg_dump + mount .env/khóa/đầu ra.
#
#   docker compose --profile backup run --rm backup
#   (host cron gọi lệnh trên hằng đêm)
#
# BẮT BUỘC restore trọn bộ: chỉ có DB mà thiếu .env(KEK)/khóa ký → SSA không
# giải mã được TOTP secret = kẹt ngoài (xem runbook).
set -eu
# pipefail: tar chết giữa `tar | openssl` KHÔNG được coi là thành công (ash/bash)
set -o pipefail 2>/dev/null || true

: "${DATABASE_URL:?thiếu DATABASE_URL}"
: "${BACKUP_PASSPHRASE:?thiếu BACKUP_PASSPHRASE}"
ENV_FILE="${ENV_FILE:-/secrets/.env}"
KEYS_DIR="${SIGNING_KEYS_DIR:-/run/secrets/signing-keys}"
OUT_DIR="${BACKUP_OUT:-/backups}"
KEEP="${BACKUP_KEEP:-30}"

# KEEP phải >=1, nếu không rotation sẽ xóa SẠCH kể cả bản vừa tạo
case "$KEEP" in ''|*[!0-9]*) echo "BACKUP_KEEP không hợp lệ: $KEEP"; exit 1;; esac
[ "$KEEP" -ge 1 ] || { echo "BACKUP_KEEP phải >=1 (đang $KEEP)"; exit 1; }

command -v pg_dump >/dev/null || { echo "thiếu pg_dump"; exit 1; }
command -v openssl >/dev/null || { echo "thiếu openssl (image phải có sẵn)"; exit 1; }

STAMP=$(date +%Y%m%d-%H%M%S)
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$OUT_DIR"

echo "[backup] pg_dump…"
pg_dump "$DATABASE_URL" --no-owner --no-privileges > "$WORK/db.sql"

echo "[backup] gom .env + khóa ký…"
mkdir -p "$WORK/bundle"
cp "$WORK/db.sql" "$WORK/bundle/db.sql"
# Thành phần SỐNG CÒN — thiếu là backup vô dụng (thiếu KEK → SSA kẹt ngoài).
# FAIL CỨNG, không cảnh báo suông rồi báo thành công.
[ -f "$ENV_FILE" ] || { echo "[LỖI] không thấy $ENV_FILE — backup KHÔNG trọn bộ, hủy"; exit 1; }
cp "$ENV_FILE" "$WORK/bundle/.env"
[ -d "$KEYS_DIR" ] || { echo "[LỖI] không thấy $KEYS_DIR — thiếu khóa ký, hủy"; exit 1; }
cp -r "$KEYS_DIR" "$WORK/bundle/signing-keys"

OUT="$OUT_DIR/pmhid-backup-$STAMP.tar.gz.enc"
echo "[backup] tar + mã hóa AES-256 → $OUT"
( umask 077; tar -czf - -C "$WORK/bundle" . | \
  openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:BACKUP_PASSPHRASE -out "$OUT" )
chmod 600 "$OUT"

# VERIFY: giải mã + liệt kê được thì mới coi là backup hợp lệ (chống bản QUE)
echo "[backup] verify archive giải mã được…"
if ! openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE -in "$OUT" \
     | tar -tzf - >/dev/null 2>&1; then
  echo "[LỖI] archive KHÔNG verify được — xóa bản hỏng, hủy"; rm -f "$OUT"; exit 1
fi

echo "[backup] xoay giữ $KEEP bản mới nhất"
ls -1t "$OUT_DIR"/pmhid-backup-*.tar.gz.enc 2>/dev/null | tail -n +$((KEEP + 1)) | while read -r old; do
  echo "  xóa cũ: $old"; rm -f "$old"
done

echo "[backup] XONG: $(ls -lh "$OUT" | awk '{print $5}') — $OUT"
