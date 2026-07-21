# PMH ID — Onboarding project mới

Quy trình đưa **một project mới** vào PMH ID (và EDGE nếu cần). Dùng lại mỗi lần có
app mới: điền **Phiếu 1** gửi admin PMH ID → nhận lại **Phiếu 2**.

> ⚠️ **KHI ĐỌC FILE NÀY, ĐỪNG TỰ ĐIỀN THAY.** Mỗi ô trong Phiếu 1 phải **hỏi lại
> người yêu cầu tích hợp (chủ nghiệp vụ / PM của app) TỪNG CÂU để CHỐT** — đọc to
> câu hỏi ở cột "Hỏi để chốt", ghi đúng câu trả lời của họ. Đoán sai một ô (nhất là
> `redirect_uris` và **nhóm được phép**) là login gãy hoặc lộ quyền chéo project.

---

## Phiếu 1 — Đăng ký client (project → gửi admin PMH ID)

| # | Mục | Hỏi để chốt | Giá trị họ chốt |
|---|---|---|---|
| 1 | Tên project + môi trường | "Tên app hiển thị? Đăng ký **dev** hay **prod**? (mỗi môi trường xin client riêng)" | |
| 2 | `redirect_uris` | "URL callback nhận `?code=` là gì? Liệt kê **đủ** mọi URL, kể cả localhost khi test" | |
| 3 | `app_url` | "URL để hiện tile trên Dashboard PMH ID?" | |
| 4 | **Nhóm được đăng nhập** | "**Những nhóm nào** được phép vào app này? (không gán = KHÔNG ai login được)" | |
| 5 | Directory API? | "Có cần **kéo danh bạ** user (M2M) không? Nếu có, để lấy danh sách phục vụ việc gì?" | |
| 6 | Webhook? | "Có cần **nhận sự kiện tức thì** khi user bị khóa/xóa/đổi nhóm không? Nếu có, `webhook_url` (**https**) là gì?" | |
| 7 | Back-Channel Logout? | "Khi user logout toàn hệ, có cần PMH ID **đá user khỏi app này ngay** không? Nếu có, `backchannel_logout_uri` (**https**)?" | |
| 8 | Vị trí host | "App **host ở đâu?** — hạ tầng/domain riêng, hay chạy **sau EDGE chung** dưới `*.pmh.com.vn`?" *(quyết định có sửa EDGE — xem §Mình xử lý)* | |
| 9 | IP host webhook/BCL | *(chỉ hỏi nếu mục 6/7 có VÀ host là on-prem/nội bộ)* "Dải IP nào PMH ID sẽ gọi tới?" | |
| 10 | Người phụ trách | "Ai là đầu mối kỹ thuật để xoay secret khi lộ?" | |

## Phiếu 2 — Bàn giao (admin PMH ID → trả project)

| # | Trả về | Ghi chú |
|---|---|---|
| 1 | `client_id` + `client_secret` | **Secret hiện MỘT LẦN**, lưu hash — mất phải rotate. Giữ kỹ, đừng commit |
| 2 | `webhook_secret` *(nếu bật webhook)* | Cũng **một lần** — dùng verify HMAC chữ ký |
| 3 | Discovery URL | `https://id.pmh.com.vn/oidc/.well-known/openid-configuration` — chỉ cần cái này, thư viện tự suy phần còn lại |
| 4 | Xác nhận nhóm đã gán | Để project biết user nào login được |
| 5 | Tài liệu | [`README.md`](./README.md) (cách code) + [`../architecture/edge-va-luong-hoat-dong.md`](../architecture/edge-va-luong-hoat-dong.md) (hiểu EDGE) |

---

## Mình (admin PMH ID) xử lý gì

### Trên PMH ID — làm qua Portal, KHÔNG deploy lại
1. Tạo **Project** → tạo **Client** (nhập `redirect_uris`, `app_url`) → nhận secret bàn giao.
2. **Gán `client_groups`** đúng các nhóm ở Phiếu 1 mục 4 *(bước hay quên → app báo `access_denied`)*.
3. Nếu webhook: **Cấu hình webhook** → nhận `webhook_secret` bàn giao.
4. Nếu BCL: điền **`backchannel_logout_uri`**.
5. `client_id` **không** được trùng `pmh-portal` / `demo-app` (bị chặn cứng).

### Trên EDGE — tùy vị trí host (Phiếu 1 mục 8)

**A. Host ở nơi khác (domain/hạ tầng riêng):** EDGE **không sửa gì**. App gọi OIDC qua
internet; webhook host là IP public → egress allowlist mặc định đã cho qua.

**B. Host sau EDGE chung (được cấp `<ten>.pmh.com.vn`):**
1. Thêm **server block / route** trong config EDGE cho `Host: <ten>.pmh.com.vn` → backend họ. Cert wildcard `*.pmh.com.vn` đã phủ — **không cần cert mới**.
2. Thêm **network alias** `<ten>.pmh.com.vn` trên mạng `edge` → sso-server gọi webhook/BCL đi vòng trong máy.
3. Host webhook giờ là **IP nội bộ** → thêm dải đó vào setting **`webhook_allowlist_cidr`**, nếu không `assertEgressAllowed` chặn (coi là SSRF).

---

**Chốt 1 dòng:** project ngoài chỉ cần *client_id/secret + Discovery URL*; EDGE chỉ
đụng khi họ nằm **chung nhà** dưới `*.pmh.com.vn`.
