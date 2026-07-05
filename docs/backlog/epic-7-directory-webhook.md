# Epic 7 — Directory API, webhook, events

**Phase:** 3
**Mục tiêu:** Cung cấp cho project ngoài cách lấy danh bạ (Directory API) và nhận thay đổi user (webhook/events) — phần biến PMH ID thành nền dùng chung thật sự.
**Tham chiếu chính:** FR-26..28, AD-11, AD-13, AD-14.

---

### [E7-S1] Directory API
- **Story:** Là app project, cần lấy danh bạ user để làm nghiệp vụ (vd gán tài sản cho người chưa từng đăng nhập).
- **Tiêu chí nghiệm thu:**
  - `GET /api/v1/users`, `/users/:id`, `/groups` — client-credentials (client_secret).
  - **Scope theo `client_groups`** của client; chỉ thấy user thuộc group được cấp; không bao giờ trả mật khẩu.
  - Trả tối thiểu `{id, employee_code, email, full_name, groups[], status}`; `?include_deleted=true` để đối soát.
  - **Rate-limit + audit truy vấn lớn** (một secret rò không dump trọn 1000 PII im lặng).
  - `allow_all_groups` KHÔNG nới scope đọc ở đây.
- **Tham chiếu:** FR-26, AD-11 | **Phụ thuộc:** E1-S1, E5-S3 | **Ước lượng:** M

### [E7-S2] Events feed (polling)
- **Story:** Là app project không làm webhook, cần cách đồng bộ thay đổi user định kỳ.
- **Tiêu chí nghiệm thu:**
  - `GET /api/v1/events?since=<event_id>` từ bảng `user_events`; `event_id` tăng dần, trả theo thứ tự tăng, giữ 90 ngày.
  - Cursor quá 90 ngày → **410 Gone** + cờ `full_resync_required`, không trả 200 rỗng.
  - Sự kiện phát ra khi user thay đổi (locked/unlocked/deleted/password_changed/groups_changed).
- **Tham chiếu:** FR-27, AD-13 | **Phụ thuộc:** E4-S2 | **Ước lượng:** M

### [E7-S3] Webhook (tùy chọn)
- **Story:** Là app project cần đá user tức thì, cần nhận sự kiện đẩy chủ động.
- **Tiêu chí nghiệm thu:**
  - POST sự kiện về `webhook_url` client, ký **HMAC-SHA256** bằng `webhook_secret` (lưu `webhook_secret_enc` — KEK).
  - Retry giãn dần qua `webhook_deliveries`; worker `FOR UPDATE SKIP LOCKED` + `locked_at`.
  - Egress: chỉ `https` + chặn dải private + allowlist CIDR nội bộ (pin-IP/anti-rebinding hoãn — Deferred).
  - Gồm `user.deleted`; project không làm webhook vẫn an toàn nhờ lưới đỡ FR-05.
- **Tham chiếu:** FR-28, AD-14, AD-13 | **Phụ thuộc:** E7-S2 | **Ước lượng:** M
