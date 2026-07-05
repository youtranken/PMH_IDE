# Epic 2 — Bảo mật đăng nhập

**Phase:** 1
**Mục tiêu:** SSA đăng nhập có MFA và không thể bị khóa từ ngoài; có đường cứu break-glass; chống dò mật khẩu hoạt động mà không tự gây DoS; policy mật khẩu áp dụng.
**Tham chiếu chính:** AD-9, AD-10, AD-15, FR-07, FR-08, NFR bảo mật.
**Ghi chú:** "Quên mật khẩu" (FR-11) đã **dời sang Epic 4 (E4-S8)** vì phụ thuộc hạ tầng mật-khẩu-tạm + email-queue của Phase 2 — giữ Phase 1 không dính phụ thuộc email.

---

### [E2-S1] MFA TOTP cho SSA
- **Story:** Là SSA, cần lớp xác thực thứ hai để một cú phishing không chiếm được cả công ty.
- **Tiêu chí nghiệm thu:**
  - Sau khi nhập mật khẩu đúng, SSA phải nhập mã TOTP (authenticator app) mới hoàn tất interaction.
  - `totp_secret` lưu mã hóa (`totp_secret_enc`) bằng **KEK tách khỏi DB** (.env).
  - Luồng bật MFA lần đầu: hiện QR, xác nhận một mã, kích hoạt.
  - project_admin/user thường: chưa bắt buộc MFA (phase sau).
- **Tham chiếu:** AD-10, AD-15, FR-07 | **Phụ thuộc:** E1-S4 | **Ước lượng:** L

### [E2-S2] Recovery codes + tài khoản break-glass
- **Story:** Là SSA, cần đường cứu khi mất thiết bị MFA để không tự khóa mình khỏi hệ thống.
- **Tiêu chí nghiệm thu:**
  - Sinh 10 recovery code (hash lưu `mfa_recovery`), hiển thị một lần để in giấy; dùng một code là vô hiệu nó.
  - Tài khoản `is_breakglass = true`: enforcement MFA **bỏ qua** tài khoản này (không hard-code email).
  - Đăng nhập bằng break-glass được ghi audit nổi bật.
- **Tham chiếu:** AD-10, FR-07 | **Phụ thuộc:** E2-S1 | **Ước lượng:** M

### [E2-S3] Chống dò mật khẩu (backoff + rate-limit)
- **Story:** Là hệ thống, cần chặn dò mật khẩu mà không cho kẻ tấn công khóa cứng tài khoản người thật.
- **Tiêu chí nghiệm thu:**
  - Backoff tăng dần theo account (delay, KHÔNG lockout cứng), reset khi đăng nhập đúng; ghi `login_attempts`.
  - Phủ cả `/oidc/token` (brute `client_secret` theo `client_id`+IP — cột `login_attempts.client_id`).
  - **Tài khoản SSA không bao giờ bị khóa bởi tác nhân ngoài** (chỉ backoff + MFA).
  - Tham số (ngưỡng, delay) trong Settings; lớp chặn theo IP để sau (theo metric).
- **Tham chiếu:** AD-9, FR-08 | **Phụ thuộc:** E1-S4 | **Ước lượng:** M

### [E2-S4] Policy mật khẩu
- **Story:** Là hệ thống, cần chuẩn mật khẩu tối thiểu và trải nghiệm đặt mật khẩu rõ ràng.
- **Tiêu chí nghiệm thu:**
  - Argon2 hash; policy ≥8 ký tự đủ 4 loại (hoa/thường/số/đặc biệt); checklist trực quan khi đặt.
  - Bắt đổi mỗi 90 ngày (`password_changed_at`); con số trong Settings.
- **Tham chiếu:** FR-32, NFR bảo mật | **Phụ thuộc:** E1-S4 | **Ước lượng:** M

*(E2-S5 "Quên mật khẩu" đã chuyển thành E4-S8 ở Epic 4 — xem `epic-4-quan-ly-user.md`.)*
