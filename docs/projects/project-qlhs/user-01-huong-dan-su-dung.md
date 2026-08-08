# QLHS — Hướng dẫn sử dụng cho **Người dùng** (Applicant · DCC1 · DCC2 · DCC3)

> Tài liệu dành cho người **nộp hồ sơ (Applicant)** và **điều phối viên hồ sơ (DCC1 / DCC2 / DCC3)**.
> Tên trạng thái hồ sơ giữ **tiếng Anh** (bản gốc hệ thống); tiếng Việt trong ngoặc chỉ để đọc cho dễ.
> Phiên bản: 2026-08. Ứng dụng nội bộ, chạy on-prem tại `de-qlhs.pmh.com.vn`.

---

## Mục lục

**Chung**
1. [QLHS là gì](#1-qlhs-là-gì)
2. [Các vai & 3 luồng hồ sơ](#2-các-vai--3-luồng-hồ-sơ)
3. [Đăng nhập](#3-đăng-nhập)
4. [Giao diện chung: thanh trên cùng, thông báo, trợ lý](#4-giao-diện-chung)

**Dành cho Applicant**
5. [Tạo hồ sơ mới](#5-tạo-hồ-sơ-mới-applicant)
6. [Theo dõi hồ sơ của tôi](#6-theo-dõi-hồ-sơ-của-tôi)
7. [Xem chi tiết một hồ sơ](#7-xem-chi-tiết-một-hồ-sơ)
8. [Khi hồ sơ bị trả lại](#8-khi-hồ-sơ-bị-trả-lại)
9. [Sửa khi còn ở Pool · Thu hồi · Nhân bản](#9-sửa-khi-còn-ở-pool--thu-hồi--nhân-bản)

**Dành cho DCC (1/2/3)**
10. [Màn hình làm việc của DCC](#10-màn-hình-làm-việc-của-dcc)
11. [Bản đồ tuyến](#11-bản-đồ-tuyến)
12. [Trạm của tôi — bảng xử lý](#12-trạm-của-tôi--bảng-xử-lý)
13. [Bốc/nhận hồ sơ, khoá mềm & giành quyền](#13-bốcnhận-hồ-sơ-khoá-mềm--giành-quyền)
14. [Tạm dừng SLA — "Chờ bổ sung"](#14-tạm-dừng-sla--chờ-bổ-sung)
15. [Riêng DCC1](#15-riêng-dcc1)
16. [Riêng DCC2 — luồng Hợp đồng](#16-riêng-dcc2--luồng-hợp-đồng)
17. [Riêng DCC3 — luồng Thanh toán](#17-riêng-dcc3--luồng-thanh-toán)

**Tham khảo**
18. [Chi tiết 3 luồng từng bước](#18-chi-tiết-3-luồng-từng-bước)
19. [SLA & mức ưu tiên](#19-sla--mức-ưu-tiên)
20. [Trợ lý QLHS](#20-trợ-lý-qlhs)

---

## 1. QLHS là gì

QLHS theo dõi mỗi **hồ sơ nội bộ** (hợp đồng, thanh toán, ngân sách…) như một **"chuyến tàu"** chạy qua nhiều ga: Applicant → DCC1 → DCC2/DCC3 → Andy/Kế toán/Ban Giám đốc. Mục tiêu số một là **minh bạch**: ai cũng biết hồ sơ đang ở đâu, chờ ai, bao lâu — không phải đi hỏi.

Vì thế giao diện dùng ẩn dụ **bản đồ tuyến tàu điện (metro)**: mỗi luồng là một tuyến, mỗi trạng thái là một **ga**, hồ sơ là con tàu chạy trên tuyến.

> **Không đính kèm file trong hệ thống.** Bản cứng đi tay ngoài đời; hệ thống chỉ ghi *đường dẫn file scan* ở bước cuối luồng Hợp đồng. Mọi cú giao–nhận bản cứng đều cần bên nhận **xác nhận đã cầm giấy** mới đi tiếp.

---

## 2. Các vai & 3 luồng hồ sơ

| Vai | Việc chính | Thấy gì |
|---|---|---|
| **Applicant** | Nộp & theo dõi hồ sơ, sửa khi bị trả lại | Chỉ **hồ sơ của mình** |
| **DCC1** | Bốc hồ sơ từ Pool, sinh mã, trình VP, điều phối; **đầu mối duy nhất** bấm Trả lại/Mở lại | **Cả 3 luồng** |
| **DCC2** | Xử lý luồng **Hợp đồng (Contract)** | Luồng Contract |
| **DCC3** | Xử lý luồng **Thanh toán (Payment)** | Luồng Payment |

**Andy** (VP ký) · **ACC** (Kế toán) · **BOP** (Ban Giám đốc) **ở ngoài hệ thống** — DCC nhập kết quả duyệt hộ.

**Ba luồng:**
- **Luồng A — General:** DCC1 xử lý suốt tuyến; Andy duyệt (có thể kèm BOP) → hoàn tất. Không qua DCC2/3.
- **Luồng B — Contract / VO / Annex / Budget:** DCC2 ↔ Kế toán → DCC1 trình BOP → DCC2 hoàn tất bản cứng → hoàn tất.
- **Luồng C — Payment:** DCC3 gửi Kế toán = đóng ngay (không qua BOP, không gửi email cho Applicant).

Luồng của một hồ sơ do **Loại hồ sơ (Document Type)** quyết định (Admin cấu hình).

---

## 3. Đăng nhập

QLHS có **một ô đăng nhập**, nhãn *"Email hoặc tài khoản"*:

- **Nhập email công ty** (vd `ban@pmh.com.vn`) → chuyển sang **PMH ID (SSO)**; bạn nhập mật khẩu **trên trang PMH ID**, không nhập trên QLHS.
- Nếu bạn mở QLHS **từ cổng PMH ID** ("Mở dự án"), hệ thống **tự đăng nhập** — không cần gõ lại email.

**Vai của bạn do Admin cấp.** Mọi người đăng nhập đều mặc định là **Applicant**. Nếu bạn là DCC, Admin sẽ gán thêm vai DCC1/DCC2/DCC3.

> Nếu bạn thấy thông báo *"Tài khoản của bạn chưa được gán vai. Vui lòng liên hệ Admin để được cấp quyền."* → bạn đã đăng nhập được nhưng chưa được cấp vai DCC; liên hệ Admin.

Phiên **tự đăng xuất sau 15 phút** không hoạt động.

---

## 4. Giao diện chung

Thanh trên cùng (mọi vai không phải Admin) có:

- **Nút thương hiệu / về trang chủ.**
- 🔔 **Chuông thông báo** — số chưa đọc hiện trên chuông (tối đa "9+"). Bấm mở danh sách; bấm một dòng để mở hồ sơ và đánh dấu đã đọc; có nút **"Đánh dấu đã đọc"** (tất cả). Cập nhật **thời gian thực** (không cần F5).
  - Các loại thông báo: hồ sơ hoàn tất · bị trả lại · vào Pool · được bàn giao cho DCC2/DCC3 · sắp/đã trễ SLA…
- 🌐 **Đổi ngôn ngữ** (Tiếng Việt / English) · 🌗 **Đổi giao diện** (tối/sáng).
- **Chuyển vai** (chỉ hiện nếu tài khoản có nhiều vai).
- **Thoát** (đăng xuất).

**Trợ lý QLHS** (biểu tượng nổi ở góc) có mặt cho mọi vai — hỏi nhanh về hồ sơ, xem [mục 20](#20-trợ-lý-qlhs).

**Nhắc sáng** (dành cho DCC): công tắc *"Nhắc sáng"* cho bạn tự bật/tắt email nhắc việc lúc 7h30 (chỉ gửi khi có hồ sơ cần chú ý).

---

# DÀNH CHO APPLICANT

## 5. Tạo hồ sơ mới (Applicant)

Trang chủ của Applicant là danh sách **"Theo dõi hồ sơ"** với nút **"Tạo hồ sơ mới"**. Bấm để mở form.

**9 trường** (những trường có dấu `*` là bắt buộc):

| # | Trường | Ghi chú |
|---|---|---|
| 1 | **Subject** (chủ đề) | Bắt buộc |
| 2 | **Document Type** (loại hồ sơ) | Chọn từ danh mục, nhóm theo luồng. **Quyết định luồng xử lý.** |
| 3 | **Contractor/Designer/Supplier** | Bắt buộc. Nếu không có, ghi `N/A` |
| 4 | **Contract No.** | Bắt buộc. Nếu không có, ghi `N/A` |
| 5 | **Project/Team** | Chọn từ danh mục |
| 6 | **Amount** | Số tiền; nếu không có ghi `0` |
| 7 | **Currency** | VND/USD/EURO/N/A |
| 8 | **Payment Term** | Chọn từ danh mục |
| 9 | **Budget code & Plan code** | Bắt buộc. Nếu không có, ghi `N/A` |

**Mức ưu tiên:** hai lựa chọn **Thường** (mặc định) hoặc **Gấp**.

> **Không có đính kèm file** — hồ sơ QLHS chỉ mang thông tin; bản cứng bạn giao tay như quy trình giấy.

Kiểm tra đủ trường rồi bấm **Nộp hồ sơ**. Thành công → *"Đã tạo & nộp hồ sơ."* Hồ sơ vào **Pool** chờ DCC1 tiếp nhận. Nếu thiếu trường bắt buộc dạng chọn, hệ thống báo *"Vui lòng chọn: …"*.

---

## 6. Theo dõi hồ sơ của tôi

Trang **"Theo dõi hồ sơ"** hiển thị mọi hồ sơ **của bạn**.

**Ba thẻ tổng quan (KPI):** **Đang chạy** · **Bị trả lại** (đỏ khi > 0, *cần bạn sửa & nộp lại*) · **Đã đóng**.

**Bộ lọc:** Tất cả · Đang chạy · Bị trả lại · Đã đóng (mỗi nút kèm số lượng).

**Danh sách** nhóm theo 3 mục: *"▲ Bị trả lại — cần bạn sửa"*, *"Đang chạy"*, *"Đã đóng"*. Các cột: STT, Code, Subject, Document Type, Contractor, Contract No., Project/Team, Amount, Payment Term, Budget code, **Status**.

**Cột Status** hiển thị hai dòng: tên gốc tiếng Anh + chú thích tiếng Việt, ví dụ:
- `Submitted` → *Chờ tiếp nhận (Pool)*
- `Submitted to VP Andy` → *Chờ Andy ký*
- `Returned` → *Bị trả lại*
- `Completed` → *Hoàn tất*
- `Sent to Accounting` → *Đã chuyển Kế toán (đóng)*

Danh sách **tự cập nhật thời gian thực** — khi hồ sơ bị trả lại, nó hiện ngay không cần F5. Dòng mới quá 24 giờ chưa xem có chấm báo *"Chưa xem quá 24 giờ"*.

**Menu ⋯ trên mỗi dòng** (tuỳ trạng thái): Xem chi tiết · Sửa hồ sơ · Sửa & nộp lại · Nhân bản · Thu hồi (xem [mục 8](#8-khi-hồ-sơ-bị-trả-lại) & [mục 9](#9-sửa-khi-còn-ở-pool--thu-hồi--nhân-bản)).

---

## 7. Xem chi tiết một hồ sơ

Bấm **Code** hoặc **Xem chi tiết** để mở. Bạn thấy:

- **Đầu trang:** mã hồ sơ (hoặc *"Chưa cấp mã"* nếu DCC1 chưa bốc), nhà thầu, luồng, trạng thái; badge **"Quá hạn N ngày"** nếu trễ và tag **"Đang chờ bổ sung"** nếu đang dừng SLA.
- **Dữ liệu hồ sơ:** đủ 9 trường + số vòng + diễn giải.
- **Tuyến xử lý hồ sơ:** bản đồ ga từ lúc nộp đến khi xong, có mốc **"Đang ở đây"** và **gợi ý đang chờ ai** (vd *"Chờ VP Andy duyệt"*, *"Chờ DCC2 nhận bản cứng"*, *"Chờ Kế toán (ACC) tiếp nhận"*, *"Chờ BOP duyệt"*).
- **Tóm tắt:** trạng thái, thời gian đứng ở bước này, tình trạng SLA bước hiện tại, vòng xử lý.
- **Nhật ký bàn giao:** toàn bộ lịch sử — ai làm gì, lúc nào, kèm lý do nếu có (vd *"… trình Sếp"*, *"… chuyển DCC2"*, *"… trả lại Applicant — '…'"*). Đây là dấu vết không sửa được.

---

## 8. Khi hồ sơ bị trả lại

Khi DCC1 trả hồ sơ về, nó chuyển sang **Returned** *(Bị trả lại)* và bạn nhận thông báo. Việc xử lý gồm **hai bước** (đối xứng với giao nhận bản cứng ngoài đời):

1. **Nhận lại bản cứng:** mở hồ sơ (hoặc menu **"Sửa & nộp lại"**). Đọc **lý do bị trả về** ở đầu bảng, rồi bấm **"Xác nhận đã nhận lại bản cứng"**. Hồ sơ chuyển sang **Return-fixing** *(Đang sửa & nộp lại)*.
2. **Sửa & nộp lại:** form 9 trường hiện ra để bạn chỉnh, rồi bấm **"Nộp lại"**. Hồ sơ quay lại **Submitted** và đi lại từ đầu tuyến (giữ nguyên mã cũ, đếm sang vòng mới nếu đã đi qua Kế toán/BOP).

> Nếu bạn không sửa, hồ sơ nằm mãi ở tab **Bị trả lại** — hệ thống không tự đóng giúp.

---

## 9. Sửa khi còn ở Pool · Thu hồi · Nhân bản

Khi hồ sơ **vẫn ở Pool** (`Submitted`, chưa ai bốc):

- **Sửa hồ sơ:** bạn còn sửa được 9 trường. Nếu DCC1 bốc mất đúng lúc bạn đang sửa, hệ thống báo *"Hồ sơ đã được tiếp nhận — không sửa được nữa."*
- **Thu hồi:** rút hồ sơ khỏi hàng chờ (*"DCC sẽ không còn thấy để bốc"*). Cần xác nhận. Hồ sơ chuyển **Cancelled** *(Đã hủy)*.

**Nhân bản** (mọi lúc): tạo hồ sơ mới **đổ sẵn** dữ liệu từ hồ sơ cũ — *"kiểm tra rồi nộp"*. Tiện khi nộp nhiều hồ sơ giống nhau. (Mức ưu tiên reset về Thường.)

---

# DÀNH CHO DCC (1 / 2 / 3)

## 10. Màn hình làm việc của DCC

Trang chủ DCC gồm hai phần chồng nhau:

1. **Bản đồ tuyến** (thu gọn được) — tổng quan chỉ-đọc: nút *"Hiện bản đồ tuyến" / "Thu gọn bản đồ"*.
2. **Trạm của tôi** — bảng cột để **xử lý** hồ sơ.

Phạm vi luồng theo vai: **DCC1** thấy cả 3 tuyến; **DCC2** chỉ tuyến Hợp đồng; **DCC3** chỉ tuyến Thanh toán.

---

## 11. Bản đồ tuyến

**Bản đồ tuyến** ("Bản đồ tuyến") là bảng tổng quan **chỉ đọc**: mỗi luồng là một tuyến metro, mỗi trạng thái là một **ga** hiển thị số hồ sơ + số quá hạn.

- Hai chỉ số đầu: **"N đang chạy"** và **"N quá SLA"** (đỏ khi > 0).
- **Rê chuột** vào một ga → xem nhanh danh sách; **bấm** → mở ngăn chi tiết ga.

> Đây chỉ là bảng theo dõi — **mọi thao tác xử lý nằm ở "Trạm của tôi"** bên dưới.

---

## 12. Trạm của tôi — bảng xử lý

**"Trạm của tôi"** là bảng cột: **mỗi cột là một ga** mà vai của bạn cần hành động. Chỉ hiện **hồ sơ đang chạy** (không có hồ sơ đã đóng).

**Thanh công cụ đầu bảng:**
- **Chip đồng bộ:** hiện *"Cập nhật hh:mm"*; khi mất kết nối tạm thời đổi thành *"Đang kết nối lại…"*.
- **Ô tìm kiếm** (phím tắt `/`): tìm theo mã, nhà thầu…
- **Chỉ quá hạn:** lọc chỉ hiện hồ sơ đã trễ SLA.
- **Tìm hồ sơ** (phím tắt `n`): tra cứu hồ sơ.

**Thanh bộ lọc:**
- **Luồng** (chỉ DCC1): Tất cả / Contract / Payment / General.
- **Ưu tiên:** danh sách chọn **Tất cả → GẤP → Thường**.
- **Bộ lọc đã lưu:** lưu bộ lọc hiện tại theo tên để tái dùng.

**Thẻ hồ sơ (card)** hiển thị: chữ luồng (A/B/C), mã (bấm mở chi tiết), pill **"Nn"** đỏ nếu quá hạn N ngày, pill **"chờ bổ sung"** nếu đang dừng SLA, pill **"GẤP"** nếu ưu tiên cao, nhà thầu, số tiền, và **các nút hành động**.

**Nút hành động chia hai nhóm:**
- **Nút chính** (1 chạm) — bước tiến an toàn, vd *"Nhận"*, *"Sếp duyệt → hoàn tất"*, *"Trình BOP"*, *"Gửi Kế toán…"*, *"Hoàn tất HĐ…"*.
- **Menu ⋯** — các thao tác lùi/cần lý do/điều khiển SLA (trả lại, mở lại, chờ bổ sung…). Thao tác nguy hiểm được tô đỏ và có bước xác nhận.

> Nhiều thao tác đóng/không hoàn tác được (hoàn tất, báo thiếu giấy, mở lại) sẽ hỏi xác nhận. Một số thao tác tiến có nút **"Hoàn tác (5s)"** ngay sau đó.

---

## 13. Bốc/nhận hồ sơ, khoá mềm & giành quyền

**Bốc từ Pool (DCC1):** ở ga **Submitted (Pool)**, bấm **"Nhận"** — hệ thống **sinh mã tự động** và đẩy hồ sơ sang **Submitted to VP Andy** trong một cú (báo *"Đã sinh mã …"*). Nếu loại hồ sơ sai, DCC1 trả lại luôn (trước khi sinh mã).

**Nhận bản cứng (DCC2/DCC3):** giao–nhận là **2 pha** — người gửi đẩy sang ga *"Submitted to DCCx"*, người nhận bấm **"Đã nhận bản cứng"** (nhập ngày nhận) mới chuyển tiếp. Nếu giấy thiếu/sai, dùng **"Thiếu giấy, trả về DCC1"** (xem [mục 16](#16-riêng-dcc2--luồng-hợp-đồng)/[17](#17-riêng-dcc3--luồng-thanh-toán)).

**Khoá mềm (soft lock):** khi bạn mở/xử lý một hồ sơ, hệ thống **giữ chỗ ~5 phút** để không ai xử lý trùng. Nếu người khác đang giữ, thẻ hiện *"{tên} đang xử lý"* và **ẩn nút hành động**.

**Giành quyền (Seize):** nếu cần, bấm **"Giành quyền"** để lấy quyền xử lý (khi khoá của người kia đã hết hạn/không còn giữ). Thành công → *"Đã giành quyền xử lý hồ sơ."*; nếu không → *"Không giành được — người khác đang giữ hoặc trạng thái đã đổi."*

---

## 14. Tạm dừng SLA — "Chờ bổ sung"

Khi hồ sơ phải chờ giấy tờ/đối tác **bên ngoài**, người đang giữ hồ sơ có thể **dừng đồng hồ SLA** để không bị tính quá hạn oan:

- Menu ⋯ → **"Chờ bổ sung (dừng SLA)"** — **bắt buộc nêu lý do** (*"đang chờ gì, của ai"*). Thẻ hiện pill *"chờ bổ sung"*.
- Khi có giấy → **"Đã có giấy — chạy lại SLA"**.

> Chỉ **người đang giữ** hồ sơ mới dừng/chạy lại được. Việc dừng **không** đổi trạng thái hồ sơ. Phần **đã quá hạn trước khi dừng vẫn giữ đỏ** — dừng đồng hồ không phải cách để xoá cờ đỏ. Admin có bảng giám sát các hồ sơ đang dừng.

---

## 15. Riêng DCC1

DCC1 là **trung tâm điều phối**, thấy cả 3 luồng và là **đầu mối duy nhất** bấm Trả lại/Mở lại.

**Các ga DCC1 làm việc:** Submitted (Pool) · Submitted to VP Andy · Chờ ACC (Submitted to Accounting) · Received from ACC · Submitted to BOP · và làn **đối chiếu**.

**Việc chính:**
- **Nhận từ Pool** + sinh mã + trình VP (một cú "Nhận").
- **Trình VP/BOP:** nhập kết quả Andy/BOP hộ (*"Sếp duyệt → hoàn tất"*, *"… → trình BOP"*, *"BOP duyệt → …"*).
- **Nhận về từ ACC:** khi Kế toán trả bản cứng, bấm **"Nhận về từ ACC"**.
- **Trả lại Applicant (Return):** **bắt buộc nêu lý do**. DCC2/DCC3 **không tự trả lại** — họ đẩy ngược về DCC1, DCC1 mới bấm Trả lại.
- **Mở lại (Reopen):** mở lại hồ sơ đã **Completed** (hoặc **Sent to Accounting** với Payment) → về Applicant đi vòng mới; giữ nguyên mã + lịch sử, không giới hạn thời gian.
- **Đổi ưu tiên:** DCC1 đổi được mức ưu tiên của hồ sơ ở bất kỳ trạng thái nào (được ghi log).

**Làn đối chiếu (reconcile):** khi DCC2/DCC3 báo thiếu giấy, hồ sơ hiện ở cột **"Chờ đối chiếu"** của DCC1 với gợi ý *"DCC2/DCC3 báo thiếu giấy — cần đối chiếu & bàn giao lại"*. DCC1 hoặc **"Đã bổ sung, bàn giao lại →"** hoặc **"Trả lại Applicant (Return)"**.

**Xử lý hàng loạt (bulk):** ở cột **Submitted to VP Andy**, DCC1 có thể **chọn nhiều thẻ** (checkbox) và áp một quyết định của VP cho nhiều hồ sơ cùng lúc (có xác nhận *"Áp dụng cho N hồ sơ"*). Mỗi hồ sơ có kết quả độc lập.

---

## 16. Riêng DCC2 — luồng Hợp đồng

DCC2 chỉ thấy **luồng Contract**. Trình tự:

1. **Nhận bản cứng** (từ DCC1): bấm **"Đã nhận bản cứng"** (2 pha) → hồ sơ sang **Received by DCC2**. Nếu giấy thiếu/sai → **"Thiếu giấy, trả về DCC1"** (đẩy ngược để DCC1 đối chiếu; không hoàn tác được).
2. **Gửi Kế toán:** bấm **"Gửi ACC…"**, **nhập Document No (mã hợp đồng)** rồi gửi. Nếu trùng mã, hệ thống báo *"Document No … đã tồn tại — nhập mã khác."*
3. *(Sau khi DCC1 trình BOP và BOP duyệt, hồ sơ quay lại DCC2)* **Nhận bản cứng** lần 2 (2 pha).
4. **Hoàn tất hồ sơ:** bấm **"Hoàn tất HĐ…"**, **nhập đường dẫn file scan** trên ổ chung (vd `\\share\scans\CT-2026-0001.pdf`) → xác nhận. Hồ sơ đóng ở **Completed** và **email cho Applicant**.

> DCC2 **không** đính kèm file — chỉ nhập **đường dẫn** file scan làm bằng chứng.

---

## 17. Riêng DCC3 — luồng Thanh toán

DCC3 chỉ thấy **luồng Payment** — tuyến ngắn nhất:

1. **Nhận bản cứng** (từ DCC1): bấm **"Đã nhận bản cứng"** (2 pha) → **Received by DCC3**. Thiếu giấy → **"Thiếu giấy, trả về DCC1"**.
2. **Gửi Kế toán = ĐÓNG:** bấm **"Gửi ACC…"**, **nhập Document No** rồi gửi. Hồ sơ **đóng ngay** ở **Sent to Accounting** *(Đã chuyển Kế toán)*.

> ⚠️ Với Payment, gửi Kế toán là **đóng luôn** — có hộp xác nhận *"Gửi ACC sẽ đóng hồ sơ ngay… (không qua BOP, không email Applicant) và không thể hoàn tác."* Đây **không phải** `Completed` (để số Completed không bị hiểu nhầm là "đã trả tiền"); Document No là bằng chứng đã chuyển Kế toán.

---

# THAM KHẢO

## 18. Chi tiết 3 luồng từng bước

Tên trạng thái = tiếng Anh gốc; SLA = số ngày làm việc (mặc định, Admin sửa được). Đồng hồ SLA **đặt lên người phải hành động tiếp** để rời ga đó.

### Luồng A — General (DCC1 xử suốt)
| Bước | Ai làm | → Trạng thái |
|---|---|---|
| 1 | Applicant nộp | **Submitted** (Pool) |
| 2 | DCC1 bốc + sinh mã | **Submitted to VP Andy** |
| 3a | Andy duyệt (không cần BOP) | **Completed** ✓ (email Applicant) |
| 3b | Andy duyệt (cần BOP) → DCC1 trình BOP | **Submitted to BOP** |
| 4 | BOP duyệt | **Completed** ✓ |

### Luồng B — Contract / VO / Annex / Budget
| Bước | Ai làm | → Trạng thái |
|---|---|---|
| 1 | Applicant nộp | **Submitted** (Pool) |
| 2 | DCC1 bốc + sinh mã | **Submitted to VP Andy** |
| 3 | Andy duyệt → DCC1 chuyển DCC2 | **Submitted to DCC2** |
| 4 | DCC2 nhận bản cứng | **Received by DCC2** |
| 5 | DCC2 nhập Document No → gửi ACC | **Submitted to Accounting** |
| 6 | DCC1 nhận về từ ACC | **Received from ACC** |
| 7 | DCC1 trình BOP | **Submitted to BOP** |
| 8 | BOP duyệt → DCC1 chuyển DCC2 | **Submitted to DCC2 (Hardcopy)** |
| 9 | DCC2 nhận bản cứng | **Hardcopy** |
| 10 | DCC2 nhập đường dẫn scan → hoàn tất | **Completed** ✓ (email Applicant) |

### Luồng C — Payment (DCC3, không qua BOP)
| Bước | Ai làm | → Trạng thái |
|---|---|---|
| 1 | Applicant nộp | **Submitted** (Pool) |
| 2 | DCC1 bốc + sinh mã | **Submitted to VP Andy** |
| 3 | Andy duyệt → DCC1 chuyển DCC3 | **Submitted to DCC3** |
| 4 | DCC3 nhận bản cứng | **Received by DCC3** |
| 5 | DCC3 nhập Document No → gửi ACC | **Sent to Accounting** ⭐ (đóng ngay, **không email**) |

### Trả lại (mọi luồng, 2 pha)
DCC1 **Trả lại** (nêu lý do) → **Returned** → Applicant **xác nhận nhận lại** → **Return-fixing** → Applicant **sửa & nộp lại** → **Submitted** (đi lại từ đầu). DCC2/DCC3 **không tự trả lại** — chỉ đẩy ngược DCC1.

### Mở lại (Reopen)
Từ **Completed** (General/Contract) hoặc **Sent to Accounting** (Payment) → **Reopened** → **Returned**. DCC1 bấm Mở lại; DCC2/DCC3 chỉ **"Đề nghị mở lại"**. Giữ nguyên mã + lịch sử.

---

## 19. SLA & mức ưu tiên

**SLA (hạn xử lý):**
- Mỗi trạng thái có **ngưỡng số ngày làm việc** (bỏ T7/CN). Quá ngưỡng → badge đỏ **"▲ Quá hạn N ngày"** tự bật.
- Đồng hồ đặt lên **người phải hành động tiếp**; đổi trạng thái → đồng hồ **reset** sang người mới.
- Đo **theo từng ga**, không đo tổng; qua vòng trả lại mới thì reset.
- Có thể **tạm dừng** khi chờ bên ngoài (xem [mục 14](#14-tạm-dừng-sla--chờ-bổ-sung)).

**Mức ưu tiên:**
- Hai mức: **Thường** (mặc định) và **Gấp**. *(Mức "Khẩn" cũ đã bỏ; hồ sơ cũ đánh "Khẩn" vẫn hiển thị gộp vào "Gấp".)*
- Ở Pool, hồ sơ **ưu tiên cao nổi lên trên**; cùng mức thì cũ trước.
- **DCC1 đổi được mức ưu tiên** ở bất kỳ trạng thái nào (được ghi log).

---

## 20. Trợ lý QLHS

**Trợ lý QLHS** là trợ lý nội bộ **chỉ-đọc** (không sửa gì hệ thống, không dùng AI ngôn ngữ lớn). Bấm biểu tượng nổi ở góc để mở khung chat.

- Hỏi tự nhiên bằng **tiếng Việt**, ví dụ: *"hồ sơ của tôi đang mở"*, *"chi tiết G-2026-0001"*, *"thông báo chưa đọc"*, *"việc của tôi cần xử lý"* (DCC), *"bản đồ tuyến"*.
- Có sẵn **gợi ý nhanh** theo vai.
- Kết quả **giới hạn theo quyền của bạn** — Applicant chỉ tra được hồ sơ của mình; DCC tra theo tuyến của mình.
- Trợ lý trả về danh sách/chi tiết hồ sơ, thông báo, thống kê, hoặc các bước xử lý hợp lệ tiếp theo (chỉ để xem — vẫn phải thao tác ở bảng).

---

*Tài liệu liên quan: [Hướng dẫn cho Quản trị viên (Admin)](./QLHS-huong-dan-Admin.md) · [Luồng xử lý hồ sơ từng bước (chi tiết SLA từng ga)](./QLHS-flow-walkthrough.md).*
