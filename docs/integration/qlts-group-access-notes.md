# Ghi chú QLTS — Gate truy cập theo group & cách làm "0 giây"

> Note nội bộ của QLTS (không phải hợp đồng PMH ID). Ghi 2026-07-11 để nhớ.
> Liên quan `README.md` mục 2 (access_denied), mục 5 (`/api/v1/groups`), mục 6 (webhook).

## Bối cảnh
QLTS story 10.2 thêm **gate access theo group ở phía QLTS**: chỉ user thuộc group được cấp cho client QLTS mới vào được. Danh sách group được phép lấy động từ `GET /api/v1/groups` (M2M), lưu vào `config.authorized_groups`, refresh qua directory-sync (định kỳ ~60' hoặc bấm "Đồng bộ ngay").

**Vấn đề độ trễ:** khi PMH admin **thêm 1 group mới** vào client QLTS, user thuộc group đó chỉ vào được **sau khi directory-sync chạy lại** (≤60'). Muốn hiệu lực **tức thì (0 giây)** thì cần một trong các cách dưới.

## PHÁT HIỆN QUAN TRỌNG (cần xác minh với admin PMH ID)
Theo README mục 2 + FAQ: **PMH ID vốn ĐÃ gác cửa theo group** — user không thuộc group nào được cấp cho client → PMH ID trả `?error=access_denied` **ngay ở callback, KHÔNG cấp token** — **TRỪ KHI** client bật cờ **`allow_all_groups`** ("app cho mọi nhân viên").

→ Suy ra: tài khoản `ssa@pmh.com.vn` (`groups=[]`) từng **login QLTS thành công** (08/07) ⇒ **rất có thể client QLTS đang bật `allow_all_groups`** (nếu tắt, PMH ID đã chặn từ cửa). 

**Việc cần làm:** hỏi admin PMH ID xác minh cờ `allow_all_groups` của client QLTS.
- Nếu chính sách là "chỉ group Developers được vào" → **tắt `allow_all_groups`** + chỉ gán group Developers cho client. Khi đó **PMH ID chặn ngay tại cửa** (access_denied), gate phía QLTS (10.2) chỉ còn là lớp phòng thủ thứ 2 (defense-in-depth).
- Nếu vẫn muốn "mọi nhân viên vào được" → giữ `allow_all_groups`, và gate QLTS (10.2) là nơi thực thi chính sách group.

## QUAN TRỌNG — webhook KHÔNG thay được fetch cho danh sách group-được-phép
Webhook PMH ID chỉ có sự kiện **cấp-user**: `user.locked/unlocked/deleted/password_changed/user.groups_changed`. **KHÔNG có** sự kiện cấp-client kiểu "client được gán thêm/bớt group".
- Khi admin **gán thêm 1 group cho client QLTS** (thay đổi cấp *client*) → **không webhook nào bắn**. Cách duy nhất QLTS biết là **hỏi lại `GET /api/v1/groups`** (= fetch/directory-sync). → Đây là lý do BẮT BUỘC dùng fetch cho `authorized_groups`.
- `user.groups_changed` chỉ bắn khi MỘT user đổi group — gate KHÔNG cần cái này (lúc user login, token đã mang group mới nhất).

## Cách làm "0 giây" (khi thêm group mới có hiệu lực tức thì) — CHỈ fetch mới giải quyết
1. **[Khuyến nghị — lazy self-heal ở login] `fetchGroups()` tại ranh giới bị-chặn.** Trong callback, nếu token user mang group CHƯA có trong `authorized_groups` cache → gọi `fetchGroups()` **tươi một lần** kiểm tra group đó có mới được cấp không, TRƯỚC khi từ chối. Chỉ tốn 1 call M2M đúng lúc sắp chặn (hiếm), user hợp lệ vào ngay dù chưa tới chu kỳ sync. Nhược: thêm latency ở login bị-chặn; cache kết quả ngắn (vd 30–60s) để kẻ dò không ép gọi M2M liên tục.
2. **[Thô] Giảm `directory_sync_interval_minutes`** (60' → 10'). Đơn giản, vẫn có trễ + tăng tải M2M.

Webhook `user.groups_changed` vẫn đáng làm cho việc KHÁC (giữ status/groups từng user tươi thời gian thực → offboarding), nhưng KHÔNG phải cho refresh danh sách group-được-phép.

## Logout + user bị xóa/gỡ group → "Đăng nhập bằng tài khoản khác" (2026-07-11)
- QLTS logout = **local** (không `end_session`) → phiên SSO PMH ID còn sống → bấm Đăng nhập lại vào **thẳng** (silent). Đúng thiết kế (README 4.5).
- Nếu user **bị xóa/khóa/gỡ group** ở SSO: bấm Đăng nhập → PMH ID silent re-auth ra **`?error=access_denied`** → QLTS callback bắt riêng (KHÔNG gộp vào "thử lại") → redirect `/?login=forbidden`.
- **Phát hiện ở callback, KHÔNG ở logout** (lúc logout chưa biết tương lai; gỡ group cấp-client không có webhook). Trang `?login=forbidden` là "bộ lọc": chỉ user thật sự kẹt mới thấy nút **"Đăng nhập bằng tài khoản khác"** (`GET /api/auth/switch-account` → `end_session` PMH ID + `id_token_hint` nếu còn phiên → về app_url → auto-SSO → **form login**). User bình thường không thấy nút này.
- Đồng hồ: access token ~5' (refresh ngầm) vs **phiên SSO idle 15'** — chỉ idle 15' toàn bộ (không đụng app nào, kể cả QLHS) mới phải nhập lại; còn dùng app khác thì QLTS vào lại luôn.

## Chốt khuyến nghị
- Danh sách group-được-phép: **fetch (directory-sync)** là đúng và bắt buộc — webhook không thay được.
- Cần 0 giây cho group mới: làm **lazy self-heal (cách 1)**.
- **Xác minh phía PMH ID (2 việc):** (a) group được gán đúng cho **client `project-qlts`** chưa (2026-07-11: UI thấy Developers+Kế toán nhưng `GET /api/v1/groups` chỉ trả Developers → nghi Kế toán gán nhầm client, hoặc chưa áp); (b) cờ `allow_all_groups` của client — quyết định PMH ID có gác cửa hay không (gate QLTS là lớp chính hay phụ).
