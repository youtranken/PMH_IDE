import { App as AntApp, Button, Card, Input, Select, Space, Table, Tag, Typography } from "antd";
import { useEffect, useState } from "react";
import { api } from "../auth";

const { Title, Text } = Typography;

interface AuditRow {
  id: number;
  actor_email: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  project_id: string | null;
  ip: string | null;
  created_at: string;
}

const columns = [
  {
    title: "Thời gian",
    dataIndex: "created_at",
    render: (v: string) => new Date(v).toLocaleString(),
    width: 170,
  },
  { title: "Người thực hiện", dataIndex: "actor_email", render: (v: string | null) => v ?? "—" },
  {
    title: "Hành động",
    dataIndex: "action",
    render: (v: string) => (
      <Tag color={v.startsWith("login.denied") || v.endsWith(".failed") ? "red" : v.startsWith("login") ? "green" : "default"}>
        {v}
      </Tag>
    ),
  },
  { title: "Đối tượng", render: (_: unknown, r: AuditRow) => (r.target_type ? `${r.target_type}:${(r.target_id ?? "").slice(0, 8)}` : "—") },
  { title: "IP", dataIndex: "ip", render: (v: string | null) => v ?? "—" },
];

/** Xem audit theo phạm vi + lưu trữ tháng (E6-S4, FR-30/31). */
export default function Audit({ isSsa }: { isSsa: boolean }) {
  const { message } = AntApp.useApp();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [action, setAction] = useState("");
  const [loading, setLoading] = useState(false);
  const [archives, setArchives] = useState<string[]>([]);
  const [month, setMonth] = useState<string | undefined>();

  const load = async (act?: string, m?: string) => {
    setLoading(true);
    try {
      const data = m
        ? await api<AuditRow[]>(`/api/admin/audit/archives/${m}`)
        : await api<AuditRow[]>(`/api/admin/audit?limit=200${act ? `&action=${encodeURIComponent(act)}` : ""}`);
      setRows(data);
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    if (isSsa) api<string[]>("/api/admin/audit/archives").then(setArchives).catch(() => {});
  }, []);

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <div>
        <Title level={3} style={{ marginBottom: 2 }}>Nhật ký hệ thống</Title>
        <Text type="secondary">Đăng nhập và thao tác quản trị, theo phạm vi bạn quản lý.</Text>
      </div>
      <Card>
        <Space wrap style={{ marginBottom: 16 }}>
          <Input.Search
            placeholder="Lọc theo hành động (vd login.success)"
            allowClear
            style={{ width: 280 }}
            onSearch={(v) => {
              setMonth(undefined);
              setAction(v);
              load(v);
            }}
          />
          {isSsa && (
            <Select
              placeholder="Xem lưu trữ tháng…"
              style={{ width: 200 }}
              allowClear
              value={month}
              options={archives.map((m) => ({ value: m, label: `Lưu trữ ${m}` }))}
              onChange={(m) => {
                setMonth(m);
                load(action, m);
              }}
            />
          )}
          <Button onClick={() => { setMonth(undefined); load(action); }}>Làm mới</Button>
        </Space>
        <Table<AuditRow>
          rowKey="id"
          loading={loading}
          dataSource={rows}
          columns={columns}
          size="small"
          pagination={{ pageSize: 20 }}
          scroll={{ x: 720 }}
        />
      </Card>
    </Space>
  );
}
