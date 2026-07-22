/** Hệ thị giác PMH ID — bản sắc "bất động sản": xanh lục thẫm + vàng đồng + đá. */

export const BRAND = {
  green: "#0E4D45", // xanh lục thẫm — đất/thịnh vượng/bền vững
  greenDeep: "#092e2a", // nền panel đăng nhập
  gold: "#C9A24B", // vàng đồng — cao cấp, dấu nhấn
  goldSoft: "#e6cf95",
  ink: "#16211F",
  stone: "#F3F5F3", // nền đá lạnh (không phải kem)
  muted: "#5f716c",
};

/**
 * Logo PMH ID — skyline (2 khối nhà cao thấp) trong tile bo góc: nói thẳng
 * "bất động sản", không phải khiên chung chung. `on` = nền để chọn màu.
 */
export function Brand({
  size = 28,
  on = "light",
}: {
  size?: number;
  on?: "light" | "dark";
}) {
  const tile = on === "dark" ? "rgba(255,255,255,0.06)" : "#eaf1ee";
  const line = on === "dark" ? BRAND.gold : BRAND.green;
  const accent = BRAND.gold;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <rect x="1" y="1" width="30" height="30" rx="8" fill={tile} />
      {/* toà cao */}
      <rect x="8.5" y="8" width="6" height="16" rx="1" stroke={line} strokeWidth="1.5" />
      {/* toà thấp */}
      <rect x="16" y="13" width="7" height="11" rx="1" stroke={line} strokeWidth="1.5" />
      {/* cửa sổ (dấu nhấn vàng) */}
      <path d="M10.2 11.5h2.6M10.2 14.5h2.6M10.2 17.5h2.6M18 16h3M18 19h3" stroke={accent} strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

/** Motif skyline nét vàng mảnh cho panel đăng nhập (signature). */
export function SkylineMotif() {
  return (
    <svg
      viewBox="0 0 400 200"
      preserveAspectRatio="xMidYMax slice"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.5 }}
      aria-hidden
    >
      <g stroke={BRAND.gold} strokeWidth="1" fill="none" opacity="0.55">
        <path d="M0 175h400" />
        <rect x="34" y="96" width="40" height="79" />
        <rect x="86" y="120" width="30" height="55" />
        <rect x="126" y="70" width="46" height="105" />
        <rect x="184" y="110" width="26" height="65" />
        <rect x="222" y="52" width="52" height="123" />
        <rect x="286" y="98" width="34" height="77" />
        <rect x="332" y="128" width="30" height="47" />
        {/* vài hàng cửa sổ */}
        <path d="M44 112h20M44 126h20M44 140h20M136 88h26M136 106h26M136 124h26M232 72h32M232 92h32M232 112h32" opacity="0.7" />
      </g>
    </svg>
  );
}

/** "2 phút trước", "hôm qua"… — dễ đọc hơn dấu thời gian máy. */
export function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 45) return "vừa xong";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} phút trước`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} giờ trước`;
  const d = Math.round(h / 24);
  if (d === 1) return "hôm qua";
  if (d < 30) return `${d} ngày trước`;
  return new Date(iso).toLocaleDateString("vi-VN");
}

/** Tên thiết bị/trình duyệt gọn từ user-agent. */
export function deviceName(ua: string | null): string {
  if (!ua) return "Thiết bị không rõ";
  const os =
    /Windows/.test(ua) ? "Windows"
    : /iPhone|iPad|iOS/.test(ua) ? "iOS"
    : /Mac OS X|Macintosh/.test(ua) ? "macOS"
    : /Android/.test(ua) ? "Android"
    : /Linux/.test(ua) ? "Linux"
    : "";
  const br =
    /Edg\//.test(ua) ? "Edge"
    : /Chrome\//.test(ua) ? "Chrome"
    : /Firefox\//.test(ua) ? "Firefox"
    : /Safari\//.test(ua) ? "Safari"
    : "Trình duyệt";
  return os ? `${br} · ${os}` : br;
}

/**
 * PageHeader — primitive dùng chung cho MỌI trang quản trị (playbook §4: thay
 * khối tiêu-đề + mô-tả + hành-động vốn bị copy-paste 5 nơi bằng inline style).
 * Style ở .pmh-ph* trong admin.css.
 */
export function PageHeader({
  title,
  sub,
  actions,
}: {
  title: string;
  sub?: string;
  actions?: import("react").ReactNode;
}) {
  return (
    <div className="pmh-ph">
      <div>
        <h1 className="pmh-ph__title">{title}</h1>
        {sub && <p className="pmh-ph__sub">{sub}</p>}
      </div>
      {actions && <div className="pmh-ph__actions">{actions}</div>}
    </div>
  );
}

/** Chữ cái đầu cho avatar. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
