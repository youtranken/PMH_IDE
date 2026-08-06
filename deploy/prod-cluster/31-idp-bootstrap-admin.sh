#!/usr/bin/env bash
# 31 — Tạo 2 tài khoản quản trị lõi cho PMH ID: ssa@ (SSA vận hành) + sysadmin@ (break-glass).
# Gọi scripts/seed-prod.js (mật khẩu bạn tự nhập, KHÔNG ghi đè). Chạy TƯƠNG TÁC:
#   bash 31-idp-bootstrap-admin.sh
set -euo pipefail

PMH_ROOT="${PMH_ROOT:-$HOME}"
IDP="${PMH_ROOT}/PMH_IDE"
cd "${IDP}"
COMPOSE=(docker compose --env-file .env -f deploy/docker-compose.yml -f deploy/docker-compose.prod.yml)

echo "Tạo 2 tài khoản: ssa@pmh.com.vn (SSA) + sysadmin@pmh.com.vn (break-glass, bỏ MFA, ẩn UI)."
echo "Mật khẩu ≥ 12 ký tự. (Chạy lại vô hại — tài khoản đã có sẽ KHÔNG bị ghi đè.)"
echo

read -rsp "Mật khẩu cho ssa@ (SSA vận hành): " SSA_PW; echo
read -rsp "Nhập lại: " SSA_PW2; echo
[[ "${SSA_PW}" == "${SSA_PW2}" ]] || { echo "!! Mật khẩu ssa không khớp." >&2; exit 1; }
[[ "${#SSA_PW}" -ge 12 ]] || { echo "!! Mật khẩu ssa phải ≥ 12 ký tự." >&2; exit 1; }

read -rsp "Mật khẩu cho sysadmin@ (break-glass — cất OFFLINE): " SA_PW; echo
read -rsp "Nhập lại: " SA_PW2; echo
[[ "${SA_PW}" == "${SA_PW2}" ]] || { echo "!! Mật khẩu sysadmin không khớp." >&2; exit 1; }
[[ "${#SA_PW}" -ge 12 ]] || { echo "!! Mật khẩu sysadmin phải ≥ 12 ký tự." >&2; exit 1; }

"${COMPOSE[@]}" exec \
  -e SSA_PASSWORD="${SSA_PW}" \
  -e SYSADMIN_PASSWORD="${SA_PW}" \
  sso-server node scripts/seed-prod.js

echo
echo "XONG 31. Đăng nhập https://de-admin.pmh.com.vn:8443 bằng ssa@ → BẬT MFA → đổi mật khẩu."
echo "sysadmin@ (break-glass): chỉ dùng khi kẹt MFA/SSO, cất mật khẩu OFFLINE."
echo "TIẾP: trong UI → Ứng dụng SSO → đăng ký client QLTS"
echo "  redirect_uri = https://de-qlts.pmh.com.vn:8443/api/auth/callback → điền QLTS_DE/.env → bash 40-qlts-up.sh"
