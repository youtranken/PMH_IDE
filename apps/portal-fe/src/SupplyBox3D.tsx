import "./SupplyBox3D.css";

/* "Quản lý văn phòng phẩm" — ĐÓNG THÙNG CẤP PHÁT (CSS 3D, không text).
   3 món bay lần lượt từ KỆ vào THÙNG hở nắp 3D (bút chì xoay, sổ tay,
   cuộn băng keo) — mỗi lần bắt thùng nháy sáng; đủ 3 món thì ĐẬY NẮP
   loé vàng = sẵn sàng cấp phát. Tông mận/coral. Loop 13s. Nhẹ GPU. */

export default function SupplyBox3D({ className }: { className?: string }) {
  return (
    <div className={`sup3${className ? " " + className : ""}`} aria-hidden>
      <div className="sup3-stage">
        <div className="sup3-tilt">
          {/* kệ VPP 2 tầng + đồ chờ */}
          <div className="sup3-shelf">
            <div className="sup3-plank sup3-plank--1">
              <i className="sup3-mini sup3-mini--pen" />
              <i className="sup3-mini sup3-mini--tape" />
            </div>
            <div className="sup3-plank sup3-plank--2">
              <i className="sup3-mini sup3-mini--note" />
              <i className="sup3-mini sup3-mini--pen2" />
            </div>
            <div className="sup3-post sup3-post--l" />
            <div className="sup3-post sup3-post--r" />
          </div>
          <div className="sup3-glow sup3-glow--shelf" />

          {/* thùng hở nắp — xoay chậm trên bệ */}
          <div className="sup3-boxwrap">
            <div className="sup3-box">
              <div className="sup3-f sup3-f--front" />
              <div className="sup3-f sup3-f--back" />
              <div className="sup3-f sup3-f--left" />
              <div className="sup3-f sup3-f--right" />
              <div className="sup3-f sup3-f--bottom" />
              <div className="sup3-lid" />
            </div>
          </div>
          <div className="sup3-ring" />
          <div className="sup3-ring sup3-ring--dash" />
          <div className="sup3-flash" />
          <div className="sup3-glow sup3-glow--box" />

          {/* 3 món bay vào thùng */}
          <div className="sup3-it sup3-it--pen" />
          <div className="sup3-it sup3-it--note" />
          <div className="sup3-it sup3-it--tape" />
        </div>
      </div>

      {/* hạt dữ liệu trôi */}
      <div className="sup3-bit" style={{ left: "18%", top: "26%" }} />
      <div className="sup3-bit" style={{ left: "80%", top: "32%", animationDelay: "1.5s" }} />
      <div className="sup3-bit" style={{ left: "58%", top: "18%", animationDelay: "3s" }} />
      <div className="sup3-bit" style={{ left: "10%", top: "62%", animationDelay: "4.4s" }} />
    </div>
  );
}
