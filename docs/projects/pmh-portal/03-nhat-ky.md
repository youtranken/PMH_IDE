# Nhật ký

Nhật ký ghi lại **ai đã làm gì** trong hệ thống — đăng nhập, tạo/sửa tài khoản, đổi nhóm, đổi cấu hình. Dùng để đối soát và kiểm tra khi có nghi vấn. Mở từ **Bảng quản trị → Nhật ký**.

## Đọc bảng nhật ký

Mỗi dòng có 5 cột:

| Cột | Nghĩa |
|---|---|
| **Thời gian** | Lúc nào |
| **Người thực hiện** | Ai làm (email) |
| **Hành động** | Việc gì, ghi bằng tiếng Việt dễ hiểu |
| **Đối tượng** | Tác động lên ai/cái gì — ví dụ `Người dùng: an@pmh.com.vn`, `Ứng dụng: QLTS` |
| **IP** | Địa chỉ mạng nơi thao tác |

## Tìm và lọc

- **Lọc theo việc**: gõ vào ô tìm để chỉ xem một loại sự kiện (ví dụ đăng nhập).
- **Xem theo tháng cũ**: nhật ký cũ được lưu theo tháng; chọn tháng để xem lại.
- Nếu bạn là **quản trị dự án**, bạn chỉ thấy nhật ký thuộc dự án mình.

## Những việc thường thấy

- **Đăng nhập thành công / sai mật khẩu** — theo dõi ai vào hệ thống.
- **Tạo / sửa / xóa người dùng**, **cấp lại mật khẩu**.
- **Thêm / gỡ thành viên nhóm**, **gán nhóm cho ứng dụng**.
- **Bật / tắt xác thực 2 lớp**.
- **Đổi cấu hình hệ thống**.

## Dấu hiệu cần chú ý

- **Nhiều lần đăng nhập sai liên tiếp** cùng một tài khoản → có thể ai đó đang dò mật khẩu. Hệ thống đã tự động làm chậm lại, nhưng bạn nên để ý.
- **Từ chối đăng nhập vì không có quyền** → người đó chưa được thêm vào nhóm của ứng dụng.
- Nhật ký **chỉ ghi thêm, không sửa hay xóa được** — đó là bằng chứng đối soát đáng tin.

Nếu cần trích xuất nhật ký để báo cáo hoặc điều tra sâu, liên hệ bộ phận kỹ thuật (IT).
