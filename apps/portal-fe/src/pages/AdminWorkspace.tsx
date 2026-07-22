import {
  ApiOutlined,
  AppstoreOutlined,
  ArrowLeftOutlined,
  CopyOutlined,
  PlusOutlined,
  RightOutlined,
  TeamOutlined,
} from "@ant-design/icons";
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
  Skeleton,
  Space,
  Switch,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { api } from "../auth";
import { BRAND, ListEmpty, PageHeader, initials } from "../ui";

const { Text } = Typography;

interface Project { id: string; name: string; description: string | null }
interface Client {
  id: string; project_id: string; client_id: string; name: string; env: string;
  redirect_uris: string[]; app_url: string | null; allow_all_groups: boolean; disabled: boolean;
  m2m_enabled: boolean; backchannel_logout_uri: string | null; created_at: string;
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
 * "Dự án & Ứng dụng" — điều hướng DRILL-IN theo cấp sở hữu (không còn dồn mọi thứ
 * vào một menu "…"): lưới dự án → chi tiết dự án (tab Ứng dụng | Quản trị viên) →
 * Drawer cấu hình app có tab (Tổng quan · Truy cập · Tích hợp · Bảo mật · Nguy hiểm).
 * SSA thấy mọi dự án; project_admin chỉ thấy dự án mình.
 */
export default function AdminWorkspace({ isSsa }: { isSsa: boolean }) {
  const { modal, message } = AntApp.useApp();
  const [overview, setOverview] = useState<OverviewProject[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sel, setSel] = useState<string | null>(null); // dự án đang mở
  const [projForm, setProjForm] = useState<Project | "new" | null>(null);
  const [createAppFor, setCreateAppFor] = useState<string | null>(null);
  const [editing, setEditing] = useState<Client | null>(null);
  const [appDrawerId, setAppDrawerId] = useState<string | null>(null);
  const [secret, setSecret] = useState<Secret | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      api<OverviewProject[]>("/api/admin/projects/overview"),
      api<Client[]>("/api/admin/clients"),
    ])
      .then(([o, c]) => { setOverview(o); setClients(c); setError(null); })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const clientsById = useMemo(() => {
    const m: Record<string, Client> = {};
    for (const c of clients) m[c.id] = c;
    return m;
  }, [clients]);

  const selProject = overview.find((p) => p.id === sel) ?? null;
  // Dự án đang mở bị xóa (reload thấy mất) → về danh sách để không kẹt trang trống.
  useEffect(() => {
    if (sel && !loading && !overview.some((p) => p.id === sel)) setSel(null);
  }, [overview, loading, sel]);

  const drawerClient = appDrawerId ? clientsById[appDrawerId] ?? null : null;

  const toggle = async (c: Client) => {
    try {
      await api(`/api/admin/clients/${c.id}/${c.disabled ? "enable" : "disable"}`, { method: "POST" });
      message.success(c.disabled ? "Đã bật ứng dụng" : "Đã tắt ứng dụng");
      load();
    } catch (e) {
      message.error((e as Error).message);
    }
  };
  const toggleM2m = (c: Client) => modal.confirm({
    title: c.m2m_enabled ? `Tắt API danh bạ (M2M) cho "${c.name}"?` : `Bật API danh bạ (M2M) cho "${c.name}"?`,
    content: c.m2m_enabled
      ? "Ứng dụng sẽ KHÔNG lấy được token M2M mới; token đang sống cũng bị chặn ngay. Chỉ tắt nếu app không dùng Directory API."
      : "Cho phép ứng dụng dùng client_credentials để kéo danh bạ user (trong phạm vi nhóm được gán). Chỉ bật khi app thực sự cần.",
    okText: c.m2m_enabled ? "Tắt M2M" : "Bật M2M", okType: c.m2m_enabled ? "danger" : "primary", cancelText: "Hủy",
    onOk: async () => {
      try { await api(`/api/admin/clients/${c.id}/m2m`, { method: "POST", body: { enabled: !c.m2m_enabled } }); message.success(c.m2m_enabled ? "Đã tắt M2M" : "Đã bật M2M"); load(); }
      catch (e) { message.error((e as Error).message); }
    },
  });
  const rotate = async (c: Client) => {
    const r = await api<{ secret: string; graceHours: number }>(`/api/admin/clients/${c.id}/rotate-secret`, { method: "POST" });
    setSecret({ title: `Secret mới · ${c.client_id}`, secret: r.secret, note: `Secret cũ còn hiệu lực thêm ${r.graceHours} giờ (ân hạn).` });
  };
  const delApp = (c: Client) => modal.confirm({
    title: `Xóa ứng dụng "${c.name}"?`,
    content: "Xóa vĩnh viễn client, secret, cấu hình nhóm & webhook. Ứng dụng sẽ không đăng nhập được nữa. Không hoàn tác.",
    okText: "Xóa", okType: "danger", cancelText: "Hủy",
    onOk: async () => {
      try { await api(`/api/admin/clients/${c.id}`, { method: "DELETE" }); message.success("Đã xóa ứng dụng"); setAppDrawerId(null); load(); }
      catch (e) { message.error((e as Error).message); }
    },
  });
  const delProject = (pr: OverviewProject) => modal.confirm({
    title: `Xóa dự án "${pr.name}"?`,
    content: "Chỉ xóa được khi dự án KHÔNG còn ứng dụng nào. Thao tác gỡ luôn quyền quản trị của dự án. Không hoàn tác.",
    okText: "Xóa", okType: "danger", cancelText: "Hủy",
    onOk: async () => {
      try { await api(`/api/admin/projects/${pr.id}`, { method: "DELETE" }); message.success("Đã xóa dự án"); setSel(null); load(); }
      catch (e) { message.error((e as Error).message); }
    },
  });

  return (
    <div>
      {selProject ? (
        <ProjectDetail
          project={selProject}
          clientsById={clientsById}
          isSsa={isSsa}
          onBack={() => setSel(null)}
          onEditProject={() => setProjForm(selProject)}
          onDeleteProject={() => delProject(selProject)}
          onCreateApp={() => setCreateAppFor(selProject.id)}
          onOpenApp={(c) => setAppDrawerId(c.id)}
        />
      ) : (
        <>
          <PageHeader
            title="Dự án & Ứng dụng"
            sub="Mỗi dự án gom ứng dụng SSO và quản trị viên riêng. Bấm một dự án để xem chi tiết."
            actions={isSsa ? <Button type="primary" icon={<PlusOutlined />} onClick={() => setProjForm("new")}>Tạo dự án</Button> : undefined}
          />
          {loading ? (
            <div className="pmh-ws__grid">
              {[0, 1, 2].map((i) => (
                <div key={i} className="pmh-admin__card pmh-admin__card--pad"><Skeleton active paragraph={{ rows: 2 }} /></div>
              ))}
            </div>
          ) : error ? (
            <div className="pmh-admin__card pmh-admin__card--pad">
              <ListEmpty error={error} onRetry={load} description="" />
            </div>
          ) : overview.length === 0 ? (
            <div className="pmh-admin__card pmh-admin__card--pad">
              <Empty description={isSsa ? "Chưa có dự án nào — tạo dự án đầu tiên để bắt đầu." : "Bạn chưa được gán quản trị dự án nào. Liên hệ SSA."}>
                {isSsa && <Button type="primary" icon={<PlusOutlined />} onClick={() => setProjForm("new")}>Tạo dự án</Button>}
              </Empty>
            </div>
          ) : (
            <div className="pmh-ws__grid">
              {overview.map((p) => <ProjectCard key={p.id} project={p} onOpen={() => setSel(p.id)} />)}
            </div>
          )}
        </>
      )}

      <ProjectForm value={projForm} onClose={() => setProjForm(null)} onSaved={load} />
      <ClientForm
        open={!!createAppFor || !!editing}
        client={editing}
        fixedProjectId={createAppFor ?? editing?.project_id ?? ""}
        onClose={() => { setCreateAppFor(null); setEditing(null); }}
        onCreated={(s) => { setCreateAppFor(null); setSecret({ title: `Secret · ${s.clientId}`, secret: s.secret, note: "Secret chỉ hiện một lần — lưu ngay." }); load(); }}
        onSaved={() => { setEditing(null); load(); }}
      />
      <AppDrawer
        client={drawerClient}
        isSsa={isSsa}
        onClose={() => setAppDrawerId(null)}
        onEdit={() => drawerClient && setEditing(drawerClient)}
        onRotate={rotate}
        onToggleM2m={toggleM2m}
        onToggle={toggle}
        onDelete={delApp}
        onSecret={setSecret}
        reload={load}
      />
      <SecretModal data={secret} onClose={() => setSecret(null)} />
    </div>
  );
}

/** Thẻ dự án trong lưới. */
function ProjectCard({ project: p, onOpen }: { project: OverviewProject; onOpen: () => void }) {
  const groupNames = [...new Set(p.apps.flatMap((a) => a.groups.map((g) => g.name)))];
  return (
    <button className="pmh-ws__card" onClick={onOpen}>
      <div className="pmh-ws__card-top">
        <Avatar shape="square" size={40} style={{ background: "var(--a-chip)", color: BRAND.green, borderRadius: 10, flex: "0 0 auto" }} icon={<AppstoreOutlined />} />
        <div style={{ minWidth: 0 }}>
          <div className="pmh-ws__card-name">{p.name}</div>
          {p.description && <div className="pmh-ws__card-desc">{p.description}</div>}
        </div>
      </div>
      <div className="pmh-ws__card-meta">
        {p.apps.length} ứng dụng · {groupNames.length} nhóm ·{" "}
        {p.admins.length
          ? <>QTDA: {p.admins.map((a) => a.full_name).join(", ")}</>
          : <span className="pmh-ws__warn">Chưa có QTDA</span>}
      </div>
      <div className="pmh-ws__card-open">Mở dự án <RightOutlined style={{ fontSize: 11 }} /></div>
    </button>
  );
}

/** Chi tiết dự án: breadcrumb + tab Ứng dụng | Quản trị viên. */
function ProjectDetail({
  project, clientsById, isSsa, onBack, onEditProject, onDeleteProject, onCreateApp, onOpenApp,
}: {
  project: OverviewProject;
  clientsById: Record<string, Client>;
  isSsa: boolean;
  onBack: () => void;
  onEditProject: () => void;
  onDeleteProject: () => void;
  onCreateApp: () => void;
  onOpenApp: (c: Client) => void;
}) {
  return (
    <div>
      <button className="pmh-ws__back" onClick={onBack}><ArrowLeftOutlined /> Tất cả dự án</button>
      <div className="pmh-ws__detail-head">
        <div>
          <h1 className="pmh-ws__detail-title">{project.name}</h1>
          <p className="pmh-ws__detail-sub">{project.description || "Không có mô tả"}</p>
        </div>
        {isSsa && (
          <Space>
            <Button onClick={onEditProject}>Sửa dự án</Button>
            <Button danger onClick={onDeleteProject}>Xóa dự án</Button>
          </Space>
        )}
      </div>

      <Tabs
        items={[
          {
            key: "apps",
            label: `Ứng dụng (${project.apps.length})`,
            children: (
              <div className="pmh-admin__card pmh-admin__card--pad">
                {project.apps.length === 0 ? (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Dự án chưa có ứng dụng nào.">
                    <Button type="primary" icon={<PlusOutlined />} onClick={onCreateApp}>Tạo ứng dụng</Button>
                  </Empty>
                ) : (
                  <>
                    {project.apps.map((a) => (
                      <div key={a.id} className="pmh-ws__app-row" onClick={() => clientsById[a.id] && onOpenApp(clientsById[a.id])}>
                        <span className={`pmh-ws__dot ${a.disabled ? "pmh-ws__dot--off" : "pmh-ws__dot--on"}`} />
                        <ApiOutlined style={{ color: BRAND.green, fontSize: 15, flex: "0 0 auto" }} />
                        <span style={{ fontWeight: 600, color: BRAND.ink }}>{a.name}</span>
                        <Text code style={{ fontSize: 11.5 }}>{a.client_id}</Text>
                        <Tag color={a.env === "prod" ? "green" : "default"} style={{ textTransform: "uppercase", fontSize: 10.5, lineHeight: "16px" }}>{a.env}</Tag>
                        {a.disabled && <Tag color="red" style={{ fontSize: 10.5, lineHeight: "16px" }}>Đã tắt</Tag>}
                        {clientsById[a.id]?.m2m_enabled && <Tag color="blue" style={{ fontSize: 10.5, lineHeight: "16px" }}>M2M</Tag>}
                        <span style={{ flex: 1, minWidth: 8 }} />
                        <TeamOutlined style={{ color: BRAND.muted, fontSize: 12 }} />
                        {a.allow_all_groups ? (
                          <Tag color="gold" style={{ marginInlineEnd: 0 }}>Mọi nhóm</Tag>
                        ) : a.groups.length ? (
                          <Text type="secondary" style={{ fontSize: 12.5 }}>{a.groups.map((g) => g.name).join(", ")}</Text>
                        ) : (
                          <Tag color="error" style={{ marginInlineEnd: 0 }}>Chưa gán nhóm</Tag>
                        )}
                        <RightOutlined style={{ color: "var(--a-faint)", fontSize: 12, marginLeft: 4 }} />
                      </div>
                    ))}
                    <Button type="dashed" icon={<PlusOutlined />} onClick={onCreateApp} style={{ marginTop: 8 }} block>Tạo ứng dụng</Button>
                  </>
                )}
              </div>
            ),
          },
          {
            key: "admins",
            label: `Quản trị viên (${project.admins.length})`,
            children: (
              <div className="pmh-admin__card pmh-admin__card--pad">
                <AdminsPanel projectId={project.id} />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}

/** Drawer cấu hình 1 ứng dụng — mọi thứ trước đây nằm trong menu "…" nay chia tab. */
function AppDrawer({
  client, isSsa, onClose, onEdit, onRotate, onToggleM2m, onToggle, onDelete, onSecret, reload,
}: {
  client: Client | null;
  isSsa: boolean;
  onClose: () => void;
  onEdit: () => void;
  onRotate: (c: Client) => void;
  onToggleM2m: (c: Client) => void;
  onToggle: (c: Client) => void;
  onDelete: (c: Client) => void;
  onSecret: (s: Secret) => void;
  reload: () => void;
}) {
  const c = client;
  return (
    <Drawer open={!!c} onClose={onClose} width={520} title={c ? `Ứng dụng · ${c.name}` : ""}>
      {c && (
        <Tabs
          items={[
            {
              key: "overview", label: "Tổng quan",
              children: (
                <div>
                  <div className="pmh-ws__sec">
                    <Field label="Tên hiển thị" value={c.name} />
                    <Field label="Client ID" value={<Text code>{c.client_id}</Text>} />
                    <Field label="Môi trường" value={<Tag color={c.env === "prod" ? "green" : "default"} style={{ textTransform: "uppercase" }}>{c.env}</Tag>} />
                    <Field label="App URL" value={c.app_url || <Text type="secondary">Chưa đặt — ẩn ở Launcher</Text>} />
                    <Field label="Redirect URIs" value={c.redirect_uris.length ? <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12 }}>{c.redirect_uris.join(", ")}</span> : <Text type="secondary">Chưa đặt</Text>} />
                    <Field label="Trạng thái" value={c.disabled ? <Tag color="red">Đã tắt</Tag> : <Tag color="green">Đang bật</Tag>} />
                  </div>
                  <Button onClick={onEdit}>Sửa thông tin</Button>
                </div>
              ),
            },
            { key: "access", label: "Truy cập", children: <ClientGroupsPanel client={c} onChanged={reload} /> },
            { key: "integ", label: "Tích hợp", children: <WebhookPanel client={c} onSecret={onSecret} onEdit={onEdit} /> },
            {
              key: "security", label: "Bảo mật",
              children: (
                <div>
                  <div className="pmh-ws__sec">
                    <h4 className="pmh-ws__sec-h">Client secret</h4>
                    <Text className="pmh-ws__sec-note">Xoay khi nghi lộ. Secret cũ còn ân hạn để app kịp cập nhật.</Text>
                    <Button onClick={() => onRotate(c)}>Xoay secret</Button>
                  </div>
                  {isSsa && (
                    <div className="pmh-ws__sec">
                      <h4 className="pmh-ws__sec-h">API danh bạ (M2M)</h4>
                      <Text className="pmh-ws__sec-note">Cho phép app dùng client_credentials kéo danh bạ (trong phạm vi nhóm). Chỉ bật khi cần.</Text>
                      <Space>
                        <Switch checked={c.m2m_enabled} onChange={() => onToggleM2m(c)} />
                        <span>{c.m2m_enabled ? "Đang bật" : "Đang tắt"}</span>
                      </Space>
                    </div>
                  )}
                </div>
              ),
            },
            {
              key: "danger", label: "Nguy hiểm",
              children: (
                <div>
                  <div className="pmh-ws__danger-row">
                    <div>
                      <div style={{ fontWeight: 600 }}>{c.disabled ? "Bật ứng dụng" : "Tắt ứng dụng"}</div>
                      <Text type="secondary" style={{ fontSize: 13 }}>{c.disabled ? "Cho phép đăng nhập trở lại." : "Chặn đăng nhập tạm thời (không xóa dữ liệu)."}</Text>
                    </div>
                    <Button onClick={() => onToggle(c)}>{c.disabled ? "Bật" : "Tắt"}</Button>
                  </div>
                  <div className="pmh-ws__danger-row">
                    <div>
                      <div style={{ fontWeight: 600, color: "var(--a-danger)" }}>Xóa ứng dụng</div>
                      <Text type="secondary" style={{ fontSize: 13 }}>Xóa vĩnh viễn client, secret, nhóm & webhook. Không hoàn tác.</Text>
                    </div>
                    <Button danger onClick={() => onDelete(c)}>Xóa</Button>
                  </div>
                </div>
              ),
            },
          ]}
        />
      )}
    </Drawer>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 12, padding: "8px 0", borderBottom: "1px solid #f0f2f0" }}>
      <div style={{ flex: "0 0 130px", color: BRAND.muted, fontSize: 13 }}>{label}</div>
      <div style={{ flex: 1, minWidth: 0, color: BRAND.ink }}>{value}</div>
    </div>
  );
}

/** Tab "Truy cập": nhóm được vào (allow-all + gán/gỡ). */
function ClientGroupsPanel({ client, onChanged }: { client: Client; onChanged: () => void }) {
  const { message } = AntApp.useApp();
  const [assigned, setAssigned] = useState<{ group_id: string; name: string }[]>([]);
  const [all, setAll] = useState<{ id: string; name: string }[]>([]);
  const [allowAll, setAllowAll] = useState(false);
  const [pick, setPick] = useState<string | undefined>();

  const reloadAssigned = () => api<{ group_id: string; name: string }[]>(`/api/admin/clients/${client.id}/groups`).then(setAssigned);
  useEffect(() => {
    setAllowAll(client.allow_all_groups);
    reloadAssigned();
    api<{ id: string; name: string }[]>("/api/admin/groups").then(setAll).catch(() => {});
  }, [client.id]);

  const toggleAll = async (v: boolean) => {
    try { await api(`/api/admin/clients/${client.id}/allow-all`, { method: "POST", body: { allowAll: v } }); setAllowAll(v); message.success(v ? "Cho mọi nhóm login" : "Chỉ nhóm được gán"); onChanged(); }
    catch (e) { message.error((e as Error).message); }
  };
  const add = async () => { try { await api(`/api/admin/clients/${client.id}/groups`, { method: "POST", body: { groupId: pick } }); setPick(undefined); reloadAssigned(); onChanged(); } catch (e) { message.error((e as Error).message); } };
  const remove = async (gid: string) => { try { await api(`/api/admin/clients/${client.id}/groups/${gid}`, { method: "DELETE" }); setAssigned((a) => a.filter((x) => x.group_id !== gid)); onChanged(); } catch (e) { message.error((e as Error).message); } };
  const cands = all.filter((g) => !assigned.some((a) => a.group_id === g.id));

  return (
    <div>
      <div className="pmh-ws__danger-row" style={{ borderTop: "none", paddingTop: 0 }}>
        <div>
          <div style={{ fontWeight: 600 }}>Cho mọi nhóm login</div>
          <Text type="secondary" style={{ fontSize: 13 }}>Kể cả nhóm tạo sau. Không nới quyền danh bạ.</Text>
        </div>
        <Switch checked={allowAll} onChange={toggleAll} />
      </div>
      {!allowAll && (
        <div style={{ marginTop: 12 }}>
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
        </div>
      )}
    </div>
  );
}

/** Tab "Tích hợp": webhook + back-channel logout. */
function WebhookPanel({ client, onSecret, onEdit }: { client: Client; onSecret: (s: Secret) => void; onEdit: () => void }) {
  const { message } = AntApp.useApp();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setUrl(""); }, [client.id]);

  const save = async () => {
    setBusy(true);
    try {
      const r = await api<{ secret: string }>(`/api/admin/clients/${client.id}/webhook`, { method: "PUT", body: { webhookUrl: url } });
      onSecret({ title: `Webhook secret · ${client.client_id}`, secret: r.secret, note: "Dùng để verify chữ ký HMAC. Chỉ hiện một lần." });
    } catch (e) { message.error((e as Error).message); } finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true);
    try { await api(`/api/admin/clients/${client.id}/webhook`, { method: "DELETE" }); message.success("Đã gỡ webhook"); }
    catch (e) { message.error((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div>
      <div className="pmh-ws__sec">
        <h4 className="pmh-ws__sec-h">Webhook sự kiện user</h4>
        <Text className="pmh-ws__sec-note">Nhận sự kiện (khóa/xóa/đổi nhóm). URL phải là https:// và trong allowlist egress.</Text>
        <Space.Compact style={{ width: "100%" }}>
          <Input placeholder="https://app.pmh.com.vn/webhooks/pmh-id" value={url} onChange={(e) => setUrl(e.target.value)} />
          <Button type="primary" loading={busy} disabled={!url} onClick={save}>Lưu</Button>
        </Space.Compact>
        <Button danger size="small" type="text" loading={busy} onClick={remove} style={{ marginTop: 8, paddingInline: 0 }}>Gỡ webhook hiện tại</Button>
      </div>
      <div className="pmh-ws__sec">
        <h4 className="pmh-ws__sec-h">Back-Channel Logout</h4>
        <Text className="pmh-ws__sec-note">Đăng xuất tức thì khi phiên SSO kết thúc.</Text>
        <div style={{ marginBottom: 8 }}>
          {client.backchannel_logout_uri
            ? <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12 }}>{client.backchannel_logout_uri}</span>
            : <Text type="secondary">Chưa đặt (app vẫn văng trong ≤5 phút).</Text>}
        </div>
        <Button size="small" onClick={onEdit}>Sửa URL logout</Button>
      </div>
    </div>
  );
}

/** Tab "Quản trị viên" của dự án (bổ nhiệm/gỡ QTDA). */
function AdminsPanel({ projectId }: { projectId: string }) {
  const { message } = AntApp.useApp();
  const [people, setPeople] = useState<{ user_id: string; email: string; full_name: string }[]>([]);
  const [users, setUsers] = useState<{ id: string; email: string; full_name: string; deleted_at: string | null }[]>([]);
  const [pick, setPick] = useState<string | undefined>();

  const load = () => api<{ user_id: string; email: string; full_name: string }[]>(`/api/admin/projects/${projectId}/admins`).then(setPeople);
  useEffect(() => { load(); }, [projectId]);
  useEffect(() => { if (!users.length) api<typeof users>("/api/admin/users").then(setUsers).catch(() => {}); }, [projectId]);

  const add = async () => {
    try { await api(`/api/admin/projects/${projectId}/admins`, { method: "POST", body: { userId: pick } }); message.success("Đã bổ nhiệm"); setPick(undefined); load(); }
    catch (e) { message.error((e as Error).message); }
  };
  const remove = async (uid: string) => {
    try { await api(`/api/admin/projects/${projectId}/admins/${uid}`, { method: "DELETE" }); message.success("Đã gỡ quyền"); load(); }
    catch (e) { message.error((e as Error).message); }
  };
  const has = new Set(people.map((p) => p.user_id));
  const cands = users.filter((u) => !u.deleted_at && !has.has(u.id));

  return (
    <div>
      <Text type="secondary" style={{ display: "block", marginBottom: 12 }}>Quản trị viên dự án quản lý user, nhóm và ứng dụng trong phạm vi dự án này.</Text>
      <Space.Compact style={{ width: "100%", marginBottom: 16 }}>
        <Select showSearch placeholder="Bổ nhiệm nhân viên…" style={{ width: "100%" }} value={pick} onChange={setPick}
          filterOption={(i, o) => (o?.label as string).toLowerCase().includes(i.toLowerCase())}
          options={cands.map((u) => ({ value: u.id, label: `${u.full_name} · ${u.email}` }))} />
        <Button type="primary" disabled={!pick} onClick={add}>Bổ nhiệm</Button>
      </Space.Compact>
      <List locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có quản trị viên" /> }} dataSource={people}
        renderItem={(m) => (
          <List.Item actions={[<Button key="r" type="text" danger size="small" onClick={() => remove(m.user_id)}>Gỡ</Button>]}>
            <List.Item.Meta avatar={<Avatar style={{ background: "var(--a-chip)", color: BRAND.green, fontWeight: 700 }}>{initials(m.full_name)}</Avatar>} title={m.full_name} description={m.email} />
          </List.Item>
        )} />
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
