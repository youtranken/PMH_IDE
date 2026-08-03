#!/usr/bin/env bash
# 10 — Layout prod trong HOME: clone repo + tạo thư mục backup + đặt script backup/restore.
# Chạy: bash 10-clone.sh   (KHÔNG cần sudo — mọi thứ nằm trong $HOME)
set -euo pipefail

PMH_ROOT="${PMH_ROOT:-$HOME}"        # gốc layout = /home/<bạn>

IDP_URL="https://github.com/youtranken/PMH_IDE.git"
QLTS_URL="https://github.com/youtranken/QLTS_DE.git"
BRANCH_IDP="main"
BRANCH_QLTS="main"

clone_or_pull () {
  local url="$1" dir="$2" branch="$3"
  if [[ -d "${dir}/.git" ]]; then
    echo "==> Cập nhật ${dir} (${branch})"
    git -C "${dir}" fetch --all --prune
    git -C "${dir}" checkout "${branch}"
    git -C "${dir}" pull --ff-only
  else
    echo "==> Clone ${url} -> ${dir} (${branch})"
    git clone --branch "${branch}" "${url}" "${dir}"
  fi
}

echo "==> Layout tại ${PMH_ROOT}"
clone_or_pull "${IDP_URL}"  "${PMH_ROOT}/PMH_IDE" "${BRANCH_IDP}"
clone_or_pull "${QLTS_URL}" "${PMH_ROOT}/QLTS_DE" "${BRANCH_QLTS}"
# QLHS ĐỢT 2 (bỏ comment khi tới lượt):
# clone_or_pull "https://github.com/youtranken/QLHS_DE.git" "${PMH_ROOT}/QLHS_DE" "main"

echo "==> Tạo thư mục dữ liệu backup + thư mục script backup/restore"
mkdir -p "${PMH_ROOT}/data-backups" "${PMH_ROOT}/script_backups"
cp "${PMH_ROOT}/PMH_IDE/deploy/prod-cluster/script_backups/"*.sh "${PMH_ROOT}/script_backups/"
chmod +x "${PMH_ROOT}/script_backups/"*.sh

echo
echo "XONG 10. Layout:"
echo "  ${PMH_ROOT}/PMH_IDE         (idde / IdP)"
echo "  ${PMH_ROOT}/QLTS_DE         (qlts)"
echo "  ${PMH_ROOT}/data-backups    (nơi bản backup mã hóa rơi vào — trỏ BACKUP_DIR vào đây)"
echo "  ${PMH_ROOT}/script_backups  (backup-now.sh, restore.sh — chạy tay khi cần)"
echo
echo "Tiếp: cd ${PMH_ROOT}/PMH_IDE/deploy/prod-cluster && bash gen-secrets.sh"
echo "Nhớ đặt trong PMH_IDE/.env:  BACKUP_DIR=${PMH_ROOT}/data-backups"
