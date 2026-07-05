import {
  Alert,
  Button,
  Card,
  Checkbox,
  Form,
  Input,
  Layout,
  List,
  Typography,
} from "antd";
import { CheckCircleTwoTone, CloseCircleTwoTone } from "@ant-design/icons";
import { Brand } from "../ui";
import { useEffect, useState } from "react";
import {
  checkPassword,
  PASSWORD_RULE_LABELS,
  type PasswordChecks,
} from "@pmh/shared";

const { Content } = Layout;
const { Title, Text } = Typography;

type Step = "login" | "change_password" | "mfa" | "mfa_enroll";

async function postJson(url: string, body: unknown) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}

/**
 * Trang đăng nhập SSO đa bước (E1-S4 + Epic 2, AD-3):
 *   mật khẩu → [đổi MK bắt buộc] → [MFA] → redirect về app.
 * Server điều khiển bước kế qua trường `next`; FE chỉ render.
 */
export default function InteractionLogin({ uid }: { uid: string }) {
  const [step, setStep] = useState<Step>("login");
  const [clientName, setClientName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dead, setDead] = useState(false);

  useEffect(() => {
    fetch(`/api/interaction/${uid}`, { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setClientName(d.clientName ?? d.clientId))
      .catch(() => setDead(true));
  }, [uid]);

  /** Xử lý phản hồi chung: điều hướng / chuyển bước / lỗi. */
  function handle(res: { status: number; data: any }): boolean {
    if (res.data?.redirectTo) {
      window.location.href = res.data.redirectTo;
      return true;
    }
    if (res.data?.next) {
      setStep(res.data.next as Step);
      setError(null);
      return true;
    }
    if (res.status === 429) {
      setError(`Thử lại sau ${res.data?.retryAfter ?? "vài"} giây.`);
      return false;
    }
    if (res.status === 410) {
      // Phiên interaction hết hạn (form mở quá lâu) — không hiện lỗi inline mà
      // chuyển hẳn sang màn "hết hạn, đăng nhập lại".
      setDead(true);
      return false;
    }
    if (res.status === 401 || res.status === 400 || res.status === 403) {
      // 403 = không có quyền vào app (client_groups, E5-S3) — hiện rõ lý do.
      setError(res.data?.message ?? "Không hợp lệ");
      return false;
    }
    setDead(true);
    return false;
  }

  async function onLogin(v: { email: string; password: string }) {
    setLoading(true);
    setError(null);
    try {
      handle(await postJson(`/api/interaction/${uid}/login`, v));
    } finally {
      setLoading(false);
    }
  }

  async function onChangePassword(v: { newPassword: string }) {
    setLoading(true);
    setError(null);
    try {
      handle(await postJson(`/api/interaction/${uid}/change-password`, v));
    } finally {
      setLoading(false);
    }
  }

  async function onMfa(v: { code: string; recovery?: boolean }) {
    setLoading(true);
    setError(null);
    try {
      handle(await postJson(`/api/interaction/${uid}/mfa`, v));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout style={{ minHeight: "100vh", justifyContent: "center" }}>
      <Content style={{ maxWidth: 400, width: "100%", margin: "0 auto", padding: 24 }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <Brand size={34} />
            <span style={{ fontSize: 22, fontWeight: 700, color: "#123", letterSpacing: 0.3 }}>
              PMH ID
            </span>
          </div>
        </div>
        <Card>
          <Title level={4} style={{ textAlign: "center", marginTop: 0 }}>
            Đăng nhập
          </Title>
          {clientName && step === "login" && (
            <Text
              type="secondary"
              style={{ display: "block", textAlign: "center", marginBottom: 16 }}
            >
              để tiếp tục vào <b style={{ color: "#1560a8" }}>{clientName}</b>
            </Text>
          )}

          {dead ? (
            <Alert
              type="warning"
              message="Phiên đăng nhập đã hết hạn"
              description="Quay lại ứng dụng và thử đăng nhập lại."
              showIcon
            />
          ) : (
            <>
              {error && (
                <Alert type="error" message={error} style={{ marginBottom: 16 }} showIcon />
              )}
              {step === "login" && <LoginForm loading={loading} onFinish={onLogin} />}
              {step === "change_password" && (
                <ChangePasswordForm loading={loading} onFinish={onChangePassword} />
              )}
              {step === "mfa" && <MfaForm loading={loading} onFinish={onMfa} />}
              {step === "mfa_enroll" && <MfaEnrollForm uid={uid} />}
            </>
          )}
        </Card>
      </Content>
    </Layout>
  );
}

function LoginForm({
  loading,
  onFinish,
}: {
  loading: boolean;
  onFinish: (v: { email: string; password: string }) => void;
}) {
  return (
    <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
      <Form.Item label="Email" name="email" rules={[{ required: true, message: "Nhập email" }]}>
        <Input autoComplete="username" autoFocus />
      </Form.Item>
      <Form.Item
        label="Mật khẩu"
        name="password"
        rules={[{ required: true, message: "Nhập mật khẩu" }]}
      >
        <Input.Password autoComplete="current-password" />
      </Form.Item>
      <Button type="primary" htmlType="submit" block loading={loading}>
        Đăng nhập
      </Button>
    </Form>
  );
}

function ChangePasswordForm({
  loading,
  onFinish,
}: {
  loading: boolean;
  onFinish: (v: { newPassword: string }) => void;
}) {
  const [pw, setPw] = useState("");
  const checks = checkPassword(pw);
  const allOk = Object.values(checks).every(Boolean);
  return (
    <Form layout="vertical" onFinish={() => onFinish({ newPassword: pw })} requiredMark={false}>
      <Alert
        type="info"
        message="Bạn cần đặt mật khẩu mới trước khi tiếp tục"
        style={{ marginBottom: 16 }}
        showIcon
      />
      <Form.Item label="Mật khẩu mới">
        <Input.Password
          autoFocus
          autoComplete="new-password"
          value={pw}
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
      <Button type="primary" htmlType="submit" block loading={loading} disabled={!allOk}>
        Đặt mật khẩu & tiếp tục
      </Button>
    </Form>
  );
}

function MfaForm({
  loading,
  onFinish,
}: {
  loading: boolean;
  onFinish: (v: { code: string; recovery?: boolean }) => void;
}) {
  const [recovery, setRecovery] = useState(false);
  return (
    <Form layout="vertical" onFinish={(v) => onFinish({ ...v, recovery })} requiredMark={false}>
      <Alert
        type="info"
        message={recovery ? "Nhập một recovery code" : "Nhập mã 6 số từ authenticator app"}
        style={{ marginBottom: 16 }}
        showIcon
      />
      <Form.Item name="code" rules={[{ required: true, message: "Nhập mã" }]}>
        <Input autoFocus autoComplete="one-time-code" placeholder={recovery ? "XXXXX-XXXXX" : "123456"} />
      </Form.Item>
      <Form.Item>
        <Checkbox checked={recovery} onChange={(e) => setRecovery(e.target.checked)}>
          Dùng recovery code thay vì mã TOTP
        </Checkbox>
      </Form.Item>
      <Button type="primary" htmlType="submit" block loading={loading}>
        Xác thực
      </Button>
    </Form>
  );
}

/** Ép enroll MFA giữa luồng login (vai bắt buộc MFA mà chưa bật). */
function MfaEnrollForm({ uid }: { uid: string }) {
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recovery, setRecovery] = useState<string[] | null>(null);
  const [redirectTo, setRedirectTo] = useState("");

  useEffect(() => {
    postJson(`/api/interaction/${uid}/mfa-enroll-setup`, {}).then((r) =>
      setQr(r.data?.qr ?? null),
    );
  }, [uid]);

  const submit = async () => {
    setBusy(true);
    setErr(null);
    const r = await postJson(`/api/interaction/${uid}/mfa-enroll`, { code });
    setBusy(false);
    if (r.data?.recoveryCodes) {
      setRecovery(r.data.recoveryCodes);
      setRedirectTo(r.data.redirectTo);
    } else {
      setErr(r.data?.message ?? "Mã xác thực không đúng");
    }
  };

  if (recovery) {
    return (
      <>
        <Alert
          type="success"
          showIcon
          style={{ marginBottom: 12 }}
          message="Đã bật MFA — LƯU recovery codes (chỉ hiện một lần)"
        />
        <List
          size="small"
          bordered
          dataSource={recovery}
          renderItem={(c) => (
            <List.Item style={{ fontFamily: "monospace" }}>{c}</List.Item>
          )}
        />
        <Button
          type="primary"
          block
          style={{ marginTop: 12 }}
          onClick={() => {
            window.location.href = redirectTo;
          }}
        >
          Đã lưu — vào ứng dụng
        </Button>
      </>
    );
  }

  return (
    <>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="Tài khoản của bạn bắt buộc bật MFA"
        description="Quét QR bằng authenticator app rồi nhập mã 6 số."
      />
      {err && <Alert type="error" message={err} style={{ marginBottom: 12 }} showIcon />}
      {qr && (
        <img
          src={qr}
          alt="MFA QR"
          style={{ width: 200, height: 200, display: "block", margin: "0 auto 12px" }}
        />
      )}
      <Input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="123456"
        autoComplete="one-time-code"
        style={{ marginBottom: 12 }}
      />
      <Button type="primary" block loading={busy} disabled={!code} onClick={submit}>
        Xác nhận bật MFA
      </Button>
    </>
  );
}
