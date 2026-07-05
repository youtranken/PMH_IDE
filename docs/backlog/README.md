# Backlog — PMH ID (SSO/IdP nội bộ)

Backlog tách từ PRD (34 FR) + Architecture Spine (16 AD). Mỗi epic một file; story đánh ID `E{n}-S{m}`, kèm tiêu chí nghiệm thu kiểm được và tham chiếu FR/AD.

Nguồn: `docs/prds/prd-sso-pmh-2026-07-04/{prd.md,addendum.md}`, `docs/architecture/arch-pmh-id-2026-07-04/ARCHITECTURE-SPINE.md`, `docs/integration/README.md`.

## Tổng quan 9 epic

| Epic | Tên | Phase | Số story | File |
|---|---|---|---|---|
| 0 | Nền tảng & khung dự án | 1 (enabler) | 6 | [epic-0-nen-tang.md](epic-0-nen-tang.md) |
| 1 | Lõi OIDC & phiên | 1 | 9 | [epic-1-loi-oidc-phien.md](epic-1-loi-oidc-phien.md) |
| 2 | Bảo mật đăng nhập | 1 | 4 | [epic-2-bao-mat-dang-nhap.md](epic-2-bao-mat-dang-nhap.md) |
| 3 | Vận hành & tin cậy | 1 | 6 | [epic-3-van-hanh-tin-cay.md](epic-3-van-hanh-tin-cay.md) |
| 4 | Quản lý user | 2 | 8 | [epic-4-quan-ly-user.md](epic-4-quan-ly-user.md) |
| 5 | Group, Project & Client | 2 | 7 | [epic-5-group-project-client.md](epic-5-group-project-client.md) |
| 6 | Portal: Launcher, self-service, audit, settings | 2 | 5 | [epic-6-portal.md](epic-6-portal.md) |
| 7 | Directory API, webhook, events | 3 | 3 | [epic-7-directory-webhook.md](epic-7-directory-webhook.md) |
| 8 | Cổng docs & app demo | 3 | 3 | [epic-8-docs-demo.md](epic-8-docs-demo.md) |

**Tổng: 51 story.**

> Ghi chú sau vòng đối chiếu độ phủ (2026-07-04): "Quên mật khẩu" chuyển từ Epic 2 (Phase 1) → E4-S8 (Phase 2) để gỡ phụ thuộc cross-phase; thêm E1-S8 (nạp claims JWT — FR-02); nối đầy đủ các đường thu hồi FR-05 (E4-S2 khóa/kill-switch, E5-S2 gỡ group, E6-S2 tự đổi MK).

## Thứ tự build

```
Phase 1 (golive lõi):   Epic 0 → Epic 1 → (Epic 2 ∥ Epic 3)
Phase 2 (portal):       Epic 4 → Epic 5 → Epic 6   (4 và 5 phần lớn song song được sau khi có 0-1)
Phase 3 (tích hợp):     Epic 7 → Epic 8
```

Nghiệm thu Phase 1: một app demo đăng nhập được qua PMH ID, SSA đăng nhập có MFA, mất auth thì có cảnh báo, restore được từ backup.

## Quy ước story

- **ID:** `E{epic}-S{story}` (vd `E1-S3`).
- **Story:** một câu "Là <ai>, cần <gì>, để <lợi ích>".
- **Tiêu chí nghiệm thu:** checklist kiểm được (không mơ hồ).
- **Tham chiếu:** FR/AD chống lưng.
- **Phụ thuộc:** story phải xong trước.
- **Ước lượng:** S/M/L (tương đối, không phải giờ).
