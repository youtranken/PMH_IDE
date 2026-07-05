/**
 * Parser CSV tối giản đúng RFC4180 (E4-S3) — không kéo thêm dependency. Hỗ trợ
 * trường bọc "..." có dấu phẩy/xuống dòng bên trong, "" = một dấu ngoặc kép.
 * Bỏ dòng rỗng hoàn toàn. Trả mảng dòng, mỗi dòng là mảng ô đã trim ngoài ngoặc.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;
  const s = text.replace(/\r\n?/g, "\n"); // chuẩn hóa xuống dòng

  const endField = () => {
    row.push(field.trim());
    field = "";
  };
  const endRow = () => {
    endField();
    // Bỏ dòng rỗng (một ô rỗng duy nhất)
    if (!(row.length === 1 && row[0] === "")) rows.push(row);
    row = [];
  };

  while (i < s.length) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      endField();
      i++;
      continue;
    }
    if (c === "\n") {
      endRow();
      i++;
      continue;
    }
    field += c;
    i++;
  }
  // dòng cuối không có \n
  if (field !== "" || row.length > 0) endRow();
  return rows;
}

/** Tách danh sách group trong một ô (ngăn bằng ';'), bỏ rỗng + trùng. */
export function splitGroups(cell: string): string[] {
  const out: string[] = [];
  for (const g of cell.split(";")) {
    const name = g.trim();
    if (name && !out.includes(name)) out.push(name);
  }
  return out;
}
