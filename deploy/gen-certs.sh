#!/usr/bin/env bash
# Sinh cert TLS self-signed cho dev (Nginx). Prod thay bằng cert thật.
set -euo pipefail
CERT_DIR="$(cd "$(dirname "$0")" && pwd)/nginx/certs"
mkdir -p "$CERT_DIR"

# TÊN FILE phải khớp deploy/edge/conf.d/*.conf (ssl_certificate fullchain.pem /
# ssl_certificate_key privkey.pem). Trước đây script sinh dev.crt/dev.key nên
# clone mới chạy xong là nginx EDGE không khởi động nổi — cert prod thật cũng
# đặt đúng 2 tên này vào cùng thư mục, gia hạn chỉ thay 1 chỗ.
if [[ -f "$CERT_DIR/fullchain.pem" && -f "$CERT_DIR/privkey.pem" ]]; then
  echo "Cert đã có tại $CERT_DIR — bỏ qua. Xóa để sinh lại."
  exit 0
fi

# cd vào thư mục cert + tên file tương đối => không có "/path" để MSYS/Windows
# openssl hiểu nhầm. MSYS_NO_PATHCONV chỉ để bảo vệ chuỗi -subj "/C=VN/...".
cd "$CERT_DIR"
# SAN có wildcard *.pmh.com.vn để khớp mô hình EDGE đa subdomain (id./qlts./…)
MSYS_NO_PATHCONV=1 openssl req -x509 -nodes -newkey rsa:2048 -days 825 \
  -keyout privkey.pem \
  -out fullchain.pem \
  -subj "/C=VN/O=PMH/CN=*.pmh.com.vn" \
  -addext "subjectAltName=DNS:localhost,DNS:pmh.com.vn,DNS:*.pmh.com.vn,IP:127.0.0.1"

echo "Đã sinh cert self-signed tại $CERT_DIR"
