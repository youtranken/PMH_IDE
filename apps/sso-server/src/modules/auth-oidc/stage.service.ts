import { createHmac, timingSafeEqual } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/**
 * "Vé giai đoạn" đăng nhập nhiều bước (E2): sau khi mật khẩu ĐÚNG nhưng còn
 * bước phụ (đổi MK bắt buộc / MFA), server phát một vé HMAC-signed đặt trong
 * cookie httpOnly, ràng vào interaction `uid` + `userId`, TTL ngắn. Các bước
 * sau xác thực vé này thay vì tin FE nói "mật khẩu đã đúng".
 *
 * KHÔNG dùng access/refresh — đây là trạng thái tạm giữa các bước interaction,
 * chưa phải phiên đăng nhập.
 */
@Injectable()
export class StageService {
  static readonly COOKIE = "auth_stage";
  private static readonly TTL_MS = 5 * 60 * 1000; // 5' đủ cho vài bước
  private readonly secret: string;

  constructor(config: ConfigService) {
    // Dẫn xuất từ COOKIE_KEYS (đã là bí mật hạ tầng .env, AD-15)
    this.secret = config.getOrThrow<string>("COOKIE_KEYS").split(",")[0].trim();
  }

  /** Ký vé cho (uid,userId,step). `step` ràng vé vào ĐÚNG bước kế → không cho
   * nhảy cóc (vd bỏ qua đổi mật khẩu bắt buộc bằng cách gọi thẳng /mfa). */
  sign(uid: string, userId: string, step: string): string {
    const exp = Date.now() + StageService.TTL_MS;
    const body = `${uid}.${userId}.${step}.${exp}`;
    return `${body}.${this.mac(body)}`;
  }

  /** Trả userId nếu vé hợp lệ, khớp uid + step + chưa hết hạn; ngược lại null. */
  verify(
    token: string | undefined,
    uid: string,
    expectedStep: string,
  ): string | null {
    if (!token) return null;
    const parts = token.split(".");
    if (parts.length !== 5) return null;
    const [tUid, userId, step, expStr, mac] = parts;
    const body = `${tUid}.${userId}.${step}.${expStr}`;
    const expected = this.mac(body);
    if (
      mac.length !== expected.length ||
      !timingSafeEqual(Buffer.from(mac), Buffer.from(expected))
    ) {
      return null;
    }
    if (tUid !== uid) return null;
    if (step !== expectedStep) return null;
    const exp = Number.parseInt(expStr, 10);
    if (!Number.isFinite(exp) || Date.now() > exp) return null; // NaN → fail-closed
    return userId;
  }

  private mac(body: string): string {
    return createHmac("sha256", this.secret).update(body).digest("base64url");
  }
}
