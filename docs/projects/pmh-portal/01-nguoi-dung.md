# Người dùng

Hướng dẫn quản lý tài khoản nhân viên trong PMH ID. Mở từ **Bảng quản trị → Người dùng**.

Đây là nơi bạn tạo tài khoản cho nhân viên, cấp lại mật khẩu, khóa/mở, và cho họ vào các ứng dụng của công ty (như QLTS, QLHS).

## Ba mức quyền

| Quyền | Ai giữ | Làm được gì |
|---|---|---|
| **Quản trị hệ thống** | Người phụ trách PMH ID (bạn) | Quản mọi tài khoản, nhóm, và cấu hình |
| **Quản trị dự án** | Người phụ trách 1 dự án | Quản tài khoản & nhóm trong dự án của mình |
| **Nhân viên** | Mọi người | Đăng nhập ứng dụng được cấp, tự đổi mật khẩu |

## Tạo tài khoản mới

1. Bấm **Thêm người dùng**.
2. Điền **email**, **mã nhân viên**, **họ tên**.
3. Chọn cách cấp mật khẩu lần đầu:
   - **Gửi qua email** — hệ thống tự sinh mật khẩu tạm và gửi tới email nhân viên (cần đã cấu hình email — xem mục **Cấu hình**).
   - **Đặt thủ công** — bạn tự đặt và báo mật khẩu cho nhân viên (dùng khi chưa có email).
4. Nhân viên **bắt buộc đổi mật khẩu** ngay lần đăng nhập đầu.

Lưu ý: tạo tài khoản xong, nhân viên **chưa vào được ứng dụng nào** cho tới khi bạn **thêm họ vào nhóm** phù hợp — xem mục **Nhóm**.

## Cấp lại mật khẩu

Khi nhân viên quên hoặc cần đặt lại:

- Trong menu của nhân viên, chọn **Cấp lại mật khẩu** → hệ thống gửi mật khẩu tạm mới (qua email hoặc bạn đặt thủ công). Mật khẩu cũ hết hiệu lực; nhân viên phải đổi ở lần đăng nhập kế.
- Nhân viên cũng có thể tự bấm **"Quên mật khẩu"** ở màn đăng nhập — hệ thống gửi **liên kết đặt lại** qua email của họ.

## Khóa, hủy phiên, xóa — chọn đúng việc

Ba thao tác dễ nhầm. Chọn theo mục đích:

| Thao tác | Kết quả | Đăng nhập lại được? | Dùng khi |
|---|---|---|---|
| **Hủy mọi phiên** | Đăng xuất nhân viên khỏi mọi thiết bị & ứng dụng ngay | **Có** | Nghi lộ mật khẩu, buộc đăng nhập lại |
| **Khóa** | Chặn đăng nhập ngay | **Không** — tới khi bạn mở lại | Nhân viên tạm nghỉ, đình chỉ |
| **Xóa** | Vô hiệu hóa và ẩn khỏi danh sách | **Không** | Nhân viên nghỉ hẳn |

Tài khoản đã **Xóa** vẫn **khôi phục** lại được nếu cần. Khi bạn Khóa/Hủy-phiên/Xóa, các ứng dụng (QLTS…) cũng đăng xuất người đó ngay.

## Tài khoản có thời hạn

Với nhân viên thời vụ hoặc đối tác, bạn có thể đặt **ngày hết hạn**. Đến hạn, hệ thống **tự khóa** tài khoản và gửi email nhắc trước vài ngày (số ngày đặt ở **Cấu hình**).

## Cấp quyền quản trị

- Muốn ai đó cùng quản một dự án, hãy **bổ nhiệm họ làm quản trị dự án** cho dự án đó.
- Chỉ **quản trị hệ thống** mới sửa được **email / mã nhân viên** của người khác (để tránh chiếm tài khoản). Quản trị dự án chỉ sửa được họ tên.

## Xác thực 2 lớp

Xác thực 2 lớp là lớp bảo vệ thêm: sau khi nhập mật khẩu, nhân viên nhập thêm **mã 6 số** từ ứng dụng Authenticator trên điện thoại (Google Authenticator, Microsoft Authenticator…).

- **Nhân viên tự bật** ở trang **Tài khoản** của họ (quét mã QR, lưu mã khôi phục). Bạn **không** bật thay được.
- Bạn có thể **yêu cầu bắt buộc** một số vai trò phải bật — xem mục **Cấu hình**.

## Tạo nhiều tài khoản một lúc

Dùng **Nhập từ file** để tạo hàng loạt: tải file mẫu, điền danh sách, tải lên. Hệ thống báo dòng nào tạo được, dòng nào lỗi. Sau đó vẫn cần thêm từng người vào nhóm để họ vào ứng dụng.
