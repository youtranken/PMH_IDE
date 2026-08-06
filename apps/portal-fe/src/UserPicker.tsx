import { Select } from "antd";
import { useEffect, useRef, useState } from "react";
import { api } from "./auth";

interface PickUser {
  id: string;
  full_name: string;
  email: string;
  department?: string;
  deleted_at?: string | null;
}

/**
 * Chọn người dùng có TÌM-KIẾM SERVER (debounce) — thay cho các Select tải sẵn 500
 * rồi lọc client (người thứ 501 trở đi biến mất không dấu vết). Gõ → gọi
 * /api/admin/users?q=; rỗng → 500 mới nhất. Loại người đã có (excludeIds) + đã xóa.
 */
export function UserPicker({
  value,
  onChange,
  mode,
  placeholder,
  excludeIds,
  style,
  disabled,
}: {
  value: string[] | undefined;
  onChange: (v: string[]) => void;
  mode?: "multiple";
  placeholder?: string;
  excludeIds?: string[];
  style?: React.CSSProperties;
  disabled?: boolean;
}) {
  const [opts, setOpts] = useState<PickUser[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const run = (q: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setLoading(true);
      const qs = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
      api<PickUser[]>(`/api/admin/users${qs}`)
        .then((r) => setOpts(r.filter((u) => !u.deleted_at)))
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 300);
  };
  // Nạp lần đầu (500 mới nhất) để có gợi ý ngay khi chưa gõ.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { run(""); }, []);

  const exclude = new Set(excludeIds ?? []);
  const options = opts
    .filter((u) => !exclude.has(u.id))
    .map((u) => ({
      value: u.id,
      label: `${u.full_name} · ${u.email}${u.department ? ` · ${u.department}` : ""}`,
    }));

  return (
    <Select
      mode={mode}
      showSearch
      filterOption={false}
      onSearch={run}
      loading={loading}
      value={value}
      onChange={(v) => onChange((v ?? []) as string[])}
      placeholder={placeholder}
      options={options}
      style={style}
      disabled={disabled}
      maxTagCount="responsive"
      notFoundContent={loading ? "Đang tìm…" : "Gõ tên/email/mã NV để tìm"}
    />
  );
}
