#!/usr/bin/env bash
# gen-secrets — IN RA các secret ngẫu nhiên để bạn TỰ dán vào .env.
# KHÔNG tự ghi vào file nào (tránh lỡ tay commit secret). Chạy: bash gen-secrets.sh
set -euo pipefail

command -v openssl >/dev/null 2>&1 || { echo "Cần openssl (apt-get install -y openssl)"; exit 1; }

echo "=================================================================="
echo " SECRET NGẪU NHIÊN — dán vào .env tương ứng. Sinh MỚI mỗi lần chạy."
echo " Cất KEK/COOKIE/BACKUP_PASSPHRASE offline: mất là mất mọi thứ mã hóa."
echo "=================================================================="
echo
echo "----- PMH_IDE/.env -----"
echo "KEK_BASE64=$(openssl rand -base64 32)"
echo "COOKIE_KEYS=$(openssl rand -base64 32),$(openssl rand -base64 32)"
echo "POSTGRES_PASSWORD=$(openssl rand -hex 24)     # nhớ cập nhật cả DATABASE_URL cho khớp"
echo "BACKUP_PASSPHRASE=$(openssl rand -base64 24)"
echo
echo "----- QLTS_DE/.env -----"
echo "POSTGRES_PASSWORD=$(openssl rand -hex 24)     # chỉ [A-Za-z0-9] — đã tránh @ : # % phá URL"
echo "REDIS_PASSWORD=$(openssl rand -hex 24)"
# PMH_WEBHOOK_SECRET (QLTS & QLHS): KHÔNG sinh ở đây — PMH ID TỰ SINH khi bạn khai
#   webhook_url trên client (hiện 1 LẦN) rồi dán vào PMH_WEBHOOK_SECRET của app.
#   Bỏ trống nếu KHÔNG dùng offboarding webhook.
echo "MAIL_ENC_KEY=$(openssl rand -hex 32)          # mã hoá password SMTP lưu qua UI — KHÔNG đổi sau khi đã lưu"
echo
echo "----- QLHS_DE/.env  (GỐC repo — bản siết bảo mật DB) -----"
echo "POSTGRES_PASSWORD=$(openssl rand -hex 24)     # chìa superuser DB (thay 'qlhs')"
echo "QLHS_APP_PASSWORD=$(openssl rand -hex 24)     # chìa app-role qlhs_app (thay 'qlhs_app')"
echo "CONFIG_ENC_KEY=$(openssl rand -base64 48)     # mã hoá password SMTP lưu qua UI — KHÔNG đổi sau khi đã lưu"
echo
echo "----- LOCAL_SA_PASSWORD_HASH (QLTS) -----"
echo "Không sinh ở đây (là hash scrypt). Trên máy prod chạy trong repo QLTS:"
echo "  cd ~/QLTS_DE/api && npm run sa:hash -- '<mật-khẩu-SA-mạnh>'"
echo "rồi dán chuỗi 'scrypt.saltHex.hashHex' vào LOCAL_SA_PASSWORD_HASH."
echo
echo "PMH_CLIENT_ID / PMH_CLIENT_SECRET (QLTS): lấy từ UI PMH ID khi đăng ký client (bước giữa runbook)."
