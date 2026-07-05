import { App as AntApp, Button, Card, Input, Space, Table, Typography } from "antd";
import { useEffect, useState } from "react";
import { api } from "../auth";

const { Title, Paragraph } = Typography;

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
  bruteforce_account_threshold: "Ngưỡng chống dò (số lần)",
  bruteforce_backoff_seconds: "Backoff chống dò tối đa (giây)",
  expiry_warning_days: "Cảnh báo trước hết hạn (ngày)",
  smtp_host: "SMTP host",
  smtp_port: "SMTP port",
  backup_path: "Đường dẫn backup",
  audit_archive_path: "Đường dẫn lưu trữ audit",
  require_mfa_roles: "Vai bắt buộc MFA (phẩy, vd ssa,project_admin)",
};

/** Trang Settings SSA (E6-S5, FR-32): đổi tham số vận hành, áp dụng runtime. */
export default function Settings() {
  const { message } = AntApp.useApp();
  const [rows, setRows] = useState<Setting[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const load = () =>
    api<Setting[]>("/api/admin/settings").then((r) => {
      setRows(r);
      setDraft(Object.fromEntries(r.map((s) => [s.key, s.value])));
    });
  useEffect(() => {
    load();
  }, []);

  const save = async (key: string) => {
    setSavingKey(key);
    try {
      await api("/api/admin/settings", {
        method: "PUT",
        body: { key, value: draft[key] },
      });
      message.success(`Đã lưu ${LABELS[key] ?? key} (áp dụng ngay)`);
      load();
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Title level={3}>Cấu hình hệ thống</Title>
      <Paragraph type="secondary">
        Tham số vận hành áp dụng runtime (không cần khởi động lại). Bí mật SMTP nằm ở .env.
      </Paragraph>
      <Card>
        <Table<Setting>
          rowKey="key"
          dataSource={rows}
          pagination={false}
          size="small"
          columns={[
            { title: "Tham số", dataIndex: "key", render: (k: string) => LABELS[k] ?? k, width: "45%" },
            {
              title: "Giá trị",
              render: (_, s) => (
                <Input
                  value={draft[s.key] ?? ""}
                  onChange={(e) => setDraft({ ...draft, [s.key]: e.target.value })}
                />
              ),
            },
            {
              title: "",
              width: 90,
              render: (_, s) => (
                <Button
                  size="small"
                  type="primary"
                  loading={savingKey === s.key}
                  disabled={draft[s.key] === s.value}
                  onClick={() => save(s.key)}
                >
                  Lưu
                </Button>
              ),
            },
          ]}
        />
      </Card>
    </Space>
  );
}
