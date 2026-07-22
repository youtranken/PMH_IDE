import { Alert, Button, Checkbox, Form, Input, List, Space, Spin } from "antd";
import { CheckCircleFilled, LockOutlined, MinusCircleOutlined, UserOutlined } from "@ant-design/icons";
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
.pmh-authcard::before{content:"";position:absolute;top:0;left:26px;right:26px;height:2px;border-radius:2px;background:linear-gradient(90deg,transparent,#C9A24B,transparent);}
.pmh-authcard .ant-btn-primary{transition:transform .16s ease, box-shadow .16s ease;}
.pmh-authcard .ant-btn-primary:hover{transform:translateY(-1px);box-shadow:0 10px 22px rgba(14,77,69,.34);}
/* Focus ĐỒNG NHẤT: viền + quầng cùng vàng đồng (trước đây viền xanh của antd đá
   nhau với quầng vàng → trông "sai lệch"). Hover cũng ngả vàng nhẹ. */
.pmh-authcard .ant-input-affix-wrapper:hover,.pmh-authcard .ant-input:hover{border-color:#C9A24B!important;}
.pmh-authcard .ant-input-affix-wrapper-focused,.pmh-authcard .ant-input-affix-wrapper:focus-within,.pmh-authcard .ant-input:focus{border-color:#C9A24B!important;box-shadow:0 0 0 3px rgba(201,162,75,.22)!important;}
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
.pmh-authcard{position:relative;width:100%;max-width:404px;box-sizing:border-box;padding:36px 34px 40px;border-radius:22px;overflow:visible;height:auto;
  background:rgba(236,230,220,.9);backdrop-filter:blur(18px) saturate(1.2);-webkit-backdrop-filter:blur(18px) saturate(1.2);
  border:1px solid rgba(255,255,255,.4);box-shadow:0 34px 74px -22px rgba(0,0,0,.62),0 4px 14px rgba(0,0,0,.16);
  animation:pmhUp .6s cubic-bezier(.2,.7,.2,1) .08s both;}
.pmh-authcard__brand{display:none;align-items:center;justify-content:center;gap:10px;margin-bottom:22px;font-size:19px;font-weight:700;color:#16211F;}
.pmh-authcard__title{margin:0;font-size:24px;font-weight:700;color:#16211F;letter-spacing:-.3px;}
.pmh-authcard__sub{margin:6px 0 22px;color:#5f716c;}
/* Nút "Quay lại đăng nhập" — text mờ, hover thành pill xanh nhạt (thay link trần thô) */
.pmh-authcard__back{display:inline-flex;align-items:center;gap:6px;color:#5f716c;font-size:13.5px;font-weight:600;
  background:none;border:none;cursor:pointer;padding:7px 14px;border-radius:999px;
  transition:color .15s ease, background .15s ease;}
.pmh-authcard__back:hover{color:#0E4D45;background:rgba(14,77,69,.07);}
.pmh-authcard__backrow{text-align:center;margin-top:14px;}
@media (max-width:820px){
  .pmh-auth__hero{display:none;}
  .pmh-authcard__brand{display:flex;}
  .pmh-auth__wrap{padding:28px 18px;}
}
@keyframes pmhUp{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:none;}}
@media (prefers-reduced-motion:reduce){.pmh-auth__hero,.pmh-authcard{animation:none;}}
/* Checklist mật khẩu dùng chung (đổi MK bắt buộc + đặt lại MK) — gọn, một bộ icon */
.pmh-checks{display:flex;flex-direction:column;gap:7px;margin:2px 0 18px;}
.pmh-check{display:flex;align-items:center;gap:8px;font-size:13px;line-height:1.3;color:#8a8172;}
.pmh-check .anticon{font-size:14px;color:#c7bfb1;flex:none;}
.pmh-check.is-ok{color:#3f7a54;}
.pmh-check.is-ok .anticon{color:#52c41a;}
`;

/** Checklist quy tắc mật khẩu (dùng chung cho bước đổi MK bắt buộc và màn đặt lại MK). */
function PasswordChecklist({ pw }: { pw: string }) {
  const checks = checkPassword(pw);
  // Chỉ hiện khi người dùng BẮT ĐẦU nhập — tránh "dội" 5 dòng ngay khi mở màn.
  if (pw.length === 0) return null;
  return (
    <div className="pmh-checks">
      {(Object.keys(checks) as (keyof PasswordChecks)[]).map((k) => (
        <div key={k} className={`pmh-check${checks[k] ? " is-ok" : ""}`}>
          {checks[k] ? <CheckCircleFilled /> : <MinusCircleOutlined />}
          <span>{PASSWORD_RULE_LABELS[k]}</span>
        </div>
      ))}
    </div>
  );
}

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
  const [forgot, setForgot] = useState(false);
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
    forgot ? "Quên mật khẩu"
    : step === "change_password" ? "Đổi mật khẩu"
    : step === "mfa" ? "Xác thực 2 lớp"
    : step === "mfa_enroll" ? "Thiết lập bảo mật"
    : "Đăng nhập";

  const showSub = !!clientName && step === "login" && !forgot;
  const form = (
    <>
      <h2 className="pmh-authcard__title" style={{ marginBottom: showSub ? 6 : 22 }}>
        {stepTitle}
      </h2>
      {showSub && (
        <p className="pmh-authcard__sub">
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
          {step === "login" && (forgot
            ? <ForgotForm onBack={() => { setError(null); setForgot(false); }} />
            : <LoginForm loading={loading} onFinish={onLogin} onForgot={() => { setError(null); setForgot(true); }} />)}
          {step === "change_password" && (
            <ChangePasswordForm loading={loading} onFinish={onChangePassword} />
          )}
          {step === "mfa" && <MfaForm loading={loading} onFinish={onMfa} />}
          {step === "mfa_enroll" && <MfaEnrollForm uid={uid} />}
          {(step === "change_password" || step === "mfa") && (
            <div className="pmh-authcard__backrow" style={{ marginTop: 14 }}>
              <button type="button" className="pmh-authcard__back" onClick={() => (window.location.href = "/")}>
                ← Đăng nhập lại
              </button>
            </div>
          )}
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
        <div className="pmh-authcard">
          <div className="pmh-authcard__brand">
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
  onForgot,
}: {
  loading: boolean;
  onFinish: (v: { email: string; password: string }) => void;
  onForgot: () => void;
}) {
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
        <Button type="link" size="small" style={{ padding: 0, height: "auto" }} onClick={onForgot}>
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
      if (res.status >= 300) {
        setErr(res.data?.message ?? "Không gửi được yêu cầu — thử lại sau.");
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
          message="Đã gửi yêu cầu đặt lại mật khẩu"
          description="Mở hộp thư và bấm liên kết để đặt mật khẩu mới."
        />
        <div className="pmh-authcard__backrow" style={{ marginTop: 16 }}>
          <button type="button" className="pmh-authcard__back" onClick={onBack}>← Quay lại đăng nhập</button>
        </div>
      </div>
    );
  }
  return (
    <Form layout="vertical" onFinish={submit} requiredMark={false}>
      <div style={{ color: BRAND.muted, fontSize: 13, marginBottom: 14 }}>
        Nhập email tài khoản — hệ thống gửi liên kết đặt lại mật khẩu qua email.
      </div>
      {err && <Alert type="warning" showIcon message={err} style={{ marginBottom: 12 }} />}
      <Form.Item label="Email" name="email" rules={[{ required: true, type: "email", message: "Email không hợp lệ" }]}>
        <Input size="large" autoFocus prefix={<UserOutlined style={{ color: BRAND.muted }} />} placeholder="ten@pmh.com.vn" />
      </Form.Item>
      <Button type="primary" htmlType="submit" size="large" block loading={busy}>
        Gửi
      </Button>
      <div className="pmh-authcard__backrow">
        <button type="button" className="pmh-authcard__back" onClick={onBack}>← Quay lại đăng nhập</button>
      </div>
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
  const [pw2, setPw2] = useState("");
  const checks = checkPassword(pw);
  const allOk = Object.values(checks).every(Boolean);
  const match = pw.length > 0 && pw === pw2;
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
          size="large"
          autoFocus
          autoComplete="new-password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
        />
      </Form.Item>
      <PasswordChecklist pw={pw} />
      <Form.Item
        label="Nhập lại mật khẩu"
        validateStatus={pw2 && !match ? "error" : undefined}
        help={pw2 && !match ? "Mật khẩu nhập lại không khớp" : undefined}
      >
        <Input.Password
          size="large"
          autoComplete="new-password"
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
        />
      </Form.Item>
      <Button type="primary" htmlType="submit" size="large" block loading={loading} disabled={!allOk || !match}>
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
        <Input
          size="large"
          autoFocus
          autoComplete="one-time-code"
          inputMode={recovery ? "text" : "numeric"}
          aria-label={recovery ? "Recovery code" : "Mã xác thực 6 số"}
          placeholder={recovery ? "XXXXX-XXXXX" : "123456"}
        />
      </Form.Item>
      <Form.Item>
        <Checkbox checked={recovery} onChange={(e) => setRecovery(e.target.checked)}>
          Dùng recovery code thay vì mã TOTP
        </Checkbox>
      </Form.Item>
      <Button type="primary" htmlType="submit" size="large" block loading={loading}>
        Xác thực
      </Button>
    </Form>
  );
}

/** Ép enroll MFA giữa luồng login (vai bắt buộc MFA mà chưa bật). */
function MfaEnrollForm({ uid }: { uid: string }) {
  const [qr, setQr] = useState<string | null>(null);
  const [setupErr, setSetupErr] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recovery, setRecovery] = useState<string[] | null>(null);
  const [redirectTo, setRedirectTo] = useState("");
  const [copied, setCopied] = useState(false);

  const copyRecovery = () => {
    if (!recovery) return;
    navigator.clipboard?.writeText(recovery.join("\n")).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  };
  const downloadRecovery = () => {
    if (!recovery) return;
    const blob = new Blob([recovery.join("\n") + "\n"], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pmh-id-recovery-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Trước đây effect nuốt lỗi (setQr(null) khi 410/lỗi) → màn còn trơ ô nhập
  // không QR, không lời giải thích = ngõ cụt câm. Nay phân biệt lỗi + có lối thoát.
  useEffect(() => {
    let alive = true;
    postJson(`/api/interaction/${uid}/mfa-enroll-setup`, {})
      .then((r) => {
        if (!alive) return;
        if (r.status >= 300 || !r.data?.qr) {
          setSetupErr(
            r.status === 410
              ? "Phiên thiết lập đã hết hạn — vui lòng đăng nhập lại."
              : r.data?.message ?? "Không tạo được mã QR — vui lòng đăng nhập lại.",
          );
          return;
        }
        setQr(r.data.qr);
      })
      .catch(() => alive && setSetupErr("Không kết nối được máy chủ — thử lại sau."));
    return () => { alive = false; };
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
        <Space style={{ marginTop: 10 }}>
          <Button size="small" onClick={copyRecovery}>
            {copied ? "Đã sao chép ✓" : "Sao chép tất cả"}
          </Button>
          <Button size="small" onClick={downloadRecovery}>Tải .txt</Button>
        </Space>
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

  // Setup lỗi → dừng luồng, cho lối đăng nhập lại thay vì để ô nhập vô dụng.
  if (setupErr) {
    return (
      <>
        <Alert type="error" showIcon style={{ marginBottom: 12 }} message={setupErr} />
        <Button block size="large" onClick={() => (window.location.href = "/")}>
          Đăng nhập lại
        </Button>
      </>
    );
  }

  return (
    <Form layout="vertical" onFinish={submit} requiredMark={false}>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="Tài khoản của bạn bắt buộc bật MFA"
        description="Quét QR bằng ứng dụng xác thực (authenticator) rồi nhập mã 6 số."
      />
      {err && <Alert type="error" message={err} style={{ marginBottom: 12 }} showIcon />}
      {qr ? (
        <img
          src={qr}
          alt="Mã QR thiết lập MFA"
          style={{ width: 200, height: 200, display: "block", margin: "0 auto 12px" }}
        />
      ) : (
        <div style={{ height: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 12, color: BRAND.muted }}>
          <Spin />
          <span>Đang tạo mã QR…</span>
        </div>
      )}
      <Form.Item style={{ marginBottom: 12 }}>
        <Input
          size="large"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="123456"
          inputMode="numeric"
          aria-label="Mã xác thực 6 số"
          autoComplete="one-time-code"
        />
      </Form.Item>
      <Button type="primary" htmlType="submit" size="large" block loading={busy} disabled={!code || !qr}>
        Xác nhận bật MFA
      </Button>
    </Form>
  );
}

/**
 * Màn đặt lại mật khẩu qua link (C2). Route công khai /reset-password?token=…
 * (App.tsx render TRƯỚC boot, không cần auth). Đổi token lấy MK mới; token sai/
 * hết hạn → 400 hiện rõ; xong → mời đăng nhập lại.
 */
export function ResetPassword() {
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const checks = checkPassword(pw);
  const allOk = Object.values(checks).every(Boolean);
  const match = pw.length > 0 && pw === pw2;

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await postJson("/api/auth/reset-password", { token, password: pw });
      if (res.status === 429) {
        setErr(`Thử lại sau ${res.data?.retryAfter ?? "ít"} giây.`);
        return;
      }
      if (res.status >= 300) {
        setErr(res.data?.message ?? "Không đặt lại được mật khẩu.");
        return;
      }
      setDone(true);
    } catch {
      setErr("Không kết nối được máy chủ — thử lại sau.");
    } finally {
      setBusy(false);
    }
  };

  const body = !token ? (
    <Alert
      type="error"
      showIcon
      message="Liên kết không hợp lệ"
      description="Thiếu mã đặt lại. Hãy yêu cầu lại từ màn Quên mật khẩu."
    />
  ) : done ? (
    <>
      <Alert
        type="success"
        showIcon
        message="Đã đặt lại mật khẩu"
        description="Mật khẩu mới đã được lưu và mọi phiên cũ đã đăng xuất. Đăng nhập lại để tiếp tục."
      />
      <Button
        type="primary"
        size="large"
        block
        style={{ marginTop: 16 }}
        onClick={() => {
          window.location.href = "/";
        }}
      >
        Đăng nhập
      </Button>
    </>
  ) : (
    <Form layout="vertical" onFinish={submit} requiredMark={false}>
      {err && <Alert type="error" showIcon message={err} style={{ marginBottom: 14 }} />}
      <Form.Item label="Mật khẩu mới">
        <Input.Password
          size="large"
          autoFocus
          autoComplete="new-password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
        />
      </Form.Item>
      <PasswordChecklist pw={pw} />
      <Form.Item
        label="Nhập lại mật khẩu"
        validateStatus={pw2 && !match ? "error" : undefined}
        help={pw2 && !match ? "Mật khẩu nhập lại không khớp" : undefined}
      >
        <Input.Password
          size="large"
          autoComplete="new-password"
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
        />
      </Form.Item>
      <Button
        type="primary"
        htmlType="submit"
        size="large"
        block
        loading={busy}
        disabled={!allOk || !match}
      >
        Đặt mật khẩu mới
      </Button>
    </Form>
  );

  return (
    <div className="pmh-auth">
      <style>{authCss}</style>
      <div className="pmh-auth__bg">
        <div className="pmh-auth__bgi">
          <LoginScene />
        </div>
      </div>
      <div className="pmh-auth__overlay" />
      <div className="pmh-auth__vignette" />
      <div className="pmh-auth__grain" />
      <div className="pmh-auth__wrap">
        <div className="pmh-authcard" style={{ margin: "0 auto" }}>
          <div className="pmh-authcard__brand" style={{ display: "flex" }}>
            <Brand size={28} />
            <span>PMH ID</span>
          </div>
          <h2 className="pmh-authcard__title" style={{ marginBottom: 6 }}>
            Đặt lại mật khẩu
          </h2>
          <p className="pmh-authcard__sub">Chọn mật khẩu mới cho tài khoản của bạn.</p>
          {body}
        </div>
      </div>
    </div>
  );
}
