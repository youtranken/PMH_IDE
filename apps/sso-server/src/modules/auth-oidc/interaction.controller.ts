import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  GoneException,
  Inject,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from "class-validator";
import type { Request, Response } from "express";
import { AuditService } from "../../common/audit.service";
import { OIDC_PROVIDER } from "../../oidc/oidc.module";
import type { OidcProviderInstance } from "../../oidc/provider.factory";
import { LoginService } from "./login.service";
import { MfaService } from "./mfa.service";
import { PasswordPolicyService } from "./password-policy.service";
import { RateLimitService } from "./rate-limit.service";
import { StageService } from "./stage.service";

class LoginDto {
  @IsString() @IsNotEmpty() email!: string;
  @IsString() @IsNotEmpty() password!: string;
}
class ChangePasswordDto {
  @IsString() @IsNotEmpty() newPassword!: string;
}
class MfaDto {
  @IsString() @IsNotEmpty() code!: string;
  @IsOptional() @IsBoolean() recovery?: boolean;
}

/** Bước tiếp theo trong luồng đăng nhập nhiều bước. */
type NextStep = "change_password" | "mfa" | "done";

const STAGE_COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: true, // luôn sau Nginx TLS
  path: "/",
};

/**
 * API cho trang đăng nhập SPA (AD-3). Luồng nhiều bước (Epic 2):
 *   password → [đổi MK bắt buộc] → [MFA] → hoàn tất.
 * Trạng thái "đã qua mật khẩu" giữ bằng vé HMAC (StageService), không tin FE.
 */
@Controller("interaction")
export class InteractionController {
  constructor(
    @Inject(OIDC_PROVIDER) private readonly provider: OidcProviderInstance,
    private readonly login: LoginService,
    private readonly policy: PasswordPolicyService,
    private readonly mfa: MfaService,
    private readonly rateLimit: RateLimitService,
    private readonly stage: StageService,
    private readonly audit: AuditService,
  ) {}

  @Get(":uid")
  async details(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const d = await this.guardInteraction(() =>
      this.provider.interactionDetails(req, res),
    );
    return { uid: d.uid, prompt: d.prompt.name, clientId: d.params.client_id };
  }

  @Post(":uid/login")
  async submitLogin(
    @Param("uid") uid: string,
    @Body() body: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const d = await this.guardInteraction(() =>
      this.provider.interactionDetails(req, res),
    );
    const clientId = d.params.client_id as string;
    const ip = req.ip ?? null;

    // Backoff theo account (AD-9) — chặn dò, không lockout cứng
    const wait = await this.rateLimit.retryAfterSeconds(body.email);
    if (wait > 0) {
      res.status(429);
      return { error: "rate_limited", retryAfter: wait };
    }

    const result = await this.login.validate(body.email, body.password);
    await this.rateLimit.record(body.email, null, ip, !!result);
    if (!result) {
      await this.audit.record({
        action: "login.failed",
        targetType: "client",
        targetId: clientId,
        ip,
        detail: { email: body.email },
      });
      // Thông điệp ĐỒNG NHẤT — không lộ email có tồn tại hay không (FR-01)
      throw new UnauthorizedException("Email hoặc mật khẩu không đúng");
    }

    // Cổng LOGIN theo client_groups (E5-S3, AD-11): user đúng MK nhưng không có
    // quyền vào app này → chặn NGAY sau khi định danh (trước đổi MK/MFA).
    if (!(await this.login.isAllowedForClient(result.userId, clientId))) {
      await this.audit.record({
        actorUserId: result.userId,
        action: "login.denied_no_access",
        targetType: "client",
        targetId: clientId,
        ip,
      });
      throw new ForbiddenException("Bạn không có quyền truy cập ứng dụng này");
    }

    const mfaStatus = await this.mfa.status(result.userId);
    if (mfaStatus.isBreakglass) {
      // Đăng nhập break-glass — ghi audit NỔI BẬT (E2-S2)
      await this.audit.record({
        actorUserId: result.userId,
        action: "login.breakglass",
        targetType: "user",
        targetId: result.userId,
        ip,
        detail: { warning: "Đăng nhập bằng tài khoản break-glass" },
      });
    }

    const next = await this.resolveNext(
      result.userId,
      result.mustChangePassword,
      result.passwordUpdatedAt,
      mfaStatus.enabled && !mfaStatus.isBreakglass,
    );
    return this.advance(uid, result.userId, next, req, res);
  }

  @Post(":uid/change-password")
  async changePassword(
    @Param("uid") uid: string,
    @Body() body: ChangePasswordDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userId = this.requireStage(req, uid, "change_password");
    await this.policy.assertValid(body.newPassword);
    await this.login.setPassword(userId, body.newPassword);
    await this.audit.record({
      actorUserId: userId,
      action: "password.changed",
      targetType: "user",
      targetId: userId,
      ip: req.ip ?? null,
      detail: { via: "login-forced-change" },
    });

    // Đổi xong: còn MFA thì đi tiếp, không thì hoàn tất
    const mfaRequired = await this.mfa.isRequired(userId);
    return this.advance(uid, userId, mfaRequired ? "mfa" : "done", req, res);
  }

  @Post(":uid/mfa")
  async submitMfa(
    @Param("uid") uid: string,
    @Body() body: MfaDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userId = this.requireStage(req, uid, "mfa");
    const ip = req.ip ?? null;

    // Rate-limit bước MFA theo user (AD-9 — trước chỉ phủ password/token, hở
    // bước MFA cho brute TOTP/recovery). Backoff, không lockout cứng.
    const rlKey = `mfa:${userId}`;
    const wait = await this.rateLimit.retryAfterSeconds(rlKey);
    if (wait > 0) {
      res.status(429);
      return { error: "rate_limited", retryAfter: wait };
    }

    const ok = body.recovery
      ? await this.mfa.consumeRecoveryCode(userId, body.code)
      : await this.mfa.verifyTotp(userId, body.code);
    await this.rateLimit.record(rlKey, null, ip, ok);
    if (!ok) {
      await this.audit.record({
        actorUserId: userId,
        action: "mfa.failed",
        targetType: "user",
        targetId: userId,
        ip,
      });
      throw new UnauthorizedException("Mã xác thực không đúng");
    }
    if (body.recovery) {
      await this.audit.record({
        actorUserId: userId,
        action: "mfa.recovery_used",
        targetType: "user",
        targetId: userId,
        ip: req.ip ?? null,
      });
    }
    return this.finish(uid, userId, req, res);
  }

  // ---- helpers ----

  /**
   * Cookie interaction hết hạn/mất (form mở quá lâu, tab cũ) → oidc-provider ném
   * SessionNotFound (mã 'invalid_request'). Đổi thành 410 rõ nghĩa để FE hiện
   * "phiên hết hạn, đăng nhập lại" thay vì lỗi 'invalid_request' khó hiểu.
   */
  private async guardInteraction<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      if ((e as { name?: string })?.name === "SessionNotFound") {
        throw new GoneException({ error: "interaction_expired" });
      }
      throw e;
    }
  }

  private async resolveNext(
    userId: string,
    mustChange: boolean,
    pwUpdatedAt: Date | null,
    mfaRequired: boolean,
  ): Promise<NextStep> {
    if (mustChange || (await this.policy.isExpired(pwUpdatedAt))) {
      return "change_password";
    }
    if (mfaRequired) return "mfa";
    return "done";
  }

  /** Hoàn tất nếu 'done', ngược lại phát vé giai đoạn + báo FE bước kế. */
  private async advance(
    uid: string,
    userId: string,
    next: NextStep,
    req: Request,
    res: Response,
  ) {
    if (next === "done") return this.finish(uid, userId, req, res);
    // Vé ràng vào ĐÚNG bước kế → không nhảy cóc bỏ đổi mật khẩu
    res.cookie(
      StageService.COOKIE,
      this.stage.sign(uid, userId, next),
      STAGE_COOKIE_OPTS,
    );
    return { next };
  }

  private async finish(
    uid: string,
    userId: string,
    req: Request,
    res: Response,
  ) {
    // Lấy client_id TRƯỚC interactionResult (nó kết thúc interaction) để gắn
    // vào audit login.success (E6-S3, FR-29).
    let clientId: string | null = null;
    try {
      const d = await this.provider.interactionDetails(req, res);
      clientId = (d.params.client_id as string) ?? null;
    } catch {
      /* interaction có thể đã hết — vẫn ghi login.success không kèm client */
    }
    const redirectTo = await this.guardInteraction(() =>
      this.provider.interactionResult(
        req,
        res,
        { login: { accountId: userId } },
        { mergeWithLastSubmission: false },
      ),
    );
    res.clearCookie(StageService.COOKIE, { path: "/" });
    await this.audit.record({
      actorUserId: userId,
      action: "login.success",
      targetType: clientId ? "client" : undefined,
      targetId: clientId ?? undefined,
      ip: req.ip ?? null,
    });
    return { redirectTo };
  }

  private requireStage(req: Request, uid: string, expectedStep: string): string {
    const token = (req.cookies as Record<string, string> | undefined)?.[
      StageService.COOKIE
    ];
    const userId = this.stage.verify(token, uid, expectedStep);
    if (!userId) {
      throw new UnauthorizedException("Phiên đăng nhập đã hết hạn, thử lại");
    }
    return userId;
  }
}
