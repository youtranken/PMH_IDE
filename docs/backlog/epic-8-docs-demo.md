# Epic 8 — Cổng docs & app demo

**Phase:** 3
**Mục tiêu:** Trang bị đầy đủ cho dev project ngoài tự tích hợp ≤1 ngày (mục tiêu G4): cổng tài liệu trong portal + app demo đầy đủ để copy.
**Tham chiếu chính:** FR-33, FR-34, G4.

---

### [E8-S1] Cổng docs trong portal
- **Story:** Là dev tích hợp, cần đọc tài liệu tích hợp ngay trong hệ thống.
- **Tiêu chí nghiệm thu:**
  - Trang `id.pmh.com.vn/docs` đặt **sau đăng nhập**, **chỉ user thuộc group "Developers"** truy cập (kiểm ở BE, không phải magic-string FE).
  - Nội dung nguồn từ `docs/integration/README.md` (hướng dẫn OIDC, JWT claims + `ver`, Directory API, webhook).
- **Tham chiếu:** FR-33, FR-34, AD-3 | **Phụ thuộc:** E6-S1, E5-S7 | **Ước lượng:** M

### [E8-S2] App demo đầy đủ
- **Story:** Là dev, cần một app mẫu thể hiện trọn luồng tích hợp để copy.
- **Tiêu chí nghiệm thu:**
  - `apps/demo-app` (Node/Express + openid-client) mở rộng từ E1-S8: thêm gọi Directory API (client-credentials) + nhận webhook (verify HMAC timing-safe).
  - Chạy được với một client cấp từ portal; README hướng dẫn cấu hình.
- **Tham chiếu:** FR-34, G4 | **Phụ thuộc:** E1-S8, E7-S1, E7-S3 | **Ước lượng:** M

### [E8-S3] Kiểm thử tích hợp end-to-end (nghiệm thu G4)
- **Story:** Là chủ dự án, cần bằng chứng dev ngoài tích hợp được nhanh.
- **Tiêu chí nghiệm thu:**
  - Kịch bản: từ tài khoản Developers, đọc docs → cấp client → chạy demo-app → đăng nhập + verify JWT + gọi Directory API + nhận webhook, tất cả chạy thông.
  - Đo thời gian một dev mới làm theo docs (mục tiêu ≤1 ngày công — phép đo mục tiêu, không phải gate cứng).
- **Tham chiếu:** FR-34, G4 | **Phụ thuộc:** E8-S1, E8-S2 | **Ước lượng:** S
