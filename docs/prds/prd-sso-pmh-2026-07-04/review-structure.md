# Review cấu trúc — PRD Hệ thống SSO PMH ID

*Ngày review: 2026-07-04 · Reviewer: structural editor (bmad-editorial-review-structure) · File nguồn: `prd.md`*

## Tóm tắt tài liệu

- **Mục đích:** Đặc tả yêu cầu sản phẩm cho IdP nội bộ (PMH ID) — làm cơ sở để chủ dự án duyệt phạm vi và dev tích hợp hiểu hợp đồng kỹ thuật.
- **Độc giả:** Chủ dự án (quyết định phạm vi) + dev tích hợp (dùng FR/NFR làm hợp đồng).
- **Reader type:** humans
- **Mô hình cấu trúc áp dụng:** Strategic/Context (Pyramid) — kết luận trước, chi tiết sau, các nhóm MECE.
- **Độ dài hiện tại:** ~2.400 từ, 9 mục chính (F1–F8 là 8 tiểu mục của mục 5).

**Nhận định tổng quát:** Cấu trúc PRD về cơ bản **lành mạnh và gọn**: thứ tự mục theo chuẩn PRD (bối cảnh → mục tiêu → non-goals → người dùng → FR → NFR → lộ trình → câu hỏi mở → quyết định), FR đánh số nhất quán, cross-reference dùng đúng chỗ (FR-05↔FR-27, FR-15→FR-18, FR-24→Câu hỏi mở). Vấn đề còn lại là **trùng lặp mức micro**: cùng một quyết định/cơ chế được phát biểu lại ở 3–4 nơi (mật khẩu tạm 24h, lý do các quyết định, single-logout), và một vài FR đặt sai vị trí trong nhóm. Không có mục nào "quá dài so với vai trò"; không cần cắt khối lớn nào.

---

## Khuyến nghị (theo thứ tự ưu tiên)

### 1. CONDENSE — Mục 9 "Nhật ký quyết định": bỏ danh sách "Đáng chú ý" lặp lại

**Vấn đề:** Cả 4 điểm trong câu "Đáng chú ý: ..." đều đã được phát biểu **đầy đủ tại nơi sử dụng**:
- "không federate Google Workspace" = Non-goal #5 (mục 3)
- "idle 15 phút không remember me" = FR-04 (đã có chú thích "Quyết định có chủ đích")
- "webhook tùy chọn" = FR-27 (đã in đậm "tùy chọn")
- "đổi mật khẩu 90 ngày trái NIST" = ghi chú NIST trong mục 6

Đây là trùng lặp thật (identical information, không phải summary có chủ đích) — hai nguồn sự thật cho cùng một quyết định sẽ trôi lệch nhau khi PRD sửa đổi.

**Đề xuất:** Mục 9 chỉ giữ 1 câu trỏ tới `BRAINSTORMING.md` mục 11 + `.memlog.md`. *(Phương án ngược — dồn hết lý do về mục 9, xóa chú thích inline — kém hơn: dev đọc FR-04 cần thấy ngay "đây là chủ đích" để không mở ticket đòi remember-me.)*

**Impact:** ~-55 từ. Không ảnh hưởng khả năng hiểu — thông tin vẫn còn nguyên tại điểm dùng.

### 2. MERGE — Cơ chế "mật khẩu tạm" định nghĩa một lần, các FR chỉ tham chiếu

**Vấn đề:** "Mật khẩu tạm hạn 24h (qua email), bắt đổi ở lần đăng nhập kế" được phát biểu lại **4 lần**: FR-09 (quên mật khẩu), FR-11 (import CSV), FR-13 (user mới), FR-14 (reset), cộng thêm lần thứ 5 trong policy mật khẩu ở mục 6. Nguy hiểm hơn: con số 24h là **cấu hình được** (FR-31 "hạn mật khẩu tạm" nằm trong Settings) — hardcode "24h" ở 4 chỗ vừa lặp vừa mâu thuẫn ngầm với FR-31.

**Đề xuất:** Định nghĩa cơ chế một lần (hợp lý nhất: gộp vào FR-13, đổi thành "Cơ chế mật khẩu tạm: gửi qua email, hạn theo Settings — mặc định 24h, bắt đổi ở lần đăng nhập kế; áp dụng cho user mới, quên mật khẩu, reset"). FR-09/FR-11/FR-14 chỉ viết "→ cấp mật khẩu tạm (FR-13)". Mục 6 giữ lại vì đó là policy tổng hợp (chấp nhận là summary).

**Impact:** ~-40 từ + loại rủi ro drift khi đổi con số 24h.

### 3. MOVE + MERGE — Sắp lại thứ tự trong F3; nhập FR-25 vào FR-24

**Vấn đề a (MOVE):** Trong F3, FR-13 (mật khẩu tạm cho user mới) đứng **sau** FR-11/FR-12 (import/export CSV), trong khi nó là hệ quả trực tiếp của FR-10 (tạo user) — và FR-11 thậm chí đã phải nhắc trước "gửi email mật khẩu tạm từng người" trước khi khái niệm này được định nghĩa. Vi phạm nguyên tắc dependency-first.
**Đề xuất:** Thứ tự F3 nên là: FR-10 (tạo) → FR-13 (mật khẩu tạm) → FR-14 (reset) → FR-11 (import) → FR-12 (export) → FR-15 (khóa/xóa) → FR-16 (hạn dùng).

**Vấn đề b (MERGE):** FR-25 không phải requirement — nó là **use-case minh họa/lý do tồn tại** của FR-24 ("app lấy danh bạ trước, không cần user login"). Đứng riêng một FR làm loãng danh sách hợp đồng.
**Đề xuất:** Nhập thành câu ví dụ trong FR-24.

**Lưu ý renumbering:** Nếu số FR đã được tài liệu khác tham chiếu (epics, stories), giữ nguyên số và chỉ di chuyển vị trí / đánh dấu FR-25 là "(ghi chú của FR-24)"; nếu chưa, đánh số lại một lần ngay bây giờ trước khi PRD được trích dẫn rộng.

**Impact:** ~-15 từ; cải thiện flow đọc F3 và độ "sạch hợp đồng" của F6.

### 4. MOVE — Đưa đoạn định nghĩa PMH ID lên đầu mục 1 (pyramid: kết luận trước)

**Vấn đề:** Đoạn "PMH ID là Identity Provider nội bộ tự xây..." — câu trả lời cốt lõi của toàn tài liệu — hiện nằm **cuối** mục 1, sau danh sách vấn đề. Người đọc lướt (chủ dự án) phải đọc hết bullet vấn đề mới biết tài liệu đề xuất gì.

**Đề xuất:** Đảo thứ tự trong mục 1: đoạn "PMH ID là..." lên trước (hoặc tách thành 2–3 dòng "Tóm tắt" ngay dưới header), danh sách vấn đề theo sau làm bằng chứng. Đúng nguyên tắc Pyramid: recommendation dẫn, evidence theo.

**Impact:** 0 từ (chỉ đảo vị trí); cải thiện đáng kể trải nghiệm đọc lướt.

### 5. MOVE — Chuyển ghi chú NIST (mục 6) về nhật ký quyết định

**Vấn đề:** Chú thích dài trong policy mật khẩu — *"NIST hiện khuyến nghị không bắt đổi định kỳ vì phản tác dụng — đã nêu, quyết định giữ 90 ngày..."* — là **lý do quyết định**, không phải yêu cầu. Đặt giữa NFR làm gãy nhịp đọc của dev đang tra spec.

**Đề xuất:** NFR chỉ giữ "bắt đổi mỗi 90 ngày (quyết định có chủ đích — xem mục 9); số nằm trong Settings". Nội dung NIST chuyển về mục 9 (mục 9 sau khi thực hiện khuyến nghị #1 sẽ có chỗ cho đúng một ghi chú này — quyết định duy nhất *chưa* được giải thích ở nơi khác đủ ngắn gọn).

**Impact:** ~-10 từ ròng; NFR sạch hơn, mục 9 có nội dung thực thay vì lặp lại.

### 6. CUT — Chi tiết quy trình soạn thảo trong metadata

**Vấn đề:** Dòng "Tài liệu nguồn: ... + 4 phiên coaching PRD" — thông tin quy trình soạn thảo, không phục vụ độc giả nào của PRD.

**Đề xuất:** Cắt "+ 4 phiên coaching PRD", giữ tham chiếu `BRAINSTORMING.md`.

**Impact:** ~-6 từ.

### 7. QUESTION — Single-logout xuất hiện 3 lần

Non-goal #4, FR-06, và Lộ trình "Sau" cùng chạm chủ đề logout. Không phải trùng lặp thuần (mỗi nơi một vai: phạm vi / yêu cầu / tương lai) nhưng Non-goal #4 và FR-06 nói gần như cùng nội dung. **Gợi ý:** FR-06 rút gọn còn phần requirement thuần ("PMH ID có endpoint logout chấm dứt phiên SSO; logout app do từng app xử lý") và bỏ lặp "từng app riêng" nếu tác giả thấy Non-goal #4 đã đủ. Cần tác giả quyết — mức lặp này có thể là reinforcement chấp nhận được.

### 8. PRESERVE — Bảng vai trò (mục 4) dù chồng lấn với chi tiết quyền trong F3–F5

Bảng mục 4 tóm tắt quyền, F3–F5 đặc tả chi tiết — đây là **mental model trước chi tiết**, không phải trùng lặp. Giữ nguyên. Tương tự, giữ các cross-reference (FR-05↔FR-27, FR-24→Câu hỏi mở): chúng là keo kết dính giúp tài liệu đọc không tuyến tính vẫn hiểu được.

### 9. PRESERVE — Cột "Kết quả nghiệm thu" trong bảng Lộ trình (mục 7)

Mỗi phase có definition-of-done cụ thể, trỏ ngược về FR/G — đây là điểm mạnh cấu trúc, giữ nguyên.

---

## Nhận xét về thứ tự mục lớn

Thứ tự 9 mục hiện tại (Bối cảnh → Mục tiêu → Non-goals → Người dùng → FR → NFR → Lộ trình → Câu hỏi mở → Quyết định) là chuẩn và **không cần đảo**. Đã cân nhắc việc đưa "Người dùng & Vai trò" (4) lên trước "Non-goals" (3) — không đáng: Non-goals ngay sau Mục tiêu tạo cặp "làm gì / không làm gì" chặt chẽ hơn.

## Tổng kết

| Chỉ số | Giá trị |
|---|---|
| Tổng khuyến nghị | 9 (1 CONDENSE, 2 MERGE, 3 MOVE, 1 CUT, 1 QUESTION, 2 PRESERVE) |
| Giảm ước tính nếu nhận hết | ~125 từ (~5% tài liệu) |
| Length target | Không đặt — mức giảm nhỏ là đúng, vì tài liệu vốn đã đặc |
| Đánh đổi khả năng hiểu | Không có — mọi đề xuất cắt/gộp đều giữ thông tin tại ít nhất một điểm dùng; 2 mục PRESERVE bảo vệ các aid quan trọng |

Việc đáng làm nhất không phải là giảm độ dài mà là **thiết lập một nguồn sự thật duy nhất** cho: (a) lý do các quyết định (khuyến nghị 1, 5) và (b) cơ chế mật khẩu tạm (khuyến nghị 2) — trước khi PRD này được các tài liệu epics/stories tham chiếu và các bản sao bắt đầu trôi lệch nhau.
