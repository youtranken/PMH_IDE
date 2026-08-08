# QLHS — Hướng dẫn Quản trị

Vai **Admin** cấu hình hệ thống: gán vai, chỉnh danh mục, đặt ngưỡng SLA, xem phân tích/nhật ký, cấu hình email. Chạy on-prem tại `de-qlhs.pmh.com.vn`.

**Admin KHÔNG xử lý hồ sơ** — không có nút hành động nào trên hồ sơ.

## Năm vai

| Vai | Việc chính |
|---|---|
| **Admin** | Toàn quyền quản trị |
| **Applicant** | Nộp & theo dõi hồ sơ (mặc định mọi người) |
| **DCC1** | Nh?n hồ sơ từ Pool, điều phối cả 3 tuyến; đầu mối Return/Reopen |
| **DCC2** | Luồng Hợp đồng (Contract) |
| **DCC3** | Luồng Thanh toán (Payment) |

**Andy / ACC / BOP** (VP ký · Kế toán · Ban Giám đốc) ở **ngoài hệ thống**, không đăng nhập; DCC nhập kết quả duyệt hộ.

## Đăng nhập

Một ô *"Email hoặc tài khoản"*:

- **Email** (vd `email@pmh.com.vn`) → PMH ID (SSO), nhập mật khẩu trên trang PMH ID.
- Phiên tự thoát sau **15 phút** nghỉ.

## Trang quản trị — 8 mục

| Mục | Dùng để |
|---|---|
| **Tổng quan** | Phiên bản + thời gian chạy (uptime) |
| **Người dùng & Vai** | Gán/gỡ vai |
| **Danh mục** | Payment Term / Project Team / Currency / Loại hồ sơ |
| **Ngưỡng SLA** | Số ngày cho từng chặng mỗi luồng |
| **Tạm dừng SLA** | Giám sát hồ sơ đang dừng đồng hồ SLA |
| **Phân tích vận hành** | Throughput, tỷ lệ trả lại, điểm nghẽn, hồ sơ trễ |
| **Nhật ký hệ thống** | Lịch sử mọi cú chuyển hồ sơ (bất biến) |
| **Cấu hình** | Tên VP hiển thị + Email SMTP |


## Người dùng & Vai

Danh sách ghép từ **Danh bạ PMH ID (SSO)** + vai đã gán → gán vai được **trước cả khi người đó lần đầu đăng nhập**.

Nhãn tài khoản: **"đã có tài khoản"** (đã đăng nhập QLHS) / **"chưa đăng nhập"**.

- Nhóm gán được: **Admin, DCC1, DCC2, DCC3** — **một người chỉ giữ một vai** (loại trừ nhau). **Applicant** là mặc định, không gán thủ công.
- **Gán vai** = chuyển vai: gỡ hết vai cũ rồi thêm đúng một vai. Chọn nhóm → tìm người → **Gán**.
- **Gỡ vai** đưa người về Applicant, có **Hoàn tác**.
- **Không tự gỡ Admin của chính mình** — nhờ Admin khác.
- Bổ nhiệm Admin có hộp cảnh báo *"Admin có toàn quyền — chỉ bổ nhiệm người thực sự cần."*

## Danh mục

**Nguyên tắc:** Tắt một giá trị chỉ **ẩn khỏi form tạo mới**, hồ sơ cũ giữ nguyên. Hệ thống **không xóa** giá trị.

- **Payment Term / Project Team / Currency** (chọn qua tab): **Thêm** (không trống, không trùng) · **Đổi tên tại chỗ** · **Bật/Tắt** (có xác nhận). Cột "Số hồ sơ đang dùng" cho biết vì sao không nên xóa.
- **Loại hồ sơ (Document Type)** — danh mục **chỉ thêm**: khi thêm phải chọn luồng **General (A) / Contract (B) / Payment (C)** — luồng này quyết định hồ sơ đi tuyến nào. Không đổi tên/xóa được.

## Ngưỡng SLA

Đặt **số ngày làm việc** (bỏ T7/CN) cho hồ sơ đứng ở mỗi chặng trước khi gắn cờ đỏ **"▲ Quá hạn"**.

- Đặt theo **từng (luồng × chặng)**: tab **Chung / General / Contract / Payment**. Ngưỡng riêng của luồng **thắng** ngưỡng chung.
- Bộ đếm − / số / + , tối thiểu **1 ngày**. Sửa nhiều chặng rồi **Lưu ngưỡng SLA** một lượt → **áp dụng ngay** lên badge toàn hệ thống (kể cả hồ sơ đang chạy).
- Trạng thái đóng (Completed / Sent to Accounting / Cancelled) **không có ngưỡng**.

## Tạm dừng SLA

Bảng giám sát các hồ sơ mà DCC đã bấm *"Chờ bổ sung"* (dừng đồng hồ khi chờ giấy/đối tác bên ngoài): dừng ở chặng nào, thống kê theo ga. Là đối trọng chống lạm dụng. Phần đã quá hạn **trước khi** dừng vẫn giữ đỏ.

## Phân tích vận hành

Mọi số liệu **tính trực tiếp từ nhật ký sự kiện** lúc mở nên luôn khớp thực tế:

- **Throughput** — tạo mới ↔ hoàn tất theo Tuần/Tháng.
- **Tỷ lệ trả lại theo luồng** (thấp = tốt).
- **Nơi hồ sơ đọng** — bảng nhiệt chặng × luồng, tìm **điểm nghẽn**.
- **Trễ nhất đang chạy** — tối đa 10 hồ sơ trễ SLA nặng nhất.
- **Xuất CSV**: chọn khoảng Từ/Đến → tải toàn bộ sự kiện (Excel, UTF-8).

## Nhật ký hệ thống (Audit)

**Lịch sử bất biến**, chỉ đọc (không ai sửa/xóa, kể cả Admin).

- **Lọc:** Mã hồ sơ · Người thực hiện · Sự kiện · Khoảng ngày → **Lọc / Xóa lọc**.
- **Bảng:** Thời điểm · Hồ sơ · Người · Sự kiện · Từ → Đến · Lý do (25 dòng/trang), có panel **"Hôm nay"**.
- Nhật ký **giữ nguyên tên trạng thái gốc tiếng Anh** (vẫn ghi `Submitted to VP Andy` dù đã đổi Tên VP) — nó là bản gốc.

## Cấu hình

**Tên VP hiển thị:** trường **Tên VP** (≤ 40 ký tự, mặc định `Andy`). Đổi là đổi *"VP …"* ở mọi nơi hiển thị, **áp dụng ngay**. Không ảnh hưởng dữ liệu hồ sơ hay nhật ký.

## Chuyển vai / ngôn ngữ / thoát

Chân thanh điều hướng (bấm tên người dùng): **Ngôn ngữ** (VI/EN) · **Giao diện** (tối/sáng) · **Thoát** · **Chuyển vai** (chỉ hiện khi tài khoản có nhiều hơn một vai).
