import { Alert, Card, Spin, Typography } from "antd";
import { useEffect, useState } from "react";
import { api, ApiError } from "../auth";

const { Title } = Typography;

/**
 * Cổng tài liệu tích hợp (E8-S1). Nội dung do BE trả (gate Developers) — FE chỉ
 * render. Markdown render tối giản (heading/code/list/bold), không kéo thư viện.
 */
export default function Docs() {
  const [md, setMd] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    api<{ content: string }>("/api/docs")
      .then((d) => setMd(d.content))
      .catch((e) => {
        if (e instanceof ApiError && e.status === 403) setDenied(true);
        else setMd("");
      });
  }, []);

  if (denied) {
    return (
      <Alert
        type="warning"
        showIcon
        message="Chỉ nhóm Developers"
        description="Tài liệu tích hợp chỉ dành cho tài khoản thuộc nhóm Developers."
      />
    );
  }
  if (md === null) return <Spin />;

  return (
    <Card>
      <div style={{ maxWidth: 820 }}>{renderMarkdown(md)}</div>
    </Card>
  );
}

/** Render markdown tối giản → React nodes (đủ cho tài liệu tích hợp). */
function renderMarkdown(src: string) {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const out: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  const inline = (t: string) =>
    t.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((seg, k) => {
      if (seg.startsWith("`") && seg.endsWith("`"))
        return (
          <code key={k} style={{ background: "#f2f2f2", padding: "1px 5px", borderRadius: 4 }}>
            {seg.slice(1, -1)}
          </code>
        );
      if (seg.startsWith("**") && seg.endsWith("**"))
        return <strong key={k}>{seg.slice(2, -2)}</strong>;
      return <span key={k}>{seg}</span>;
    });

  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("```")) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) buf.push(lines[i++]);
      i++;
      out.push(
        <pre key={key++} style={{ background: "#1e1e1e", color: "#e6e6e6", padding: 14, borderRadius: 6, overflowX: "auto" }}>
          {buf.join("\n")}
        </pre>,
      );
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const lvl = h[1].length;
      out.push(
        <Title key={key++} level={(lvl + 1) as 2 | 3 | 4 | 5} style={{ marginTop: lvl <= 2 ? 24 : 16 }}>
          {inline(h[2])}
        </Title>,
      );
      i++;
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) items.push(lines[i++].replace(/^[-*]\s+/, ""));
      out.push(
        <ul key={key++}>
          {items.map((it, k) => (
            <li key={k}>{inline(it)}</li>
          ))}
        </ul>,
      );
      continue;
    }
    if (line.trim() === "" || line.trim() === "---") {
      i++;
      continue;
    }
    out.push(
      <p key={key++} style={{ lineHeight: 1.7 }}>
        {inline(line)}
      </p>,
    );
    i++;
  }
  return out;
}
