import {
  ApiOutlined,
  AppstoreOutlined,
  CopyOutlined,
  DeleteOutlined,
  MoreOutlined,
  PlusOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import {
  Alert,
  App as AntApp,
  Avatar,
  Button,
  Card,
  Collapse,
  Drawer,
  Dropdown,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Select,
  Space,
  Switch,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import { useEffect, useMemo, useState } from "react";
import { api } from "../auth";
import { BRAND, initials } from "../ui";

const { Title, Text } = Typography;

interface Project { id: string; name: string; description: string | null }
interface Client {
  id: string; project_id: string; client_id: string; name: string; env: string;
  redirect_uris: string[]; app_url: string | null; allow_all_groups: boolean; disabled: boolean;
  backchannel_logout_uri: string | null; created_at: string;
}
type Secret = { title: string; secret: string; note?: string };

interface OverviewApp {
  id: string; client_id: string; name: string; env: string;
  disabled: boolean; allow_all_groups: boolean; app_url: string | null;
  groups: { id: string; name: string }[];
}
interface OverviewProject {
  id: string; name: string; description: string | null;
  admins: { user_id: string; full_name: string }[];
  apps: OverviewApp[];
}

/**
 * "Dự án & Ứng dụng" (gộp Dự án + Ứng dụng SSO). Điều hướng 2 tầng trong một
 * trang: danh sách dự án → chi tiết dự án (ứng dụng SSO + quản trị viên). SSA
 * thấy mọi dự án + quản được QTV; project_admin chỉ thấy dự án mình (/mine) và
 * quản ứng dụng trong phạm vi đó.
 */
export default function AdminWorkspace({ isSsa }: { isSsa: boolean }) {
  const { modal, message } = AntApp.useApp();
  const [overview, setOverview] = useState<OverviewProject[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal dự án
  const [projForm, setProjForm] = useState<Project | "new" | null>(null);
  const [adminsOf, setAdminsOf] = useState<Project | null>(null);
  // Modal ứng dụng
  const [createAppFor, setCreateAppFor] = useState<string | null>(null); // project_id
  const [editing, setEditing] = useState<Client | null>(null);
  const [groupsFor, setGroupsFor] = useState<Client | null>(null);
  const [webhookFor, setWebhookFor] = useState<Client | null>(null);
  const [secret, setSecret] = useState<Secret | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      api<OverviewProject[]>("/api/admin/projects/overview"),
      api<Client[]>("/api/admin/clients"),
    ])
      .then(([o, c]) => { setOverview(o); setClients(c); })
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  // Client đầy đủ (redirect_uris, bcl…) cho các thao tác cần — tra theo id.
  const clientsById = useMemo(() => {
    const m: Record<string, Client> = {};
    for (const c of clients) m[c.id] = c;
    return m;
  }, [clients]);

  const toggle = async (c: Client) => {
    await api(`/api/admin/clients/${c.id}/${c.disabled ? "enable" : "disable"}`, { method: "POST" });
    load();
  };
  const rotate = async (c: Client) => {
    const r = await api<{ secret: string; graceHours: number }>(`/api/admin/clients/${c.id}/rotate-secret`, { method: "POST" });
    setSecret({ title: `Secret mới · ${c.client_id}`, secret: r.secret, note: `Secret cũ còn hiệu lực thêm ${r.graceHours} giờ (ân hạn).` });
  };
  const delApp = (c: Client) => modal.confirm({
    title: `Xóa ứng dụng "${c.name}"?`,
    content: "Xóa vĩnh viễn client, secret, cấu hình nhóm & webhook. Ứng dụng sẽ không đăng nhập được nữa. Không hoàn tác.",
    okText: "Xóa", okType: "danger", cancelText: "Hủy",
    onOk: async () => {
      try { await api(`/api/admin/clients/${c.id}`, { method: "DELETE" }); message.success("Đã xóa ứng dụng"); load(); }
      catch (e) { message.error((e as Error).message); }
    },
  });
  const delProject = (pr: OverviewProject) => modal.confirm({
    title: `Xóa dự án "${pr.name}"?`,
    content: "Chỉ xóa được khi dự án KHÔNG còn ứng dụng nào. Thao tác gỡ luôn quyền quản trị của dự án. Không hoàn tác.",
    okText: "Xóa", okType: "danger", cancelText: "Hủy",
    onOk: async () => {
      try { await api(`/api/admin/projects/${pr.id}`, { method: "DELETE" }); message.success("Đã xóa dự án"); load(); }
      catch (e) { message.error((e as Error).message); }
    },
  });

  const appMenu = (c: Client) => (
    <Dropdown
      trigger={["click"]}
      menu={{
        items: [
          { key: "groups", label: "Nhóm được vào", onClick: () => setGroupsFor(c) },
          { key: "webhook", label: "Webhook", onClick: () => setWebhookFor(c) },
          { key: "rotate", label: "Xoay secret", onClick: () => rotate(c) },
          { key: "edit", label: "Sửa", onClick: () => setEditing(c) },
          { type: "divider" },
          { key: "toggle", label: c.disabled ? "Bật ứng dụng" : "Tắt ứng dụng", onClick: () => toggle(c) },
          { key: "delete", label: "Xóa ứng dụng", danger: true, onClick: () => delApp(c) },
        ],
      }}
    >
      <Button type="text" size="small" icon={<MoreOutlined />} onClick={(e) => e.stopPropagation()} />
    </Dropdown>
  );

  const items = overview.map((p) => {
    const groupNames = [...new Set(p.apps.flatMap((a) => a.groups.map((g) => g.name)))];
    const admins = p.admins.map((a) => a.full_name);
    return {
      key: p.id,
      label: (
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <Avatar shape="square" size={36} style={{ background: "#e8f0ed", color: BRAND.green, borderRadius: 9, flex: "0 0 auto" }} icon={<AppstoreOutlined />} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, color: BRAND.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
            <Text type="secondary" style={{ fontSize: 12.5 }}>
              {p.apps.length} ứng dụng · {groupNames.length} nhóm ·{" "}
              {admins.length
                ? <>QTDA: <span style={{ color: BRAND.ink }}>{admins.join(", ")}</span></>
                : <span style={{ color: "#c0392b" }}>Chưa có QTDA</span>}
            </Text>
          </div>
        </div>
      ),
      extra: isSsa ? (
        <Dropdown
          trigger={["click"]}
          menu={{
            items: [
              { key: "admins", icon: <TeamOutlined />, label: "Quản trị viên", onClick: () => setAdminsOf(p) },
              { key: "edit", label: "Sửa dự án", onClick: () => setProjForm(p) },
              { key: "del", label: "Xóa dự án", danger: true, onClick: () => delProject(p) },
            ],
          }}
        >
          <Button type="text" size="small" icon={<MoreOutlined />} onClick={(e) => e.stopPropagation()} />
        </Dropdown>
      ) : undefined,
      children: (
        // Nhánh con: rail dọc bên trái + thụt lề để app đọc như "lá" của dự án.
        <div style={{ marginLeft: 13, borderLeft: "2px solid #eef0f2", paddingLeft: 16 }}>
          {p.apps.length === 0 ? (
            <Text type="secondary" style={{ fontSize: 13 }}>Dự án chưa có ứng dụng nào.</Text>
          ) : (
            p.apps.map((a) => (
              <div
                key={a.id}
                style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid #f4f6f5" }}
              >
                <ApiOutlined style={{ color: BRAND.green, fontSize: 14, flex: "0 0 auto" }} />
                <span style={{ fontWeight: 600, color: BRAND.ink, fontSize: 13.5 }}>{a.name}</span>
                <Text code style={{ fontSize: 11.5 }}>{a.client_id}</Text>
                <Tag color={a.env === "prod" ? "green" : "default"} style={{ textTransform: "uppercase", fontSize: 10.5, lineHeight: "16px", marginInlineStart: 2 }}>{a.env}</Tag>
                {a.disabled && <Tag color="red" style={{ fontSize: 10.5, lineHeight: "16px" }}>Đã tắt</Tag>}
                {!a.app_url && (
                  <Tooltip title="Chưa đặt App URL → app KHÔNG hiện ở màn Ứng dụng (Launcher). Đăng nhập OIDC vẫn chạy bình thường.">
                    <Tag style={{ fontSize: 10.5, lineHeight: "16px" }}>Ẩn ở Launcher</Tag>
                  </Tooltip>
                )}
                <span style={{ flex: 1, minWidth: 8 }} />
                <TeamOutlined style={{ color: BRAND.muted, fontSize: 12 }} />
                {a.allow_all_groups ? (
                  <Tag color="gold" style={{ marginInlineEnd: 0 }}>Mọi nhóm</Tag>
                ) : a.groups.length ? (
                  a.groups.map((g) => <Tag key={g.id} style={{ marginInlineEnd: 0 }}>{g.name}</Tag>)
                ) : (
                  <Tag color="error" style={{ marginInlineEnd: 0 }}>Chưa gán nhóm</Tag>
                )}
                {clientsById[a.id] && appMenu(clientsById[a.id])}
              </div>
            ))
          )}
          <Button type="link" size="small" icon={<PlusOutlined />} onClick={() => setCreateAppFor(p.id)} style={{ paddingInline: 0, marginTop: 8 }}>
            Tạo ứng dụng
          </Button>
        </div>
      ),
    };
  });

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", width: "100%" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
        <div>
          <Title level={3} style={{ marginBottom: 2 }}>Dự án & Ứng dụng</Title>
          <Text type="secondary">Mỗi dự án gom ứng dụng SSO và quản trị viên riêng. Bấm để xổ chi tiết.</Text>
        </div>
        {isSsa && <Button type="primary" icon={<PlusOutlined />} onClick={() => setProjForm("new")}>Tạo dự án</Button>}
      </div>

      {loading ? (
        <Card loading style={{ minHeight: 120 }} />
      ) : overview.length === 0 ? (
        <Empty description={isSsa ? "Chưa có dự án nào — tạo dự án đầu tiên để bắt đầu." : "Bạn chưa được gán quản trị dự án nào. Liên hệ SSA."} />
      ) : (
        <Collapse items={items} defaultActiveKey={overview.length === 1 ? [overview[0].id] : []} />
      )}

      <ClientForm
        open={!!createAppFor || !!editing}
        client={editing}
        fixedProjectId={createAppFor ?? editing?.project_id ?? ""}
        onClose={() => { setCreateAppFor(null); setEditing(null); }}
        onCreated={(s) => { setCreateAppFor(null); setSecret({ title: `Secret · ${s.clientId}`, secret: s.secret, note: "Secret chỉ hiện một lần — lưu ngay." }); load(); }}
        onSaved={() => { setEditing(null); load(); }}
      />
      <ClientGroups client={groupsFor} onClose={() => setGroupsFor(null)} onChanged={load} />
      <WebhookModal client={webhookFor} onClose={() => setWebhookFor(null)} onSecret={setSecret} />
      <SecretModal data={secret} onClose={() => setSecret(null)} />
      <ProjectForm value={projForm} onClose={() => setProjForm(null)} onSaved={load} />
      <AdminsDrawer project={adminsOf} onClose={() => setAdminsOf(null)} />
    </div>
  );
}

function ProjectForm({ value, onClose, onSaved }: { value: Project | "new" | null; onClose: () => void; onSaved: () => void }) {
  const { message } = AntApp.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const edit = value && value !== "new" ? value : null;
  const open = value !== null;

  useEffect(() => {
    if (!open) return;
    if (edit) form.setFieldsValue({ name: edit.name, description: edit.description ?? "" });
    else form.resetFields();
  }, [value]);

  const submit = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      if (edit) await api(`/api/admin/projects/${edit.id}`, { method: "PATCH", body: v });
      else await api("/api/admin/projects", { method: "POST", body: v });
      message.success(edit ? "Đã cập nhật dự án" : "Đã tạo dự án");
      onClose();
      onSaved();
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} title={edit ? "Sửa dự án" : "Tạo dự án"} onCancel={onClose} onOk={submit} okText={edit ? "Lưu" : "Tạo"} confirmLoading={saving} destroyOnHidden>
      <Form form={form} layout="vertical" requiredMark={false} style={{ marginTop: 12 }}>
        <Form.Item name="name" label="Tên dự án" rules={[{ required: true, message: "Nhập tên dự án" }]}>
          <Input placeholder="Hệ thống bán hàng" />
        </Form.Item>
        <Form.Item name="description" label="Mô tả"><Input placeholder="Tùy chọn" /></Form.Item>
      </Form>
    </Modal>
  );
}

function ClientForm({ open, client, fixedProjectId, onClose, onCreated, onSaved }: {
  open: boolean; client: Client | null; fixedProjectId: string;
  onClose: () => void; onCreated: (s: { clientId: string; secret: string }) => void; onSaved: () => void;
}) {
  const { message } = AntApp.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const edit = !!client;

  useEffect(() => {
    if (!open) return;
    if (client) form.setFieldsValue({ name: client.name, redirectUris: client.redirect_uris.join("\n"), appUrl: client.app_url ?? "", backchannelLogoutUri: client.backchannel_logout_uri ?? "" });
    else form.resetFields();
  }, [open, client]);

  const submit = async () => {
    const v = await form.validateFields();
    const redirectUris = (v.redirectUris ?? "").split(/[\n,]/).map((s: string) => s.trim()).filter(Boolean);
    setSaving(true);
    try {
      if (edit) {
        await api(`/api/admin/clients/${client!.id}`, { method: "PATCH", body: { name: v.name, redirectUris, appUrl: v.appUrl || undefined, backchannelLogoutUri: v.backchannelLogoutUri ?? "" } });
        message.success("Đã cập nhật ứng dụng");
        onSaved();
      } else {
        const r = await api<{ secret: string }>("/api/admin/clients", {
          method: "POST",
          body: { projectId: fixedProjectId, clientId: v.clientId, name: v.name, env: v.env, redirectUris, appUrl: v.appUrl || undefined },
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
        {edit && (
          <Form.Item name="backchannelLogoutUri" label="Back-Channel Logout URI (tùy chọn)" extra="Đăng xuất tức thì: khi phiên SSO kết thúc, PMH ID POST logout_token tới URL này để app đá user ra ngay. Để trống = tắt (app vẫn văng trong ≤5 phút).">
            <Input placeholder="https://banhang.pmh.com.vn/backchannel-logout" />
          </Form.Item>
        )}
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

function AdminsDrawer({ project, onClose }: { project: Project | null; onClose: () => void }) {
  const { message } = AntApp.useApp();
  const [people, setPeople] = useState<{ user_id: string; email: string; full_name: string }[]>([]);
  const [users, setUsers] = useState<{ id: string; email: string; full_name: string; deleted_at: string | null }[]>([]);
  const [pick, setPick] = useState<string | undefined>();

  const load = () => { if (project) api<{ user_id: string; email: string; full_name: string }[]>(`/api/admin/projects/${project.id}/admins`).then(setPeople); };
  useEffect(load, [project]);
  useEffect(() => { if (project && !users.length) api<typeof users>("/api/admin/users").then(setUsers).catch(() => {}); }, [project]);

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
