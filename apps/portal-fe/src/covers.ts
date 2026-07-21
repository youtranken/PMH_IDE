/* Ảnh "phối cảnh" MẪU sinh bằng SVG (self-contained data URI). Tạm thời thay cho
   ảnh render thật của dự án — mỗi seed một bố cục + tông riêng (deterministic).
   Khi có ảnh thật: truyền app.image_url vào coverUri() để override. */

export interface Theme {
  from: string;
  to: string;
  accent: string;
}
export const THEMES: Theme[] = [
  { from: "#12564d", to: "#082925", accent: "#e6cf95" }, // ngọc lục – vàng (brand)
  { from: "#134a51", to: "#082a2e", accent: "#9fd8cf" }, // xanh lam ngọc
  { from: "#16324e", to: "#0a1d2e", accent: "#a9cdec" }, // lam sapphire
  { from: "#3a2c1a", to: "#1b1206", accent: "#e8c98a" }, // đồng thau
  { from: "#33233f", to: "#170f1f", accent: "#d6b3df" }, // mận
  { from: "#2c3a20", to: "#131a0d", accent: "#cede93" }, // ô liu
];

export function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
export function themeFor(seed: string): Theme {
  return THEMES[hashCode(seed) % THEMES.length];
}

/** RNG deterministic (mulberry32) — cùng seed → cùng bố cục nhà. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Dãy cao ốc silhouette + cửa sổ sáng (accent), cắm dưới đáy w×baseY. */
function skyline(seed: number, w: number, baseY: number, accent: string): string {
  const r = rng(seed);
  let out = "";
  let x = -10;
  while (x < w) {
    const bw = Math.round((w / 12) * (0.6 + r() * 1.1));
    const bh = Math.round(baseY * (0.28 + r() * 0.66));
    const y = baseY - bh;
    out += `<rect x="${x}" y="${y}" width="${bw}" height="${bh + 40}" rx="2" fill="rgba(0,0,0,0.3)"/>`;
    const stepX = Math.max(12, Math.round(bw / 5));
    const stepY = Math.max(14, Math.round(bh / 10));
    for (let wy = y + stepY; wy < baseY - stepY / 2; wy += stepY) {
      for (let wx = x + stepX; wx < x + bw - stepX / 2; wx += stepX) {
        if (r() > 0.45) {
          const o = (0.25 + r() * 0.6).toFixed(2);
          out += `<rect x="${wx}" y="${wy}" width="${Math.round(stepX * 0.4)}" height="${Math.round(stepY * 0.5)}" fill="${accent}" opacity="${o}"/>`;
        }
      }
    }
    x += bw + Math.round(w / 60 + r() * (w / 40));
  }
  return out;
}

function renderSvg(seed: number, theme: Theme, w: number, h: number): string {
  const r = rng(seed ^ 0x9e3779b9);
  const sunX = Math.round(w * (0.14 + r() * 0.72));
  const sunY = Math.round(h * (0.16 + r() * 0.22));
  const baseY = Math.round(h * 0.9);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice">` +
    `<defs>` +
    `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${theme.from}"/><stop offset="1" stop-color="${theme.to}"/>` +
    `</linearGradient>` +
    `<radialGradient id="sun" cx="50%" cy="50%" r="50%">` +
    `<stop offset="0" stop-color="${theme.accent}" stop-opacity="0.85"/>` +
    `<stop offset="0.5" stop-color="${theme.accent}" stop-opacity="0.22"/>` +
    `<stop offset="1" stop-color="${theme.accent}" stop-opacity="0"/>` +
    `</radialGradient>` +
    `</defs>` +
    `<rect width="${w}" height="${h}" fill="url(#sky)"/>` +
    `<circle cx="${sunX}" cy="${sunY}" r="${Math.round(h * 0.42)}" fill="url(#sun)"/>` +
    // đường chân trời mảnh vàng
    `<line x1="0" y1="${baseY}" x2="${w}" y2="${baseY}" stroke="${theme.accent}" stroke-width="1" opacity="0.5"/>` +
    skyline(seed, w, baseY, theme.accent) +
    `</svg>`
  );
}

function toUri(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Ảnh cover cho thẻ (tỉ lệ ngang). override = app.image_url thật nếu có. */
export function coverUri(seedStr: string, override?: string | null): string {
  if (override) return override;
  const seed = hashCode(seedStr);
  return toUri(renderSvg(seed, THEMES[seed % THEMES.length], 480, 320));
}

/** Ảnh hero cho màn đăng nhập (rộng, kịch tính hơn). */
export function loginHeroUri(seedStr = "pmh-id-login"): string {
  const seed = hashCode(seedStr);
  return toUri(renderSvg(seed, THEMES[0], 1600, 1000));
}
