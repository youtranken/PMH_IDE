# PMH ID — EDGE & luồng hoạt động

> 📎 **Tài liệu tham khảo nội bộ** (không bắt buộc để tích hợp). Giúp hiểu PMH ID
> vận hành thế nào phía sau; muốn tích hợp thì `README.md` là đủ.

Tài liệu giải thích **pmh-edge** (cổng vào chung) và ba luồng chính: **đăng nhập OIDC**, **webhook**, **đăng xuất toàn hệ (BCL)**.

---

## 1. pmh-edge là gì

`pmh-edge` là **một stack Docker riêng** chỉ chứa **1 nginx** — cổng vào **DUY NHẤT** cho mọi project (PMH ID, QLTS, QLHS…). Nó làm 3 việc:

1. **Chấm dứt TLS (HTTPS)**: giữ cert wildcard `*.pmh.com.vn`, mở cổng `80`/`443` ra internet. Chỉ nó publish 2 cổng này.
2. **Định tuyến theo hostname + path**: cùng cổng 443, nhìn `Host:` và đường dẫn để chuyển sang backend đúng, backend chạy **HTTP thuần** trong mạng nội bộ (không TLS).
3. **Sanitize header**: đặt `X-Forwarded-Proto: https`, `X-Forwarded-For`… để backend biết request đến từ HTTPS qua proxy (AD-4).

**Vì sao tách riêng:** vòng đời độc lập với các project (nâng cert 1 chỗ, không lệch), và nhiều project dùng chung 1 cửa 443 thay vì mỗi project mở 1 cổng.

```mermaid
flowchart TB
    net([Internet<br/>người dùng + app]) -->|"HTTPS :443"| edge

    subgraph EDGE["stack pmh-edge — mạng edge (external)"]
      edge["nginx<br/>TLS wildcard *.pmh.com.vn<br/>publish 80/443<br/>alias: id.pmh.com.vn, qlts.pmh.com.vn"]
    end

    edge -->|"Host id.pmh.com.vn<br/>/oidc /api /docs"| sso
    edge -->|"Host id.pmh.com.vn<br/>/interaction  /"| fe
    edge -->|"Host qlts.pmh.com.vn"| qlts

    subgraph PMHID["stack pmh-id"]
      direction TB
      sso["sso-server:3000<br/>(NestJS OIDC IdP)"]
      fe["portal-fe:5173<br/>(React admin)"]
      subgraph INTERNAL["mạng pmhid-internal (kín)"]
        pg[("Postgres 16")]
        mail["mailpit / SMTP"]
      end
      sso --- pg
      sso --- mail
    end

    subgraph QLTSSTACK["stack qlts (project khác)"]
      qlts["qlts-api / qlts-web"]
    end

    sso -.->|"gọi qlts.pmh.com.vn<br/>(webhook / BCL / token-exchange)<br/>alias trỏ NGƯỢC về edge"| edge
```

**Điểm tinh tế — alias mạng:** `sso-server` cần gọi `https://qlts.pmh.com.vn` (gửi webhook, BCL). Trên mạng `edge`, nginx được gán **alias** `qlts.pmh.com.vn` → nên lời gọi này **đi vòng trong máy** tới chính edge (không ra internet), rồi edge route sang qlts. Issuer/URL công khai vẫn giữ nguyên.

**Hai mạng:**
- `edge` (external, dùng chung): edge nginx + sso-server + portal-fe + qlts. Đây là nơi định tuyến.
- `pmhid-internal` (kín): chỉ postgres + mailpit + sso-server. Project khác **không thấy** DB của PMH ID.

**Routing thực tế trong `id.conf`:**

| Đường dẫn (Host = id.pmh.com.vn) | Chuyển tới |
|---|---|
| `/oidc/*` `/api/*` `/docs` | `sso-server:3000` |
| `/interaction/*` `/` (mọi thứ còn lại) | `portal-fe:5173` |
| `:80` bất kỳ | 301 → HTTPS |

---

## 2. Luồng đăng nhập OIDC (portal + SSO)

Portal quản trị là **SPA công khai** (không có secret) đăng nhập bằng **PKCE**. Access token nó nhận được chính là "vé" vào API quản trị.

```mermaid
sequenceDiagram
    autonumber
    participant B as Trình duyệt<br/>(portal SPA)
    participant E as EDGE nginx
    participant S as sso-server (OIDC)
    participant DB as Postgres

    B->>B: login(): sinh code_verifier + state (PKCE S256)
    B->>E: GET /oidc/authorize?client_id=pmh-portal&code_challenge=...
    E->>S: proxy (X-Forwarded-Proto: https)
    S->>DB: tạo Interaction, lưu
    S-->>B: 303 → /interaction/{uid}<br/>Set-Cookie _interaction (Secure, HttpOnly)

    B->>E: GET /interaction/{uid} (form đăng nhập, do portal-fe render)
    B->>E: POST /api/interaction/{uid}/login {email, password}
    E->>S: proxy
    S->>DB: verify mật khẩu (argon2), kiểm rate-limit + cổng nhóm
    alt Bật MFA (SSA)
        S-->>B: yêu cầu mã TOTP
        B->>S: POST mã TOTP → verify (one-time, chống replay)
    end
    S->>DB: interactionResult → sinh Authorization Code (sống 60s)
    S-->>B: 303 → /auth/callback?code=...&state=...

    B->>B: handleCallback: kiểm state khớp
    B->>E: POST /oidc/token {code, code_verifier, client_id}
    E->>S: proxy
    S->>DB: đổi code (dùng 1 lần) → cấp token
    S-->>B: access_token + refresh_token (JWT ký RS256)
    B->>E: GET /api/me  (Authorization: Bearer access_token)
    E->>S: proxy → AdminGuard verify JWT offline (JWKS) + đối chiếu admin_roles
    S-->>B: hồ sơ + quyền → vào được portal
```

**Ý chính:**
- **PKCE bắt buộc** mọi client (kể cả confidential như QLTS) — chống chặn-cắp mã giữa đường.
- Access token **ngắn** (5 phút), verify **offline** bằng JWKS (không gọi lại IdP mỗi request). Hết hạn thì refresh token xin token mới ngầm — user không bị đá.
- Phiên SSO có **idle 15 phút** (trượt theo hoạt động) và **trần cứng 12 giờ**.

---

## 3. Luồng webhook (đá user tức thì khi bị khóa)

Không có webhook thì user bị khóa vẫn văng — nhưng **chậm ≤5 phút** (chờ token hết hạn). Webhook để đá **tức thì**.

```mermaid
sequenceDiagram
    autonumber
    participant A as Admin (portal)
    participant S as sso-server
    participant DB as Postgres<br/>(webhook_deliveries)
    participant W as WebhookWorker<br/>(poll mỗi 15s)
    participant C as App khách<br/>(vd QLTS)

    A->>S: Khóa user X
    S->>DB: INSERT deliveries<br/>(fan-out: mỗi client có user X qua nhóm)
    Note over S,DB: chỉ client nào user X thuộc nhóm được gán mới nhận

    loop mỗi 15 giây
        W->>DB: claim (FOR UPDATE SKIP LOCKED)<br/>pending tới hạn HOẶC sending kẹt >5'
        W->>W: kiểm egress allowlist (chống SSRF)<br/>giải mã webhook_secret (KEK)
        W->>W: ký HMAC v1(body) + v2(ts.body)
        W->>C: POST https (pin IP, timeout 10s)<br/>X-PMH-Signature, X-PMH-Timestamp, X-PMH-Signature-V2
        alt 2xx
            C->>C: verify chữ ký → hủy phiên local user X
            W->>DB: status = delivered
        else lỗi / timeout
            W->>DB: retry — backoff 30·2ⁿ (max 6 lần ~30')
        end
    end
```

**Vòng đời một delivery:**

```mermaid
stateDiagram-v2
    [*] --> pending: sự kiện phát sinh
    pending --> sending: worker claim
    sending --> delivered: nhận 2xx
    sending --> pending: lỗi tạm → hẹn retry (next_attempt_at)
    pending --> failed: hết 6 lần (dead-letter)
    failed --> pending: SSA bấm requeue<br/>(/admin/webhooks)
    delivered --> [*]
```

**Ý chính:**
- **Fan-out theo nhóm**: chỉ client mà user thuộc nhóm được gán (`client_groups` ⋈ `user_groups`) mới nhận sự kiện của user đó — không lộ chéo tenant.
- **Chống replay (v2)**: chữ ký v2 ký kèm timestamp; receiver kiểm timestamp trong ±5 phút → gói cũ bắt được không phát lại được. (v1 giữ để không gãy khách cũ; khách nên chuyển v2 rồi bỏ v1.)
- **Idempotent**: do có retry, cùng một sự kiện **có thể tới hơn 1 lần** → phía nhận phải xử lý idempotent.
- **Dead-letter**: thất bại hết retry → vào `failed`, **không mất im lặng** — hiện ở `/api/health` (`deadLettered`) và cảnh báo Telegram; SSA gửi lại qua `/admin/webhooks`.

---

## 4. Đăng xuất toàn hệ — Back-Channel Logout (BCL)

Khi kết thúc phiên SSO (một app gọi logout đúng cách), IdP báo **mọi app** để đá user ngay, không chờ token hết hạn.

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant App1 as App A
    participant S as sso-server (IdP)
    participant App2 as App B (QLTS)

    U->>App1: Đăng xuất
    App1->>S: end_session (id_token_hint)
    S->>S: hủy phiên SSO + mọi token trói theo phiên
    par gửi tới mọi app trong phiên
        S->>App2: POST backchannel_logout_uri<br/>(logout_token ký RS256)
        App2->>App2: verify token → hủy phiên local
    end
    S-->>U: về trang đăng nhập
```

> Nếu app chỉ xoá session local mà **không** gọi `end_session`, phiên SSO còn sống → user vào lại được ngay. Đó là lỗi tích hợp phía app.

> **⚠️ BCL bắn khi nào — và KHI NÀO KHÔNG (đọc kỹ):** `logout_token` chỉ gửi khi
> phiên SSO kết thúc **CHỦ ĐỘNG**: (a) user bấm **Đăng xuất toàn hệ** (qua
> `end_session`), hoặc (b) admin **Khóa / Hủy phiên / Xóa / Reset mật khẩu** user.
> **KHÔNG** bắn khi phiên **hết idle (15')** hay **token hết hạn thụ động** — lúc đó
> không có sự kiện logout nào để mà bắn.
>
> ⇒ **Mọi app BẮT BUỘC tự xử "refresh thất bại":** refresh token **trói vào phiên**
> (`expiresWithSession`) → phiên chết vì **bất kỳ** lý do gì (idle, logout, bị khóa)
> thì lần refresh kế của app **bị từ chối** (`invalid_grant`). Hãy coi đó là **tín
> hiệu đăng xuất** và xoá phiên local. Đây là cơ chế **luôn đúng cho MỌI trường hợp**
> (kể cả idle — nơi BCL không phủ). **BCL chỉ là lớp đá TỨC THÌ cộng thêm** cho ca
> logout/khoá chủ động, **KHÔNG thay** việc xử lý refresh-fail. Dùng thư viện OIDC
> chuẩn (vd `openid-client`) — nó tự bắt lỗi refresh và gọi hook đăng xuất.

---

## Tóm tắt 1 dòng mỗi khối

| Khối | Vai trò |
|---|---|
| **pmh-edge** | Cổng 443 duy nhất, chấm dứt TLS, route theo Host+path, backend chạy HTTP nội bộ |
| **sso-server** | IdP OIDC: authorize/token, quản user/nhóm/client, MFA, audit, webhook worker |
| **portal-fe** | SPA quản trị, đăng nhập PKCE, gọi `/api/*` bằng Bearer token |
| **Postgres** | Nguồn sự thật: user, phiên/token (oidc_payloads), hàng đợi webhook/email, settings |
| **webhook** | Báo app khách khi user bị khóa/xóa/đổi nhóm → đá tức thì (thay cho chờ ≤5') |
| **BCL** | Logout/khoá **chủ động** → đá user khỏi MỌI app **tức thì**. Idle/hết-hạn thụ động KHÔNG bắn BCL → app tự xử qua refresh-fail |
