# DCC1

DCC1 là **trung tâm điều phối**: bốc hồ sơ từ Pool, sinh mã, trình VP/BOP, và là **đầu mối duy nhất** bấm Trả lại/Mở lại. DCC1 thấy **cả 3 luồng**. Chạy tại `de-qlhs.pmh.com.vn`; tên trạng thái giữ **tiếng Anh** gốc.

**Không đính kèm file** — bản cứng giao tay; mọi cú giao–nhận cần bên nhận **xác nhận đã cầm giấy** mới đi tiếp.

## Đăng nhập & giao diện

- Nhập **email công ty** → PMH ID (SSO). Vai DCC do Admin cấp. Phiên thoát sau **15 phút** nghỉ.
- Thanh trên: 🔔 chuông (thời gian thực) · ngôn ngữ/giao diện · **Chuyển vai** (nếu có nhiều vai) · Thoát.
- **Nhắc sáng:** công tắc tự bật/tắt email nhắc việc 7h30 (chỉ gửi khi có hồ sơ cần chú ý).

## 3 luồng

- **A — General:** DCC1 xử lý suốt tuyến; Andy duyệt (có thể kèm BOP) → hoàn tất. Không qua DCC2/3.
- **B — Contract / VO / Annex / Budget:** DCC2 ↔ Kế toán → DCC1 trình BOP → DCC2 hoàn tất bản cứng.
- **C — Payment:** DCC3 gửi Kế toán = đóng ngay.

**Andy / ACC / BOP** ở ngoài hệ thống — DCC nhập kết quả duyệt hộ.

## Màn hình làm việc

- **Bản đồ tuyến** (thu gọn được): bảng chỉ đọc, mỗi luồng là tuyến metro, mỗi trạng thái là **ga** hiện số hồ sơ + số quá hạn. Rê chuột xem nhanh, bấm mở chi tiết ga.
- **Trạm của tôi**: bảng cột, **mỗi cột là một ga** cần bạn hành động (chỉ hồ sơ đang chạy). Có ô tìm (`/`), lọc **Chỉ quá hạn**, lọc **Luồng** (Tất cả/Contract/Payment/General), **Ưu tiên**, **Bộ lọc đã lưu**.
- **Thẻ hồ sơ:** chữ luồng (A/B/C), mã, pill **"Nn"** đỏ nếu quá hạn, **"chờ bổ sung"**, **"GẤP"**, nhà thầu, số tiền, nút hành động.
- **Nút chính** (1 chạm) = bước tiến an toàn. **Menu ⋯** = thao tác lùi/cần lý do/SLA (tô đỏ, có xác nhận). Một số bước có **"Hoàn tác (5s)"**.

## Việc chính của DCC1

- **Bốc từ Pool:** ở ga **Submitted (Pool)** bấm **"Nhận"** → hệ thống **sinh mã tự động** và đẩy sang **Submitted to VP Andy** trong một cú. Loại hồ sơ sai thì trả lại luôn (trước khi sinh mã).
- **Trình VP/BOP:** nhập kết quả Andy/BOP hộ (*"Sếp duyệt → hoàn tất"*, *"… → trình BOP"*, *"BOP duyệt → …"*).
- **Nhận về từ ACC:** khi Kế toán trả bản cứng, bấm **"Nhận về từ ACC"**.
- **Trả lại Applicant (Return):** **bắt buộc nêu lý do**. DCC2/DCC3 **không tự trả lại** — họ đẩy ngược về DCC1, DCC1 mới bấm Trả lại.
- **Mở lại (Reopen):** mở lại hồ sơ đã **Completed** (hoặc **Sent to Accounting** với Payment) → về Applicant đi vòng mới; giữ mã + lịch sử, không giới hạn thời gian.
- **Đổi ưu tiên:** DCC1 đổi được mức ưu tiên ở **bất kỳ trạng thái nào** (ghi log).

## Làn đối chiếu (reconcile)

Khi DCC2/DCC3 báo thiếu giấy, hồ sơ hiện ở cột **"Chờ đối chiếu"** với gợi ý *"DCC2/DCC3 báo thiếu giấy — cần đối chiếu & bàn giao lại"*. DCC1 chọn **"Đã bổ sung, bàn giao lại →"** hoặc **"Trả lại Applicant (Return)"**.

## Xử lý hàng loạt (bulk)

Ở cột **Submitted to VP Andy**, chọn nhiều thẻ (checkbox) rồi áp một quyết định của VP cho nhiều hồ sơ cùng lúc (xác nhận *"Áp dụng cho N hồ sơ"*). Mỗi hồ sơ có kết quả độc lập.

## Khoá mềm & giành quyền

- **Khoá mềm:** khi bạn mở/xử lý hồ sơ, hệ thống giữ chỗ ~5 phút. Người khác đang giữ → thẻ hiện *"{tên} đang xử lý"* và ẩn nút.
- **Giành quyền (Seize):** bấm **"Giành quyền"** khi khoá người kia đã hết hạn. Thành công → *"Đã giành quyền xử lý hồ sơ."*

## Tạm dừng SLA — "Chờ bổ sung"

Khi chờ giấy/đối tác bên ngoài: Menu ⋯ → **"Chờ bổ sung (dừng SLA)"** (**bắt buộc lý do**). Có giấy → **"Đã có giấy — chạy lại SLA"**. Chỉ **người đang giữ** dừng/chạy lại được; dừng **không** đổi trạng thái; phần đã quá hạn trước khi dừng vẫn giữ đỏ.

## Luồng chi tiết (SLA = số ngày làm việc, bỏ T7/CN)

**A — General**

| Bước | Ai làm | → Trạng thái |
|---|---|---|
| 1 | Applicant nộp | **Submitted** (Pool) |
| 2 | DCC1 bốc + sinh mã | **Submitted to VP Andy** |
| 3a | Andy duyệt (không cần BOP) | **Completed** ✓ (email Applicant) |
| 3b | Andy duyệt (cần BOP) → DCC1 trình BOP | **Submitted to BOP** |
| 4 | BOP duyệt | **Completed** ✓ |

**B — Contract:** DCC1 bốc → Andy duyệt → chuyển DCC2 → DCC2 nhận + gửi ACC → DCC1 nhận về từ ACC → trình BOP → BOP duyệt → chuyển DCC2 (Hardcopy) → DCC2 nhập scan → **Completed**.

**C — Payment:** DCC1 bốc → Andy duyệt → chuyển DCC3 → DCC3 nhận + gửi ACC → **Sent to Accounting** (đóng ngay).

**Trả lại (2 pha):** DCC1 Trả lại (lý do) → Returned → Applicant xác nhận nhận lại → Return-fixing → sửa & nộp lại → Submitted.
