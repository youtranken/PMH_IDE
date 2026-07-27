import { Alert, Skeleton } from "antd";
import { useEffect, useState } from "react";
import { api } from "../auth";
import { BRAND, initials } from "../ui";

interface Project {
  client_id: string;
  name: string;
  app_url: string;
  env: string;
}
interface DocItem {
  slug: string;
  title: string;
  content: string;
}

/**
 * Cổng tài liệu người dùng THEO DỰ ÁN. Sidebar = các dự án user có quyền
 * (`/api/me/apps`); chọn dự án → tải tài liệu riêng của dự án đó
 * (`/api/docs/<client_id>`). Mỗi dự án có thể có nhiều tài liệu (.md). Dự án chưa
 * có tài liệu → "Đang chờ cập nhật". Markdown render tối giản (không kéo thư viện).
 */
export default function Docs() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [active, setActive] = useState<string | null>(null); // client_id đang chọn
  const [docs, setDocs] = useState<DocItem[] | null>(null); // tài liệu của dự án đang chọn
  const [docsErr, setDocsErr] = useState(false);
  const [openSlug, setOpenSlug] = useState<string | null>(null);

  useEffect(() => {
    api<Project[]>("/api/me/apps")
      .then((a) => {
        setProjects(a);
        if (a.length) setActive(a[0].client_id);
      })
      .catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    if (!active) return;
    setDocs(null);
    setDocsErr(false);
    setOpenSlug(null);
    api<{ documents: DocItem[] }>(`/api/docs/${encodeURIComponent(active)}`)
      .then((d) => {
        setDocs(d.documents);
        setOpenSlug(d.documents[0]?.slug ?? null);
      })
      .catch(() => {
        setDocs([]);
        setDocsErr(true);
      });
  }, [active]);

  const activeProject = projects?.find((p) => p.client_id === active) ?? null;
  const openDoc = docs?.find((d) => d.slug === openSlug) ?? null;
  const rendered = openDoc ? renderMarkdown(openDoc.content) : null;

  return (
    <div className="pmh-docs">
      <div className="pmh-docs__head">
        <h1>Tài liệu dự án</h1>
        <p>Chọn dự án để xem hướng dẫn sử dụng &amp; tài liệu riêng của dự án đó.</p>
      </div>

      <div className="pmh-docs__grid">
        {/* ---- Sidebar dự án ---- */}
        <aside className="pmh-docs__rail">
          <div className="pmh-docs__rail-tag">Dự án của bạn</div>
          {projects === null ? (
            <div style={{ padding: 8 }}>
              <Skeleton active paragraph={{ rows: 3 }} title={false} />
            </div>
          ) : projects.length === 0 ? (
            <div className="pmh-docs__rail-empty">
              Bạn chưa được cấp dự án nào. Liên hệ quản trị để được thêm vào nhóm dự án.
            </div>
          ) : (
            projects.map((p) => (
              <button
                key={p.client_id}
                type="button"
                className={`pmh-docs__proj${p.client_id === active ? " is-active" : ""}`}
                onClick={() => setActive(p.client_id)}
                aria-current={p.client_id === active}
              >
                <span className="pmh-docs__chip">{initials(p.name)}</span>
                <span className="pmh-docs__proj-txt">
                  <span className="pmh-docs__proj-nm">{p.name}</span>
                  <span className="pmh-docs__proj-env">{p.env?.toUpperCase()}</span>
                </span>
              </button>
            ))
          )}
        </aside>

        {/* ---- Nội dung tài liệu ---- */}
        <article className="pmh-docs__doc">
          {projects !== null && projects.length === 0 ? (
            <DocsEmpty
              title="Chưa có dự án"
              sub="Khi bạn được cấp quyền vào một dự án, tài liệu của dự án đó sẽ hiện ở đây."
            />
          ) : docs === null ? (
            <Skeleton active paragraph={{ rows: 10 }} title={{ width: "40%" }} />
          ) : docsErr ? (
            <Alert
              type="error"
              showIcon
              message="Không tải được tài liệu"
              description="Có lỗi khi tải nội dung. Thử lại, hoặc liên hệ quản trị nếu vẫn lỗi."
            />
          ) : docs.length === 0 ? (
            <DocsEmpty
              title="Đang chờ cập nhật"
              sub={`Dự án ${activeProject?.name ?? ""} chưa có tài liệu. Nội dung sẽ được bổ sung sau.`}
            />
          ) : (
            <>
              {docs.length > 1 && (
                <div className="pmh-docs__tabs" role="tablist">
                  {docs.map((d) => (
                    <button
                      key={d.slug}
                      type="button"
                      role="tab"
                      aria-selected={d.slug === openSlug}
                      className={`pmh-docs__tab${d.slug === openSlug ? " is-active" : ""}`}
                      onClick={() => setOpenSlug(d.slug)}
                    >
                      {d.title}
                    </button>
                  ))}
                </div>
              )}
              <div className="pmh-docs__body">{rendered?.nodes}</div>
            </>
          )}
        </article>

        {/* ---- Mục lục tài liệu đang xem ---- */}
        {rendered && rendered.toc.length > 1 && (
          <nav className="pmh-docs__toc">
            <div className="pmh-docs__toc-h">Mục lục</div>
            {rendered.toc.map((t) => (
              <a
                key={t.id}
                href={`#${t.id}`}
                className={t.level === 2 ? "sub" : ""}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(t.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                {t.text}
              </a>
            ))}
          </nav>
        )}
      </div>

      <style>{DOCS_CSS}</style>
    </div>
  );
}

function DocsEmpty({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="pmh-docs__empty">
      <div className="pmh-docs__empty-ico">✦</div>
      <div className="pmh-docs__empty-title">{title}</div>
      <div className="pmh-docs__empty-sub">{sub}</div>
    </div>
  );
}

const DOCS_CSS = `
.pmh-docs{max-width:1240px;margin:0 auto;width:100%;}
.pmh-docs__head{margin-bottom:18px;}
.pmh-docs__head h1{margin:0;font-size:22px;font-weight:700;letter-spacing:-.3px;color:${BRAND.ink};}
.pmh-docs__head p{margin:4px 0 0;color:${BRAND.muted};}
.pmh-docs__grid{display:grid;grid-template-columns:236px minmax(0,1fr) 200px;gap:24px;align-items:start;}
/* rail */
.pmh-docs__rail{background:#fff;border:1px solid var(--pmh-card-border);border-radius:var(--pmh-card-radius);box-shadow:var(--pmh-card-shadow);padding:10px;position:sticky;top:16px;}
.pmh-docs__rail-tag{font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${BRAND.muted};padding:6px 10px 10px;}
.pmh-docs__rail-empty{padding:6px 10px 12px;color:${BRAND.muted};font-size:13px;line-height:1.5;}
.pmh-docs__proj{display:flex;align-items:center;gap:11px;width:100%;text-align:left;border:none;background:none;cursor:pointer;padding:9px 10px;border-radius:10px;position:relative;font:inherit;color:inherit;margin-bottom:2px;}
.pmh-docs__proj:hover{background:#f6f8f7;}
.pmh-docs__proj.is-active{background:#e8f0ed;}
.pmh-docs__proj.is-active::before{content:"";position:absolute;left:0;top:9px;bottom:9px;width:3px;border-radius:0 3px 3px 0;background:${BRAND.green};}
.pmh-docs__proj:focus-visible{outline:2px solid ${BRAND.green};outline-offset:1px;}
.pmh-docs__chip{width:34px;height:34px;border-radius:9px;background:#e8f0ed;color:${BRAND.green};display:grid;place-items:center;font-weight:800;font-size:13px;flex:none;}
.pmh-docs__proj.is-active .pmh-docs__chip{background:${BRAND.green};color:#fff;}
.pmh-docs__proj-txt{min-width:0;}
.pmh-docs__proj-nm{display:block;font-weight:600;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.pmh-docs__proj-env{display:block;font-size:11px;color:${BRAND.muted};margin-top:3px;}
/* doc card */
.pmh-docs__doc{background:#fff;border:1px solid var(--pmh-card-border);border-radius:var(--pmh-card-radius);box-shadow:var(--pmh-card-shadow);padding:8px 32px 28px;min-width:0;}
.pmh-docs__tabs{display:flex;gap:6px;flex-wrap:wrap;padding:14px 0 6px;border-bottom:1px solid var(--pmh-card-border);margin-bottom:6px;}
.pmh-docs__tab{border:1px solid var(--pmh-card-border);background:#fff;color:${BRAND.muted};font:inherit;font-size:13px;font-weight:600;padding:6px 12px;border-radius:999px;cursor:pointer;}
.pmh-docs__tab:hover{color:${BRAND.green};border-color:#cdd8d3;}
.pmh-docs__tab.is-active{background:#e8f0ed;color:${BRAND.green};border-color:transparent;}
.pmh-docs__body h2,.pmh-docs__body h3,.pmh-docs__body h4{scroll-margin-top:24px;}
.pmh-docs__body p{line-height:1.75;}
.pmh-docs__body pre{background:#0d2b28;color:#e7efec;padding:16px;border-radius:10px;overflow-x:auto;font-size:13px;line-height:1.6;}
.pmh-docs__body code{background:#eef1ef;padding:1px 6px;border-radius:5px;font-size:.9em;}
.pmh-docs__body table{border-collapse:collapse;width:100%;font-size:14px;margin:14px 0;}
.pmh-docs__body th{text-align:left;padding:9px 12px;background:#eef1ef;color:${BRAND.ink};border-bottom:2px solid #dfe4e1;white-space:nowrap;}
.pmh-docs__body td{padding:9px 12px;border-bottom:1px solid #f0f2f0;vertical-align:top;}
.pmh-docs__body ul{line-height:1.7;}
/* toc */
.pmh-docs__toc{position:sticky;top:16px;font-size:13.5px;max-height:calc(100vh - 32px);overflow:auto;}
.pmh-docs__toc-h{font-size:12px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:${BRAND.muted};margin-bottom:10px;}
.pmh-docs__toc a{display:block;padding:5px 0;color:${BRAND.ink};text-decoration:none;font-weight:600;line-height:1.4;}
.pmh-docs__toc a.sub{padding-left:14px;color:${BRAND.muted};font-weight:400;}
.pmh-docs__toc a:hover{color:${BRAND.green};}
/* empty */
.pmh-docs__empty{text-align:center;padding:56px 20px;}
.pmh-docs__empty-ico{font-size:34px;color:${BRAND.gold};}
.pmh-docs__empty-title{margin-top:8px;font-weight:700;font-size:17px;color:${BRAND.ink};}
.pmh-docs__empty-sub{margin-top:6px;font-size:14px;color:${BRAND.muted};max-width:46ch;margin-inline:auto;line-height:1.6;}
/* responsive */
@media(max-width:1080px){.pmh-docs__grid{grid-template-columns:236px minmax(0,1fr);}.pmh-docs__toc{display:none;}}
@media(max-width:760px){
  .pmh-docs__grid{grid-template-columns:1fr;}
  .pmh-docs__rail{position:static;display:flex;gap:8px;overflow-x:auto;padding:8px;}
  .pmh-docs__rail-tag{display:none;}
  .pmh-docs__proj{flex:none;width:auto;white-space:nowrap;}
  .pmh-docs__proj-nm{white-space:nowrap;}
  .pmh-docs__doc{padding:8px 18px 22px;}
}
`;

interface TocEntry {
  id: string;
  text: string;
  level: number;
}

/** Render markdown tối giản → React nodes + mục lục (đủ cho tài liệu dự án). */
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
          <code key={k}>{seg.slice(1, -1)}</code>
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
      out.push(<pre key={key++}>{buf.join("\n")}</pre>);
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const lvl = h[1].length;
      const id = `doc-h${hCount++}`;
      if (lvl <= 2) toc.push({ id, text: stripInline(h[2]), level: lvl });
      const Tag = (["h2", "h3", "h4", "h5"] as const)[Math.min(lvl - 1, 3)];
      out.push(
        <Tag key={key++} id={id} style={{ marginTop: lvl <= 2 ? 26 : 16 }}>
          {inline(h[2])}
        </Tag>,
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
        <div key={key++} style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                {head.map((c, k) => (
                  <th key={k}>{inline(c)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((r, rk) => (
                <tr key={rk}>
                  {r.map((c, ck) => (
                    <td key={ck}>{inline(c)}</td>
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
      <p key={key++}>{inline(line)}</p>,
    );
    i++;
  }
  return { nodes: out, toc };
}
