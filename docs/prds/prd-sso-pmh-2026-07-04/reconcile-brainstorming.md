# Review đối chiếu: BRAINSTORMING.md ↔ PRD + Addendum

> Reviewer đối chiếu tài liệu — 2026-07-04.
> Nguồn khóa sổ: `E:\PMH\CT\BRAINSTORMING.md`
> Đối tượng: `prd.md` + `addendum.md` (xét gộp — chi tiết kỹ thuật nằm ở addendum là đúng chỗ).

## Verdict: **ĐẠT (có vài gap nhỏ cần vá)**

Độ phủ tổng thể rất tốt: toàn bộ quyết định lớn (tự build không Keycloak, không federate Google, không remember-me, idle 15 phút, webhook tùy chọn, phân tầng quyền group→project, `sub` là id nội bộ + claim `ver`, rate-limit 2 lớp, `expires_at` thời vụ, quy trình con người ngoài hệ thống, không single-logout, secret hiện 1 lần, dev không có tài khoản portal quản trị) đều có mặt và đúng chỗ. Không phát hiện mâu thuẫn nghiêm trọng nào. Các gap dưới đây là mức nhỏ–trung bình.

---

## A. GAP — ý có trong brainstorming nhưng rơi hoặc lệch trong PRD/addendum

### A1. [MÂU THUẪN NHẸ — đáng chú ý nhất] FR-20 cho project_admin **tạo project**
- **Brainstorming §2 + §11:** project_admin = "Admin phụ: quản các **project được phân công**". Ngụ ý project do SSA tạo rồi phân công.
- **PRD FR-23:** "SSA gán user vào vai project_admin **kèm danh sách project phụ trách**" — nhất quán với brainstorming.
- **PRD FR-20:** "SSA/**project_admin (phạm vi mình)** tạo project" — cho project_admin tự tạo project mới. Điều này (1) vượt brainstorming, (2) không nằm trong danh sách cập nhật coaching được khai báo (coaching chỉ nói project_admin **tạo user/group**, không nói tạo project), (3) mâu thuẫn nội bộ với FR-23: project mới do project_admin tự tạo thì ai "phân công"? Nó có tự vào danh sách phụ trách không?
- **Đề nghị:** hoặc sửa FR-20 thành "chỉ SSA tạo project; project_admin quản client/group trong project được phân công", hoặc ghi rõ đây là quyết định mới kèm luật "project_admin tạo project → tự động được phân công project đó".

### A2. [LỆCH SỐ LIỆU] Mục tiêu G3 "≤10 phút" vs cam kết 5 phút
- **Brainstorming §3.3, §7:** khóa user → văng khỏi mọi app trong **tối đa 5 phút**.
- **PRD FR-05:** giữ đúng 5 phút. Nhưng **G2/G3 (mục 2)**: "văng khỏi toàn bộ app trong **≤10 phút**".
- Không hẳn mâu thuẫn (goal đo lỏng hơn FR), nhưng hai con số trong cùng bộ tài liệu dễ gây tranh cãi khi nghiệm thu. **Đề nghị:** thống nhất 5 phút, hoặc chú thích vì sao goal nới lên 10 (ví dụ tính cả trễ vận hành/webhook retry).

### A3. [RƠI] "Monorepo skeleton" ở Phase 1
- **Brainstorming §10 Phase 1:** "monorepo skeleton, Postgres + Mailpit...".
- **PRD Phase 1 + addendum:** có Docker Compose, thiếu từ "monorepo". Chi tiết cấu trúc repo là việc của Architecture, nhưng đây là một quyết định đã ghi ở nguồn — nên xuất hiện ở addendum (một dòng trong phần Deploy/Vận hành là đủ).

### A4. [RƠI NUANCE] Directory API "kéo lên sớm nếu có project cần"
- **Brainstorming §11:** "Giữ Phase 3 — ... **kéo lên sớm nếu có project cần**".
- **PRD:** Directory API nằm Phase 3, nhưng điều kiện kéo lên sớm bị rơi. Đây là một quyết định lộ trình có chủ đích (điều kiện trigger thay đổi kế hoạch). **Đề nghị:** thêm một ghi chú ở bảng lộ trình.

### A5. [MỞ RỘNG NGẦM] FR-05 dùng "đổi mật khẩu" thay vì "reset mật khẩu"
- **Brainstorming §3.3:** "Khóa user / **reset mật khẩu** → hủy toàn bộ session + refresh token".
- **PRD FR-05:** "Khóa user / **đổi mật khẩu** → hủy toàn bộ phiên...". "Đổi mật khẩu" bao gồm cả user **tự đổi** (self-service FR-08) — vậy user tự đổi mật khẩu có bị văng khỏi mọi app (kể cả phiên đang dùng) không? Brainstorming không quyết điều này. Có thể là chủ đích tốt về bảo mật, nhưng cần nói rõ để tránh dev hiểu hai kiểu.

### A6. [WORDING NHỎ] FR-07 nói "group gán cho **project**", schema gán theo **client**
- **Brainstorming §5 + addendum:** `client_groups(client_id, group_id)` + `allow_all_groups` nằm ở bảng `clients` — đơn vị gán quyền là client, không phải project.
- **PRD FR-07:** launcher tính quyền từ "group của user giao với group gán cho **project**"; FR-19 thì nói đúng "gán group cho **client**". Với project nhiều client (dev/prod), launcher hiển thị theo client nào (`app_url` nằm ở client)? Cần một câu định nghĩa (ví dụ: launcher chỉ xét client prod).

## B. Điểm KHÁC brainstorming nhưng là cập nhật chủ đích từ coaching — KHÔNG phải lỗi

Đối chiếu với danh sách 9 cập nhật coaching được khai báo, các điểm sau khớp, ghi nhận để minh bạch:

| # | Khác biệt | Nguồn coaching | Vị trí |
|---|---|---|---|
| 1 | Trang chủ **Launcher** + `app_url` trên client | launcher | FR-07, schema addendum |
| 2 | **Self-service**: đổi MK, xem group, quản lý phiên | self-service | FR-08, Non-goal 4 |
| 3 | **2 SSA** (chính + phụ) | 2 SSA | PRD §4, addendum ghi chú `admin_roles` |
| 4 | project_admin **tạo user, tạo group** (group tự gán vào project quản) | project_admin tạo user/group | FR-10, FR-17 |
| 5 | Docs `/docs` **sau login, group "Developers"** (brainstorming không nói đặt sau login) | docs sau group Developers | FR-32; addendum "Phương án đã loại" ghi rõ lý do |
| 6 | **Policy MK**: ≥8 ký tự 4 loại, **90 ngày** (kèm ghi chú trái NIST — trung thực), temp 24h → đóng câu hỏi mở §12 | policy MK 90 ngày | PRD §6; addendum thêm `password_changed_at` |
| 7 | Tên miền **`id.pmh.com.vn`** (brainstorming để mở `sso.pmh.com.vn?`) → đóng câu hỏi mở §12 | tên miền | PRD tiêu đề, FR-32, addendum |
| 8 | **Backup**: pg_dump đêm, 30 bản, path cấu hình, backup key JWT, diễn tập restore | backup path cấu hình | PRD §6 Vận hành, addendum |
| 9 | **Audit**: online 1 năm + nén tháng + **archive viewer** trên portal → đóng câu hỏi mở §12 | audit archive viewer | FR-30, addendum |

Các bổ sung khác không có trong brainstorming nhưng hợp lý, không mâu thuẫn nguồn (ghi nhận, không phải lỗi):
- **Export CSV** (FR-12) — brainstorming chỉ có import; export là mở rộng tự nhiên của bộ công cụ admin (nhiều khả năng từ phiên coaching self-service/portal).
- **Counter-metrics** (login ≤3s, đếm lần gõ MK, ticket MK) — PRD §2; kỹ thuật PRD tốt, brainstorming không có.
- **Chặn trùng khi tạo user + gợi ý gán user sẵn có** (FR-10) — brainstorming chỉ nói unique email/mã NV; đây là UX hóa ràng buộc đó.
- **`/health` + cảnh báo webhook_deliveries failed dồn** (addendum Giám sát) — mở rộng vận hành hợp lý.
- **`groups.created_by`** trong schema addendum — hệ quả của việc project_admin tạo group (truy vết ai tạo).
- **Khôi phục backup ≤4 giờ** (PRD §6) — con số mới, brainstorming không có; nên xác nhận với chủ dự án.

## C. Bảng phủ chi tiết (brainstorming → đích)

| Mục brainstorming | Trạng thái | Vị trí trong PRD/addendum |
|---|---|---|
| §1 Tự build, không Keycloak, lõi dùng thư viện certified | ✅ | PRD §1; addendum tech stack + "Phương án đã loại" |
| §1 ~1000 user, project không tự quản user | ✅ | PRD §1, §6 |
| §2 Định danh email + mã NV; group toàn cục; client dev/prod | ✅ | PRD §4, FR-10, FR-17, FR-20 |
| §2 Phân tầng quyền (SSO chỉ quyết group→project) | ✅ | Non-goal 1 |
| §3.1 OIDC Auth Code, OTP phase sau | ✅ | FR-01; PRD §6 |
| §3.1 JWT claims + `ver` là hợp đồng API | ✅ | FR-02 |
| §3.1 Verify offline JWKS, SSO sập vẫn làm việc | ✅ | FR-03; PRD §6 Độ sẵn sàng |
| §3.2 Directory API client-credentials, scope theo group, không trả MK | ✅ | FR-24, FR-25; addendum |
| §3.3 Phiên 3 lớp (cookie idle 15' / refresh sliding 15' / access 5') | ✅ | FR-04 + bảng addendum |
| §3.3 Không remember me, không federate Google | ✅ | FR-04, Non-goal 5, PRD §9 |
| §3.3/§7 Khóa → hủy phiên → văng ≤5 phút | ⚠️ A2 (goal ghi ≤10') | FR-05; G3 |
| §4 Tech stack đầy đủ + phương án .NET | ✅ | addendum |
| §5 Schema DB đầy đủ (mọi bảng) | ✅ (+2 cột mới có chủ đích) | addendum |
| §5 Ghi chú va chạm group đa-project, SSA phân xử | ✅ | FR-18 |
| §6 OIDC endpoints; logout từng app, không single-logout | ✅ | FR-06, Non-goal 4; addendum |
| §6 `GET /api/v1/events?since=` polling dự phòng | ✅ | FR-26 |
| §6 Webhook 4 event, HMAC-SHA256, retry 1m/5m/30m, TÙY CHỌN | ✅ | FR-27 |
| §6 Admin API: import CSV, lock/unlock, reset (manual/email_temp), rotate/disable, gán group, admins SSA-only, settings SSA-only | ✅ | FR-11→FR-23, FR-31; addendum |
| §7 Tạo user tay/CSV, MK tạm có hạn, bắt đổi lần đầu | ✅ | FR-10, FR-11, FR-13 |
| §7 Template CSV + luồng preview + tick tự tạo group + gửi mail hàng loạt | ✅ | FR-11; addendum |
| §7 Quên MK tự phục vụ; admin reset 2 chế độ | ✅ | FR-09, FR-14 |
| §7 Nghỉ việc = khóa; khóa/xóa toàn cục chỉ SSA | ✅ | FR-05, FR-15 |
| §7 `expires_at` thời vụ tự khóa | ✅ | FR-16 |
| §7 Quy trình con người ngoài hệ thống | ✅ | PRD §4 |
| §8 Rate-limit 2 lớp (5/15' email+IP; 10/15' email) | ✅ | PRD §6 |
| §8 Cookie flags, HTTPS, RS256/JWKS | ✅ | PRD §6 |
| §8 Audit mọi login + thao tác admin | ✅ | FR-28 |
| §9 Docs + app demo + quy trình cấp phát secret kênh riêng tư | ✅ | FR-21, FR-32, FR-33; G4 |
| §10 Lộ trình 4 phase | ✅ (⚠️ A3 monorepo, A4 nuance kéo sớm) | PRD §7 |
| §11 Nhật ký quyết định (9 dòng) | ✅ tất cả | PRD toàn văn + §9; addendum "Phương án đã loại" |
| §12 Câu hỏi mở: 4 câu | ✅ 1 giữ mở (field Directory API), 3 đã đóng bằng coaching | PRD §8 |

## D. Kết luận & việc cần làm

1. **Sửa hoặc biện minh FR-20** (project_admin tạo project) — gap đáng kể nhất vì đụng mô hình phân quyền. *(A1)*
2. **Thống nhất 5 phút vs 10 phút** giữa G3 và FR-05. *(A2)*
3. Thêm "monorepo" vào addendum phần Deploy. *(A3)*
4. Thêm ghi chú "Directory API kéo lên sớm nếu có project cần" vào lộ trình. *(A4)*
5. Làm rõ FR-05: user **tự đổi** mật khẩu có hủy toàn bộ phiên không, hay chỉ áp dụng cho admin reset/khóa. *(A5)*
6. Làm rõ launcher xét theo client nào khi project có nhiều client. *(A6)*
7. Xác nhận với chủ dự án hai con số mới không có nguồn: khôi phục backup ≤4 giờ, export CSV (nếu không phải từ coaching thì ghi nhận là bổ sung của PRD).
