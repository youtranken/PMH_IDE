import { Injectable } from "@nestjs/common";

/** Cột của file mẫu nhập user (đồng bộ với CsvImportService). */
export const IMPORT_COLUMNS = [
  "employee_code",
  "email",
  "full_name",
  "department",
  "groups",
] as const;

/**
 * File MẪU (template) để nhập user hàng loạt (E4-S4). Trước đây xuất dữ liệu user
 * thật; đổi thành template rỗng (tiêu đề + 1 dòng ví dụ) để admin điền rồi Import.
 * `department` phải trùng tên trong danh mục Phòng ban; `groups` nhiều nhóm cách
 * nhau bằng dấu chấm phẩy.
 */
@Injectable()
export class CsvExportService {
  /** Trả nội dung CSV mẫu (RFC4180, CRLF). */
  template(): string {
    const example = [
      "NV001",
      "a.nguyen@pmh.com.vn",
      "Nguyễn Văn A",
      "Kế toán",
      "Kế toán;Sales",
    ];
    return [IMPORT_COLUMNS.join(","), example.map(csvCell).join(",")].join(
      "\r\n",
    );
  }
}

/**
 * Bọc ô CSV (RFC4180) + chống FORMULA INJECTION: ô mở đầu bằng = + - @ (hoặc
 * tab/CR) bị Excel/Sheets thực thi như công thức → chèn dấu ' phía trước.
 */
function csvCell(v: string): string {
  const guarded = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\n\r]/.test(guarded)
    ? `"${guarded.replace(/"/g, '""')}"`
    : guarded;
}
