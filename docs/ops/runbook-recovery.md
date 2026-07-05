# Runbook — Phục hồi PMH ID (SSO/IdP)

> Mục tiêu: từ **máy chủ trắng** hoặc **mất dữ liệu**, dựng lại tới trạng thái **đăng nhập được** trong **≤ 4 giờ**. Chống bus-factor 2 người vận hành (AD-16).

## 0. Nguyên tắc sống còn

- **Backup phải TRỌN BỘ.** Chỉ có `pg_dump` là **KHÔNG đủ**: thiếu `.env` (KEK) thì không giải mã được `mfa_totp.totp_secret_enc` → **SSA kẹt ngoài** (không qua được MFA). Backup của ta gói cả 3: `db.sql` + `.env` + `signing-keys/jwks.json`.
- **Đường cứu độc lập:** tài khoản **break-glass** (`is_breakglass=true`) bỏ qua MFA — dùng khi mất thiết bị TOTP.
- **Cảnh báo out-of-band** (`deploy/monitor/alert.js`) chạy NGOÀI hệ, không dựa vào email của chính SSO.

## 1. Cần có sẵn (cất offline)

| Thứ | Ở đâu |
|---|---|
| File backup `pmhid-backup-*.tar.gz.enc` | Ổ/máy khác (path `backup_path` trong Settings) |
| `BACKUP_PASSPHRASE` | Két/quản lý bí mật — KHÔNG cùng chỗ với backup |
| Mã nguồn repo (hoặc image đã build) | Git / registry nội bộ |
| Recovery code break-glass (in giấy) | Két |

## 2. Dựng lại trên host trắng

```bash
# 2.1 Cài Docker + Docker Compose v2, lấy mã nguồn
git clone <repo> pmh-ct && cd pmh-ct

# 2.2 Giải mã backup → lấy .env, khóa ký, db.sql
openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_PASSPHRASE \
  -in pmhid-backup-YYYYMMDD-HHMMSS.tar.gz.enc | tar -xzf -
#   → ./.env  ./db.sql  ./signing-keys/jwks.json

# 2.3 Kiểm .env đã ở gốc repo (bước 2.2 giải nén ra đây rồi)
ls -la .env                                   # phải thấy .env vừa giải nén
#   khóa ký (signing-keys/jwks.json) sẽ nạp vào volume ở bước 2.6

# 2.4 Dựng hạ tầng (Postgres trống trước)
docker compose --env-file .env -f deploy/docker-compose.yml up -d postgres
#   chờ postgres healthy:
until docker compose -f deploy/docker-compose.yml ps postgres | grep -q healthy; do sleep 2; done

# 2.5 Restore DB
PW=$(grep '^POSTGRES_PASSWORD=' .env | cut -d= -f2)
cat db.sql | docker compose -f deploy/docker-compose.yml exec -T \
  -e PGPASSWORD=$PW postgres psql -h 127.0.0.1 -U pmhid -d pmhid

# 2.6 Nạp khóa ký vào volume signing_keys
docker compose -f deploy/docker-compose.yml run --rm --no-deps \
  -v "$PWD/signing-keys:/src:ro" --entrypoint sh sso-server \
  -c "cp /src/jwks.json /run/secrets/signing-keys/jwks.json"

# 2.7 Sinh cert TLS (hoặc đặt cert thật vào deploy/nginx/certs) + lên toàn bộ
bash deploy/gen-certs.sh
docker compose --env-file .env -f deploy/docker-compose.yml up -d --build

# 2.8 Kiểm
curl -sk https://localhost:9443/api/health     # status:ok, db:up, provider:up
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

## 6. Backup hằng đêm (đặt cron ngoài container)

```bash
# 02:00 mỗi đêm — giữ 30 bản
0 2 * * * cd /opt/pmh && docker compose --env-file .env \
  -f deploy/docker-compose.yml --profile backup run --rm backup
```

## 7. Diễn tập

- **Đã diễn tập (scaled, 2026-07-05):** giải mã backup → restore `db.sql` vào DB sạch → 21 bảng + user + settings phục hồi, 0 lỗi; break-glass login xác minh ở Epic 2; rotate khóa overlap xác minh (token cũ vẫn verify).
- **Còn phải làm:** diễn tập **bare-metal ≤4h một lần** trên máy sạch thật (mục 2 đầu-cuối) — bấm đồng hồ, ghi lại thời gian từng bước. Đây là bài kiểm tra thật của runbook này; lịch: trước golive Phase 1.
