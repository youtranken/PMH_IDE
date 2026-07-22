import { Body, Controller, Inject, Post, Req, Res } from "@nestjs/common";
import { IsEmail, IsNotEmpty, IsString } from "class-validator";
import type { Request, Response } from "express";
import { Pool } from "pg";
import { AuditService } from "../../common/audit.service";
import { PG_POOL } from "../../database/database.module";
import { PasswordResetService } from "../users/password-reset.service";
import { RateLimitService } from "./rate-limit.service";

class ForgotDto {
  @IsEmail() email!: string;
}

class ResetDto {
  @IsString() @IsNotEmpty() token!: string;
  @IsString() @IsNotEmpty() password!: string;
}

/**
 * Quên / đặt lại mật khẩu tự phục vụ (E4-S8, FR-11). Gửi LINK đặt lại (token
 * 256-bit, C2) qua email thay vì ghi đè MK hiện tại — biết email KHÔNG vô hiệu
 * được MK nạn nhân. Phản hồi ĐỒNG NHẤT (không lộ email tồn tại). Chống lạm dụng
 * bằng backoff theo email VÀ theo IP (namespace riêng, không đầu độc counter
 * per-IP của /interaction/login).
 */
@Controller("auth")
export class ForgotPasswordController {
  private static readonly UNIFORM = {
    ok: true,
    message:
      "Nếu email tồn tại, hệ thống đã gửi liên kết đặt lại mật khẩu qua email.",
  };

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly rateLimit: RateLimitService,
    private readonly passwordReset: PasswordResetService,
    private readonly audit: AuditService,
  ) {}

  @Post("forgot-password")
  async forgot(
    @Body() body: ForgotDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const email = body.email.trim().toLowerCase();
    const ip = req.ip ?? null;
    const emailKey = `forgot:${email}`;
    // Backoff theo IP dùng namespace RIÊNG (`forgot-ip:`) và ghi identifier chứ
    // KHÔNG ghi cột `ip` → không bơm counter per-IP dùng chung với /login (tránh
    // ~20 lượt quên-MK sau một NAT công ty làm backoff luôn đăng nhập mọi người).
    const ipKey = ip ? `forgot-ip:${ip}` : null;

    const waitEmail = await this.rateLimit.retryAfterSeconds(emailKey);
    const waitIp = ipKey ? await this.rateLimit.retryAfterSeconds(ipKey) : 0;
    const wait = Math.max(waitEmail, waitIp);
    if (wait > 0) {
      res.status(429);
      return { error: "rate_limited", retryAfter: wait };
    }
    await this.rateLimit.record(emailKey, null, null, false);
    if (ipKey) await this.rateLimit.record(ipKey, null, null, false);

    // Loại break-glass: BYPASS MFA nên không cho tự phục vụ quên-MK (hòm thư
    // thành đường MỘT yếu tố vào SSA). Khôi phục break-glass theo runbook offline.
    const { rows } = await this.pool.query<{ id: string }>(
      `SELECT id FROM users
       WHERE lower(email) = $1 AND deleted_at IS NULL AND status = 'active'
         AND is_breakglass = false`,
      [email],
    );
    if (rows.length > 0) {
      await this.passwordReset.issue(rows[0].id);
      await this.audit.record({
        actorUserId: rows[0].id,
        action: "password.reset_requested",
        targetType: "user",
        targetId: rows[0].id,
        ip,
      });
    }
    return ForgotPasswordController.UNIFORM;
  }

  @Post("reset-password")
  async reset(
    @Body() dto: ResetDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = req.ip ?? null;
    // Backoff theo IP: chặn dò token hàng loạt + DoS argon2 (redeem hash MK).
    const ipKey = ip ? `reset-ip:${ip}` : null;
    const wait = ipKey ? await this.rateLimit.retryAfterSeconds(ipKey) : 0;
    if (wait > 0) {
      res.status(429);
      return { error: "rate_limited", retryAfter: wait };
    }
    if (ipKey) await this.rateLimit.record(ipKey, null, null, false);

    // redeem ném BadRequest (400) khi token sai/hết hạn hoặc MK không đạt policy.
    await this.passwordReset.redeem(dto.token, dto.password, ip);
    return { ok: true };
  }
}
