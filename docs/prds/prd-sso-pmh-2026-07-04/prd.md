---
title: "PRD — Hệ thống SSO quản lý user tập trung (PMH ID)"
status: final
created: 2026-07-04
updated: 2026-07-04
---

# PRD — Hệ thống SSO quản lý user tập trung (PMH ID)

**Sản phẩm:** PMH ID — Identity Provider nội bộ tại `id.pmh.com.vn`
**Tài liệu nguồn:** `BRAINSTORMING.md` (khóa sổ 2026-07-04, kèm nhật ký quyết định roundtable) + 4 phiên coaching PRD
**Phạm vi:** ~1000 nhân viên, các project nội bộ của công ty (bất động sản); chạy trên server công ty (on-premise) và expose ra internet public qua reverse proxy — truy cập được từ ngoài văn phòng

---

## 1. Bối cảnh & Vấn đề

**PMH ID** là Identity Provider (IdP) nội bộ tự xây: quản lý tập trung toàn bộ vòng đời user, cung cấp đăng nhập một lần (SSO) qua chuẩn OIDC, và cấp API cho các project khác sử dụng kho user chung. Các project không tự quản user nữa — họ được cấp credential (client) và tích hợp theo tài liệu.

Lý do hệ thống này cần tồn tại: hiện nay mỗi hệ thống nội bộ tự quản lý user riêng — mỗi app một bảng user, một bộ mật khẩu. Hệ quả:

- Nhân viên phải nhớ nhiều tài khoản cho nhiều app.
- Khi nhân viên nghỉ việc, phải khóa tài khoản ở từng hệ thống — sót một nơi là một lỗ hổng bảo mật.
- Không có cái nhìn tập trung "ai đang truy cập được gì", không có audit thống nhất — trong khi yêu cầu quản trị/bảo mật từ cấp trên ngày càng chặt.
- Công ty sắp xây một loạt app nội bộ mới (Quản lý tài sản, Quản lý hồ sơ, Văn phòng phẩm...) do nhiều dev khác nhau thực hiện — nếu không có nền danh tính chung ngay từ đầu, mỗi app sẽ lặp lại đúng vấn đề trên.

**Thuật ngữ dùng thống nhất trong tài liệu:** một **project** là đơn vị quản trị (vd. "Quản lý tài sản") chứa một hoặc nhiều **client** — credential cấp cho từng môi trường của project (dev/prod), gồm `client_id`/`client_secret`/`app_url`. **App** là ứng dụng mà user nhìn thấy, tương ứng với client có `app_url`. Quyền truy cập được gán ở mức **client** (group ↔ client).

## 2. Mục tiêu & Thước đo thành công

Sau 6–12 tháng vận hành:

| # | Mục tiêu | Thước đo |
|---|---|---|
| G1 | Mọi project nội bộ mới dùng PMH ID | 100% project mới tích hợp SSO, không project nào tự tạo bảng user riêng; **3–5 project tích hợp trong năm 2026** |
| G2 | Onboard nhanh | Nhân viên mới: tạo tài khoản + gán group ≤15 phút thao tác admin; dùng được mọi app liên quan ngay ngày đầu |
| G3 | Offboard sạch | Khóa user một nơi → văng khỏi toàn bộ app trong **≤5 phút** (khớp cơ chế FR-05), không còn tài khoản "ma" |
| G4 | Dev tự tích hợp | Dev project mới đọc docs + app demo, tích hợp xong ≤1 ngày công, không cần hỗ trợ trực tiếp |

**Counter-metrics (theo dõi để mục tiêu trên không phá thứ khác):**
- Độ trễ đăng nhập qua SSO (redirect → về app) ≤3 giây điều kiện bình thường.
- Số lần user phải gõ mật khẩu mỗi ngày (chính sách idle 15 phút là chủ đích — theo dõi phản ánh của user để cân nhắc lại nếu quá gắt).
- Số ticket liên quan mật khẩu/đăng nhập mỗi tháng (kỳ vọng giảm dần sau tháng đầu).

## 3. Non-goals — hệ thống này KHÔNG làm

1. **Không quản lý role nội bộ của từng app.** SSO chỉ trả lời "user thuộc group nào"; user là admin/viewer trong app là việc app tự định nghĩa từ claim `groups`.
2. **Không phải hệ thống nhân sự.** Chỉ giữ thông tin tối thiểu: mã nhân viên, họ tên, email, group, trạng thái. Không lương, hợp đồng, chấm công.
3. **Không phục vụ người ngoài công ty.** Không đăng ký tự do, không tài khoản đối tác/khách hàng.
4. **Không single-logout toàn cục.** Logout từng app riêng; muốn chấm dứt mọi phiên thì dùng self-service "đăng xuất phiên" hoặc admin khóa.
5. Không đồng bộ AD/LDAP, không federate Google Workspace — tự quản mật khẩu hoàn toàn (quyết định có chủ đích, xem nhật ký quyết định).

## 4. Người dùng & Vai trò

| Vai trò | Số lượng | Nhu cầu chính |
|---|---|---|
| **End-user** (nhân viên) | ~1000 | Một tài khoản (email công ty) dùng mọi app; trang chủ thấy app mình được vào; tự đổi mật khẩu |
| **SSA** — super admin | 2 (chính + phụ) | Toàn quyền: quản user/group/project/client/admin/settings; độc quyền khóa-xóa user toàn cục |
| **project_admin** | vài người, do SSA bổ nhiệm | Quản các project được phân công: tạo user, tạo group, gán/gỡ member, reset mật khẩu, xem audit — trong phạm vi project mình |
| **Dev tích hợp** | dev của 3–5 project | Nhận `client_id/secret` từ admin; đọc docs + demo tự tích hợp; không có tài khoản portal quản trị |

Quy trình con người (ai yêu cầu tạo user, ai duyệt, HR báo nghỉ việc qua kênh nào) xử lý **bên ngoài hệ thống** — hệ thống chỉ cung cấp công cụ thao tác.

## 5. Tính năng & Yêu cầu chức năng

> Các FR viết ở mức *yêu cầu* (hệ thống phải bảo đảm gì). Chi tiết cơ chế (thuật toán rate-limit, cách rotate khóa, transaction import...) thuộc bước Architecture — xem `addendum.md`.

### Luồng đăng nhập tổng quan (đọc trước F1)

Chỉ có **một** trang đăng nhập duy nhất, nằm trên chính SSO (`id.pmh.com.vn`). Không project nào tự làm trang login riêng — các app chỉ *đẩy* trình duyệt user sang trang login của SSO rồi nhận kết quả về. SSO portal là một ứng dụng gồm: trang login + Dashboard/Launcher (lưới project, FR-09) + self-service (FR-10) + docs (FR-33).

Có hai đường user đi vào, dùng chung một trang login:

**Kịch bản A — user vào cổng SSO trước:**
```
Mở id.pmh.com.vn ──(chưa đăng nhập)──▶ [Trang login SSO] ──(xong; SSA thêm MFA)──▶
[Dashboard/Launcher: lưới project được truy cập] ──(bấm 1 app)──▶ mở tab mới → vào app
   (app lấy token ngầm vì đã đăng nhập → vào thẳng, không gõ lại)
```

**Kịch bản B — user vào thẳng một app:**
```
Mở pmh.com.vn/projectA ──(app thấy chưa đăng nhập, tự đẩy sang SSO)──▶ [Trang login SSO] ──▶
SSO đẩy ngược về projectA ──▶ vào thẳng projectA   (KHÔNG qua Dashboard)
```

Điểm mấu chốt: "redirect qua SSO" là việc **app** làm (qua thư viện OIDC client), không phải một page login trung gian. Dashboard chỉ hiện khi user vào cổng SSO; vào thẳng app thì đi thẳng vào app.

### F1. Xác thực & phiên SSO

- **FR-01** User đăng nhập bằng email công ty + mật khẩu tại trang login của PMH ID; các app tích hợp qua chuẩn OIDC Authorization Code (redirect về PMH ID, nhận JWT).
- **FR-02** JWT chứa `sub` (id nội bộ — không phải email), `email`, `employee_code`, `full_name`, `groups[]`, `ver` (version cấu trúc claims). Đây là hợp đồng API với các project: thay đổi phá vỡ phải tăng `ver` và báo trước.
- **FR-03** Project xác minh JWT offline bằng public key (JWKS) — không gọi về PMH ID mỗi request; PMH ID sập thì user đã đăng nhập vẫn làm việc tiếp đến khi token hết hạn.
- **FR-04** Phiên: access token ngắn (mặc định 5 phút); **idle timeout 15 phút bám vào phiên SSO thật** — đồng hồ idle chỉ reset khi user có tương tác thật tại PMH ID, KHÔNG reset bởi việc app tự làm mới token ngầm ở nền. **Refresh token trói vào phiên:** mỗi lần app dùng refresh token để xin access token mới, hệ thống kiểm phiên còn hợp lệ (chưa quá idle 15' / cap 12h) — hết phiên thì refresh bị từ chối, user đăng nhập lại. Nhờ vậy tab để mở tự refresh ngầm cũng KHÔNG kéo phiên sống bất tận. Thêm giới hạn tuyệt đối cho phiên (mặc định 12h). Không có "remember me"; đóng trình duyệt là hết phiên SSO.
- **FR-05** Thu hồi truy cập, phân theo thẩm quyền:
  - **SSA khóa/xóa user** hoặc bấm "hủy toàn bộ phiên" → hủy mọi phiên + refresh token của user trên **tất cả** app (kill switch toàn cục).
  - **project_admin reset mật khẩu / gỡ user khỏi group** → chỉ hủy phiên + refresh token của user trên **các client thuộc project mình** (không đụng app của project khác).
  - **User tự đổi mật khẩu** → hủy các phiên khác của chính họ, giữ phiên hiện tại.
  - Trong mọi trường hợp user văng khỏi app liên quan trong ≤5 phút (đời còn lại của access token) — tức thì nếu app có webhook (FR-28).
- **FR-06** Logout: từng app riêng; PMH ID có endpoint logout chấm dứt phiên SSO.
- **FR-07** **MFA bắt buộc cho tài khoản SSA** (bật ngay từ đầu — SSA là bề mặt tấn công cao nhất, chiếm được là chiếm cả công ty). Dùng TOTP (authenticator app), không dùng OTP email để không biến SMTP thành điểm chết của bậc auth cao nhất. Mỗi SSA nhận **recovery code in ra giấy cất két**, kèm một **tài khoản break-glass offline** (không MFA, mật khẩu dài cất két riêng) để cứu khi cả hai SSA mất thiết bị. *MFA cho project_admin và user thường: chưa bắt buộc, để phase sau.*
- **FR-08** **Chống dò mật khẩu (brute-force/spraying):** đăng nhập sai nhiều lần phải bị làm chậm/chặn dần; cơ chế phải chặn được cả kiểu "một mật khẩu thử lên nhiều email" mà **không** cho phép kẻ tấn công khóa cứng tài khoản người thật (đặc biệt: tài khoản SSA không bao giờ bị khóa bởi tác nhân ngoài). Thuật toán cụ thể (backoff, giới hạn theo IP, CAPTCHA khi cần) chốt ở Architecture dựa trên metric quan sát được — không cố định trong PRD.

### F2. Trang chủ Launcher & self-service

- **FR-09** Sau đăng nhập, trang chủ hiển thị **lưới các app user được truy cập** (user thuộc ít nhất một group đã gán cho client của app đó); bấm vào mở app ở tab mới theo `app_url` của client.
- **FR-10** Self-service: user tự đổi mật khẩu (với checklist trực quan theo policy), xem mình thuộc group nào, xem danh sách phiên đang đăng nhập và đăng xuất phiên bất kỳ.
- **FR-11** Quên mật khẩu: user tự yêu cầu → hệ thống gửi mật khẩu tạm (FR-15) qua email. Endpoint này cũng chịu chống lạm dụng theo FR-08 và trả thông báo đồng nhất (không tiết lộ email có tồn tại hay không).

### F3. Quản lý user

- **FR-12** Tạo user: SSA và project_admin đều tạo được (họ tên, email công ty — duy nhất, mã nhân viên — duy nhất). Hệ thống chặn trùng: nếu email/mã NV đã tồn tại (kể cả bản ghi đã bị vô hiệu — xem FR-17), báo rõ và gợi ý **kích hoạt lại** user cũ thay vì tạo mới.
- **FR-13** Import CSV theo template (`employee_code,email,full_name,groups`): upload → màn hình preview báo lỗi từng dòng (trùng với DB, **trùng nhau trong cùng file**, sai định dạng, group chưa tồn tại — tick "tự tạo group") → xác nhận → tạo từng dòng, báo cáo tạo/bỏ qua/lỗi cuối cùng; gửi email mật khẩu tạm (FR-15) tách rời khỏi việc tạo user (một user tạo thành công không được rớt vì email nghẽn).
- **FR-14** Export CSV: lọc theo group/trạng thái rồi xuất; project_admin chỉ xuất được user trong phạm vi mình quản.
- **FR-15** **Mật khẩu tạm** (định nghĩa dùng chung cho: user mới, quên mật khẩu, admin cấp lại): gửi qua email, hạn hiệu lực mặc định 24h (cấu hình trong Settings, FR-32), bắt buộc đổi ở lần đăng nhập kế tiếp.
- **FR-16** Reset mật khẩu: admin đặt tay, hoặc tick "cấp mật khẩu tạm gửi email" (FR-15). project_admin chỉ reset được user thuộc project mình, và chỉ hủy phiên trong phạm vi project mình (theo FR-05).
- **FR-17** **Vòng đời user (soft-delete):** user có trạng thái `active | locked | deleted`; "xóa" là đánh dấu `deleted` (giữ bản ghi + lịch sử, không xóa cứng). **Khóa/xóa toàn cục: chỉ SSA.** Nhân viên nghỉ rồi quay lại → **kích hoạt lại chính bản ghi cũ** (cập nhật mã NV theo ngày vào mới nếu cần), không tạo bản ghi trùng email. Email/mã NV của bản ghi đã `deleted` không bị tái dùng để tạo user mới khác người.
- **FR-18** Tài khoản có hạn (`expires_at`) cho nhân viên thời vụ/thử việc — quá hạn tự khóa; hệ thống gửi email cảnh báo trước khi hết hạn.

### F4. Group & quyền truy cập

- **FR-19** Group là toàn cục, một user thuộc nhiều group. SSA và project_admin đều tạo được group mới. *(Group chỉ có ý nghĩa truy cập khi được gán cho một client — FR-21; không có khái niệm "group thuộc project" tách rời.)*
- **FR-20** Gán/gỡ user vào group: SSA với mọi group; project_admin với group **đang được gán cho client trong project mình**. "User thuộc project P" = user nằm trong một group nào đó đã gán cho một client của P. (Group dùng chung nhiều project → admin các project đó đều sửa được member — chấp nhận, audit ghi lại, SSA phân xử.)
- **FR-21** **Gán group cho client** (bảng `client_groups` — nguồn sự thật duy nhất của quyền truy cập): quyết định group nào đăng nhập được client/app nào; có nút **"gán tất cả group"** (`allow_all_groups`) để mở nhanh. Khi tạo group mới, nếu có client đang bật `allow_all_groups`, hệ thống cảnh báo "N client sẽ tự động thấy group này" và ghi audit.

### F5. Quản lý project & client

- **FR-22** **Chỉ SSA tạo project** (khớp FR-25 — SSA phân công project cho project_admin); dưới mỗi project tạo nhiều client theo môi trường (dev/prod) — mỗi client gồm `client_id`, `client_secret`, `redirect_uris`, `app_url`. project_admin quản trị client trong các project được phân công.
- **FR-23** `client_secret` chỉ hiển thị **một lần** khi tạo; admin copy và giao trực tiếp cho dev qua kênh riêng tư. Dev không tự đăng ký — admin cấp phát toàn bộ.
- **FR-24** Client: **rotate secret có ân hạn** (secret cũ còn hiệu lực một khoảng cấu hình được để app prod đổi không gián đoạn), kèm nút **thu hồi ngay** cho trường hợp lộ; **disable client** (chặn cấp token mới) bất kỳ lúc nào.
- **FR-25** Bổ nhiệm project_admin: SSA gán user vào vai project_admin kèm danh sách project phụ trách.

### F6. Directory API & Webhook (cho project tích hợp)

- **FR-26** Directory API: project dùng client-credentials lấy token gọi `GET /api/v1/users`, `GET /api/v1/users/:id`, `GET /api/v1/groups` — **chỉ thấy user thuộc group đã gán cho client đó**; không bao giờ trả dữ liệu mật khẩu. **Hợp đồng v1 tối thiểu** mỗi user gồm: `id`, `employee_code`, `email`, `full_name`, `groups[]`, `status`. User `deleted` mặc định ẩn, có tham số `include_deleted` để app đối soát offboarding. Mở rộng field theo nhu cầu project thật (Câu hỏi mở). Điển hình: app Quản lý tài sản lấy danh bạ để gán tài sản cho nhân viên chưa từng đăng nhập app.
- **FR-27** `GET /api/v1/events?since=<event_id>` — polling sự kiện user thay đổi, dự phòng cho project không làm webhook. `event_id` tăng dần, trả theo thứ tự tăng, sự kiện lưu 90 ngày; client quay lại với cursor quá cũ phải nhận tín hiệu "cần resync toàn bộ" chứ không bị mất event âm thầm.
- **FR-28** Webhook (**tùy chọn** — project cần mới đăng ký): PMH ID chủ động POST sự kiện `user.locked`, `user.unlocked`, `user.deleted`, `user.password_changed`, `user.groups_changed` về `webhook_url` của client, ký HMAC-SHA256, retry giãn dần. `webhook_url` chỉ được trỏ tới dải mạng nội bộ hợp lệ (egress có allowlist — chi tiết ở Architecture). Project không làm webhook vẫn an toàn nhờ lưới đỡ FR-05.

### F7. Audit log & cấu hình

- **FR-29** Ghi audit mọi sự kiện đăng nhập (thành công/thất bại) và mọi thao tác quản trị (ai, làm gì, lên đối tượng nào, lúc nào, từ IP nào).
- **FR-30** Xem audit: SSA xem tất; project_admin xem trong phạm vi project mình quản. **Cơ chế:** mỗi bản ghi audit gắn `project_id` (sự kiện liên quan project/client/group-của-project nào); project_admin lọc theo các project được phân công. Sự kiện toàn cục (không thuộc project nào, `project_id` NULL — vd đổi settings, quản admin) chỉ SSA xem. Sự kiện lên group dùng chung nhiều project ghi nhiều bản ghi hoặc gắn project theo ngữ cảnh thao tác.
- **FR-31** Log giữ online 1 năm; cũ hơn tự nén theo tháng vào thư mục lưu trữ; portal có mục "Xem lưu trữ" — chọn file tháng là hệ thống giải nén hiển thị, không thao tác tay.
- **FR-32** Trang Settings (chỉ SSA), gồm đúng các nhóm: TTL token, thời gian idle, policy mật khẩu (độ dài/độ phức tạp/chu kỳ đổi), hạn mật khẩu tạm, path backup, **SMTP host/port** (credentials SMTP nằm ở `.env`, không ở Settings — bí mật không lưu DB), tham số chống dò mật khẩu.

### F8. Cổng tài liệu cho dev

- **FR-33** Trang docs tích hợp tại `id.pmh.com.vn/docs`, đặt sau đăng nhập, **chỉ user thuộc group "Developers"** truy cập được.
- **FR-34** Nội dung: hướng dẫn tích hợp OIDC từng bước, mô tả JWT claims + version, Directory API, webhook, kèm **app demo mẫu** để dev copy — chuẩn đầu ra là mục tiêu G4 (tự tích hợp ≤1 ngày).

## 6. Yêu cầu phi chức năng

**Bảo mật** (hệ thống ra internet public — nhân viên làm việc từ xa; đằng sau firewall công ty):
- Mật khẩu hash Argon2; `client_secret` cũng hash — không lưu bản rõ ở đâu.
- Policy mật khẩu: ≥8 ký tự đủ 4 loại (hoa/thường/số/đặc biệt), checklist trực quan khi đặt; **bắt đổi mỗi 90 ngày** (xem lý do tại mục 9); mật khẩu tạm theo FR-15. Mọi con số nằm trong Settings, đổi không cần sửa code.
- **MFA cho SSA (FR-07)** và **chống dò mật khẩu (FR-08)** là yêu cầu bảo mật cốt lõi — xem chi tiết ở phần Tính năng.
- **Khóa ký JWT phải rotate được, và hệ thống phải sống sót khi khóa ký bị lộ.** Vì project verify offline nên không thu hồi được token đã cấp; do đó khóa phải có `kid`, phát nhiều khóa qua JWKS với cửa sổ chồng lấn, và có quy trình rút khóa lộ + ép project làm mới JWKS nhanh. Access token ngắn (5 phút) chính là công cụ giới hạn thiệt hại khi lộ khóa, không chỉ để tối ưu. *(Ưu tiên dùng cơ chế rotate sẵn có của thư viện OIDC trước khi tự viết — kiểm ở Architecture.)*
- HTTPS bắt buộc; cookie `Secure + HttpOnly + SameSite`; JWT ký RS256, public key qua JWKS.

**Hiệu năng & quy mô:** ~1000 user, 3–5 app đợt đầu; hệ thống một server chịu thoải mái; đăng nhập ≤3 giây.

**Độ sẵn sàng & vận hành (rủi ro lớn nhất của dự án — 2 người vận hành):**
- PMH ID sập → không đăng nhập mới được (single point of failure đã chấp nhận). Vì idle 15 phút, khi SSO sập cả công ty mất khả năng đăng nhập lại trong thời gian ngắn — do đó **mất auth phải có cảnh báo chủ động đánh thức người trực**, không chỉ có endpoint `/health` thụ động.
- **Backup + restore phải phục hồi được thật:** pg_dump Postgres tự động mỗi đêm, giữ 30 bản, đổ vào path cấu hình ở **ổ/máy khác**; backup config + khóa ký JWT mỗi khi thay đổi. Đường dẫn/thông tin cần để restore **không được chỉ nằm trong DB** (DB chết thì đọc ở đâu). Script restore phải được **diễn tập định kỳ**, không chỉ một lần trước golive. Khôi phục ≤4 giờ.
- **Break-glass (FR-07)** và kế hoạch khi một trong hai SSA vắng mặt là một phần của vận hành, không phải tùy chọn.
- Hạ tầng: on-premise, Docker Compose, sau firewall công ty.

## 7. Lộ trình

| Phase | Nội dung | Kết quả nghiệm thu |
|---|---|---|
| **1 — Lõi SSO** | Skeleton monorepo + Docker Compose (Postgres, Mailpit); OIDC provider + JWT/JWKS (có `kid` + rotate được), login/logout, phiên theo FR-04; **MFA cho SSA (FR-07)**; **chống dò mật khẩu (FR-08)**; **cảnh báo mất auth + backup/restore diễn tập được** | 1 app demo đăng nhập được qua PMH ID; SSA đăng nhập có MFA; mất auth thì có cảnh báo |
| **2 — Portal** | Launcher + self-service (F2), quản lý user/group/project/client (F3–F5, gồm soft-delete FR-17 và mô hình `client_groups` FR-21), audit (F7), phân quyền SSA/project_admin | SSA vận hành được toàn bộ vòng đời user không cần đụng DB |
| **3 — Tích hợp** | Directory API + webhook (F6, gồm egress allowlist + resync cursor), docs + demo (F8), backup tự động hoàn chỉnh. *Directory API có thể kéo lên Phase 2 nếu project đầu tiên cần danh bạ sớm.* | Project thật đầu tiên (trong 3–5 project năm nay) tích hợp xong ≤1 ngày công dev |
| **Sau** | Bật MFA cho project_admin/user thường; cân nhắc single-logout nếu phát sinh nhu cầu thật | — |

> **Ghi chú Architecture (không thuộc PRD, để bước sau quyết chi tiết):** thuật toán chống dò mật khẩu (backoff/IP/CAPTCHA) chốt theo metric thật; rotate `client_secret` có ân hạn (model nhiều secret song song); webhook egress allowlist theo dải CIDR nội bộ; events feed trả tín hiệu resync khi cursor quá hạn; CSV import commit theo dòng + hàng đợi email; lưu thời gian ở UTC. Nhiều mục trong số này có thể tận dụng cơ chế sẵn có của `node-oidc-provider` — kiểm tra trước khi tự viết.

## 8. Câu hỏi mở

- [ ] Field chi tiết Directory API trả về những gì ngoài mã NV/tên/email/groups — chờ dev project thật nêu nhu cầu (chủ dự án không kiểm soát tiến độ các project đó).
- [ ] Danh sách 3–5 project cụ thể của năm nay và thứ tự tích hợp.

## 9. Nhật ký quyết định

Toàn bộ quyết định lớn, lý do và các phương án đã loại được ghi tại `BRAINSTORMING.md` mục 11 (roundtable 2026-07-04) và `.memlog.md` trong thư mục PRD này — mỗi quyết định đã được nêu tại đúng mục sử dụng trong PRD, phần này chỉ là con trỏ.

Trade-off và quyết định ghi nhận thêm từ hai vòng review PRD (Code Review Crew + Anti-Consensus Club, 2026-07-04):
- **Bắt đổi mật khẩu 90 ngày** trái khuyến nghị NIST hiện hành — chủ dự án đã cân nhắc và giữ; chu kỳ nằm trong Settings.
- **Mật khẩu tạm gửi qua email** — chấp nhận ở quy mô nội bộ vì chỉ sống 24h và bắt đổi ngay.
- **MFA chỉ cho SSA** (FR-07), không bắt buộc cho 1000 user thường — cân bằng bảo mật/ma sát ở quy mô nội bộ; kèm recovery code in giấy + tài khoản break-glass offline để không tự khóa mình.
- **Nhân viên nghỉ rồi quay lại:** kích hoạt lại bản ghi soft-deleted (FR-17), không tạo trùng — hợp với thực tế môi giới bất động sản ra/vào.
- **Chống dò mật khẩu & rotate khóa viết ở mức yêu cầu, chi tiết để Architecture:** Anti-Consensus chỉ ra "rate-limit 3 lớp / chống DNS-rebinding / velocity theo ASN" là mức độ của hệ thống tầm Okta, chưa chứng minh cần cho 1000 user nội bộ — PRD chỉ giữ *yêu cầu* (phải chống được, không tự gây DoS), số lớp và thuật toán quyết theo metric thật.
- **Public ra internet là bắt buộc** vì có nhân viên làm việc từ xa — không thể đặt SSO nội bộ thuần (luồng OIDC cần trình duyệt user với tới trang login). Đã có firewall công ty; cân nhắc thêm WAF/CDN ở biên là tùy chọn triển khai.
- **Ưu tiên vận hành:** rủi ro lớn nhất là bus-factor 2 người, không phải tấn công tinh vi — vì vậy cảnh báo mất-auth + restore diễn tập được kéo lên Phase 1.
