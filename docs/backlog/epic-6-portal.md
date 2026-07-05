# Epic 6 — Portal: Launcher, self-service, audit, settings

**Phase:** 2
**Mục tiêu:** Trang chủ cho user (Launcher + self-service) và các màn quản trị còn lại (audit, settings). Đây là mặt tiền của hệ thống.
**Tham chiếu chính:** FR-09, FR-10, FR-29..32, AD-1, AD-15.

---

### [E6-S1] Trang chủ Launcher
- **Story:** Là user, sau đăng nhập cần thấy các app mình được vào.
- **Tiêu chí nghiệm thu:**
  - Lưới các app user được truy cập (user thuộc ≥1 group đã gán cho client của app — qua `client_groups`).
  - Bấm mở app ở tab mới theo `app_url`.
- **Tham chiếu:** FR-09 | **Phụ thuộc:** E5-S3, E1-S4 | **Ước lượng:** M

### [E6-S2] Self-service
- **Story:** Là user, cần tự quản tài khoản cơ bản.
- **Tiêu chí nghiệm thu:**
  - Đổi mật khẩu (checklist policy); xem mình thuộc group nào.
  - **User tự đổi mật khẩu (FR-05):** hủy các phiên khác của chính họ, **giữ phiên hiện tại**.
  - Xem danh sách phiên đang đăng nhập (từ bảng `sessions` — projection) và đăng xuất phiên bất kỳ (revoke qua `oidc_payloads`).
- **Tham chiếu:** FR-10, FR-05 | **Phụ thuộc:** E1-S5, E2-S4 | **Ước lượng:** M

### [E6-S3] Audit ghi
- **Story:** Là hệ thống, cần ghi lại mọi đăng nhập và thao tác quản trị để truy vết.
- **Tiêu chí nghiệm thu:**
  - Ghi mọi login (thành công/thất bại) + mọi thao tác admin: ai, làm gì, lên đối tượng nào, lúc nào, IP.
  - Mỗi bản ghi gắn `project_id` (NULL = sự kiện toàn cục).
- **Tham chiếu:** FR-29 | **Phụ thuộc:** E0-S5 | **Ước lượng:** M

### [E6-S4] Xem audit theo phạm vi + trình xem lưu trữ
- **Story:** Là admin, cần tra cứu audit trong quyền của mình.
- **Tiêu chí nghiệm thu:**
  - SSA xem tất; project_admin lọc theo `project_id` thuộc phạm vi mình.
  - Mục "Xem lưu trữ": chọn file tháng đã nén, hệ thống giải nén hiển thị (không thao tác tay).
- **Tham chiếu:** FR-30, FR-31 | **Phụ thuộc:** E6-S3, E3-S6 | **Ước lượng:** M

### [E6-S5] Trang Settings (SSA)
- **Story:** Là SSA, cần chỉnh tham số vận hành mà không sửa code.
- **Tiêu chí nghiệm thu:**
  - Nhóm: TTL token, idle, policy MK (độ dài/độ phức tạp/chu kỳ), hạn MK tạm, path backup, **SMTP host/port** (creds ở .env), tham số chống dò.
  - Đổi giá trị áp dụng runtime (cache invalidate).
- **Tham chiếu:** FR-32, AD-15 | **Phụ thuộc:** E0-S4 | **Ước lượng:** M
