# Review văn phong — prd.md (PRD SSO PMH ID)

**Ngày review:** 2026-07-04
**Phương pháp:** bmad-editorial-review-prose (copy-editor lâm sàng, can thiệp tối thiểu, không thay đổi nội dung/quyết định)
**Đối tượng đọc:** dev/stakeholder đọc lần đầu

## Nhận xét chung

Văn bản viết tốt: giọng gọn, chủ động, nhất quán về mức kỹ thuật. Giọng hơi khẩu ngữ ("văng khỏi app", "quá gắt") được dùng đều tay — coi là lựa chọn văn phong có chủ đích, **không** đề nghị sửa. Vấn đề chính nằm ở **thuật ngữ project / client / app dùng lẫn nhau tại các điểm quyết định ngữ nghĩa** (đặc biệt FR-07 vs FR-19) và một số cụm mơ hồ ("bật cố định", "có ra internet public", hai con số 10 phút / 5 phút cho cùng một hành vi). Không phát hiện lỗi chính tả tiếng Việt.

## Vấn đề nghiêm trọng nhất (đọc trước)

1. **FR-07 nói group gán cho *project*, FR-19 nói gán group cho *client* nhưng "đăng nhập được *project* nào"** — dev đọc lần đầu không xác định được quan hệ group→quyền truy cập nằm ở cấp project hay cấp client. Đây là hợp đồng tích hợp cốt lõi, cần chốt một cấp và dùng nhất quán.
2. **"có ra internet public" (Phạm vi, dòng 12)** — không rõ chiều: hệ thống *truy cập được từ* internet, hay chỉ *đi ra* internet được. Mục 6 ("hệ thống ra internet public") ngụ ý chiều vào — ảnh hưởng trực tiếp đến ngữ cảnh bảo mật, cần viết tường minh.
3. **G3 cam kết "≤10 phút", FR-05 cam kết "tối đa 5 phút"** cho cùng hành vi khóa user → văng khỏi app. Không mâu thuẫn logic (5 ≤ 10) nhưng hai con số cho một cam kết khiến người đọc không biết số nào là chuẩn nghiệm thu.

## Bảng sửa chi tiết

| Original Text | Revised Text | Changes |
|---------------|--------------|---------|
| "chạy on-premise, có ra internet public" (dòng 12) | "chạy on-premise, **truy cập được từ internet public**" (nếu đúng nghĩa đó) | Cụm "có ra internet" mơ hồ về chiều truy cập; mục 6 dùng ngữ cảnh bảo mật ngụ ý hệ thống expose ra internet — cần nói thẳng. Consider: xác nhận lại chiều truy cập với tác giả? |
| G1: "Mọi **project** nội bộ mới dùng PMH ID" / thước đo "100% **app** mới tích hợp SSO" (dòng 33) | Thống nhất một từ, ví dụ: "Mọi app nội bộ mới dùng PMH ID / 100% app mới tích hợp SSO" | "project" và "app" dùng thay nhau trong cùng một ô mục tiêu — dev không rõ hai từ là một hay khác nhau. Cùng lỗi lặp tại FR-07 ("lưới các project… bấm vào mở app"). Đề xuất định nghĩa một lần ở mục 1: *project = đơn vị đăng ký với PMH ID; mỗi project có thể có nhiều client (app/môi trường)* rồi dùng đúng cấp ở từng chỗ |
| FR-07: "group gán cho **project**" vs FR-19: "Gán group cho **client**: quyết định group nào đăng nhập được **project** nào" (dòng 75, 93) | Chốt một cấp. Nếu gán ở cấp client: FR-07 → "group gán cho client của project đó"; FR-19 → "quyết định group nào đăng nhập được **client** nào" | Mâu thuẫn thuật ngữ tại quan hệ phân quyền cốt lõi; hai FR đang mô tả hai mô hình dữ liệu khác nhau. Đây là chỗ dev sẽ hỏi đầu tiên |
| G3: "trong ≤10 phút" (dòng 35) vs FR-05: "tối đa 5 phút" (dòng 70) | Dùng một con số, hoặc ghi rõ: "mục tiêu ≤10 phút; thiết kế hiện tại đạt ≤5 phút (TTL access token)" | Hai con số cho cùng cam kết offboard; người đọc không biết số nào là chuẩn nghiệm thu. Consider: hỏi tác giả số nào là SLA chính thức? |
| "OTP qua email: thiết kế sẵn, **phase sau bật cố định**" (dòng 128) + "Bật OTP cố định" (dòng 143) | "OTP qua email: thiết kế sẵn, phase sau **bật bắt buộc cho mọi user**" (nếu đúng nghĩa đó) | "bật cố định" không phải cụm chuẩn — có thể hiểu là "bật vĩnh viễn", "bắt buộc", hoặc "không cho tắt". Xuất hiện 2 chỗ. Consider: xác nhận nghĩa với tác giả? |
| Non-goal 1: "**SSO** chỉ trả lời 'user thuộc group nào'" (dòng 45) | "**PMH ID** chỉ trả lời 'user thuộc group nào'" | Tên hệ thống dao động giữa "PMH ID", "SSO", "hệ thống". Đề xuất quy ước: **PMH ID** = tên sản phẩm/hệ thống; **SSO** = cơ chế đăng nhập một lần (danh từ chung). Chỗ này đang dùng "SSO" làm tên hệ thống |
| FR-02: "thay đổi **phá vỡ** phải tăng `ver`" (dòng 67) | "thay đổi **không tương thích ngược (breaking change)** phải tăng `ver`" | "thay đổi phá vỡ" là dịch word-by-word của "breaking change", dev Việt quen thuật ngữ gốc hơn; giữ thuật ngữ tiếng Anh trong ngoặc để tra cứu |
| FR-05: "**đời còn lại** của access token cuối" (dòng 70) | "**thời gian sống (TTL) còn lại** của access token cuối" | "đời còn lại" khẩu ngữ quá mức ở một câu định nghĩa SLA; TTL là từ đã dùng ở FR-31 |
| FR-10: "(họ tên, email công ty — duy nhất, mã nhân viên — duy nhất)" (dòng 81) | "(họ tên; email công ty và mã nhân viên — mỗi trường là duy nhất)" | Chuỗi gạch ngang lồng trong ngoặc khó parse: "duy nhất" có thể đọc nhầm là bổ nghĩa cho cả cụm |
| FR-14: "admin **đặt tay**" (dòng 85) | "admin **đặt thủ công**" | "đặt tay" khẩu ngữ, dễ hiểu nhầm; "thủ công" là từ chuẩn, khớp "không thao tác tay" nên sửa đồng bộ FR-30 → "không cần thao tác thủ công" |
| FR-17: "project_admin tạo được group mới — group đó tự gán vào **project họ quản**" (dòng 91) | Consider: "…tự gán vào project **đang thao tác** (nếu quản nhiều project, chọn project khi tạo)"? | project_admin có thể quản nhiều project (FR-23) — group tự gán vào project *nào*? Mơ hồ với dev implement |
| FR-19: "có nút 'gán tất cả group' (`allow_all_groups`) để **mở nhanh**" (dòng 93) | "…để **mở quyền truy cập cho mọi group** mà không phải gán từng group" | "mở nhanh" không nói rõ mở cái gì |
| FR-20: "SSA/project_admin **(phạm vi mình)** tạo project" (dòng 97) | Consider: làm rõ — project mới tạo chưa thuộc phạm vi ai; project_admin tạo project mới thì ai gán project đó cho họ (FR-23)? | "(phạm vi mình)" áp lên hành động *tạo mới* là nghịch lý logic với dev đọc lần đầu; cần một câu giải thích hoặc bỏ quyền tạo project của project_admin |
| FR-22: "Rotate secret (cấp mới, **cũ chết ngay**)" (dòng 99) | "Rotate secret (cấp secret mới, **secret cũ mất hiệu lực ngay**)" | "chết" khẩu ngữ ở mức spec kỹ thuật; "mất hiệu lực" chính xác hơn |
| FR-29: "SSA xem **tất**" (dòng 112) | "SSA xem **tất cả**" | Rút gọn khẩu ngữ trong câu quy định quyền hạn |
| FR-33: "**chuẩn đầu ra** là mục tiêu G4" (dòng 119) | "**tiêu chí nghiệm thu** là mục tiêu G4 (tự tích hợp ≤1 ngày)" | "chuẩn đầu ra" mơ hồ; "tiêu chí nghiệm thu" khớp với cột "Kết quả nghiệm thu" ở mục 7 |
| Mục 6: "mỗi user active phát sinh 1 refresh/≤5 phút/app" (dòng 130) | "mỗi user đang hoạt động phát sinh tối đa 1 request refresh token mỗi 5 phút cho mỗi app" | Chuỗi ký hiệu nén "1 refresh/≤5 phút/app" bắt người đọc tự giải mã; viết thành câu |
| Mục 6: "user đã **login** vẫn làm việc" (dòng 132) | "user đã **đăng nhập** vẫn làm việc" | Toàn tài liệu dùng "đăng nhập" (>10 lần), riêng chỗ này dùng "login" — thống nhất |
| "Script restore phải được **diễn tập thử** trước khi **golive**" (dòng 134) | "Script restore phải được **diễn tập** trước khi **go-live**" | "diễn tập" đã hàm nghĩa thử — "diễn tập thử" thừa; "golive" viết liền không phải từ chuẩn |
| Non-goal 4: "hoặc **admin khóa**" (dòng 48) | "hoặc **nhờ admin khóa tài khoản**" | "admin khóa" cụt — khóa cái gì (phiên hay tài khoản)? FR-05 cho thấy là khóa user/tài khoản |
| Non-goal 5: "Không đồng bộ AD/LDAP…" (dòng 49) | "**Không đồng bộ danh bạ ngoài.** Không đồng bộ AD/LDAP…" | 4 non-goal đầu có tiêu đề in đậm, mục 5 không có — người đọc lướt sẽ bỏ sót; thêm tiêu đề cho đồng bộ định dạng |
| SSA: "độc quyền **khóa-xóa** user toàn cục" (dòng 56) | "độc quyền **khóa/xóa** user toàn cục" | Gạch nối giữa hai động từ liệt kê không chuẩn tiếng Việt; FR-15 dùng "Khóa / mở khóa / xóa" — thống nhất dấu "/" |

## Ghi chú thuật ngữ (không sửa từng chỗ, đề xuất quy ước một lần)

- **PMH ID / SSO / hệ thống:** dùng **PMH ID** khi chỉ sản phẩm; **SSO** chỉ cơ chế; **hệ thống** chấp nhận được khi ngữ cảnh đã rõ. Chỉ 1 chỗ vi phạm rõ (Non-goal 1, đã nêu ở bảng).
- **user / nhân viên / End-user:** dùng khá nhất quán — "nhân viên" khi nói về con người/nghiệp vụ, "user" khi nói về tài khoản/đối tượng hệ thống. Không cần sửa; nên ghi quy ước này vào đầu tài liệu để dev mới không thắc mắc.
- **project / client / app:** đây là trục thuật ngữ yếu nhất của tài liệu (xem 3 dòng đầu bảng). Đề xuất thêm 1–2 câu định nghĩa ở mục 1 hoặc đầu mục 5: *"Project = đơn vị nghiệp vụ đăng ký với PMH ID. Mỗi project có ≥1 client (một app theo môi trường dev/prod). 'App' trong tài liệu này chỉ ứng dụng mà end-user nhìn thấy."*
- **Giọng khẩu ngữ có chủ đích** ("văng khỏi app", "quá gắt", "chịu thoải mái", "lưới đỡ"): dùng đều và giúp tài liệu dễ đọc — **giữ nguyên**, trừ các chỗ nó chạm vào định nghĩa quyền hạn/SLA (đã liệt kê ở bảng: "đặt tay", "chết ngay", "xem tất", "đời còn lại").

## Chính tả

Không phát hiện lỗi chính tả tiếng Việt sau khi rà toàn văn.
