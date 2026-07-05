# Epic 5 — Group, Project & Client

**Phase:** 2
**Mục tiêu:** Quản group và quyền truy cập qua `client_groups`; tạo project + client (dev/prod), cấp/rotate secret; bổ nhiệm project_admin. Đây là nơi hiện thực mô hình quyền cốt lõi.
**Tham chiếu chính:** FR-19..25, AD-11, AD-12.

---

### [E5-S1] Group CRUD
- **Story:** Là admin, cần tạo và quản nhóm user.
- **Tiêu chí nghiệm thu:**
  - Group toàn cục; SSA và project_admin đều tạo được group mới.
  - Group chỉ có ý nghĩa truy cập khi được gán cho client (không có "group thuộc project" tách rời).
- **Tham chiếu:** FR-19 | **Phụ thuộc:** E0-S5 | **Ước lượng:** S

### [E5-S2] Gán/gỡ member theo phạm vi
- **Story:** Là admin, cần thêm/bớt user vào group.
- **Tiêu chí nghiệm thu:**
  - SSA gán mọi group; project_admin chỉ với group **đang gán cho client trong project mình**.
  - "User thuộc project P" = JOIN users→user_groups→client_groups→clients(project_id=P).
  - Group dùng chung nhiều project → admin các project đó đều sửa được member; audit ghi lại.
  - **Thu hồi phạm vi (FR-05):** gỡ user khỏi group do project_admin → revoke phiên của user trên các client thuộc project đó (không đụng app project khác).
- **Tham chiếu:** FR-20, FR-05 | **Phụ thuộc:** E5-S1, E1-S3 | **Ước lượng:** M

### [E5-S3] Gán group cho client + allow_all_groups
- **Story:** Là admin, cần quyết group nào đăng nhập được app nào.
- **Tiêu chí nghiệm thu:**
  - Bảng `client_groups` là nguồn quyền truy cập; nút "gán tất cả group" (`allow_all_groups`).
  - Tạo group mới khi có client bật allow_all → cảnh báo "N client sẽ tự thấy group này" + ghi audit.
  - `allow_all_groups` chỉ nới quyền LOGIN, KHÔNG nới scope đọc Directory (AD-11).
- **Tham chiếu:** FR-21, AD-11 | **Phụ thuộc:** E5-S1, E5-S5 | **Ước lượng:** M

### [E5-S4] Project CRUD (chỉ SSA)
- **Story:** Là SSA, cần tạo và quản project.
- **Tiêu chí nghiệm thu:**
  - Chỉ SSA tạo/sửa project; project_admin quản trị trong project được phân công (không tạo project).
- **Tham chiếu:** FR-22 | **Phụ thuộc:** E0-S5 | **Ước lượng:** S

### [E5-S5] Client CRUD (dev/prod) + app_url
- **Story:** Là admin, cần cấp credential cho từng môi trường của project.
- **Tiêu chí nghiệm thu:**
  - Dưới mỗi project tạo nhiều client theo `env[dev|prod]`; mỗi client có `client_id`, `redirect_uris`, `app_url`.
  - `client_secret` sinh, **hiển thị một lần** khi tạo (hash lưu); admin copy giao dev.
  - disable client (chặn cấp token mới) bất kỳ lúc nào.
- **Tham chiếu:** FR-22, FR-23, FR-24 | **Phụ thuộc:** E5-S4 | **Ước lượng:** M

### [E5-S6] Rotate client_secret có ân hạn + thu hồi
- **Story:** Là admin, cần đổi secret của client mà không làm gãy app prod đang chạy.
- **Tiêu chí nghiệm thu:**
  - Bảng `client_secrets` nhiều secret song song; rotate = thêm `active` + đặt cũ `retiring` với hạn cấu hình.
  - Token endpoint chấp nhận cả secret active và retiring còn hạn; cron dọn hết hạn.
  - Nút **thu hồi ngay** (`revoked` + `revoked_at`, giữ dấu vết) cho trường hợp lộ.
- **Tham chiếu:** FR-24, AD-12 | **Phụ thuộc:** E5-S5 | **Ước lượng:** M

### [E5-S7] Bổ nhiệm project_admin
- **Story:** Là SSA, cần giao quyền quản project cho người khác.
- **Tiêu chí nghiệm thu:**
  - Gán user vào vai `project_admin` (`admin_roles`) kèm danh sách project (`admin_projects`).
  - Mọi quyền phạm vi (tạo user/group, reset MK, xem audit, export) đều đọc từ `admin_projects`.
- **Tham chiếu:** FR-25 | **Phụ thuộc:** E5-S4 | **Ước lượng:** S
