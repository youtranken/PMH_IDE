# Hướng dẫn sử dụng Quản lý Tài sản (QLTS)

> File MẪU. Đổi tên file này thành tên tài liệu của bạn (giữ tiền tố số để sắp thứ tự,
> ví dụ `01-...`, `02-...`) rồi thay nội dung. Dòng `#` đầu tiên là **tiêu đề** hiển thị.

Đây là tài liệu hướng dẫn dành cho người dùng dự án **Quản lý Tài sản**.

## 1. Bắt đầu

Đăng nhập QLTS bằng tài khoản PMH ID. Quyền xem/sửa phụ thuộc nhóm bạn thuộc về.

## 2. Thao tác thường gặp

- Tạo mới: vào `Tài sản → Thêm mới`
- Tìm kiếm: dùng ô tìm theo **mã tài sản**
- Xuất dữ liệu: `Báo cáo → Xuất Excel`

## 3. Bảng tham chiếu (ví dụ)

| Trường | Bắt buộc | Ghi chú |
|---|---|---|
| Mã tài sản | Có | Duy nhất trong dự án |
| Vị trí | Có | Chọn từ danh mục |
| Giá trị | Không | Đơn vị VND |

## 4. Ví dụ khối mã

```
GET /qlts/api/assets?location=A1
Authorization: Bearer <token PMH ID>
```
