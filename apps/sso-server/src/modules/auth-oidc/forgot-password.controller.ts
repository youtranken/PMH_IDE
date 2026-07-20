import { Body, Controller, Inject, Post, Req, Res } from "@nestjs/common";
import * as argon2 from "argon2";
import { IsEmail } from "class-validator";
import type { Request, Response } from "express";
import { Pool } from "pg";
import { AuditService } from "../../common/audit.service";
import { PG_POOL } from "../../database/database.module";
import { TempPasswordService } from "../users/temp-password.service";
import { RateLimitService } from "./rate-limit.service";

class ForgotDto {
  @IsEmail() email!: string;
}

/**
 * Quên mật khẩu tự phục vụ (E4-S8, FR-11). Gửi MK tạm (E4-S5) qua email.
 * KHÔNG tiết lộ email có tồn tại hay không: phản hồi ĐỒNG NHẤT + chạy argon2
 * "mồi" khi không có user để cân thời gian (chống dò như đăng nhập). Chống lạm
 * dụng bằng backoff theo email (AD-9), reuse RateLimitService.
 */
@Controller("auth")
export class ForgotPasswordController {
  private static readonly UNIFORM = {
    ok: true,
    message: "Nếu email tồn tại, hệ thống đã gửi mật khẩu tạm qua email.",
  };

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly rateLimit: RateLimitService,
    private readonly tempPassword: TempPasswordService,
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
    const key = `forgot:${email}`;

    // Backoff theo email — chặn spam gửi mail / dò. Mỗi request tính một "lần".
    const wait = await this.rateLimit.retryAfterSeconds(key);
    if (wait > 0) {
      res.status(429);
      return { error: "rate_limited", retryAfter: wait };
    }
    // Backoff RIÊNG theo email (key) — KHÔNG ghi `ip` để không bơm counter
    // per-IP dùng chung với /interaction/login: nếu không, ~20 lượt quên-MK hợp
    // lệ sau một NAT công ty sẽ backoff luôn đăng nhập của mọi người (L3).
    await this.rateLimit.record(key, null, null, false);

    // Loại break-glass: tài khoản này BYPASS MFA (mfa.isRequired) nên nếu cho
    // tự phục vụ quên-MK thì hòm thư trở thành đường MỘT yếu tố vào SSA. Khôi
    // phục break-glass đi theo runbook offline. (Đồng bộ với users.list/get,
    // directory, csv-export — mọi nơi khác đều đã ẩn.)
    const { rows } = await this.pool.query<{ id: string }>(
      `SELECT id FROM users
       WHERE lower(email) = $1 AND deleted_at IS NULL AND status = 'active'
         AND is_breakglass = false`,
      [email],
    );

    if (rows.length > 0) {
      await this.tempPassword.issue(rows[0].id);
      await this.audit.record({
        actorUserId: rows[0].id,
        action: "password.forgot_requested",
        targetType: "user",
        targetId: rows[0].id,
        ip,
      });
    } else {
      // Cân thời gian: không có user vẫn chạy một argon2.hash mồi (issue() cũng
      // hash) để phản hồi không nhanh hơn lộ "email không tồn tại".
      await argon2.hash(email).catch(() => {});
    }
    return ForgotPasswordController.UNIFORM;
  }
}
