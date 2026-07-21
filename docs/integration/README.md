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

> 🆕 **Project mới lần đầu?** Xem [`onboarding-project-moi.md`](./onboarding-project-moi.md) — phiếu đăng ký (bạn điền, gửi admin) + phiếu bàn giao (admin trả lại).

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
> **Prod vs môi trường local:** URL **giống hệt nhau** — cùng `https://id.pmh.com.vn` (cổng 443). Từ khi gộp về EDGE nginx chung, môi trường dev **không còn cổng `:9443`**. Khi test trên máy dev chỉ cần: thêm dòng hosts `127.0.0.1 id.pmh.com.vn`, và **chấp nhận cert tự ký** (dev dùng self-signed; prod là cert wildcard thật). Vẫn chỉ nên trỏ thư viện vào Discovery URL rồi để nó tự suy ra phần còn lại.

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

> ⚠️ **PKCE là BẮT BUỘC cho MỌI client** (kể cả confidential có `client_secret`). PMH ID **từ chối** mọi `/authorize` không kèm `code_challenge` (`code_challenge_method=S256`) với lỗi *"Authorization Server policy requires PKCE"*. Thư viện OIDC certified (openid-client, Spring, MSAL…) **tự gửi PKCE** — không cần làm gì thêm. Nhưng nếu bạn tự ghép URL authorize hoặc dùng cấu hình cũ tắt PKCE, đăng nhập sẽ **fail ngay ở bước authorize**. Chỉ chấp nhận `S256` (không nhận `plain`).

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

> **Xoay refresh token (BẮT BUỘC hiểu đúng, nếu không user bị đá oan):** PMH ID **xoay refresh token mỗi lần dùng** và **phát hiện tái sử dụng** — nếu app gửi lại một refresh token cũ đã dùng rồi, PMH ID coi là bị lộ/replay và **thu hồi CẢ phiên** (đá user ra mọi nơi). Thư viện OIDC chuẩn tự lưu token mới sau mỗi lần refresh; **đừng tự viết** phần gọi `/token` bằng tay — rất dễ lưu nhầm/tái dùng token cũ. Dùng `openid-client` là an toàn.

### 4.5 Đăng xuất — hai kiểu, chọn đúng theo ý muốn

SSO có **hai phạm vi đăng xuất**. Chọn nhầm là nguồn của mọi hiểu lầm "đăng xuất không ăn / bị bắt login lại":

- **Đăng xuất RIÊNG app này (local):** app **tự xóa session của nó**, **KHÔNG** gọi `/oidc/logout`. Phiên SSO và các app khác **giữ nguyên**; user vào lại app này vẫn vào **thẳng, không cần mật khẩu** (PMH ID cấp lại token qua phiên SSO còn sống). Đây là kiểu logout mặc định cho hầu hết app. → Xem thêm mục 4.6.
- **Đăng xuất TOÀN HỆ (mọi app):** đẩy user qua `/oidc/logout` (RP-initiated) — endpoint này **kết thúc phiên SSO**, nên **MỌI app cùng văng** (trong ≤5 phút theo cơ chế token trói phiên). Dùng cho nút kiểu "Đăng xuất khỏi PMH ID". **Đừng** dùng endpoint này cho nút "đăng xuất khỏi app này" — nó sẽ đá user ra khỏi tất cả app khác.

Phần dưới là cách làm **đăng xuất TOÀN HỆ**. **Luôn kèm `id_token_hint`** (lưu `id_token` nhận được lúc đăng nhập) — cho PMH ID biết chính xác phiên nào để kết thúc và **bỏ qua bước hỏi xác nhận** mượt mà. Để thư viện tự dựng URL — **đừng tự ghép tay**:

```js
// Lúc đăng nhập: nhớ lưu id_token (vd trong session của app)
req.session.id_token = tokens.id_token;

// Route đăng xuất
app.get('/logout', (req, res) => {
  const url = oidc.buildEndSessionUrl(config, {
    id_token_hint: req.session.id_token,
    post_logout_redirect_uri: 'https://qlts.pmh.com.vn',  // phải KHỚP Y HỆT app_url đã khai
  });
  req.session.destroy(() => res.redirect(url.href));   // xóa session local RỒI đẩy sang PMH ID
});
```

**URL logout thô (để đối chiếu — bình thường để thư viện tự dựng):**

```
# Đăng xuất TOÀN HỆ (kết thúc phiên SSO):
https://id.pmh.com.vn/oidc/logout
    ?id_token_hint=<id_token nhận lúc login>
    &post_logout_redirect_uri=https%3A%2F%2Fqlts.pmh.com.vn   # url-encode; khớp hệt app_url

# (dev dùng CÙNG URL này — không còn cổng :9443 sau khi gộp EDGE)
```

Còn **đăng xuất RIÊNG app** thì **không có URL nào tới PMH ID cả** — app chỉ tự xóa session của nó:

```js
// Đăng xuất riêng app này (giữ phiên SSO) — KHÔNG gọi PMH ID
app.get('/logout-local', (req, res) => {
  req.session.destroy(() => res.redirect('/'));   // vào lại sẽ tự đăng nhập qua SSO, không hỏi MK
});
```

- **`post_logout_redirect_uri` phải KHỚP Y HỆT giá trị `app_url`** bạn đã khai với admin — kể cả dấu `/` cuối. Lệch một ký tự → PMH ID từ chối (lỗi "not registered"). Nếu cần một URL quay-về khác `app_url`, báo admin đăng ký thêm.
- Sau khi kết thúc phiên, PMH ID đẩy user về `post_logout_redirect_uri`; app thấy chưa đăng nhập → khởi động lại luồng login.
- **Single-logout:** kết thúc phiên SSO khiến refresh token của **mọi app** trói theo phiên đó cũng chết → các app khác sẽ văng ở lần refresh kế (≤5 phút). Cần đá **tức thì** thì dùng webhook (mục 6).

> **Xử lý `error=access_denied` ở callback (QUAN TRỌNG):** nếu user đăng nhập đúng nhưng **không thuộc group nào được cấp cho app bạn**, PMH ID trả về callback với `?error=access_denied` (không có `code`) — kể cả khi user đó đang có phiên SSO sẵn từ app khác. Đây **không phải lỗi hệ thống** mà là "user này không có quyền vào app bạn". Hãy bắt trường hợp này và hiện thông báo rõ ("Bạn chưa được cấp quyền vào ứng dụng này — liên hệ quản trị"), đừng để văng trang lỗi 500.

### 4.6 Logout riêng ở app vs. đăng nhập lại (gỡ lỗi)

Có **hai phạm vi logout** — chọn đúng cơ chế theo ý muốn:

| Muốn gì | Làm gì | Kết quả |
|---|---|---|
| Kết thúc phiên SSO **toàn hệ** | `/oidc/logout` + `id_token_hint` (mục 4.5) | Phiên SSO chết; vào lại **phải đăng nhập lại** (đúng) |
| Chỉ logout **riêng app này**, giữ phiên SSO | App tự xóa session của nó, **không** gọi `/oidc/logout` | Vào lại → PMH ID thấy SSO còn sống → **cấp lại token NGAY, không hỏi mật khẩu** (đúng) |

**Nếu logout-local xong, vào lại app bị LỖI hoặc bắt đăng nhập lại dù phiên SSO còn sống → lỗi ở PHÍA APP, không phải PMH ID** (đã kiểm chứng: khi phiên SSO còn, `/authorize` cấp lại `code` mượt, không đòi mật khẩu). Checklist gỡ lỗi phía app:

- [ ] **Mỗi lần** vào `/authorize` sinh `state` + `code_verifier` (PKCE) **MỚI**, lưu ở nơi **không bị xóa** khi logout-local. Lỗi hay gặp: logout xóa sạch session (gồm chỗ giữ state) → callback không có state đối chiếu → "state mismatch".
- [ ] Sau logout-local, **vứt hết token cũ** (access/refresh/id). Đừng tái dùng `code` (dùng một lần) hay refresh token cũ → **replay → PMH ID thu hồi cả grant → lỗi**.
- [ ] Đừng để cache/cookie lệch: session server đã xóa nhưng client còn giữ `id_token`/refresh cũ.
- [ ] Callback phải chịu được **gọi hai lần** (StrictMode/tab double-load): `code` lần thứ hai đã bị dùng → 400; guard bằng cờ "code đã dùng".

### 4.7 Back-Channel Logout — đá user ra TỨC THÌ (tùy chọn nhưng khuyến nghị)

Mặc định khi phiên SSO kết thúc (user "Đăng xuất khỏi PMH ID", hoặc admin khóa/xóa), app bạn văng trong **≤5 phút** (token hết hạn). Muốn **tức thì**, khai một **Back-Channel Logout URI** (chuẩn OIDC BCL): khi phiên SSO kết thúc, PMH ID **POST một `logout_token`** (JWT ký) tới URL đó, app verify rồi xóa phiên local ngay.

**Bước 1 — báo admin khai `backchannel_logout_uri`** cho client của bạn (màn Ứng dụng → Sửa). Ví dụ `https://qlts.pmh.com.vn/backchannel-logout`.

**Bước 2 — dựng endpoint nhận.** Nhận `logout_token` (form-urlencoded), **verify chữ ký qua JWKS** (như access token), kiểm claim `events` là backchannel-logout và **không có `nonce`**, rồi hủy phiên local của `sub`:

```js
import * as jose from 'jose';
const JWKS = jose.createRemoteJWKSet(new URL('https://id.pmh.com.vn/oidc/jwks'));

app.post('/backchannel-logout', express.urlencoded({ extended: false }), async (req, res) => {
  try {
    const { payload } = await jose.jwtVerify(req.body.logout_token, JWKS, {
      issuer: 'https://id.pmh.com.vn/oidc',
      audience: process.env.PMH_CLIENT_ID,
    });
    const isLogout = payload.events?.['http://schemas.openid.net/event/backchannel-logout'];
    if (!isLogout || 'nonce' in payload) return res.status(400).end();   // phải là logout_token, KHÔNG phải id_token
    // Hủy MỌI phiên local của user này (tham chiếu bằng payload.sub — id nội bộ)
    await killLocalSessionsBySub(payload.sub);
    res.status(200).end();
  } catch { res.status(400).end(); }
});
```

- Tham chiếu user bằng **`sub`** (như mọi nơi khác), không phải email.
- Endpoint này PMH ID gọi từ server → phải cho phép PMH ID truy cập được (nội mạng). Nó **không** dùng HMAC như webhook — bảo mật bằng **chữ ký JWT** của chính PMH ID.
- App demo mẫu (`apps/demo-app`) có sẵn endpoint này để copy.
- Không làm BCL cũng an toàn — chỉ là user văng trong ≤5 phút thay vì tức thì.

#### App ở IP nội bộ (on-prem) — cấu hình phía admin PMH ID

Để chống SSRF, PMH ID mặc định **chặn gửi tới mọi IP private**. Nếu `backchannel_logout_uri` (và `webhook_url`) của bạn nằm ở dải nội bộ, admin PMH ID phải làm 2 việc (URL **phải https**):

**1) Khai dải IP đích vào allowlist** — biến `.env` `WEBHOOK_ALLOWLIST_CIDR` (CIDR, phẩy), rồi recreate container:
```bash
# .env của PMH ID
WEBHOOK_ALLOWLIST_CIDR=192.168.0.0/16,10.0.0.0/8
# đổi env_file phải RECREATE (không phải restart):
docker compose --env-file .env -f deploy/docker-compose.yml -f deploy/docker-compose.dev.yml up -d --force-recreate sso-server
```

**2) (Chỉ dev/Docker Desktop) cho container resolve host của app** — app chạy NGOÀI container (trên máy host) thì thêm `extra_hosts` vào service `sso-server` trong `deploy/docker-compose.yml` (host-gateway = `192.168.65.254`):
```yaml
    extra_hosts:
      - "qlts.pmh.com.vn:host-gateway"   # mỗi app nội bộ một dòng
```
*(Prod: app nội bộ có DNS nội mạng thật → thường không cần `extra_hosts`; chỉ cần allowlist đúng dải IP.)*

**Kiểm chứng nhanh sau khi chỉnh** — từ trong container gọi thử endpoint của app; tới được sẽ trả lỗi 400 (token giả), chứ không phải timeout/refused:
```bash
docker exec pmh-id-sso-server-1 sh -c \
  'wget -qO- --no-check-certificate --post-data="logout_token=x" \
   https://qlts.pmh.com.vn/api/backchannel-logout'
# → HTTP 400 (vd {"code":"LOGOUT_TOKEN_INVALID"}) = ĐÃ THÔNG. timeout/refused = chưa thông.
```

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

Payload ký **HMAC-SHA256** bằng `webhook_secret` (admin cấp) — **luôn verify chữ ký** trước khi xử lý. PMH ID gửi **hai** chữ ký ở header:

| Header | Ký trên | Ghi chú |
|---|---|---|
| `X-PMH-Signature` | `body` | **v1** — hex thuần, tương thích ngược. **Không** chống replay. |
| `X-PMH-Signature-V2` | `` `${X-PMH-Timestamp}.${body}` `` | **v2** — kèm `X-PMH-Timestamp` (unix giây). Chống phát lại. |

**KHUYẾN NGHỊ: chuyển sang v2** — kiểm timestamp tươi (±5 phút) rồi verify v2. Gói tin cũ bị bắt sẽ không phát lại được (timestamp hết hạn). v1 giữ nguyên để không gãy trong lúc chuyển đổi; **sau khi bạn dùng v2, hãy ngừng chấp nhận v1** (v1 còn thì replay vẫn được).

```js
import crypto from 'crypto';

app.post('/webhooks/pmh-id', express.raw({ type: 'application/json' }), (req, res) => {
  // v2 — chống replay (khuyến nghị)
  const ts = req.header('X-PMH-Timestamp');
  const sig = req.header('X-PMH-Signature-V2');
  if (!ts || Math.abs(Date.now() / 1000 - Number(ts)) > 300) {
    return res.status(401).end();            // timestamp quá cũ/tương lai → nghi replay
  }
  const expected = crypto.createHmac('sha256', process.env.PMH_WEBHOOK_SECRET)
                         .update(`${ts}.${req.body}`).digest('hex');
  if (sig.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return res.status(401).end();
  }
  const event = JSON.parse(req.body);
  if (event.type === 'user.locked' || event.type === 'user.deleted') {
    // hủy phiên local của event.user_id → buộc logout
    // (nên idempotent: cùng một sự kiện có thể tới hơn một lần khi worker retry)
  }
  res.status(200).end();   // trả 2xx nhanh; xử lý nặng thì làm async
});
```

PMH ID **retry giãn dần** nếu bạn trả lỗi/timeout — tối đa **6 lần trong ~30 phút**, sau đó delivery vào **dead-letter** (SSA gửi lại được qua `POST /api/admin/webhooks/:id/requeue`). Vì có retry, cùng một sự kiện **có thể tới hơn một lần** → xử lý phải **idempotent**. Webhook phải là `https`; nếu ở **IP nội bộ**, admin PMH ID phải khai dải của bạn vào `WEBHOOK_ALLOWLIST_CIDR` (xem lưu ý ở mục 4.7 — dùng chung cho webhook và Back-Channel Logout). Nếu không làm webhook, hệ thống vẫn an toàn — user bị khóa sẽ văng trong ≤5 phút nhờ token hết hạn, hoặc bạn polling `GET /events`.

---

## 7. Checklist tích hợp (mục tiêu: xong trong ≤1 ngày)

- [ ] Xin admin cấp `client_id` + `client_secret`, khai `redirect_uris` + `app_url` (client riêng cho dev/prod).
- [ ] Cắm thư viện OIDC client, trỏ vào Discovery URL.
- [ ] Làm luồng login/callback (kịch bản B).
- [ ] Verify JWT **offline** qua JWKS, cache ≤10 phút; tham chiếu user bằng `sub`.
- [ ] Phân quyền nội bộ app dựa trên claim `groups`.
- [ ] Xử lý refresh token thất bại = đăng xuất user; lưu token MỚI sau mỗi lần refresh (đừng tái dùng token cũ).
- [ ] Làm nút Đăng xuất qua `buildEndSessionUrl` **kèm `id_token_hint`** (mục 4.5); `post_logout_redirect_uri` khớp hệt `app_url`.
- [ ] Bắt `error=access_denied` ở callback → báo "chưa được cấp quyền", không văng 500.
- [ ] (Muốn đá tức thì khi logout toàn hệ) khai `backchannel_logout_uri` + dựng endpoint verify `logout_token` (mục 4.7).
- [ ] (Nếu cần danh bạ) tích hợp Directory API bằng client-credentials.
- [ ] (Nếu cần đá tức thì) đăng ký webhook + verify HMAC.
- [ ] Giữ `client_secret` trong biến môi trường/secrets, **không** commit vào git.

---

## 8. Câu hỏi thường gặp

**Có phải tự làm trang đăng nhập không?** Không. Trang login nằm trên PMH ID; bạn chỉ redirect sang.

**PMH ID sập thì app tôi chết theo?** Không, với user đã đăng nhập — vì bạn verify JWT offline. Chỉ *đăng nhập mới* mới cần PMH ID sống.

**Đổi `email` của user thì sao?** Không ảnh hưởng nếu bạn dùng `sub` làm khóa. Đừng khóa theo email.

**Rotate `client_secret`?** Admin rotate có ân hạn (secret cũ còn hiệu lực một khoảng) để bạn kịp đổi không downtime. Khi nhận secret mới, cập nhật env rồi deploy trong thời gian ân hạn.

**Logout một app có logout mọi app không?** Có, nếu bạn logout đúng cách. Gọi endpoint logout của PMH ID kèm `id_token_hint` (mục 4.5) sẽ **kết thúc phiên SSO** — refresh token của mọi app trói theo phiên đó cũng chết, nên các app khác văng trong ≤5 phút (tức thì nếu dùng webhook). Ngược lại, nếu app chỉ xóa session local mà không gọi endpoint logout thì phiên SSO còn sống và user vào lại được ngay — đó là lỗi tích hợp, không phải hành vi đúng.

**User đăng nhập được app khác nhưng app tôi báo `access_denied`?** Đúng như thiết kế: user chỉ vào được app mà họ thuộc **group được cấp** cho app đó. Phiên SSO chung KHÔNG có nghĩa vào được mọi app — mỗi app gác cửa theo group riêng. Xin admin gán group phù hợp cho client của bạn (hoặc bật `allow_all_groups` nếu app cho mọi nhân viên).
