# QLTS — Hướng dẫn Quản trị (Admin/SA)

Dùng để quản lý tài sản/phần mềm và duyệt việc mượn-trả thiết bị dùng chung. Địa chỉ: `https://de-qlts.pmh.com.vn:8443`.

## Vai trò

| Vai | Làm gì |
|---|---|
| **Admin** | Vận hành hằng ngày: duyệt mượn, quản lý tài sản/phần mềm, cấu hình, nhật ký, cấp quyền mượn |

- **Admin** đăng nhập bằng **email công ty** qua PMH ID (SSO).
- Máy chủ luôn kiểm quyền độc lập (403 nếu thiếu quyền). Nếu dữ liệu vừa bị người khác đổi sẽ báo *"Trạng thái đã thay đổi — tải lại rồi thử lại"*.

## Xử lý mượn (`/approvals`)

Trung tâm duyệt và bàn giao. Đầu trang 5 KPI: **Chờ duyệt · Chờ giao · Chờ nhận · Gia hạn · Quá hạn** (đỏ khi > 0).

- **Duyệt/Từ chối mượn** (lượt > 2 ngày hoặc định kỳ): bấm **Duyệt**, hoặc **Từ chối** kèm **lý do bắt buộc** (gửi email cho người mượn). Lượt định kỳ áp cho **cả chuỗi**.
- **Gia hạn**: **Duyệt/Từ chối** (kèm lý do). Trần: tối đa 3 lần, mỗi lần ≤ 2 ngày. Admin có thể **gia hạn thẳng** không giới hạn số lần.
- **Bàn giao**:
  - **Chờ giao** → bấm **Đã giao** (ghi chú + tải ảnh biên bản tùy chọn).
  - **Chờ nhận** → bấm **Đã nhận** (**bắt buộc ghi chú** tình trạng).
- **Hủy cưỡng chế** (nút **Hủy** đỏ ở hàng chờ giao): nhập **lý do bắt buộc** (gửi email) → **Xác nhận hủy**.
- **Buổi định kỳ**: **Giao buổi / Nhận buổi** từng buổi; buổi chưa giao có thể **Hủy buổi**.

## Quản lý tài sản (`/assets`)

- **Thêm / Sửa / Export / Import**. **Xóa** (menu ⋯) chỉ được với máy chưa từng mượn/cấp phát; máy đã dùng phải **Thanh lý**.
- **⇄ Chuyển**: chuyển máy sang người khác (phần mềm trên máy theo người giữ mới), hoặc chuyển bản quyền phần mềm sang máy khác.
- **Vòng đời máy** (menu ⋯):

| Thao tác | Điều kiện | Ghi chú |
|---|---|---|
| **Khóa máy (sửa chữa)** | Máy trong pool | Nhập lý do + ETA (sau hôm nay). Tự mở khóa khi tới ngày (quét mỗi 60s) |
| **Mở khóa** | Máy đang khóa | Trả về sẵn sàng |
| **Đưa vào / Gỡ khỏi pool** | Máy đang dùng | Đưa/rút khỏi danh sách cho mượn |

- **Cascade**: khi Khóa/Gỡ pool máy đang có lượt mượn, hệ thống liệt kê số buổi bị hủy + số máy bị thu hồi, kèm ô **Báo cho người mượn**.
- **Chi tiết máy** (`/assets/:id`): thông tin + bảo hành, phần mềm đang cài, các tab Lịch sử cấp phát / Mượn-trả (xem ảnh biên bản) / Note tình trạng.

## Phần mềm & License (`/software`)

Gom theo tên license: loại, Seats, Assigned, Holders, cảnh báo hạn (đỏ khi ≤ 30 ngày).

- **Thêm phần mềm / Thêm bản** (mua thêm ghế) / Export / Import.
- **Gán máy** (hết ghế thì khóa nút). Bung nhóm để **⇄ Chuyển / Sửa / Gỡ / Thanh lý** từng bản.
- Mỗi máy chỉ gắn **một bản của cùng license**. Trang `/software/license/:name` hỗ trợ **thanh lý hàng loạt**.

## Pool, EOL, Kho thanh lý

- **Pool** (`/pool`): 3 thẻ Tổng/Sẵn sàng/Đang mượn. **Thêm vào pool** bằng mã máy (MTS). **Gỡ** → cascade hủy booking + báo mail.
- **Cảnh báo EOL** (`/eol`): **Máy hết vòng đời** (mặc định 8 năm) và **License thuê bao sắp hết** (≤ 30 ngày). **Thanh lý đã chọn** (cascade + mail) · **Xuất Excel**.
- **Kho thanh lý** (`/assets/disposed`, `/software/disposed`): hồ sơ đã chốt, chỉ đọc. **Tái sử dụng** (giữ hoặc đổi mã MTS) · **Xóa vĩnh viễn** (không khôi phục; hỗ trợ hàng loạt).

## Người dùng & Danh mục

- **Danh mục** (`/admin/catalog`): 5 loại (Asset Type · Brand · Configuration · Place · Tên license). **Thêm / Sửa inline / Disable-Enable**. Disable chỉ ẩn khỏi form, không xóa dữ liệu cũ.
- **Quản trị người dùng** (`/admin`):
  - **Đồng bộ ngay**: kéo user & nhóm từ PMH ID (upsert). User bị đánh dấu deleted/locked tự biến mất khỏi màn Vai trò.
  - **Cấp quyền mượn** (Admin & SA): tick **Dài hạn** (> 2 ngày) / **Định kỳ** cho thành viên.
  - **Bổ nhiệm/Miễn nhiệm Admin** — **chỉ SA**, không thao tác được trên chính mình.

## Nhật ký, cấu hình, thông báo

- **Nhật ký kiểm toán** (`/admin/audit`): chỉ đọc, lọc theo người/hành động/đối tượng/ngày. Mọi thao tác quan trọng đều được ghi.
- **Cấu hình hệ thống** (`/admin/config`): tham số mượn, giờ làm việc, SMTP. Lưu là **áp dụng ngay**. Có **Gửi mail thử**.
- **Cấu hình thông báo email** (`/admin/mail`): bật/tắt từng loại email (mặc định bật) + giờ gửi digest (00:00 giờ VN).
- **Thông báo gửi lỗi** (`/notifications`): danh sách email lỗi, nút **Gửi lại**.
- **Cảnh báo nghỉ việc** (`/offboarding`): người đã rời còn giữ tài sản + tài khoản chờ khớp SSO.

## Import Excel (`/assets/import`)

- **B1.** Chọn file `.xlsx` → **Xem trước** (báo tổng/hợp lệ/lỗi, dòng lỗi tô đỏ).
- **B2.** **Nạp dữ liệu** (khóa khi còn dòng lỗi).
- **B3.** **Khớp lại người dùng** để gắn tài sản với tài khoản SSO.

Đầu trang `/assets` và `/software` cũng có nút **Import** nhanh 1 chạm.

## Tham số mặc định (tra nhanh)

| Quy tắc | Giá trị |
|---|---|
| Ngưỡng tự duyệt mượn | ≤ 48h (2 ngày) |
| Giờ làm việc | 07:00–18:00, T2–T7 |
| Hạn mức lượt đồng thời | 2 |
| Gia hạn | tối đa 3 lần × 2 ngày |
| Định kỳ | 1 buổi/tuần, chuỗi ≤ 30 ngày |
| Tuổi thọ máy (EOL) | 8 năm |
| Cảnh báo license | ≤ 30 ngày |
| Tự mở khóa máy sửa chữa | quét mỗi 60s |
| Giờ gửi digest | 00:00 (giờ VN) |
| Phiên SA nghỉ | tự thoát sau 2 giờ |
