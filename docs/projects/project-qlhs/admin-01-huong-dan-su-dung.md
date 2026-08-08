# QLHS — Hướng dẫn sử dụng cho **Quản trị viên (Admin)**

> Tài liệu dành cho người dùng có vai **Admin**. Giải thích từng màn hình trong Trang quản trị và cách thao tác an toàn.
> Tên trạng thái hồ sơ giữ **tiếng Anh** (bản gốc hệ thống); phần tiếng Việt trong ngoặc chỉ để đọc cho dễ.
> Phiên bản: 2026-08. Ứng dụng nội bộ, chạy on-prem tại `de-qlhs.pmh.com.vn`.

---

## Mục lục
1. [Vai Admin là gì](#1-vai-admin-là-gì)
2. [Đăng nhập](#2-đăng-nhập)
3. [Tổng quan Trang quản trị](#3-tổng-quan-trang-quản-trị)
4. [Tổng quan hệ thống](#4-tổng-quan-hệ-thống)
5. [Người dùng & Vai](#5-người-dùng--vai)
6. [Danh mục (Payment Term / Project Team / Currency / Loại hồ sơ)](#6-danh-mục)
7. [Ngưỡng SLA](#7-ngưỡng-sla)
8. [Tạm dừng SLA](#8-tạm-dừng-sla)
9. [Phân tích vận hành](#9-phân-tích-vận-hành)
10. [Nhật ký hệ thống (Audit)](#10-nhật-ký-hệ-thống-audit)
11. [Cấu hình (Tên VP + Email SMTP)](#11-cấu-hình)
12. [Đổi ngôn ngữ / giao diện / đăng xuất](#12-đổi-ngôn-ngữ--giao-diện--đăng-xuất)
13. [Câu hỏi thường gặp](#13-câu-hỏi-thường-gặp-admin)

---

## 1. Vai Admin là gì

**Admin** là vai **quản trị hệ thống**, có toàn quyền cấu hình: gán vai cho người dùng, chỉnh danh mục, đặt ngưỡng SLA, xem phân tích và nhật ký, cấu hình email.

> ⚠️ **Admin KHÔNG xử lý hồ sơ.** Admin không bốc/duyệt/chuyển hồ sơ như DCC — vai Admin không có bất kỳ nút hành động nào trên hồ sơ. Nếu bạn vừa cần quản trị vừa cần xử lý hồ sơ, bạn phải được gán thêm một vai DCC và **chuyển vai** (xem [mục 12](#12-đổi-ngôn-ngữ--giao-diện--đăng-xuất)).

Năm vai trong hệ thống:

| Vai | Việc chính |
|---|---|
| **Admin** | Toàn quyền quản trị hệ thống |
| **Applicant** | Nộp & theo dõi hồ sơ (mặc định của mọi người đã đăng nhập) |
| **DCC1** | Bốc hồ sơ từ Pool, điều phối cả 3 tuyến; đầu mối Return/Reopen |
| **DCC2** | Xử lý luồng Hợp đồng (Contract) |
| **DCC3** | Xử lý luồng Thanh toán (Payment) |

> **Andy / ACC / BOP** (VP ký · Kế toán · Ban Giám đốc) là những người **ngoài hệ thống** — họ không đăng nhập QLHS. DCC nhập kết quả duyệt của họ hộ.

---

## 2. Đăng nhập

QLHS có **một ô đăng nhập duy nhất**, nhãn *"Email hoặc tài khoản"*:

- **Nhập email** (vd `ban@pmh.com.vn`) → chuyển sang **PMH ID (SSO)**; bạn nhập mật khẩu trên trang PMH ID, không nhập trên QLHS.
- **Nhập tên tài khoản quản trị nội bộ** (không phải email, vd `admin.ssa`) → hiện ô mật khẩu để **đăng nhập admin nội bộ** (tài khoản dự phòng, dùng khi SSO gặp sự cố). Bị giới hạn 5 lần thử/phút.

Chú thích dưới ô đăng nhập: *"Nhập email để đăng nhập qua PMH ID; tài khoản quản trị nội bộ nhập tên tài khoản."*

Một email nằm trong danh sách quản trị được cấu hình sẵn sẽ **tự động được cấp quyền Admin** ngay lần đăng nhập đầu.

> Vai của bạn được đọc lại từ hệ thống **ở mỗi lần thao tác** — nên khi bạn gán/gỡ vai cho ai đó, thay đổi có hiệu lực ở lần request kế tiếp của họ (không cần họ đăng xuất). Phiên tự đăng xuất sau **15 phút không hoạt động**.

---

## 3. Tổng quan Trang quản trị

Khi đăng nhập với vai Admin, bạn vào thẳng **Trang quản trị** (giao diện riêng, thanh điều hướng dọc bên trái). Tám mục, theo thứ tự:

| Mục | Dùng để |
|---|---|
| **Tổng quan** | Xem tình trạng hệ thống (phiên bản, thời gian chạy) |
| **Người dùng & Vai** | Gán/gỡ vai cho nhân sự |
| **Danh mục** | Quản lý Payment Term / Project Team / Currency / Loại hồ sơ |
| **Ngưỡng SLA** | Đặt số ngày cho từng chặng của mỗi luồng |
| **Tạm dừng SLA** | Theo dõi các hồ sơ đang bị dừng đồng hồ SLA |
| **Phân tích vận hành** | Biểu đồ throughput, tỷ lệ trả lại, điểm nghẽn, hồ sơ trễ |
| **Nhật ký hệ thống** | Tra cứu lịch sử mọi cú chuyển hồ sơ (bất biến) |
| **Cấu hình** | Đổi tên VP hiển thị + cấu hình email SMTP |

Mỗi mục có địa chỉ riêng (`/admin/...`) nên bạn **bookmark, F5, hoặc back/forward** đều được. Thanh điều hướng có thể thu gọn.

---

## 4. Tổng quan hệ thống

Màn hình **Tổng quan** cho biết tình trạng vận hành cơ bản: **phiên bản hệ thống** và **thời gian đã chạy** (uptime). Dùng để nhanh chóng xác nhận hệ thống đang sống và đang chạy bản nào.

---

## 5. Người dùng & Vai

Đây là nơi bạn **cấp quyền** cho nhân sự.

### Danh sách người dùng đến từ đâu
Danh sách được ghép từ **Danh bạ PMH ID (SSO)** + vai đã gán trong QLHS. Nhờ vậy bạn có thể **gán vai trước cả khi người đó lần đầu đăng nhập** QLHS.

- Nếu Danh bạ PMH ID tạm không kết nối được, màn hình **tự lùi về** danh sách người đã từng đăng nhập QLHS (kèm cảnh báo).

> ⚠️ **Lưu ý:** Màn hình hiển thị **mọi** người trong Danh bạ PMH ID, **không tự lọc** người đã bị khoá/xoá bên PMH ID. Việc chặn đăng nhập của người đã nghỉ do phía PMH ID xử lý (khoá/xoá tài khoản + đăng xuất kênh phụ). Ở QLHS, nếu muốn dọn, bạn **gỡ vai** người đó về Applicant.

### Cột trạng thái tài khoản
Mỗi người có một nhãn:
- **"đã có tài khoản"** (xanh) — đã đăng nhập QLHS ít nhất một lần.
- **"chưa đăng nhập"** — có trong Danh bạ PMH ID nhưng chưa từng đăng nhập QLHS.

### Gán vai
Các nhóm quản lý được: **Admin, DCC1, DCC2, DCC3**. **Một người chỉ giữ một vai trong các nhóm này** (loại trừ nhau).

- Chọn một nhóm ở cột trái → tìm người (theo tên/email) → **Gán**.
- Gán vai chính là "chuyển vai": hệ thống **gỡ hết vai cũ rồi thêm đúng một vai** bạn chọn.
- **Applicant là vai mặc định** của mọi người đã đăng nhập — không cần (và không thể) gán thủ công.

> **Bổ nhiệm Admin** hiện hộp xác nhận cảnh báo *"Admin có toàn quyền quản trị — chỉ bổ nhiệm người thực sự cần."* Cân nhắc kỹ.

### Gỡ vai
Bấm gỡ để đưa người đó **về Applicant**. Có nút **Hoàn tác** ngay sau đó nếu bạn lỡ tay.

> 🔒 **Bạn không thể tự gỡ quyền Admin của chính mình** (chống tự khoá mình ra ngoài). Muốn giáng cấp chính mình, hãy nhờ một Admin khác.

---

## 6. Danh mục

Màn hình **Danh mục** quản lý các giá trị dùng trong form tạo hồ sơ.

> **Nguyên tắc chung:** Tắt/không dùng một giá trị chỉ **ẩn nó khỏi form tạo mới** — **hồ sơ cũ vẫn giữ nguyên**. Hệ thống **không xoá** giá trị để không làm hỏng dữ liệu lịch sử.

### 6.1. Payment Term / Project Team / Currency
Ba loại danh mục chọn qua tab. Với mỗi giá trị bạn thấy: **Thứ tự · Giá trị · Số hồ sơ đang dùng · Trạng thái (Bật/Tắt) · Hành động**.

Bạn có thể:
- **Thêm** giá trị mới (không được để trống; không trùng trong cùng loại).
- **Đổi tên** tại chỗ.
- **Bật/Tắt** bằng công tắc. Khi tắt sẽ có xác nhận: *"Tắt sẽ ẩn giá trị khỏi form tạo mới. Hồ sơ cũ vẫn giữ nguyên. Tiếp tục?"*

Cột **"Số hồ sơ đang dùng"** cho biết giá trị đó đang được bao nhiêu hồ sơ dùng — lý do vì sao không nên/không thể xoá.

### 6.2. Loại hồ sơ (Document Type)
Ở cuối màn hình. Đây là danh mục **chỉ-thêm**: *"Thêm loại mới kèm luồng xử lý (A/B/C). Chỉ thêm — không sửa/xoá để hồ sơ cũ an toàn."*

- Khi thêm một loại, bạn chọn **luồng** cho nó: **General** (tuyến A), **Contract** (tuyến B), hoặc **Payment** (tuyến C). Luồng này quyết định hồ sơ dùng loại đó sẽ đi tuyến nào.
- **Không** đổi tên/xoá loại hồ sơ được (đã khoá cứng).

> Nhờ có Document Type, mọi loại giấy tờ đều đi đúng tuyến. Nếu nghiệp vụ có loại giấy mới, hãy thêm ở đây trước khi Applicant tạo hồ sơ.

---

## 7. Ngưỡng SLA

Màn hình **Ngưỡng SLA** đặt **số ngày làm việc** cho phép hồ sơ đứng ở mỗi chặng trước khi bị gắn cờ đỏ **"▲ Quá hạn"**.

- Ngày tính là **ngày làm việc** (bỏ Thứ 7 / Chủ nhật).
- Đặt theo **từng (luồng × chặng)**: có tab **Chung (mọi luồng)**, **General**, **Contract**, **Payment**. Ngưỡng riêng của luồng **thắng** ngưỡng chung.
- Mỗi chặng có bộ đếm − / số / + ; giá trị tối thiểu **1 ngày**.
- Sửa nhiều chặng rồi bấm **Lưu ngưỡng SLA** một lượt (thanh lưu ở đáy hiện *"{n} thay đổi chưa lưu"*). **Áp dụng ngay** lên badge ▲ toàn hệ thống.

> Trạng thái đóng (Completed / Sent to Accounting / Cancelled) **không có ngưỡng** → không bao giờ gắn cờ quá hạn.

**Ngưỡng mặc định (tham khảo):** Submitted 1 · Submitted to VP Andy 1 · Submitted to DCC2/DCC3 1 · Received by DCC2/DCC3 2 · Submitted to Accounting (Contract) 7 · Received from ACC 2 · Submitted to BOP (Contract 7 / General 2) · Submitted to DCC2 (Hardcopy) 2 · Hardcopy 2 · Returned 2 · Return-fixing 3 · Reopened 1.

---

## 8. Tạm dừng SLA

DCC có thể **tạm dừng đồng hồ SLA** của một hồ sơ khi nó phải chờ giấy tờ/đối tác **bên ngoài** (nút *"Chờ bổ sung"* trên bảng của DCC). Màn hình này là **bảng giám sát** cho Admin: xem những hồ sơ đang bị dừng đồng hồ, dừng ở chặng nào, thống kê theo ga.

> Tác dụng: đây là "đối trọng" chống lạm dụng — nếu một hồ sơ bị dừng đồng hồ quá lâu/quá thường xuyên, Admin nhìn thấy ở đây. (Lưu ý: phần quá hạn **trước khi** dừng vẫn được giữ đỏ, dừng đồng hồ không xoá được cờ đỏ đã có.)

---

## 9. Phân tích vận hành

Mọi số liệu được **tính trực tiếp từ nhật ký sự kiện** lúc bạn mở (không có bảng thống kê riêng), nên luôn khớp thực tế. Bốn phần:

1. **Throughput — "Tạo mới ↔ hoàn tất theo kỳ":** biểu đồ số hồ sơ tạo mới so với hoàn tất theo **Tuần / Tháng** (chọn được).
2. **Tỷ lệ trả lại theo luồng:** thanh đo mỗi luồng, *thấp hơn = tốt hơn*, kèm số lần trả lại / tổng hồ sơ.
3. **Nơi hồ sơ đọng (ngày TB / ga):** bảng nhiệt **chặng × luồng** — ô càng đậm là hồ sơ đọng ở chặng đó càng lâu. Đây là công cụ tìm **điểm nghẽn**.
4. **Trễ nhất đang chạy:** tối đa 10 hồ sơ đang chạy trễ SLA nặng nhất; bấm vào mở chi tiết hồ sơ.

**Xuất CSV:** chọn khoảng ngày **Từ / Đến** rồi bấm **Xuất CSV** để tải toàn bộ sự kiện trong khoảng đó (mở được bằng Excel, UTF-8).

---

## 10. Nhật ký hệ thống (Audit)

Màn hình **Nhật ký hệ thống** cho phép tra cứu **lịch sử bất biến** của mọi cú chuyển hồ sơ. Nhật ký này **chỉ đọc**, không ai sửa/xoá được (kể cả Admin) — đó là dấu vết kiểm toán.

**Bộ lọc:**
- **Mã hồ sơ** (vd `CTR-2026-…`)
- **Người thực hiện** (nhập định danh người dùng)
- **Sự kiện** (chọn từ danh sách, hoặc "Tất cả sự kiện")
- **Khoảng ngày** (Từ ngày / Đến ngày)
- Bấm **Lọc** / **Xóa lọc**.

**Bảng sự kiện** hiển thị: **Thời điểm · Hồ sơ · Người · Sự kiện · Từ → Đến · Lý do**. Các sự kiện trả lại/mở lại được tô màu nổi bật. Có phân trang (25 dòng/trang) và panel **"Hôm nay"** đếm sự kiện theo loại trong ngày.

> 📌 **Quan trọng:** Nhật ký **cố ý giữ nguyên tên trạng thái gốc tiếng Anh** (ví dụ vẫn ghi `Submitted to VP Andy` dù bạn đã đổi "Tên VP" ở Cấu hình). Nhật ký là bản gốc — nó không đổi theo tên hiển thị. Các màn hình khác (bảng, SLA, phân tích) mới áp tên VP mới.

---

## 11. Cấu hình

Màn hình **Cấu hình** gồm **hai phần**: đổi tên VP hiển thị và cấu hình email SMTP.

### 11.1. Tên VP hiển thị
- Trường **Tên VP** (tối đa 40 ký tự, mặc định `Andy`).
- Đổi ở đây là đổi tên *"VP …"* **ở mọi nơi hiển thị** (tab, chip, bản đồ tuyến, SLA, chi tiết, trợ lý) — **áp dụng ngay, không cần tải lại trang**.
- **Không** ảnh hưởng dữ liệu hồ sơ hay **nhật ký** (nhật ký giữ tên gốc — xem [mục 10](#10-nhật-ký-hệ-thống-audit)).

### 11.2. Email SMTP
Cấu hình máy chủ gửi email (dùng cho email thông báo hoàn tất/trả lại/nhắc việc). Các trường:

| Trường | Ý nghĩa |
|---|---|
| **Máy chủ SMTP (host)** | vd `smtp.pmh.com.vn`. **Để trống = quay lại dùng cấu hình trong biến môi trường `.env`.** |
| **Cổng** | mặc định 587 |
| **Dùng TLS/SSL (secure)** | bật/tắt |
| **Tên đăng nhập** | tài khoản SMTP |
| **Mật khẩu** | xem lưu ý bên dưới |
| **Địa chỉ gửi (From)** | vd `qlhs@pmh.com.vn` |

**Về mật khẩu (quan trọng):**
- Ô mật khẩu **luôn để trống khi mở** (hệ thống không bao giờ trả mật khẩu đã lưu về màn hình). Nếu đã có mật khẩu, ô hiện gợi ý *"(giữ mật khẩu đã lưu — để trống nếu không đổi)"*.
- **Để trống khi lưu = giữ nguyên mật khẩu cũ.** Chỉ nhập khi muốn đổi.
- Mật khẩu được **mã hoá** (AES-256-GCM) trước khi lưu, bằng khoá `CONFIG_ENC_KEY` đặt trong `.env` của máy chủ (khoá **chỉ nằm ở máy chủ**, không lưu trong CSDL).

> ⚠️ **Cảnh báo khoá mã hoá:** Nếu máy chủ **chưa có** `CONFIG_ENC_KEY`, màn hình hiện cảnh báo đỏ *"Thiếu CONFIG_ENC_KEY trong .env — chưa thể lưu mật khẩu SMTP an toàn"* và **không cho lưu mật khẩu**. Hãy nhờ người vận hành đặt khoá này trước.
>
> 🔑 **Đã lưu mật khẩu SMTP rồi thì KHÔNG đổi `CONFIG_ENC_KEY`** — đổi khoá sẽ khiến không giải mã được mật khẩu cũ (phải nhập lại mật khẩu SMTP).

**Gửi thử:** phần **Gửi thử** cho bạn nhập một email nhận rồi bấm **Gửi thử** để kiểm tra SMTP **theo giá trị đang nhập (chưa cần lưu)**. Nếu sai host/cổng/đăng nhập, hệ thống báo **đúng lỗi thật** để bạn sửa. Nhận được email = cấu hình chạy.

---

## 12. Đổi ngôn ngữ / giao diện / đăng xuất

Ở chân thanh điều hướng (bấm vào tên người dùng):
- **Ngôn ngữ:** Tiếng Việt / English.
- **Giao diện:** tối / sáng.
- **Thoát:** đăng xuất.
- **Chuyển vai** (RoleSwitcher) — chỉ hiện khi tài khoản của bạn có **nhiều hơn một vai**; dùng để chuyển giữa Admin và một vai DCC.

---

## 13. Câu hỏi thường gặp (Admin)

**Tôi gán vai cho người mới nhưng họ chưa đăng nhập QLHS bao giờ — có sao không?**
Không sao. Bạn gán vai trước được; vai có hiệu lực ngay khi họ đăng nhập lần đầu.

**Người đã nghỉ vẫn hiện trong danh sách — vì sao?**
Danh sách lấy từ Danh bạ PMH ID và không tự lọc người bị khoá/xoá. Việc chặn đăng nhập do phía PMH ID lo. Ở QLHS bạn chỉ cần **gỡ vai** họ về Applicant.

**Tôi lỡ xoá một Payment Term đang dùng?**
Không có nút xoá — bạn chỉ **Tắt**. Hồ sơ cũ vẫn giữ giá trị. Bật lại bất cứ lúc nào.

**Đổi ngưỡng SLA có ảnh hưởng hồ sơ đang chạy?**
Có — badge ▲ tính lại lúc đọc, nên áp dụng ngay cho cả hồ sơ đang chạy.

**Vì sao Nhật ký vẫn ghi "Andy" dù tôi đã đổi Tên VP?**
Cố ý. Nhật ký là bản gốc bất biến; chỉ các màn hình hiển thị mới đổi theo Tên VP mới.

**Đổi email SMTP xong test không gửi được?**
Bấm **Gửi thử** để đọc lỗi thật (host/cổng/đăng nhập/TLS). Nếu báo thiếu `CONFIG_ENC_KEY`, nhờ người vận hành đặt khoá này trong `.env` rồi khởi động lại API.

---

*Tài liệu liên quan: [Hướng dẫn cho Applicant & DCC](./QLHS-huong-dan-nguoi-dung.md) · [Luồng xử lý hồ sơ từng bước](./QLHS-flow-walkthrough.md).*
