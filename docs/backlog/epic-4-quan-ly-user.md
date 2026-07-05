# Epic 4 — Quản lý user

**Phase:** 2
**Mục tiêu:** SSA/project_admin quản trọn vòng đời user qua portal, không cần đụng DB: tạo, sửa, khóa, soft-delete/reactivate, import/export CSV, mật khẩu tạm, tài khoản có hạn.
**Tham chiếu chính:** FR-12..18, AD-13.

---

### [E4-S1] User CRUD + phân quyền tạo
- **Story:** Là admin, cần tạo và sửa thông tin user.
- **Tiêu chí nghiệm thu:**
  - SSA và project_admin đều tạo user (họ tên, email — unique, mã NV — unique).
  - Chặn trùng email/mã NV (kể cả bản ghi `deleted`) → báo rõ, gợi ý reactivate thay vì tạo mới.
- **Tham chiếu:** FR-12 | **Phụ thuộc:** E0-S5 | **Ước lượng:** M

### [E4-S2] Soft-delete + reactivate
- **Story:** Là admin, cần "xóa" user mà giữ lịch sử, và kích hoạt lại người quay lại.
- **Tiêu chí nghiệm thu:**
  - "Xóa" = set `status=deleted` + `deleted_at` (không xóa cứng). Khóa/xóa toàn cục **chỉ SSA**.
  - Reactivate bản ghi cũ (cập nhật mã NV nếu cần), không tạo bản ghi trùng email.
  - Xóa → phát event `user.deleted` (dùng ở Epic 7).
  - **Thu hồi toàn cục (FR-05):** SSA khóa/xóa user → `revokeByGrantId` mọi grant của user (văng khỏi mọi app ≤5'). Có **nút "hủy toàn bộ phiên"** độc lập (chỉ SSA) làm điều tương tự mà không khóa user.
- **Tham chiếu:** FR-17, FR-15 (khóa SSA), FR-05 | **Phụ thuộc:** E4-S1, E1-S3 | **Ước lượng:** M

### [E4-S3] Import CSV
- **Story:** Là admin, cần nạp nhiều user một lần từ file.
- **Tiêu chí nghiệm thu:**
  - Upload template `employee_code,email,full_name,groups` → preview báo lỗi từng dòng (trùng DB, **trùng nội bộ file**, sai định dạng, group chưa tồn tại — tick "tự tạo group").
  - Commit **per-row**, báo cáo created/skipped/failed cuối cùng.
  - Gửi email mật khẩu tạm **tách rời** việc tạo user (qua email_queue) — tạo thành công không rớt vì SMTP nghẽn.
- **Tham chiếu:** FR-13, AD-13 | **Phụ thuộc:** E4-S1, E4-S7 | **Ước lượng:** L

### [E4-S4] Export CSV theo phạm vi
- **Story:** Là admin, cần xuất danh sách user để báo cáo/đối soát.
- **Tiêu chí nghiệm thu:**
  - Lọc theo group/trạng thái rồi xuất CSV.
  - project_admin chỉ xuất được user trong phạm vi project mình.
- **Tham chiếu:** FR-14, AD-1 (scope) | **Phụ thuộc:** E4-S1 | **Ước lượng:** S

### [E4-S5] Mật khẩu tạm
- **Story:** Là hệ thống, cần cơ chế mật khẩu tạm dùng chung cho user mới / quên MK / admin reset.
- **Tiêu chí nghiệm thu:**
  - Sinh mật khẩu tạm, gửi email, hạn 24h (Settings), bắt đổi ở lần đăng nhập kế (`must_change_password`).
  - Reset bởi project_admin chỉ hủy phiên trong phạm vi project mình (FR-05).
- **Tham chiếu:** FR-15, FR-16 | **Phụ thuộc:** E4-S1, E4-S7 (email queue), E1-S3 | **Ước lượng:** M

### [E4-S6] Tài khoản có hạn (expires_at)
- **Story:** Là admin, cần đặt hạn cho nhân viên thời vụ/thử việc.
- **Tiêu chí nghiệm thu:**
  - Đặt `expires_at`; cron auto-lock khi quá hạn (UTC).
  - Email cảnh báo T-N ngày trước hạn (cột đánh dấu đã-gửi để không trùng).
- **Tham chiếu:** FR-18, AD-13 | **Phụ thuộc:** E4-S1, E4-S7 | **Ước lượng:** M

### [E4-S7] Email queue + worker
- **Story:** Là hệ thống, cần gửi email ngầm, đáng tin, không chặn request.
- **Tiêu chí nghiệm thu:**
  - Bảng `email_queue`; worker lấy job bằng `SELECT ... FOR UPDATE SKIP LOCKED` + `locked_at`.
  - Throttle theo giới hạn Gmail SMTP; retry giãn dần khi lỗi.
  - Dev gửi qua Mailpit, prod qua Gmail SMTP (creds .env).
- **Tham chiếu:** AD-13 | **Phụ thuộc:** E0-S4 | **Ước lượng:** M

### [E4-S8] Quên mật khẩu *(chuyển từ E2-S5)*
- **Story:** Là user, cần tự lấy lại quyền truy cập khi quên mật khẩu.
- **Tiêu chí nghiệm thu:**
  - User yêu cầu → gửi mật khẩu tạm (E4-S5, hạn 24h) qua email; bắt đổi ở lần đăng nhập kế.
  - Endpoint chịu chống lạm dụng (AD-9) và trả **thông báo đồng nhất** (không tiết lộ email tồn tại).
- **Tham chiếu:** FR-11, AD-9 | **Phụ thuộc:** E4-S5, E4-S7, E2-S3 | **Ước lượng:** S
