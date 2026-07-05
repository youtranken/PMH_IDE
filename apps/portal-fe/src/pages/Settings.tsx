import {
  ApiOutlined,
  ClockCircleOutlined,
  DatabaseOutlined,
  LockOutlined,
  MailOutlined,
  SafetyCertificateOutlined,
  SafetyOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { App as AntApp, Button, Card, Input, Skeleton, Typography } from "antd";
import { useEffect, useState, type ReactNode } from "react";
import { api } from "../auth";
import { BRAND } from "../ui";

const { Title, Text } = Typography;

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
  backup_path: "Đường dẫn backup",
  audit_archive_path: "Đường dẫn lưu trữ audit",
  require_mfa_roles: "Vai bắt buộc MFA (phẩy, vd ssa,project_admin)",
};

/** Gom tham số thành nhóm có nghĩa thay vì một bảng phẳng. */
const GROUPS: { title: string; icon: ReactNode; keys: string[] }[] = [
  { title: "Phiên & Token", icon: <ClockCircleOutlined />, keys: ["access_token_ttl_seconds", "session_idle_seconds", "session_absolute_cap_seconds"] },
  { title: "Mật khẩu", icon: <LockOutlined />, keys: ["password_min_length", "password_max_age_days", "temp_password_ttl_hours"] },
  { title: "Chống dò mật khẩu", icon: <SafetyOutlined />, keys: ["bruteforce_account_threshold", "bruteforce_ip_threshold", "bruteforce_backoff_seconds"] },
  { title: "Xác thực 2 lớp", icon: <SafetyCertificateOutlined />, keys: ["require_mfa_roles"] },
  { title: "Client & tích hợp", icon: <ApiOutlined />, keys: ["client_secret_grace_hours"] },
  { title: "Email & cảnh báo", icon: <MailOutlined />, keys: ["smtp_host", "smtp_port", "expiry_warning_days"] },
  { title: "Vận hành & lưu trữ", icon: <DatabaseOutlined />, keys: ["backup_path", "audit_archive_path"] },
];

const WIDE_KEYS = new Set(["smtp_host", "backup_path", "audit_archive_path", "require_mfa_roles"]);

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
        background: "#e8f0ed",
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

  const load = () =>
    api<Setting[]>("/api/admin/settings")
      .then((r) => {
        setRows(r);
        setDraft(Object.fromEntries(r.map((s) => [s.key, s.value])));
      })
      .finally(() => setLoading(false));
  useEffect(() => {
    load();
  }, []);

  const save = async (key: string) => {
    setSavingKey(key);
    try {
      await api("/api/admin/settings", { method: "PUT", body: { key, value: draft[key] } });
      message.success(`Đã lưu ${LABELS[key] ?? key} (áp dụng ngay)`);
      load();
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
    const changed = draft[key] !== s.value;
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
          <div style={{ fontWeight: 500, color: BRAND.ink }}>{LABELS[key] ?? key}</div>
          <code style={{ fontSize: 12, color: BRAND.muted }}>{key}</code>
        </div>
        <Input
          value={draft[key] ?? ""}
          onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
          onPressEnter={() => changed && save(key)}
          style={{ width: WIDE_KEYS.has(key) ? 300 : 150, flex: "0 0 auto" }}
        />
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
    <div style={{ maxWidth: 860, margin: "0 auto", width: "100%" }}>
      <Title level={3} style={{ marginBottom: 2 }}>Cấu hình hệ thống</Title>
      <Text type="secondary" style={{ display: "block", marginBottom: 20 }}>
        Tham số vận hành áp dụng ngay (không cần khởi động lại). Bí mật SMTP nằm ở .env.
      </Text>

      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {[0, 1, 2].map((i) => (
            <Card key={i}>
              <Skeleton active paragraph={{ rows: 3 }} title={{ width: "30%" }} />
            </Card>
          ))}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {!loading && groups.map((g) => (
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
