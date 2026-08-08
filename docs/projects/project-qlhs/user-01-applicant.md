# Applicant (Nộp hồ sơ)

Applicant **nộp và theo dõi hồ sơ** của mình. Bạn chỉ thấy hồ sơ của bạn. Chạy tại `de-qlhs.pmh.com.vn`. Tên trạng thái giữ **tiếng Anh** gốc (tiếng Việt trong ngoặc để đọc).

**Không đính kèm file** trong hệ thống — bản cứng bạn giao tay như quy trình giấy; QLHS chỉ mang thông tin.

## Đăng nhập

- Nhập **email công ty** (vd `ban@pmh.com.vn`) → chuyển sang PMH ID (SSO), nhập mật khẩu trên trang PMH ID.
- Mở QLHS từ cổng PMH ("Mở dự án") thì **tự đăng nhập**.
- Mọi người mặc định là **Applicant**. Phiên tự thoát sau **15 phút** nghỉ.

## Giao diện chung

Thanh trên cùng: nút về trang chủ · 🔔 **Chuông thông báo** (số chưa đọc, cập nhật thời gian thực, bấm dòng để mở hồ sơ) · đổi **ngôn ngữ / giao diện** · **Thoát**. **Trợ lý QLHS** nổi ở góc để hỏi nhanh.

## Tạo hồ sơ mới

Trang chủ là **"Theo dõi hồ sơ"** → bấm **"Tạo hồ sơ mới"**. Điền 9 trường (dấu `*` = bắt buộc):

| Trường | Ghi chú |
|---|---|
| **Subject** | Bắt buộc |
| **Document Type** | Chọn từ danh mục — **quyết định luồng xử lý** |
| **Contractor/Designer/Supplier** | Bắt buộc; không có ghi `N/A` |
| **Contract No.** | Bắt buộc; không có ghi `N/A` |
| **Project/Team** | Chọn từ danh mục |
| **Amount** | Số tiền; không có ghi `0` |
| **Currency** | VND/USD/EURO/N/A |
| **Payment Term** | Chọn từ danh mục |
| **Budget code & Plan code** | Bắt buộc; không có ghi `N/A` |

- Chọn **Mức ưu tiên**: **Thường** (mặc định) hoặc **Gấp**.
- Bấm **Nộp hồ sơ** → *"Đã tạo & nộp hồ sơ."* Hồ sơ vào **Pool** chờ DCC1 tiếp nhận.

## Theo dõi hồ sơ của tôi

Trang **"Theo dõi hồ sơ"** hiển thị mọi hồ sơ của bạn.

- **3 thẻ KPI:** Đang chạy · **Bị trả lại** (đỏ khi > 0, cần bạn sửa & nộp lại) · Đã đóng.
- **Bộ lọc:** Tất cả / Đang chạy / Bị trả lại / Đã đóng.
- Danh sách **tự cập nhật thời gian thực**; dòng chưa xem quá 24 giờ có chấm báo.
- **Cột Status** hai dòng (tên gốc + tiếng Việt), vd `Submitted` → *Chờ tiếp nhận (Pool)*, `Returned` → *Bị trả lại*, `Completed` → *Hoàn tất*.
- **Menu ⋯** mỗi dòng (tùy trạng thái): Xem chi tiết · Sửa hồ sơ · Sửa & nộp lại · Nhân bản · Thu hồi.

## Xem chi tiết hồ sơ

Bấm **Code** hoặc **Xem chi tiết**:

- **Đầu trang:** mã (hoặc *"Chưa cấp mã"*), nhà thầu, luồng, trạng thái; badge **"Quá hạn N ngày"**, tag **"Đang chờ bổ sung"** nếu đang dừng SLA.
- **Tuyến xử lý:** bản đồ ga có mốc **"Đang ở đây"** + gợi ý đang chờ ai (vd *"Chờ VP Andy duyệt"*).
- **Nhật ký bàn giao:** toàn bộ lịch sử ai làm gì, khi nào, lý do — không sửa được.

## Khi hồ sơ bị trả lại (Returned)

Xử lý **2 bước** (đối xứng giao nhận bản cứng ngoài đời):

- **B1. Nhận lại bản cứng:** mở hồ sơ (hoặc **"Sửa & nộp lại"**), đọc **lý do bị trả**, bấm **"Xác nhận đã nhận lại bản cứng"** → chuyển **Return-fixing** *(Đang sửa)*.
- **B2. Sửa & nộp lại:** chỉnh 9 trường → **"Nộp lại"** → quay về **Submitted**, đi lại từ đầu tuyến (giữ mã cũ).

Không sửa thì hồ sơ nằm mãi ở tab **Bị trả lại** — hệ thống không tự đóng.

## Sửa ở Pool · Thu hồi · Nhân bản

Khi hồ sơ **vẫn ở Pool** (`Submitted`, chưa ai bốc):

- **Sửa hồ sơ:** còn sửa được 9 trường. Nếu DCC1 vừa bốc, báo *"Hồ sơ đã được tiếp nhận — không sửa được nữa."*
- **Thu hồi:** rút khỏi hàng chờ (cần xác nhận) → **Cancelled** *(Đã hủy)*.
- **Nhân bản** (mọi lúc): tạo hồ sơ mới đổ sẵn dữ liệu cũ, tiện khi nộp nhiều hồ sơ giống nhau (ưu tiên reset về Thường).

## Trợ lý QLHS

Trợ lý **chỉ đọc** (không sửa gì, không dùng AI ngôn ngữ lớn). Hỏi tiếng Việt, vd *"hồ sơ của tôi đang mở"*, *"chi tiết G-2026-0001"*, *"thông báo chưa đọc"*. Kết quả **giới hạn theo quyền** — Applicant chỉ tra được hồ sơ của mình.
