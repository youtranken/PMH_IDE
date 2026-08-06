/* Scene SVG cho launcher — concept "BÀN KÍNH LAM" (The Light Table).
   Mỗi dự án là một TỜ GIẤY CAN: mực lam TỰ DỰNG nét (.sc-ink, pathLength=1)
   + ĐÚNG MỘT đường kích thước ĐỎ. 4 thẻ khác nhau theo LOẠI BẢN VẼ, không đổi
   màu. LoginScene (cảnh hoàng hôn) GIỮ NGUYÊN — đã deploy. */
import type { ReactElement } from "react";
import { hashCode } from "./covers";
import "./scenes.css";

type Kind = "records" | "assets" | "supplies" | "devices" | "city";

export function sceneKindFor(name: string): Kind {
  const s = name.toLowerCase();
  if (/(hồ sơ|ho so|record|văn bản|van ban|tài liệu|tai lieu)/.test(s)) return "records";
  if (/(tài sản|tai san|asset|bất động|bat dong|property|kho)/.test(s)) return "assets";
  if (/(văn phòng phẩm|van phong pham|vpp|stationery|supplies|bút|but|giấy in)/.test(s)) return "supplies";
  // Thiết bị/mượn gộp vào QLTS: QLTS nay quản cả tài sản lẫn mượn thiết bị → dùng chung AssetHolo3D (kind "assets").
  if (/(mượn|muon|máy tính|may tinh|thiết bị|thiet bi|device|laptop|equipment)/.test(s)) return "assets";
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

/* ================= BÀN KÍNH LAM — bảng màu + khung tờ ================= */
const INK = "#3f7fa6"; // mực lam nét chính
const INK_SOFT = "#6aa8c8"; // mực lam nhạt
const VELLUM = "#e7d9bd"; // giấy can
const VELLUM_HI = "#f4ebd7"; // giấy can sáng (tâm bàn)
const GRAPHITE = "#2b3038"; // chì than
const RED = "#e5533d"; // đỏ hiệu chỉnh — DUY NHẤT

/** Tờ giấy can. ghost = nền bàn kính: chỉ nét mực (bỏ giấy + khung tên),
 *  blend screen cho sáng trên mặt kính tối. */
function Sheet({
  uid,
  className,
  ghost,
  sheetNo,
  scale,
  children,
}: {
  uid: string;
  className?: string;
  ghost?: boolean;
  sheetNo: string;
  scale: string;
  children: React.ReactNode;
}) {
  return (
    <svg
      className={`sc-scene${className ? " " + className : ""}`}
      viewBox="0 0 400 280"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <defs>
        <radialGradient id={`${uid}-vg`} cx="40%" cy="34%" r="84%">
          <stop offset="0" stopColor={VELLUM_HI} />
          <stop offset="1" stopColor={VELLUM} />
        </radialGradient>
        <pattern id={`${uid}-grid`} width="22" height="22" patternUnits="userSpaceOnUse">
          <path d="M22 0H0V22" fill="none" stroke={INK} strokeWidth="0.5" opacity="0.13" />
        </pattern>
      </defs>
      {!ghost && (
        <>
          <rect width="400" height="280" fill={`url(#${uid}-vg)`} />
          <rect width="400" height="280" fill={`url(#${uid}-grid)`} />
          <Dust />
        </>
      )}
      <g style={ghost ? { mixBlendMode: "screen", opacity: 0.65 } : undefined}>{children}</g>
      {!ghost && (
        <g fontFamily="ui-monospace, 'Cascadia Code', Consolas, monospace">
          <rect x="284" y="250" width="114" height="28" fill={VELLUM_HI} stroke={INK} strokeWidth="1" opacity="0.8" />
          <line x1="284" y1="263" x2="398" y2="263" stroke={INK} strokeWidth="0.6" opacity="0.5" />
          <text x="290" y="260" fontSize="7.5" fill={GRAPHITE} opacity="0.72" letterSpacing="0.4">PMH · PHÒNG THIẾT KẾ</text>
          <text x="290" y="274" fontSize="9" fill={INK} fontWeight="700" letterSpacing="0.5">{sheetNo}</text>
          <text x="352" y="274" fontSize="8.5" fill={GRAPHITE} opacity="0.8">{scale}</text>
        </g>
      )}
    </svg>
  );
}

/** Vài hạt bụi trôi trong luồng đèn bàn (idle, gần như miễn phí GPU). */
function Dust(): ReactElement {
  return (
    <g fill={VELLUM_HI} opacity="0.55">
      <circle className="sc-float1" cx="120" cy="150" r="1.6" />
      <circle className="sc-float2" cx="262" cy="120" r="1.3" />
      <circle className="sc-float3" cx="322" cy="164" r="1.5" />
    </g>
  );
}

/** Mũi tên chỉ hướng Bắc — đặc trưng bản vẽ mặt bằng. */
function NorthArrow({ x, y }: { x: number; y: number }): ReactElement {
  return (
    <g stroke={INK} strokeWidth="1.3" fill="none" strokeLinejoin="round">
      <circle cx={x} cy={y} r="12" opacity="0.7" />
      <path d={`M${x} ${y - 11} L${x + 4} ${y + 2} L${x} ${y - 1} L${x - 4} ${y + 2} Z`} fill={INK} />
      <text x={x} y={y + 21} fontSize="8" fill={INK} textAnchor="middle" fontFamily="ui-monospace, monospace" stroke="none">B</text>
    </g>
  );
}

/** ĐÚNG MỘT đường kích thước ĐỎ (điểm nóng duy nhất) — vẽ sau nét lam. */
function RedDim({ x1, x2, y, label }: { x1: number; x2: number; y: number; label: string }): ReactElement {
  return (
    <g stroke={RED} strokeWidth="1.4" strokeLinecap="round">
      <path className="sc-dim" pathLength={1} d={`M${x1} ${y} H${x2}`} />
      <path d={`M${x1} ${y - 5} V${y + 5} M${x2} ${y - 5} V${y + 5}`} opacity="0.9" />
      <path d={`M${x1} ${y} l7 -3 v6 z M${x2} ${y} l-7 -3 v6 z`} fill={RED} stroke="none" />
      <text x={(x1 + x2) / 2} y={y - 7} fontSize="9.5" fill={RED} textAnchor="middle" fontFamily="ui-monospace, monospace" fontWeight="700" stroke="none">{label}</text>
    </g>
  );
}

/* ---- 4 LOẠI BẢN VẼ ---- */

/** TÀI SẢN → MẶT BẰNG TỔNG THỂ (site plan) — poché tường, lõi, cột, cây, đại lộ. */
function sitePlan(): ReactElement {
  const cols = [168, 190, 212, 234];
  const trees: [number, number][] = [
    [92, 116],
    [116, 138],
    [300, 100],
    [316, 128],
    [78, 150],
  ];
  return (
    <>
      {/* ranh giới thửa — nét đứt mảnh, góc vát */}
      <path d="M40 44 H316 L354 80 V236 H40 Z" fill="none" stroke={INK} strokeWidth="1.3" strokeDasharray="7 4" opacity="0.85" />

      {/* đại lộ cong + tim đường (nét tự dựng) */}
      <g fill="none" strokeLinecap="round">
        <path d="M40 214 Q 150 178 356 202" stroke={INK} strokeWidth="9" opacity="0.13" />
        <path className="sc-ink" pathLength={1} d="M40 214 Q 150 178 356 202" stroke={INK} strokeWidth="1.3" opacity="0.6" />
        <path className="sc-ink" pathLength={1} style={{ animationDelay: "0.25s" }} d="M40 192 Q 150 156 356 180" stroke={INK} strokeWidth="1.3" opacity="0.6" />
        <path d="M40 203 Q 150 167 356 191" stroke={INK} strokeWidth="1" strokeDasharray="7 7" opacity="0.5" />
      </g>

      {/* quảng trường nước trước toà hero */}
      <g>
        <rect x="150" y="164" width="112" height="30" rx="4" fill="rgba(63,127,166,0.14)" stroke={INK} strokeWidth="1" />
        <path d="M158 174 q 10 -5 20 0 t 20 0 t 20 0 t 20 0" fill="none" stroke={INK} strokeWidth="0.8" opacity="0.6" />
        <path d="M158 184 q 10 -5 20 0 t 20 0 t 20 0 t 20 0" fill="none" stroke={INK} strokeWidth="0.8" opacity="0.45" />
      </g>

      {/* TOÀ HERO — poché tường đặc + phòng + lõi + lưới cột */}
      <g>
        <rect x="150" y="70" width="112" height="86" fill={GRAPHITE} />
        <rect x="159" y="79" width="94" height="68" fill={VELLUM_HI} />
        <line x1="206" y1="79" x2="206" y2="147" stroke={GRAPHITE} strokeWidth="1" opacity="0.4" />
        <rect x="192" y="102" width="30" height="24" fill={GRAPHITE} />
        <g fill={INK}>
          {cols.flatMap((cx) => [90, 138].map((cy) => <circle key={`c${cx}-${cy}`} cx={cx} cy={cy} r="1.7" />))}
        </g>
      </g>

      {/* khối phụ trong khuôn viên */}
      <g stroke={INK} strokeWidth="1.4" fill="rgba(63,127,166,0.10)">
        <rect x="286" y="150" width="42" height="40" />
        <rect x="60" y="176" width="42" height="30" />
      </g>

      {/* cây xanh (tán) */}
      <g stroke={INK} strokeWidth="1" fill="none" opacity="0.75">
        {trees.map(([cx, cy], i) => (
          <g key={`t${i}`}>
            <circle cx={cx} cy={cy} r="8" />
            <circle cx={cx} cy={cy} r="1.5" fill={INK} />
          </g>
        ))}
      </g>

      {/* bãi đỗ — vạch ngắn */}
      <g stroke={INK} strokeWidth="1" opacity="0.55">
        {[0, 1, 2, 3, 4].map((i) => (
          <line key={`p${i}`} x1={116 + i * 11} y1={200} x2={116 + i * 11} y2={210} />
        ))}
      </g>

      <NorthArrow x={334} y={62} />

      {/* thước tỉ lệ chia vạch đen-trắng */}
      <g>
        <rect x="50" y="226" width="72" height="6" fill="none" stroke={GRAPHITE} strokeWidth="1" />
        <rect x="50" y="226" width="18" height="6" fill={GRAPHITE} />
        <rect x="86" y="226" width="18" height="6" fill={GRAPHITE} />
      </g>

      {/* dimension lam (cạnh trên) */}
      <g stroke={INK} strokeWidth="1" fill={INK} fontFamily="ui-monospace, monospace">
        <path d="M40 33 H316" />
        <path d="M40 29 V37 M316 29 V37" />
        <text x="178" y="28" fontSize="8" textAnchor="middle" stroke="none" opacity="0.9">96.0</text>
      </g>

      {/* ĐÚNG MỘT dimension ĐỎ — mặt tiền toà hero */}
      <RedDim x1={150} x2={262} y={62} label="128.4m" />
    </>
  );
}

/** HỒ SƠ → BỘ TỜ KHAI TRIỂN (chồng tờ đánh số + khung tên). */
function sheetSet(): ReactElement {
  const sheets = [
    { x: 96, y: 58, n: "H-03", top: false },
    { x: 80, y: 78, n: "H-02", top: false },
    { x: 62, y: 98, n: "H-01", top: true },
  ];
  return (
    <>
      {sheets.map((s) => (
        <g key={s.n}>
          <rect
            x={s.x}
            y={s.y}
            width="152"
            height="116"
            fill={s.top ? "rgba(244,235,215,0.94)" : "rgba(231,217,189,0.9)"}
            stroke={INK}
            strokeWidth="1.4"
          />
          {s.top && (
            <g fill="none" stroke={INK} strokeWidth="1.3" strokeLinecap="round">
              <path className="sc-ink" pathLength={1} d={`M${s.x + 16} ${s.y + 26} h88`} />
              <path className="sc-ink" pathLength={1} style={{ animationDelay: "0.3s" }} d={`M${s.x + 16} ${s.y + 44} h116`} />
              <path className="sc-ink" pathLength={1} style={{ animationDelay: "0.5s" }} d={`M${s.x + 16} ${s.y + 62} h72`} />
              <rect x={s.x + 16} y={s.y + 74} width="54" height="28" stroke={GRAPHITE} strokeWidth="1.2" />
            </g>
          )}
          <g fontFamily="ui-monospace, monospace">
            <rect x={s.x + 112} y={s.y + 100} width="40" height="16" fill={VELLUM_HI} stroke={INK} strokeWidth="0.9" />
            <text x={s.x + 132} y={s.y + 112} fontSize="8.5" fill={INK} textAnchor="middle" fontWeight="700">{s.n}</text>
          </g>
        </g>
      ))}
      <RedDim x1={62} x2={248} y={44} label="12 tờ" />
    </>
  );
}

/** VPP → BẢNG KÊ CHI TIẾT (schedule + detail callout + hatch). */
function schedule(): ReactElement {
  const rows = [0, 1, 2, 3, 4];
  return (
    <>
      <g stroke={INK} strokeWidth="1.2" fill="none">
        <rect x="46" y="58" width="212" height="152" fill="rgba(244,235,215,0.72)" />
        <line x1="46" y1="80" x2="258" y2="80" strokeWidth="1.5" />
        <line x1="92" y1="58" x2="92" y2="210" />
        <line x1="210" y1="58" x2="210" y2="210" />
        {rows.map((r) => (
          <line key={r} x1="46" y1={80 + (r + 1) * 25.6} x2="258" y2={80 + (r + 1) * 25.6} strokeWidth="0.8" opacity="0.55" />
        ))}
      </g>
      <g fontFamily="ui-monospace, monospace" fill={GRAPHITE}>
        <text x="54" y="75" fontSize="8">MÃ</text>
        <text x="120" y="75" fontSize="8">HẠNG MỤC</text>
        <text x="220" y="75" fontSize="8">SL</text>
      </g>
      {/* hạng mục — nét tự vẽ */}
      <g fill="none" stroke={INK} strokeWidth="1.2" strokeLinecap="round">
        <path className="sc-ink" pathLength={1} d="M100 98 h96" />
        <path className="sc-ink" pathLength={1} style={{ animationDelay: "0.3s" }} d="M100 124 h80" />
        <path className="sc-ink" pathLength={1} style={{ animationDelay: "0.5s" }} d="M100 150 h96" />
        <path className="sc-ink" pathLength={1} style={{ animationDelay: "0.7s" }} d="M100 176 h64" />
      </g>
      {/* ô hatch mẫu + detail callout */}
      <g>
        <rect x="298" y="96" width="56" height="56" fill="rgba(63,127,166,0.12)" stroke={GRAPHITE} strokeWidth="1.4" />
        <path d="M298 110 h56 M298 124 h56 M298 138 h56" stroke={INK} strokeWidth="0.7" opacity="0.5" />
        <circle className="sc-ink" pathLength={1} style={{ animationDelay: "0.9s" }} cx="326" cy="124" r="27" fill="none" stroke={INK_SOFT} strokeWidth="1.3" />
        <path d="M306 102 L292 82" stroke={INK} strokeWidth="1" />
        <text x="290" y="78" fontSize="8.5" fill={INK} fontFamily="ui-monospace, monospace" textAnchor="middle">D-04</text>
      </g>
      <RedDim x1={298} x2={354} y={166} label="0.60" />
    </>
  );
}

/** MƯỢN MÁY → SƠ ĐỒ ĐẤU NỐI / riser (node + ống, 1 nút giao ĐỎ = sẵn sàng). */
function riser(): ReactElement {
  const nodes = [
    { x: 80, y: 90 },
    { x: 200, y: 74 },
    { x: 320, y: 96 },
    { x: 120, y: 170 },
    { x: 250, y: 182 },
  ];
  return (
    <>
      <g fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path className="sc-ink" pathLength={1} d="M80 90 H200 V74" />
        <path className="sc-ink" pathLength={1} style={{ animationDelay: "0.3s" }} d="M200 74 H320 V96" />
        <path className="sc-ink" pathLength={1} style={{ animationDelay: "0.5s" }} d="M80 90 V170 H120" />
        <path className="sc-ink" pathLength={1} style={{ animationDelay: "0.7s" }} d="M200 74 V182 H250" />
      </g>
      <g stroke={GRAPHITE} strokeWidth="1.4" fill="rgba(244,235,215,0.92)">
        {nodes.map((n, i) => (
          <rect key={`n${i}`} x={n.x - 12} y={n.y - 9} width="24" height="18" rx="2" />
        ))}
      </g>
      <g stroke={INK} strokeWidth="1" fill="none">
        {nodes.map((n, i) => (
          <rect key={`s${i}`} x={n.x - 7} y={n.y - 5} width="14" height="10" />
        ))}
      </g>
      {/* NÚT GIAO ĐỎ = máy sẵn sàng (điểm nóng duy nhất) */}
      <g>
        <circle className="sc-pulse" cx="320" cy="96" r="15" fill="none" stroke={RED} strokeWidth="1.6" />
        <circle className="sc-pulse" cx="320" cy="96" r="4" fill={RED} />
      </g>
      <g fontFamily="ui-monospace, monospace" fill={GRAPHITE} opacity="0.85">
        <rect x="46" y="214" width="12" height="9" fill="none" stroke={INK} strokeWidth="1" />
        <text x="64" y="222" fontSize="8">= máy</text>
        <circle cx="150" cy="219" r="4" fill={RED} />
        <text x="160" y="222" fontSize="8" fill={RED}>= sẵn sàng</text>
      </g>
    </>
  );
}

/* ================= LOGIN SCENE (giữ nguyên — đã deploy) ================= */

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

/** Scene động theo dự án (concept Bàn Kính Lam). seed = client_id (deterministic).
 *  ghost = render cho nền bàn kính (chỉ nét mực, bỏ giấy). */
export function ProjectScene({
  name,
  seed,
  className,
  ghost,
}: {
  name: string;
  seed: string;
  className?: string;
  ghost?: boolean;
}) {
  const kind = sceneKindFor(name);
  const uid = "s" + (hashCode(seed) % 100000);
  const map = {
    assets: { sheetNo: "A-01", scale: "1:2000", content: sitePlan },
    records: { sheetNo: "H-01", scale: "BỘ 12 TỜ", content: sheetSet },
    supplies: { sheetNo: "S-03", scale: "BẢNG KÊ", content: schedule },
    devices: { sheetNo: "M&E-05", scale: "SƠ ĐỒ", content: riser },
    city: { sheetNo: "A-00", scale: "1:1000", content: sitePlan },
  } as const;
  const cfg = map[kind];
  return (
    <Sheet uid={uid} className={className} ghost={ghost} sheetNo={cfg.sheetNo} scale={cfg.scale}>
      {cfg.content()}
    </Sheet>
  );
}
