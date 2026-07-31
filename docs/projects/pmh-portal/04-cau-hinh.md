# Cấu hình

Tham số vận hành toàn hệ thống. Mở từ **Bảng quản trị → Cấu hình** (`/settings`) — **chỉ SSA** vào được. Mọi thay đổi **áp dụng ngay**, không cần khởi động lại.

> Ô **mật khẩu / bí mật** chỉ **nhập được, không hiện lại** (lưu mã hóa). Để trống = giữ nguyên giá trị cũ.

## Email (SMTP) — quan trọng nhất khi bàn giao

Đây là kênh gửi mật khẩu tạm, liên kết đặt lại mật khẩu, cảnh báo hết hạn. **Không cấu hình đúng thì user không nhận được email.**

| Tham số | Giá trị (ví dụ Gmail) |
|---|---|
| **SMTP host** | `smtp.gmail.com` |
| **SMTP port** | `587` |
| **SMTP user** | địa chỉ Gmail gửi thư |
| **SMTP mật khẩu** | **App Password 16 ký tự** (KHÔNG dùng mật khẩu Gmail thường) |
| **Địa chỉ From** | khớp tài khoản gửi |

**Gmail bắt buộc App Password**: bật **Xác minh 2 bước** cho tài khoản Google → tạo **App Password** (Google Account → Bảo mật → Mật khẩu ứng dụng) → dán vào ô mật khẩu SMTP.

Sau khi nhập, bấm **Gửi thử** để kiểm ngay — nếu lỗi, hệ thống hiện đúng thông báo từ máy chủ email (vd sai App Password).

## Xác thực 2 lớp (bắt buộc theo vai trò)

- **Vai bắt buộc MFA**: nhập danh sách vai trò (phẩy) buộc phải bật 2 lớp, vd `ssa` hoặc `ssa,project_admin`.
- User thuộc vai trò đó, khi đăng nhập mà chưa bật, sẽ **bị buộc thiết lập** (quét QR) trước khi vào.
- Để trống = không bắt buộc ai (user tự bật nếu muốn).
- **Khuyến nghị**: đặt tối thiểu `ssa` để mọi quản trị viên đều có 2 lớp.

## Phiên & Token

| Tham số | Ý nghĩa | Mặc định |
|---|---|---|
| **TTL access token** | Token sống bao lâu trước khi tự làm mới | 300 giây (5 phút) |
| **Idle timeout phiên** | Không hoạt động bao lâu thì hết phiên | 900 giây (15 phút) |
| **Trần tuyệt đối phiên** | Buộc đăng nhập lại sau ngần này dù đang dùng | 43200 giây (12 giờ) |

Giảm **TTL access token** → khi Khóa/Hủy-phiên, user hết quyền nhanh hơn (đánh đổi: gọi làm mới token nhiều hơn).

## Mật khẩu & Chống dò

| Tham số | Ý nghĩa |
|---|---|
| **Độ dài mật khẩu tối thiểu** | Số ký tự tối thiểu (còn yêu cầu đủ loại chữ/số/ký hiệu) |
| **Chu kỳ đổi mật khẩu** | Bao nhiêu ngày thì buộc đổi |
| **Hạn mật khẩu tạm** | Mật khẩu tạm hết hiệu lực sau bao nhiêu giờ nếu chưa dùng |
| **Ngưỡng chống dò / account, / IP** | Số lần sai liên tiếp trước khi hệ thống làm chậm |
| **Backoff chống dò tối đa** | Thời gian chờ tối đa bị áp khi vượt ngưỡng |

## Vận hành & Lưu trữ

| Tham số | Ý nghĩa |
|---|---|
| **Đường dẫn backup** | Thư mục lưu bản sao lưu đã mã hóa (DB + khóa + cấu hình) |
| **Đường dẫn lưu trữ audit** | Thư mục nén nhật ký cũ theo tháng |
| **Cảnh báo trước hết hạn** | Gửi email nhắc trước khi tài khoản hết hạn bao nhiêu ngày |

## Checklist bàn giao nhanh

1. Nhập **SMTP thật** (App Password) → bấm **Gửi thử** thấy mail tới.
2. Đặt **Vai bắt buộc MFA = `ssa`**, rồi bật 2 lớp cho tài khoản quản trị của bạn.
3. Xem lại **TTL/idle/trần phiên** hợp với chính sách công ty.
4. Xác nhận **đường dẫn backup** đang trỏ nơi an toàn (khác đĩa dữ liệu).
5. Cất **KEK và mật khẩu backup** offline — mất là không khôi phục được dữ liệu mã hóa.
