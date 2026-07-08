import {
  DownloadOutlined,
  MoreOutlined,
  PlusOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import {
  Alert,
  App as AntApp,
  Button,
  Checkbox,
  Dropdown,
  Form,
  Input,
  Modal,
  Select,
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
  groups?: string[];
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
  const pickedGroups = (Form.useWatch("groupIds", form) as string[] | undefined) ?? [];
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [expiryFor, setExpiryFor] = useState<UserRow | null>(null);
  const [expiryVal, setExpiryVal] = useState("");

  const [resetFor, setResetFor] = useState<UserRow | null>(null);
  const [resetPw, setResetPw] = useState("");
  const [resetMustChange, setResetMustChange] = useState(true);
  const [resetting, setResetting] = useState(false);

  const [importOpen, setImportOpen] = useState(false);

  // Nhóm + map nhóm→app (để gán nhóm ngay khi tạo user và hiện "vào được app nào").
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [accessMap, setAccessMap] = useState<Record<string, string[]>>({});

  // Bộ lọc + chọn nhiều để gán nhóm hàng loạt.
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkGroups, setBulkGroups] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = () => {
    setLoading(true);
    api<UserRow[]>("/api/admin/users").then(setRows).finally(() => setLoading(false));
  };
  useEffect(load, []);
  useEffect(() => {
    api<{ id: string; name: string }[]>("/api/admin/groups").then(setGroups).catch(() => {});
    api<Record<string, string[]>>("/api/admin/groups/access-map").then(setAccessMap).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((u) => {
      if (s && ![u.full_name, u.email, u.employee_code].some((v) => v.toLowerCase().includes(s))) return false;
      if (statusFilter === "active" && (u.deleted_at || u.status !== "active")) return false;
      if (statusFilter === "locked" && (u.deleted_at || u.status !== "locked")) return false;
      if (statusFilter === "deleted" && !u.deleted_at) return false;
      if (groupFilter !== "all" && !(u.groups ?? []).includes(groupFilter)) return false;
      return true; // "all" = mọi trạng thái, kể cả đã xóa
    });
  }, [rows, q, statusFilter, groupFilter]);

  // Gán NHIỀU user đã chọn vào NHIỀU nhóm cùng lúc (bỏ qua ai đã ở nhóm đó).
  const bulkAssign = async () => {
    setBulkBusy(true);
    let ok = 0, fail = 0;
    for (const gid of bulkGroups) {
      const gname = groups.find((g) => g.id === gid)?.name;
      for (const uid of selectedKeys) {
        const u = rows.find((r) => r.id === uid);
        if (gname && (u?.groups ?? []).includes(gname)) continue; // đã thuộc → bỏ qua
        try {
          await api(`/api/admin/groups/${gid}/members`, { method: "POST", body: { userId: uid } });
          ok++;
        } catch {
          fail++;
        }
      }
    }
    setBulkBusy(false);
    if (fail) message.warning(`Đã gán ${ok} lượt, lỗi ${fail}`);
    else message.success(`Đã gán ${ok} lượt vào nhóm`);
    setBulkOpen(false); setBulkGroups([]); setSelectedKeys([]); load();
  };

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
        const { password, mustChangePassword, ...edit } = v;
        await api(`/api/admin/users/${editing.id}`, { method: "PATCH", body: edit });
        message.success("Đã cập nhật");
      } else {
        const body: Record<string, unknown> = { email: v.email, employeeCode: v.employeeCode, fullName: v.fullName };
        if (v.password) { body.password = v.password; body.mustChangePassword = v.mustChangePassword ?? true; }
        const created = await api<{ id: string }>("/api/admin/users", { method: "POST", body });
        // Gán nhóm đã chọn (nếu có) — mỗi nhóm một lời gọi thêm-thành-viên.
        const groupIds: string[] = v.groupIds ?? [];
        const failed: string[] = [];
        for (const gid of groupIds) {
          try {
            await api(`/api/admin/groups/${gid}/members`, { method: "POST", body: { userId: created.id } });
          } catch {
            failed.push(groups.find((g) => g.id === gid)?.name ?? gid);
          }
        }
        if (failed.length) message.warning(`Đã tạo user, nhưng chưa gán được nhóm: ${failed.join(", ")}`);
        else message.success(groupIds.length ? `Đã tạo user & gán ${groupIds.length} nhóm` : "Đã tạo user");
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

  // `ok` = thông báo thành công (thì quá khứ). `confirmTitle` (nếu có) = câu hỏi
  // xác nhận mệnh lệnh — KHÔNG tái dùng `ok` làm tiêu đề (thành "Đã khóa?" tối nghĩa).
  const act = async (u: UserRow, path: string, ok: string, confirmTitle?: string) => {
    const run = async () => {
      try {
        const r = await api<{ revoked?: number }>(`/api/admin/users/${u.id}/${path}`, { method: "POST" });
        message.success(r?.revoked != null ? `${ok} — thu hồi ${r.revoked} phiên` : ok);
        load();
      } catch (e) {
        message.error((e as Error).message);
      }
    };
    if (confirmTitle) {
      modal.confirm({ title: confirmTitle, content: `${u.full_name} (${u.email})`, okButtonProps: { danger: true }, onOk: run });
    } else run();
  };

  const resetPassword = (u: UserRow) => {
    setResetFor(u);
    setResetPw("");
    setResetMustChange(true);
  };
  const submitReset = async () => {
    setResetting(true);
    try {
      const body = resetPw
        ? { password: resetPw, mustChangePassword: resetMustChange }
        : {};
      const r = await api<{ revoked: number }>(`/api/admin/users/${resetFor!.id}/reset-password`, { method: "POST", body });
      message.success(
        resetPw
          ? `Đã đặt mật khẩu thủ công — thu hồi ${r.revoked} phiên`
          : `Đã gửi mật khẩu tạm qua email — thu hồi ${r.revoked} phiên`,
      );
      setResetFor(null);
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setResetting(false);
    }
  };

  const toggleSsa = (u: UserRow, grant: boolean) =>
    modal.confirm({
      title: grant ? `Bổ nhiệm ${u.full_name} làm SSA?` : `Gỡ quyền SSA của ${u.full_name}?`,
      content: grant
        ? "SSA có TOÀN QUYỀN quản trị hệ thống (khóa/xóa user, cấu hình, mọi dự án, bổ nhiệm SSA khác). Nên duy trì ≥2 SSA để không phụ thuộc một người."
        : "Gỡ toàn bộ quyền quản trị hệ thống của người này (giữ vai quản trị dự án nếu có). Không thể gỡ SSA cuối cùng.",
      okText: grant ? "Bổ nhiệm SSA" : "Gỡ quyền SSA",
      okButtonProps: { danger: !grant },
      onOk: async () => {
        try {
          await api(`/api/admin/users/${u.id}/ssa`, { method: grant ? "POST" : "DELETE" });
          message.success(grant ? "Đã bổ nhiệm SSA" : "Đã gỡ quyền SSA");
          load();
        } catch (e) {
          message.error((e as Error).message);
        }
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
      { key: "reset", label: "Reset mật khẩu", onClick: () => resetPassword(u) },
    ];
    if (isSsa) {
      if (u.deleted_at) {
        items.push({ key: "reactivate", label: "Khôi phục user", onClick: () => act(u, "reactivate", "Đã khôi phục") });
      } else {
        items.push({ key: "expiry", label: "Đặt hạn tài khoản", onClick: () => { setExpiryFor(u); setExpiryVal(u.expires_at ? u.expires_at.slice(0, 10) : ""); } });
        items.push(
          u.status === "locked"
            ? { key: "unlock", label: "Mở khóa", onClick: () => act(u, "unlock", "Đã mở khóa") }
            : { key: "lock", label: "Khóa tài khoản", danger: true, onClick: () => act(u, "lock", "Đã khóa", "Khóa tài khoản này?") },
        );
        items.push({ key: "revoke", label: "Hủy mọi phiên", onClick: () => act(u, "revoke-sessions", "Đã hủy phiên") });
        items.push(
          u.is_ssa
            ? { key: "ssa-revoke", label: "Gỡ quyền SSA", danger: true, onClick: () => toggleSsa(u, false) }
            : { key: "ssa-grant", label: "Bổ nhiệm SSA", onClick: () => toggleSsa(u, true) },
        );
        items.push({ key: "delete", label: "Xóa user", danger: true, onClick: () => act(u, "delete", "Đã xóa user", "Xóa user này?") });
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
          <Input.Search placeholder="Tìm tên, email, mã NV" allowClear style={{ width: 220 }} onChange={(e) => setQ(e.target.value)} />
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 132 }}
            options={[
              { value: "all", label: "Mọi trạng thái" },
              { value: "active", label: "Hoạt động" },
              { value: "locked", label: "Đã khóa" },
              { value: "deleted", label: "Đã xóa" },
            ]}
          />
          <Select
            value={groupFilter}
            onChange={setGroupFilter}
            style={{ width: 150 }}
            showSearch
            optionFilterProp="label"
            options={[{ value: "all", label: "Mọi nhóm" }, ...groups.map((g) => ({ value: g.name, label: g.name }))]}
          />
          <Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>Nhập CSV</Button>
          <Button icon={<DownloadOutlined />} onClick={exportCsv}>Xuất CSV</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Tạo user</Button>
        </Space>
      </div>

      {selectedKeys.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, padding: "8px 14px", background: "#e8f0ed", borderRadius: 10 }}>
          <Text strong>Đã chọn {selectedKeys.length} user</Text>
          <Button type="primary" size="small" onClick={() => setBulkOpen(true)}>Gán vào nhóm</Button>
          <Button type="text" size="small" onClick={() => setSelectedKeys([])}>Bỏ chọn</Button>
        </div>
      )}

      <Table<UserRow>
        rowKey="id"
        loading={loading}
        dataSource={filtered}
        pagination={{ pageSize: 15, showTotal: (t) => `${t} người dùng` }}
        scroll={{ x: 820 }}
        rowSelection={{
          selectedRowKeys: selectedKeys,
          onChange: (keys) => setSelectedKeys(keys as string[]),
          getCheckboxProps: (u) => ({ disabled: !!u.deleted_at }), // không chọn user đã xóa
        }}
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
          {
            title: "Nhóm",
            responsive: ["md"],
            render: (_, u) =>
              u.groups?.length ? (
                <Space size={[4, 4]} wrap>
                  {u.groups.slice(0, 3).map((g) => <Tag key={g} style={{ marginInlineEnd: 0 }}>{g}</Tag>)}
                  {u.groups.length > 3 && <Tag style={{ marginInlineEnd: 0 }}>+{u.groups.length - 3}</Tag>}
                </Space>
              ) : (
                <span style={{ color: "#c0c9c5" }}>—</span>
              ),
          },
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
        forceRender
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
          {!editing && (
            <>
              <Form.Item name="groupIds" label="Nhóm (tùy chọn)">
                <Select
                  mode="multiple"
                  allowClear
                  placeholder="Chọn một hoặc nhiều nhóm — gán quyền vào app ngay khi tạo"
                  optionFilterProp="label"
                  options={groups.map((g) => ({
                    value: g.id,
                    label: g.name,
                  }))}
                  optionRender={(o) => {
                    const apps = accessMap[o.value as string] ?? [];
                    return (
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <span>{o.label}</span>
                        {apps.length > 0 && (
                          <Text type="secondary" style={{ fontSize: 12 }}>→ {apps.join(", ")}</Text>
                        )}
                      </div>
                    );
                  }}
                />
              </Form.Item>
              {(() => {
                const apps = [...new Set(pickedGroups.flatMap((g) => accessMap[g] ?? []))];
                if (!pickedGroups.length) return null;
                return (
                  <Alert
                    type={apps.length ? "success" : "info"}
                    showIcon
                    style={{ marginBottom: 16, marginTop: -4 }}
                    message={
                      apps.length
                        ? `Với nhóm đã chọn, user vào được: ${apps.join(", ")}`
                        : "Nhóm đã chọn chưa gắn với ứng dụng nào (chưa mở quyền vào app)."
                    }
                  />
                );
              })()}
              <Form.Item
                name="password"
                label="Mật khẩu (tùy chọn)"
                extra="Bỏ trống → user chưa có MK, phải dùng 'Reset mật khẩu' hoặc 'Quên mật khẩu' để lấy MK tạm. Đặt tại đây khi chưa cấu hình email. Tối thiểu 8 ký tự đủ 4 loại."
              >
                <Input.Password placeholder="Để trống nếu gửi MK tạm sau" autoComplete="new-password" />
              </Form.Item>
              <Form.Item name="mustChangePassword" valuePropName="checked" initialValue={true} style={{ marginBottom: 0 }}>
                <Checkbox>Bắt người dùng đổi mật khẩu ở lần đăng nhập đầu (khuyến nghị)</Checkbox>
              </Form.Item>
            </>
          )}
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

      {/* Reset mật khẩu — 2 chế độ: MK tạm qua email HOẶC đặt thủ công */}
      <Modal
        open={!!resetFor}
        title={resetFor ? `Reset mật khẩu · ${resetFor.full_name}` : ""}
        onCancel={() => setResetFor(null)}
        onOk={submitReset}
        okText={isSsa && resetPw ? "Đặt mật khẩu" : "Gửi MK tạm qua email"}
        confirmLoading={resetting}
        destroyOnHidden
      >
        <Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
          {isSsa ? (
            <>
              Để trống → gửi <b>mật khẩu tạm qua email</b> (buộc đổi khi đăng nhập). Nhập MK để{" "}
              <b>đặt thủ công</b> (dùng khi chưa cấu hình email). Thu hồi mọi phiên của user.
            </>
          ) : (
            <>Gửi <b>mật khẩu tạm qua email</b> (buộc đổi khi đăng nhập). Thu hồi phiên trong phạm vi dự án của bạn.</>
          )}
        </Text>
        {isSsa && (
          <>
            <Input.Password
              placeholder="Để trống nếu gửi MK tạm qua email"
              value={resetPw}
              autoComplete="new-password"
              onChange={(e) => setResetPw(e.target.value)}
            />
            {resetPw && (
              <Checkbox checked={resetMustChange} onChange={(e) => setResetMustChange(e.target.checked)} style={{ marginTop: 12 }}>
                Bắt người dùng đổi mật khẩu ở lần đăng nhập đầu (khuyến nghị)
              </Checkbox>
            )}
          </>
        )}
      </Modal>

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} onDone={() => { setImportOpen(false); load(); }} />

      {/* Gán nhóm hàng loạt */}
      <Modal
        open={bulkOpen}
        title={`Gán ${selectedKeys.length} user vào nhóm`}
        onCancel={() => setBulkOpen(false)}
        onOk={bulkAssign}
        okText="Gán"
        okButtonProps={{ disabled: !bulkGroups.length }}
        confirmLoading={bulkBusy}
      >
        <Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
          Chọn một hoặc nhiều nhóm để thêm tất cả user đã chọn. Ai đã ở nhóm sẽ được bỏ qua.
        </Text>
        <Select
          mode="multiple"
          allowClear
          style={{ width: "100%" }}
          placeholder="Chọn nhóm…"
          value={bulkGroups}
          onChange={setBulkGroups}
          optionFilterProp="label"
          options={groups.map((g) => ({ value: g.id, label: g.name }))}
        />
        {bulkGroups.length > 0 && (() => {
          const apps = [...new Set(bulkGroups.flatMap((g) => accessMap[g] ?? []))];
          return apps.length ? (
            <Alert type="success" showIcon style={{ marginTop: 12 }} message={`User sẽ vào được: ${apps.join(", ")}`} />
          ) : null;
        })()}
      </Modal>
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
