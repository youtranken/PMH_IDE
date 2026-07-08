# Bài học kinh nghiệm — PMH ID (SSO/OIDC)

> Đúc kết từ các lỗi/lỗ hổng thật đã gặp và cách xử lý. Mỗi bài: **hiện tượng → gốc rễ → luật rút ra**. Đọc trước khi đụng vào luồng auth hoặc onboard app mới.

---

## 1. Gác cửa phân quyền phải đặt ở nơi MỌI đường đi qua — không chỉ một đường

**Hiện tượng:** SSA (không thuộc group `Developers` của QLTS) vẫn đăng nhập được vào QLTS và nhận `code` hợp lệ.

**Gốc rễ:** Cổng phân quyền `isAllowedForClient` chỉ được gọi ở bước **nhập mật khẩu** (`interaction.controller.ts`). Nhưng khi user đã có **phiên SSO** (vd đăng nhập Portal — client tĩnh, ai cũng vào), lần bấm sang app khác, oidc-provider thấy phiên còn sống → cấp token thẳng qua `loadExistingGrant`, **không chạy lại interaction** → cổng bị bỏ qua.

**Luật:** Với hệ nhiều đường vào (login mới **và** dùng lại phiên SSO), phải enforce authz ở **chốt chặn chung** mà cả hai đường đều đi qua. Ở oidc-provider đó là `loadExistingGrant` (chạy cho cả hai). Cổng ở tầng interaction chỉ là **một lớp**, không phải lớp duy nhất.
→ Fix: thêm kiểm tra `isClientLoginAllowed` trong `loadExistingGrant`, ném `errors.AccessDenied` nếu user không thuộc group được cấp. Xem `oidc/provider.factory.ts`.

## 2. Xác thực ≠ Phân quyền. Phiên SSO chung KHÔNG có nghĩa vào được mọi app

**Luật:** "Đăng nhập được vào PMH ID" (authentication — *bạn là ai*) khác hẳn "được vào app X" (authorization — *bạn được vào đâu*). Mỗi app phải gác cửa theo group riêng của nó. Đừng bao giờ suy "đã có phiên SSO ⇒ được cấp token cho client bất kỳ".

## 3. Một nguồn sự thật cho mỗi kiểm tra bảo mật — 2 bản copy = lỗ hổng chờ ngày lệch

**Hiện tượng (rủi ro):** cùng một luật phân quyền viết SQL ở 2 nơi (interaction + grant) → sửa một chỗ quên chỗ kia → hai đường cho kết quả khác nhau.

**Luật:** Tách logic bảo mật thành **một hàm dùng chung**, mọi nơi gọi vào đó. Ở đây: `isClientLoginAllowed(pool, userId, clientId)` trong `login.service.ts`, dùng bởi cả controller lẫn provider factory.

## 4. Đăng xuất thật phải kết thúc phiên SSO ở IdP — không chỉ xóa token local

**Hiện tượng:** Đăng xuất ở app (hoặc portal) nhưng lần sau vào lại **tự đăng nhập lại ngay** user cũ, không hỏi.

**Gốc rễ:** Chỉ xóa token phía client, **không** gọi endpoint `end_session` của IdP → phiên SSO còn sống → provider tự cấp token lại.

**Luật:** Nút Đăng xuất phải đẩy user qua `/oidc/logout` (end_session) để hủy phiên SSO. Nhờ `expiresWithSession`, refresh token mọi app trói theo phiên cũng chết → single-logout. Đừng tự xóa Session bằng tay (dễ vỡ) — dùng đúng endpoint thư viện.

## 5. RP-initiated logout: luôn kèm `id_token_hint` và khai `post_logout_redirect_uris`

**Hiện tượng:** App gọi `/oidc/logout?post_logout_redirect_uri=...&client_id=...` → trang lỗi "not registered", phiên SSO không bị hủy.

**Gốc rễ kép:**
- Client (DB) **chưa khai** `post_logout_redirect_uris` → provider từ chối địa chỉ quay-về. (Fix: suy từ `app_url` trong `pg-adapter.ts`.)
- App **không gửi** `id_token_hint` → provider phải hiện trang xác nhận (đường dự phòng dễ vỡ).

**Luật:**
- Phía IdP: mọi client phải có `post_logout_redirect_uris`. `post_logout_redirect_uri` app gửi phải **khớp Y HỆT** (kể cả dấu `/` cuối) — so khớp chuỗi tuyệt đối.
- Phía app: luôn gửi `id_token_hint` (lưu `id_token` lúc login). Để thư viện dựng URL bằng `buildEndSessionUrl` — **không tự ghép tay**.

## 6. Không tự code phần OIDC — xoay refresh token là cạm bẫy đá user oan

**Luật:** `rotateRefreshToken` + phát hiện replay: app **tái sử dụng** refresh token cũ → IdP thu hồi **cả grant** (đá user mọi nơi). Thư viện chứng nhận (`openid-client`, `jose`) tự lưu token mới, chọn khóa theo `kid`, verify offline đúng. Tự ghép URL / tự gọi `/token` bằng tay là nguồn của phần lớn lỗi tích hợp. Lỗi logout của QLTS chính là do tự chế URL.

## 7. Không để ngõ cụt UI — màn lỗi phải có đường thoát

**Hiện tượng:** Màn "Phiên đăng nhập đã hết hạn" là ngõ cụt; refresh vẫn kẹt vì URL còn trỏ interaction cũ đã chết.

**Luật:** Mọi màn lỗi phục hồi được phải có nút đưa về trạng thái sạch (vd nút "Đăng nhập lại" → `/` để khởi tạo phiên mới). Kèm cơ chế chống vòng lặp (xem `LoginLoopError` trong `App.tsx`).

## 8. Xác minh bảo mật bằng test đối kháng THẬT — cả hai chiều

**Luật:** "Typecheck xanh" và "chạy được" **không** chứng minh đã vá. Với mỗi fix phân quyền phải chạy E2E thật:
- **Chiều chặn:** kẻ không có quyền (ssa vào QLTS) → phải `access_denied`.
- **Chiều cho phép:** người hợp lệ (an.nguyen thuộc Developers) → vẫn phải vào được (không chặn nhầm).
Chỉ test một chiều dễ bỏ sót over-block. Dùng trình duyệt headless kiểm đúng URL callback (`code=` hay `error=`).

## 9. Bí mật production không được lọt vào git

**Luật:** Khóa riêng / PFX / mật khẩu PFX (thư mục `pmh.com.vn/`, `*.key`, `*.pfx`) phải nằm trong `.gitignore` **trước** mọi `git add -A`. Kiểm bằng `git check-ignore`. `.env` và mọi secret giữ trong biến môi trường, không commit.

---

## Checklist rút gọn khi onboard app mới (cho admin PMH ID)

- [ ] Cấp `client_id`/`client_secret`; khai `redirect_uris` + `app_url` (client riêng dev/prod).
- [ ] Gán **group** cho client — user chỉ vào được nếu thuộc group được gán (hoặc bật `allow_all_groups` nếu app cho mọi nhân viên).
- [ ] Nhắc dev: dùng thư viện OIDC chứng nhận, trỏ Discovery URL; logout kèm `id_token_hint`; bắt `error=access_denied` ở callback.
- [ ] Nhắc dev: `post_logout_redirect_uri` khớp hệt `app_url`.
