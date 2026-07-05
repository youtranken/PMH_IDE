import { AppstoreOutlined, CopyOutlined, PlusOutlined, SafetyOutlined, TeamOutlined } from "@ant-design/icons";
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
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from "antd";
import { useEffect, useState } from "react";
import { api } from "../auth";
import { BRAND, initials } from "../ui";

const { Title, Text } = Typography;

interface Row { id: string; name: string; description: string | null; created_at: string }
interface Person { user_id: string; email: string; full_name: string }
interface UserRow { id: string; email: string; full_name: string; deleted_at: string | null }
interface Client {
  id: string; project_id: string; client_id: string; name: string; env: string;
  redirect_uris: string[]; app_url: string | null; allow_all_groups: boolean; disabled: boolean; created_at: string;
}

export default function AdminProjects() {
  const { message } = AntApp.useApp();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [form] = Form.useForm();
  const [editing, setEditing] = useState<Row | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [adminsOf, setAdminsOf] = useState<Row | null>(null);
  const [clientsOf, setClientsOf] = useState<Row | null>(null);

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
    <div style={{ maxWidth: 940, margin: "0 auto", width: "100%" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
        <div>
          <Title level={3} style={{ marginBottom: 2 }}>Dự án & ứng dụng</Title>
          <Text type="secondary">Mỗi dự án chứa các ứng dụng (client) kết nối SSO và có quản trị viên riêng.</Text>
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
            width: 320,
            align: "right",
            render: (_, p) => (
              <Space>
                <Button size="small" icon={<AppstoreOutlined />} onClick={() => setClientsOf(p)}>Ứng dụng</Button>
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
      <ClientsDrawer project={clientsOf} onClose={() => setClientsOf(null)} />
    </div>
  );
}

/* ---------- Quản trị viên dự án ---------- */
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

/* ---------- Ứng dụng (client) của dự án ---------- */
function ClientsDrawer({ project, onClose }: { project: Row | null; onClose: () => void }) {
  const { message } = AntApp.useApp();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [groupsFor, setGroupsFor] = useState<Client | null>(null);
  const [secret, setSecret] = useState<{ title: string; secret: string; note?: string } | null>(null);

  const load = () => {
    if (!project) return;
    setLoading(true);
    api<Client[]>("/api/admin/clients").then((all) => setClients(all.filter((c) => c.project_id === project.id))).finally(() => setLoading(false));
  };
  useEffect(load, [project]);

  const toggle = async (c: Client) => {
    try { await api(`/api/admin/clients/${c.id}/${c.disabled ? "enable" : "disable"}`, { method: "POST" }); message.success(c.disabled ? "Đã bật" : "Đã tắt"); load(); }
    catch (e) { message.error((e as Error).message); }
  };
  const rotate = async (c: Client) => {
    try {
      const r = await api<{ secret: string; graceHours: number }>(`/api/admin/clients/${c.id}/rotate-secret`, { method: "POST" });
      setSecret({ title: `Secret mới · ${c.client_id}`, secret: r.secret, note: `Secret cũ còn hiệu lực thêm ${r.graceHours} giờ (ân hạn).` });
    } catch (e) { message.error((e as Error).message); }
  };

  return (
    <>
      <Drawer open={!!project} onClose={onClose} width={620} title={project ? `Ứng dụng · ${project.name}` : ""}
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>Tạo ứng dụng</Button>}>
        <List
          loading={loading}
          locale={{ emptyText: <Empty description="Chưa có ứng dụng nào" /> }}
          dataSource={clients}
          renderItem={(c) => (
            <List.Item
              actions={[
                <Button key="g" size="small" icon={<SafetyOutlined />} onClick={() => setGroupsFor(c)}>Nhóm</Button>,
                <Button key="r" size="small" onClick={() => rotate(c)}>Xoay secret</Button>,
                <Button key="t" size="small" type="text" danger={!c.disabled} onClick={() => toggle(c)}>{c.disabled ? "Bật" : "Tắt"}</Button>,
                <Button key="e" size="small" type="text" onClick={() => setEditing(c)}>Sửa</Button>,
              ]}
            >
              <List.Item.Meta
                title={
                  <Space>
                    <span style={{ color: BRAND.ink }}>{c.name}</span>
                    <Tag color={c.env === "prod" ? "green" : "default"} style={{ textTransform: "uppercase" }}>{c.env}</Tag>
                    {c.disabled && <Tag color="red">Đã tắt</Tag>}
                    {c.allow_all_groups && <Tag color="gold">Mọi nhóm</Tag>}
                  </Space>
                }
                description={<Text code style={{ fontSize: 12 }}>{c.client_id}</Text>}
              />
            </List.Item>
          )}
        />
      </Drawer>

      {project && (
        <ClientForm
          open={createOpen || !!editing}
          project={project}
          client={editing}
          onClose={() => { setCreateOpen(false); setEditing(null); }}
          onCreated={(s) => { setCreateOpen(false); setSecret({ title: `Secret · ${s.clientId}`, secret: s.secret, note: "Secret chỉ hiện một lần — lưu ngay." }); load(); }}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
      <ClientGroups client={groupsFor} onClose={() => setGroupsFor(null)} onChanged={load} />
      <SecretModal data={secret} onClose={() => setSecret(null)} />
    </>
  );
}

function ClientForm({ open, project, client, onClose, onCreated, onSaved }: {
  open: boolean; project: Row; client: Client | null; onClose: () => void;
  onCreated: (s: { clientId: string; secret: string }) => void; onSaved: () => void;
}) {
  const { message } = AntApp.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const edit = !!client;

  useEffect(() => {
    if (!open) return;
    if (client) form.setFieldsValue({ name: client.name, redirectUris: client.redirect_uris.join("\n"), appUrl: client.app_url ?? "" });
    else form.resetFields();
  }, [open, client]);

  const submit = async () => {
    const v = await form.validateFields();
    const redirectUris = (v.redirectUris ?? "").split(/[\n,]/).map((s: string) => s.trim()).filter(Boolean);
    setSaving(true);
    try {
      if (edit) {
        await api(`/api/admin/clients/${client!.id}`, { method: "PATCH", body: { name: v.name, redirectUris, appUrl: v.appUrl || undefined } });
        message.success("Đã cập nhật ứng dụng");
        onSaved();
      } else {
        const r = await api<{ secret: string }>("/api/admin/clients", {
          method: "POST",
          body: { projectId: project.id, clientId: v.clientId, name: v.name, env: v.env, redirectUris, appUrl: v.appUrl || undefined },
        });
        onCreated({ clientId: v.clientId, secret: r.secret });
      }
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} title={edit ? "Sửa ứng dụng" : "Tạo ứng dụng"} onCancel={onClose} onOk={submit} okText={edit ? "Lưu" : "Tạo"} confirmLoading={saving} destroyOnHidden width={520}>
      <Form form={form} layout="vertical" requiredMark={false} style={{ marginTop: 12 }} initialValues={{ env: "dev" }}>
        {!edit && (
          <Space style={{ display: "flex" }} align="start">
            <Form.Item name="clientId" label="Client ID" rules={[{ required: true, message: "Nhập client_id" }]} style={{ flex: 1 }}>
              <Input placeholder="ban-hang-web" />
            </Form.Item>
            <Form.Item name="env" label="Môi trường" rules={[{ required: true }]}>
              <Select style={{ width: 120 }} options={[{ value: "dev", label: "dev" }, { value: "prod", label: "prod" }]} />
            </Form.Item>
          </Space>
        )}
        <Form.Item name="name" label="Tên hiển thị" rules={[{ required: true, message: "Nhập tên" }]}>
          <Input placeholder="Web bán hàng" />
        </Form.Item>
        <Form.Item name="appUrl" label="App URL (mở từ Launcher)">
          <Input placeholder="https://banhang.pmh.com.vn" />
        </Form.Item>
        <Form.Item name="redirectUris" label="Redirect URIs" extra="Mỗi URL một dòng. Phải là URL tuyệt đối http(s)://">
          <Input.TextArea rows={3} placeholder={"https://banhang.pmh.com.vn/callback"} style={{ fontFamily: "ui-monospace, monospace", fontSize: 13 }} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

function ClientGroups({ client, onClose, onChanged }: { client: Client | null; onClose: () => void; onChanged: () => void }) {
  const { message } = AntApp.useApp();
  const [assigned, setAssigned] = useState<{ group_id: string; name: string }[]>([]);
  const [all, setAll] = useState<{ id: string; name: string }[]>([]);
  const [allowAll, setAllowAll] = useState(false);
  const [pick, setPick] = useState<string | undefined>();

  useEffect(() => {
    if (!client) return;
    setAllowAll(client.allow_all_groups);
    api<{ group_id: string; name: string }[]>(`/api/admin/clients/${client.id}/groups`).then(setAssigned);
    if (!all.length) api<{ id: string; name: string }[]>("/api/admin/groups").then(setAll).catch(() => {});
  }, [client]);

  const toggleAll = async (v: boolean) => {
    try { await api(`/api/admin/clients/${client!.id}/allow-all`, { method: "POST", body: { allowAll: v } }); setAllowAll(v); message.success(v ? "Cho mọi nhóm login" : "Chỉ nhóm được gán"); onChanged(); }
    catch (e) { message.error((e as Error).message); }
  };
  const add = async () => {
    try { await api(`/api/admin/clients/${client!.id}/groups`, { method: "POST", body: { groupId: pick } }); setPick(undefined); api<{ group_id: string; name: string }[]>(`/api/admin/clients/${client!.id}/groups`).then(setAssigned); }
    catch (e) { message.error((e as Error).message); }
  };
  const remove = async (gid: string) => {
    try { await api(`/api/admin/clients/${client!.id}/groups/${gid}`, { method: "DELETE" }); setAssigned((a) => a.filter((x) => x.group_id !== gid)); }
    catch (e) { message.error((e as Error).message); }
  };
  const cands = all.filter((g) => !assigned.some((a) => a.group_id === g.id));

  return (
    <Modal open={!!client} title={client ? `Nhóm được vào · ${client.name}` : ""} onCancel={onClose} footer={<Button onClick={onClose}>Đóng</Button>}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0 14px" }}>
        <div>
          <div style={{ fontWeight: 600 }}>Cho mọi nhóm login</div>
          <Text type="secondary" style={{ fontSize: 13 }}>Kể cả nhóm tạo sau. Không nới quyền danh bạ.</Text>
        </div>
        <Switch checked={allowAll} onChange={toggleAll} />
      </div>
      {!allowAll && (
        <>
          <Space.Compact style={{ width: "100%", marginBottom: 12 }}>
            <Select showSearch placeholder="Thêm nhóm được vào…" style={{ width: "100%" }} value={pick} onChange={setPick}
              filterOption={(i, o) => (o?.label as string).toLowerCase().includes(i.toLowerCase())}
              options={cands.map((g) => ({ value: g.id, label: g.name }))} />
            <Button type="primary" disabled={!pick} onClick={add}>Thêm</Button>
          </Space.Compact>
          {assigned.length === 0 ? (
            <Alert type="warning" showIcon message="Chưa gán nhóm nào — hiện chưa ai vào được ứng dụng này." />
          ) : (
            <Space wrap>
              {assigned.map((g) => (
                <Tag key={g.group_id} closable onClose={() => remove(g.group_id)} style={{ padding: "4px 10px" }}>{g.name}</Tag>
              ))}
            </Space>
          )}
        </>
      )}
    </Modal>
  );
}

function SecretModal({ data, onClose }: { data: { title: string; secret: string; note?: string } | null; onClose: () => void }) {
  const { message } = AntApp.useApp();
  return (
    <Modal open={!!data} title={data?.title} onCancel={onClose} footer={<Button type="primary" onClick={onClose}>Đã lưu, đóng</Button>} maskClosable={false}>
      <Alert type="warning" showIcon style={{ marginBottom: 12 }} message="Secret chỉ hiển thị một lần" description={data?.note} />
      <Input.Group compact style={{ display: "flex" }}>
        <Input readOnly value={data?.secret} style={{ fontFamily: "ui-monospace, monospace" }} />
        <Button icon={<CopyOutlined />} onClick={() => { navigator.clipboard?.writeText(data?.secret ?? ""); message.success("Đã copy"); }}>Copy</Button>
      </Input.Group>
    </Modal>
  );
}
