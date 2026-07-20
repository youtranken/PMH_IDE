#!/usr/bin/env sh
# Bộ hẹn giờ backup CHẠY TRONG CONTAINER (không phụ thuộc cron của host /
# Windows Task Scheduler — host đổi máy/cài lại là mất lịch mà không ai biết).
#
# Vòng lặp: tính số giây tới mốc BACKUP_AT kế tiếp → ngủ → chạy backup.sh → lặp.
# Dùng chung image với service `backup` nên có sẵn pg_dump + openssl.
#
#   BACKUP_AT=HH:MM  (mặc định 02:00, giờ container = TZ Asia/Bangkok)
#
# CỐ Ý không tự thoát khi một lần backup lỗi: log rồi chờ mốc kế tiếp, để sự cố
# tạm thời (DB đang restart) không giết luôn lịch. Lỗi vẫn hiện ở `docker logs`
# và làm container UNHEALTHY nếu bản mới nhất quá cũ.
set -u

AT="${BACKUP_AT:-02:00}"
case "$AT" in
  [0-2][0-9]:[0-5][0-9]) ;;
  *) echo "[backup-cron] BACKUP_AT không hợp lệ: '$AT' (cần HH:MM)"; exit 1 ;;
esac
HH=${AT%:*}
MM=${AT#*:}
[ "$HH" -le 23 ] || { echo "[backup-cron] giờ không hợp lệ: $HH"; exit 1; }

echo "[backup-cron] khởi động — mốc chạy hằng ngày $AT (TZ=${TZ:-UTC})"

while :; do
  now=$(date +%s)
  today=$(date +%Y-%m-%d)
  target=$(date -d "$today $HH:$MM" +%s 2>/dev/null) || {
    echo "[backup-cron] date -d không dùng được trên image này"; exit 1; }
  # Mốc hôm nay đã trôi qua → nhắm sang ngày mai.
  [ "$target" -le "$now" ] && target=$((target + 86400))
  sleep_for=$((target - now))
  echo "[backup-cron] chờ ${sleep_for}s → $(date -d "@$target" '+%Y-%m-%d %H:%M:%S')"
  sleep "$sleep_for"

  echo "[backup-cron] === chạy backup $(date '+%Y-%m-%d %H:%M:%S') ==="
  if sh /backup.sh; then
    echo "[backup-cron] backup XONG"
  else
    echo "[backup-cron] backup LỖI (mã $?) — giữ lịch, thử lại mốc kế tiếp"
  fi
  # Ngủ 60s cho qua mốc, tránh vòng lặp chạy 2 lần trong cùng một phút.
  sleep 60
done
