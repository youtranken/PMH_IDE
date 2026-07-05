#!/usr/bin/env bash
# Sinh cert TLS self-signed cho dev (Nginx). Prod thay bằng cert thật.
set -euo pipefail
CERT_DIR="$(cd "$(dirname "$0")" && pwd)/nginx/certs"
mkdir -p "$CERT_DIR"

if [[ -f "$CERT_DIR/dev.crt" && -f "$CERT_DIR/dev.key" ]]; then
  echo "Cert đã có tại $CERT_DIR — bỏ qua. Xóa để sinh lại."
  exit 0
fi

# cd vào thư mục cert + tên file tương đối => không có "/path" để MSYS/Windows
# openssl hiểu nhầm. MSYS_NO_PATHCONV chỉ để bảo vệ chuỗi -subj "/C=VN/...".
cd "$CERT_DIR"
MSYS_NO_PATHCONV=1 openssl req -x509 -nodes -newkey rsa:2048 -days 825 \
  -keyout dev.key \
  -out dev.crt \
  -subj "/C=VN/O=PMH/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,DNS:id.pmh.com.vn,IP:127.0.0.1"

echo "Đã sinh cert self-signed tại $CERT_DIR"
