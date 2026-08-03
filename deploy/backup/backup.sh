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
KEEP_DAYS="${BACKUP_KEEP_DAYS:-30}"

# Giữ TỊNH TIẾN theo NGÀY: xóa bản cũ hơn KEEP_DAYS ngày (bản vừa tạo 0 ngày → luôn giữ).
# >=1 để không lỡ xóa bản mới nhất.
case "$KEEP_DAYS" in ''|*[!0-9]*) echo "BACKUP_KEEP_DAYS không hợp lệ: $KEEP_DAYS"; exit 1;; esac
[ "$KEEP_DAYS" -ge 1 ] || { echo "BACKUP_KEEP_DAYS phải >=1 (đang $KEEP_DAYS)"; exit 1; }

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

# Audit log đã ARCHIVE (>365 ngày) đã bị XÓA khỏi DB (audit-archive.service) → chỉ
# còn trên volume audit_archive. KHÔNG vào backup = hỏng đĩa mất bằng chứng tuân
# thủ (H1). Thư mục có thể CHƯA tồn tại tới lần archive hằng tháng đầu → optional.
ARCHIVE_DIR="${ARCHIVE_DIR:-/archive}"
if [ -d "$ARCHIVE_DIR" ] && [ -n "$(ls -A "$ARCHIVE_DIR" 2>/dev/null)" ]; then
  echo "[backup] gom audit archive…"
  cp -r "$ARCHIVE_DIR" "$WORK/bundle/audit-archive"
else
  echo "[backup] (chưa có audit archive — bỏ qua)"
fi

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

echo "[backup] tịnh tiến: xóa bản cũ hơn $KEEP_DAYS ngày"
find "$OUT_DIR" -maxdepth 1 -name 'pmhid-backup-*.tar.gz.enc' -type f -mtime "+$KEEP_DAYS" -print -exec rm -f {} \;

echo "[backup] XONG: $(ls -lh "$OUT" | awk '{print $5}') — $OUT"
