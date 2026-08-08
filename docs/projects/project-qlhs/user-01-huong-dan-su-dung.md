# Hướng dẫn sử dụng Quản lý Hồ sơ (QLHS)

> File MẪU. Đổi tên file này thành tên tài liệu của bạn (giữ tiền tố số để sắp thứ tự,
> ví dụ `01-...`, `02-...`) rồi thay nội dung. Dòng `#` đầu tiên là **tiêu đề** hiển thị.

Đây là tài liệu hướng dẫn dành cho người dùng dự án **Quản lý Hồ sơ**.

## 1. Bắt đầu

Đăng nhập QLHS bằng tài khoản PMH ID. Quyền xem/sửa phụ thuộc nhóm bạn thuộc về.

## 2. Thao tác thường gặp

- Tạo hồ sơ: vào `Hồ sơ → Thêm mới`
- Tìm kiếm: dùng ô tìm theo **số hồ sơ**
- Xuất dữ liệu: `Báo cáo → Xuất Excel`

## 3. Bảng tham chiếu (ví dụ)

| Trường | Bắt buộc | Ghi chú |
|---|---|---|
| Số hồ sơ | Có | Duy nhất trong dự án |
| Loại hồ sơ | Có | Chọn từ danh mục |
| Ghi chú | Không | Tối đa 500 ký tự |

## 4. Ví dụ khối mã

```
GET /qlhs/api/records?type=hopdong
Authorization: Bearer <token PMH ID>
```
