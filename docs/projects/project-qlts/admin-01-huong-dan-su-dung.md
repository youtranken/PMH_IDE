# Hướng dẫn sử dụng QLTS — Vai **Quản trị** (Admin / SA)

> Dành cho **Admin** vận hành và **SA** (Super Admin — tài khoản break-glass) của hệ thống Quản lý Tài sản (QLTS).
> Cập nhật: 2026-08-08 · Địa chỉ: `https://de-qlts.pmh.com.vn:8443`

---

## 1. Giới thiệu — Admin và SA

- **Admin**: lo vận hành hằng ngày — duyệt mượn, quản lý tài sản/phần mềm, cấu hình, nhật ký, cấp quyền mượn cho thành viên.
- **SA (Super Admin)**: tài khoản **local break-glass** (đăng nhập bằng mật khẩu, không qua SSO). Ngoài mọi quyền của Admin, SA còn **bổ nhiệm/miễn nhiệm Admin**.

> **Bảo mật:** ẩn menu chỉ là lớp giao diện — máy chủ luôn kiểm tra quyền độc lập (trả lỗi 403 nếu không đủ quyền). Mọi thao tác ghi/sửa đều kèm chống xung đột phiên bản (nếu dữ liệu vừa bị người khác đổi, hệ thống báo *"Trạng thái đã thay đổi — tải lại rồi thử lại"*).

---

## 2. Đăng nhập

- **Admin**: nhập **email công ty** → đăng nhập qua **PMH ID (SSO)**.
- **SA**: nhập **tên đăng nhập** (không phải email) → nhập **mật khẩu** local. Phiên SA tự đăng xuất sau **2 giờ** không hoạt động.

---

## 3. Tổng quan điều hướng

Sidebar chia theo domain:

| Nhóm | Mục | Đường dẫn |
|------|-----|-----------|
| **Mượn tài sản** | Lịch mượn máy · Xử lý mượn | `/` · `/approvals` |
| **Quản lý tài sản** | Tài sản · Phần mềm · Pool · Cảnh báo EOL · Kho thanh lý (Thiết bị/Phần mềm) | `/assets` · `/software` · `/pool` · `/eol` · `/assets/disposed`, `/software/disposed` |
| **Hệ thống** | Quản trị · Danh mục · Nhật ký · Cấu hình · Cấu hình thông báo · Thông báo lỗi | `/admin` · `/admin/catalog` · `/admin/audit` · `/admin/config` · `/admin/mail` · `/notifications` |

Ngoài ra: **Cảnh báo nghỉ việc** (`/offboarding`), **Import** (`/assets/import`), **Command palette ⌘K**, **Trợ lý QLTS**.

---

## 4. Xử lý mượn (`/approvals`)

Trung tâm duyệt và bàn giao. Đầu trang có 5 thẻ KPI: **Chờ duyệt · Chờ giao · Chờ nhận · Gia hạn · Quá hạn** (thẻ Quá hạn chuyển đỏ khi > 0).

### 4.1. Hàng đợi chờ duyệt (mượn > 2 ngày / định kỳ)
- Cột: **Người mượn · Máy · Khung giờ**. Lượt định kỳ có nhãn *"Chuỗi {n} buổi"*.
- **Duyệt** → xác nhận *"Duyệt cho {tên} mượn máy {mã}?"*.
- **Từ chối** → nhập **Lý do từ chối (bắt buộc)** → **Xác nhận từ chối** (lý do gửi cho người mượn qua email).
- Lượt định kỳ: duyệt/từ chối áp cho **cả chuỗi**.

### 4.2. Chờ gia hạn
- Cột: Người mượn · Máy · **Hạn cũ → mới** · **Đã dùng** (số lần đã gia hạn).
- **Duyệt** / **Từ chối** (kèm lý do).
- Quy tắc: tối đa **3 lần**, mỗi lần ≤ **2 ngày**. (Admin cũng có thể **gia hạn thẳng** cho người mượn — không giới hạn số lần.)

### 4.3. Chờ giao & Đang mượn — chờ nhận (bàn giao)
- **Chờ giao** → bấm **Đã giao**: ghi chú tình trạng (tùy chọn) + **tải ảnh biên bản**. Có thể **Hủy cưỡng chế** ở bước này.
- **Đang mượn — chờ nhận** → bấm **Đã nhận**: **bắt buộc ghi chú** tình trạng khi nhận trả.
- Nhãn **Quá hạn {giờ}h{phút}p** (đỏ) và **Tới hạn hôm nay** giúp ưu tiên xử lý.

**Hủy cưỡng chế** (nút **Hủy** đỏ ở hàng chờ giao): nhập **Lý do hủy (gửi cho người mượn)** → **Xác nhận hủy**. Lý do là **bắt buộc** và gửi nguyên văn qua email.

### 4.4. Giao/nhận buổi định kỳ
Từng buổi của chuỗi: **Giao buổi** / **Nhận buổi** (nhận bắt buộc ghi chú + ảnh). Buổi chưa giao có thể **Hủy buổi** (nhả khung giờ cho người khác).

---

## 5. Quản lý tài sản (`/assets`)

### 5.1. Thêm / Sửa / Xóa / Xuất / Nhập
- **Thêm tài sản** → mở form tài sản.
- **Export** → tải `tai-san.xlsx` theo bộ lọc đang áp; chọn nhiều dòng → **Xuất đã chọn**.
- **Import** → xem [mục 14](#14-import-assetsimport).
- **Xóa** (trong menu ⋯): chỉ xóa được máy **chưa từng mượn/cấp phát**. Máy đã dùng → hệ thống chặn, hãy dùng **Thanh lý**.

### 5.2. Cột & bộ lọc
- Cột: Asset Type · Code · User · Employee ID · Department · Configuration · Cost · Place · Start Date · Status · Action. Dòng có phần mềm cài → caret **▸** để bung danh sách phần mềm.
- Lọc: tìm theo mã/tên người dùng, **Loại**, **Trạng thái** (Đang dùng / Khóa sửa chữa), khoảng **Hết hạn**, chip **Sắp hết hạn**.

### 5.3. Chuyển chủ (nút **⇄ Chuyển**)
- Máy → **Chuyển máy sang người khác**: chọn người nhận, ghi chú bàn giao. Cảnh báo *"{n} phần mềm trên máy sẽ theo người giữ mới"*.
- Phần mềm → chuyển bản quyền sang máy khác.

### 5.4. Thao tác vòng đời (menu ⋯) — chỉ áp cho **máy**
| Thao tác | Điều kiện | Ghi chú |
|----------|-----------|---------|
| **Khóa máy (sửa chữa)** | Máy **đang trong pool** | Nhập **Lý do** + **Dự kiến xong (ETA)** (ETA phải **sau hôm nay**). Máy **tự mở khóa** khi tới ngày (hệ thống quét mỗi 60 giây) |
| **Mở khóa** | Máy đang khóa sửa chữa | Trả máy về sẵn sàng |
| **Đưa vào pool / Gỡ khỏi pool** | Máy đang dùng | Đưa/rút máy khỏi danh sách cho mượn |

**Cascade (hủy dây chuyền):** khi **Khóa** hoặc **Gỡ pool** một máy đang có lượt mượn/đặt trước, hệ thống hiện hộp thoại liệt kê *"{n} buổi tương lai sẽ bị hủy"* và *"{n} máy đang mượn sẽ bị thu hồi"*, kèm ô **Báo cho người mượn** → **Xác nhận hủy**.

### 5.5. Chi tiết tài sản (`/assets/:id`)
- Thông tin tài sản + thanh **Bảo hành/hạn dùng** (badge *Còn {n} ngày* / *Đã hết hạn*).
- Phần mềm đang cài trên máy.
- Tab: **Lịch sử cấp phát** · **Mượn-trả** (có *"Xem ảnh"* biên bản → phóng to) · **Note tình trạng** (Khóa/Mở khóa/Thanh lý/Giao-nhận).

---

## 6. Phần mềm & License (`/software`)

Gom nhóm theo **tên license**. Mỗi nhóm hiển thị: loại (Thuê bao / Vĩnh viễn), **Seats** (tổng ghế), **Assigned** (đã gán x/total), **Holders** (số máy / số người), cảnh báo hạn (đỏ khi ≤ 30 ngày).

- **Thêm phần mềm** / **Thêm bản** (mua thêm ghế cho license sẵn có) / **Export** / **Import**.
- **Gán máy**: gắn một bản (seat) vào máy. Hết ghế trống → nút bị khóa.
- Click nhóm để bung danh sách từng bản: **⇄ Chuyển** (đổi máy), **Sửa**, **Gỡ** (rời khỏi máy, nhả ghế), **Thanh lý**.
- Mỗi máy chỉ được gắn **một bản của cùng một license** (hệ thống chặn trùng).

Trang **`/software/license/:name`** liệt kê chi tiết từng bản của một license; hỗ trợ **thanh lý hàng loạt** các bản đã chọn.

---

## 7. Pool máy cho mượn (`/pool`)

- 3 thẻ: **Tổng trong pool · Sẵn sàng · Đang mượn**.
- **Thêm vào pool**: nhập **mã máy (MTS)** (gợi ý chỉ máy đang dùng, chưa ở trong pool) → máy vào danh sách cho member mượn.
- **Gỡ** khỏi pool → xác nhận *"Booking tương lai sẽ bị hủy và báo người mượn."* (cascade + gửi mail).

---

## 8. Cảnh báo EOL (`/eol`)

Hai khối:
1. **Máy sắp/đã hết vòng đời** (mặc định **8 năm**): cột Code, Loại, Start Date, **Đã dùng (năm)**, **Ngày hết hạn**, tình trạng, **Đã báo EOL**, User. Lọc theo số năm đã dùng / khoảng ngày bắt đầu. **Thanh lý đã chọn** (cascade hủy lượt đang mượn + báo mail) · **Xuất Excel**.
2. **License thuê bao sắp hết hạn** (mặc định **≤ 30 ngày**): License Name, Trên máy, End Date, tình trạng, User. **Thanh lý đã chọn** · **Xuất Excel**.

---

## 9. Kho thanh lý & Tái sử dụng (`/assets/disposed`, `/software/disposed`)

Hồ sơ đã chốt, chỉ đọc. Mỗi dòng:
- **Tái sử dụng**: đưa máy về hoạt động — **giữ mã** hoặc **đổi mã MTS**.
- **Xóa vĩnh viễn**: *"Không thể khôi phục (lịch sử + audit vẫn giữ)."* Hỗ trợ **xóa vĩnh viễn hàng loạt**.

---

## 10. Danh mục (`/admin/catalog`)

Năm loại danh mục: **Asset Type · Brand · Configuration · Place · Tên license**. Mỗi giá trị hiển thị số lượng đang dùng (*"{n} máy · {n} phần mềm"*).
- **Thêm** giá trị mới (trùng → báo *"Giá trị đã tồn tại (kể cả khác hoa/thường)"*).
- **Sửa** (inline) · **Disable/Enable** (ẩn/hiện giá trị khỏi form thêm tài sản, không xóa dữ liệu cũ).

---

## 11. Quản trị người dùng (`/admin`)

### 11.1. Đồng bộ danh bạ PMH ID
Nút **Đồng bộ ngay** → kéo danh sách user & nhóm từ PMH ID. Kết quả: *"{tổng} user, {mới} mới, {cập nhật} cập nhật"*.

> **Lưu ý về xóa user:** đồng bộ hiện là **upsert** — chỉ đánh dấu user *đã xóa* nếu PMH ID trả về user đó kèm trạng thái `deleted`. Đường **real-time** chính là **webhook `user.deleted`** (đá phiên tức thì + đánh dấu deleted). User bị đánh dấu deleted/locked sẽ **tự biến mất** khỏi màn Vai trò.

### 11.2. Vai trò & Quyền mượn
Bảng người dùng: Họ tên · Mã NV · Email · Phòng ban · Vai trò · **Dài hạn** · **Định kỳ** · hành động.
- **Cấp quyền mượn** (Admin & SA): tick **Dài hạn** (mượn > 2 ngày) / **Định kỳ** (đặt chuỗi) cho thành viên.
- **Bổ nhiệm / Miễn nhiệm Admin** — **chỉ SA**:
  - **Cấp quyền admin** → *"{tên} sẽ có toàn quyền quản trị hệ thống."*
  - **Thu quyền admin** → *"Gỡ toàn bộ quyền quản trị của {tên}?"*
  - Không thao tác được trên chính mình.

---

## 12. Nhật ký kiểm toán (`/admin/audit`)

Chỉ đọc. Lọc theo **Người thao tác · Hành động · Loại đối tượng · ID đối tượng · Từ ngày · Đến ngày**. Bảng: Thời gian · Người (tên; hoặc *Hệ thống* / *SA (nội bộ)*) · Hành động · Đối tượng · Chi tiết (cặp khóa:giá trị). Phân trang phía máy chủ.

---

## 13. Cấu hình hệ thống (`/admin/config`)

### 13.1. Tham số mượn & cảnh báo
| Tham số | Mặc định | Ý nghĩa |
|---------|:--------:|---------|
| Cửa sổ đặt trước (ngày) | 30 | Được đặt trước tối đa bao nhiêu ngày |
| Hạn mức yêu cầu đang hoạt động | 2 | Số lượt mượn đồng thời của một người |
| Số ngày/lần gia hạn | 2 | Mỗi lần gia hạn tối đa |
| Số lần gia hạn tối đa | 3 | Trần số lần gia hạn |
| Mốc cảnh báo license (ngày) | 30 | License còn ≤ N ngày thì cảnh báo |
| Thời hạn sử dụng máy (năm) | 8 | Máy đủ tuổi → cảnh báo EOL |
| Nhắc duyệt sau (giờ làm việc) | 4 | Yêu cầu treo bao lâu thì nhắc |
| Ngưỡng tự duyệt (giờ) | 48 | Lượt ≤ 48h tự duyệt; > 48h cần Admin |

### 13.2. Giờ làm việc
**Bắt đầu / Kết thúc** + chọn ngày trong tuần. Cấu hình hiện tại: **07:00–18:00, Thứ Hai–Thứ Bảy** (Chủ nhật nghỉ).

### 13.3. Email (SMTP)
Cuối trang: host, port, SSL (465), tài khoản Gmail, địa chỉ **From**, **App Password** (chỉ-ghi, để trống = giữ cũ). Có nút **Gửi mail thử** để kiểm tra.

> Thay đổi cấu hình **áp dụng ngay** (*"Đã lưu — áp dụng ngay"*). Các con số trên là mặc định; SA/Admin chỉnh được runtime.

---

## 14. Cấu hình thông báo email (`/admin/mail`)

Các công tắc bật/tắt email (mặc định **bật**), gom nhóm:
- **Duyệt & mượn**: yêu cầu cần duyệt · nhắc duyệt · từ chối mượn.
- **Nhắc & quá hạn**: nhắc tới hạn trả · nhắc quá hạn · nhắc xác nhận giao máy.
- **Hủy lượt**: hủy do máy (khóa/thanh lý) · hủy cưỡng chế.
- **Gia hạn**: xin gia hạn → báo Admin · từ chối gia hạn.
- **Tổng hợp (digest)**: license sắp hết hạn · máy quá hạn EOL.
- **Giờ gửi digest** (mặc định **00:00** giờ VN) — chỉ áp cho 2 email tổng hợp.

---

## 15. Thông báo gửi lỗi (`/notifications`)

Danh sách email cạn số lần thử lại: Loại thông báo · Số lần lỗi · Lỗi gần nhất · Thời điểm. Nút **Gửi lại** đẩy email về hàng đợi để gửi lại.

---

## 16. Cảnh báo nghỉ việc (`/offboarding`)

Chỉ đọc, 2 bảng:
- **Người đã rời công ty còn giữ tài sản**: trạng thái **Đã xóa / Đã khóa**, số yêu cầu đang mở, số thiết bị đang giữ.
- **Tài khoản chờ khớp người dùng**: mã tài sản + tên người dùng từ import chưa khớp SSO.

---

## 17. Import sổ Excel (`/assets/import`)

1. Chọn file `.xlsx` → **Xem trước**: hiển thị *"Tổng {n} dòng — {hợp lệ} hợp lệ, {lỗi} lỗi"* (dòng lỗi tô đỏ + lý do).
2. **Nạp dữ liệu** (khóa khi còn dòng lỗi) → *"Đã nạp {n} dòng — {m} dòng cần khớp người dùng."*
3. **Khớp lại người dùng** để gắn tài sản với tài khoản SSO tương ứng.

> Đầu trang **/assets** và **/software** cũng có nút **Import** nhanh 1 chạm (chọn file → nạp ngay, lỗi liệt kê theo dòng).

---

## 18. Bảng tham số mặc định (tra nhanh)

| Quy tắc | Giá trị mặc định |
|---------|:----------------:|
| Ngưỡng tự duyệt mượn | ≤ 48h (2 ngày) |
| Giờ làm việc | 07:00–18:00, T2–T7 |
| Hạn mức lượt đồng thời | 2 |
| Gia hạn | tối đa 3 lần × 2 ngày |
| Định kỳ | 1 buổi/tuần, chuỗi ≤ 30 ngày |
| Tuổi thọ máy (EOL) | 8 năm |
| Cảnh báo license | ≤ 30 ngày |
| Tự mở khóa máy sửa chữa | quét mỗi 60 giây |
| Giờ gửi digest | 00:00 (giờ VN) |
| Phiên SA local nghỉ | tự thoát sau 2 giờ |

---

## 19. Riêng SA làm được gì (khác Admin)

- **Bổ nhiệm / Miễn nhiệm Admin** (mục 11.2).
- Là **tài khoản break-glass**: dùng khi SSO/PMH ID sự cố. Không dùng cho vận hành hằng ngày.

---

*Mọi thao tác quan trọng đều được ghi vào Nhật ký kiểm toán (`/admin/audit`). Khi gặp lỗi phiên bản, tải lại trang rồi thao tác lại.*
