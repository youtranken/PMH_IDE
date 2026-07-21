import "./LoanDock3D.css";

/* "Mượn máy tính" — TRẠM MƯỢN–TRẢ (CSS 3D, không text).
   Kệ dock 3 tầng bên trái (2 máy nằm dock teal); laptop HỔ PHÁCH nhấc khỏi
   kệ → bay vòng cung sang BÀN HỌP hologram → MỞ màn hình (3 chấm người sáng
   quanh bàn = đang họp) → gập máy bay về dock lại; ô kệ trống nháy hổ phách
   suốt lúc máy được mượn. Loop 14s. Thuần transform/opacity — nhẹ GPU. */

export default function LoanDock3D({ className }: { className?: string }) {
  return (
    <div className={`loan3${className ? " " + className : ""}`} aria-hidden>
      <div className="loan3-stage">
        <div className="loan3-tilt">
          {/* kệ dock 3 tầng */}
          <div className="loan3-dock">
            <div className="loan3-slot loan3-slot--1"><i className="loan3-slab" /></div>
            <div className="loan3-slot loan3-slot--2" />
            <div className="loan3-slot loan3-slot--3"><i className="loan3-slab" /></div>
            <div className="loan3-post loan3-post--l" />
            <div className="loan3-post loan3-post--r" />
          </div>
          <div className="loan3-glow loan3-glow--dock" />

          {/* laptop hero bay mượn — trả */}
          <div className="loan3-fly">
            <div className="loan3-lap">
              <div className="loan3-base" />
              <div className="loan3-lid" />
            </div>
          </div>

          {/* bàn họp hologram + 3 người */}
          <div className="loan3-table">
            <div className="loan3-ring" />
            <div className="loan3-ring loan3-ring--dash" />
            <div className="loan3-p loan3-p--1" />
            <div className="loan3-p loan3-p--2" />
            <div className="loan3-p loan3-p--3" />
          </div>
          <div className="loan3-glow loan3-glow--table" />
        </div>
      </div>

      {/* hạt dữ liệu trôi */}
      <div className="loan3-bit" style={{ left: "18%", top: "30%" }} />
      <div className="loan3-bit" style={{ left: "84%", top: "36%", animationDelay: "1.8s" }} />
      <div className="loan3-bit" style={{ left: "60%", top: "22%", animationDelay: "3.4s" }} />
      <div className="loan3-bit" style={{ left: "10%", top: "64%", animationDelay: "4.6s" }} />
    </div>
  );
}
