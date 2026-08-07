import {
  ApartmentOutlined,
  CheckCircleFilled,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  FieldTimeOutlined,
  MinusCircleOutlined,
  KeyOutlined,
  LockOutlined,
  LogoutOutlined,
  MoreOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  UnlockOutlined,
  UndoOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import {
  Alert,
  App as AntApp,
  Button,
  Checkbox,
  Drawer,
  Dropdown,
  Empty,
  Form,
  Input,
  Modal,
  Select,
  Skeleton,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
} from "antd";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { checkPassword, PASSWORD_RULE_LABELS } from "@pmh/shared";
import { api, ApiError, apiText } from "../auth";
import { BRAND, initials, ListEmpty, PageHeader } from "../ui";
import { Avatar } from "antd";

const { Text } = Typography;

interface UserRow {
  id: string;
  email: string;
  employee_code: string;
  full_name: string;
  department: string;
  status: string;
  deleted_at: string | null;
  expires_at: string | null;
  created_at: string;
  is_ssa?: boolean;
  admin_projects?: string[];
  groups?: string[];
}

// Màu tag theo NHÓM NGHĨA (không để "xanh lá" mang mọi nghĩa): xanh = trạng thái
// sống, vàng = đặc quyền (SSA), xanh-dương = vai (QTDA — thuộc tính, không phải trạng thái).
function roleTags(u: UserRow) {
  const tags = [];
  if (u.is_ssa) tags.push(<Tag key="ssa" color="gold">SSA</Tag>);
  for (const name of u.admin_projects ?? []) {
    tags.push(<Tag key={name} color="geekblue">QTDA: {name}</Tag>);
  }
  return tags.length ? <span>{tags}</span> : <span style={{ color: "var(--a-faint)" }}>Nhân viên</span>;
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

/** Checklist quy tắc mật khẩu (dùng cho ô đặt mật khẩu thủ công) — cùng luật server. */
function PwChecklist({ pw }: { pw: string }) {
  if (!pw) return null;
  const checks = checkPassword(pw);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, margin: "10px 0 2px" }}>
      {(Object.keys(checks) as (keyof typeof checks)[]).map((k) => (
        <div key={String(k)} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: checks[k] ? "#3f7a54" : "var(--a-ink-3)" }}>
          {checks[k] ? <CheckCircleFilled style={{ color: "#52c41a" }} /> : <MinusCircleOutlined />}
          <span>{PASSWORD_RULE_LABELS[k]}</span>
        </div>
      ))}
    </div>
  );
}

export default function AdminUsers({ isSsa }: { isSsa: boolean }) {
  const { message, modal } = AntApp.useApp();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  // Sửa nhóm & quyền của MỘT user ngay từ hàng của họ.
  const [groupsFor, setGroupsFor] = useState<UserRow | null>(null);

  // Xóa VĨNH VIỄN — buộc gõ đúng mã NV để xác nhận (không hoàn tác).
  const [hardDelFor, setHardDelFor] = useState<UserRow | null>(null);
  const [hardDelText, setHardDelText] = useState("");
  const [hardDeleting, setHardDeleting] = useState(false);

  const [importOpen, setImportOpen] = useState(false);

  // Nhóm + map nhóm→app (để gán nhóm ngay khi tạo user và hiện "vào được app nào").
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [accessMap, setAccessMap] = useState<Record<string, string[]>>({});

  // Danh mục phòng ban (dropdown khi tạo/sửa user).
  const [departments, setDepartments] = useState<string[]>([]);
  // Option phòng ban; giữ giá trị hiện tại của user đang sửa nếu tên đó không
  // (còn) trong danh mục, để không "mất" giá trị khi mở form sửa.
  const deptOptions = useMemo(() => {
    const set = new Set(departments);
    if (editing?.department) set.add(editing.department);
    return [...set].map((d) => ({ value: d, label: d }));
  }, [departments, editing]);

  // Bộ lọc + chọn nhiều để gán nhóm hàng loạt. Mặc định = chỉ "Hoạt động".
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkGroups, setBulkGroups] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = () => {
    setLoading(true);
    // Gửi từ khóa tìm lên server → tra được cả user NGOÀI 500 mới nhất (không chỉ
    // lọc client trên tập đã tải). Client vẫn lọc tiếp theo trạng thái/nhóm.
    const qs = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
    api<UserRow[]>(`/api/admin/users${qs}`)
      .then((r) => { setRows(r); setError(null); })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  };
  // Nạp lần đầu + nạp lại (debounce 300ms) mỗi khi đổi từ khóa tìm.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [q]);
  useEffect(() => {
    api<{ id: string; name: string }[]>("/api/admin/groups").then(setGroups).catch(() => message.warning("Không tải được danh sách nhóm"));
    api<Record<string, string[]>>("/api/admin/groups/access-map").then(setAccessMap).catch(() => {});
    api<{ name: string }[]>("/api/admin/departments")
      .then((r) => setDepartments(r.map((d) => d.name)))
      .catch(() => {});
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

  // Đổi bộ lọc/tìm kiếm → BỎ CHỌN: nếu không, thanh bulk giữ user đã bị ẩn khỏi
  // bảng và "Gán vào nhóm" tác động lên người không còn thấy.
  useEffect(() => { setSelectedKeys([]); }, [q, statusFilter, groupFilter]);

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
    // resetFields TRƯỚC khi set — nếu không, nhóm đã chọn ở form "Tạo user" (bị
    // preserve) còn dính và rò vào PATCH sửa user.
    form.resetFields();
    form.setFieldsValue({ email: u.email, employeeCode: u.employee_code, fullName: u.full_name, department: u.department });
    setFormOpen(true);
  };

  const submitForm = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      if (editing) {
        // groupIds chỉ dùng khi TẠO mới — loại khỏi body PATCH (chống rò nhóm cũ).
        const { password, mustChangePassword, groupIds, ...edit } = v;
        await api(`/api/admin/users/${editing.id}`, { method: "PATCH", body: edit });
        message.success("Đã cập nhật");
      } else {
        const body: Record<string, unknown> = { email: v.email, employeeCode: v.employeeCode, fullName: v.fullName, department: v.department };
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
          content: "Đã có user (đã xóa) trùng email/mã NV. Khôi phục người dùng đó thay vì tạo mới?",
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
  const act = async (u: UserRow, path: string, ok: string, confirm?: { title: string; okText: string }) => {
    const run = async () => {
      try {
        const r = await api<{ revoked?: number }>(`/api/admin/users/${u.id}/${path}`, { method: "POST" });
        message.success(r?.revoked != null ? `${ok} — thu hồi ${r.revoked} phiên` : ok);
        load();
      } catch (e) {
        message.error((e as Error).message);
      }
    };
    // Nút xác nhận NÊU RÕ hành động ("Khóa tài khoản") thay vì "Đồng ý" chung chung.
    if (confirm) {
      modal.confirm({ title: confirm.title, content: `${u.full_name} (${u.email})`, okText: confirm.okText, cancelText: "Hủy", okButtonProps: { danger: true }, onOk: run });
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

  const submitHardDelete = async () => {
    if (!hardDelFor) return;
    setHardDeleting(true);
    try {
      await api(`/api/admin/users/${hardDelFor.id}/permanent`, { method: "DELETE" });
      message.success("Đã xóa vĩnh viễn người dùng");
      setHardDelFor(null);
      setHardDelText("");
      load();
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setHardDeleting(false);
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
        // Ghép giờ LOCAL (cuối ngày) trước toISOString → không lệch sang ngày trước
        // ở múi giờ +7 (nếu để "YYYY-MM-DD" trơn, Date coi là UTC 00:00).
        body: { expiresAt: clear ? null : new Date(`${expiryVal}T23:59:59`).toISOString() },
      });
      message.success(clear ? "Đã gỡ hạn" : "Đã đặt hạn");
      setExpiryFor(null);
      load();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const menuFor = (u: UserRow) => {
    const items: { key: string; label: string; icon: ReactNode; danger?: boolean; onClick: () => void }[] = [
      { key: "edit", label: "Sửa thông tin", icon: <EditOutlined />, onClick: () => openEdit(u) },
      { key: "groups", label: "Nhóm & quyền", icon: <ApartmentOutlined />, onClick: () => setGroupsFor(u) },
      { key: "reset", label: "Đặt lại mật khẩu", icon: <KeyOutlined />, onClick: () => resetPassword(u) },
    ];
    if (isSsa) {
      if (u.deleted_at) {
        items.push({ key: "reactivate", label: "Khôi phục người dùng", icon: <UndoOutlined />, onClick: () => act(u, "reactivate", "Đã khôi phục") });
        items.push({ key: "hard-delete", label: "Xóa vĩnh viễn", icon: <DeleteOutlined />, danger: true, onClick: () => { setHardDelFor(u); setHardDelText(""); } });
      } else {
        items.push({ key: "expiry", label: "Đặt hạn tài khoản", icon: <FieldTimeOutlined />, onClick: () => { setExpiryFor(u); setExpiryVal(u.expires_at ? u.expires_at.slice(0, 10) : ""); } });
        items.push(
          u.status === "locked"
            ? { key: "unlock", label: "Mở khóa", icon: <UnlockOutlined />, onClick: () => act(u, "unlock", "Đã mở khóa") }
            : { key: "lock", label: "Khóa tài khoản", icon: <LockOutlined />, danger: true, onClick: () => act(u, "lock", "Đã khóa", { title: "Khóa tài khoản này?", okText: "Khóa tài khoản" }) },
        );
        items.push({ key: "revoke", label: "Thu hồi mọi phiên", icon: <LogoutOutlined />, onClick: () => act(u, "revoke-sessions", "Đã thu hồi phiên", { title: "Thu hồi mọi phiên đăng nhập?", okText: "Thu hồi phiên" }) });
        items.push(
          u.is_ssa
            ? { key: "ssa-revoke", label: "Gỡ quyền SSA", icon: <SafetyCertificateOutlined />, danger: true, onClick: () => toggleSsa(u, false) }
            : { key: "ssa-grant", label: "Bổ nhiệm SSA", icon: <SafetyCertificateOutlined />, onClick: () => toggleSsa(u, true) },
        );
        items.push({ key: "delete", label: "Xóa người dùng", icon: <DeleteOutlined />, danger: true, onClick: () => act(u, "delete", "Đã xóa người dùng", { title: "Xóa người dùng này?", okText: "Xóa người dùng" }) });
        // Xóa vĩnh viễn chỉ hiện khi tài khoản ĐANG KHÓA (hoặc đã xóa — nhánh trên).
        if (u.status === "locked") {
          items.push({ key: "hard-delete", label: "Xóa vĩnh viễn", icon: <DeleteOutlined />, danger: true, onClick: () => { setHardDelFor(u); setHardDelText(""); } });
        }
      }
    }
    return items;
  };

  // Tải file MẪU (template) để điền rồi Import — không phải xuất dữ liệu thật.
  const downloadTemplate = async () => {
    try {
      const text = await apiText("/api/admin/users/export");
      const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = "user-import-template.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  // Bộ lọc đang bật? → trạng thái rỗng phân biệt "không khớp lọc" vs "chưa có ai".
  // Rỗng-hệ-thống (chưa có ai) vs bị-lọc/tìm-ẩn: default lọc "active" khiến "đang
  // lọc" LUÔN đúng → không dùng nó để phân biệt. Rỗng thật = server không trả ai
  // và không đang tìm; còn lại là bị lọc/tìm không ra.
  const systemEmpty = rows.length === 0 && !q.trim();
  const clearFilters = () => { setQ(""); setStatusFilter("all"); setGroupFilter("all"); };

  return (
    <div>
      <PageHeader
        title="Người dùng"
        sub="Quản lý tài khoản nhân viên, nhóm quyền và mật khẩu."
        actions={
          <Space>
            <Button icon={<DownloadOutlined />} onClick={downloadTemplate} title="Tải file CSV mẫu để điền rồi Import">Tải file mẫu</Button>
            <Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>Nhập từ CSV</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Tạo người dùng</Button>
          </Space>
        }
      />

      {selectedKeys.length > 0 && (
        <div className="pmh-admin__bulk">
          <Text strong>Đã chọn {selectedKeys.length} user</Text>
          <Button type="primary" size="small" onClick={() => setBulkOpen(true)}>Gán vào nhóm</Button>
          <Button type="text" size="small" onClick={() => setSelectedKeys([])}>Bỏ chọn</Button>
        </div>
      )}

      {loading && rows.length === 0 ? (
        <div className="pmh-admin__card pmh-admin__card--pad">
          <Skeleton active paragraph={{ rows: 8 }} />
        </div>
      ) : (
      <div className="pmh-admin__card">
        <div className="pmh-admin__toolbar">
          <Input.Search placeholder="Tìm tên, email, mã NV" allowClear value={q} style={{ width: 240 }} onChange={(e) => setQ(e.target.value)} />
          <div className="pmh-admin__toolbar-spacer" />
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
        </div>
        <Table<UserRow>
        rowKey="id"
        loading={loading}
        dataSource={filtered}
        pagination={{ pageSize: 15, showTotal: (t) => `${t} người dùng` }}
        scroll={{ x: 820 }}
        onRow={(_, i) => ({ style: { "--pmh-i": Math.min(i ?? 0, 14) } as import("react").CSSProperties })}
        locale={{
          emptyText: error ? (
            <ListEmpty error={error} onRetry={load} description="" />
          ) : (
            <div style={{ padding: "36px 0" }}>
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={systemEmpty ? "Chưa có người dùng nào" : "Không có người dùng khớp bộ lọc/tìm kiếm"}
              >
                {systemEmpty ? (
                  <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Tạo người dùng</Button>
                ) : (
                  <Button size="small" onClick={clearFilters}>Xóa bộ lọc</Button>
                )}
              </Empty>
            </div>
          ),
        }}
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
                <Avatar style={{ background: "var(--a-chip)", color: BRAND.green, fontWeight: 700, flex: "0 0 auto" }}>
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
          {
            title: "Phòng ban",
            dataIndex: "department",
            responsive: ["md"],
            render: (d: string) => d?.trim() || <span style={{ color: "var(--a-faint)" }}>—</span>,
          },
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
                <span style={{ color: "var(--a-faint)" }}>—</span>
              ),
          },
          { title: "Trạng thái", render: (_, u) => statusTag(u), width: 120 },
          { title: "Hạn", render: (_, u) => fmtDate(u.expires_at), responsive: ["lg"], width: 120 },
          {
            title: "",
            width: 48,
            render: (_, u) => (
              <Dropdown trigger={["click"]} menu={{ items: menuFor(u).map((i) => ({ key: i.key, label: i.label, icon: i.icon, danger: i.danger, onClick: i.onClick })) }}>
                <Button type="text" icon={<MoreOutlined />} aria-label={`Tùy chọn cho ${u.full_name}`} />
              </Dropdown>
            ),
          },
        ]}
        />
      </div>
      )}

      {/* Tạo / sửa */}
      <Modal
        open={formOpen}
        title={editing ? "Sửa người dùng" : "Tạo người dùng"}
        onCancel={() => setFormOpen(false)}
        onOk={submitForm}
        okText={editing ? "Lưu" : "Tạo"}
        confirmLoading={saving}
        forceRender
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="fullName" label="Họ tên" rules={[{ required: true, whitespace: true, message: "Nhập họ tên" }]}>
            <Input placeholder="Nguyễn Văn A" />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, whitespace: true, type: "email", message: "Email không hợp lệ" }]}>
            <Input placeholder="a.nguyen@pmh.com.vn" />
          </Form.Item>
          <Form.Item name="employeeCode" label="Mã nhân viên" rules={[{ required: true, whitespace: true, message: "Nhập mã NV" }]}>
            <Input placeholder="NV123" />
          </Form.Item>
          <Form.Item name="department" label="Phòng ban" rules={[{ required: true, message: "Chọn phòng ban" }]}>
            <Select
              showSearch
              placeholder="Chọn phòng ban"
              optionFilterProp="label"
              options={deptOptions}
              notFoundContent={
                departments.length
                  ? "Không tìm thấy"
                  : "Chưa có phòng ban — tạo ở mục Nhóm / Phòng ban"
              }
            />
          </Form.Item>
          {!editing && (
            <>
              <Form.Item name="groupIds" label="Nhóm (tùy chọn)">
                <Select
                  mode="multiple"
                  allowClear
                  placeholder="Chọn một hoặc nhiều nhóm — gán quyền vào app ngay khi tạo"
                  optionFilterProp="label"
                  options={groups.filter((g) => !pickedGroups.includes(g.id)).map((g) => ({
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
                if (!apps.length) return null;
                return (
                  <Alert
                    type="success"
                    showIcon
                    style={{ marginBottom: 16, marginTop: -4 }}
                    message={`Với nhóm đã chọn, user vào được: ${apps.join(", ")}`}
                  />
                );
              })()}
              <Form.Item
                name="password"
                label="Mật khẩu (tùy chọn)"
                extra="Bỏ trống → người dùng chưa có mật khẩu, phải dùng 'Đặt lại mật khẩu' hoặc 'Quên mật khẩu' để lấy mật khẩu tạm. Đặt tại đây khi chưa cấu hình email. Tối thiểu 8 ký tự đủ 4 loại."
              >
                <Input.Password aria-label="Mật khẩu mới (để trống nếu gửi mã tạm qua email)" placeholder="Để trống nếu gửi mật khẩu tạm sau" autoComplete="new-password" />
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
        <Input type="date" aria-label="Ngày hết hạn" style={{ marginTop: 12 }} value={expiryVal} onChange={(e) => setExpiryVal(e.target.value)} />
      </Modal>

      {/* Reset mật khẩu — 2 chế độ: MK tạm qua email HOẶC đặt thủ công */}
      <Modal
        open={!!resetFor}
        title={resetFor ? `Đặt lại mật khẩu · ${resetFor.full_name}` : ""}
        onCancel={() => setResetFor(null)}
        onOk={submitReset}
        okText={isSsa && resetPw ? "Đặt mật khẩu" : "Gửi mật khẩu tạm qua email"}
        confirmLoading={resetting}
        destroyOnHidden
      >
        <Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
          {isSsa ? (
            <>
              Để trống → gửi <b>mật khẩu tạm qua email</b> (buộc đổi khi đăng nhập). Nhập mật khẩu để{" "}
              <b>đặt thủ công</b> (dùng khi chưa cấu hình email). Thu hồi mọi phiên của user.
            </>
          ) : (
            <>Gửi <b>mật khẩu tạm qua email</b> (buộc đổi khi đăng nhập). Thu hồi phiên trong phạm vi dự án của bạn.</>
          )}
        </Text>
        {isSsa && (
          <>
            <Input.Password
              aria-label="Mật khẩu mới (để trống nếu gửi mã tạm qua email)"
              placeholder="Để trống nếu gửi mật khẩu tạm qua email"
              value={resetPw}
              autoComplete="new-password"
              onChange={(e) => setResetPw(e.target.value)}
            />
            <PwChecklist pw={resetPw} />
            {resetPw && (
              <Checkbox checked={resetMustChange} onChange={(e) => setResetMustChange(e.target.checked)} style={{ marginTop: 12 }}>
                Bắt người dùng đổi mật khẩu ở lần đăng nhập đầu (khuyến nghị)
              </Checkbox>
            )}
          </>
        )}
      </Modal>

      {/* onDone chỉ NẠP LẠI, KHÔNG đóng — giữ bảng kết quả từng dòng để admin thấy
          dòng nào lỗi rồi sửa & nhập lại; đóng bằng nút "Đóng". */}
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} onDone={load} />

      <UserGroupsDrawer
        user={groupsFor}
        groups={groups}
        accessMap={accessMap}
        onClose={() => setGroupsFor(null)}
        onReload={load}
      />

      {/* Xóa vĩnh viễn — buộc gõ đúng mã NV; không hoàn tác */}
      <Modal
        open={!!hardDelFor}
        title="Xóa vĩnh viễn người dùng"
        okText="Xóa vĩnh viễn"
        okButtonProps={{ danger: true, disabled: hardDelText.trim() !== hardDelFor?.employee_code }}
        confirmLoading={hardDeleting}
        onOk={submitHardDelete}
        onCancel={() => { setHardDelFor(null); setHardDelText(""); }}
        cancelText="Hủy"
        destroyOnHidden
      >
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          message="Hành động KHÔNG THỂ hoàn tác"
          description={hardDelFor ? `Xóa hẳn ${hardDelFor.full_name} (${hardDelFor.email}) khỏi hệ thống: mọi nhóm, phiên, quyền và dữ liệu MFA sẽ bị gỡ. Không khôi phục được.` : ""}
        />
        <Text type="secondary" style={{ display: "block", marginBottom: 8 }}>
          Gõ đúng mã nhân viên <b>{hardDelFor?.employee_code}</b> để xác nhận:
        </Text>
        <Input
          aria-label="Gõ mã nhân viên để xác nhận xóa vĩnh viễn"
          value={hardDelText}
          onChange={(e) => setHardDelText(e.target.value)}
          placeholder={hardDelFor?.employee_code}
          onPressEnter={() => { if (hardDelText.trim() === hardDelFor?.employee_code) submitHardDelete(); }}
        />
      </Modal>

      {/* Gán nhóm hàng loạt */}
      <Modal
        open={bulkOpen}
        title={`Gán ${selectedKeys.length} user vào nhóm`}
        onCancel={() => { setBulkOpen(false); setBulkGroups([]); }}
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
          aria-label="Chọn nhóm để gán" placeholder="Chọn nhóm…"
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

  // Đóng modal → xóa CSV + báo cáo preview cũ, để lần mở sau không dính lô trước
  // (trước đây onDone đóng mà không reset → "Ghi N dòng" theo số cũ, ghi nhầm).
  useEffect(() => {
    if (!open) { setCsv(""); setReport(null); setAutoGroups(false); }
  }, [open]);

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
      title="Nhập người dùng từ CSV"
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
      <Text type="secondary">Cột bắt buộc: <code>employee_code, email, full_name, department</code> (department phải có trong danh mục Phòng ban). Cột tùy chọn <code>groups</code> (nhiều nhóm cách nhau bằng <code>;</code>).</Text>
      <Upload
        accept=".csv,text/csv"
        showUploadList={false}
        beforeUpload={(f) => { f.text().then((t) => { setCsv(t); setReport(null); }); return false; }}
      >
        <Button size="small" icon={<UploadOutlined />} style={{ margin: "10px 0" }}>Chọn file .csv</Button>
      </Upload>
      <Input.TextArea
        rows={5}
        value={csv}
        onChange={(e) => { setCsv(e.target.value); setReport(null); }}
        placeholder={"employee_code,email,full_name,department,groups\nNV900,a.tran@pmh.com.vn,Trần Văn A,Kế toán,Kế toán;Sales"}
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

/** Sửa NHÓM của một user ngay từ hàng của họ (xem/thêm/gỡ). Nhóm = quyền vào app. */
function UserGroupsDrawer({ user, groups, accessMap, onClose, onReload }: {
  user: UserRow | null;
  groups: { id: string; name: string }[];
  accessMap: Record<string, string[]>;
  onClose: () => void;
  onReload: () => void;
}) {
  const { message, modal } = AntApp.useApp();
  const [current, setCurrent] = useState<{ id: string; name: string }[]>([]);
  const [pick, setPick] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    const byName = new Map(groups.map((g) => [g.name, g] as const));
    setCurrent((user.groups ?? []).flatMap((n) => { const g = byName.get(n); return g ? [g] : []; }));
    setPick([]);
  }, [user, groups]);

  const removeG = (g: { id: string; name: string }) =>
    modal.confirm({
      title: `Gỡ khỏi nhóm "${g.name}"?`,
      content: "Người dùng sẽ mất quyền vào ứng dụng mà nhóm này mở, và phiên đăng nhập liên quan bị thu hồi.",
      okText: "Gỡ khỏi nhóm", okButtonProps: { danger: true }, cancelText: "Hủy",
      onOk: async () => {
        try {
          await api(`/api/admin/groups/${g.id}/members/${user!.id}`, { method: "DELETE" });
          setCurrent((c) => c.filter((x) => x.id !== g.id));
          onReload();
        } catch (e) { message.error((e as Error).message); }
      },
    });

  const addG = async () => {
    setBusy(true);
    const added: { id: string; name: string }[] = [];
    for (const gid of pick) {
      const g = groups.find((x) => x.id === gid);
      try { await api(`/api/admin/groups/${gid}/members`, { method: "POST", body: { userId: user!.id } }); if (g) added.push(g); } catch { /* bỏ qua */ }
    }
    setBusy(false);
    setCurrent((c) => [...c, ...added]);
    setPick([]);
    onReload();
    if (added.length) message.success(`Đã thêm vào ${added.length} nhóm`);
  };

  const currentIds = new Set(current.map((g) => g.id));
  const cands = groups.filter((g) => !currentIds.has(g.id));

  return (
    <Drawer open={!!user} onClose={onClose} width={440} title={user ? `Nhóm & quyền · ${user.full_name}` : ""}>
      <Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
        Nhóm quyết định người dùng vào được ứng dụng nào. Gỡ khỏi nhóm sẽ thu hồi phiên liên quan.
      </Text>
      <div className="pmh-add-block">
        <div className="pmh-add-block__label"><ApartmentOutlined /> Thêm vào nhóm</div>
        <Space.Compact style={{ width: "100%" }}>
          <Select
            mode="multiple" showSearch allowClear style={{ width: "100%" }}
            placeholder="Chọn nhóm để thêm…" value={pick} onChange={setPick}
            optionFilterProp="label"
            options={cands.map((g) => ({ value: g.id, label: g.name }))}
            optionRender={(o) => {
              const apps = accessMap[o.value as string] ?? [];
              return (
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span>{o.label}</span>
                  {apps.length > 0 && <Text type="secondary" style={{ fontSize: 12 }}>→ {apps.join(", ")}</Text>}
                </div>
              );
            }}
          />
          <Button type="primary" loading={busy} disabled={!pick.length} onClick={addG}>Thêm</Button>
        </Space.Compact>
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--a-ink-2)", margin: "4px 0 8px" }}>Đang thuộc {current.length} nhóm</div>
      {current.length ? (
        <Space size={[8, 8]} wrap>
          {current.map((g) => {
            const apps = accessMap[g.id] ?? [];
            return (
              <Tag key={g.id} closable onClose={(e) => { e.preventDefault(); removeG(g); }} style={{ padding: "4px 8px", marginInlineEnd: 0 }}>
                {g.name}{apps.length ? <Text type="secondary" style={{ fontSize: 11, marginLeft: 6 }}>→ {apps.join(", ")}</Text> : null}
              </Tag>
            );
          })}
        </Space>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa thuộc nhóm nào — chưa vào được app nào" />
      )}
    </Drawer>
  );
}
