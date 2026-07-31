# Người dùng

Hướng dẫn quản lý tài khoản người dùng PMH ID sau khi IT bàn giao. Mở từ **Bảng quản trị → Người dùng** (`/admin/users`).

## Vai trò trong hệ thống

PMH ID có 3 mức quyền. Hiểu đúng vai trò trước khi thao tác:

| Vai trò | Phạm vi | Làm được gì |
|---|---|---|
| **SSA** (Super System Admin) | Toàn hệ thống | Mọi thứ: user, nhóm, dự án, client, cấu hình, nhật ký toàn cục |
| **project_admin** | Theo dự án được giao | Quản user/nhóm trong phạm vi dự án của mình; xem nhật ký của dự án |
| **Người dùng** | Bản thân | Đăng nhập app được cấp, tự đổi mật khẩu, tự bật xác thực 2 lớp |

Tài khoản **break-glass** (cứu hộ khẩn cấp) được **ẩn hoàn toàn** khỏi danh sách — đúng thiết kế, giữ offline để dùng khi kẹt.

## Tạo người dùng mới

1. Bấm **Thêm người dùng**.
2. Nhập **email**, **mã nhân viên**, **họ tên**.
3. Chọn cách cấp mật khẩu:
   - **Gửi mật khẩu tạm qua email** — hệ thống sinh mật khẩu ngẫu nhiên, gửi tới email user. Cần cấu hình email trước (xem tài liệu **Cấu hình**).
   - **Đặt mật khẩu thủ công** — dùng khi chưa có email; bạn đọc mật khẩu cho user.
4. User **bắt buộc đổi mật khẩu** ở lần đăng nhập đầu.

Muốn user vào được một app (QLTS, QLHS…), phải **thêm user vào nhóm** được gán cho app đó — xem tài liệu **Nhóm**.

## Cấp lại / đặt lại mật khẩu

Trong menu của từng user:

- **Cấp lại mật khẩu** → sinh mật khẩu tạm mới (gửi email hoặc đặt thủ công). Mật khẩu cũ mất hiệu lực; user phải đổi ở lần đăng nhập kế.
- User tự quên mật khẩu thì dùng **"Quên mật khẩu"** ở màn đăng nhập — hệ thống gửi **liên kết đặt lại** qua email (không lộ, dùng một lần, hết hạn ngắn).

## Khóa, hủy phiên, xóa — khác nhau thế nào

Đây là điểm hay nhầm. Chọn đúng theo mục đích:

| Thao tác | Tác dụng | Đăng nhập lại được? | Khi nào dùng |
|---|---|---|---|
| **Hủy mọi phiên** | Đá user khỏi mọi thiết bị **tức thì** (cả app như QLTS) | **Có** | Nghi lộ phiên, buộc đăng nhập lại |
| **Khóa** (vô hiệu hóa) | Chặn đăng nhập **tức thì** + đá phiên | **Không** (tới khi mở lại) | Nhân viên nghỉ tạm, đình chỉ |
| **Xóa** (soft-delete) | Vô hiệu hóa + ẩn khỏi danh sách | **Không** | Nhân viên nghỉ hẳn |

- **Khôi phục** được tài khoản đã xóa (soft-delete) nếu cần.
- Khi Khóa/Hủy-phiên/Xóa, PMH ID **tự báo cho các app** (QLTS…) để đá user ra ngay — không chờ.

## Tài khoản có hạn (expires_at)

Đặt **ngày hết hạn** cho tài khoản thời vụ / nhà thầu. Đến hạn, hệ thống **tự khóa** và gửi email cảnh báo trước (số ngày cấu hình ở **Cấu hình → Cảnh báo trước hết hạn**).

## Phân quyền quản trị

- **Cấp/thu quyền SSA**: chỉ SSA làm được. Cân nhắc kỹ — SSA toàn quyền.
- **Bổ nhiệm project_admin**: gắn user làm quản trị cho một dự án cụ thể (trong phần Dự án/Client).
- Chỉ SSA mới đổi được **email / mã nhân viên** của người khác (chống chiếm tài khoản). project_admin sửa được họ tên.

## Xác thực 2 lớp (MFA / TOTP)

- MFA là **mã 6 số từ app Authenticator** (Google/Microsoft Authenticator, Authy) — **không phải mã qua email**.
- **User tự bật** ở trang **Tài khoản** (quét QR, lưu recovery codes). Admin **không** bật hộ được.
- SSA có thể **bắt buộc** một số vai trò phải bật MFA — xem **Cấu hình → Xác thực 2 lớp**.

## Import nhiều user bằng CSV

Dùng **Nhập CSV** để tạo hàng loạt: tải mẫu, điền, tải lên. Hệ thống báo cáo dòng nào thành công / lỗi. Mỗi user mới vẫn cần được thêm vào nhóm để vào app.
