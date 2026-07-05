import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

/** Lấy userId mà UserGuard đã gắn vào request. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    return ctx.switchToHttp().getRequest().userId as string;
  },
);
