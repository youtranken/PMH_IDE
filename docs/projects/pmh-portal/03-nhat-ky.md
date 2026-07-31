# Nhật ký

Nhật ký ghi lại **đăng nhập và thao tác quản trị** để đối soát, điều tra sự cố và tuân thủ. Mở từ **Bảng quản trị → Nhật ký** (`/audit`).

## Các cột

| Cột | Ý nghĩa |
|---|---|
| **Thời gian** | Thời điểm xảy ra (giờ máy chủ) |
| **Người thực hiện** | Email người gây ra sự kiện (break-glass được ẩn) |
| **Hành động** | Việc đã làm, hiển thị tiếng Việt (di chuột để xem mã gốc) |
| **Đối tượng** | Thứ bị tác động — tên thật: `Người dùng: an@pmh.com.vn`, `Ứng dụng: QLTS`, `Tham số: smtp_host`… |
| **IP** | Địa chỉ IP nguồn |

## Xem và lọc

- **Lọc theo hành động**: gõ mã vào ô tìm (vd `login.success`, `user.updated`) để chỉ xem loại sự kiện đó.
- **Xem lưu trữ theo tháng** (chỉ SSA): nhật ký cũ được nén lưu theo tháng; chọn tháng trong ô lưu trữ để xem lại.
- **project_admin** chỉ thấy nhật ký thuộc **dự án mình quản**; SSA thấy tất cả (kể cả sự kiện toàn cục).

## Các hành động thường gặp

| Nhóm | Mã | Ý nghĩa |
|---|---|---|
| Đăng nhập | `login.success` / `login.failed` | Đăng nhập thành công / sai mật khẩu |
| | `login.denied_no_access` | Đăng nhập đúng nhưng không có quyền vào app |
| | `login.breakglass` | **Đăng nhập khẩn cấp bằng tài khoản cứu hộ** (chú ý!) |
| Mật khẩu | `password.reset_completed` | User đã đặt lại mật khẩu qua liên kết |
| | `user.password_reset` | Admin cấp lại mật khẩu cho user |
| 2 lớp | `mfa.enabled` / `mfa.disabled` | Bật / tắt xác thực 2 lớp |
| Người dùng | `user.created` / `user.updated` / `user.deleted` | Tạo / sửa / xóa user |
| | `user.sessions_revoked` | Hủy mọi phiên của user |
| | `user.ssa_granted` / `user.ssa_revoked` | Cấp / thu quyền SSA |
| Nhóm | `group.member_added` / `group.member_removed` | Thêm / gỡ thành viên nhóm |
| Client | `client.group_added` / `client.secret_rotated` | Gán nhóm cho app / xoay client secret |
| Cấu hình | `settings.updated` | Đổi tham số hệ thống |

## Điều nên chú ý

- **`login.breakglass`** xuất hiện = có người dùng tài khoản cứu hộ. Chỉ dùng khi thật sự kẹt; thấy bất thường thì rà ngay.
- Chuỗi **nhiều `login.failed` cùng một tài khoản/IP** = dấu hiệu dò mật khẩu (hệ thống đã tự làm chậm — xem **Cấu hình → Chống dò mật khẩu**).
- Nhật ký **chỉ ghi, không sửa được** — đó là bằng chứng đối soát.

## Về cột IP

Trên môi trường triển khai đúng chuẩn (máy chủ Linux), cột IP hiển thị **IP thật của người dùng**. Nếu thấy mọi dòng cùng một IP nội bộ (vd `172.x.0.1`), đó là hạn chế mạng của môi trường tạm — sẽ đúng khi chạy trên máy chủ chính thức.
