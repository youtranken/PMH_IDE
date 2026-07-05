import { CheckCircleTwoTone, CloseCircleTwoTone } from "@ant-design/icons";
import {
  Alert,
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
import { api, logout } from "../auth";
import type { Profile } from "../App";

const { Title } = Typography;

interface Session {
  oidc_session_uid: string;
  ip: string | null;
  last_activity: string;
  created_at: string;
}

/** Self-service (E6-S2, FR-10/05): thông tin + group, quản phiên, đổi mật khẩu. */
/** Bật/tắt MFA TOTP tự phục vụ (phase sau — mọi user). */
function MfaCard() {
  const { message } = AntApp.useApp();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [setup, setSetup] = useState<{ qr: string } | null>(null);
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState<string[] | null>(null);
  const [disabling, setDisabling] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = () =>
    api<{ enabled: boolean }>("/api/me/mfa").then((s) => setEnabled(s.enabled));
  useEffect(() => {
    load();
  }, []);

  const begin = async () => {
    setBusy(true);
    try {
      setSetup(await api<{ otpauth: string; qr: string }>("/api/me/mfa/setup", { method: "POST" }));
    } finally {
      setBusy(false);
    }
  };
  const confirm = async () => {
    setBusy(true);
    try {
      const r = await api<{ recoveryCodes: string[] }>("/api/me/mfa/enable", {
        method: "POST",
        body: { code },
      });
      setRecovery(r.recoveryCodes);
      setSetup(null);
      setCode("");
      setEnabled(true);
      message.success("Đã bật MFA");
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const disable = async () => {
    setBusy(true);
    try {
      await api("/api/me/mfa/disable", { method: "POST", body: { code } });
      setEnabled(false);
      setDisabling(false);
      setCode("");
      message.success("Đã tắt MFA");
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (enabled === null) return null;

  return (
    <Card title="Xác thực 2 lớp (MFA)">
      {recovery ? (
        <>
          <Alert
            type="success"
            showIcon
            style={{ marginBottom: 12 }}
            message="Đã bật MFA — LƯU recovery codes ngay (chỉ hiện một lần)"
            description="Dùng khi mất thiết bị. Mỗi code dùng một lần."
          />
          <List
            size="small"
            bordered
            dataSource={recovery}
            renderItem={(c) => <List.Item style={{ fontFamily: "monospace" }}>{c}</List.Item>}
          />
          <Button style={{ marginTop: 12 }} onClick={() => setRecovery(null)}>
            Đã lưu, đóng
          </Button>
        </>
      ) : enabled ? (
        disabling ? (
          <Space direction="vertical" style={{ width: "100%", maxWidth: 320 }}>
            <span>Nhập mã TOTP (hoặc recovery code) để tắt:</span>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" />
            <Space>
              <Button danger loading={busy} disabled={!code} onClick={disable}>Tắt MFA</Button>
              <Button onClick={() => { setDisabling(false); setCode(""); }}>Hủy</Button>
            </Space>
          </Space>
        ) : (
          <Space>
            <Tag color="green">Đang bật</Tag>
            <Button danger onClick={() => setDisabling(true)}>Tắt MFA</Button>
          </Space>
        )
      ) : setup ? (
        <Space direction="vertical" style={{ width: "100%", maxWidth: 340 }}>
          <span>Quét QR bằng app authenticator rồi nhập mã 6 số:</span>
          <img src={setup.qr} alt="MFA QR" style={{ width: 200, height: 200 }} />
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" autoComplete="one-time-code" />
          <Button type="primary" loading={busy} disabled={!code} onClick={confirm}>Xác nhận bật MFA</Button>
        </Space>
      ) : (
        <Space direction="vertical">
          <span>Tăng bảo mật tài khoản bằng mã TOTP một lần (authenticator app).</span>
          <Button type="primary" loading={busy} onClick={begin}>Bật MFA</Button>
        </Space>
      )}
    </Card>
  );
}

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

      <Card
        title="Phiên đăng nhập"
        extra={
          <Popconfirm
            title="Đăng xuất khỏi TẤT CẢ thiết bị (kể cả hiện tại)?"
            onConfirm={async () => {
              await api("/api/me/logout-all", { method: "POST" });
              logout();
            }}
          >
            <Button size="small" danger>Đăng xuất mọi thiết bị</Button>
          </Popconfirm>
        }
      >
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

      <MfaCard />

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
