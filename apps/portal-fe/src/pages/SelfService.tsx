import { CheckCircleTwoTone, CloseCircleTwoTone } from "@ant-design/icons";
import {
  App as AntApp,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  List,
  Popconfirm,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import { useEffect, useState } from "react";
import {
  checkPassword,
  PASSWORD_RULE_LABELS,
  type PasswordChecks,
} from "@pmh/shared";
import { api } from "../auth";
import type { Profile } from "../App";

const { Title } = Typography;

interface Session {
  oidc_session_uid: string;
  ip: string | null;
  last_activity: string;
  created_at: string;
}

/** Self-service (E6-S2, FR-10/05): thông tin + group, quản phiên, đổi mật khẩu. */
export default function SelfService({ profile }: { profile: Profile; onProfile: (p: Profile) => void }) {
  const { message } = AntApp.useApp();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [curPw, setCurPw] = useState("");
  const [pw, setPw] = useState("");
  const [saving, setSaving] = useState(false);
  const checks = checkPassword(pw);
  const allOk = Object.values(checks).every(Boolean);

  const loadSessions = () =>
    api<Session[]>("/api/me/sessions").then(setSessions).catch(() => {});
  useEffect(() => {
    loadSessions();
  }, []);

  const revoke = async (uid: string) => {
    await api(`/api/me/sessions/${uid}/revoke`, { method: "POST" });
    message.success("Đã đăng xuất phiên");
    loadSessions();
  };

  const changePassword = async () => {
    setSaving(true);
    try {
      const r = await api<{ revoked: number }>("/api/me/change-password", {
        method: "POST",
        body: { currentPassword: curPw, newPassword: pw },
      });
      setPw("");
      setCurPw("");
      message.success(`Đã đổi mật khẩu — hủy ${r.revoked} phiên khác, giữ phiên hiện tại`);
      loadSessions();
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Title level={3}>Tài khoản</Title>

      <Card>
        <Descriptions column={1} title="Thông tin">
          <Descriptions.Item label="Họ tên">{profile.full_name}</Descriptions.Item>
          <Descriptions.Item label="Email">{profile.email}</Descriptions.Item>
          <Descriptions.Item label="Mã NV">{profile.employee_code}</Descriptions.Item>
          <Descriptions.Item label="Nhóm">
            {profile.groups.length
              ? profile.groups.map((g) => <Tag key={g}>{g}</Tag>)
              : "—"}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="Phiên đăng nhập">
        <Table<Session>
          rowKey="oidc_session_uid"
          dataSource={sessions}
          pagination={false}
          size="small"
          columns={[
            { title: "IP", dataIndex: "ip", render: (v) => v ?? "—" },
            {
              title: "Hoạt động gần nhất",
              dataIndex: "last_activity",
              render: (v: string) => new Date(v).toLocaleString(),
            },
            {
              title: "",
              render: (_, s) => (
                <Popconfirm title="Đăng xuất phiên này?" onConfirm={() => revoke(s.oidc_session_uid)}>
                  <Button size="small" danger>Đăng xuất</Button>
                </Popconfirm>
              ),
            },
          ]}
        />
      </Card>

      <Card title="Đổi mật khẩu">
        <Form layout="vertical" style={{ maxWidth: 420 }}>
          <Form.Item label="Mật khẩu hiện tại">
            <Input.Password
              value={curPw}
              autoComplete="current-password"
              onChange={(e) => setCurPw(e.target.value)}
            />
          </Form.Item>
          <Form.Item label="Mật khẩu mới">
            <Input.Password
              value={pw}
              autoComplete="new-password"
              onChange={(e) => setPw(e.target.value)}
            />
          </Form.Item>
          <List
            size="small"
            style={{ marginBottom: 16 }}
            dataSource={Object.keys(checks) as (keyof PasswordChecks)[]}
            renderItem={(k) => (
              <List.Item>
                {checks[k] ? (
                  <CheckCircleTwoTone twoToneColor="#52c41a" />
                ) : (
                  <CloseCircleTwoTone twoToneColor="#ff4d4f" />
                )}
                <span style={{ marginLeft: 8 }}>{PASSWORD_RULE_LABELS[k]}</span>
              </List.Item>
            )}
          />
          <Button type="primary" disabled={!allOk || !curPw} loading={saving} onClick={changePassword}>
            Đổi mật khẩu
          </Button>
        </Form>
      </Card>
    </Space>
  );
}
