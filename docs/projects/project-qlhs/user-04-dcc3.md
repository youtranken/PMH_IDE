# DCC3

DCC3 xử lý **luồng Thanh toán (Payment)** — tuyến ngắn nhất, chỉ thấy tuyến này. Chạy tại `de-qlhs.pmh.com.vn`; tên trạng thái giữ **tiếng Anh** gốc.

**Không đính kèm file** — bản cứng giao tay; giao–nhận cần bên nhận **xác nhận đã cầm giấy** mới đi tiếp.

## Đăng nhập & giao diện

- Nhập **email công ty** → PMH ID (SSO). Vai DCC do Admin cấp. Phiên thoát sau **15 phút** nghỉ.
- Thanh trên: 🔔 chuông (thời gian thực) · ngôn ngữ/giao diện · **Chuyển vai** (nếu có nhiều vai) · Thoát.
- **Nhắc sáng:** công tắc email nhắc việc 7h30 (chỉ gửi khi có hồ sơ cần chú ý).

## Màn hình làm việc

- **Bản đồ tuyến** (thu gọn được): bảng chỉ đọc, mỗi ga hiện số hồ sơ + số quá hạn.
- **Trạm của tôi**: bảng cột, mỗi cột là một ga bạn cần hành động (chỉ hồ sơ Payment đang chạy). Ô tìm (`/`), lọc **Chỉ quá hạn**, **Ưu tiên**, **Bộ lọc đã lưu**.
- **Thẻ hồ sơ:** mã, pill quá hạn **"Nn"**, **"chờ bổ sung"**, **"GẤP"**, nhà thầu, số tiền, nút hành động.
- **Nút chính** (1 chạm) = bước tiến. **Menu ⋯** = thao tác cần lý do/SLA. Có xác nhận / **"Hoàn tác (5s)"**.

## Trình tự DCC3 (luồng Payment)

- **B1. Nhận bản cứng** (từ DCC1): giao–nhận **2 pha** — bấm **"Đã nhận bản cứng"** (nhập ngày nhận) → **Received by DCC3**. Giấy thiếu/sai → **"Thiếu giấy, trả về DCC1"** (đẩy ngược để DCC1 đối chiếu).
- **B2. Gửi Kế toán = ĐÓNG:** bấm **"Gửi ACC…"**, **nhập Document No** → gửi. Hồ sơ **đóng ngay** ở **Sent to Accounting** *(Đã chuyển Kế toán)*.

**Lưu ý quan trọng:** với Payment, gửi Kế toán là **đóng luôn** — hộp xác nhận *"Gửi ACC sẽ đóng hồ sơ ngay… (không qua BOP, không email Applicant) và không thể hoàn tác."* Đây **không phải** `Completed` (tránh hiểu nhầm "đã trả tiền"); Document No là bằng chứng đã chuyển Kế toán.

## Trả lại — qua DCC1

DCC3 **không tự trả lại Applicant**. Giấy thiếu/sai chỉ dùng **"Thiếu giấy, trả về DCC1"** để đẩy ngược; DCC1 mới quyết Trả lại/bàn giao lại. Mở lại hồ sơ đã đóng: DCC3 chỉ **"Đề nghị mở lại"**, DCC1 mới bấm Reopen. *(Thao tác tương tự DCC2, khác ở chỗ tuyến Payment đóng ngay tại bước gửi ACC, không có bước hoàn tất bản cứng.)*

## Khoá mềm, giành quyền, tạm dừng SLA

- **Khoá mềm:** mở/xử lý hồ sơ giữ chỗ ~5 phút; người khác đang giữ → *"{tên} đang xử lý"*, ẩn nút.
- **Giành quyền (Seize):** bấm **"Giành quyền"** khi khoá người kia đã hết hạn.
- **Chờ bổ sung (dừng SLA):** Menu ⋯ (bắt buộc lý do) khi chờ bên ngoài; có giấy → **"Đã có giấy — chạy lại SLA"**. Chỉ người đang giữ dừng/chạy lại được; phần đã quá hạn trước khi dừng vẫn giữ đỏ.

## Vị trí DCC3 trong luồng Payment

Applicant nộp → DCC1 bốc + sinh mã → Andy duyệt → chuyển DCC3 → **DCC3 nhận bản cứng** → **DCC3 nhập Document No → gửi ACC** → **Sent to Accounting** (đóng ngay, không qua BOP, không email).
