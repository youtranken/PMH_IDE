# Image backup: pg_dump (postgres) + openssl BAKE SẴN (không apk runtime —
# offline/registry chết vẫn backup được). Grumbal: thành phần sống còn không
# được cài lúc chạy.
FROM postgres:16-alpine
RUN apk add --no-cache openssl
COPY backup.sh /backup.sh
# cron-loop.sh = bộ hẹn giờ chạy thường trú (service backup-cron). Cùng image
# để lịch và lần chạy tay dùng CHUNG một script backup, không lệch nhau.
COPY cron-loop.sh /cron-loop.sh
ENTRYPOINT ["sh", "/backup.sh"]
