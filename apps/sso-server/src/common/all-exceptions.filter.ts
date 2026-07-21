import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";

/**
 * Bắt MỌI lỗi lọt khỏi route /api (Nest router). Mục tiêu prod:
 *  - Lỗi KHÔNG phải HttpException (bug, DB blip) → 500 sạch: CHE stack/thông tin
 *    nội bộ khỏi client, log đầy đủ phía server kèm requestId để tra ngược.
 *  - HttpException giữ NGUYÊN status + body (không đổi hợp đồng lỗi FE đang dùng
 *    — y hệt filter mặc định của Nest).
 *  - Gắn X-Request-Id để đối soát log ⇄ báo lỗi người dùng.
 * KHÔNG phủ /oidc (mount TRƯỚC Nest trong stack express) — provider tự render lỗi.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger("Exception");

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const reqId =
      (req.headers["x-request-id"] as string | undefined)?.slice(0, 64) ||
      randomUUID();
    res.setHeader("X-Request-Id", reqId);

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      // 4xx là lỗi phía client → không log cho đỡ nhiễu. 5xx (hiếm khi ném qua
      // HttpException) vẫn đáng ghi lại.
      if (status >= 500) {
        this.logger.error(
          `${req.method} ${req.url} → ${status} [${reqId}]`,
          exception.stack,
        );
      }
      res.status(status).json(exception.getResponse());
      return;
    }

    // Lỗi lạ: chỉ trả generic 500, KHÔNG lộ message/stack ra ngoài.
    this.logger.error(
      `${req.method} ${req.url} → 500 [${reqId}] ${
        exception instanceof Error ? exception.message : String(exception)
      }`,
      exception instanceof Error ? exception.stack : undefined,
    );
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: 500,
      error: "Internal Server Error",
      message: "Có lỗi hệ thống. Vui lòng thử lại hoặc liên hệ quản trị.",
      requestId: reqId,
    });
  }
}
