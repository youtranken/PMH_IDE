#!/usr/bin/env bash
# 05 — Làm cứng bảo mật Ubuntu TRƯỚC khi deploy. Chạy: sudo bash 05-harden-ubuntu.sh
# An toàn với người mới: CHỈ tắt đăng nhập-mật-khẩu SSH KHI user đã có SSH key
# (tránh tự khóa mình ngoài). Chạy được nhiều lần (idempotent).
set -euo pipefail
[[ "${EUID}" -eq 0 ]] || { echo "!! Chạy bằng sudo: sudo bash 05-harden-ubuntu.sh" >&2; exit 1; }

TARGET_USER="${SUDO_USER:-$(logname 2>/dev/null || echo root)}"
USER_HOME=$(getent passwd "${TARGET_USER}" | cut -d: -f6)
echo "==> User đích: ${TARGET_USER} (home ${USER_HOME})"

echo "==> [1/7] Cập nhật hệ thống"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y && apt-get upgrade -y

echo "==> [2/7] Cài gói bảo mật: ufw, fail2ban, unattended-upgrades, chrony"
apt-get install -y ufw fail2ban unattended-upgrades chrony

echo "==> [3/7] Tự động vá bảo mật (unattended-upgrades)"
dpkg-reconfigure -f noninteractive unattended-upgrades || true
systemctl enable --now unattended-upgrades || true

echo "==> [4/7] Đồng bộ giờ (chrony) — QUAN TRỌNG cho TOTP/JWT (lệch giờ = MFA/login hỏng)"
systemctl enable --now chrony || true
timedatectl set-ntp true || true

echo "==> [5/7] Firewall ufw: chặn mặc định, chỉ mở SSH + 8443 (+80 redirect)"
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH          # cổng 22 (đổi nếu bạn dùng cổng SSH khác)
ufw allow 8443/tcp         # cổng công khai cụm PMH
ufw allow 80/tcp           # để edge redirect http→https:8443 (bỏ nếu không cần)
ufw --force enable
ufw status verbose | sed 's/^/    /'

echo "==> [6/7] fail2ban (chặn brute-force SSH)"
systemctl enable --now fail2ban
# jail sshd mặc định đã bật trên Ubuntu; chỉ cần service chạy.

echo "==> [7/7] SSH: cấm root login; tắt mật khẩu CHỈ KHI đã có key"
SSHD_DROPIN=/etc/ssh/sshd_config.d/99-pmh-hardening.conf
KEYS="${USER_HOME}/.ssh/authorized_keys"
{
  echo "# PMH hardening (05-harden-ubuntu.sh)"
  echo "PermitRootLogin no"
  echo "PubkeyAuthentication yes"
  echo "X11Forwarding no"
  echo "MaxAuthTries 4"
} > "${SSHD_DROPIN}"

if [[ -s "${KEYS}" ]]; then
  echo "    Phát hiện SSH key của ${TARGET_USER} → TẮT đăng nhập mật khẩu."
  echo "PasswordAuthentication no" >> "${SSHD_DROPIN}"
  echo "KbdInteractiveAuthentication no" >> "${SSHD_DROPIN}"
else
  echo "    ⚠️  CHƯA thấy ${KEYS} → GIỮ đăng nhập mật khẩu (không tắt để bạn khỏi bị khóa)."
  echo "    Hãy cài SSH key rồi chạy lại script này để tắt mật khẩu:"
  echo "      # TỪ MÁY LAPTOP của bạn:"
  echo "      ssh-keygen -t ed25519          # nếu chưa có key"
  echo "      ssh-copy-id ${TARGET_USER}@<IP-server>"
  echo "      # mở phiên SSH MỚI kiểm đăng nhập bằng key OK, rồi chạy lại 05 trên server."
fi

if sshd -t; then
  systemctl reload ssh 2>/dev/null || systemctl reload sshd 2>/dev/null || true
  echo "    sshd config hợp lệ, đã reload."
else
  echo "!! sshd -t báo lỗi — GỠ ${SSHD_DROPIN} rồi kiểm lại (KHÔNG reload để tránh hỏng SSH)." >&2
  rm -f "${SSHD_DROPIN}"
  exit 1
fi

echo
echo "==> (Khuyến nghị Docker) Đặt daemon.json cho IP nguồn thật + xoay log"
DAEMON=/etc/docker/daemon.json
if [[ ! -f "${DAEMON}" ]]; then
  mkdir -p /etc/docker
  cat > "${DAEMON}" <<'JSON'
{
  "userland-proxy": false,
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "5" }
}
JSON
  echo "    Đã tạo ${DAEMON}. Khởi động lại Docker khi CHƯA có container quan trọng:"
  echo "      sudo systemctl restart docker"
else
  echo "    ${DAEMON} đã tồn tại — KHÔNG ghi đè. Nên có sẵn:"
  echo '      "userland-proxy": false   (giữ IP nguồn thật cho access log)'
  echo '      log-opts max-size/max-file (tránh log phình đĩa)'
fi

echo
echo "XONG 05. Tóm tắt còn nên làm THỦ CÔNG:"
echo "  - Đặt mật khẩu MẠNH cho ${TARGET_USER} (nếu còn dùng mật khẩu)."
echo "  - Nếu chưa có SSH key: cài key rồi CHẠY LẠI 05 để tắt đăng nhập mật khẩu."
echo "  - Cân nhắc đổi cổng SSH khỏi 22 (giảm quét) — nhớ 'ufw allow <cổng-mới>' trước."
echo "Sau khi bảo mật xong: newgrp docker && bash 10-clone.sh"
