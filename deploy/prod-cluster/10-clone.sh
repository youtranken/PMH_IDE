#!/usr/bin/env bash
# 10 — Layout prod: clone repo + tạo thư mục backup TRONG PMH_IDE.
# Chạy: bash 10-clone.sh   (KHÔNG cần sudo — mọi thứ nằm trong $HOME/$PMH_ROOT)
set -euo pipefail

PMH_ROOT="${PMH_ROOT:-$HOME}"        # gốc layout (mặc định /home/<bạn>; đặt PMH_ROOT nếu dùng ~/pmh)
IDP="${PMH_ROOT}/PMH_IDE"

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
clone_or_pull "${IDP_URL}"  "${IDP}"                 "${BRANCH_IDP}"
clone_or_pull "${QLTS_URL}" "${PMH_ROOT}/QLTS_DE"    "${BRANCH_QLTS}"
# QLHS ĐỢT 2 (bỏ comment khi tới lượt):
# clone_or_pull "https://github.com/youtranken/QLHS_DE.git" "${PMH_ROOT}/QLHS_DE" "main"

echo "==> Tạo thư mục backup TRONG PMH_IDE (đã .gitignore, git không đụng tới)"
mkdir -p "${IDP}/data-backups"

echo
echo "XONG 10. Layout:"
echo "  ${IDP}                       (idde / IdP)"
echo "  ${IDP}/data-backups          (bản backup mã hóa rơi vào đây — trỏ BACKUP_DIR vào đây)"
echo "  ${IDP}/deploy/prod-cluster/script_backups/  (backup-now.sh, restore.sh — có sẵn trong repo)"
echo "  ${PMH_ROOT}/QLTS_DE          (qlts)"
echo
echo "Tiếp: cd ${IDP}/deploy/prod-cluster && bash gen-secrets.sh"
echo "Nhớ đặt trong PMH_IDE/.env:  BACKUP_DIR=${IDP}/data-backups"
