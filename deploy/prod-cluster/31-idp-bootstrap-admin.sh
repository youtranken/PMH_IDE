#!/usr/bin/env bash
# 31 — Tạo tài khoản quản trị hệ thống (SSA) ĐẦU TIÊN cho PMH ID.
# KHÔNG dùng seed-dev.js (dữ liệu dev). Chạy TƯƠNG TÁC: bash 31-idp-bootstrap-admin.sh
set -euo pipefail

PMH_ROOT="${PMH_ROOT:-/opt/pmh}"
IDP="${PMH_ROOT}/PMH_IDE"
cd "${IDP}"
COMPOSE=(docker compose --env-file .env -f deploy/docker-compose.yml -f deploy/docker-compose.prod.yml)

echo "Tạo tài khoản SSA đầu tiên. (bootstrap-admin.js không ghi đè nếu đã tồn tại.)"
read -rp "Email quản trị (vd admin@pmh.com.vn): " ADMIN_EMAIL
read -rp "Tên hiển thị (vd Quản trị hệ thống): " ADMIN_NAME
read -rp "Mã nhân viên (vd NV000): " ADMIN_CODE
read -rsp "Mật khẩu mạnh (không hiện): " ADMIN_PASSWORD; echo
read -rsp "Nhập lại mật khẩu: " ADMIN_PASSWORD2; echo
[[ "${ADMIN_PASSWORD}" == "${ADMIN_PASSWORD2}" ]] || { echo "!! Mật khẩu không khớp." >&2; exit 1; }
[[ -n "${ADMIN_EMAIL}" && -n "${ADMIN_PASSWORD}" ]] || { echo "!! Thiếu email/mật khẩu." >&2; exit 1; }

"${COMPOSE[@]}" exec \
  -e ADMIN_EMAIL="${ADMIN_EMAIL}" \
  -e ADMIN_NAME="${ADMIN_NAME}" \
  -e ADMIN_CODE="${ADMIN_CODE}" \
  -e ADMIN_PASSWORD="${ADMIN_PASSWORD}" \
  sso-server node scripts/bootstrap-admin.js

echo
echo "XONG 31. Đăng nhập https://admin-de.pmh.com.vn:8443 bằng SSA vừa tạo, bật MFA."
echo "TIẾP: trong UI → Ứng dụng SSO → đăng ký client QLTS"
echo "  redirect_uri = https://qlts.pmh.com.vn:8443/api/auth/callback"
echo "  Lưu client_id + client_secret → điền vào QLTS_DE/.env → bash 40-qlts-up.sh"
