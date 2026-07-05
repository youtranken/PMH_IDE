import { SetMetadata } from "@nestjs/common";
import type { AdminRole } from "./admin.types";

export const ROLES_KEY = "admin_roles_required";

/**
 * Giới hạn route theo vai trò admin. Không gắn = mọi admin (SSA hoặc
 * project_admin) đều vào. Gắn @Roles("ssa") = chỉ SSA (vd khóa/xóa toàn cục).
 */
export const Roles = (...roles: AdminRole[]) => SetMetadata(ROLES_KEY, roles);
