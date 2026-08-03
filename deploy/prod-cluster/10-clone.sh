#!/usr/bin/env bash
# 10 — Clone (hoặc cập nhật) 2 repo cho đợt này về /opt/pmh. QLHS làm sau.
# Chạy: bash 10-clone.sh
set -euo pipefail

PMH_ROOT="${PMH_ROOT:-/opt/pmh}"

# repo -> nhánh
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

echo "==> Thư mục gốc: ${PMH_ROOT}"
sudo mkdir -p "${PMH_ROOT}"
sudo chown -R "$(id -u):$(id -g)" "${PMH_ROOT}"

clone_or_pull "${IDP_URL}"  "${PMH_ROOT}/PMH_IDE" "${BRANCH_IDP}"
clone_or_pull "${QLTS_URL}" "${PMH_ROOT}/QLTS_DE" "${BRANCH_QLTS}"

echo
echo "XONG 10. Các script còn lại nằm ở: ${PMH_ROOT}/PMH_IDE/deploy/prod-cluster/"
echo "Tiếp theo:"
echo "  cd ${PMH_ROOT}/PMH_IDE/deploy/prod-cluster"
echo "  bash gen-secrets.sh   # rồi điền .env, đặt cert, chạy 20/30/31/40/90"
