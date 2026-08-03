#!/usr/bin/env bash
# 90 — Kiểm nhanh hạ tầng qua cổng 8443 (từ chính máy host). Không thay cho test trình duyệt.
# Chạy: bash 90-verify.sh
set -uo pipefail

pass=0; fail=0
check () {
  local name="$1" host="$2" path="$3" expect="${4:-200}"
  local code
  code=$(curl -sk -o /dev/null -w '%{http_code}' -H "Host: ${host}" "https://localhost:8443${path}" || echo "000")
  if [[ "${code}" == "${expect}" ]]; then
    echo "  ✅ ${name}: HTTP ${code}  (${host}${path})"; pass=$((pass+1))
  else
    echo "  ❌ ${name}: HTTP ${code} (mong đợi ${expect})  (${host}${path})"; fail=$((fail+1))
  fi
}

echo "== EDGE / PMH ID (admin-de) =="
check "admin-de /api/health" "admin-de.pmh.com.vn" "/api/health" 200
check "admin-de trang chủ"    "admin-de.pmh.com.vn" "/"            200

echo "== QLTS =="
check "qlts /api/health"  "qlts.pmh.com.vn" "/api/health" 200

echo "== Host lạ phải bị chặn (444/000) =="
code=$(curl -sk -o /dev/null -w '%{http_code}' -H 'Host: khong-ton-tai.example' "https://localhost:8443/" || echo "000")
echo "  host lạ → HTTP ${code} (444/000 = tốt: edge không lộ app mặc định)"

echo
echo "Kết quả: ${pass} pass / ${fail} fail."
echo "⚠️  Đây chỉ là kiểm nội bộ. BẮT BUỘC test thật trên trình duyệt (ngoài Internet + trong LAN):"
echo "   https://admin-de.pmh.com.vn:8443  và  https://qlts.pmh.com.vn:8443 → đăng nhập SSO tròn vòng."
[[ "${fail}" -eq 0 ]] || exit 1
