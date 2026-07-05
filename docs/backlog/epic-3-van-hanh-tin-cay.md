# Epic 3 — Vận hành & tin cậy

**Phase:** 1 (chống bus-factor 2 người — rủi ro thật lớn nhất)
**Mục tiêu:** Mất auth thì có người được đánh thức; sập host vẫn dựng lại được; khóa ký rotate được. Đây là nhóm PRD cố ý kéo lên Phase 1.
**Tham chiếu chính:** AD-8, AD-13, AD-16, NFR độ sẵn sàng.

---

### [E3-S1] Backup trọn bộ hằng đêm
- **Story:** Là người vận hành, cần backup đủ để restore xong đăng nhập được ngay.
- **Tiêu chí nghiệm thu:**
  - Job đêm: `pg_dump` **+ `.env` (cookie keys, KEK TOTP) + file khóa ký**, mã hóa at-rest, đổ ra ổ/máy khác (path trong Settings), giữ 30 bản.
  - Kiểm: restore chỉ-DB (thiếu .env/khóa) tái hiện lỗi "SSA kẹt ngoài" → chứng minh vì sao cần trọn bộ.
- **Tham chiếu:** AD-16 | **Phụ thuộc:** E0-S5, E2-S1 | **Ước lượng:** M

### [E3-S2] Runbook dựng lại host trắng + diễn tập break-glass
- **Story:** Là người vận hành, cần quy trình có thật để phục hồi khi mất cả máy chủ.
- **Tiêu chí nghiệm thu:**
  - Tài liệu runbook: image + docker-compose + restore DB + khóa + .env, theo thứ tự, có lệnh cụ thể.
  - **Diễn tập một lần** trên máy sạch, bấm đồng hồ ≤4h; diễn tập break-glass login thành công.
- **Tham chiếu:** AD-16 | **Phụ thuộc:** E3-S1 | **Ước lượng:** M

### [E3-S3] Cảnh báo mất-auth out-of-band
- **Story:** Là SSA, cần được báo ngay khi hệ thống auth có vấn đề, kể cả khi nó đang sập.
- **Tiêu chí nghiệm thu:**
  - Script/cron **NGOÀI container** kiểm `/health` + tình trạng job; bắn Telegram/Zalo khi lỗi.
  - KHÔNG dùng email worker của chính hệ thống (SSO chết thì kênh đó chết cùng).
- **Tham chiếu:** AD-16, AD-13 | **Phụ thuộc:** E3-S4 | **Ước lượng:** M

### [E3-S4] Endpoint /health + heartbeat scheduler
- **Story:** Là người vận hành, cần tín hiệu sống của hệ thống và các job nền.
- **Tiêu chí nghiệm thu:**
  - `/health` kiểm DB + provider sẵn sàng.
  - Scheduler/worker ghi heartbeat; phát hiện job **pending quá tuổi** (không chỉ failed).
- **Tham chiếu:** AD-16, AD-13 | **Phụ thuộc:** E0-S4 | **Ước lượng:** S

### [E3-S5] CLI rotate khóa ký (publish-trước-ký-sau + emergency)
- **Story:** Là người vận hành, cần đổi khóa ký định kỳ hoặc khẩn cấp mà không làm gãy token đang sống.
- **Tiêu chí nghiệm thu:**
  - CLI: thêm khóa mới (cuối mảng) → reload → chuyển lên đầu (bắt đầu ký) → giữ khóa cũ ≥ (TTL access + JWKS cache 10').
  - Lệnh `rotate-key --emergency`: rút `kid` lộ khỏi JWKS + ký khóa mới; ghi audit.
  - Kiểm: token cấp trước rotate vẫn verify trong cửa sổ overlap.
- **Tham chiếu:** AD-8 | **Phụ thuộc:** E1-S2 | **Ước lượng:** M

### [E3-S6] Nén & lưu trữ audit log
- **Story:** Là hệ thống, cần giữ audit gọn mà vẫn tra cứu được lâu dài.
- **Tiêu chí nghiệm thu:**
  - Cron nén log > 1 năm thành `audit-YYYY-MM.jsonl.gz` vào thư mục lưu trữ.
  - (Trình xem lưu trữ trên portal ở Epic 6.)
- **Tham chiếu:** FR-31, AD-13 | **Phụ thuộc:** E0-S5 | **Ước lượng:** S
