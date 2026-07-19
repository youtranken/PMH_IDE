# Runbook — Phục hồi PMH ID (SSO/IdP)

> Mục tiêu: từ **máy chủ trắng** hoặc **mất dữ liệu**, dựng lại tới trạng thái **đăng nhập được** trong **≤ 4 giờ**. Chống bus-factor 2 người vận hành (AD-16).

## 0. Nguyên tắc sống còn

- **Backup phải TRỌN BỘ.** Chỉ có `pg_dump` là **KHÔNG đủ**: thiếu `.env` (KEK) thì không giải mã được `mfa_totp.totp_secret_enc` → **SSA kẹt ngoài** (không qua được MFA). Backup của ta gói cả 3: `db.sql` + `.env` + `signing-keys/jwks.json`.
- **Đường cứu độc lập:** tài khoản **break-glass** (`is_breakglass=true`) bỏ qua MFA — dùng khi mất thiết bị TOTP.
- **Cảnh báo out-of-band** (`deploy/monitor/alert.js`) chạy NGOÀI hệ, không dựa vào email của chính SSO.

## 1. Cần có sẵn (cất offline)

| Thứ | Ở đâu |
|---|---|
| File backup `pmhid-backup-*.tar.gz.enc` | Thư mục host `BACKUP_DIR` trong `.env` (hiện `F:/PMH/backup-pmhid`) — PHẢI khác đĩa với Docker/pg_data |
| `BACKUP_PASSPHRASE` | Két/quản lý bí mật — KHÔNG cùng chỗ với backup |
| Mã nguồn repo (hoặc image đã build) | Git / registry nội bộ |
| Recovery code break-glass (in giấy) | Két |

## 2. Dựng lại trên host trắng

> ⚠️ **LUÔN truyền `--env-file .env`** cho MỌI lệnh `docker compose`. Compose
> tìm `.env` cạnh **file compose** (`deploy/.env` — không tồn tại), KHÔNG phải
> thư mục bạn đang đứng. Thiếu cờ này thì `${POSTGRES_USER}`… nội suy thành
> rỗng, `DATABASE_URL` thành `postgres://:@postgres:5432/` và container chết với
> `no PostgreSQL user name specified in startup packet`.

```bash
# 2.1 Cài Docker + Docker Compose v2, lấy mã nguồn
git clone <repo> pmh-ct && cd pmh-ct

# 2.2 Giải mã backup → lấy .env, khóa ký, db.sql
#     -iter 200000 BẮT BUỘC phải khớp backup.sh (mặc định openssl là 10000 →
#     thiếu cờ này sẽ nhận "bad decrypt" và tưởng nhầm là backup hỏng).
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE \
  -in pmhid-backup-YYYYMMDD-HHMMSS.tar.gz.enc | tar -xzf -
#   → ./.env  ./db.sql  ./signing-keys/jwks.json

# 2.3 Kiểm .env đã ở gốc repo (bước 2.2 giải nén ra đây rồi)
ls -la .env                                   # phải thấy .env vừa giải nén
#   khóa ký (signing-keys/jwks.json) sẽ nạp vào volume ở bước 2.6

# 2.4 Tạo mạng `edge` — compose khai `external: true` nên KHÔNG tự tạo; trên
#     host trắng thiếu bước này là mọi lệnh `up` chết ngay dòng đầu.
#     PIN subnet cố định để WEBHOOK_ALLOWLIST_CIDR không vỡ khi tạo lại mạng.
docker network create --subnet 172.20.0.0/16 --gateway 172.20.0.1 edge \
  2>/dev/null || echo "mạng edge đã có — bỏ qua"

# 2.5 Dựng hạ tầng (Postgres trống trước)
docker compose --env-file .env -f deploy/docker-compose.yml up -d postgres
#   chờ postgres healthy:
until docker compose --env-file .env -f deploy/docker-compose.yml ps postgres \
      | grep -q healthy; do sleep 2; done

# 2.6 Restore DB
#     ON_ERROR_STOP=1 BẮT BUỘC: psql mặc định BỎ QUA câu lệnh lỗi rồi vẫn thoát
#     0 → restore dở dang mà báo thành công, diễn tập "đạt" trên DB thiếu bảng.
PW=$(grep '^POSTGRES_PASSWORD=' .env | cut -d= -f2)
cat db.sql | docker compose --env-file .env -f deploy/docker-compose.yml exec -T \
  -e PGPASSWORD=$PW postgres \
  psql -h 127.0.0.1 -U pmhid -d pmhid -v ON_ERROR_STOP=1

# 2.7 Nạp khóa ký vào volume signing_keys
docker compose --env-file .env -f deploy/docker-compose.yml run --rm --no-deps \
  -v "$PWD/signing-keys:/src:ro" --entrypoint sh sso-server \
  -c "cp /src/jwks.json /run/secrets/signing-keys/jwks.json"

# 2.8 Cert TLS: đặt cert THẬT vào deploy/nginx/certs/ (fullchain.pem +
#     privkey.pem). Không có cert thật thì sinh self-signed để dựng tạm:
bash deploy/gen-certs.sh

# 2.9 Lên stack ứng dụng, RỒI lên EDGE (edge có vòng đời riêng, file compose
#     riêng — thiếu bước này thì không có gì lắng nghe 80/443).
docker compose --env-file .env -f deploy/docker-compose.yml up -d --build
docker compose --env-file .env -f deploy/edge/docker-compose.yml up -d

# 2.10 Kiểm (qua EDGE, đúng domain thật — cổng 9443 đã bỏ từ khi tách edge)
curl -sk https://id.pmh.com.vn/api/health      # status:ok, db:up, provider:up
```

**Nghiệm thu phục hồi:** `/api/health` = ok, và **đăng nhập được** (thử tài khoản thật hoặc break-glass).

## 3. Kẹt MFA → break-glass

Nếu SSA mất thiết bị TOTP và không có recovery code:
- Đăng nhập bằng tài khoản `is_breakglass=true` (bỏ qua MFA, ghi audit `login.breakglass` nổi bật).
- Sau khi vào, enroll lại MFA cho SSA:
  ```bash
  docker compose -f deploy/docker-compose.yml exec sso-server \
    node scripts/enroll-mfa.js <email>            # quét QR
  docker compose -f deploy/docker-compose.yml exec sso-server \
    node scripts/enroll-mfa.js <email> --confirm <mã>
  ```

## 4. Khóa ký bị lộ → rotate khẩn

```bash
docker compose -f deploy/docker-compose.yml exec sso-server \
  node scripts/rotate-key.js emergency --leaked <kid-lộ>
docker compose -f deploy/docker-compose.yml restart sso-server
```
Ghi audit `signing_key.emergency_rotate`. Token cấp bằng kid lộ **hết verify ngay** (kid rút khỏi JWKS). Rotate định kỳ (không khẩn): `add` → restart → `promote <kid>` → restart → giữ khóa cũ ≥ (access TTL 5' + JWKS cache 10') rồi `retire`.

## 5. Cảnh báo out-of-band (đặt cron ngoài container)

```bash
# crontab host (mỗi 2 phút)
*/2 * * * * TELEGRAM_BOT_TOKEN=xxx TELEGRAM_CHAT_ID=yyy \
  HEALTH_URL=https://id.pmh.com.vn/api/health node /opt/pmh/deploy/monitor/alert.js
```
Bắn Telegram khi `/health` lỗi, provider down, scheduler chết, hoặc job kẹt.

## 6. Backup hằng đêm (TỰ ĐỘNG, chạy trong container)

Lịch nằm trong `docker-compose.yml` (service `backup-cron`), **không** dùng cron
host / Windows Task Scheduler — lịch nằm ngoài repo thì cài lại máy là mất mà
không ai biết. Service này lên cùng stack, giữ 30 bản, mốc `BACKUP_AT` (02:00).

```bash
# Xem lịch + lần chạy gần nhất
docker compose --env-file .env -f deploy/docker-compose.yml logs -f backup-cron

# Chạy tay một bản ngay (dùng CHUNG backup.sh với lịch, không lệch nhau)
docker compose --env-file .env -f deploy/docker-compose.yml \
  --profile backup run --rm backup

# Kiểm kho backup trên host
ls -lht "$BACKUP_DIR"          # bản mới nhất phải trong vòng 24h
```

Đích đến: `BACKUP_DIR` (thư mục host, khác đĩa với `pg_data`). `backup.sh` tự
verify giải mã được ngay sau khi tạo và xóa bản hỏng — nhưng **verify ≠ restore
thử**, xem mục 7.

## 7. Diễn tập

- **Đã diễn tập (scaled, 2026-07-05):** giải mã backup → restore `db.sql` vào DB sạch → 21 bảng + user + settings phục hồi, 0 lỗi; break-glass login xác minh ở Epic 2; rotate khóa overlap xác minh (token cũ vẫn verify).
- **Đã diễn tập (scaled, 2026-07-19) — nghiệm thu runbook sau khi sửa:** chạy ĐÚNG
  lệnh ở mục 2 trên bản `pmhid-backup-20260719-191339`. Giải mã bằng
  `-iter 200000` OK (đủ `.env` + `db.sql` + `signing-keys/jwks.json`); restore vào
  Postgres 16 sạch với `ON_ERROR_STOP=1` thoát mã 0; đối chiếu với DB nguồn khớp
  22 bảng / 10 user / 1 break-glass / 2 SSA / 2 client / 4 group / 17 settings
  (lệch đúng 7 dòng `audit_logs` phát sinh sau mốc backup và 1 migration chạy sau
  — giải thích được). **Then chốt:** TOTP secret trong DB phục hồi giải mã được
  bằng `KEK_BASE64` lấy từ `.env` NẰM TRONG CHÍNH bản backup → sau restore SSA
  KHÔNG kẹt ngoài. Đây là kiểm chứng thực tế của nguyên tắc §0.
- **Còn phải làm:** diễn tập **bare-metal ≤4h một lần** trên máy sạch thật (mục 2 đầu-cuối) — bấm đồng hồ, ghi lại thời gian từng bước. Đây là bài kiểm tra thật của runbook này; lịch: trước golive Phase 1.
