# Cấu hình

Các tham số vận hành của hệ thống. Mở từ **Bảng quản trị → Cấu hình** (chỉ **quản trị hệ thống** vào được). Thay đổi có hiệu lực ngay.

> Phần lớn tham số đã được bộ phận kỹ thuật (IT) đặt sẵn khi bàn giao — bạn **thường chỉ cần lo mục Email và Xác thực 2 lớp**. Những mục còn lại nên **để nguyên** trừ khi bạn hiểu rõ hoặc được IT hướng dẫn.

## Email — việc quan trọng nhất

Đây là kênh gửi mật khẩu tạm, liên kết đặt lại mật khẩu và email nhắc hết hạn cho nhân viên. **Chưa cấu hình đúng thì nhân viên không nhận được email nào.**

Điền các ô trong mục **Email**:

| Ô | Điền gì (dùng Gmail công ty) |
|---|---|
| **Máy chủ (host)** | `smtp.gmail.com` |
| **Cổng (port)** | `587` |
| **Tài khoản** | địa chỉ Gmail dùng để gửi |
| **Mật khẩu** | **Mật khẩu ứng dụng** (xem bên dưới) |
| **Người gửi (From)** | tên/địa chỉ hiện ở thư gửi đi |

**Vì sao cần "Mật khẩu ứng dụng":** Gmail không cho dùng mật khẩu đăng nhập thường để gửi thư tự động. Bạn cần:

1. Bật **Xác minh 2 bước** cho tài khoản Google đó.
2. Vào Tài khoản Google → **Bảo mật → Mật khẩu ứng dụng**, tạo một mật khẩu 16 ký tự.
3. Dán mật khẩu 16 ký tự đó vào ô **Mật khẩu**.

Sau khi điền, bấm **Gửi thử** rồi nhập email của bạn — nếu nhận được thư là xong. Nếu báo lỗi, làm lại bước Mật khẩu ứng dụng (đây là nguyên nhân thường gặp nhất).

## Xác thực 2 lớp bắt buộc

Bạn có thể **bắt buộc** một số vai trò phải bật xác thực 2 lớp:

- Vào mục **Xác thực 2 lớp**, nhập vai trò cần bắt buộc, ví dụ `ssa` (bắt buộc mọi quản trị hệ thống).
- Người thuộc vai trò đó, nếu chưa bật, sẽ **được yêu cầu thiết lập** (quét mã QR) ngay lần đăng nhập kế.
- **Khuyến nghị**: bật ít nhất cho quản trị viên, vì đây là tài khoản quan trọng nhất.

## Các mục còn lại (thường để nguyên)

Những tham số này IT đã đặt hợp lý. Chỉ đổi khi thật sự cần:

- **Thời gian phiên đăng nhập** — bao lâu không dùng thì tự đăng xuất, và tối đa một phiên kéo dài bao lâu.
- **Chính sách mật khẩu** — độ dài tối thiểu, bao lâu buộc đổi mật khẩu.
- **Chống dò mật khẩu** — sau bao nhiêu lần sai thì hệ thống làm chậm lại.
- **Nhắc trước hết hạn** — gửi email nhắc trước khi tài khoản hết hạn mấy ngày.
- **Sao lưu & lưu trữ** — nơi hệ thống cất bản sao lưu và nhật ký cũ (do IT quản).

## Việc cần làm khi mới nhận bàn giao

1. Điền **Email** (Mật khẩu ứng dụng) → bấm **Gửi thử** thấy thư tới.
2. Đặt **bắt buộc 2 lớp** cho quản trị viên, rồi tự bật 2 lớp cho tài khoản của bạn.
3. Xem qua các mục còn lại cho biết, nhưng chưa cần đổi gì nếu chưa chắc.

Mọi việc liên quan sao lưu, khôi phục, hạ tầng máy chủ — liên hệ bộ phận kỹ thuật (IT).
