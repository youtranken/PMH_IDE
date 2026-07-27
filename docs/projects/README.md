# Tài liệu người dùng theo dự án (cổng `/docs`)

Nơi chứa tài liệu hướng dẫn **cho người dùng cuối** của từng dự án. Cổng `/docs`
của PMH ID đọc trực tiếp các file ở đây.

## Cách tổ chức

```
docs/projects/
  <client_id>/          ← tên thư mục = client_id của dự án (khớp CHÍNH XÁC)
    01-gioi-thieu.md    ← mỗi file .md = MỘT tài liệu
    02-huong-dan.md
```

- **Tên thư mục = `client_id`** của OIDC client (dự án). Ví dụ hiện có:
  - `project-qlts` → Quản lý Tài sản (QLTS)
  - `project_qlhs` → Quản lý Hồ sơ (QLHS)
- **Mỗi file `.md` là một tài liệu.** Muốn nhiều tài liệu cho 1 dự án thì bỏ nhiều
  file `.md` vào thư mục dự án đó.
- **Thứ tự hiển thị** = theo tên file (A→Z). Nên đặt tiền tố số: `01-…`, `02-…`.
- **Tiêu đề tài liệu** = dòng `# Heading` đầu tiên trong file; nếu không có thì lấy
  tên file.

## Quy tắc hiển thị & quyền

- Sidebar dự án ở `/docs` lấy từ danh sách dự án **user có quyền truy cập**
  (`/api/me/apps`). Mọi member đăng nhập đều vào được `/docs`.
- Backend chỉ trả tài liệu của dự án khi user **thực sự có quyền** vào client đó
  (cùng vị từ với `/api/me/apps`) — không đọc trộm docs dự án khác bằng cách đoán id.
- Thư mục dự án **trống / chưa có `.md`** → cổng hiện **"Đang chờ cập nhật"**.

## Markdown hỗ trợ

Bộ render tối giản (không kéo thư viện): heading `#`–`####`, in đậm `**`, code
`` ` `` và khối ``` ```, danh sách `-`/`*`, bảng `| … |`. Không hỗ trợ HTML nhúng.

> Chỉ đặt tài liệu **hướng dẫn sử dụng** cho người dùng dự án ở đây. Tài liệu tích
> hợp kỹ thuật (OIDC/webhook/API) KHÔNG thuộc cổng này.
