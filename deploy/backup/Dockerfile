# Image backup: pg_dump (postgres) + openssl BAKE SẴN (không apk runtime —
# offline/registry chết vẫn backup được). Grumbal: thành phần sống còn không
# được cài lúc chạy.
FROM postgres:16-alpine
RUN apk add --no-cache openssl
COPY backup.sh /backup.sh
ENTRYPOINT ["sh", "/backup.sh"]
