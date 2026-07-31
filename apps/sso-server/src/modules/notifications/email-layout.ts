/**
 * Khung email HTML dùng chung cho mọi mail giao dịch (đặt lại MK, MK tạm, cảnh
 * báo hết hạn, gửi thử). Ưu tiên:
 *  - TƯƠNG THÍCH client email: layout bằng <table role="presentation"> + CSS
 *    INLINE (client email bỏ qua <style>/JS). Gradient/box-shadow có fallback
 *    bgcolor cho Outlook.
 *  - AN TOÀN (OWASP A03 Injection/XSS): KHÔNG JS, KHÔNG ảnh ngoài. Dữ liệu người
 *    dùng PHẢI được escape ở NƠI GỌI trước khi nhét vào `intro/outro/highlight`.
 *    href nút + heading được escape ở đây (defense-in-depth).
 *  - WCAG AA: <html lang="vi">, <h1> ngữ nghĩa, tương phản chữ ≥ 4.5:1 (trắng
 *    trên #0E4D45 ~9:1; ink/muted trên trắng đạt AA/AAA), không phụ thuộc màu.
 */

/** Escape ngữ cảnh HTML/thuộc tính — chống chèn mã qua tên user, giá trị động. */
export function escapeHtml(v: string): string {
  return v.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ] as string,
  );
}

export interface EmailContent {
  /** Tiêu đề lớn trong thân email (chuỗi tĩnh — vẫn escape phòng xa). */
  heading: string;
  /** Đoạn mở đầu — HTML đã AN TOÀN (escape user data ở nơi gọi). */
  intro: string;
  /** Ô nổi bật cho giá trị quan trọng (MK tạm / ngày hết hạn). value phải escaped. */
  highlight?: { label: string; value: string; note?: string };
  /** Nút hành động chính; href được escape cho ngữ cảnh thuộc tính tại đây. */
  cta?: { label: string; href: string };
  /** Đoạn kết / lưu ý — HTML đã AN TOÀN. */
  outro?: string;
  /** Chữ xem-trước ẩn (preheader) hiện ở hộp thư trước khi mở. */
  preheader?: string;
}

const C = {
  green: "#0E4D45",
  greenDark: "#0a3a34",
  gold: "#C9A24B",
  goldSoft: "#e6cf95",
  ink: "#16211F",
  body: "#3a4744",
  muted: "#5f716c",
  bg: "#eef1f0",
  card: "#ffffff",
  line: "#e3e8e6",
  boxBg: "#f4f7f6",
};
const FONT = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace";

function button(href: string, label: string): string {
  const h = escapeHtml(href);
  const l = escapeHtml(label);
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 4px;">
    <tr>
      <td align="center" bgcolor="${C.green}" style="border-radius:10px;">
        <a href="${h}" target="_blank" style="display:inline-block;padding:14px 32px;font-family:${FONT};font-size:16px;font-weight:700;line-height:1;color:#ffffff;text-decoration:none;border-radius:10px;letter-spacing:.2px;">${l}</a>
      </td>
    </tr>
  </table>`;
}

function highlightBox(h: { label: string; value: string; note?: string }): string {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0;">
    <tr>
      <td style="background:${C.boxBg};border:1px solid ${C.line};border-left:4px solid ${C.gold};border-radius:10px;padding:16px 20px;">
        <div style="font-family:${FONT};font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:${C.muted};">${h.label}</div>
        <div style="font-family:${MONO};font-size:24px;font-weight:700;color:${C.ink};margin-top:6px;word-break:break-all;">${h.value}</div>
        ${h.note ? `<div style="font-family:${FONT};font-size:13px;color:${C.muted};margin-top:6px;">${h.note}</div>` : ""}
      </td>
    </tr>
  </table>`;
}

/** Dựng email HTML hoàn chỉnh từ nội dung (đã escape ở nơi gọi). */
export function renderEmail(c: EmailContent): string {
  const pre = c.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;opacity:0;color:transparent;">${escapeHtml(c.preheader)}</div>`
    : "";
  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(c.heading)}</title>
</head>
<body style="margin:0;padding:0;background:${C.bg};-webkit-text-size-adjust:100%;">
${pre}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg};">
  <tr>
    <td align="center" style="padding:34px 16px;">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" style="width:520px;max-width:100%;background:${C.card};border-radius:16px;overflow:hidden;box-shadow:0 1px 2px rgba(16,33,31,.04),0 12px 32px rgba(16,33,31,.09);">
        <tr><td style="height:4px;background:${C.gold};font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr>
          <td bgcolor="${C.green}" style="background:linear-gradient(135deg,${C.green},${C.greenDark});padding:26px 34px;">
            <div style="font-family:${FONT};font-size:20px;font-weight:800;color:#ffffff;letter-spacing:.4px;">PMH&nbsp;ID</div>
            <div style="font-family:${FONT};font-size:12px;color:${C.goldSoft};letter-spacing:2px;text-transform:uppercase;margin-top:4px;">Định danh nội bộ</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 34px 8px;">
            <h1 style="margin:0 0 14px;font-family:${FONT};font-size:22px;line-height:1.3;font-weight:700;color:${C.ink};">${escapeHtml(c.heading)}</h1>
            <div style="font-family:${FONT};font-size:15.5px;line-height:1.65;color:${C.body};">${c.intro}</div>
            ${c.highlight ? highlightBox(c.highlight) : ""}
            ${c.cta ? button(c.cta.href, c.cta.label) : ""}
            ${c.outro ? `<div style="font-family:${FONT};font-size:14px;line-height:1.6;color:${C.muted};margin-top:20px;">${c.outro}</div>` : ""}
          </td>
        </tr>
        <tr>
          <td style="padding:24px 34px 30px;">
            <div style="height:1px;background:${C.line};margin-bottom:18px;font-size:0;line-height:0;">&nbsp;</div>
            <div style="font-family:${FONT};font-size:12.5px;line-height:1.6;color:${C.muted};">Email tự động từ hệ thống PMH ID — vui lòng không trả lời thư này.</div>
          </td>
        </tr>
      </table>
      <div style="font-family:${FONT};font-size:11.5px;color:${C.muted};margin-top:16px;">© PMH ID</div>
    </td>
  </tr>
</table>
</body>
</html>`;
}
