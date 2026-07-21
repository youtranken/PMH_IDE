/* Scene SVG ĐỘNG theo chủ đề từng dự án (inline DOM → animate bằng scenes.css).
   Map theo tên: hồ sơ → tài liệu; tài sản → toà nhà; mượn máy → thiết bị; còn lại
   → skyline thành phố. Dùng cho thẻ launcher, nền morph, và nền login. */
import type { ReactElement } from "react";
import { hashCode, themeFor, type Theme } from "./covers";
import "./scenes.css";

type Kind = "records" | "assets" | "supplies" | "devices" | "city";

export function sceneKindFor(name: string): Kind {
  const s = name.toLowerCase();
  if (/(hồ sơ|ho so|record|văn bản|van ban|tài liệu|tai lieu)/.test(s)) return "records";
  if (/(tài sản|tai san|asset|bất động|bat dong|property|kho)/.test(s)) return "assets";
  if (/(văn phòng phẩm|van phong pham|vpp|stationery|supplies|bút|but|giấy in)/.test(s)) return "supplies";
  if (/(mượn|muon|máy tính|may tinh|thiết bị|thiet bi|device|laptop|equipment)/.test(s)) return "devices";
  return "city";
}

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

function Frame({
  uid,
  theme,
  children,
  className,
}: {
  uid: string;
  theme: Theme;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <svg
      className={`sc-scene${className ? " " + className : ""}`}
      viewBox="0 0 400 280"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <defs>
        <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={theme.from} />
          <stop offset="1" stopColor={theme.to} />
        </linearGradient>
        <radialGradient id={`${uid}-glow`} cx="50%" cy="42%" r="55%">
          <stop offset="0" stopColor={theme.accent} stopOpacity="0.55" />
          <stop offset="1" stopColor={theme.accent} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}-sweep`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={theme.accent} stopOpacity="0" />
          <stop offset="0.5" stopColor={theme.accent} stopOpacity="0.16" />
          <stop offset="1" stopColor={theme.accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="400" height="280" fill={`url(#${uid}-sky)`} />
      {children}
    </svg>
  );
}

function skyline(seed: number, accent: string): ReactElement[] {
  const r = rng(seed);
  const els: ReactElement[] = [];
  let x = 10;
  let i = 0;
  while (x < 392) {
    const bw = 32 + Math.floor(r() * 36);
    const bh = 66 + Math.floor(r() * 150);
    const y = 252 - bh;
    els.push(<rect key={`b${i}`} x={x} y={y} width={bw} height={bh + 40} rx={2} fill="rgba(0,0,0,0.26)" />);
    for (let wy = y + 12; wy < 246; wy += 16) {
      for (let wx = x + 7; wx < x + bw - 6; wx += 13) {
        const tw = r() > 0.5;
        els.push(
          <rect
            key={`w${i}-${wx}-${wy}`}
            className={tw ? "sc-twinkle" : undefined}
            style={tw ? { animationDelay: `${(r() * 3.2).toFixed(2)}s` } : undefined}
            x={wx}
            y={wy}
            width={4.5}
            height={7}
            fill={accent}
            opacity={tw ? undefined : 0.32}
          />,
        );
      }
    }
    x += bw + 7 + Math.floor(r() * 12);
    i++;
  }
  return els;
}

function CityScene({ uid, theme, seed, className }: SceneProps) {
  return (
    <Frame uid={uid} theme={theme} className={className}>
      <circle className="sc-drift" cx="300" cy="66" r="130" fill={`url(#${uid}-glow)`} />
      {skyline(seed, theme.accent)}
      <rect className="sc-sweep" x="0" y="-60" width="400" height="60" fill={`url(#${uid}-sweep)`} />
    </Frame>
  );
}

function AssetsScene({ uid, theme, seed, className }: SceneProps) {
  const a = theme.accent;
  return (
    <Frame uid={uid} theme={theme} className={className}>
      <circle className="sc-drift" cx="300" cy="64" r="130" fill={`url(#${uid}-glow)`} />
      {skyline(seed, a)}
      {/* thẻ định giá tài sản trôi lên */}
      <g className="sc-float1" opacity="0.85">
        <rect x="60" y="150" width="30" height="20" rx="4" fill="none" stroke={a} strokeWidth="1.4" />
        <path d="M70 160h10M75 156v8" stroke={a} strokeWidth="1.4" strokeLinecap="round" />
      </g>
      <g className="sc-float2" opacity="0.7">
        <circle cx="130" cy="120" r="10" fill="none" stroke={a} strokeWidth="1.4" />
        <path d="M126 120h8M130 116v8" stroke={a} strokeWidth="1.3" strokeLinecap="round" />
      </g>
      <rect className="sc-sweep" x="0" y="-60" width="400" height="60" fill={`url(#${uid}-sweep)`} />
    </Frame>
  );
}

function RecordsScene({ uid, theme, className }: SceneProps) {
  const a = theme.accent;
  return (
    <Frame uid={uid} theme={theme} className={className}>
      <circle className="sc-drift" cx="270" cy="70" r="120" fill={`url(#${uid}-glow)`} />
      {/* ngăn hồ sơ + tài liệu trượt ra */}
      <g opacity="0.9" stroke={a} strokeWidth="1.6" fill="none">
        <rect x="150" y="150" width="110" height="78" rx="6" fill="rgba(0,0,0,0.18)" />
        <path d="M150 168h110" />
        <path d="M172 150v-10a6 6 0 0 1 6-6h20l8 10h28" />
      </g>
      <g className="sc-slide">
        <rect x="176" y="120" width="60" height="40" rx="4" fill="rgba(255,255,255,0.9)" />
        <path d="M184 132h44M184 140h44M184 148h30" stroke={theme.to} strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      </g>
      {/* trang giấy bay */}
      <rect className="sc-float1" x="90" y="150" width="34" height="44" rx="3" fill="none" stroke={a} strokeWidth="1.4" opacity="0.75" />
      <rect className="sc-float2" x="300" y="150" width="34" height="44" rx="3" fill="none" stroke={a} strokeWidth="1.4" opacity="0.6" />
      <rect className="sc-float3" x="52" y="180" width="26" height="34" rx="3" fill="none" stroke={a} strokeWidth="1.3" opacity="0.5" />
    </Frame>
  );
}

function DevicesScene({ uid, theme, className }: SceneProps) {
  const a = theme.accent;
  return (
    <Frame uid={uid} theme={theme} className={className}>
      <circle className="sc-pulse" cx="200" cy="150" r="120" fill={`url(#${uid}-glow)`} />
      {/* laptop */}
      <g stroke={a} strokeWidth="2" fill="none">
        <rect x="150" y="120" width="100" height="64" rx="6" fill="rgba(0,0,0,0.2)" />
        <path d="M132 196h136l-8-12H140z" fill="rgba(0,0,0,0.24)" />
        <path d="M168 138h64M168 150h48" strokeWidth="2.2" strokeLinecap="round" opacity="0.7" />
      </g>
      {/* thiết bị xoay quanh */}
      <g className="sc-orbit" style={{ transformOrigin: "200px 152px" }}>
        <g stroke={a} strokeWidth="1.6" fill="none" opacity="0.85">
          <rect x="70" y="80" width="26" height="16" rx="3" />
          <rect x="308" y="200" width="16" height="26" rx="3" />
          <circle cx="312" cy="86" r="9" />
          <rect x="80" y="210" width="22" height="22" rx="4" />
        </g>
      </g>
    </Frame>
  );
}

function SuppliesScene({ uid, theme, className }: SceneProps) {
  const a = theme.accent;
  return (
    <Frame uid={uid} theme={theme} className={className}>
      <circle className="sc-drift" cx="240" cy="70" r="120" fill={`url(#${uid}-glow)`} />
      {/* sổ tay + gáy + dòng kẻ */}
      <g stroke={a} strokeWidth="1.8" fill="none">
        <rect x="150" y="118" width="96" height="122" rx="6" fill="rgba(0,0,0,0.2)" />
        <path d="M172 118v122" opacity="0.5" />
        <path d="M186 140h48M186 158h48M186 176h34" strokeWidth="2" strokeLinecap="round" opacity="0.55" />
      </g>
      {/* bút chéo */}
      <g className="sc-slide" stroke={a} strokeWidth="3" strokeLinecap="round">
        <line x1="252" y1="234" x2="300" y2="150" />
        <path d="M300 150l7-15-13 5z" fill={a} stroke="none" />
      </g>
      {/* kẹp giấy bay */}
      <path className="sc-float1" d="M92 150c-8 0-8 8-8 14v22c0 9 13 9 13 0v-18" fill="none" stroke={a} strokeWidth="2" opacity="0.75" />
      {/* thước kẻ có vạch */}
      <g className="sc-float2" opacity="0.7">
        <rect x="298" y="202" width="62" height="14" rx="2" fill="none" stroke={a} strokeWidth="1.4" />
        <path d="M308 202v6M318 202v8M328 202v6M338 202v8M348 202v6" stroke={a} strokeWidth="1" />
      </g>
      <circle className="sc-float3" cx="112" cy="108" r="6" fill="none" stroke={a} strokeWidth="1.6" opacity="0.6" />
    </Frame>
  );
}

interface BandOpts {
  w: number;
  baseY: number;
  minH: number;
  maxH: number;
  win: string;
  fill: string;
  twinkleProb: number;
  sx: number;
  sy: number;
}
function band(seed: number, o: BandOpts, lightUp = false, noFlicker = false): ReactElement[] {
  const r = rng(seed);
  const els: ReactElement[] = [];
  let x = -30;
  let i = 0;
  while (x < o.w + 30) {
    const bw = 56 + Math.floor(r() * 116);
    const bh = o.minH + Math.floor(r() * (o.maxH - o.minH));
    const y = o.baseY - bh;
    els.push(<rect key={`b${i}`} x={x} y={y} width={bw} height={bh + 120} rx={2} fill={o.fill} />);
    if (o.twinkleProb > 0) {
      for (let wy = y + 20; wy < o.baseY - 16; wy += o.sy) {
        for (let wx = x + 14; wx < x + bw - 12; wx += o.sx) {
          if (r() > 0.34) {
            if (lightUp) {
              // Về chiều đèn bật DẦN rồi NHẤP NHÁY. Luôn tiêu thụ rng như nhau để
              // phản chiếu (noFlicker) khớp layout với skyline thật.
              const b = 2 + r() * 7;
              const willFlick = r() < 0.3;
              const fdur = 3 + r() * 4;
              const showFlick = willFlick && !noFlicker;
              els.push(
                <rect key={`w${i}-${wx}-${wy}`} x={wx} y={wy} width={5} height={9} fill={o.win} opacity={0}>
                  <animate attributeName="opacity" begin={`${b.toFixed(1)}s`} dur="1s" fill="freeze" values="0;0.9" />
                  {showFlick ? (
                    <animate attributeName="opacity" begin={`${(b + 1).toFixed(1)}s`} dur={`${fdur.toFixed(1)}s`} repeatCount="indefinite" values="0.9;0.5;0.92;0.15;0.85;0.6;0.9" />
                  ) : null}
                </rect>,
              );
            } else {
              const tw = r() < o.twinkleProb;
              els.push(
                <rect
                  key={`w${i}-${wx}-${wy}`}
                  className={tw ? "sc-twinkle" : undefined}
                  style={tw ? { animationDelay: `${(r() * 3.6).toFixed(2)}s` } : undefined}
                  x={wx}
                  y={wy}
                  width={5}
                  height={9}
                  fill={o.win}
                  opacity={tw ? undefined : 0.26}
                />,
              );
            }
          }
        }
      }
    }
    x += bw + 12 + Math.floor(r() * 34);
    i++;
  }
  return els;
}
function starField(seed: number, count: number, w: number, hMax: number): ReactElement[] {
  const r = rng(seed);
  const els: ReactElement[] = [];
  for (let i = 0; i < count; i++) {
    els.push(
      <circle
        key={`st${i}`}
        className="sc-twinkle"
        style={{ animationDelay: `${(r() * 3.4).toFixed(2)}s` }}
        cx={Math.floor(r() * w)}
        cy={Math.floor(r() * hMax)}
        r={(0.7 + r() * 1.7).toFixed(1)}
        fill="#fff"
        opacity="0.8"
      />,
    );
  }
  return els;
}

/** Chòm chim chữ V. */
function birds(cx: number, cy: number): ReactElement {
  return (
    <g stroke="#0a1620" strokeWidth="2.4" fill="none" strokeLinecap="round" opacity="0.7">
      <path d={`M${cx} ${cy}l8 -6 8 6`} />
      <path d={`M${cx + 22} ${cy + 8}l7 -5 7 5`} />
      <path d={`M${cx + 40} ${cy - 4}l6 -4 6 4`} />
    </g>
  );
}

/** Màn ĐĂNG NHẬP — cảnh hoàng hôn đô thị BĐS nhiều lớp, động. */
export function LoginScene() {
  const w = 1600;
  const h = 900;
  const horizon = 706;
  const nearOpts: BandOpts = { w: w + 60, baseY: horizon + 8, minH: 180, maxH: 430, win: "#ffcf8c", fill: "#111a2b", twinkleProb: 0.18, sx: 32, sy: 34 };
  return (
    <svg className="sc-scene" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        {/* Trời chuyển SÁNG → HOÀNG HÔN một lần (11s), giữ ở hoàng hôn. Refresh =
            chạy lại từ đầu (SMIL tự begin lúc tải trang). */}
        <linearGradient id="lg-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b2c56">
            <animate attributeName="stop-color" dur="11s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.42 0 0.58 1" values="#79aed6;#1b2c56" />
          </stop>
          <stop offset="0.3" stopColor="#4b4374">
            <animate attributeName="stop-color" dur="11s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.42 0 0.58 1" values="#a7cbe4;#4b4374" />
          </stop>
          <stop offset="0.52" stopColor="#9a566f">
            <animate attributeName="stop-color" dur="11s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.42 0 0.58 1" values="#d6e6ee;#9a566f" />
          </stop>
          <stop offset="0.72" stopColor="#dd8a55">
            <animate attributeName="stop-color" dur="11s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.42 0 0.58 1" values="#efe0c2;#dd8a55" />
          </stop>
          <stop offset="0.88" stopColor="#f3b56e">
            <animate attributeName="stop-color" dur="11s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.42 0 0.58 1" values="#f7ecd2;#f3b56e" />
          </stop>
          <stop offset="1" stopColor="#f7d089">
            <animate attributeName="stop-color" dur="11s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.42 0 0.58 1" values="#fbf4de;#f7d089" />
          </stop>
        </linearGradient>
        <radialGradient id="lg-sun" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#fff2cf" stopOpacity="1" />
          <stop offset="0.28" stopColor="#ffd79a" stopOpacity="0.85" />
          <stop offset="0.6" stopColor="#f0a765" stopOpacity="0.3" />
          <stop offset="1" stopColor="#f0a765" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="lg-water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c97d54" stopOpacity="0.12" />
          <stop offset="0.6" stopColor="#0d1a2b" stopOpacity="0.5" />
          <stop offset="1" stopColor="#0d1a2b" stopOpacity="0.92" />
        </linearGradient>
        {/* Gợn sóng nước — turbulence TĨNH (tính 1 lần, cache) + displacement; chuyển
            động lấy từ transform CSS .sc-water (GPU rẻ), KHÔNG animate baseFrequency. */}
        <filter id="lg-ripple" x="-6%" y="-6%" width="112%" height="120%">
          <feTurbulence type="turbulence" baseFrequency="0.012 0.05" numOctaves="2" seed="7" result="t" />
          <feDisplacementMap in="SourceGraphic" in2="t" scale="11" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        {/* Bloom/haze/god-ray — chỉ gradient, không filter per-frame */}
        <radialGradient id="lg-pool" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#ffcf8c" stopOpacity="0.5" />
          <stop offset="1" stopColor="#ffcf8c" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="lg-haze" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#dd9a68" stopOpacity="0" />
          <stop offset="1" stopColor="#e2a06b" stopOpacity="0.5" />
        </linearGradient>
        <linearGradient id="lg-ray" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#ffe6b0" stopOpacity="0.24" />
          <stop offset="1" stopColor="#ffe6b0" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="lg-balloon" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f0c169" />
          <stop offset="1" stopColor="#c9863a" />
        </linearGradient>
        <clipPath id="lg-water-clip">
          <rect x="0" y={horizon + 8} width={w} height={h - horizon} />
        </clipPath>
      </defs>

      <rect width={w} height={h} fill="url(#lg-sky)" />

      {/* mặt trời: TRÊN CAO lúc sáng → lặn hẳn xuống sau toà nhà (giữa-trái, thấy rõ) */}
      <g>
        <animateTransform attributeName="transform" type="translate" dur="11s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.35 0 0.6 1" values="-20 -300; 40 306" />
        <circle cx="540" cy="430" r="420" fill="url(#lg-sun)" />
        <circle cx="540" cy="430" r="120" fill="#ffe9bf">
          <animate attributeName="fill" dur="11s" fill="freeze" values="#fffdf6;#ffdca0" />
        </circle>
      </g>

      {/* sao: mờ dần HIỆN khi trời tối lại (1 lần, giữ) */}
      <g opacity="0">
        <animate attributeName="opacity" dur="11s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.6 0 0.7 1" values="0;0.85" />
        {starField(11, 40, w, 320)}
      </g>

      {/* mây dải trôi */}
      <g className="sc-cloud1" opacity="0.5">
        <ellipse cx="300" cy="200" rx="180" ry="20" fill="#f6d9b0" opacity="0.35" />
        <ellipse cx="520" cy="240" rx="130" ry="14" fill="#f6d9b0" opacity="0.25" />
      </g>
      <g className="sc-cloud2" opacity="0.45">
        <ellipse cx="-200" cy="150" rx="220" ry="18" fill="#ecc59a" opacity="0.3" />
      </g>

      {/* chim bay + khinh khí cầu trôi nhẹ */}
      <g className="sc-bird">{birds(120, 250)}</g>
      <g className="sc-bird2">{birds(60, 322)}</g>
      <g transform="translate(0 214)">
        <g className="sc-balloon">
          {/* vỏ khí cầu */}
          <path d="M0 8 C -42 8 -50 -60 0 -92 C 50 -60 42 8 0 8 Z" fill="url(#lg-balloon)" />
          {/* múi dọc */}
          <path d="M0 -92 L0 8 M0 -92 C -24 -54 -18 -12 0 8 M0 -92 C 24 -54 18 -12 0 8 M0 -92 C -41 -50 -31 -6 0 8 M0 -92 C 41 -50 31 -6 0 8" stroke="rgba(120,55,20,0.42)" strokeWidth="1.2" fill="none" />
          {/* sọc đỏ */}
          <path d="M-41 -46 Q 0 -33 41 -46" stroke="#c94a3a" strokeWidth="7" fill="none" opacity="0.75" />
          <path d="M-31 -20 Q 0 -10 31 -20" stroke="#c94a3a" strokeWidth="5" fill="none" opacity="0.5" />
          {/* dây + giỏ */}
          <path d="M-10 6 L-7 22 M10 6 L7 22 M-4 7 L-3 22 M4 7 L3 22" stroke="rgba(40,25,12,0.6)" strokeWidth="1.1" />
          <rect x="-8" y="22" width="16" height="12" rx="2" fill="#5a3a1e" />
        </g>
      </g>

      {/* skyline xa (silhouette lạnh, parallax chậm) */}
      <g className="sc-para" opacity="0.6">
        {band(21, { w: w + 60, baseY: horizon, minH: 90, maxH: 250, win: "#bcd0e0", fill: "#2b3a57", twinkleProb: 0.1, sx: 28, sy: 30 })}
      </g>
      {/* HAZE khí quyển ở chân trời → chiều sâu + backlight cho toà nhà silhouette */}
      <rect x="0" y={horizon - 150} width={w} height="205" fill="url(#lg-haze)" opacity="0.72" />
      {/* GOD-RAYS: tia nắng xuyên khe toà nhà, hiện dần về hoàng hôn (sau đó bị near che gốc) */}
      <g opacity="0">
        <animate attributeName="opacity" begin="4.5s" dur="6.5s" fill="freeze" values="0;0.6" />
        <g className="sc-ray">
          <polygon points="580,720 470,120 520,120" fill="url(#lg-ray)" />
          <polygon points="580,720 560,110 612,110" fill="url(#lg-ray)" />
          <polygon points="580,720 664,140 712,140" fill="url(#lg-ray)" />
          <polygon points="580,720 360,175 406,175" fill="url(#lg-ray)" />
        </g>
      </g>
      {/* skyline gần — cửa sổ bật đèn DẦN về chiều */}
      <g className="sc-para2">{band(37, nearOpts, true)}</g>
      {/* BLOOM: vũng sáng ấm phủ trên khu nhiều đèn, hiện dần về tối (rẻ, không filter) */}
      <g opacity="0">
        <animate attributeName="opacity" begin="4s" dur="7s" fill="freeze" values="0;0.8" />
        <circle className="sc-pulse" cx="250" cy="582" r="142" fill="url(#lg-pool)" />
        <circle className="sc-pulse" cx="900" cy="612" r="162" fill="url(#lg-pool)" style={{ animationDelay: "1.5s" }} />
        <circle className="sc-pulse" cx="1360" cy="580" r="132" fill="url(#lg-pool)" style={{ animationDelay: "0.7s" }} />
      </g>

      {/* cần cẩu tháp — dấu ấn "đang phát triển dự án BĐS" */}
      <g className="sc-crane" style={{ transformOrigin: "1360px 200px" }} stroke="#0a1420" strokeWidth="5" fill="none" strokeLinecap="round">
        <line x1="1360" y1="200" x2="1360" y2={horizon} />
        <path d="M1360 200l-40 22M1360 232l-40 22M1360 200l40 22M1360 232l40 22" strokeWidth="3" opacity="0.85" />
        <line x1="1180" y1="196" x2="1470" y2="196" strokeWidth="6" />
        <line x1="1470" y1="196" x2="1360" y2="176" strokeWidth="3" />
        <line x1="1180" y1="196" x2="1360" y2="176" strokeWidth="3" />
        <line x1="1250" y1="196" x2="1250" y2="250" strokeWidth="3" />
        <rect x="1244" y="250" width="12" height="16" fill="#0a1420" stroke="none" />
      </g>

      {/* foreground khung 2 mép */}
      <rect x="-10" y="220" width="150" height={horizon - 200} fill="#0a1420" opacity="0.9" />
      <rect x="1500" y="300" width="120" height={horizon - 280} fill="#0a1420" opacity="0.85" />

      {/* phản chiếu toà nhà lộn ngược xuống nước (cùng seed → khớp hàng thật),
          gợn sóng bằng filter cho chân thật */}
      <g clipPath="url(#lg-water-clip)" opacity="0.66">
        <g className="sc-water">
          <g filter="url(#lg-ripple)" transform={`translate(0 ${2 * (horizon + 8)}) scale(1 -1)`}>
            {band(37, nearOpts, true, true)}
          </g>
        </g>
      </g>
      {/* mặt nước phủ lên phản chiếu + lấp lánh */}
      <rect x="0" y={horizon + 8} width={w} height={h - horizon} fill="url(#lg-water)" />
      <g stroke="#ffd9a0" strokeWidth="3" strokeLinecap="round">
        <line className="sc-shimmer" x1="1080" y1={horizon + 60} x2="1280" y2={horizon + 60} />
        <line className="sc-shimmer" x1="1120" y1={horizon + 110} x2="1240" y2={horizon + 110} style={{ animationDelay: "1.2s" }} />
        <line className="sc-shimmer" x1="1060" y1={horizon + 160} x2="1300" y2={horizon + 160} style={{ animationDelay: "0.6s" }} />
      </g>
      <line x1="0" y1={horizon + 8} x2={w} y2={horizon + 8} stroke="#f2c078" strokeWidth="1.5" opacity="0.45" />

      {/* tàn sáng bay lên */}
      <g fill="#ffe0a6">
        <circle className="sc-rise1" cx="300" cy="760" r="2.6" opacity="0.8" />
        <circle className="sc-rise2" cx="720" cy="800" r="2" opacity="0.7" />
        <circle className="sc-rise3" cx="1120" cy="780" r="2.8" opacity="0.85" />
        <circle className="sc-rise4" cx="1420" cy="800" r="2.2" opacity="0.7" />
        <circle className="sc-rise2" cx="520" cy="780" r="1.8" opacity="0.6" />
      </g>
    </svg>
  );
}

interface SceneProps {
  uid: string;
  theme: Theme;
  seed: number;
  className?: string;
}

/** Scene động theo dự án. seed = client_id (deterministic). */
export function ProjectScene({
  name,
  seed,
  className,
}: {
  name: string;
  seed: string;
  className?: string;
}) {
  const kind = sceneKindFor(name);
  const props: SceneProps = {
    uid: "s" + (hashCode(seed) % 100000),
    theme: themeFor(seed),
    seed: hashCode(seed),
    className,
  };
  if (kind === "records") return <RecordsScene {...props} />;
  if (kind === "assets") return <AssetsScene {...props} />;
  if (kind === "supplies") return <SuppliesScene {...props} />;
  if (kind === "devices") return <DevicesScene {...props} />;
  return <CityScene {...props} />;
}
