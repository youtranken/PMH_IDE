import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Swiper, SwiperSlide } from "swiper/react";
import { A11y, EffectCoverflow, Keyboard, Mousewheel, Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/effect-coverflow";
import "swiper/css/pagination";
import { api } from "../auth";
import { SkylineMotif } from "../ui";
import { ProjectScene } from "../scenes";
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

function AppCard({ app }: { app: AppItem }) {
  const open = () => window.open(app.app_url, "_blank", "noopener");
  const isProd = app.env === "prod";
  return (
    <div
      className="pmh-card"
      role="button"
      tabIndex={0}
      aria-label={`Mở ${app.name}`}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
    >
      <div className="pmh-card__top">
        {app.image_url ? (
          <div className="pmh-card__img" style={{ backgroundImage: `url("${app.image_url}")` }} />
        ) : (
          <ProjectScene name={app.name} seed={app.client_id || app.name} />
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
    </div>
  );
}

/** Launcher (E6-S1, FR-09): coverflow 3D các dự án user được cấp quyền.
 *  fill = chiếm trọn màn hình (immersive, không sidebar) cho member. */
export default function Launcher({ greeting, fill }: { greeting?: string; fill?: boolean }) {
  const [apps, setApps] = useState<AppItem[] | null>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    api<AppItem[]>("/api/me/apps").then(setApps).catch(() => setApps([]));
  }, []);

  const firstName = greeting?.trim().split(/\s+/).pop() ?? "";
  const n = apps?.length ?? 0;
  const loop = n > 3;
  const activeApp = apps && n ? apps[Math.min(active, n - 1)] : null;

  return (
    <div className="pmh-launch">
      <div className={`pmh-hero${fill ? " pmh-hero--fill" : ""}`}>
        {/* Nền MORPH theo thẻ đang chọn — vuốt tới đâu nền ngập màu dự án đó */}
        {activeApp && (
          <div className="pmh-hero__bg" key={activeApp.client_id}>
            {activeApp.image_url ? (
              <div className="pmh-card__img" style={{ backgroundImage: `url("${activeApp.image_url}")` }} />
            ) : (
              <ProjectScene name={activeApp.name} seed={activeApp.client_id || activeApp.name} />
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
            <div className="pmh-state__ico">✦</div>
            <div className="pmh-state__title">Chưa có dự án nào được cấp</div>
            <div className="pmh-state__sub">
              Liên hệ quản trị để được thêm vào nhóm dự án phù hợp.
            </div>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.15, ease: "easeOut" }}
          >
            <Swiper
              className="pmh-swiper"
              modules={[EffectCoverflow, Pagination, Keyboard, Mousewheel, A11y]}
              effect="coverflow"
              grabCursor
              centeredSlides
              slidesPerView="auto"
              loop={loop}
              initialSlide={loop ? 0 : Math.min(1, n - 1)}
              coverflowEffect={{ rotate: 34, stretch: 0, depth: 150, modifier: 1, slideShadows: true }}
              keyboard={{ enabled: true }}
              mousewheel={{ forceToAxis: true }}
              pagination={{ clickable: true }}
              onSwiper={(sw) => setActive(sw.realIndex)}
              onSlideChange={(sw) => setActive(sw.realIndex)}
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
