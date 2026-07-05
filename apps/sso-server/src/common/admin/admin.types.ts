/** Vai trò quản trị (bảng admin_roles). */
export type AdminRole = "ssa" | "project_admin";

/**
 * Ngữ cảnh admin gắn vào request sau AdminGuard. `isSsa` = toàn quyền (khóa/
 * xóa toàn cục); `projectIds` = phạm vi của project_admin (rỗng nếu chỉ SSA).
 */
export interface AdminContext {
  userId: string;
  roles: AdminRole[];
  isSsa: boolean;
  projectIds: string[];
}
