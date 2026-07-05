import { DeleteOutlined, PlusOutlined, TeamOutlined } from "@ant-design/icons";
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
  deleted_at: string | null;
}

export default function AdminGroups({ isSsa }: { isSsa: boolean }) {
  const { message } = AntApp.useApp();
  const [rows, setRows] = useState<GroupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form] = Form.useForm();
  const [editing, setEditing] = useState<GroupRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [membersOf, setMembersOf] = useState<GroupRow | null>(null);

  const load = () => {
    setLoading(true);
    api<GroupRow[]>("/api/admin/groups").then(setRows).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openCreate = () => { setEditing(null); form.resetFields(); setFormOpen(true); };
  const openEdit = (g: GroupRow) => { setEditing(g); form.setFieldsValue(g); setFormOpen(true); };

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
    <div style={{ maxWidth: 900, margin: "0 auto", width: "100%" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
        <div>
          <Title level={3} style={{ marginBottom: 2 }}>Nhóm</Title>
          <Text type="secondary">Nhóm quyết định user được vào ứng dụng nào và phạm vi danh bạ.</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Tạo nhóm</Button>
      </div>

      <Table<GroupRow>
        rowKey="id"
        loading={loading}
        dataSource={rows}
        pagination={false}
        columns={[
          {
            title: "Nhóm",
            render: (_, g) => (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Avatar shape="square" style={{ background: "#e8f0ed", color: BRAND.green, borderRadius: 10, flex: "0 0 auto" }} icon={<TeamOutlined />} />
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
              </Space>
            ),
          },
        ]}
      />

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
  const { message } = AntApp.useApp();
  const [members, setMembers] = useState<Member[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<string | undefined>();

  const load = () => {
    if (!group) return;
    setLoading(true);
    api<Member[]>(`/api/admin/groups/${group.id}/members`).then(setMembers).finally(() => setLoading(false));
  };
  useEffect(load, [group]);
  useEffect(() => {
    if (group && users.length === 0) api<UserRow[]>("/api/admin/users").then(setUsers).catch(() => {});
  }, [group]);

  const add = async (userId: string) => {
    try {
      await api(`/api/admin/groups/${group!.id}/members`, { method: "POST", body: { userId } });
      message.success("Đã thêm vào nhóm");
      setAdding(undefined);
      load();
    } catch (e) {
      message.error((e as Error).message);
    }
  };
  const remove = async (userId: string) => {
    try {
      const r = await api<{ revoked: number }>(`/api/admin/groups/${group!.id}/members/${userId}`, { method: "DELETE" });
      message.success(`Đã gỡ khỏi nhóm — thu hồi ${r.revoked} phiên`);
      load();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const memberIds = new Set(members.map((m) => m.user_id));
  const candidates = users.filter((u) => !u.deleted_at && !memberIds.has(u.id));

  return (
    <Drawer open={!!group} onClose={onClose} width={440} title={group ? `Thành viên · ${group.name}` : ""}>
      <Space.Compact style={{ width: "100%", marginBottom: 16 }}>
        <Select
          showSearch
          placeholder="Thêm nhân viên vào nhóm…"
          style={{ width: "100%" }}
          value={adding}
          onChange={setAdding}
          filterOption={(i, o) => (o?.label as string).toLowerCase().includes(i.toLowerCase())}
          options={candidates.map((u) => ({ value: u.id, label: `${u.full_name} · ${u.email}` }))}
        />
        <Button type="primary" disabled={!adding} onClick={() => add(adding!)}>Thêm</Button>
      </Space.Compact>

      <List
        loading={loading}
        locale={{ emptyText: <Empty description="Chưa có thành viên" /> }}
        dataSource={members}
        renderItem={(m) => (
          <List.Item
            actions={[<Button key="r" type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => remove(m.user_id)} />]}
          >
            <List.Item.Meta
              avatar={<Avatar style={{ background: "#e8f0ed", color: BRAND.green, fontWeight: 700 }}>{initials(m.full_name)}</Avatar>}
              title={m.full_name}
              description={m.email}
            />
          </List.Item>
        )}
      />
    </Drawer>
  );
}
