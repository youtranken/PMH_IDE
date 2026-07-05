import { parseCsv, splitGroups } from "../src/modules/users/csv.util";

describe("parseCsv (RFC4180 tối giản)", () => {
  it("hàng đơn giản", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("ô bọc ngoặc có dấu phẩy bên trong", () => {
    expect(parseCsv('name,note\n"Nguyễn, Văn A",x')).toEqual([
      ["name", "note"],
      ["Nguyễn, Văn A", "x"],
    ]);
  });

  it('"" trong ngoặc = một dấu ngoặc kép', () => {
    expect(parseCsv('a\n"he said ""hi"""')).toEqual([["a"], ['he said "hi"']]);
  });

  it("ô bọc ngoặc có xuống dòng bên trong", () => {
    expect(parseCsv('a\n"dòng1\ndòng2"')).toEqual([["a"], ["dòng1\ndòng2"]]);
  });

  it("chuẩn hóa CRLF + bỏ dòng rỗng", () => {
    expect(parseCsv("a,b\r\n\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("splitGroups", () => {
  it("tách ';' + bỏ rỗng + bỏ trùng", () => {
    expect(splitGroups("Dev; Kế toán ;;Dev")).toEqual(["Dev", "Kế toán"]);
  });
  it("ô rỗng → mảng rỗng", () => {
    expect(splitGroups("")).toEqual([]);
  });
});
