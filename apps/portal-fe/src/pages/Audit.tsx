import { App as AntApp, Button, Card, Empty, Input, Select, Space, Table, Tag, Tooltip } from "antd";
import { useEffect, useState } from "react";
import { api } from "../auth";
import { PageHeader } from "../ui";

interface AuditRow {
  id: number;
  actor_email: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  target_label: string | null;
  project_id: string | null;
  ip: string | null;
  created_at: string;
}

/** Mã hành động → câu tiếng Việt để người đọc hiểu (mã thô giữ ở tooltip để lọc). */
const ACTION_LABELS: Record<string, string> = {
  "login.success": "Đăng nhập thành công",
  "login.failed": "Đăng nhập sai",
  "login.denied_no_access": "Từ chối đăng nhập (không có quyền vào app)",
  "login.breakglass": "Đăng nhập khẩn cấp (break-glass)",
  "mfa.enabled": "Bật xác thực 2 lớp",
  "mfa.disabled": "Tắt xác thực 2 lớp",
  "mfa.failed": "Nhập mã 2 lớp sai",
  "mfa.recovery_used": "Dùng mã khôi phục 2 lớp",
  "mfa.secret_reset": "Đặt lại khóa 2 lớp",
  "password.changed": "Đổi mật khẩu",
  "password.reset_requested": "Yêu cầu đặt lại mật khẩu",
  "password.reset_completed": "Đã đặt lại mật khẩu (qua liên kết)",
  "settings.updated": "Cập nhật tham số hệ thống",
  "settings.test_email": "Gửi email thử",
  "user.created": "Tạo người dùng",
  "user.updated": "Cập nhật người dùng",
  "user.deleted": "Xóa người dùng",
  "user.reactivated": "Kích hoạt lại người dùng",
  "user.password_reset": "Cấp lại mật khẩu cho người dùng",
  "user.expiry_set": "Đặt hạn tài khoản",
  "user.expired_locked": "Khóa do hết hạn",
  "user.sessions_revoked": "Thu hồi mọi phiên của người dùng",
  "user.ssa_granted": "Cấp quyền SSA",
  "user.ssa_revoked": "Thu hồi quyền SSA",
  "self.logout_all": "Tự đăng xuất mọi phiên",
  "self.session_revoked": "Tự thu hồi 1 phiên",
  "client.created": "Tạo ứng dụng",
  "client.updated": "Cập nhật ứng dụng",
  "client.deleted": "Xóa ứng dụng",
  "client.secret_rotated": "Xoay client secret",
  "client.secret_revoked": "Thu hồi client secret",
  "client.group_added": "Gán nhóm vào ứng dụng",
  "client.group_removed": "Gỡ nhóm khỏi ứng dụng",
  "client.allow_all_set": "Đặt cho phép mọi nhóm",
  "client.webhook_set": "Đặt webhook",
  "client.webhook_removed": "Gỡ webhook",
  "group.created": "Tạo nhóm",
  "group.updated": "Cập nhật nhóm",
  "group.member_added": "Thêm thành viên nhóm",
  "group.member_removed": "Gỡ thành viên nhóm",
  "project.created": "Tạo dự án",
  "project.updated": "Cập nhật dự án",
  "project.deleted": "Xóa dự án",
  "project.admin_appointed": "Bổ nhiệm quản trị dự án",
  "project.admin_removed": "Gỡ quản trị dự án",
  "directory.users_query": "Directory API: truy vấn user",
  "directory.user_get": "Directory API: đọc 1 user",
  "webhook.requeued": "Xếp lại webhook",
};

/** Loại đối tượng → danh từ tiếng Việt. */
const TARGET_TYPE_LABELS: Record<string, string> = {
  user: "Người dùng",
  client: "Ứng dụng",
  group: "Nhóm",
  project: "Dự án",
  setting: "Tham số",
  session: "Phiên",
  webhook: "Webhook",
};

/** Mã lạ (chưa map) → bỏ dấu chấm/gạch cho dễ đọc thay vì hiện raw. */
const actionLabel = (a: string) => ACTION_LABELS[a] ?? a.replace(/[._]/g, " ");

/** Cột "Đối tượng" người-đọc-hiểu: "Người dùng: an@pmh.com.vn", "Tham số: smtp_host". */
function targetText(r: AuditRow): string {
  if (!r.target_type) return "—";
  const type = TARGET_TYPE_LABELS[r.target_type] ?? r.target_type;
  const label = r.target_label ?? (r.target_id ? r.target_id.slice(0, 8) : "");
  return label ? `${type}: ${label}` : type;
}

const columns = [
  {
    title: "Thời gian",
    dataIndex: "created_at",
    render: (v: string) => new Date(v).toLocaleString(),
    width: 170,
  },
  { title: "Người thực hiện", dataIndex: "actor_email", render: (v: string | null) => v ?? "—" },
  {
    title: "Hành động",
    dataIndex: "action",
    render: (v: string) => (
      <Tooltip title={v}>
        <Tag color={v.includes("denied") || v.endsWith(".failed") ? "red" : v.startsWith("login") ? "green" : "default"}>
          {actionLabel(v)}
        </Tag>
      </Tooltip>
    ),
  },
  { title: "Đối tượng", render: (_: unknown, r: AuditRow) => targetText(r) },
  { title: "IP", dataIndex: "ip", render: (v: string | null) => v ?? "—" },
];

/** Xem audit theo phạm vi + lưu trữ tháng (E6-S4, FR-30/31). */
export default function Audit({ isSsa }: { isSsa: boolean }) {
  const { message } = AntApp.useApp();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [action, setAction] = useState("");
  const [loading, setLoading] = useState(false);
  const [archives, setArchives] = useState<string[]>([]);
  const [month, setMonth] = useState<string | undefined>();

  const load = async (act?: string, m?: string) => {
    setLoading(true);
    try {
      const data = m
        ? await api<AuditRow[]>(`/api/admin/audit/archives/${m}`)
        : await api<AuditRow[]>(`/api/admin/audit?limit=200${act ? `&action=${encodeURIComponent(act)}` : ""}`);
      setRows(data);
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    if (isSsa) api<string[]>("/api/admin/audit/archives").then(setArchives).catch(() => {});
  }, []);

  return (
    <div>
      <PageHeader title="Nhật ký hệ thống" sub="Đăng nhập và thao tác quản trị, theo phạm vi bạn quản lý." />
      <Card>
        <Space wrap style={{ marginBottom: 16 }}>
          <Input.Search
            placeholder="Lọc theo hành động (vd login.success)"
            allowClear
            style={{ width: 280 }}
            onSearch={(v) => {
              setMonth(undefined);
              setAction(v);
              load(v);
            }}
          />
          {isSsa && (
            <Select
              placeholder="Xem lưu trữ tháng…"
              style={{ width: 200 }}
              allowClear
              value={month}
              options={archives.map((m) => ({ value: m, label: `Lưu trữ ${m}` }))}
              onChange={(m) => {
                setMonth(m);
                load(action, m);
              }}
            />
          )}
          <Button onClick={() => { setMonth(undefined); load(action); }}>Làm mới</Button>
        </Space>
        <Table<AuditRow>
          rowKey="id"
          loading={loading}
          dataSource={rows}
          columns={columns}
          size="small"
          pagination={{ pageSize: 20 }}
          scroll={{ x: 720 }}
          onRow={(_, i) => ({ style: { "--pmh-i": Math.min(i ?? 0, 14) } as import("react").CSSProperties })}
          locale={{ emptyText: <Empty description="Chưa có nhật ký phù hợp" /> }}
        />
      </Card>
    </div>
  );
}
