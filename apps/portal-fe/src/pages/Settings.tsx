import {
  ApiOutlined,
  ClockCircleOutlined,
  DatabaseOutlined,
  LockOutlined,
  MailOutlined,
  QuestionCircleOutlined,
  SafetyCertificateOutlined,
  SafetyOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { App as AntApp, Button, Card, Input, Skeleton, Tooltip } from "antd";
import { useEffect, useState, type ReactNode } from "react";
import { api } from "../auth";
import { BRAND, ListEmpty, PageHeader } from "../ui";

interface Setting {
  key: string;
  value: string;
}

/** Nhãn tiếng Việt cho tham số (E6-S5). Key nào không có → hiện raw key. */
const LABELS: Record<string, string> = {
  access_token_ttl_seconds: "TTL access token (giây)",
  session_idle_seconds: "Idle timeout phiên (giây)",
  session_absolute_cap_seconds: "Trần tuyệt đối phiên (giây)",
  password_min_length: "Độ dài mật khẩu tối thiểu",
  password_max_age_days: "Chu kỳ đổi mật khẩu (ngày)",
  temp_password_ttl_hours: "Hạn mật khẩu tạm (giờ)",
  client_secret_grace_hours: "Ân hạn rotate client_secret (giờ)",
  bruteforce_account_threshold: "Ngưỡng chống dò / account (số lần)",
  bruteforce_ip_threshold: "Ngưỡng chống dò / IP (số lần)",
  bruteforce_backoff_seconds: "Backoff chống dò tối đa (giây)",
  expiry_warning_days: "Cảnh báo trước hết hạn (ngày)",
  smtp_host: "SMTP host",
  smtp_port: "SMTP port",
  smtp_user: "SMTP user (địa chỉ email gửi)",
  smtp_password: "SMTP mật khẩu (Gmail: app password)",
  smtp_from: "Địa chỉ From (vd: PMH ID <no-reply@pmh.com.vn>)",
  backup_path: "Đường dẫn backup",
  audit_archive_path: "Đường dẫn lưu trữ audit",
  require_mfa_roles: "Vai bắt buộc MFA (phẩy, vd ssa,project_admin)",
};

/** Giải thích tính năng (hiện khi hover ?) — để SSA hiểu tham số làm gì trước khi đổi. */
const HELP: Record<string, string> = {
  access_token_ttl_seconds:
    "Access token (JWT) sống bao lâu trước khi hết hạn. Khi còn thao tác, ứng dụng tự xin token mới bằng refresh token — người dùng KHÔNG bị đá ra. Ngắn = an toàn hơn (token lộ mau hết hiệu lực); dài = ít gọi lại /token. Mặc định 300s (5 phút).",
  session_idle_seconds:
    "Phiên đăng nhập chung (SSO) tự hết sau ngần này nếu người dùng không đăng nhập lại. Hết phiên → lần gia hạn token kế thất bại → phải đăng nhập lại. Đây là 'tự logout khi rảnh'. Mặc định 900s (15 phút).",
  session_absolute_cap_seconds:
    "Trần cứng của một phiên tính từ lúc đăng nhập. Đến hạn là buộc đăng nhập lại DÙ đang thao tác — chặn phiên sống vô hạn. Mặc định 43200s (12 giờ).",
  password_min_length: "Số ký tự tối thiểu của mật khẩu người dùng (chính sách còn yêu cầu đủ loại chữ/số/ký hiệu).",
  password_max_age_days: "Sau bao nhiêu ngày thì buộc người dùng đổi mật khẩu.",
  temp_password_ttl_hours: "Mật khẩu tạm (admin cấp khi reset) hết hiệu lực sau bao nhiêu giờ nếu chưa dùng để đổi.",
  client_secret_grace_hours: "Khi xoay (rotate) client_secret, secret CŨ vẫn dùng được thêm ngần này để ứng dụng kịp cập nhật, không gián đoạn đăng nhập.",
  bruteforce_account_threshold: "Số lần đăng nhập sai liên tiếp trên MỘT tài khoản trước khi hệ thống bắt đầu làm chậm (backoff).",
  bruteforce_ip_threshold: "Số lần sai liên tiếp từ MỘT địa chỉ IP (gồm cả gọi /token) trước khi bị làm chậm.",
  bruteforce_backoff_seconds: "Thời gian chờ tối đa bị áp khi vượt ngưỡng dò mật khẩu.",
  expiry_warning_days: "Gửi email nhắc trước khi tài khoản hết hạn bao nhiêu ngày.",
  smtp_host: "Máy chủ gửi email. Gmail: smtp.gmail.com.",
  smtp_port: "Cổng SMTP. Gmail: 587 (STARTTLS) hoặc 465 (SSL). Mailpit dev: 1025.",
  smtp_user: "Tài khoản đăng nhập SMTP — thường là địa chỉ Gmail gửi thư.",
  smtp_password:
    "Với Gmail PHẢI dùng 'App password' (16 ký tự) sinh ở Google Account → Bảo mật → Xác minh 2 bước → Mật khẩu ứng dụng — KHÔNG dùng mật khẩu Gmail thường. Lưu mã hóa; nhập để đổi, để trống = giữ nguyên.",
  smtp_from:
    "Địa chỉ hiển thị ở mục From. Gmail yêu cầu khớp tài khoản gửi (hoặc alias đã xác minh).",
  backup_path: "Thư mục lưu bản sao lưu đã mã hóa (pg_dump + .env + khóa ký).",
  audit_archive_path: "Thư mục lưu nhật ký audit đã nén theo tháng để đối soát lâu dài.",
  require_mfa_roles: "Vai trò bắt buộc bật xác thực 2 lớp (TOTP), phân tách bằng dấu phẩy — vd: ssa hoặc ssa,project_admin.",
};

/** Gom tham số thành nhóm có nghĩa thay vì một bảng phẳng. */
const GROUPS: { title: string; icon: ReactNode; keys: string[] }[] = [
  { title: "Phiên & Token", icon: <ClockCircleOutlined />, keys: ["access_token_ttl_seconds", "session_idle_seconds", "session_absolute_cap_seconds"] },
  { title: "Mật khẩu", icon: <LockOutlined />, keys: ["password_min_length", "password_max_age_days", "temp_password_ttl_hours"] },
  { title: "Chống dò mật khẩu", icon: <SafetyOutlined />, keys: ["bruteforce_account_threshold", "bruteforce_ip_threshold", "bruteforce_backoff_seconds"] },
  { title: "Xác thực 2 lớp", icon: <SafetyCertificateOutlined />, keys: ["require_mfa_roles"] },
  { title: "Client & tích hợp", icon: <ApiOutlined />, keys: ["client_secret_grace_hours"] },
  { title: "Email & cảnh báo", icon: <MailOutlined />, keys: ["smtp_host", "smtp_port", "smtp_user", "smtp_password", "smtp_from", "expiry_warning_days"] },
  { title: "Vận hành & lưu trữ", icon: <DatabaseOutlined />, keys: ["backup_path", "audit_archive_path"] },
];

const WIDE_KEYS = new Set(["smtp_host", "smtp_user", "smtp_from", "backup_path", "audit_archive_path", "require_mfa_roles"]);
// Ô bí mật: render password, write-only. Backend trả sentinel "__SET__" khi đã
// đặt (không lộ giá trị); gửi lại sentinel = giữ nguyên.
const SECRET_KEYS = new Set(["smtp_password"]);
const SECRET_SET = "__SET__";

function GroupIcon({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        width: 32,
        height: 32,
        borderRadius: 9,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--a-chip)",
        color: BRAND.green,
        fontSize: 15,
      }}
    >
      {children}
    </span>
  );
}

/** Trang Settings SSA (E6-S5, FR-32): đổi tham số vận hành, áp dụng runtime. */
export default function Settings() {
  const { message } = AntApp.useApp();
  const [rows, setRows] = useState<Setting[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api<Setting[]>("/api/admin/settings")
      .then((r) => {
        setError(null);
        setRows(r);
        // Ô bí mật luôn khởi tạo RỖNG (không đổ sentinel vào input) → người dùng
        // nhập mới để đổi, để trống thì không gửi.
        setDraft(
          Object.fromEntries(
            r.map((s) => [s.key, SECRET_KEYS.has(s.key) ? "" : s.value]),
          ),
        );
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, []);

  const save = async (key: string) => {
    setSavingKey(key);
    try {
      await api("/api/admin/settings", { method: "PUT", body: { key, value: draft[key] } });
      message.success(`Đã lưu ${LABELS[key] ?? key} (áp dụng ngay)`);
      // CHỈ cập nhật đúng key vừa lưu — KHÔNG load() lại toàn bộ (trước đây load()
      // đổ draft mới cho MỌI key → nuốt các ô khác admin đang gõ dở). Secret: sau
      // khi lưu, giá trị server thành sentinel "đã đặt" và ô nhập về rỗng.
      const isSecret = SECRET_KEYS.has(key);
      setRows((rs) => rs.map((s) => (s.key === key ? { ...s, value: isSecret ? SECRET_SET : draft[key] } : s)));
      if (isSecret) setDraft((d) => ({ ...d, [key]: "" }));
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setSavingKey(null);
    }
  };

  const byKey = Object.fromEntries(rows.map((s) => [s.key, s]));
  const known = new Set(GROUPS.flatMap((g) => g.keys));
  const leftover = rows.filter((s) => !known.has(s.key)).map((s) => s.key);
  const groups = leftover.length
    ? [...GROUPS, { title: "Khác", icon: <SettingOutlined />, keys: leftover }]
    : GROUPS;

  const Row = (key: string, isLast: boolean) => {
    const s = byKey[key];
    if (!s) return null;
    const isSecret = SECRET_KEYS.has(key);
    // Secret: "đổi" khi người dùng gõ gì đó (draft khởi tạo rỗng). Thường: khác giá trị cũ.
    const changed = isSecret ? (draft[key] ?? "").length > 0 : draft[key] !== s.value;
    const secretIsSet = isSecret && s.value === SECRET_SET;
    return (
      <div
        key={key}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "14px 0",
          borderBottom: isLast ? "none" : "1px solid #f0f2f0",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: "1 1 240px", minWidth: 0 }}>
          <div style={{ fontWeight: 500, color: BRAND.ink }}>
            {LABELS[key] ?? key}
            {HELP[key] && (
              <Tooltip title={HELP[key]}>
                <QuestionCircleOutlined style={{ marginLeft: 6, color: BRAND.muted, fontSize: 13, cursor: "help" }} />
              </Tooltip>
            )}
          </div>
          <code style={{ fontSize: 12, color: BRAND.muted }}>{key}</code>
        </div>
        {isSecret ? (
          <Input.Password
            value={draft[key] ?? ""}
            placeholder={secretIsSet ? "•••• đã đặt — nhập để đổi" : "chưa đặt"}
            autoComplete="new-password"
            onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
            onPressEnter={() => changed && save(key)}
            style={{ width: 300, flex: "0 0 auto" }}
          />
        ) : (
          <Input
            value={draft[key] ?? ""}
            onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
            onPressEnter={() => changed && save(key)}
            style={{ width: WIDE_KEYS.has(key) ? 300 : 150, flex: "0 0 auto" }}
          />
        )}
        <Button
          type="primary"
          loading={savingKey === key}
          disabled={!changed}
          onClick={() => save(key)}
        >
          Lưu
        </Button>
      </div>
    );
  };

  return (
    <div>
      <PageHeader
        title="Cấu hình hệ thống"
        sub="Tham số vận hành áp dụng ngay (không cần khởi động lại). Mật khẩu SMTP lưu mã hóa, chỉ nhập được — không hiển thị lại."
      />

      {loading && (
        <div className="pmh-set-grid">
          {[0, 1, 2].map((i) => (
            <Card key={i}>
              <Skeleton active paragraph={{ rows: 3 }} title={{ width: "30%" }} />
            </Card>
          ))}
        </div>
      )}
      {!loading && error && (
        <ListEmpty error={error} onRetry={load} description="" />
      )}
      <div className="pmh-set-grid">
        {!loading && !error && groups.map((g) => (
          <Card
            key={g.title}
            styles={{ body: { padding: "8px 20px 12px" } }}
            title={
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <GroupIcon>{g.icon}</GroupIcon>
                <span>{g.title}</span>
              </div>
            }
          >
            {g.keys.map((k, i) => Row(k, i === g.keys.length - 1))}
          </Card>
        ))}
      </div>
    </div>
  );
}
