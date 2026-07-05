import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { AdminContext } from "./admin.types";

/** Lấy AdminContext mà AdminGuard đã gắn vào request. */
export const CurrentAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AdminContext => {
    return ctx.switchToHttp().getRequest().admin as AdminContext;
  },
);
