#!/usr/bin/env bash
# 00 — Chuẩn bị máy Ubuntu prod: cài Docker Engine + compose plugin + git, mở firewall OS.
# Chạy: sudo bash 00-prep-ubuntu.sh   (cần quyền root)
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "!! Chạy bằng sudo: sudo bash 00-prep-ubuntu.sh" >&2
  exit 1
fi

# User thật (không phải root) để thêm vào nhóm docker
TARGET_USER="${SUDO_USER:-$(logname 2>/dev/null || echo root)}"

echo "==> [1/4] Cập nhật apt + gói nền"
apt-get update -y
apt-get install -y ca-certificates curl git gnupg

echo "==> [2/4] Cài Docker Engine + compose plugin (script chính chủ get.docker.com)"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
  sh /tmp/get-docker.sh
  rm -f /tmp/get-docker.sh
else
  echo "    docker đã có, bỏ qua."
fi
systemctl enable --now docker

echo "==> [3/4] Thêm user '${TARGET_USER}' vào nhóm docker (chạy docker không cần sudo)"
if [[ "${TARGET_USER}" != "root" ]]; then
  usermod -aG docker "${TARGET_USER}"
  echo "    -> Sau script này chạy: newgrp docker  (hoặc logout/login) để có hiệu lực."
fi

echo "==> [4/4] Firewall OS (ufw) — mở 8443 (cụm PMH) và 80 (redirect→https)"
if command -v ufw >/dev/null 2>&1; then
  ufw allow OpenSSH   || true
  ufw allow 8443/tcp  || true
  ufw allow 80/tcp    || true
  echo "    (ufw chưa bật thì các rule chỉ được lưu; bật bằng: sudo ufw enable)"
else
  echo "    ufw chưa cài — bỏ qua (dùng firewall khác thì tự mở 8443/tcp)."
fi

echo
echo "XONG 00. Kiểm: docker --version && docker compose version"
docker --version || true
docker compose version || true
echo "Tiếp theo: newgrp docker  &&  bash 10-clone.sh"
