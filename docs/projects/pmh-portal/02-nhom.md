# Nhóm

Nhóm là công cụ **phân quyền truy cập**: quyết định **ai được vào app nào**. Mở từ **Bảng quản trị → Nhóm** (`/admin/groups`).

## Nguyên tắc cốt lõi

PMH ID **không** cho user vào app chỉ vì đã đăng nhập. Luồng quyền là:

**User → thuộc Nhóm → Nhóm được gán cho App (client) → User vào được App đó.**

Nói cách khác: đăng nhập (xác thực) **khác** với được phép vào app (phân quyền). Một user đăng nhập thành công vẫn **không** thấy QLTS nếu chưa ở nhóm được gán cho QLTS.

## Tạo và quản lý nhóm

1. Bấm **Thêm nhóm**, đặt tên rõ nghĩa (vd `QLTS - Nhân sự`, `QLHS - Kế toán`).
2. **Thêm/gỡ thành viên**: mở nhóm → thêm user vào.
3. Đổi tên / xóa nhóm khi cần.

Thêm user vào nhóm có hiệu lực **gần như tức thì** ở lần app kiểm quyền kế tiếp — không cần user đăng nhập lại.

## Gán nhóm cho App (điểm quyết định truy cập)

Trong phần **Dự án / Client** (Bảng quản trị → Workspace), mỗi app có mục **nhóm được phép**:

- **Gán một hoặc nhiều nhóm** cho app → chỉ thành viên các nhóm đó vào được.
- **allow_all_groups** (cho phép mọi nhóm): bật thì **mọi user** đăng nhập đều vào được app — bỏ hàng rào nhóm. Chỉ dùng cho app dùng chung toàn công ty; **không** nên bật cho app có dữ liệu nhạy cảm.

## Ví dụ thực tế

Muốn cho phòng Nhân sự dùng QLTS:

1. Tạo nhóm `QLTS - Nhân sự`.
2. Thêm các user nhân sự vào nhóm.
3. Vào client **QLTS** → gán nhóm `QLTS - Nhân sự` vào.
4. Xong — các user đó đăng nhập sẽ thấy và vào được QLTS; user ngoài nhóm thì không.

Gỡ một user khỏi nhóm → user mất quyền vào app tương ứng (và bị đá khỏi phiên app đó).

## Phạm vi của project_admin

- **project_admin** chỉ quản nhóm/thành viên **trong phạm vi dự án mình phụ trách**.
- Không gán được nhóm đang thuộc **dự án khác** vào client của mình (chống kéo user ngoài phạm vi).
- **SSA** quản toàn bộ nhóm, mọi dự án.

## Lưu ý vận hành

- Đặt tên nhóm theo **dự án + phòng ban** để dễ soát khi hệ thống lớn dần.
- Định kỳ rà **thành viên nhóm** khi có nhân sự nghỉ / chuyển bộ phận.
- Mọi thao tác gán/gỡ nhóm đều được ghi vào **Nhật ký** (xem tài liệu **Nhật ký**).
