import { ApiOutlined, CopyOutlined, MoreOutlined, PlusOutlined } from "@ant-design/icons";
import {
  Alert,
  App as AntApp,
  Avatar,
  Button,
  Dropdown,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from "antd";
import { useEffect, useMemo, useState } from "react";
import { api } from "../auth";
import { BRAND } from "../ui";

const { Title, Text } = Typography;

interface Client {
  id: string; project_id: string; client_id: string; name: string; env: string;
  redirect_uris: string[]; app_url: string | null; allow_all_groups: boolean; disabled: boolean; created_at: string;
}
interface Project { id: string; name: string }
type Secret = { title: string; secret: string; note?: string };

export default function AdminClients({ isSsa }: { isSsa: boolean }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [groupsFor, setGroupsFor] = useState<Client | null>(null);
  const [webhookFor, setWebhookFor] = useState<Client | null>(null);
  const [secret, setSecret] = useState<Secret | null>(null);

  const load = () => {
    setLoading(true);
    api<Client[]>("/api/admin/clients").then(setClients).finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
    if (isSsa) api<Project[]>("/api/admin/projects").then(setProjects).catch(() => {});
  }, []);

  const nameMap = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p.name])), [projects]);
  const projectName = (id: string) => nameMap[id] ?? `Dự án ${id.slice(0, 8)}`;

  // Tùy chọn dự án khi tạo client: SSA từ danh sách dự án; project_admin suy ra
  // từ các client đang có (không đọc được /projects do BE gác SSA).
  const projectOptions = useMemo(() => {
    if (isSsa) return projects.map((p) => ({ value: p.id, label: p.name }));
    const ids = [...new Set(clients.map((c) => c.project_id))];
    return ids.map((id) => ({ value: id, label: projectName(id) }));
  }, [isSsa, projects, clients]);

  const toggle = async (c: Client) => {
    await api(`/api/admin/clients/${c.id}/${c.disabled ? "enable" : "disable"}`, { method: "POST" });
    load();
  };
  const rotate = async (c: Client) => {
    const r = await api<{ secret: string; graceHours: number }>(`/api/admin/clients/${c.id}/rotate-secret`, { method: "POST" });
    setSecret({ title: `Secret mới · ${c.client_id}`, secret: r.secret, note: `Secret cũ còn hiệu lực thêm ${r.graceHours} giờ (ân hạn).` });
  };

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", width: "100%" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
        <div>
          <Title level={3} style={{ marginBottom: 2 }}>Ứng dụng SSO</Title>
          <Text type="secondary">Các ứng dụng (client) kết nối đăng nhập chung — khóa bí mật, nhóm được vào, webhook.</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>Tạo ứng dụng</Button>
      </div>

      <Table<Client>
        rowKey="id"
        loading={loading}
        dataSource={clients}
        pagination={false}
        scroll={{ x: 640 }}
        columns={[
          {
            title: "Ứng dụng",
            render: (_, c) => (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Avatar shape="square" style={{ background: "#e8f0ed", color: BRAND.green, borderRadius: 10, flex: "0 0 auto" }} icon={<ApiOutlined />} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: BRAND.ink }}>{c.name}</div>
                  <Text code style={{ fontSize: 12 }}>{c.client_id}</Text>
                </div>
              </div>
            ),
          },
          { title: "Dự án", render: (_, c) => <Tag>{projectName(c.project_id)}</Tag>, responsive: ["md"] },
          {
            title: "Trạng thái",
            width: 150,
            render: (_, c) => (
              <Space size={4} wrap>
                <Tag color={c.env === "prod" ? "green" : "default"} style={{ textTransform: "uppercase" }}>{c.env}</Tag>
                {c.disabled && <Tag color="red">Đã tắt</Tag>}
                {c.allow_all_groups && <Tag color="gold">Mọi nhóm</Tag>}
              </Space>
            ),
          },
          {
            title: "",
            width: 48,
            render: (_, c) => (
              <Dropdown
                trigger={["click"]}
                menu={{
                  items: [
                    { key: "groups", label: "Nhóm được vào", onClick: () => setGroupsFor(c) },
                    { key: "webhook", label: "Webhook", onClick: () => setWebhookFor(c) },
                    { key: "rotate", label: "Xoay secret", onClick: () => rotate(c) },
                    { type: "divider" },
                    { key: "toggle", label: c.disabled ? "Bật ứng dụng" : "Tắt ứng dụng", danger: !c.disabled, onClick: () => toggle(c) },
                    { key: "edit", label: "Sửa", onClick: () => setEditing(c) },
                  ],
                }}
              >
                <Button type="text" icon={<MoreOutlined />} />
              </Dropdown>
            ),
          },
        ]}
      />

      <ClientForm
        open={createOpen || !!editing}
        client={editing}
        projectOptions={projectOptions}
        onClose={() => { setCreateOpen(false); setEditing(null); }}
        onCreated={(s) => { setCreateOpen(false); setSecret({ title: `Secret · ${s.clientId}`, secret: s.secret, note: "Secret chỉ hiện một lần — lưu ngay." }); load(); }}
        onSaved={() => { setEditing(null); load(); }}
      />
      <ClientGroups client={groupsFor} onClose={() => setGroupsFor(null)} onChanged={load} />
      <WebhookModal client={webhookFor} onClose={() => setWebhookFor(null)} onSecret={setSecret} />
      <SecretModal data={secret} onClose={() => setSecret(null)} />
    </div>
  );
}

function ClientForm({ open, client, projectOptions, onClose, onCreated, onSaved }: {
  open: boolean; client: Client | null; projectOptions: { value: string; label: string }[];
  onClose: () => void; onCreated: (s: { clientId: string; secret: string }) => void; onSaved: () => void;
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
          body: { projectId: v.projectId, clientId: v.clientId, name: v.name, env: v.env, redirectUris, appUrl: v.appUrl || undefined },
        });
        onCreated({ clientId: v.clientId, secret: r.secret });
      }
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const noProject = !edit && projectOptions.length === 0;

  return (
    <Modal open={open} title={edit ? "Sửa ứng dụng" : "Tạo ứng dụng"} onCancel={onClose} onOk={submit} okText={edit ? "Lưu" : "Tạo"} okButtonProps={{ disabled: noProject }} confirmLoading={saving} destroyOnHidden width={520}>
      {noProject && <Alert type="info" showIcon style={{ marginBottom: 12 }} message="Chưa có dự án" description="Nhờ SSA tạo dự án và ứng dụng đầu tiên; sau đó bạn quản lý được trong phạm vi của mình." />}
      <Form form={form} layout="vertical" requiredMark={false} style={{ marginTop: 12 }} initialValues={{ env: "dev" }}>
        {!edit && (
          <>
            <Form.Item name="projectId" label="Dự án" rules={[{ required: true, message: "Chọn dự án" }]}>
              <Select placeholder="Chọn dự án" options={projectOptions} disabled={noProject} />
            </Form.Item>
            <Space style={{ display: "flex" }} align="start">
              <Form.Item name="clientId" label="Client ID" rules={[{ required: true, message: "Nhập client_id" }]} style={{ flex: 1 }}>
                <Input placeholder="ban-hang-web" />
              </Form.Item>
              <Form.Item name="env" label="Môi trường" rules={[{ required: true }]}>
                <Select style={{ width: 120 }} options={[{ value: "dev", label: "dev" }, { value: "prod", label: "prod" }]} />
              </Form.Item>
            </Space>
          </>
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

  const reloadAssigned = () => client && api<{ group_id: string; name: string }[]>(`/api/admin/clients/${client.id}/groups`).then(setAssigned);
  useEffect(() => {
    if (!client) return;
    setAllowAll(client.allow_all_groups);
    reloadAssigned();
    if (!all.length) api<{ id: string; name: string }[]>("/api/admin/groups").then(setAll).catch(() => {});
  }, [client]);

  const toggleAll = async (v: boolean) => {
    try { await api(`/api/admin/clients/${client!.id}/allow-all`, { method: "POST", body: { allowAll: v } }); setAllowAll(v); message.success(v ? "Cho mọi nhóm login" : "Chỉ nhóm được gán"); onChanged(); }
    catch (e) { message.error((e as Error).message); }
  };
  const add = async () => { try { await api(`/api/admin/clients/${client!.id}/groups`, { method: "POST", body: { groupId: pick } }); setPick(undefined); reloadAssigned(); } catch (e) { message.error((e as Error).message); } };
  const remove = async (gid: string) => { try { await api(`/api/admin/clients/${client!.id}/groups/${gid}`, { method: "DELETE" }); setAssigned((a) => a.filter((x) => x.group_id !== gid)); } catch (e) { message.error((e as Error).message); } };
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
              {assigned.map((g) => <Tag key={g.group_id} closable onClose={() => remove(g.group_id)} style={{ padding: "4px 10px" }}>{g.name}</Tag>)}
            </Space>
          )}
        </>
      )}
    </Modal>
  );
}

function WebhookModal({ client, onClose, onSecret }: { client: Client | null; onClose: () => void; onSecret: (s: Secret) => void }) {
  const { message } = AntApp.useApp();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setUrl(""); }, [client]);

  const save = async () => {
    setBusy(true);
    try {
      const r = await api<{ secret: string }>(`/api/admin/clients/${client!.id}/webhook`, { method: "PUT", body: { webhookUrl: url } });
      onSecret({ title: `Webhook secret · ${client!.client_id}`, secret: r.secret, note: "Dùng để verify chữ ký HMAC. Chỉ hiện một lần." });
      onClose();
    } catch (e) { message.error((e as Error).message); } finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true);
    try { await api(`/api/admin/clients/${client!.id}/webhook`, { method: "DELETE" }); message.success("Đã gỡ webhook"); onClose(); }
    catch (e) { message.error((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <Modal
      open={!!client}
      title={client ? `Webhook · ${client.name}` : ""}
      onCancel={onClose}
      footer={[
        <Button key="rm" danger loading={busy} onClick={remove}>Gỡ webhook</Button>,
        <Button key="c" onClick={onClose}>Đóng</Button>,
        <Button key="s" type="primary" loading={busy} disabled={!url} onClick={save}>Lưu webhook</Button>,
      ]}
    >
      <Text type="secondary" style={{ display: "block", marginBottom: 10 }}>
        Nhận sự kiện user (khóa/xóa/đổi nhóm). URL phải là <b>https://</b> và trong allowlist egress. Đặt lại sẽ ghi đè URL cũ.
      </Text>
      <Input placeholder="https://app.pmh.com.vn/webhooks/pmh-id" value={url} onChange={(e) => setUrl(e.target.value)} />
    </Modal>
  );
}

function SecretModal({ data, onClose }: { data: Secret | null; onClose: () => void }) {
  const { message } = AntApp.useApp();
  return (
    <Modal open={!!data} title={data?.title} onCancel={onClose} footer={<Button type="primary" onClick={onClose}>Đã lưu, đóng</Button>} maskClosable={false}>
      <Alert type="warning" showIcon style={{ marginBottom: 12 }} message="Chỉ hiển thị một lần" description={data?.note} />
      <Space.Compact style={{ display: "flex" }}>
        <Input readOnly value={data?.secret} style={{ fontFamily: "ui-monospace, monospace" }} />
        <Button icon={<CopyOutlined />} onClick={() => { navigator.clipboard?.writeText(data?.secret ?? ""); message.success("Đã copy"); }}>Copy</Button>
      </Space.Compact>
    </Modal>
  );
}
