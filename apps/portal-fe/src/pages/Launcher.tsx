import { useEffect, useRef, useState } from "react";
import { motion, MotionConfig } from "framer-motion";
import type { Swiper as SwiperClass } from "swiper";
import { Swiper, SwiperSlide } from "swiper/react";
import { A11y, EffectCoverflow, Mousewheel, Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/effect-coverflow";
import "swiper/css/pagination";
import { api } from "../auth";
import { SkylineMotif } from "../ui";
import { ProjectScene, sceneKindFor } from "../scenes";
import AssetHolo3D from "../AssetHolo3D";
import LoanDock3D from "../LoanDock3D";
import RecordVault3D from "../RecordVault3D";
import SupplyBox3D from "../SupplyBox3D";
import "./Launcher.css";

interface AppItem {
  client_id: string;
  name: string;
  app_url: string;
  env: string;
  image_url?: string | null; // ảnh phối cảnh thật (khi có) — override ảnh mẫu
}

const hostOf = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

/** Đính cờ ?sso=1 vào URL mở app. Cả link (rel=noreferrer) lẫn header no-referrer của
 *  cổng đều giấu Referer, nên app đích KHÔNG thể tự biết "đến từ portal" để chạy SSO
 *  thẳng — cờ tường minh này là tín hiệu đó (app đích không đọc thì bỏ qua vô hại). */
const withLaunchFlag = (url: string) => {
  try {
    const u = new URL(url);
    u.searchParams.set("sso", "1");
    return u.toString();
  } catch {
    return url;
  }
};

/** Scene 3D theo loại dự án (null = dùng ProjectScene SVG). */
function scene3DFor(name: string) {
  const kind = sceneKindFor(name);
  if (kind === "assets") return <AssetHolo3D />;
  if (kind === "devices") return <LoanDock3D />;
  if (kind === "records") return <RecordVault3D />;
  if (kind === "supplies") return <SupplyBox3D />;
  return null;
}

function AppCard({ app }: { app: AppItem }) {
  const isProd = app.env === "prod";
  return (
    // <a> thật thay cho div role=button: mở tab giữa/chuột phải/copy link hoạt
    // động, Enter sẵn có, screen-reader đọc đúng "liên kết".
    <a
      className="pmh-card"
      href={withLaunchFlag(app.app_url)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Mở ${app.name}`}
    >
      <div className="pmh-card__top">
        {app.image_url ? (
          <div className="pmh-card__img" style={{ backgroundImage: `url("${app.image_url}")` }} />
        ) : (
          scene3DFor(app.name) ?? <ProjectScene name={app.name} seed={app.client_id || app.name} />
        )}
        <div className="pmh-card__scrim" />
        <span className={`pmh-card__env${isProd ? " pmh-card__env--prod" : ""}`}>
          {app.env}
        </span>
      </div>
      <div className="pmh-card__body">
        <div className="pmh-card__name">{app.name}</div>
        <div className="pmh-card__host">{hostOf(app.app_url)}</div>
        <div className="pmh-card__cta">
          <span>Mở dự án</span>
          <svg className="pmh-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </a>
  );
}

/** Launcher (E6-S1, FR-09): coverflow 3D các dự án user được cấp quyền.
 *  fill = chiếm trọn màn hình (immersive, không sidebar) cho member. */
export default function Launcher({ greeting, fill }: { greeting?: string; fill?: boolean }) {
  const [apps, setApps] = useState<AppItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const [pageHidden, setPageHidden] = useState(false);
  const swiperRef = useRef<SwiperClass | null>(null);
  const targetRef = useRef(0); // đích điều hướng phím tích luỹ (không đọc realIndex đang chạy)

  // Tab ẩn → gắn class .is-hidden để CSS đóng băng animation (đỡ hao pin/GPU).
  useEffect(() => {
    const onVis = () => setPageHidden(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const load = () => {
    setApps(null);
    setError(null);
    api<AppItem[]>("/api/me/apps")
      .then((a) => { setApps(a); setError(null); })
      .catch((e) => { setApps([]); setError((e as Error).message); });
  };
  useEffect(load, []);

  const firstName = greeting?.trim().split(/\s+/).pop() ?? "";
  const n = apps?.length ?? 0;
  const loop = n > 3;
  const activeApp = apps && n ? apps[Math.min(active, n - 1)] : null;

  // Điều hướng phím ◀▶ tự quản: gộp phím theo "đích" tích luỹ rồi slideToLoop —
  // lệnh này CẮT NGANG hiệu ứng coverflow đang chạy, nên bấm nhanh/qua lại không
  // bị nuốt phím và không nhảy sai dự án. (Module Keyboard mặc định bỏ qua phím
  // khi đang animating → gõ N lần chỉ nhích vài slide.) base đọc từ realIndex khi
  // đứng yên (đồng bộ với kéo/chuột), đọc từ targetRef khi đang chạy (tích luỹ).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const sw = swiperRef.current;
      if (!sw || sw.destroyed || n < 2) return;
      const el = document.activeElement;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      const r = sw.el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return; // coverflow ngoài màn hình → bỏ qua
      e.preventDefault();
      const dir = e.key === "ArrowRight" ? 1 : -1;
      const base = sw.animating ? targetRef.current : sw.realIndex;
      if (loop) {
        const t = (((base + dir) % n) + n) % n;
        targetRef.current = t;
        sw.slideToLoop(t);
      } else {
        const t = Math.max(0, Math.min(n - 1, base + dir));
        targetRef.current = t;
        sw.slideTo(t);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [n, loop]);

  return (
    <MotionConfig reducedMotion="user">
    <div className={`pmh-launch${pageHidden ? " is-hidden" : ""}`}>
      <div className={`pmh-hero${fill ? " pmh-hero--fill" : ""}`}>
        {/* Nền MORPH theo thẻ đang chọn — vuốt tới đâu nền ngập màu dự án đó */}
        {activeApp && (
          <div
            className={`pmh-hero__bg${!activeApp.image_url && scene3DFor(activeApp.name) ? " pmh-hero__bg--3d" : ""}`}
            key={activeApp.client_id}
          >
            {activeApp.image_url ? (
              <div className="pmh-card__img" style={{ backgroundImage: `url("${activeApp.image_url}")` }} />
            ) : (
              scene3DFor(activeApp.name) ?? (
                <ProjectScene name={activeApp.name} seed={activeApp.client_id || activeApp.name} ghost />
              )
            )}
          </div>
        )}
        <SkylineMotifWrap />
        <div className="pmh-hero__stage">
        <motion.div
          className="pmh-hero__head"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
        >
          <div className="pmh-hero__eyebrow">Phòng thiết kế dự án · PMH ID</div>
          <h1 className="pmh-hero__title">
            Xin chào, <em>{firstName || "bạn"}</em>
          </h1>
          <div className="pmh-hero__sub">
            {apps === null
              ? "Đang tải các dự án của bạn…"
              : n > 0
                ? `${n} dự án đang chờ · lướt hoặc kéo để chọn`
                : ""}
          </div>
        </motion.div>

        {apps === null ? (
          <div className="pmh-skel">
            {[0, 1, 2].map((i) => (
              <div key={i} className="pmh-skel__card" />
            ))}
          </div>
        ) : n === 0 ? (
          <div className="pmh-state">
            <div className="pmh-state__ico">{error ? "!" : "✦"}</div>
            <div className="pmh-state__title">
              {error ? "Không tải được danh sách dự án" : "Chưa có dự án nào được cấp"}
            </div>
            <div className="pmh-state__sub">
              {error
                ? "Kiểm tra kết nối mạng rồi thử lại."
                : "Liên hệ quản trị để được thêm vào nhóm dự án phù hợp."}
            </div>
            {error && (
              <button type="button" className="pmh-state__retry" onClick={load}>
                Thử lại
              </button>
            )}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.15, ease: "easeOut" }}
          >
            <Swiper
              className="pmh-swiper"
              modules={[EffectCoverflow, Pagination, Mousewheel, A11y]}
              effect="coverflow"
              grabCursor
              centeredSlides
              slidesPerView="auto"
              loop={loop}
              initialSlide={loop ? 0 : Math.min(1, n - 1)}
              coverflowEffect={{ rotate: 26, stretch: 0, depth: 110, modifier: 1, slideShadows: false }}
              mousewheel={{ forceToAxis: true }}
              pagination={{ clickable: true }}
              onSwiper={(sw) => { swiperRef.current = sw; targetRef.current = sw.realIndex; setActive(sw.realIndex); }}
              onSlideChange={(sw) => setActive((prev) => (prev === sw.realIndex ? prev : sw.realIndex))}
            >
              {apps.map((a) => (
                <SwiperSlide key={a.client_id} className="pmh-slide">
                  <AppCard app={a} />
                </SwiperSlide>
              ))}
            </Swiper>
          </motion.div>
        )}
        </div>
      </div>
    </div>
    </MotionConfig>
  );
}

/** Motif skyline đặt dưới đáy hero (bọc để nhận class định vị). */
function SkylineMotifWrap() {
  return (
    <div className="pmh-hero__skyline">
      <SkylineMotif />
    </div>
  );
}
