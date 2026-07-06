import {
  DownloadOutlined,
  MoreOutlined,
  PlusOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import {
  App as AntApp,
  Button,
  Checkbox,
  Dropdown,
  Form,
  Input,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
} from "antd";
import { useEffect, useMemo, useState } from "react";
import { api, ApiError, apiText } from "../auth";
import { BRAND, initials } from "../ui";
import { Avatar } from "antd";

const { Title, Text } = Typography;

interface UserRow {
  id: string;
  email: string;
  employee_code: string;
  full_name: string;
  status: string;
  deleted_at: string | null;
  expires_at: string | null;
  created_at: string;
  is_ssa?: boolean;
  admin_projects?: string[];
}

function roleTags(u: UserRow) {
  const tags = [];
  if (u.is_ssa) tags.push(<Tag key="ssa" color="gold">SSA</Tag>);
  for (const name of u.admin_projects ?? []) {
    tags.push(<Tag key={name} color="green">QTDA: {name}</Tag>);
  }
  return tags.length ? <span>{tags}</span> : <span style={{ color: "#c0c9c5" }}>Nhân viên</span>;
}

interface RowResult {
  line: number;
  data: { employee_code: string; email: string; full_name: string; groups: string[] };
  status: "ok" | "error" | "created" | "skipped" | "failed";
  errors: string[];
  newGroups: string[];
}
interface ImportReport {
  total: number;
  ok: number;
  errorCount: number;
  created?: number;
  skipped?: number;
  failed?: number;
  rows: RowResult[];
}

function statusTag(u: UserRow) {
  if (u.deleted_at) return <Tag>Đã xóa</Tag>;
  if (u.status === "locked") return <Tag color="orange">Khóa</Tag>;
  if (u.status === "active") return <Tag color="green">Hoạt động</Tag>;
  return <Tag>{u.status}</Tag>;
}

const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString("vi-VN") : "—");

export default function AdminUsers({ isSsa }: { isSsa: boolean }) {
  const { message, modal } = AntApp.useApp();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const [form] = Form.useForm();
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [expiryFor, setExpiryFor] = useState<UserRow | null>(null);
  const [expiryVal, setExpiryVal] = useState("");

  const [importOpen, setImportOpen] = useState(false);

  const load = () => {
    setLoading(true);
    api<UserRow[]>("/api/admin/users").then(setRows).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((u) =>
      [u.full_name, u.email, u.employee_code].some((v) => v.toLowerCase().includes(s)),
    );
  }, [rows, q]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setFormOpen(true);
  };
  const openEdit = (u: UserRow) => {
    setEditing(u);
    form.setFieldsValue({ email: u.email, employeeCode: u.employee_code, fullName: u.full_name });
    setFormOpen(true);
  };

  const submitForm = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      if (editing) {
        await api(`/api/admin/users/${editing.id}`, { method: "PATCH", body: v });
        message.success("Đã cập nhật");
      } else {
        await api("/api/admin/users", { method: "POST", body: v });
        message.success("Đã tạo user");
      }
      setFormOpen(false);
      load();
    } catch (e) {
      if (e instanceof ApiError && e.data?.error === "exists_deleted" && isSsa) {
        const uid = e.data.userId as string;
        modal.confirm({
          title: "Trùng với user đã xóa",
          content: "Đã có user (đã xóa) trùng email/mã NV. Khôi phục user đó thay vì tạo mới?",
          okText: "Khôi phục",
          onOk: async () => {
            await api(`/api/admin/users/${uid}/reactivate`, { method: "POST" });
            message.success("Đã khôi phục user");
            setFormOpen(false);
            load();
          },
        });
      } else {
        message.error((e as Error).message);
      }
    } finally {
      setSaving(false);
    }
  };

  const act = async (u: UserRow, path: string, ok: string, danger = false) => {
    const run = async () => {
      try {
        const r = await api<{ revoked?: number }>(`/api/admin/users/${u.id}/${path}`, { method: "POST" });
        message.success(r?.revoked != null ? `${ok} — thu hồi ${r.revoked} phiên` : ok);
        load();
      } catch (e) {
        message.error((e as Error).message);
      }
    };
    if (danger) {
      modal.confirm({ title: ok + "?", content: `${u.full_name} (${u.email})`, okButtonProps: { danger: true }, onOk: run });
    } else run();
  };

  const resetPassword = (u: UserRow) =>
    modal.confirm({
      title: "Reset mật khẩu?",
      content: `Cấp mật khẩu tạm cho ${u.full_name} (gửi qua email, hạn theo cấu hình). ${isSsa ? "Thu hồi mọi phiên của user." : "Thu hồi phiên trong phạm vi dự án của bạn."}`,
      okText: "Reset mật khẩu",
      onOk: async () => {
        const r = await api<{ revoked: number }>(`/api/admin/users/${u.id}/reset-password`, { method: "POST" });
        message.success(`Đã reset — thu hồi ${r.revoked} phiên`);
      },
    });

  const saveExpiry = async (clear: boolean) => {
    try {
      await api(`/api/admin/users/${expiryFor!.id}/set-expiry`, {
        method: "POST",
        body: { expiresAt: clear ? null : new Date(expiryVal).toISOString() },
      });
      message.success(clear ? "Đã gỡ hạn" : "Đã đặt hạn");
      setExpiryFor(null);
      load();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const menuFor = (u: UserRow) => {
    const items: { key: string; label: string; danger?: boolean; onClick: () => void }[] = [
      { key: "edit", label: "Sửa thông tin", onClick: () => openEdit(u) },
      { key: "expiry", label: "Đặt hạn tài khoản", onClick: () => { setExpiryFor(u); setExpiryVal(u.expires_at ? u.expires_at.slice(0, 10) : ""); } },
      { key: "reset", label: "Reset mật khẩu", onClick: () => resetPassword(u) },
    ];
    if (isSsa) {
      if (u.deleted_at) {
        items.push({ key: "reactivate", label: "Khôi phục user", onClick: () => act(u, "reactivate", "Đã khôi phục") });
      } else {
        items.push(
          u.status === "locked"
            ? { key: "unlock", label: "Mở khóa", onClick: () => act(u, "unlock", "Đã mở khóa") }
            : { key: "lock", label: "Khóa tài khoản", danger: true, onClick: () => act(u, "lock", "Đã khóa", true) },
        );
        items.push({ key: "revoke", label: "Hủy mọi phiên", onClick: () => act(u, "revoke-sessions", "Đã hủy phiên") });
        items.push({ key: "delete", label: "Xóa user", danger: true, onClick: () => act(u, "delete", "Đã xóa user", true) });
      }
    }
    return items;
  };

  const exportCsv = async () => {
    try {
      const text = await apiText("/api/admin/users/export");
      const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = "users.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", width: "100%" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
        <div>
          <Title level={3} style={{ marginBottom: 2 }}>Người dùng</Title>
          <Text type="secondary">Quản lý tài khoản nhân viên, nhóm quyền và mật khẩu.</Text>
        </div>
        <Space wrap>
          <Input.Search placeholder="Tìm tên, email, mã NV" allowClear style={{ width: 240 }} onChange={(e) => setQ(e.target.value)} />
          <Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>Nhập CSV</Button>
          <Button icon={<DownloadOutlined />} onClick={exportCsv}>Xuất CSV</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Tạo user</Button>
        </Space>
      </div>

      <Table<UserRow>
        rowKey="id"
        loading={loading}
        dataSource={filtered}
        pagination={{ pageSize: 15, showTotal: (t) => `${t} người dùng` }}
        scroll={{ x: 720 }}
        columns={[
          {
            title: "Nhân viên",
            render: (_, u) => (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Avatar style={{ background: "#e8f0ed", color: BRAND.green, fontWeight: 700, flex: "0 0 auto" }}>
                  {initials(u.full_name)}
                </Avatar>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: BRAND.ink }}>{u.full_name}</div>
                  <div style={{ color: BRAND.muted, fontSize: 13 }}>{u.email}</div>
                </div>
              </div>
            ),
          },
          { title: "Mã NV", dataIndex: "employee_code", responsive: ["lg"] },
          { title: "Vai trò", render: (_, u) => roleTags(u), responsive: ["md"] },
          { title: "Trạng thái", render: (_, u) => statusTag(u), width: 120 },
          { title: "Hạn", render: (_, u) => fmtDate(u.expires_at), responsive: ["lg"], width: 120 },
          {
            title: "",
            width: 48,
            render: (_, u) => (
              <Dropdown trigger={["click"]} menu={{ items: menuFor(u).map((i) => ({ key: i.key, label: i.label, danger: i.danger, onClick: i.onClick })) }}>
                <Button type="text" icon={<MoreOutlined />} />
              </Dropdown>
            ),
          },
        ]}
      />

      {/* Tạo / sửa */}
      <Modal
        open={formOpen}
        title={editing ? "Sửa thông tin" : "Tạo user mới"}
        onCancel={() => setFormOpen(false)}
        onOk={submitForm}
        okText={editing ? "Lưu" : "Tạo"}
        confirmLoading={saving}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" requiredMark={false} style={{ marginTop: 12 }}>
          <Form.Item name="fullName" label="Họ tên" rules={[{ required: true, message: "Nhập họ tên" }]}>
            <Input placeholder="Nguyễn Văn A" />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: "email", message: "Email không hợp lệ" }]}>
            <Input placeholder="a.nguyen@pmh.com.vn" />
          </Form.Item>
          <Form.Item name="employeeCode" label="Mã nhân viên" rules={[{ required: true, message: "Nhập mã NV" }]}>
            <Input placeholder="NV123" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Đặt hạn */}
      <Modal
        open={!!expiryFor}
        title="Đặt hạn tài khoản"
        onCancel={() => setExpiryFor(null)}
        footer={[
          <Button key="clear" danger onClick={() => saveExpiry(true)}>Gỡ hạn</Button>,
          <Button key="save" type="primary" disabled={!expiryVal} onClick={() => saveExpiry(false)}>Đặt hạn</Button>,
        ]}
      >
        <Text type="secondary">Sau ngày này tài khoản sẽ tự khóa. Để trống rồi bấm "Gỡ hạn" để bỏ.</Text>
        <Input type="date" style={{ marginTop: 12 }} value={expiryVal} onChange={(e) => setExpiryVal(e.target.value)} />
      </Modal>

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} onDone={() => { setImportOpen(false); load(); }} />
    </div>
  );
}

/** Nhập CSV: dán/tải nội dung → xem trước từng dòng → ghi. */
function ImportModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { message } = AntApp.useApp();
  const [csv, setCsv] = useState("");
  const [autoGroups, setAutoGroups] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [busy, setBusy] = useState(false);

  const call = async (commit: boolean) => {
    setBusy(true);
    try {
      const r = await api<ImportReport>(`/api/admin/users/import/${commit ? "commit" : "preview"}`, {
        method: "POST",
        body: { csv, autoCreateGroups: autoGroups },
      });
      setReport(r);
      if (commit) {
        message.success(`Đã tạo ${r.created ?? r.ok} user (bỏ qua ${r.skipped ?? 0}, lỗi ${r.failed ?? 0})`);
        onDone();
      }
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => { setCsv(""); setReport(null); setAutoGroups(false); };

  return (
    <Modal
      open={open}
      title="Nhập user từ CSV"
      width={720}
      onCancel={() => { reset(); onClose(); }}
      footer={[
        <Button key="c" onClick={() => { reset(); onClose(); }}>Đóng</Button>,
        <Button key="p" onClick={() => call(false)} loading={busy} disabled={!csv.trim()}>Xem trước</Button>,
        <Button key="w" type="primary" onClick={() => call(true)} loading={busy} disabled={!report || report.ok === 0}>
          Ghi {report ? report.ok : ""} dòng
        </Button>,
      ]}
    >
      <Text type="secondary">Cột bắt buộc: <code>employee_code, email, full_name</code>. Cột tùy chọn <code>groups</code> (nhiều nhóm cách nhau bằng <code>;</code>).</Text>
      <Upload
        accept=".csv,text/csv"
        showUploadList={false}
        beforeUpload={(f) => { f.text().then(setCsv); return false; }}
      >
        <Button size="small" icon={<UploadOutlined />} style={{ margin: "10px 0" }}>Chọn file .csv</Button>
      </Upload>
      <Input.TextArea
        rows={5}
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
        placeholder={"employee_code,email,full_name,groups\nNV900,a.tran@pmh.com.vn,Trần Văn A,Kế toán;Sales"}
        style={{ fontFamily: "ui-monospace, monospace", fontSize: 13 }}
      />
      <Checkbox checked={autoGroups} onChange={(e) => setAutoGroups(e.target.checked)} style={{ marginTop: 10 }}>
        Tự tạo nhóm chưa tồn tại
      </Checkbox>

      {report && (
        <div style={{ marginTop: 14 }}>
          <Space style={{ marginBottom: 8 }}>
            <Tag color="green">Hợp lệ: {report.ok}</Tag>
            <Tag color={report.errorCount ? "red" : "default"}>Lỗi: {report.errorCount}</Tag>
            <Tag>Tổng: {report.total}</Tag>
          </Space>
          <Table<RowResult>
            rowKey="line"
            size="small"
            dataSource={report.rows}
            pagination={{ pageSize: 6 }}
            columns={[
              { title: "Dòng", dataIndex: "line", width: 60 },
              { title: "Email", render: (_, r) => r.data.email },
              {
                title: "Kết quả",
                width: 110,
                render: (_, r) => {
                  const color = r.status === "error" || r.status === "failed" ? "red" : r.status === "skipped" ? "default" : "green";
                  return <Tag color={color}>{r.status}</Tag>;
                },
              },
              { title: "Ghi chú", render: (_, r) => (r.errors.length ? <Text type="danger" style={{ fontSize: 12 }}>{r.errors.join("; ")}</Text> : r.newGroups.length ? <Text type="secondary" style={{ fontSize: 12 }}>nhóm mới: {r.newGroups.join(", ")}</Text> : "—") },
            ]}
          />
        </div>
      )}
    </Modal>
  );
}
