# DCC2

DCC2 xử lý **luồng Hợp đồng (Contract)** — chỉ thấy tuyến này. Chạy tại `de-qlhs.pmh.com.vn:8443`.

Bản cứng giao tay; giao–nhận cần bên nhận **xác nhận đã cầm giấy** mới đi tiếp. DCC2 chỉ nhập **đường dẫn file scan** làm bằng chứng.

## Đăng nhập & giao diện

- Nhập **email công ty** → PMH ID (SSO). Vai DCC do Admin cấp. Phiên thoát sau **15 phút** nghỉ.
- Thanh trên: 🔔 chuông (thời gian thực) · ngôn ngữ/giao diện · **Chuyển vai** (nếu có nhiều vai) · Thoát.

## Màn hình làm việc

- **Bản đồ tuyến** (thu gọn được): bảng chỉ đọc, mỗi ga hiện số hồ sơ + số quá hạn.
- **Trạm của tôi**: bảng cột, mỗi cột là một ga bạn cần hành động (chỉ hồ sơ Contract đang chạy). Ô tìm (`/`), lọc **Chỉ quá hạn**, **Ưu tiên**, **Bộ lọc đã lưu**.
- **Thẻ hồ sơ:** mã, pill quá hạn **"Nn"**, **"chờ bổ sung"**, **"GẤP"**, nhà thầu, số tiền, nút hành động.
- **Nút chính** (1 chạm) = bước tiến. **Menu ⋯** = thao tác cần lý do/SLA. Nhiều thao tác có xác nhận / **"Hoàn tác (5s)"**.

## Trình tự DCC2 (luồng Contract)

- **B1. Nhận bản cứng** (từ DCC1): giao–nhận **2 pha** — DCC1 đẩy sang ga *"Submitted to DCC2"*, bạn bấm **"Đã nhận bản cứng"** (nhập ngày nhận) → **Received by DCC2**. Giấy thiếu/sai → **"Thiếu giấy, trả về DCC1"** (đẩy ngược để DCC1 đối chiếu; không hoàn tác).
- **B2. Gửi Kế toán:** bấm **"Gửi ACC…"**, **nhập Document No (mã hợp đồng)** → gửi. Trùng mã → báo *"Document No … đã tồn tại — nhập mã khác."* Hồ sơ sang **Submitted to Accounting**.
- **B3. Nhận bản cứng lần 2** (sau khi DCC1 trình BOP và BOP duyệt, hồ sơ quay lại DCC2): bấm **"Đã nhận bản cứng"** (2 pha).
- **B4. Hoàn tất hồ sơ:** bấm **"Hoàn tất HĐ…"**, **nhập đường dẫn file scan** trên ổ chung (vd `\\share\scans\CT-2026-0001.pdf`) → xác nhận. Hồ sơ đóng ở **Completed** và **email cho Applicant**.

## Trả lại — qua DCC1

DCC2 **không tự trả lại Applicant**. Khi giấy thiếu/sai, chỉ dùng **"Thiếu giấy, trả về DCC1"** để đẩy ngược; DCC1 đối chiếu rồi mới quyết Trả lại hoặc bàn giao lại. Mở lại hồ sơ đã đóng: DCC2 chỉ **"Đề nghị mở lại"**, DCC1 mới bấm Reopen.

## Tạm dừng SLA

- **Chờ bổ sung (dừng SLA):** Menu ⋯ (bắt buộc lý do) khi chờ bên ngoài; có giấy → **"Đã có giấy — chạy lại SLA"**. Chỉ người đang giữ dừng/chạy lại được; phần đã quá hạn trước khi dừng vẫn giữ đỏ.

## Vị trí DCC2 trong luồng Contract

DCC1 nh?n → Andy duyệt → chuyển DCC2 → **DCC2 nhận + gửi ACC** → DCC1 nhận về từ ACC → trình BOP → BOP duyệt → chuyển DCC2 (Hardcopy) → **DCC2 nhập scan → Completed** (email Applicant).
