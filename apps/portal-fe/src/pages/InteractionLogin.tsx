import { Alert, Button, Checkbox, Form, Input, List } from "antd";
import { CheckCircleTwoTone, CloseCircleTwoTone, LockOutlined, UserOutlined } from "@ant-design/icons";
import { Brand, BRAND } from "../ui";
import { LoginScene } from "../scenes";
import { useEffect, useRef, useState } from "react";
import {
  checkPassword,
  PASSWORD_RULE_LABELS,
  type PasswordChecks,
} from "@pmh/shared";

/** CSS màn đăng nhập: gradient mesh + glass card + hero + animation vào trang. */
const authCss = `
.pmh-auth{position:fixed;inset:0;overflow:auto;isolation:isolate;background:#082b27;}
/* Ảnh phối cảnh full-bleed + Ken Burns zoom chậm (thay bằng ảnh render thật sau) */
.pmh-auth__bg{position:absolute;inset:0;z-index:0;overflow:hidden;}
.pmh-auth__bgi{position:absolute;inset:0;}
/* Vignette điện ảnh + hạt phim (grain TĨNH — tính 1 lần, GPU rẻ) */
.pmh-auth__vignette{position:absolute;inset:0;z-index:1;pointer-events:none;background:radial-gradient(125% 105% at 50% 40%, transparent 52%, rgba(4,8,16,.5) 100%);}
.pmh-auth__grain{position:absolute;inset:0;z-index:1;pointer-events:none;opacity:.05;mix-blend-mode:overlay;background-size:150px 150px;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");}
/* Card: viền vàng mảnh trên đỉnh + vi tương tác */
.pmh-card::before{content:"";position:absolute;top:0;left:26px;right:26px;height:2px;border-radius:2px;background:linear-gradient(90deg,transparent,#C9A24B,transparent);}
.pmh-card .ant-btn-primary{transition:transform .16s ease, box-shadow .16s ease;}
.pmh-card .ant-btn-primary:hover{transform:translateY(-1px);box-shadow:0 10px 22px rgba(14,77,69,.34);}
/* Focus ĐỒNG NHẤT: viền + quầng cùng vàng đồng (trước đây viền xanh của antd đá
   nhau với quầng vàng → trông "sai lệch"). Hover cũng ngả vàng nhẹ. */
.pmh-card .ant-input-affix-wrapper:hover,.pmh-card .ant-input:hover{border-color:#C9A24B!important;}
.pmh-card .ant-input-affix-wrapper-focused,.pmh-card .ant-input-affix-wrapper:focus-within,.pmh-card .ant-input:focus{border-color:#C9A24B!important;box-shadow:0 0 0 3px rgba(201,162,75,.22)!important;}
/* Lớp phủ tối để khung login + chữ nổi rõ trên scene động */
.pmh-auth__overlay{position:absolute;inset:0;z-index:1;background:
  linear-gradient(110deg, rgba(9,16,30,.8) 0%, rgba(9,16,30,.18) 44%, rgba(8,14,26,.48) 64%, rgba(8,14,26,.8) 100%);}
.pmh-auth__eyebrow{font-size:12.5px;letter-spacing:2.5px;text-transform:uppercase;color:#C9A24B;font-weight:600;margin-bottom:20px;}
.pmh-auth__logo{display:inline-block;}
.pmh-auth__logo img{height:62px;display:block;filter:drop-shadow(0 2px 10px rgba(0,0,0,.55));}
.pmh-auth__wrap{position:relative;z-index:2;min-height:100%;box-sizing:border-box;display:flex;
  align-items:center;justify-content:center;gap:72px;max-width:1080px;margin:0 auto;padding:48px 32px;}
.pmh-auth__hero{flex:1 1 0;max-width:460px;color:#fff;animation:pmhUp .6s cubic-bezier(.2,.7,.2,1) both;}
.pmh-auth__brand{display:flex;align-items:center;gap:12px;font-size:22px;font-weight:700;letter-spacing:.4px;}
.pmh-auth__hero h1{margin:22px 0 0;font-size:clamp(30px,3.4vw,46px);font-weight:800;line-height:1.12;letter-spacing:-1.2px;}
.pmh-auth__hero h1 em{font-style:normal;color:#e6cf95;}
.pmh-auth__hero p{margin:18px 0 0;max-width:400px;font-size:16px;line-height:1.65;color:rgba(255,255,255,.74);}
.pmh-auth__rule{margin-top:28px;height:3px;width:64px;border-radius:3px;background:#C9A24B;}
.pmh-card{position:relative;width:100%;max-width:404px;box-sizing:border-box;padding:36px 32px;border-radius:22px;
  background:rgba(236,230,220,.9);backdrop-filter:blur(18px) saturate(1.2);-webkit-backdrop-filter:blur(18px) saturate(1.2);
  border:1px solid rgba(255,255,255,.4);box-shadow:0 34px 74px -22px rgba(0,0,0,.62),0 4px 14px rgba(0,0,0,.16);
  animation:pmhUp .6s cubic-bezier(.2,.7,.2,1) .08s both;}
.pmh-card__brand{display:none;align-items:center;justify-content:center;gap:10px;margin-bottom:22px;font-size:19px;font-weight:700;color:#16211F;}
.pmh-card__title{margin:0;font-size:24px;font-weight:700;color:#16211F;letter-spacing:-.3px;}
.pmh-card__sub{margin:6px 0 22px;color:#5f716c;}
@media (max-width:820px){
  .pmh-auth__hero{display:none;}
  .pmh-card__brand{display:flex;}
  .pmh-auth__wrap{padding:28px 18px;}
}
@keyframes pmhUp{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:none;}}
@media (prefers-reduced-motion:reduce){.pmh-auth__hero,.pmh-card{animation:none;}}
`;

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
  const bgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/interaction/${uid}`, { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setClientName(d.clientName ?? d.clientId))
      .catch(() => setDead(true));
  }, [uid]);

  // Tôn trọng reduced-motion: freeze SMIL ở khung hoàng hôn cho người nhạy cảm
  // chuyển động (SMIL không nghe @media prefers-reduced-motion nên phải chặn tay).
  useEffect(() => {
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const svg = bgRef.current?.querySelector("svg") as (SVGSVGElement & { pauseAnimations?: () => void; setCurrentTime?: (t: number) => void }) | null;
    svg?.pauseAnimations?.();
    svg?.setCurrentTime?.(11);
  }, []);

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

  const stepTitle =
    step === "change_password" ? "Đổi mật khẩu"
    : step === "mfa" ? "Xác thực 2 lớp"
    : step === "mfa_enroll" ? "Thiết lập bảo mật"
    : "Đăng nhập";

  const showSub = !!clientName && step === "login";
  const form = (
    <>
      <h2 className="pmh-card__title" style={{ marginBottom: showSub ? 6 : 22 }}>
        {stepTitle}
      </h2>
      {showSub && (
        <p className="pmh-card__sub">
          để tiếp tục vào <b style={{ color: BRAND.green }}>{clientName}</b>
        </p>
      )}

      {dead ? (
        <>
          <Alert
            type="warning"
            message="Phiên đăng nhập đã hết hạn"
            description="Phiên này đã đóng. Bắt đầu lại để đăng nhập."
            showIcon
            style={{ marginBottom: 16 }}
          />
          {/* URL vẫn trỏ vào interaction CŨ đã chết → refresh không thoát được.
              Về "/" khởi tạo phiên đăng nhập MỚI (App.boot → login → interaction
              mới), thoát ngõ cụt. */}
          <Button type="primary" size="large" block onClick={() => { window.location.href = "/"; }}>
            Đăng nhập lại
          </Button>
        </>
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
    </>
  );

  return (
    <div className="pmh-auth">
      <style>{authCss}</style>
      <div className="pmh-auth__bg">
        <div className="pmh-auth__bgi" ref={bgRef}>
          <LoginScene />
        </div>
      </div>
      <div className="pmh-auth__overlay" />
      <div className="pmh-auth__vignette" />
      <div className="pmh-auth__grain" />
      <div className="pmh-auth__wrap">
        <div className="pmh-auth__hero">
          <div className="pmh-auth__logo">
            <img src="/logo-phu-my-hung.png" alt="Phú Mỹ Hưng" />
          </div>
          <div className="pmh-auth__eyebrow" style={{ marginTop: 30 }}>
            Phòng thiết kế dự án · Bất động sản
          </div>
          <h1>
            Một tài khoản,<br />mọi <em>dự án</em> của công ty.
          </h1>
          <p>
            Cổng đăng nhập chung của PMH — an toàn, tập trung. Đăng nhập một lần,
            mở mọi phối cảnh, hồ sơ và ứng dụng nội bộ.
          </p>
          <div className="pmh-auth__rule" />
        </div>
        <div className="pmh-card">
          <div className="pmh-card__brand">
            <Brand size={28} />
            <span>PMH ID</span>
          </div>
          {form}
        </div>
      </div>
    </div>
  );
}

function LoginForm({
  loading,
  onFinish,
}: {
  loading: boolean;
  onFinish: (v: { email: string; password: string }) => void;
}) {
  const [forgot, setForgot] = useState(false);
  if (forgot) return <ForgotForm onBack={() => setForgot(false)} />;
  return (
    <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
      <Form.Item label="Email" name="email" rules={[{ required: true, message: "Nhập email" }]}>
        <Input
          size="large"
          autoComplete="username"
          autoFocus
          prefix={<UserOutlined style={{ color: BRAND.muted }} />}
          placeholder="ten@pmh.com.vn"
        />
      </Form.Item>
      <Form.Item
        label="Mật khẩu"
        name="password"
        rules={[{ required: true, message: "Nhập mật khẩu" }]}
        style={{ marginBottom: 8 }}
      >
        <Input.Password
          size="large"
          autoComplete="current-password"
          prefix={<LockOutlined style={{ color: BRAND.muted }} />}
        />
      </Form.Item>
      <div style={{ textAlign: "right", marginBottom: 14 }}>
        <Button type="link" size="small" style={{ padding: 0, height: "auto" }} onClick={() => setForgot(true)}>
          Quên mật khẩu?
        </Button>
      </div>
      <Button type="primary" htmlType="submit" size="large" block loading={loading}>
        Đăng nhập
      </Button>
    </Form>
  );
}

/** Quên mật khẩu (FR-11): gửi MK tạm qua email; phản hồi ĐỒNG NHẤT (không lộ email tồn tại). */
function ForgotForm({ onBack }: { onBack: () => void }) {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (v: { email: string }) => {
    setBusy(true);
    setErr(null);
    try {
      const res = await postJson("/api/auth/forgot-password", { email: v.email });
      if (res.status === 429) {
        setErr("Bạn thao tác quá nhanh — thử lại sau ít phút.");
        return;
      }
      setSent(true);
    } catch {
      // postJson chỉ reject khi lỗi mạng → hiện lỗi, không kẹt spinner.
      setErr("Không kết nối được máy chủ — thử lại sau.");
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div>
        <Alert
          type="success"
          showIcon
          message="Đã gửi yêu cầu"
          description="Nếu email khớp một tài khoản đang hoạt động, mật khẩu tạm đã được gửi vào hộp thư. Hãy đăng nhập bằng mật khẩu tạm rồi đổi mật khẩu mới."
        />
        <Button type="link" style={{ padding: 0, marginTop: 14 }} onClick={onBack}>
          ← Quay lại đăng nhập
        </Button>
      </div>
    );
  }
  return (
    <Form layout="vertical" onFinish={submit} requiredMark={false}>
      <div style={{ color: BRAND.muted, fontSize: 13, marginBottom: 14 }}>
        Nhập email tài khoản — hệ thống gửi mật khẩu tạm để bạn đăng nhập lại.
      </div>
      {err && <Alert type="warning" showIcon message={err} style={{ marginBottom: 12 }} />}
      <Form.Item label="Email" name="email" rules={[{ required: true, type: "email", message: "Email không hợp lệ" }]}>
        <Input size="large" autoFocus prefix={<UserOutlined style={{ color: BRAND.muted }} />} placeholder="ten@pmh.com.vn" />
      </Form.Item>
      <Button type="primary" htmlType="submit" size="large" block loading={busy}>
        Gửi mật khẩu tạm
      </Button>
      <Button type="link" block style={{ marginTop: 8 }} onClick={onBack}>
        ← Quay lại đăng nhập
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
