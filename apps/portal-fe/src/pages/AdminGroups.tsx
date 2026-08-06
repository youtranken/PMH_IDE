import { ApartmentOutlined, BankOutlined, DeleteOutlined, PlusOutlined, TeamOutlined } from "@ant-design/icons";
import {
  Alert,
  App as AntApp,
  Avatar,
  Button,
  Drawer,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
} from "antd";
import { useEffect, useState } from "react";
import { api } from "../auth";
import { UserPicker } from "../UserPicker";
import { BRAND, initials, ListEmpty, PageHeader } from "../ui";

/**
 * Trang "Nhóm / Phòng ban": một sidebar-item, hai phân hệ chuyển bằng Segmented.
 * Nhóm = quyền vào app (client_groups). Phòng ban = nhãn tổ chức để gán cho user.
 */
export default function AdminGroupsPage({ isSsa }: { isSsa: boolean }) {
  const [tab, setTab] = useState<"groups" | "departments">("groups");
  return (
    <div>
      <Segmented
        value={tab}
        onChange={(v) => setTab(v as "groups" | "departments")}
        style={{ marginBottom: 12 }}
        options={[
          { label: "Nhóm", value: "groups", icon: <ApartmentOutlined /> },
          { label: "Phòng ban", value: "departments", icon: <BankOutlined /> },
        ]}
      />
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 20 }}
        message={
          <span>
            <b>Nhóm</b> = cấp quyền vào ứng dụng (gỡ khỏi nhóm ⇒ mất quyền + thu hồi phiên).{" "}
            <b>Phòng ban</b> = nhãn tổ chức, KHÔNG liên quan quyền. Mỗi người thuộc <b>1</b> phòng ban nhưng có thể ở <b>nhiều</b> nhóm.
          </span>
        }
      />
      {tab === "groups" ? <GroupsPanel isSsa={isSsa} /> : <DepartmentsPanel isSsa={isSsa} />}
    </div>
  );
}

interface GroupRow {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}
interface Member {
  user_id: string;
  email: string;
  full_name: string;
}
interface UserRow {
  id: string;
  email: string;
  full_name: string;
  department: string;
  deleted_at: string | null;
}

function GroupsPanel({ isSsa }: { isSsa: boolean }) {
  const { message, modal } = AntApp.useApp();
  const [rows, setRows] = useState<GroupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form] = Form.useForm();
  const [editing, setEditing] = useState<GroupRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [membersOf, setMembersOf] = useState<GroupRow | null>(null);

  const load = () => {
    setLoading(true);
    api<GroupRow[]>("/api/admin/groups")
      .then((r) => { setRows(r); setError(null); })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openCreate = () => { setEditing(null); form.resetFields(); setFormOpen(true); };
  const openEdit = (g: GroupRow) => { setEditing(g); form.setFieldsValue(g); setFormOpen(true); };

  const remove = (g: GroupRow) =>
    modal.confirm({
      title: `Xóa nhóm "${g.name}"?`,
      content:
        "Mọi người dùng trong nhóm sẽ RỜI nhóm và mất quyền vào app mà nhóm này mở (phiên đăng nhập của họ bị thu hồi). Không xóa được user — chỉ xóa nhóm.",
      okText: "Xóa nhóm",
      okButtonProps: { danger: true },
      cancelText: "Hủy",
      onOk: async () => {
        try {
          const r = await api<{ removedMembers: number; revoked: number }>(
            `/api/admin/groups/${g.id}`,
            { method: "DELETE" },
          );
          message.success(`Đã xóa nhóm — ${r.removedMembers} user rời nhóm, thu hồi ${r.revoked} phiên`);
          load();
        } catch (e) {
          message.error((e as Error).message);
        }
      },
    });

  const submit = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      if (editing) {
        await api(`/api/admin/groups/${editing.id}`, { method: "PATCH", body: v });
        message.success("Đã cập nhật nhóm");
      } else {
        const r = await api<{ warning?: string }>("/api/admin/groups", { method: "POST", body: v });
        message.success("Đã tạo nhóm");
        if (r.warning) message.warning(r.warning, 6);
      }
      setFormOpen(false);
      load();
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Nhóm"
        sub="Nhóm quyết định người dùng được vào ứng dụng nào và phạm vi danh bạ."
        actions={<Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Tạo nhóm</Button>}
      />

      <div className="pmh-admin__card">
      <Table<GroupRow>
        rowKey="id"
        loading={loading}
        dataSource={rows}
        pagination={false}
        onRow={(_, i) => ({ style: { "--pmh-i": Math.min(i ?? 0, 14) } as import("react").CSSProperties })}
        locale={{
          emptyText: (
            <ListEmpty
              error={error}
              onRetry={load}
              description="Chưa có nhóm nào — tạo nhóm để mở quyền vào ứng dụng."
            >
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Tạo nhóm</Button>
            </ListEmpty>
          ),
        }}
        columns={[
          {
            title: "Nhóm",
            render: (_, g) => (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Avatar shape="square" style={{ background: "var(--a-chip)", color: BRAND.green, borderRadius: 10, flex: "0 0 auto" }} icon={<TeamOutlined />} />
                <div>
                  <div style={{ fontWeight: 600, color: BRAND.ink }}>{g.name}</div>
                  {g.description && <div style={{ color: BRAND.muted, fontSize: 13 }}>{g.description}</div>}
                </div>
              </div>
            ),
          },
          {
            title: "",
            width: 220,
            align: "right",
            render: (_, g) => (
              <Space>
                <Button size="small" onClick={() => setMembersOf(g)}>Thành viên</Button>
                {isSsa && <Button size="small" type="text" onClick={() => openEdit(g)}>Sửa</Button>}
                {isSsa && <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => remove(g)}>Xóa</Button>}
              </Space>
            ),
          },
        ]}
      />
      </div>

      <Modal
        open={formOpen}
        title={editing ? "Sửa nhóm" : "Tạo nhóm"}
        onCancel={() => setFormOpen(false)}
        onOk={submit}
        okText={editing ? "Lưu" : "Tạo"}
        confirmLoading={saving}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" requiredMark={false} style={{ marginTop: 12 }}>
          <Form.Item name="name" label="Tên nhóm" rules={[{ required: true, message: "Nhập tên nhóm" }]}>
            <Input placeholder="Kế toán" />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <Input placeholder="Tùy chọn" />
          </Form.Item>
        </Form>
      </Modal>

      <MembersDrawer group={membersOf} onClose={() => setMembersOf(null)} />
    </div>
  );
}

function MembersDrawer({ group, onClose }: { group: GroupRow | null; onClose: () => void }) {
  const { message, modal } = AntApp.useApp();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [deptCatalog, setDeptCatalog] = useState<string[]>([]);
  const [deptPicked, setDeptPicked] = useState<{ name: string; n: number } | null>(null);

  const load = () => {
    if (!group) return;
    setLoading(true);
    // Reset TRƯỚC: nếu tải lỗi, không được hiện nhầm danh sách thành viên của
    // nhóm vừa mở trước đó dưới tiêu đề nhóm hiện tại (dễ gỡ nhầm người).
    setMembers([]);
    api<Member[]>(`/api/admin/groups/${group.id}/members`)
      .then(setMembers)
      .catch((e) => message.error(`Không tải được thành viên: ${(e as Error).message}`))
      .finally(() => setLoading(false));
  };
  useEffect(load, [group]);
  useEffect(() => { setAdding([]); setDeptPicked(null); }, [group]);
  useEffect(() => {
    if (group && deptCatalog.length === 0)
      api<{ name: string }[]>("/api/admin/departments")
        .then((r) => setDeptCatalog(r.map((d) => d.name)))
        .catch(() => {});
  }, [group]);

  // Thêm NHIỀU thành viên một lần — mỗi người một lời gọi (API thêm từng user).
  const addMany = async () => {
    setBusy(true);
    const failed: string[] = [];
    for (const userId of adding) {
      try {
        await api(`/api/admin/groups/${group!.id}/members`, { method: "POST", body: { userId } });
      } catch {
        failed.push(userId);
      }
    }
    setBusy(false);
    if (failed.length) message.warning(`Chưa thêm được: ${failed.join(", ")}`);
    else message.success(`Đã thêm ${adding.length} thành viên`);
    setAdding([]);
    setDeptPicked(null);
    load();
  };
  const remove = (userId: string) => {
    const m = members.find((x) => x.user_id === userId);
    modal.confirm({
      title: "Gỡ khỏi nhóm?",
      content: `${m?.full_name ?? "Người dùng"} sẽ mất quyền vào ứng dụng mà nhóm này mở, và mọi phiên đăng nhập bị thu hồi.`,
      okText: "Gỡ khỏi nhóm",
      okButtonProps: { danger: true },
      cancelText: "Hủy",
      onOk: () => doRemove(userId),
    });
  };
  const doRemove = async (userId: string) => {
    try {
      const r = await api<{ revoked: number }>(`/api/admin/groups/${group!.id}/members/${userId}`, { method: "DELETE" });
      message.success(`Đã gỡ khỏi nhóm — thu hồi ${r.revoked} phiên`);
      load();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const memberIds = members.map((m) => m.user_id);
  const deptOptions = deptCatalog
    .slice()
    .sort((a, b) => a.localeCompare(b, "vi"))
    .map((d) => ({ value: d, label: d }));

  // Điền nhanh theo phòng ban: hỏi SERVER danh sách người của phòng (chính xác,
  // không giới hạn tập đã tải) rồi đưa những ai CHƯA là thành viên vào ô chọn.
  const quickFillDept = async (d: string) => {
    try {
      const us = await api<{ id: string }[]>(`/api/admin/users?department=${encodeURIComponent(d)}`);
      const inGroup = new Set(memberIds);
      const ids = us.map((u) => u.id).filter((id) => !inGroup.has(id));
      setAdding((prev) => [...new Set([...prev, ...ids])]);
      setDeptPicked({ name: d, n: ids.length });
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  return (
    <Drawer open={!!group} onClose={onClose} width={440} title={group ? `Thành viên · ${group.name}` : ""}>
      <div className="pmh-add-block">
        <div className="pmh-add-block__label"><TeamOutlined /> Thêm thành viên vào nhóm</div>
        <div style={{ display: "flex", gap: 8 }}>
          <UserPicker
            mode="multiple"
            placeholder="Gõ tên/email/mã NV để thêm…"
            style={{ flex: 1 }}
            value={adding}
            onChange={setAdding}
            excludeIds={memberIds}
          />
          <Button type="primary" loading={busy} disabled={!adding.length} onClick={addMany}>
            Thêm{adding.length ? ` (${adding.length})` : ""}
          </Button>
        </div>

        {deptOptions.length > 0 && (
          <div className="pmh-add-block__helper">
            <BankOutlined style={{ color: "var(--a-ink-3)" }} />
            <Select
              showSearch
              size="small"
              placeholder="Điền nhanh theo phòng ban…"
              style={{ flex: 1 }}
              value={undefined}
              optionFilterProp="label"
              options={deptOptions}
              onChange={(d?: string) => { if (d) quickFillDept(d); }}
            />
          </div>
        )}
        {deptPicked && (
          <Alert
            type={deptPicked.n ? "info" : "warning"}
            showIcon
            style={{ marginTop: 8 }}
            message={
              deptPicked.n
                ? `Đã đưa ${deptPicked.n} thành viên hiện có của "${deptPicked.name}" vào ô chọn phía trên — kiểm rồi bấm "Thêm". Chỉ thêm người ĐANG thuộc phòng; người vào phòng sau này sẽ KHÔNG tự vào nhóm.`
                : `Phòng "${deptPicked.name}" chưa có ai (hoặc tất cả đã ở trong nhóm) để thêm.`
            }
          />
        )}
      </div>

      <List
        loading={loading}
        locale={{ emptyText: <Empty description="Chưa có thành viên" /> }}
        dataSource={members}
        renderItem={(m) => (
          <List.Item
            actions={[<Button key="r" type="text" danger size="small" icon={<DeleteOutlined />} aria-label={`Gỡ ${m.full_name} khỏi nhóm`} onClick={() => remove(m.user_id)} />]}
          >
            <List.Item.Meta
              avatar={<Avatar style={{ background: "var(--a-chip)", color: BRAND.green, fontWeight: 700 }}>{initials(m.full_name)}</Avatar>}
              title={m.full_name}
              description={m.email}
            />
          </List.Item>
        )}
      />
    </Drawer>
  );
}

interface DepartmentRow {
  id: string;
  name: string;
  created_at: string;
  user_count: number;
}

/** Danh mục Phòng ban — nhãn tổ chức để gán cho user (KHÁC nhóm quyền). */
function DepartmentsPanel({ isSsa }: { isSsa: boolean }) {
  const { message, modal } = AntApp.useApp();
  const [rows, setRows] = useState<DepartmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form] = Form.useForm();
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [membersOf, setMembersOf] = useState<DepartmentRow | null>(null);

  const load = () => {
    setLoading(true);
    api<DepartmentRow[]>("/api/admin/departments")
      .then((r) => { setRows(r); setError(null); })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openCreate = () => { form.resetFields(); setFormOpen(true); };
  const submit = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      await api("/api/admin/departments", { method: "POST", body: { name: v.name } });
      message.success("Đã tạo phòng ban");
      setFormOpen(false);
      load();
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  const remove = (d: DepartmentRow) =>
    modal.confirm({
      title: `Xóa phòng ban "${d.name}"?`,
      content: "Chỉ xóa được khi không còn người dùng nào thuộc phòng ban này.",
      okText: "Xóa",
      okButtonProps: { danger: true },
      cancelText: "Hủy",
      onOk: async () => {
        try {
          await api(`/api/admin/departments/${d.id}`, { method: "DELETE" });
          message.success("Đã xóa phòng ban");
          load();
        } catch (e) {
          message.error((e as Error).message);
        }
      },
    });

  return (
    <div>
      <PageHeader
        title="Phòng ban"
        sub="Nhãn tổ chức gán cho user (khác nhóm quyền). Tạo tên ở đây để chọn khi tạo/sửa user."
        actions={<Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Tạo phòng ban</Button>}
      />

      <div className="pmh-admin__card">
        <Table<DepartmentRow>
          rowKey="id"
          loading={loading}
          dataSource={rows}
          pagination={false}
          onRow={(_, i) => ({ style: { "--pmh-i": Math.min(i ?? 0, 14) } as import("react").CSSProperties })}
          locale={{
            emptyText: (
              <ListEmpty
                error={error}
                onRetry={load}
                description="Chưa có phòng ban nào — tạo phòng ban để gán cho user."
              >
                <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Tạo phòng ban</Button>
              </ListEmpty>
            ),
          }}
          columns={[
            {
              title: "Phòng ban",
              render: (_, d) => (
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Avatar shape="square" style={{ background: "var(--a-chip)", color: BRAND.green, borderRadius: 10, flex: "0 0 auto" }} icon={<BankOutlined />} />
                  <span style={{ fontWeight: 600, color: BRAND.ink }}>{d.name}</span>
                </div>
              ),
            },
            {
              title: "Số user",
              width: 140,
              render: (_, d) => <Tag>{d.user_count}</Tag>,
            },
            {
              title: "",
              width: 220,
              align: "right",
              render: (_, d) => (
                <Space>
                  <Button size="small" onClick={() => setMembersOf(d)}>Thành viên</Button>
                  {isSsa && (
                    <Button
                      size="small"
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      disabled={d.user_count > 0}
                      title={d.user_count > 0 ? "Còn người dùng thuộc phòng ban này" : "Xóa phòng ban"}
                      onClick={() => remove(d)}
                    >
                      Xóa
                    </Button>
                  )}
                </Space>
              ),
            },
          ]}
        />
      </div>

      <DepartmentMembersDrawer dept={membersOf} allDepts={rows.map((r) => r.name)} onClose={() => setMembersOf(null)} onChanged={load} />

      <Modal
        open={formOpen}
        title="Tạo phòng ban"
        onCancel={() => setFormOpen(false)}
        onOk={submit}
        okText="Tạo"
        confirmLoading={saving}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="name" label="Tên phòng ban" rules={[{ required: true, whitespace: true, message: "Nhập tên phòng ban" }]}>
            <Input placeholder="Kế toán" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

/**
 * Quản lý nhân sự của MỘT phòng ban. Mỗi user chỉ thuộc 1 phòng ban → "thêm" =
 * GÁN/CHUYỂN user sang phòng ban này (đổi field department, ghi đè phòng cũ).
 * Không có "gỡ" vì department bắt buộc — muốn bỏ thì chuyển user sang phòng khác.
 */
function DepartmentMembersDrawer({ dept, allDepts, onClose, onChanged }: { dept: DepartmentRow | null; allDepts: string[]; onClose: () => void; onChanged: () => void }) {
  const { message } = AntApp.useApp();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [adding, setAdding] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [moveUser, setMoveUser] = useState<UserRow | null>(null);
  const [moveTo, setMoveTo] = useState<string | undefined>(undefined);
  const [moving, setMoving] = useState(false);

  // Thành viên phòng ban lấy TỪ SERVER (?department=) → khớp đúng số đếm "Số user",
  // không lệ thuộc tập 500 đã tải.
  const load = () => {
    if (!dept) return;
    setLoading(true);
    api<UserRow[]>(`/api/admin/users?department=${encodeURIComponent(dept.name)}`)
      .then((r) => setUsers(r.filter((u) => !u.deleted_at)))
      .catch((e) => message.error(`Không tải được danh sách người dùng: ${(e as Error).message}`))
      .finally(() => setLoading(false));
  };
  useEffect(load, [dept]);
  useEffect(() => { setAdding([]); }, [dept]);

  // Chuyển 1 người sang phòng ban KHÁC (từ ngay hàng của họ).
  const submitMove = async () => {
    if (!moveUser || !moveTo) return;
    setMoving(true);
    try {
      await api(`/api/admin/users/${moveUser.id}`, { method: "PATCH", body: { department: moveTo } });
      message.success(`Đã chuyển ${moveUser.full_name} sang "${moveTo}"`);
      setMoveUser(null); setMoveTo(undefined);
      onChanged();
      load();
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setMoving(false);
    }
  };

  const members = users; // đã là danh sách người thuộc phòng ban (từ server)

  // Chuyển từng user đã chọn sang phòng ban này (PATCH department — có validate +
  // chuẩn hóa casing + kiểm phạm vi ở BE).
  const addMany = async () => {
    setBusy(true);
    const failed: string[] = [];
    for (const userId of adding) {
      try {
        await api(`/api/admin/users/${userId}`, { method: "PATCH", body: { department: dept!.name } });
      } catch {
        failed.push(userId);
      }
    }
    setBusy(false);
    if (failed.length) message.warning(`Chưa chuyển được: ${failed.join(", ")}`);
    else message.success(`Đã chuyển ${adding.length} user sang "${dept!.name}"`);
    setAdding([]);
    onChanged(); // cập nhật "Số user" ở bảng phòng ban
    load();
  };

  return (
    <Drawer open={!!dept} onClose={onClose} width={440} title={dept ? `Thành viên · ${dept.name}` : ""}>
      <div className="pmh-add-block">
        <div className="pmh-add-block__label"><BankOutlined /> Chuyển người vào phòng ban này</div>
        <div style={{ display: "flex", gap: 8 }}>
          <UserPicker
            mode="multiple"
            placeholder="Gõ tìm người (đang ở phòng khác) để chuyển sang…"
            style={{ flex: 1 }}
            value={adding}
            onChange={setAdding}
            excludeIds={members.map((m) => m.id)}
          />
          <Button type="primary" loading={busy} disabled={!adding.length} onClick={addMany}>
            Chuyển{adding.length ? ` (${adding.length})` : ""}
          </Button>
        </div>
      </div>

      <List
        loading={loading}
        locale={{ emptyText: <Empty description="Chưa có người nào thuộc phòng ban này" /> }}
        dataSource={members}
        renderItem={(u) => (
          <List.Item
            actions={[
              <Button key="mv" type="text" size="small" onClick={() => { setMoveUser(u); setMoveTo(undefined); }}>Chuyển phòng</Button>,
            ]}
          >
            <List.Item.Meta
              avatar={<Avatar style={{ background: "var(--a-chip)", color: BRAND.green, fontWeight: 700 }}>{initials(u.full_name)}</Avatar>}
              title={u.full_name}
              description={u.email}
            />
          </List.Item>
        )}
      />

      <Modal
        open={!!moveUser}
        title={moveUser ? `Chuyển "${moveUser.full_name}" sang phòng ban` : ""}
        okText="Chuyển"
        okButtonProps={{ disabled: !moveTo }}
        confirmLoading={moving}
        onOk={submitMove}
        onCancel={() => { setMoveUser(null); setMoveTo(undefined); }}
        cancelText="Hủy"
        destroyOnHidden
      >
        <Select
          showSearch
          style={{ width: "100%" }}
          placeholder="Chọn phòng ban đích…"
          value={moveTo}
          onChange={setMoveTo}
          optionFilterProp="label"
          options={allDepts.filter((d) => d !== dept?.name).map((d) => ({ value: d, label: d }))}
        />
      </Modal>
    </Drawer>
  );
}
