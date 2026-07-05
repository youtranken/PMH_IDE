/** Tiện ích trình bày cho UX: logo, thời gian tương đối, tên thiết bị từ UA. */

/** Logo PMH ID — dấu "khiên/danh tính" (signature), dùng ở login + sidebar. */
export function Brand({ size = 28, color = "#1560a8" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <path
        d="M16 2.5 27 7v9c0 6.9-4.6 11.7-11 13.5C9.6 27.7 5 22.9 5 16V7l11-4.5Z"
        fill={color}
        opacity={0.12}
      />
      <path
        d="M16 2.5 27 7v9c0 6.9-4.6 11.7-11 13.5C9.6 27.7 5 22.9 5 16V7l11-4.5Z"
        stroke={color}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <circle cx="16" cy="13.5" r="3" stroke={color} strokeWidth={1.8} />
      <path d="M16 16.5v4" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
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

/** Tên thiết bị/trình duyệt gọn từ user-agent (đủ để user nhận ra máy mình). */
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

/** Chữ cái đầu cho avatar (từ tên hoặc chuỗi). */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
