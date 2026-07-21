import "./RecordVault3D.css";

/* "Quản lý hồ sơ" — FLOW 4 TRẠM A→B→C→D (CSS 3D, không text).
   A TIẾP NHẬN (khay, tờ bay lên) → B XỬ LÝ (vòng xử lý quay, nội dung tự
   điền dần) → C PHÊ DUYỆT (con dấu vàng hạ, loé, hiện mộc) → D LƯU TRỮ
   (tờ nằm phẳng nộp vào tủ). Mỗi trạm 1 bệ tròn màu riêng sáng khi tờ đến
   (trắng→cyan→vàng→lục bảo); lúc nghỉ vệt sáng chạy đuổi A→B→C→D.
   Loop 14s. Thuần transform/opacity — nhẹ GPU. */

export default function RecordVault3D({ className }: { className?: string }) {
  return (
    <div className={`rec3${className ? " " + className : ""}`} aria-hidden>
      <div className="rec3-stage">
        <div className="rec3-tilt">
          {/* trục flow + mũi tên dẫn hướng */}
          <div className="rec3-track" />
          <i className="rec3-arr" style={{ left: "-64px" }} />
          <i className="rec3-arr" style={{ left: "-6px" }} />
          <i className="rec3-arr" style={{ left: "51px" }} />

          {/* 4 bệ trạm A→B→C→D */}
          <div className="rec3-pad rec3-pad--a" />
          <div className="rec3-pad rec3-pad--b" />
          <div className="rec3-pad rec3-pad--c" />
          <div className="rec3-pad rec3-pad--d" />

          {/* A — khay tiếp nhận + chồng tờ chờ */}
          <div className="rec3-tray">
            <i className="rec3-sheet rec3-sheet--1" />
            <i className="rec3-sheet rec3-sheet--2" />
          </div>

          {/* tờ hồ sơ chạy qua 4 trạm */}
          <div className="rec3-fly">
            <div className="rec3-page" />
          </div>

          {/* B — vòng xử lý quay */}
          <div className="rec3-proc" />

          {/* C — con dấu */}
          <div className="rec3-stamp" />

          {/* D — tủ lưu trữ 3 ngăn */}
          <div className="rec3-cab">
            <div className="rec3-slot rec3-slot--1"><i className="rec3-file" /></div>
            <div className="rec3-slot rec3-slot--2" />
            <div className="rec3-slot rec3-slot--3"><i className="rec3-file" /></div>
            <div className="rec3-post rec3-post--l" />
            <div className="rec3-post rec3-post--r" />
          </div>
        </div>
      </div>

      {/* hạt dữ liệu trôi */}
      <div className="rec3-bit" style={{ left: "16%", top: "26%" }} />
      <div className="rec3-bit" style={{ left: "82%", top: "32%", animationDelay: "1.7s" }} />
      <div className="rec3-bit" style={{ left: "56%", top: "18%", animationDelay: "3.2s" }} />
      <div className="rec3-bit" style={{ left: "10%", top: "62%", animationDelay: "4.5s" }} />
    </div>
  );
}
