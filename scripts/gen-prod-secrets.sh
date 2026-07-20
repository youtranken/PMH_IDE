#!/usr/bin/env sh
# Sinh bí mật PROD cho .env: KEK_BASE64, COOKIE_KEYS, BACKUP_PASSPHRASE.
#
#   bash scripts/gen-prod-secrets.sh            # sửa .env ở gốc repo
#
# AN TOÀN:
#  - KHÔNG in giá trị ra màn hình (bí mật không lọt vào log/transcript).
#  - Chỉ thay biến còn TRỐNG hoặc còn giá trị MẪU — đã có giá trị thật thì GIỮ
#    NGUYÊN (chạy lại nhiều lần không ghi đè secret prod).
#  - Sao lưu .env trước khi sửa.
#
# ⚠️ KEK_BASE64: sinh TRƯỚC khi có người dùng thật. Đổi KEK sau = hỏng toàn bộ
#    TOTP secret + webhook secret đã mã hóa (ciphertext chưa có byte version).
set -eu

cd "$(dirname "$0")/.."
ENV_FILE="${1:-.env}"
[ -f "$ENV_FILE" ] || { echo "Không thấy $ENV_FILE"; exit 1; }
command -v openssl >/dev/null 2>&1 || { echo "Thiếu openssl"; exit 1; }

cp "$ENV_FILE" "$ENV_FILE.bak.$(date +%Y%m%d-%H%M%S)"

NEW_KEK="$(openssl rand -base64 32)"
NEW_CK="$(openssl rand -base64 32),$(openssl rand -base64 32)"
NEW_BP="$(openssl rand -base64 24)"
export NEW_KEK NEW_CK NEW_BP

awk '
  # Giá trị coi là "chưa đặt": trống, chứa change_me, hoặc KEK mẫu của .env.example
  function isSample(v) {
    return v=="" || v ~ /change_me/ \
        || v=="ZGV2X2tla19jaGFuZ2VfbWVfMDEyMzQ1Njc4OWFiY2Q="
  }
  BEGIN{ FS="=" }    # tách theo "=" → $1 là TÊN biến (không có FS này $1 là cả dòng)
  {
    sub(/\r$/, "")   # .env có thể lẫn CRLF (Windows) → bỏ \r, nếu không giá trị
                     # mẫu kèm \r sẽ không khớp isSample và secret không được thay
    key=$1
    val=substr($0, index($0,"=")+1)
    if (key=="KEK_BASE64")        { if(isSample(val)){print "KEK_BASE64=" ENVIRON["NEW_KEK"]; g["KEK_BASE64"]=1; next} k["KEK_BASE64"]=1 }
    if (key=="COOKIE_KEYS")       { if(isSample(val)){print "COOKIE_KEYS=" ENVIRON["NEW_CK"]; g["COOKIE_KEYS"]=1; next} k["COOKIE_KEYS"]=1 }
    if (key=="BACKUP_PASSPHRASE") { if(isSample(val)){print "BACKUP_PASSPHRASE=" ENVIRON["NEW_BP"]; g["BACKUP_PASSPHRASE"]=1; next} k["BACKUP_PASSPHRASE"]=1 }
    print
  }
  END{
    for(x in g) print "  [sinh mới]    " x > "/dev/stderr"
    for(x in k) print "  [giữ nguyên]  " x " (đã có giá trị thật)" > "/dev/stderr"
  }
' "$ENV_FILE" > "$ENV_FILE.tmp"
mv "$ENV_FILE.tmp" "$ENV_FILE"

echo "Xong — đã ghi $ENV_FILE (giá trị KHÔNG in ra). Bản cũ: $ENV_FILE.bak.*"
echo "⚠️ Cất KEK_BASE64 + BACKUP_PASSPHRASE ra nơi an toàn TÁCH khỏi máy (mất = mất data)."
