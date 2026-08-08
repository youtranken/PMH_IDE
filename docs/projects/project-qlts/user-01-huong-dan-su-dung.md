# Hướng dẫn sử dụng QLTS — Vai **Thành viên** (Member)

> Dành cho người **mượn máy** trong hệ thống Quản lý Tài sản (QLTS).
> Cập nhật: 2026-08-08 · Địa chỉ: `https://de-qlts.pmh.com.vn:8443`

---

## 1. QLTS là gì và bạn làm được gì

QLTS giúp bạn **tự đặt mượn máy/thiết bị** trong kho dùng chung, theo dõi lượt mượn của mình và xem tài sản đang được cấp phát cho bạn.

Với vai **Thành viên**, bạn có 2 khu vực chính:

| Khu vực | Đường dẫn | Bạn làm gì |
|---------|-----------|-----------|
| **Lịch mượn máy** (trang chủ) | `/` | Xem máy trống, đặt máy, theo dõi lượt mượn của mình, xin gia hạn |
| **Hồ sơ** | `/profile` | Xem thiết bị đang giữ, phần mềm được cấp, lịch sử |

> Các trang quản trị (tài sản, phần mềm, pool, cấu hình…) chỉ dành cho Admin. Nếu vào nhầm, bạn sẽ thấy dòng *"Bạn không có quyền truy cập trang này."*

Ngoài ra ở đáy thanh bên (sidebar) luôn có: **Hồ sơ**, đổi ngôn ngữ **VI/EN**, đổi giao diện sáng/tối, **Đăng xuất**. Góc phải màn hình có **Trợ lý QLTS** (chatbot).

---

## 2. Đăng nhập

1. Mở QLTS, bạn thấy **một ô nhập** với gợi ý *"Email công ty"*.
2. Nhập **email công ty** → bấm **Đăng nhập**. Hệ thống chuyển bạn sang đăng nhập **PMH ID (SSO)**.
3. Nếu mở QLTS từ cổng PMH (đã đăng nhập sẵn), hệ thống tự đưa bạn vào, không cần nhập lại.

**Nếu báo *"Tài khoản không có quyền truy cập QLTS. Liên hệ quản trị viên."*** → tài khoản của bạn chưa nằm trong nhóm được phép. Hãy liên hệ Admin để được cấp quyền, hoặc bấm **Đăng nhập bằng tài khoản khác**.

---

## 3. Màn hình chính — Lịch mượn máy

Trang chủ hiển thị **lịch máy đang bận trong 2 tuần** và các máy trống để đặt nhanh.

### 3.1. Lưới lịch 14 ngày
- Mỗi hàng là **một máy** (mã máy + loại). **Rê chuột** vào ô máy để xem phần mềm đã cài.
- Ô bận tô màu theo trạng thái: **Đang mượn** và **Chờ duyệt** (có chú giải màu phía dưới).
- Vì lý do riêng tư, lưới **không hiển thị tên người mượn**, chỉ hiện loại lượt.
- Trên điện thoại, lịch hiển thị dạng thẻ từng máy; máy rảnh cả tuần ghi *"Trống cả tuần"*.

### 3.2. Chọn ngày / tháng
- Ô **Chọn ngày**: chọn ngày bất kỳ → lịch nhảy tới tuần chứa ngày đó (đổi tháng ngay trong ô chọn ngày).
- Nút **Hôm nay**: quay về tuần hiện tại.
- Bộ lọc **Tất cả máy** / **Tất cả trạng thái** (Đang mượn / Chờ duyệt).

### 3.3. Rail "Máy trống — đặt nhanh" (bên phải)
Danh sách máy đang rảnh; mỗi thẻ có nút **Đặt** để mở form đặt máy với máy đã chọn sẵn.

### 3.4. Bảng "Máy đang mượn / chờ giao" (dưới cùng) — *nơi bạn theo dõi lượt của mình*
- Lọc **Tất cả** / **Của tôi** → chọn **Của tôi** để chỉ xem lượt mượn của bạn (hàng của bạn gắn nhãn **Bạn**).
- Cột: Thiết bị, Người mượn, Ngày nhận, Ngày trả, Tình trạng.
- Nhãn trạng thái: **Chờ duyệt → Chờ giao → Đang mượn → Đã đóng** (hoặc **Từ chối / Đã hủy**). Có thêm nhãn **Tới hạn hôm nay** và **Đang chờ gia hạn**.
- Hành động của bạn ở đây: nút **Xin gia hạn** (xem [mục 6](#6-xin-gia-hạn)).

---

## 4. Đặt máy

Mở form **Đặt máy mượn** bằng một trong ba cách:
- Nút **Đặt máy** ở đầu trang chủ, hoặc
- Nút **Đặt** trên một máy trống ở rail bên phải, hoặc
- Từ **Trợ lý QLTS** (tìm máy trống → bấm Đặt).

### 4.1. Chọn loại mượn
Đầu form có dải chọn loại lượt. Bạn thấy loại nào tùy quyền được cấp:

| Loại | Điều kiện | Duyệt |
|------|-----------|-------|
| **≤ 2 ngày** | Mọi thành viên | ✔ **Tự duyệt** — giữ máy ngay, chờ nhận |
| **Trên 2 ngày** | Cần quyền **Dài hạn** (Admin cấp) | ⏳ Cần **Admin duyệt** trước khi nhận |
| **Định kỳ** | Cần quyền **Định kỳ** (Admin cấp) | ⏳ Cần **Admin duyệt** cả chuỗi |

> Nếu bạn chưa được cấp quyền, tab tương ứng sẽ **không hiện**.

### 4.2. Các bước (lượt thường / dài ngày)
1. **Chọn máy**: gõ mã/loại/phần mềm để lọc, hoặc chọn từ danh sách. (Nếu đã chọn sẵn từ rail, bấm **Đổi máy** để đổi.)
2. **Ghi chú** (tùy chọn, tối đa 500 ký tự).
3. **Chọn ngày & giờ**: 4 ô — Ngày nhận, Giờ nhận, Ngày trả, Giờ trả. Có **chip gợi ý giờ** (08/09/10/13/14/15h). Dòng chính sách bên dưới cho biết lượt này **tự duyệt** hay **cần Admin duyệt**.
4. Bấm **Đặt máy**.

Sau khi đặt:
- Lượt **≤ 2 ngày**: *"Đặt thành công — máy đã được giữ, chờ nhận."*
- Lượt **> 2 ngày**: *"…chờ Admin duyệt."*

### 4.3. Các quy tắc bạn sẽ gặp
- ⛔ **Không đặt vào Chủ nhật / ngày nghỉ** — *"Không đặt vào cuối tuần."*
- ⛔ **Không chọn ngày máy đã bận** — những ngày bận bị khóa trong ô chọn ngày.
- ⛔ **Giờ trả phải sau giờ nhận** — *"Giờ trả phải sau giờ nhận."*
- ⛔ Ở tab **≤ 2 ngày**, không đặt quá 2 ngày (nút bị khóa, gợi ý dùng đặt nâng cao/định kỳ).
- ⛔ **Máy vừa bị người khác đặt** — *"Khung giờ này vừa có người đặt — đã tải lại danh sách."*
- ⛔ **Đạt hạn mức** — *"Bạn đã đạt tối đa số lượt mượn đang hoạt động."* (tối đa **2** lượt đang hoạt động).
- ⛔ **Chưa có quyền dài ngày** — *"Không thể mượn hơn 2 ngày, vui lòng liên hệ Admin để được cấp quyền."*

**Khung giờ khuyến nghị:** 07:00–18:00, Thứ Hai–Thứ Bảy.

---

## 5. Đặt định kỳ (cần quyền Định kỳ)

Trong form đặt máy, mở khối **Đặt định kỳ (theo thứ trong tháng)**:
1. Chọn **một thứ trong tuần** (Thứ Hai–Thứ Sáu) → hệ thống tự sinh tất cả các buổi của thứ đó từ nay đến cuối tháng.
2. Chỉnh **giờ nhận / giờ trả** cho từng buổi; bỏ buổi không cần bằng ✕.
3. Chọn **một máy dùng cho cả chuỗi**.
4. Xem preview *"{n} buổi · chiếm 1 lượt quota"* → bấm **Đặt chuỗi**.

Kết quả: *"Đã tạo chuỗi — chờ Admin duyệt."*

**Quy tắc chuỗi định kỳ:**
- Mỗi tuần chỉ **1 buổi**.
- Tổng chuỗi **không quá 30 ngày**.
- Cả chuỗi tính là **1 lượt** trong hạn mức.

---

## 6. Xin gia hạn

Khi máy đang ở trạng thái **Đang mượn** và **chưa quá hạn**, hàng lượt của bạn (trong bảng "Máy đang mượn / chờ giao", lọc **Của tôi**) có nút **Xin gia hạn**:
1. Bấm **Xin gia hạn** → nhập **Hạn mới**.
2. Bấm **Gửi yêu cầu** → yêu cầu chuyển tới Admin duyệt. Trong lúc chờ, lượt hiện nhãn **Đang chờ gia hạn**.

**Quy tắc gia hạn:** tối đa **3 lần**, mỗi lần thêm tối đa **2 ngày**. Lượt **định kỳ** không xin gia hạn được.

> **Hủy một lượt đã đặt:** bản hiện tại việc hủy lượt do **Admin** thực hiện. Nếu bạn cần hủy một lượt đã đặt/đang chờ, hãy liên hệ Admin.

---

## 7. Nhận & trả máy

Việc **bàn giao thực tế** (xác nhận đã giao, đã nhận trả, chụp ảnh biên bản) do **Admin thao tác** trên hệ thống. Phía bạn:
- Theo dõi trạng thái lượt của mình trên trang chủ: **Chờ giao** → tới quầy nhận máy → Admin bấm *Đã giao* → lượt thành **Đang mượn**.
- Khi trả: mang máy tới, Admin bấm *Đã nhận*, lượt **Đã đóng**.
- Chú ý nhãn **Tới hạn hôm nay** / **Quá hạn** để trả đúng hẹn.

---

## 8. Hồ sơ của tôi (`/profile`)

Mở bằng nút **Hồ sơ** ở đáy sidebar. Đầu trang có 3 thẻ: **Thiết bị đang giữ**, **Phần mềm được cấp**, **Hoạt động gần nhất**. Bốn tab:

| Tab | Nội dung |
|-----|----------|
| **Thiết bị đang giữ** | Bảng tài sản được cấp cho bạn: Mã TS, Loại, Cấu hình, Ngày nhận, Tình trạng |
| **Phần mềm** | Phần mềm được cấp, gắn với máy nào, **Vĩnh viễn** hoặc ngày hết hạn |
| **Lịch sử** | Dòng thời gian cấp phát: **Nhận** / **Bàn giao** + mã máy + ghi chú |
| **Thông tin** | Họ tên, Email, Vai trò, Mã định danh |

> Lưu ý: "Thiết bị đang giữ" là tài sản **được cấp phát sở hữu** cho bạn — khác với máy **mượn ngắn hạn** trong Lịch mượn máy.

---

## 9. Trợ lý QLTS (Chatbot)

Biểu tượng trợ lý nổi ở góc phải mọi trang. Với thành viên, có 2 nút nhanh:
- **Tìm máy trống** → chọn ngày → xem danh sách máy trống; máy trống có nút **Đặt** để đặt ngay.
- **Máy tôi đang mượn** → liệt kê lượt bạn đang mượn.

Bạn cũng có thể hỏi tự nhiên, ví dụ: *"máy nào trống ngày mai"*, *"cấu hình máy MTS-123"*. Bấm **Xoá đoạn chat** để bắt đầu lại.

---

## 10. Quyền hạn của bạn

Hai quyền mở rộng do **Admin cấp**:

| Quyền | Cho phép |
|-------|----------|
| **Dài hạn** | Đặt mượn **trên 2 ngày** |
| **Định kỳ** | Đặt **chuỗi định kỳ** theo thứ trong tuần |

Chưa có quyền → tab tương ứng không hiện; nếu cố mượn dài ngày sẽ báo *"…liên hệ Admin để được cấp quyền."* Hãy liên hệ Admin khi cần.

---

## 11. Lỗi thường gặp

| Thông báo | Nghĩa | Cách xử lý |
|-----------|-------|-----------|
| *Bạn đã đạt tối đa số lượt mượn đang hoạt động.* | Bạn đang có 2 lượt hoạt động | Trả bớt/đợi đóng một lượt rồi đặt tiếp |
| *Không thể mượn hơn 2 ngày…* | Chưa có quyền Dài hạn | Liên hệ Admin cấp quyền |
| *Bạn chưa được cấp quyền đặt định kỳ.* | Chưa có quyền Định kỳ | Liên hệ Admin cấp quyền |
| *Khung giờ này vừa có người đặt…* | Máy vừa bị đặt trước | Chọn khung giờ khác / máy khác |
| *Máy vừa bị khóa/ngừng cho mượn…* | Máy chuyển bảo trì | Chọn máy khác |
| *Không đặt vào cuối tuần.* | Chọn nhằm ngày nghỉ | Chọn ngày làm việc (T2–T7) |
| *Tài khoản không có quyền truy cập QLTS…* | Chưa thuộc nhóm được phép | Liên hệ Admin |

---

## 12. Bảng trạng thái lượt mượn

| Trạng thái | Ý nghĩa |
|-----------|---------|
| **Chờ duyệt** | Lượt > 2 ngày / định kỳ đang chờ Admin duyệt |
| **Chờ giao** | Đã duyệt/giữ máy, chờ tới nhận |
| **Đang mượn** | Đã nhận máy, đang sử dụng |
| **Tới hạn hôm nay** | Hôm nay là hạn trả |
| **Quá hạn** | Đã qua hạn trả — vui lòng trả sớm |
| **Đang chờ gia hạn** | Đã gửi yêu cầu gia hạn, chờ Admin |
| **Đã đóng** | Đã trả xong |
| **Từ chối / Đã hủy** | Admin từ chối hoặc lượt bị hủy |

---

*Cần hỗ trợ thêm? Dùng Trợ lý QLTS hoặc liên hệ Admin quản trị hệ thống.*
