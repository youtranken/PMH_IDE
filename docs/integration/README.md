# PMH ID — Hướng dẫn tích hợp cho Developer

> Tài liệu cho dev các project nội bộ tích hợp đăng nhập chung qua **PMH ID** (`https://id.pmh.com.vn`).
> Bản này bám theo Architecture Spine + PRD (2026-07-04). Có thắc mắc hoặc cần cấp client → liên hệ SSA.

---

## 1. Tổng quan 30 giây

PMH ID là hệ thống đăng nhập tập trung (SSO) theo chuẩn **OpenID Connect (OIDC)**. Project của bạn **không tự quản user/mật khẩu** — bạn nhận một cặp `client_id` + `client_secret` từ admin, gắn một thư viện OIDC client, và:

- **Đăng nhập user:** đẩy user sang PMH ID, nhận về **JWT** chứa thông tin user + groups.
- **Xác minh JWT offline:** verify bằng public key (JWKS) — **không gọi về PMH ID mỗi request**. PMH ID có sập thì user đã đăng nhập vẫn dùng app tiếp đến khi token hết hạn.
- **Lấy danh bạ (tùy chọn):** gọi **Directory API** để lấy danh sách user thuộc các group được cấp (phục vụ nghiệp vụ kiểu gán việc cho nhân viên chưa từng đăng nhập).
- **Nhận sự kiện (tùy chọn):** đăng ký **webhook** để biết khi user bị khóa/xóa/đổi group → đá user khỏi app ngay.

Bạn **không tự đăng ký** — admin cấp `client_id`/`client_secret` và secret chỉ hiện **một lần**, giữ kỹ.

---

## 2. Hai luồng đăng nhập (hiểu trước khi code)

Chỉ có **một trang đăng nhập duy nhất**, nằm trên PMH ID. Project của bạn không tự làm trang login — chỉ *đẩy* user sang PMH ID.

**Kịch bản A — user vào cổng PMH ID trước:** đăng nhập → thấy Dashboard các app → bấm app của bạn → mở tab mới, vào thẳng (đã đăng nhập nên lấy token ngầm).

**Kịch bản B — user vào thẳng app của bạn:** app thấy chưa đăng nhập → tự đẩy sang PMH ID → user đăng nhập → PMH ID đẩy ngược về app kèm `code` → app đổi `code` lấy token → vào app.

Bạn chỉ cần lo **kịch bản B** (thư viện OIDC lo hết phần redirect).

---

## 3. Thông số tích hợp

| Thứ | Giá trị |
|---|---|
| Issuer | `https://id.pmh.com.vn/oidc` |
| Discovery | `https://id.pmh.com.vn/oidc/.well-known/openid-configuration` |
| Authorization | `https://id.pmh.com.vn/oidc/authorize` |
| Token | `https://id.pmh.com.vn/oidc/token` |
| JWKS (public key) | `https://id.pmh.com.vn/oidc/jwks` |
| UserInfo | `https://id.pmh.com.vn/oidc/userinfo` |
| Logout | `https://id.pmh.com.vn/oidc/logout` |
| Directory API | `https://id.pmh.com.vn/api/v1/...` |

> **Luôn dùng Discovery URL** thay vì hardcode từng endpoint — thư viện OIDC tự đọc cấu hình từ đó, và nếu endpoint đổi thì bạn không phải sửa code.
>
> **Prod vs môi trường local:** bảng trên là **prod** (`https://id.pmh.com.vn`, cổng 443 mặc định). Khi test trên máy dev, domain giữ nguyên nhưng có **cổng `:9443`** — ví dụ Issuer `https://id.pmh.com.vn:9443/oidc`, Discovery `https://id.pmh.com.vn:9443/oidc/.well-known/openid-configuration` (cần dòng hosts `127.0.0.1 id.pmh.com.vn`). Vẫn chỉ nên trỏ thư viện vào Discovery URL rồi để nó tự suy ra phần còn lại.

**Bạn cần khai với admin khi xin client:**
- `redirect_uris`: URL callback của app, ví dụ `https://pmh.com.vn/projectA/auth/callback`.
- `app_url`: URL để hiện trên Dashboard PMH ID.
- Môi trường: dev/prod nên xin **client riêng** (khác secret, khác URL).

---

## 4. Đăng nhập user (OIDC Authorization Code)

### 4.1 Cấu trúc JWT trả về

Access token là JWT ký RS256. Claims (hợp đồng **`ver`** — sẽ báo trước nếu thay đổi phá vỡ):

```json
{
  "sub": "usr_01H...",              // ID nội bộ, ỔN ĐỊNH — KHÓA CHÍNH để tham chiếu user
  "email": "an.nguyen@pmh.com.vn",  // có thể đổi, ĐỪNG dùng làm khóa
  "employee_code": "NV001",
  "full_name": "Nguyễn Văn An",
  "groups": ["Kế toán", "Hành chính"],
  "ver": 1,
  "iss": "https://id.pmh.com.vn/oidc",
  "aud": "your_client_id",
  "exp": 1751600000
}
```

> **Quy tắc vàng:** tham chiếu user trong DB của bạn bằng **`sub`** (id nội bộ), KHÔNG bằng `email` (email đổi được). `groups` là thứ bạn dùng để phân quyền *nội bộ app* — PMH ID chỉ nói user thuộc group nào, còn "group này là admin hay viewer trong app bạn" là do **bạn tự định nghĩa**.

### 4.2 Ví dụ — Node.js/Express + `openid-client`

```js
import express from 'express';
import * as client from 'openid-client';

// 1. Đọc cấu hình từ Discovery (không hardcode endpoint)
const config = await client.discovery(
  new URL('https://id.pmh.com.vn/oidc'),
  process.env.PMH_CLIENT_ID,
  process.env.PMH_CLIENT_SECRET,
);

const app = express();

// 2. Đẩy user sang PMH ID để đăng nhập (kịch bản B)
app.get('/login', (req, res) => {
  const url = client.buildAuthorizationUrl(config, {
    redirect_uri: 'https://pmh.com.vn/projectA/auth/callback',
    scope: 'openid profile',
    // PKCE + state: thư viện tự lo, xem docs openid-client để lưu code_verifier vào session
  });
  res.redirect(url.href);
});

// 3. Callback: đổi code lấy token
app.get('/auth/callback', async (req, res) => {
  const tokens = await client.authorizationCodeGrant(config, new URL(req.url, 'https://pmh.com.vn'));
  // tokens.access_token = JWT; tokens.refresh_token để làm mới
  req.session.user = tokens.claims();   // { sub, email, groups, ... }
  res.redirect('/');
});

app.listen(3000);
```

Các ngôn ngữ khác: dùng thư viện OIDC certified tương ứng (PHP: `jumbojett/openid-connect-php`, .NET: `Microsoft.AspNetCore.Authentication.OpenIdConnect`, Java: Spring Security OAuth2). Nguyên tắc giống hệt.

### 4.3 Verify JWT offline (quan trọng)

Đừng gọi UserInfo mỗi request. Verify chữ ký JWT bằng public key lấy từ JWKS (thư viện cache sẵn):

```js
import * as jose from 'jose';

const JWKS = jose.createRemoteJWKSet(new URL('https://id.pmh.com.vn/oidc/jwks'));

async function verify(accessToken) {
  const { payload } = await jose.jwtVerify(accessToken, JWKS, {
    issuer: 'https://id.pmh.com.vn/oidc',
    audience: process.env.PMH_CLIENT_ID,
  });
  return payload; // đã xác thực; dùng payload.sub, payload.groups
}
```

> **Cache JWKS ≤ 10 phút.** PMH ID rotate khóa ký theo cơ chế publish-trước-ký-sau với cửa sổ chồng lấn — miễn bạn cache JWKS ≤10 phút và luôn chọn khóa theo `kid` trong header token (thư viện `jose`/`openid-client` tự làm), việc rotate khóa sẽ **không làm gãy** verify của bạn.

### 4.4 Vòng đời token & phiên

- **Access token sống ~5 phút.** Hết thì dùng `refresh_token` xin cái mới (thư viện lo ngầm).
- **Phiên PMH ID idle 15 phút** — user không thao tác 15 phút sẽ phải đăng nhập lại; refresh token của bạn không sống quá phiên đó.
- Khi user **bị khóa/xóa/đổi mật khẩu**, PMH ID thu hồi refresh token → lần refresh kế của bạn sẽ **thất bại** → hãy coi đó là tín hiệu đăng xuất user khỏi app. Nếu cần đá **tức thì** (không chờ ≤5 phút), đăng ký webhook (mục 6).

---

## 5. Directory API — lấy danh bạ user (tùy chọn)

Dùng khi app cần danh sách user **không phụ thuộc việc họ đã đăng nhập chưa** (ví dụ: gán tài sản cho một nhân viên). Xác thực bằng **client-credentials** (machine-to-machine).

```bash
# 1. Lấy token M2M
curl -X POST https://id.pmh.com.vn/oidc/token \
  -u "$CLIENT_ID:$CLIENT_SECRET" \
  -d "grant_type=client_credentials"

# 2. Gọi Directory API
curl https://id.pmh.com.vn/api/v1/users?group=Kế%20toán \
  -H "Authorization: Bearer <token>"
```

Endpoint:
```
GET /api/v1/users?group=&search=&page=      # danh bạ, phân trang
GET /api/v1/users/:id
GET /api/v1/groups                           # các group client bạn được cấp
GET /api/v1/events?since=<event_id>          # polling thay đổi (dự phòng webhook)
```

**Bạn chỉ thấy user thuộc group đã được gán cho client của bạn** — không thấy toàn bộ 1000 người. Mỗi user trả về (hợp đồng v1): `id`, `employee_code`, `email`, `full_name`, `groups[]`, `status`. **Không bao giờ** có mật khẩu.

- User đã bị xóa (`status: deleted`) **ẩn mặc định**; thêm `?include_deleted=true` để đối soát offboarding.
- `GET /events?since=<event_id>`: nếu cursor của bạn cũ hơn 90 ngày, API trả **410 Gone** kèm cờ báo cần đồng bộ lại toàn bộ — khi đó gọi lại `GET /users` full thay vì tiếp tục polling.

---

## 6. Webhook — nhận sự kiện tức thì (tùy chọn)

Nếu cần đá user ngay khi bị khóa (không chờ ≤5 phút), khai `webhook_url` với admin. PMH ID sẽ POST khi có:

`user.locked` · `user.unlocked` · `user.deleted` · `user.password_changed` · `user.groups_changed`

Payload ký **HMAC-SHA256** bằng `webhook_secret` (admin cấp) ở header — **luôn verify chữ ký** trước khi xử lý:

```js
import crypto from 'crypto';

app.post('/webhooks/pmh-id', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.header('X-PMH-Signature');
  const expected = crypto.createHmac('sha256', process.env.PMH_WEBHOOK_SECRET)
                         .update(req.body).digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return res.status(401).end();
  }
  const event = JSON.parse(req.body);
  if (event.type === 'user.locked' || event.type === 'user.deleted') {
    // hủy phiên local của event.user_id → buộc logout
  }
  res.status(200).end();   // trả 2xx nhanh; xử lý nặng thì làm async
});
```

PMH ID **retry giãn dần** nếu bạn trả lỗi/timeout. Webhook chỉ trỏ được tới dải mạng nội bộ hợp lệ (`https`). Nếu không làm webhook, hệ thống vẫn an toàn — user bị khóa sẽ văng trong ≤5 phút nhờ token hết hạn, hoặc bạn polling `GET /events`.

---

## 7. Checklist tích hợp (mục tiêu: xong trong ≤1 ngày)

- [ ] Xin admin cấp `client_id` + `client_secret`, khai `redirect_uris` + `app_url` (client riêng cho dev/prod).
- [ ] Cắm thư viện OIDC client, trỏ vào Discovery URL.
- [ ] Làm luồng login/callback (kịch bản B).
- [ ] Verify JWT **offline** qua JWKS, cache ≤10 phút; tham chiếu user bằng `sub`.
- [ ] Phân quyền nội bộ app dựa trên claim `groups`.
- [ ] Xử lý refresh token thất bại = đăng xuất user.
- [ ] (Nếu cần danh bạ) tích hợp Directory API bằng client-credentials.
- [ ] (Nếu cần đá tức thì) đăng ký webhook + verify HMAC.
- [ ] Giữ `client_secret` trong biến môi trường/secrets, **không** commit vào git.

---

## 8. Câu hỏi thường gặp

**Có phải tự làm trang đăng nhập không?** Không. Trang login nằm trên PMH ID; bạn chỉ redirect sang.

**PMH ID sập thì app tôi chết theo?** Không, với user đã đăng nhập — vì bạn verify JWT offline. Chỉ *đăng nhập mới* mới cần PMH ID sống.

**Đổi `email` của user thì sao?** Không ảnh hưởng nếu bạn dùng `sub` làm khóa. Đừng khóa theo email.

**Rotate `client_secret`?** Admin rotate có ân hạn (secret cũ còn hiệu lực một khoảng) để bạn kịp đổi không downtime. Khi nhận secret mới, cập nhật env rồi deploy trong thời gian ân hạn.

**Logout một app có logout mọi app không?** Không — logout từng app riêng (không single-logout toàn cục).
