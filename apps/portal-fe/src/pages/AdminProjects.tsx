import { AppstoreOutlined, PlusOutlined, TeamOutlined } from "@ant-design/icons";
import {
  App as AntApp,
  Avatar,
  Button,
  Drawer,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Select,
  Space,
  Table,
  Typography,
} from "antd";
import { useEffect, useState } from "react";
import { api } from "../auth";
import { BRAND, initials } from "../ui";

const { Title, Text } = Typography;

interface Row { id: string; name: string; description: string | null; created_at: string }
interface Person { user_id: string; email: string; full_name: string }
interface UserRow { id: string; email: string; full_name: string; deleted_at: string | null }

export default function AdminProjects() {
  const { message } = AntApp.useApp();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [form] = Form.useForm();
  const [editing, setEditing] = useState<Row | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [adminsOf, setAdminsOf] = useState<Row | null>(null);

  const load = () => {
    setLoading(true);
    api<Row[]>("/api/admin/projects").then(setRows).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openCreate = () => { setEditing(null); form.resetFields(); setFormOpen(true); };
  const openEdit = (p: Row) => { setEditing(p); form.setFieldsValue(p); setFormOpen(true); };
  const submit = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      if (editing) await api(`/api/admin/projects/${editing.id}`, { method: "PATCH", body: v });
      else await api("/api/admin/projects", { method: "POST", body: v });
      message.success(editing ? "Đã cập nhật dự án" : "Đã tạo dự án");
      setFormOpen(false);
      load();
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", width: "100%" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
        <div>
          <Title level={3} style={{ marginBottom: 2 }}>Dự án</Title>
          <Text type="secondary">Mỗi dự án nhóm các ứng dụng SSO và có quản trị viên riêng. Quản lý ứng dụng ở mục "Ứng dụng SSO".</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Tạo dự án</Button>
      </div>

      <Table<Row>
        rowKey="id"
        loading={loading}
        dataSource={rows}
        pagination={false}
        columns={[
          {
            title: "Dự án",
            render: (_, p) => (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Avatar shape="square" style={{ background: "#e8f0ed", color: BRAND.green, borderRadius: 10, flex: "0 0 auto" }} icon={<AppstoreOutlined />} />
                <div>
                  <div style={{ fontWeight: 600, color: BRAND.ink }}>{p.name}</div>
                  {p.description && <div style={{ color: BRAND.muted, fontSize: 13 }}>{p.description}</div>}
                </div>
              </div>
            ),
          },
          {
            title: "",
            width: 240,
            align: "right",
            render: (_, p) => (
              <Space>
                <Button size="small" icon={<TeamOutlined />} onClick={() => setAdminsOf(p)}>Quản trị</Button>
                <Button size="small" type="text" onClick={() => openEdit(p)}>Sửa</Button>
              </Space>
            ),
          },
        ]}
      />

      <Modal open={formOpen} title={editing ? "Sửa dự án" : "Tạo dự án"} onCancel={() => setFormOpen(false)} onOk={submit} okText={editing ? "Lưu" : "Tạo"} confirmLoading={saving} destroyOnHidden>
        <Form form={form} layout="vertical" requiredMark={false} style={{ marginTop: 12 }}>
          <Form.Item name="name" label="Tên dự án" rules={[{ required: true, message: "Nhập tên dự án" }]}>
            <Input placeholder="Hệ thống bán hàng" />
          </Form.Item>
          <Form.Item name="description" label="Mô tả"><Input placeholder="Tùy chọn" /></Form.Item>
        </Form>
      </Modal>

      <AdminsDrawer project={adminsOf} onClose={() => setAdminsOf(null)} />
    </div>
  );
}

function AdminsDrawer({ project, onClose }: { project: Row | null; onClose: () => void }) {
  const { message } = AntApp.useApp();
  const [people, setPeople] = useState<Person[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [pick, setPick] = useState<string | undefined>();

  const load = () => { if (project) api<Person[]>(`/api/admin/projects/${project.id}/admins`).then(setPeople); };
  useEffect(load, [project]);
  useEffect(() => { if (project && !users.length) api<UserRow[]>("/api/admin/users").then(setUsers).catch(() => {}); }, [project]);

  const add = async () => {
    try { await api(`/api/admin/projects/${project!.id}/admins`, { method: "POST", body: { userId: pick } }); message.success("Đã bổ nhiệm"); setPick(undefined); load(); }
    catch (e) { message.error((e as Error).message); }
  };
  const remove = async (uid: string) => {
    try { await api(`/api/admin/projects/${project!.id}/admins/${uid}`, { method: "DELETE" }); message.success("Đã gỡ quyền"); load(); }
    catch (e) { message.error((e as Error).message); }
  };
  const has = new Set(people.map((p) => p.user_id));
  const cands = users.filter((u) => !u.deleted_at && !has.has(u.id));

  return (
    <Drawer open={!!project} onClose={onClose} width={440} title={project ? `Quản trị viên · ${project.name}` : ""}>
      <Text type="secondary" style={{ display: "block", marginBottom: 12 }}>Quản trị viên dự án quản lý user, nhóm và ứng dụng trong phạm vi dự án này.</Text>
      <Space.Compact style={{ width: "100%", marginBottom: 16 }}>
        <Select showSearch placeholder="Bổ nhiệm nhân viên…" style={{ width: "100%" }} value={pick} onChange={setPick}
          filterOption={(i, o) => (o?.label as string).toLowerCase().includes(i.toLowerCase())}
          options={cands.map((u) => ({ value: u.id, label: `${u.full_name} · ${u.email}` }))} />
        <Button type="primary" disabled={!pick} onClick={add}>Bổ nhiệm</Button>
      </Space.Compact>
      <List locale={{ emptyText: <Empty description="Chưa có quản trị viên" /> }} dataSource={people}
        renderItem={(m) => (
          <List.Item actions={[<Button key="r" type="text" danger size="small" onClick={() => remove(m.user_id)}>Gỡ</Button>]}>
            <List.Item.Meta avatar={<Avatar style={{ background: "#e8f0ed", color: BRAND.green, fontWeight: 700 }}>{initials(m.full_name)}</Avatar>} title={m.full_name} description={m.email} />
          </List.Item>
        )} />
    </Drawer>
  );
}
