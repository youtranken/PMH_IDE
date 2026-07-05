# PRD Quality Review — PMH ID (SSO quản lý user tập trung)

> Rubric: `prd-validation-checklist.md` (bmad-prd 6.8.0). Stakes: internal tool, ~1000 user, độc giả chính là dev các project tích hợp. Đã đọc `prd.md` + `addendum.md` trước khi đánh giá.

## Overall verdict

Đây là một PRD tốt so với stakes: quyết định được nêu như quyết định (kèm cái đã đánh đổi), non-goals làm việc thật, FR phần lớn kiểm chứng được, và ranh giới capability/implementation được giữ kỷ luật nhờ tách addendum. Rủi ro lớn nhất nằm đúng chỗ độc giả chính đứng: hợp đồng tích hợp (Directory API fields, ngữ nghĩa events polling) còn để mở — đã được thừa nhận trung thực ở Câu hỏi mở, nhưng vì dev tích hợp là lý do tồn tại của tài liệu, phần này nên được chốt "tối thiểu v1" thay vì chờ. Không có finding critical; sửa 2–3 điểm high/medium là đủ chuyển sang bước Architecture.

## 1. Decision-readiness — strong

Đây là điểm mạnh nhất của PRD. Các lựa chọn gai góc được nêu thẳng kèm chi phí:

- §3.5 + §9: **không federate Google Workspace** dù công ty dùng Gmail — nêu rõ là chủ đích, có nhật ký quyết định, addendum lưu cả lý do loại ("Phương án đã loại") để khỏi bàn lại.
- FR-04 + §9: **idle 15 phút, không remember-me** — ghi rõ "chấp nhận gõ mật khẩu nhiều lần/ngày", và counter-metric §2 theo dõi đúng cái giá phải trả (số lần gõ mật khẩu/ngày, phản ánh user).
- §6 Bảo mật: **đổi mật khẩu 90 ngày trái khuyến nghị NIST** — PRD tự khai điều này thay vì giấu, kèm lối thoát (số nằm trong Settings, đổi không cần sửa code). Đây là hành vi trung thực hiếm thấy.
- FR-27: webhook **tùy chọn** với lưới đỡ FR-05 — trade-off "project lười vẫn an toàn" được nói rõ.
- Câu hỏi mở §8 là câu hỏi mở thật (field Directory API, danh sách project) — không phải câu hỏi tu từ có sẵn đáp án.

Người phản biện ("sao không dùng Keycloak?", "sao không login bằng Google?") sẽ thấy ý kiến của mình đã được ghi nhận và trả lời trong addendum "Phương án đã loại". Không có finding.

## 2. Substance over theater — strong

Không có persona theater: §4 là bảng vai trò với số lượng thật (2 SSA, ~1000 end-user, dev của 3–5 project) và mỗi vai trò đều kéo theo FR cụ thể (SSA → FR-15/23/31, project_admin → FR-10/12/14/17/18, dev → F6/F8). NFR §6 có ngưỡng sản phẩm-cụ-thể thay vì boilerplate: rate-limit 5 lần/15 phút theo email+IP **và** 10 lần/15 phút theo email bất kể IP (chống xoay IP — chi tiết này chứng tỏ có suy nghĩ thật), khôi phục ≤4 giờ, backup 30 bản, restore phải diễn tập trước golive. Không có mục "Differentiation/Vision" trang trí — đúng, vì internal tool không cần.

### Findings
- **low** Khẳng định năng lực chưa có căn cứ số (§6 Hiệu năng) — "hệ thống một server chịu thoải mái" là kết luận đúng khả năng cao với ~1000 user, nhưng là adjective chứ không phải bound. *Fix:* thay bằng ước lượng thô (VD: peak ~N req/s từ công thức refresh/5 phút × app × user active đã có sẵn trong câu đó).

## 3. Strategic coherence — strong

PRD có thesis rõ: *xây nền danh tính chung trước khi làn sóng app nội bộ mới ra đời, để không app nào lặp lại vấn đề cũ* (§1, gạch đầu dòng cuối). G1–G4 (§2) đo đúng thesis đó — G1 đo adoption (100% app mới, 3–5 project trong 2026), G4 đo chi phí tích hợp (≤1 ngày công) là điều kiện để G1 khả thi. Có counter-metrics tử tế (độ trễ SSO, số lần gõ mật khẩu, ticket đăng nhập). Lộ trình §7 đi theo thesis: lõi SSO → công cụ vận hành → tích hợp, với tiêu chí nghiệm thu mỗi phase là kết quả quan sát được ("SSA vận hành toàn bộ vòng đời user không cần đụng DB").

### Findings
- **medium** G1/G4 phụ thuộc biến ngoài tầm kiểm soát (§2, §8) — "3–5 project tích hợp trong 2026" và "tích hợp ≤1 ngày" đo bằng tiến độ của các team khác, mà §8 tự thừa nhận "chủ dự án không kiểm soát tiến độ các project đó". Nếu project bên ngoài trễ, PMH ID "fail" G1 dù làm đúng mọi thứ. *Fix:* tách phần đo được nội bộ (VD: "app demo tích hợp xong ≤1 ngày công bởi dev không thuộc team PMH ID" như một acceptance test chủ động) khỏi phần adoption phụ thuộc bên ngoài.

## 4. Done-ness clarity — adequate

Phần lớn FR có hệ quả kiểm chứng được: FR-05 (văng khỏi mọi app ≤5 phút), FR-10 (chặn trùng + gợi ý hành động thay thế), FR-11 (preview lỗi từng dòng với ba loại lỗi liệt kê), FR-21 (secret hiển thị đúng một lần), FR-30 (chọn file tháng → hiển thị, không thao tác tay). FR-07 định nghĩa cả công thức tính quyền truy cập (group của user giao group gán cho project) — đây là mức rõ ràng mà nhiều PRD thiếu. Tuy nhiên đúng chỗ rubric bảo "unforgiving" thì có mấy lỗ:

### Findings
- **high** Hợp đồng Directory API chưa đủ để dev làm việc (FR-24, FR-26) — FR-24 để mở field trả về ("chờ nhu cầu project thật"), FR-26 hoàn toàn không định nghĩa ngữ nghĩa `since=` (cursor là gì, event giữ bao lâu, miss event thì sao, thứ tự đảm bảo không). Với độc giả chính là dev tích hợp, đây là phần "done" mù nhất của PRD — và khác FR-24 (đã ghi ở Câu hỏi mở), FR-26 thậm chí không được nhận là mở. *Fix:* chốt field set v1 tối thiểu = đúng claims FR-02 (sub, email, employee_code, full_name, groups) + status, tuyên bố mở rộng theo `ver`; thêm 2–3 dòng ngữ nghĩa events (cursor opaque, retention ≥30 ngày, at-least-once, client tự idempotent).
- **medium** Lệch con số offboard: G3 nói ≤10 phút, FR-05 nói ≤5 phút (§2 vs FR-05) — không mâu thuẫn logic (FR chặt hơn goal) nhưng hai con số cho cùng một lời hứa sẽ gây tranh cãi lúc nghiệm thu. *Fix:* chọn một con số làm cam kết (5 phút, vì suy ra từ TTL access token) và để G3 trích lại đúng nó.
- **medium** FR-31 kết thúc bằng "..." — "TTL token, thời gian idle, policy mật khẩu, hạn mật khẩu tạm, path backup, SMTP..." là danh sách mở; không thể biết Settings "xong" khi nào. *Fix:* chốt danh sách settings v1 (bỏ dấu ba chấm) — mọi thứ khác là hard-code cho đến khi có nhu cầu.
- **medium** FR-09 gửi mật khẩu tạm qua email không được nêu như trade-off — mật khẩu tạm (dù hạn 24h + bắt đổi) đi qua Gmail là kênh ngoài kiểm soát; phương án reset-link one-time phổ biến hơn và không lộ credential trong hộp thư. Các quyết định khác đều có lý do trong nhật ký, riêng cái này im lặng. *Fix:* hoặc đổi sang reset-link, hoặc thêm một dòng vào §9 ghi nhận đã cân nhắc.
- **low** OTP "phase sau bật cố định" (§6) không có điều kiện kích hoạt — "phase sau" là bao giờ, gắn với sự kiện gì (golive? sau project đầu tiên?). *Fix:* neo vào lộ trình §7 (VD: bắt buộc cho SSA/project_admin trước khi mở Phase 3).

## 5. Scope honesty — strong

§3 Non-goals là mục làm việc thật: cả 5 mục đều chặn đúng những giả định người đọc dễ tự suy ("SSO thì chắc quản role app luôn", "chắc có single-logout", "chắc đồng bộ AD"). §4 nói rõ quy trình con người nằm ngoài hệ thống. Câu hỏi mở ít (2) và đúng mức với stakes internal — không phải PRD xanh-đèn-xây với 20 câu hỏi treo. De-scope được làm công khai (single-logout → "cân nhắc nếu phát sinh nhu cầu thật" ở §7).

PRD không dùng convention `[ASSUMPTION]`/`[NOTE FOR PM]` của template — nhưng chức năng của chúng được thay bằng nhật ký quyết định §9 + addendum "Phương án đã loại", nên về bản chất không mất thông tin. Ghi ở Mechanical notes, không trừ điểm ở đây.

### Findings
- **low** Câu hỏi mở "danh sách 3–5 project cụ thể" (§8) không có owner/deadline — ai chốt, trước phase nào cần chốt (Phase 3 cần ít nhất 1 project thật). *Fix:* thêm điều kiện "phải chốt project đầu tiên trước khi Phase 3 bắt đầu".

## 6. Downstream usability — adequate

FR-01→FR-33 liên tục, không trùng, không gap. Cross-reference nội bộ đều resolve (FR-05→FR-27, FR-15→FR-18, FR-24→§8, §6→Settings FR-31). Tài liệu nguồn tham chiếu tồn tại thật (`BRAINSTORMING.md` ở repo root, `.memlog.md` trong thư mục PRD). Addendum là input sạch cho bước Architecture: schema, endpoint, cơ chế token 3 lớp khớp với FR (đối chiếu FR-04 ↔ bảng token, FR-27 ↔ webhook_deliveries, FR-16 ↔ expires_at).

### Findings
- **medium** Thiếu glossary cho bộ danh từ project/client/group/claim (toàn PRD) — quan hệ "project chứa nhiều client theo môi trường, group gán cho client (không phải project)" chỉ suy ra được khi ghép FR-07 + FR-19 + FR-20, và FR-07 nói "group gán cho project" trong khi FR-19/schema nói group gán cho **client** — dev tích hợp (độc giả chính, đọc từng phần rời) sẽ vấp. *Fix:* thêm glossary 5–6 dòng đầu §5 và sửa FR-07 dùng đúng từ "client".
- **low** `BRAINSTORMING.md` được trích dẫn không kèm đường dẫn (§9, header) — file nằm ở repo root chứ không cùng thư mục PRD; người đọc mới sẽ tìm sai chỗ. *Fix:* ghi đường dẫn tương đối từ thư mục PRD.

## 7. Shape fit — strong

Đúng shape cho internal tool: capability spec ~5 trang, không có UJ trang trí (bảng vai trò §4 + FR gánh đủ), success metrics vận hành thay vì user-facing — khớp khuyến nghị rubric cho "internal tool, single-operator role". Kỷ luật capability/implementation tốt: tech stack, schema DB, endpoint cụ thể đều nằm ở addendum có ghi chú "không thuộc PRD". Những chi tiết kỹ thuật còn lại trong PRD (JWT claims FR-02, JWKS FR-03, RS256/Argon2 §6) đều biện minh được vì chúng **là** hợp đồng công khai với project tích hợp hoặc yêu cầu bảo mật, không phải lựa chọn cài đặt.

### Findings
- **low** Rò rỉ implementation nhẹ trong lộ trình (§7 Phase 1) — "Docker Compose (Postgres, Mailpit)" là chi tiết stack thuộc addendum; trong PRD chỉ cần "môi trường triển khai chạy được". *Fix:* thay bằng mô tả capability, giữ tên công nghệ bên addendum.

## Mechanical notes

- **Số liệu trôi:** G3 "≤10 phút" vs FR-05 "≤5 phút" (đã nêu ở Done-ness, medium — là finding nội dung, không chỉ mechanical).
- **Glossary drift:** FR-07 "group gán cho project" vs FR-19/addendum `client_groups` (group gán cho client) — đã nêu ở Downstream usability.
- **Convention template:** không có `[ASSUMPTION]` tags / Assumptions Index / `[NOTE FOR PM]`; chức năng được thay thế bằng §9 + addendum "Phương án đã loại" nên roundtrip không áp dụng được nhưng cũng không mất thông tin. Nếu downstream workflow (create-epics, architecture) source-extract theo tag, sẽ không tìm thấy gì — chấp nhận được với stakes này.
- **Cross-refs ngoài:** `BRAINSTORMING.md` (repo root) và `.memlog.md` (cùng thư mục) đều tồn tại; `BRAINSTORMING.md` thiếu đường dẫn tương đối.
- **ID:** FR-01→FR-33 liên tục, F1→F8 liên tục, G1→G4 liên tục. Không duplicate.
- **UJ protagonist:** không áp dụng — PRD không dùng UJ, đúng với shape.
- **Addendum khớp PRD:** đối chiếu chéo không thấy mâu thuẫn giữa addendum và FR (token TTL, webhook events, retry schedule, CSV template ↔ FR-11 đều khớp).
