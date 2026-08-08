# QLTS — Hướng dẫn Thành viên

Dùng để **tự đặt mượn máy/thiết bị** trong kho dùng chung, theo dõi lượt mượn và xem tài sản được cấp cho bạn. Địa chỉ: `https://de-qlts.pmh.com.vn:8443`.

## Đăng nhập

- Nhập **email công ty** → **Đăng nhập** → chuyển sang PMH ID (SSO).

## Màn hình chính — Lịch mượn máy (`/`)

Hiển thị lịch máy bận trong 2 tuần + máy trống để đặt nhanh.

- **L?ch 14 ngày**: mỗi hàng là một máy; rê chuột xem phần mềm đã cài. Ô bận tô màu theo **Đang mượn / Chờ duyệt** (không hiện tên người mượn).
- **Chọn ngày** nhảy tới tuần chứa ngày đó; nút **Hôm nay** về tuần hiện tại. Lọc theo máy / trạng thái.
- **"Máy trống — đặt nhanh"** (bên phải): mỗi thẻ có nút **Đặt**.
- **Bảng "Máy đang mượn / chờ giao"** (dưới): lọc **Của tôi** để xem lượt của bạn (gắn nhãn **Bạn**), có nút **Xin gia hạn**.

## Đặt máy

Mở form **Đặt máy mượn** từ nút **Đặt máy**, nút **Đặt** trên máy trống, hoặc từ Trợ lý QLTS.

Chọn loại lượt (chỉ hiện loại bạn được cấp quyền):

| Loại | Điều kiện | Duyệt |
|---|---|---|
| **≤ 2 ngày** | Mọi thành viên | **Tự duyệt** — giữ máy ngay, chờ nhận |
| **Trên 2 ngày** | Cần quyền **Dài hạn** | Cần **Admin duyệt** |
| **Định kỳ** | Cần quyền **Định kỳ** | Cần **Admin duyệt** cả chuỗi |

Các bước (lượt thường/dài ngày):

- **B1.** Chọn máy (gõ mã/loại/phần mềm để lọc; đã chọn sẵn thì bấm **Đổi máy**).
- **B2.** Ghi chú (tùy chọn, ≤ 500 ký tự).
- **B3.** Chọn Ngày nhận, Giờ nhận, Ngày trả, Giờ trả (có chip gợi ý giờ). Dòng chính sách cho biết tự duyệt hay cần Admin duyệt.
- **B4.** Bấm **Đặt máy**.

**Quy tắc thường gặp:**
- Không đặt vào Chủ nhật / ngày nghỉ; giờ trả phải sau giờ nhận.
- Ngày máy đã bận bị khóa trong ô chọn ngày.
- Tối đa **2 lượt đang hoạt động** cùng lúc.
- Chưa có quyền dài ngày → báo *"…liên hệ Admin để được cấp quyền."*
- Khung giờ khuyến nghị: 07:00–18:00, T2–T7.

## Đặt định kỳ (cần quyền Định kỳ)

Mở khối **Đặt định kỳ** trong form:

- **B1.** Chọn **một thứ trong tuần** → hệ thống sinh các buổi từ nay đến cuối tháng.
- **B2.** Chỉnh giờ từng buổi; bỏ buổi không cần bằng ✕.
- **B3.** Chọn **một máy dùng cho cả chuỗi**.
- **B4.** Xem preview *"{n} buổi · chiếm 1 lượt quota"* → **Đặt chuỗi**.

Quy tắc: mỗi tuần 1 buổi, chuỗi ≤ 30 ngày, cả chuỗi tính là **1 lượt**.

## Xin gia hạn

Khi lượt **Đang mượn** và chưa quá hạn (bảng "Của tôi"):

- **B1.** Bấm **Xin gia hạn** → nhập **Hạn mới**.
- **B2.** Bấm **Gửi yêu cầu** → chờ Admin duyệt (nhãn **Đang chờ gia hạn**).

Quy tắc: tối đa 3 lần, mỗi lần ≤ 2 ngày. Lượt định kỳ không xin gia hạn được. **Hủy lượt** do Admin thực hiện — cần thì liên hệ Admin.

## Nhận & trả máy

Bàn giao thực tế do **Admin thao tác** trên hệ thống. Phía bạn:

- **Chờ giao** → tới quầy nhận máy → Admin bấm *Đã giao* → lượt thành **Đang mượn**.
- Khi trả → Admin bấm *Đã nhận* → lượt **Đã đóng**.
- Chú ý nhãn **Tới hạn hôm nay** / **Quá hạn** để trả đúng hẹn.

## Hồ sơ của tôi (`/profile`)

Nút **Hồ sơ** ở đáy sidebar. 3 thẻ đầu trang + 4 tab:

| Tab | Nội dung |
|---|---|
| **Thiết bị đang giữ** | Tài sản được cấp cho bạn (Mã, Loại, Cấu hình, Ngày nhận, Tình trạng) |
| **Phần mềm** | Phần mềm được cấp, gắn máy nào, Vĩnh viễn/ngày hết hạn |
| **Lịch sử** | Dòng thời gian cấp phát (Nhận/Bàn giao + mã máy + ghi chú) |
| **Thông tin** | Họ tên, Email, Vai trò, Mã định danh |

Lưu ý: "Thiết bị đang giữ" là tài sản **cấp phát sở hữu**, khác với máy **mượn ngắn hạn**.

## Trợ lý QLTS

Biểu tượng nổi ở góc phải. Nút nhanh: **Tìm máy trống** (chọn ngày → đặt ngay), **Máy tôi đang mượn**. Hỏi tự nhiên được, vd *"máy nào trống ngày mai"*.
