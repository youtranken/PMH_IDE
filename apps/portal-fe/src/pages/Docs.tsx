import { Alert, Skeleton, Typography } from "antd";
import { useEffect, useState } from "react";
import { api, ApiError } from "../auth";
import { BRAND, PageHeader } from "../ui";

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
  if (md === null)
    return (
      // Cùng bề rộng 1040 với nội dung thật → không nhảy layout khi tải xong.
      <div style={{ maxWidth: 1040, margin: "0 auto" }}>
        <Skeleton active paragraph={{ rows: 10 }} title={{ width: "40%" }} />
      </div>
    );
  if (md === "")
    return (
      <Alert
        type="error"
        showIcon
        message="Không tải được tài liệu"
        description="Có lỗi khi tải nội dung. Thử tải lại trang, hoặc liên hệ quản trị nếu vẫn lỗi."
      />
    );

  const { nodes, toc } = renderMarkdown(md);

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", width: "100%" }}>
      <PageHeader
        title="Tài liệu tích hợp"
        sub="Hướng dẫn kết nối ứng dụng với PMH ID (OIDC, Directory API, webhook)."
      />

      <div style={{ display: "flex", gap: 28, alignItems: "flex-start" }}>
        <article
          style={{
            flex: 1,
            minWidth: 0,
            background: "#fff",
            border: "1px solid #eceeec",
            borderRadius: 14,
            boxShadow: "0 1px 2px rgba(16,33,31,.04), 0 8px 24px rgba(16,33,31,.05)",
            padding: "12px 32px 28px",
          }}
        >
          {nodes}
        </article>

        {toc.length > 1 && (
          <nav className="pmh-toc">
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: BRAND.muted, marginBottom: 10 }}>
              Mục lục
            </div>
            {toc.map((t) => (
              <a
                key={t.id}
                href={`#${t.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(t.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                style={{
                  display: "block",
                  padding: "5px 0 5px " + (t.level === 2 ? 14 : 0) + "px",
                  color: t.level === 2 ? BRAND.muted : BRAND.ink,
                  fontSize: 13.5,
                  fontWeight: t.level === 2 ? 400 : 600,
                  lineHeight: 1.4,
                }}
              >
                {t.text}
              </a>
            ))}
          </nav>
        )}
      </div>

      <style>{`.pmh-toc{position:sticky;top:24px;width:220px;flex:0 0 220px;max-height:calc(100vh - 48px);overflow:auto;}
        .pmh-toc a:hover{color:${BRAND.green} !important;}
        @media (max-width:900px){.pmh-toc{display:none;}}`}</style>
    </div>
  );
}

interface TocEntry {
  id: string;
  text: string;
  level: number;
}

/** Render markdown tối giản → React nodes + mục lục (đủ cho tài liệu tích hợp). */
function renderMarkdown(src: string): { nodes: React.ReactNode[]; toc: TocEntry[] } {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const out: React.ReactNode[] = [];
  const toc: TocEntry[] = [];
  let i = 0;
  let key = 0;
  let hCount = 0;

  const stripInline = (t: string) => t.replace(/[`*]/g, "");
  const inline = (t: string) =>
    t.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((seg, k) => {
      if (seg.startsWith("`") && seg.endsWith("`"))
        return (
          <code key={k} style={{ background: "#eef1ef", padding: "1px 6px", borderRadius: 5, fontSize: "0.9em" }}>
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
        <pre
          key={key++}
          style={{ background: "#0d2b28", color: "#e7efec", padding: 16, borderRadius: 10, overflowX: "auto", fontSize: 13, lineHeight: 1.6 }}
        >
          {buf.join("\n")}
        </pre>,
      );
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const lvl = h[1].length;
      const id = `doc-h${hCount++}`;
      if (lvl <= 2) toc.push({ id, text: stripInline(h[2]), level: lvl });
      out.push(
        <Title
          key={key++}
          id={id}
          level={(lvl + 1) as 2 | 3 | 4 | 5}
          style={{ marginTop: lvl <= 2 ? 26 : 16, scrollMarginTop: 24 }}
        >
          {inline(h[2])}
        </Title>,
      );
      i++;
      continue;
    }
    // Bảng markdown: dòng header | ... | rồi dòng ngăn |---|---|
    if (/^\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      const cells = (row: string) =>
        row.replace(/^\||\|\s*$/g, "").split("|").map((c) => c.trim());
      const head = cells(line);
      i += 2;
      const body: string[][] = [];
      while (i < lines.length && /^\|.*\|\s*$/.test(lines[i])) body.push(cells(lines[i++]));
      out.push(
        <div key={key++} style={{ overflowX: "auto", margin: "14px 0" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 14 }}>
            <thead>
              <tr>
                {head.map((h, k) => (
                  <th key={k} style={{ textAlign: "left", padding: "9px 12px", background: "#eef1ef", color: BRAND.ink, borderBottom: "2px solid #dfe4e1", whiteSpace: "nowrap" }}>
                    {inline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((r, rk) => (
                <tr key={rk}>
                  {r.map((c, ck) => (
                    <td key={ck} style={{ padding: "9px 12px", borderBottom: "1px solid #f0f2f0", verticalAlign: "top" }}>
                      {inline(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) items.push(lines[i++].replace(/^[-*]\s+/, ""));
      out.push(
        <ul key={key++} style={{ lineHeight: 1.7 }}>
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
      <p key={key++} style={{ lineHeight: 1.75 }}>
        {inline(line)}
      </p>,
    );
    i++;
  }
  return { nodes: out, toc };
}
