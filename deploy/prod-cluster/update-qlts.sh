#!/usr/bin/env bash
# update-qlts — cập nhật QLTS lên code mới nhất trên GitHub.
# Backup an toàn → git pull → rebuild + recreate (api tự chạy migration mới lúc boot) → chờ health.
# Chạy từ ~/PMH_IDE/deploy/prod-cluster:  bash update-qlts.sh
set -euo pipefail

PMH_ROOT="${PMH_ROOT:-$HOME}"
QLTS="${PMH_ROOT}/QLTS_DE"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

[[ -d "${QLTS}/.git" ]] || { echo "!! Không thấy repo ${QLTS}" >&2; exit 1; }

echo "==> [1/3] Backup an toàn trước khi cập nhật"
if [[ -x "${QLTS}/script_backups/backup.sh" ]]; then
  bash "${QLTS}/script_backups/backup.sh" || echo "   ⚠️  backup lỗi — cân nhắc dừng (Ctrl-C) rồi kiểm tra."
else
  echo "   (chưa có script_backups/backup.sh — bỏ qua)"
fi

echo "==> [2/3] git pull (ff-only) ${QLTS}"
# --ff-only: nếu prod có sửa/commit tại chỗ chưa push → dừng báo lỗi thay vì merge mù.
git -C "${QLTS}" pull --ff-only

echo "==> [3/3] Rebuild + recreate + chờ health (qua 40-qlts-up.sh)"
bash "${HERE}/40-qlts-up.sh"

echo "XONG update-qlts. Migration mới (nếu có) đã chạy lúc api boot; kiểm log nếu cần:"
echo "  cd ${QLTS} && docker compose -f docker-compose.yml logs --since 5m api | grep -i migrat"
