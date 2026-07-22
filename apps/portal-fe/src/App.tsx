import { ApartmentOutlined, ArrowLeftOutlined, AuditOutlined, BookOutlined, HomeOutlined, MenuOutlined, ProjectOutlined, SettingOutlined, TeamOutlined, UserOutlined, LogoutOutlined } from "@ant-design/icons";
import { App as AntApp, Button, ConfigProvider, Drawer, Dropdown, Grid, Layout, Menu, Result, Spin } from "antd";
import "./pages/shell.css";
import "./pages/admin.css";
import { type ReactNode, useEffect, useState } from "react";
import { Brand, initials } from "./ui";
import InteractionLogin, { ResetPassword } from "./pages/InteractionLogin";
import Launcher from "./pages/Launcher";
import SelfService from "./pages/SelfService";
import Settings from "./pages/Settings";
import Audit from "./pages/Audit";
import Docs from "./pages/Docs";
import AdminUsers from "./pages/AdminUsers";
import AdminGroups from "./pages/AdminGroups";
import AdminWorkspace from "./pages/AdminWorkspace";
import viVN from "antd/locale/vi_VN";
import { api, handleCallback, isAuthed, login, logout } from "./auth";

const { Header, Content, Sider } = Layout;

export interface Profile {
  id: string;
  email: string;
  employee_code: string;
  full_name: string;
  groups: string[];
  roles: string[];
  isSsa: boolean;
}

/** Trang chủ theo vai. SSA + break-glass (cả hai đều có isSsa) VÀO THẲNG bảng
 *  quản trị khi đăng nhập; member/project_admin về trang chủ coverflow. */
function homeFor(p: Profile): string {
  return p.isSsa ? "/admin/users" : "/";
}

/** Các route hợp lệ theo quyền của user (dùng chung cho redirect + chọn trang). */
function allowedRoutes(p: Profile): string[] {
  const isAdmin = p.roles.length > 0;
  const isDev = p.groups.some((g) => g.toLowerCase() === "developers");
  return [
    "/",
    "/account",
    ...(isDev ? ["/docs"] : []),
    ...(isAdmin ? ["/admin/users", "/admin/groups", "/admin/workspace", "/audit"] : []),
    ...(isAdmin && p.isSsa ? ["/settings"] : []),
  ];
}

function usePath(): [string, (p: string) => void] {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const on = () => setPath(window.location.pathname);
    window.addEventListener("popstate", on);
    return () => window.removeEventListener("popstate", on);
  }, []);
  const nav = (p: string) => {
    window.history.pushState({}, "", p);
    setPath(p);
  };
  return [path, nav];
}

export default function App() {
  return (
    <ConfigProvider
      locale={viVN}
      theme={{
        token: {
          colorPrimary: "#0E4D45",
          colorLink: "#0E4D45",
          colorInfo: "#0E4D45",
          borderRadius: 10,
          colorBgLayout: "#f3f5f3",
          colorTextHeading: "#16211F",
          fontSize: 14,
        },
        components: {
          Layout: { headerBg: "#ffffff", headerHeight: 62, siderBg: "#ffffff" },
          Menu: { itemSelectedBg: "#e8f0ed", itemSelectedColor: "#0E4D45", itemHeight: 44, itemBorderRadius: 8 },
          Button: { primaryShadow: "none" },
          Card: { boxShadowTertiary: "0 1px 2px rgba(16,33,31,0.04), 0 8px 24px rgba(16,33,31,0.05)" },
        },
      }}
    >
      <AntApp>
        <Root />
      </AntApp>
    </ConfigProvider>
  );
}

// Boot MEMOIZE ở module-level: React StrictMode gọi effect 2 lần (2 lần mount);
// nếu mỗi lần tự quyết handleCallback/login sẽ đua nhau (mount 2 check isAuthed
// trước khi mount 1 kịp lưu token → login() thừa → vòng lặp điều hướng). Dùng
// CHUNG một promise → toàn bộ trình tự chạy đúng MỘT lần.
export class LoginLoopError extends Error {}

let bootPromise: Promise<Profile | null> | null = null;
function boot(): Promise<Profile | null> {
  if (bootPromise) return bootPromise;
  bootPromise = (async () => {
    if (window.location.pathname === "/auth/callback") {
      await handleCallback(); // xong sẽ replaceState về "/"
    }
    if (!isAuthed()) {
      // Vòng-lặp-breaker: nếu VỪA auto-login xong đã quay lại đây mà vẫn chưa
      // đăng nhập được → phiên lỗi DAI DẲNG (cookie bị chặn, hoặc cap phiên bị
      // cấu hình ~0). renderError của IdP trả 303 về "/" nên nếu cứ auto-login
      // sẽ thành vòng lặp điều hướng vô hạn. Dừng lại, để user tự thử lại.
      const now = Date.now();
      const last = Number(sessionStorage.getItem("pmh_login_ts") || 0);
      if (last && now - last < 8000) {
        sessionStorage.removeItem("pmh_login_ts");
        throw new LoginLoopError();
      }
      sessionStorage.setItem("pmh_login_ts", String(now));
      await login();
      return null; // đang điều hướng
    }
    sessionStorage.removeItem("pmh_login_ts"); // đã auth → reset đếm
    return api<Profile>("/api/me");
  })();
  return bootPromise;
}

function Root() {
  const [path, nav] = usePath();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);
  const [loopErr, setLoopErr] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const screens = Grid.useBreakpoint();
  const mobile = !screens.lg;

  const interaction = path.match(/^\/interaction\/([^/]+)$/);
  const resetPw = path === "/reset-password";

  useEffect(() => {
    if (interaction || resetPw) return; // login SSO + đặt lại MK: route công khai, không cần auth portal
    boot()
      .then((p) => {
        if (p) {
          setProfile(p);
          // Dọn URL sau /auth/callback VÀ chặn URL không được phép, nhưng GIỮ
          // deep-link hợp lệ (vd F5 trên /admin/groups không bị đá đi). SSA/
          // break-glass mặc định vào thẳng bảng quản trị (kể cả khi đáp "/").
          const home = homeFor(p);
          const here = window.location.pathname;
          if (here !== home && (here === "/" || !allowedRoutes(p).includes(here))) nav(home);
        }
      })
      .catch((e) => {
        if (e instanceof LoginLoopError) setLoopErr(true);
      })
      .finally(() => setReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (interaction) {
    return <InteractionLogin uid={interaction[1]} />;
  }
  if (resetPw) {
    return <ResetPassword />;
  }
  if (loopErr) {
    return (
      <Layout style={{ minHeight: "100vh", alignItems: "center", justifyContent: "center" }}>
        <Result
          status="warning"
          title="Không thiết lập được phiên đăng nhập"
          subTitle="Trình duyệt có thể đang chặn cookie, hoặc phiên hết hạn ngay lập tức. Kiểm tra cài đặt cookie rồi thử lại."
          extra={
            <Button type="primary" onClick={() => { sessionStorage.removeItem("pmh_login_ts"); window.location.href = "/"; }}>
              Thử đăng nhập lại
            </Button>
          }
        />
      </Layout>
    );
  }
  if (!ready || !profile) {
    return (
      <Layout style={{ minHeight: "100vh", alignItems: "center", justifyContent: "center" }}>
        <Spin size="large" tip="Đang tải PMH ID…">
          <div style={{ padding: 40 }} />
        </Spin>
      </Layout>
    );
  }

  const isAdmin = profile.roles.length > 0;
  const isDev = profile.groups.some((g) => g.toLowerCase() === "developers");
  const adminRoutes = ["/admin/users", "/admin/groups", "/admin/workspace", "/audit", "/settings"];

  // Admin console (chrome sidebar) — CHỈ khi vào mục quản trị.
  if (isAdmin && adminRoutes.includes(path)) {
    return (
      <AdminConsole
        profile={profile}
        path={path}
        nav={nav}
        mobile={mobile}
        drawer={drawer}
        setDrawer={setDrawer}
        isDev={isDev}
        onProfile={setProfile}
      />
    );
  }

  // Trang tài khoản / tài liệu — nền sáng, có topbar, KHÔNG sidebar.
  if (path === "/account") {
    return (
      <MemberPage profile={profile} nav={nav} isAdmin={isAdmin} isDev={isDev} onProfile={setProfile}>
        <SelfService profile={profile} onProfile={setProfile} />
      </MemberPage>
    );
  }
  if (path === "/docs" && isDev) {
    return (
      <MemberPage profile={profile} nav={nav} isAdmin={isAdmin} isDev={isDev} onProfile={setProfile}>
        <Docs />
      </MemberPage>
    );
  }

  // Mặc định: TRANG CHỦ immersive — coverflow 3D full-screen, không sidebar.
  return (
    <div className="pmh-home">
      <TopBar variant="over-dark" profile={profile} nav={nav} isAdmin={isAdmin} isDev={isDev} showHome={false} onProfile={setProfile} />
      <Launcher greeting={profile.full_name} fill />
    </div>
  );
}

/** Avatar tròn + menu tài khoản. variant = over-dark (trên hero tối) | light.
 *  context = "admin" khi đang TRONG bảng quản trị: bỏ "Trang chủ" và "Bảng quản
 *  trị" (đã có sẵn ở sidebar) để KHÔNG trùng lặp — chỉ giữ mục KHÔNG có trong rail
 *  (Tài khoản, Tài liệu, Đăng xuất). Giải quyết "nhiều cái trùng nhau vô lý". */
function AvatarMenu({
  profile,
  nav,
  isAdmin,
  isDev,
  variant,
  context = "member",
  showHome = true,
  onProfile,
}: {
  profile: Profile;
  nav: (p: string) => void;
  isAdmin: boolean;
  isDev: boolean;
  variant: "over-dark" | "light";
  context?: "member" | "admin";
  showHome?: boolean;
  onProfile: (p: Profile) => void;
}) {
  // "Tài khoản" mở POPUP (Drawer) tại chỗ thay vì nhảy trang /account — gọn, không
  // rời khỏi trang chủ/console đang xem.
  const [acctOpen, setAcctOpen] = useState(false);
  const items =
    context === "admin"
      ? [
          { key: "email", label: profile.email, disabled: true },
          { type: "divider" as const },
          { key: "account", icon: <UserOutlined />, label: "Tài khoản" },
          ...(isDev ? [{ key: "/docs", icon: <BookOutlined />, label: "Tài liệu" }] : []),
          { type: "divider" as const },
          { key: "logout", icon: <LogoutOutlined />, label: "Đăng xuất", danger: true },
        ]
      : [
          { key: "email", label: profile.email, disabled: true },
          { type: "divider" as const },
          ...(showHome ? [{ key: "/", icon: <HomeOutlined />, label: "Trang chủ" }] : []),
          { key: "account", icon: <UserOutlined />, label: "Tài khoản" },
          ...(isDev ? [{ key: "/docs", icon: <BookOutlined />, label: "Tài liệu" }] : []),
          ...(isAdmin ? [{ key: "/admin/users", icon: <ProjectOutlined />, label: "Bảng quản trị" }] : []),
          { type: "divider" as const },
          { key: "logout", icon: <LogoutOutlined />, label: "Đăng xuất", danger: true },
        ];
  return (
    <>
      <Dropdown
        trigger={["click"]}
        placement="bottomRight"
        menu={{
          items,
          onClick: ({ key }) => {
            if (key === "logout") logout();
            else if (key === "account") setAcctOpen(true);
            else if (key.startsWith("/")) nav(key);
          },
        }}
      >
        <button className={`pmh-avatar pmh-avatar--${variant}`} aria-label="Tài khoản" title={profile.full_name}>
          {initials(profile.full_name)}
        </button>
      </Dropdown>
      <Drawer
        open={acctOpen}
        onClose={() => setAcctOpen(false)}
        width={520}
        title="Tài khoản"
        destroyOnClose
      >
        <SelfService profile={profile} onProfile={onProfile} embedded />
      </Drawer>
    </>
  );
}

/** Thanh trên cùng (brand trái, avatar phải). over-dark = nổi trên hero tối. */
function TopBar({
  variant,
  profile,
  nav,
  isAdmin,
  isDev,
  showHome = true,
  onProfile,
}: {
  variant: "over-dark" | "light";
  profile: Profile;
  nav: (p: string) => void;
  isAdmin: boolean;
  isDev: boolean;
  showHome?: boolean;
  onProfile: (p: Profile) => void;
}) {
  const dark = variant === "over-dark";
  return (
    <div className={`pmh-topbar pmh-topbar--${variant}`}>
      <div className="pmh-topbar__brand" onClick={() => nav("/")}>
        <Brand size={26} on={dark ? "dark" : "light"} />
        <span className="pmh-topbar__brandname">PMH ID</span>
      </div>
      <AvatarMenu profile={profile} nav={nav} isAdmin={isAdmin} isDev={isDev} variant={variant} showHome={showHome} onProfile={onProfile} />
    </div>
  );
}

/** Trang phụ nền sáng (Tài khoản/Tài liệu) — topbar + nút về Trang chủ. */
function MemberPage({
  profile,
  nav,
  isAdmin,
  isDev,
  onProfile,
  children,
}: {
  profile: Profile;
  nav: (p: string) => void;
  isAdmin: boolean;
  isDev: boolean;
  onProfile: (p: Profile) => void;
  children: ReactNode;
}) {
  return (
    <div className="pmh-page">
      <TopBar variant="light" profile={profile} nav={nav} isAdmin={isAdmin} isDev={isDev} onProfile={onProfile} />
      <div className="pmh-page__body">
        <button className="pmh-page__back" onClick={() => nav("/")}>
          <ArrowLeftOutlined /> Trang chủ
        </button>
        {children}
      </div>
    </div>
  );
}

/** Chỉ dấu môi trường theo hostname (self-contained, không cần backend). PROD =
 *  xanh nhẹ để cảnh báo "đang trên thật"; local/dev/staging = hổ phách. */
function adminEnv(): { label: string; tone: "prod" | "warn" } {
  const h = location.hostname;
  if (h === "localhost" || h === "127.0.0.1" || h.endsWith(".local")) return { label: "LOCAL", tone: "warn" };
  if (/staging/.test(h)) return { label: "STAGING", tone: "warn" };
  if (/(^|\.)dev\./.test(h) || h.startsWith("dev.")) return { label: "DEV", tone: "warn" };
  return { label: "PROD", tone: "prod" };
}

/** Bảng quản trị — "Rail xanh PMH": sidebar xanh lục thẫm, mục active nhấn vàng,
 *  canvas đá sáng. antd lo hành vi; style ở admin.css (playbook §0/§3/§4). */
function AdminConsole({
  profile,
  path,
  nav,
  mobile,
  drawer,
  setDrawer,
  isDev,
  onProfile,
}: {
  profile: Profile;
  path: string;
  nav: (p: string) => void;
  mobile: boolean;
  drawer: boolean;
  setDrawer: (v: boolean) => void;
  isDev: boolean;
  onProfile: (p: Profile) => void;
}) {
  const sections = [
    { key: "/admin/users", icon: <TeamOutlined />, label: "Người dùng" },
    { key: "/admin/groups", icon: <ApartmentOutlined />, label: "Nhóm" },
    { key: "/admin/workspace", icon: <ProjectOutlined />, label: "Dự án & Ứng dụng" },
    { key: "/audit", icon: <AuditOutlined />, label: "Nhật ký" },
    ...(profile.isSsa ? [{ key: "/settings", icon: <SettingOutlined />, label: "Cấu hình" }] : []),
  ];
  const items = [
    { key: "/", icon: <HomeOutlined />, label: "Trang chủ" },
    { type: "divider" as const },
    ...sections,
  ];
  const title = sections.find((s) => s.key === path)?.label ?? "Quản trị";
  const env = adminEnv();

  const brand = (
    <div className="pmh-admin__brand" onClick={() => nav("/")}>
      <Brand size={26} on="dark" />
      <span className="pmh-admin__brand-name">PMH ID</span>
    </div>
  );
  // Menu trên nền xanh: token dark tuỳ biến (chữ sáng, active vàng). ConfigProvider
  // lồng — chỉ ảnh hưởng menu rail, không rò ra header/nội dung.
  const menu = (
    <ConfigProvider
      theme={{
        components: {
          Menu: {
            darkItemBg: "transparent",
            darkSubMenuItemBg: "transparent",
            darkItemColor: "rgba(255,255,255,0.74)",
            darkItemHoverColor: "#ffffff",
            darkItemHoverBg: "rgba(255,255,255,0.08)",
            darkItemSelectedBg: "rgba(201,162,75,0.16)",
            darkItemSelectedColor: "#e6cf95",
            itemHeight: 42,
            itemBorderRadius: 8,
            itemMarginInline: 0,
          },
        },
      }}
    >
      <Menu
        className="pmh-admin__nav"
        theme="dark"
        mode="inline"
        selectedKeys={[path]}
        items={items}
        onClick={({ key }) => {
          nav(key);
          setDrawer(false);
        }}
      />
    </ConfigProvider>
  );

  return (
    <Layout className="pmh-admin" style={{ minHeight: "100vh" }}>
      {!mobile && (
        <Sider className="pmh-admin__sider" theme="dark" width={224} style={{ position: "sticky", top: 0, height: "100vh" }}>
          <div className="pmh-admin__sider-inner">
            {brand}
            <div className="pmh-admin__rail-tag">Phân hệ quản trị</div>
            {menu}
            <div className="pmh-admin__rail-foot">{profile.isSsa ? "Quản trị hệ thống · SSA" : "Quản trị dự án"}</div>
          </div>
        </Sider>
      )}
      <Layout style={{ background: "transparent" }}>
        <Header className="pmh-admin__header">
          {mobile ? (
            <>
              <MenuOutlined style={{ fontSize: 18, cursor: "pointer" }} onClick={() => setDrawer(true)} />
              {/* Trên mobile rail bị ẩn → header là nơi DUY NHẤT chỉ vị trí. */}
              <span className="pmh-admin__header-title">{title}</span>
            </>
          ) : (
            // Desktop: rail đã highlight mục đang xem + trang có H1 → header KHÔNG
            // lặp lại tiêu đề. Chỉ còn breadcrumb mờ + chỉ dấu môi trường.
            <span className="pmh-admin__crumb">Quản trị</span>
          )}
          <span className={`pmh-env pmh-env--${env.tone}`} title={location.hostname}>{env.label}</span>
          <div style={{ flex: 1 }} />
          <AvatarMenu profile={profile} nav={nav} isAdmin isDev={isDev} variant="light" context="admin" onProfile={onProfile} />
        </Header>
        <Content className="pmh-admin__content">
          <div className="pmh-admin__page">
            {path === "/admin/users" && <AdminUsers isSsa={profile.isSsa} />}
            {path === "/admin/groups" && <AdminGroups isSsa={profile.isSsa} />}
            {path === "/admin/workspace" && <AdminWorkspace isSsa={profile.isSsa} />}
            {path === "/audit" && <Audit isSsa={profile.isSsa} />}
            {path === "/settings" && <Settings />}
          </div>
        </Content>
      </Layout>
      <Drawer
        open={drawer}
        onClose={() => setDrawer(false)}
        placement="left"
        width={224}
        closable={false}
        styles={{ body: { padding: 0, background: "linear-gradient(180deg,#0e4d45,#0a3a34)" } }}
      >
        <div className="pmh-admin">
          <div className="pmh-admin__sider-inner">
            {brand}
            <div className="pmh-admin__rail-tag">Phân hệ quản trị</div>
            {menu}
          </div>
        </div>
      </Drawer>
    </Layout>
  );
}
