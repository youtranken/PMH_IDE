import {
  CheckCircleFilled,
  DesktopOutlined,
  LockOutlined,
  MinusCircleOutlined,
  MobileOutlined,
  QrcodeOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import {
  Alert,
  App as AntApp,
  Avatar,
  Button,
  Input,
  Popconfirm,
  Tag,
  Typography,
} from "antd";
import { useEffect, useState, type ReactNode } from "react";
import {
  checkPassword,
  PASSWORD_RULE_LABELS,
  type PasswordChecks,
} from "@pmh/shared";
import { api, logout } from "../auth";
import { BRAND, deviceName, initials, PageHeader, relativeTime } from "../ui";
import type { Profile } from "../App";

const { Text } = Typography;

interface Session {
  oidc_session_uid: string;
  ip: string | null;
  user_agent: string | null;
  last_activity: string;
  created_at: string;
  is_current: boolean;
}

const isMobileUA = (ua: string | null) => /Mobile|Android|iPhone|iPad/i.test(ua ?? "");

/* ---- Khối dựng dùng chung (thay Card mặc định để kiểm soát bố cục) ---- */

function Panel({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid var(--pmh-card-border)",
        borderRadius: "var(--pmh-card-radius)",
        boxShadow: "var(--pmh-card-shadow)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: 0.7,
        textTransform: "uppercase",
        color: BRAND.muted,
        margin: "26px 4px 12px",
      }}
    >
      {children}
    </div>
  );
}

function IconTile({ children, tone = "green" }: { children: ReactNode; tone?: "green" | "gold" }) {
  return (
    <span
      style={{
        width: 40,
        height: 40,
        flex: "0 0 auto",
        borderRadius: 11,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 18,
        background: tone === "gold" ? "#f6efdc" : "#e8f0ed",
        color: tone === "gold" ? BRAND.gold : BRAND.green,
      }}
    >
      {children}
    </span>
  );
}

/** Hàng bảo mật: icon + tiêu đề/mô tả + phần bên phải, thân bung inline. */
function SecurityRow({
  icon,
  tone,
  title,
  desc,
  right,
  children,
}: {
  icon: ReactNode;
  tone?: "green" | "gold";
  title: string;
  desc: string;
  right?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Panel style={{ padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <IconTile tone={tone}>{icon}</IconTile>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 15, color: BRAND.ink }}>{title}</div>
          <div style={{ color: BRAND.muted, fontSize: 13, marginTop: 1 }}>{desc}</div>
        </div>
        {right && <div style={{ display: "flex", alignItems: "center", gap: 10 }}>{right}</div>}
      </div>
      {children && (
        <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid #f0f2f0" }}>{children}</div>
      )}
    </Panel>
  );
}

/** Bật/tắt MFA TOTP tự phục vụ (phase sau — mọi user). */
function MfaCard() {
  const { message } = AntApp.useApp();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [setup, setSetup] = useState<{ qr: string } | null>(null);
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState<string[] | null>(null);
  const [disabling, setDisabling] = useState(false);
  const [busy, setBusy] = useState(false);

  // Lỗi probe → hiện lỗi + coi như CHƯA bật (để còn nút bật), không kẹt trắng câm.
  const load = () =>
    api<{ enabled: boolean }>("/api/me/mfa")
      .then((s) => setEnabled(s.enabled))
      .catch((e) => { setEnabled(false); message.error(`Không kiểm tra được trạng thái MFA: ${(e as Error).message}`); });
  useEffect(() => {
    load();
  }, []);

  const begin = async () => {
    setBusy(true);
    try {
      setSetup(await api<{ otpauth: string; qr: string }>("/api/me/mfa/setup", { method: "POST" }));
    } catch (e) {
      message.error(`Không bắt đầu được thiết lập MFA: ${(e as Error).message}`);
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

  const active = !!setup || disabling || !!recovery;
  const right =
    enabled === null ? null : active ? (
      recovery ? null : (
        <Button
          type="text"
          onClick={() => {
            setSetup(null);
            setDisabling(false);
            setCode("");
          }}
        >
          Hủy
        </Button>
      )
    ) : enabled ? (
      <>
        <Tag color="green" style={{ marginInlineEnd: 0 }}>Đang bật</Tag>
        <Button danger onClick={() => setDisabling(true)}>Tắt</Button>
      </>
    ) : (
      <>
        <Tag style={{ marginInlineEnd: 0 }}>Chưa bật</Tag>
        <Button type="primary" loading={busy} onClick={begin}>Bật MFA</Button>
      </>
    );

  return (
    <SecurityRow
      icon={<SafetyCertificateOutlined />}
      tone="gold"
      title="Xác thực 2 lớp (MFA)"
      desc="Thêm một lớp mã OTP một lần mỗi khi đăng nhập."
      right={right}
    >
      {recovery ? (
        <>
          <Alert
            type="success"
            showIcon
            style={{ marginBottom: 12 }}
            message="Đã bật MFA — lưu recovery codes ngay (chỉ hiện một lần)"
            description="Dùng khi mất thiết bị. Mỗi mã dùng một lần."
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
              gap: 8,
              fontFamily: "ui-monospace, monospace",
            }}
          >
            {recovery.map((c) => (
              <div
                key={c}
                style={{
                  padding: "8px 12px",
                  background: BRAND.stone,
                  borderRadius: 8,
                  textAlign: "center",
                  letterSpacing: 1,
                }}
              >
                {c}
              </div>
            ))}
          </div>
          <Button style={{ marginTop: 14 }} onClick={() => setRecovery(null)}>
            Đã lưu, đóng
          </Button>
        </>
      ) : setup ? (
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
          <img
            src={setup.qr}
            alt="Mã QR thiết lập MFA"
            style={{ width: 176, height: 176, border: "1px solid #eceeec", borderRadius: 12, padding: 6 }}
          />
          <div style={{ flex: 1, minWidth: 220, maxWidth: 320 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Quét bằng app authenticator</div>
            <Text type="secondary" style={{ display: "block", marginBottom: 14 }}>
              Google Authenticator, Microsoft Authenticator… rồi nhập mã 6 số để xác nhận.
            </Text>
            <Input
              size="large"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123 456"
              autoComplete="one-time-code"
              prefix={<QrcodeOutlined style={{ color: BRAND.muted }} />}
            />
            <Button
              type="primary"
              block
              style={{ marginTop: 12 }}
              loading={busy}
              disabled={!code}
              onClick={confirm}
            >
              Xác nhận bật MFA
            </Button>
          </div>
        </div>
      ) : disabling ? (
        <div style={{ maxWidth: 340 }}>
          <Text type="secondary" style={{ display: "block", marginBottom: 10 }}>
            Nhập mã TOTP hiện tại (hoặc một recovery code) để tắt.
          </Text>
          <Input
            size="large"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123 456"
          />
          <Button danger block style={{ marginTop: 12 }} loading={busy} disabled={!code} onClick={disable}>
            Tắt MFA
          </Button>
        </div>
      ) : null}
    </SecurityRow>
  );
}

function ChangePassword() {
  const { message } = AntApp.useApp();
  const [open, setOpen] = useState(false);
  const [curPw, setCurPw] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [saving, setSaving] = useState(false);
  const checks = checkPassword(pw);
  const allOk = Object.values(checks).every(Boolean);
  const mismatch = pw2.length > 0 && pw !== pw2;

  const changePassword = async () => {
    setSaving(true);
    try {
      const r = await api<{ revoked: number }>("/api/me/change-password", {
        method: "POST",
        body: { currentPassword: curPw, newPassword: pw },
      });
      setPw("");
      setPw2("");
      setCurPw("");
      setOpen(false);
      message.success(`Đã đổi mật khẩu — hủy ${r.revoked} phiên khác, giữ phiên hiện tại`);
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SecurityRow
      icon={<LockOutlined />}
      title="Mật khẩu"
      desc="Đổi định kỳ để giữ tài khoản an toàn."
      right={
        open ? (
          <Button type="text" onClick={() => setOpen(false)}>Hủy</Button>
        ) : (
          <Button onClick={() => setOpen(true)}>Đổi mật khẩu</Button>
        )
      }
    >
      {open && (
        <div style={{ maxWidth: 380 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: BRAND.ink }}>Mật khẩu hiện tại</label>
          <Input.Password
            aria-label="Mật khẩu hiện tại"
            size="large"
            style={{ margin: "6px 0 14px" }}
            value={curPw}
            autoComplete="current-password"
            onChange={(e) => setCurPw(e.target.value)}
          />
          <label style={{ fontSize: 13, fontWeight: 600, color: BRAND.ink }}>Mật khẩu mới</label>
          <Input.Password
            aria-label="Mật khẩu mới"
            size="large"
            style={{ margin: "6px 0 14px" }}
            value={pw}
            autoComplete="new-password"
            onChange={(e) => setPw(e.target.value)}
          />
          <label style={{ fontSize: 13, fontWeight: 600, color: BRAND.ink }}>Xác nhận mật khẩu mới</label>
          <Input.Password
            aria-label="Xác nhận mật khẩu mới"
            size="large"
            status={mismatch ? "error" : undefined}
            style={{ margin: "6px 0 6px" }}
            value={pw2}
            autoComplete="new-password"
            onChange={(e) => setPw2(e.target.value)}
            onPressEnter={() => allOk && curPw && !mismatch && pw2 && changePassword()}
          />
          {mismatch && (
            <div style={{ color: "var(--pmh-danger)", fontSize: 13, marginBottom: 12 }}>
              Mật khẩu nhập lại chưa khớp.
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 7, margin: "12px 0 18px" }}>
            {(Object.keys(checks) as (keyof PasswordChecks)[]).map((k) => (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                {checks[k] ? (
                  <CheckCircleFilled style={{ color: BRAND.green }} />
                ) : (
                  <MinusCircleOutlined style={{ color: "#c4ccc9" }} />
                )}
                <span style={{ color: checks[k] ? BRAND.ink : BRAND.muted }}>
                  {PASSWORD_RULE_LABELS[k]}
                </span>
              </div>
            ))}
          </div>
          <Button type="primary" disabled={!allOk || !curPw || !pw2 || mismatch} loading={saving} onClick={changePassword}>
            Cập nhật mật khẩu
          </Button>
        </div>
      )}
    </SecurityRow>
  );
}

/** Self-service (E6-S2, FR-10/05): thông tin + group, quản phiên, MFA, đổi mật khẩu. */
export default function SelfService({ profile, embedded }: { profile: Profile; onProfile: (p: Profile) => void; embedded?: boolean }) {
  const { message } = AntApp.useApp();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessErr, setSessErr] = useState<string | null>(null);

  const loadSessions = () =>
    api<Session[]>("/api/me/sessions")
      .then((s) => { setSessions(s); setSessErr(null); })
      .catch((e) => setSessErr((e as Error).message));
  useEffect(() => {
    loadSessions();
  }, []);

  const revoke = async (uid: string) => {
    await api(`/api/me/sessions/${uid}/revoke`, { method: "POST" });
    message.success("Đã đăng xuất phiên");
    loadSessions();
  };

  return (
    <div style={embedded ? { width: "100%" } : { maxWidth: 780, margin: "0 auto", width: "100%" }}>
      {/* embedded = mở trong Drawer popup (đã có tiêu đề Drawer) → bỏ tiêu đề trang. */}
      {!embedded && (
        <PageHeader title="Tài khoản" sub="Quản lý thông tin cá nhân và bảo mật đăng nhập." />
      )}

      {/* Identity hero */}
      <Panel style={{ padding: 24, display: "flex", alignItems: "center", gap: 18, marginTop: embedded ? 0 : 16 }}>
        <Avatar size={64} style={{ background: BRAND.green, fontSize: 24, fontWeight: 700, flex: "0 0 auto" }}>
          {initials(profile.full_name)}
        </Avatar>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: BRAND.ink }}>{profile.full_name}</div>
          <div style={{ color: BRAND.muted }}>{profile.email}</div>
          <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
            <Tag color="green" style={{ marginInlineEnd: 0 }}>NV: {profile.employee_code}</Tag>
            {profile.groups.map((g) => (
              <Tag key={g} style={{ marginInlineEnd: 0 }}>{g}</Tag>
            ))}
          </div>
        </div>
      </Panel>

      {/* Bảo mật */}
      <SectionLabel>Bảo mật</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <MfaCard />
        <ChangePassword />
      </div>

      {/* Thiết bị */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <SectionLabel>Thiết bị đăng nhập</SectionLabel>
        <Popconfirm
          title="Đăng xuất khỏi TẤT CẢ thiết bị (kể cả hiện tại)?"
          onConfirm={async () => {
            await api("/api/me/logout-all", { method: "POST" });
            logout();
          }}
        >
          <Button size="small" danger type="text">Đăng xuất mọi thiết bị</Button>
        </Popconfirm>
      </div>
      <Panel>
        {sessions.length === 0 && (
          <div style={{ padding: 20, color: BRAND.muted }}>
            {sessErr ? (
              <>
                Không tải được danh sách phiên.{" "}
                <Button type="link" size="small" style={{ padding: 0 }} onClick={loadSessions}>Thử lại</Button>
              </>
            ) : (
              "Chưa có phiên nào."
            )}
          </div>
        )}
        {/* Chỉ hiện 5 phiên MỚI NHẤT — phiên cũ nhiều thì không liệt kê hết. */}
        {[...sessions]
          .sort((a, b) => +new Date(b.last_activity) - +new Date(a.last_activity))
          .slice(0, 5)
          .map((s, i) => (
          <div
            key={s.oidc_session_uid}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "16px 20px",
              borderTop: i ? "1px solid #f0f2f0" : "none",
            }}
          >
            <IconTile>{isMobileUA(s.user_agent) ? <MobileOutlined /> : <DesktopOutlined />}</IconTile>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, color: BRAND.ink }}>
                {deviceName(s.user_agent)}
                {s.is_current && <Tag color="green" style={{ marginLeft: 8 }}>Thiết bị này</Tag>}
              </div>
              <div style={{ color: BRAND.muted, fontSize: 13, marginTop: 1 }}>
                {(s.ip ?? "—") + " · " + relativeTime(s.last_activity)}
              </div>
            </div>
            {s.is_current ? (
              <Text type="secondary" style={{ fontSize: 12 }}>đang dùng</Text>
            ) : (
              <Popconfirm title="Đăng xuất phiên này?" onConfirm={() => revoke(s.oidc_session_uid)}>
                <Button size="small" danger>Đăng xuất</Button>
              </Popconfirm>
            )}
          </div>
        ))}
      </Panel>
      {sessions.length > 5 && (
        <div style={{ color: BRAND.muted, fontSize: 12.5, marginTop: 8 }}>
          Hiển thị 5 phiên mới nhất · {sessions.length - 5} phiên cũ hơn sẽ tự hết hạn.
        </div>
      )}
    </div>
  );
}
