import { ApartmentOutlined, AppstoreOutlined, AuditOutlined, BookOutlined, MenuOutlined, ProjectOutlined, SettingOutlined, TeamOutlined, UserOutlined, LogoutOutlined } from "@ant-design/icons";
import { App as AntApp, Avatar, Button, ConfigProvider, Drawer, Dropdown, Grid, Layout, Menu, Result, Spin } from "antd";
import { useEffect, useState } from "react";
import { Brand, BRAND, initials } from "./ui";
import InteractionLogin from "./pages/InteractionLogin";
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

  useEffect(() => {
    if (interaction) return; // trang login SSO không cần auth portal
    boot()
      .then((p) => {
        if (p) {
          setProfile(p);
          if (window.location.pathname !== "/") nav("/");
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
  const items = [
    { key: "/", icon: <AppstoreOutlined />, label: "Ứng dụng" },
    { key: "/account", icon: <UserOutlined />, label: "Tài khoản" },
    ...(isDev ? [{ key: "/docs", icon: <BookOutlined />, label: "Tài liệu" }] : []),
    ...(isAdmin
      ? [
          { type: "divider" as const },
          { key: "/admin/users", icon: <TeamOutlined />, label: "Người dùng" },
          { key: "/admin/groups", icon: <ApartmentOutlined />, label: "Nhóm" },
          { key: "/admin/workspace", icon: <ProjectOutlined />, label: "Dự án & Ứng dụng" },
          { key: "/audit", icon: <AuditOutlined />, label: "Nhật ký" },
          ...(profile.isSsa ? [{ key: "/settings", icon: <SettingOutlined />, label: "Cấu hình" }] : []),
        ]
      : []),
  ];
  const selected = ["/", "/account", "/docs", "/audit", "/settings", "/admin/users", "/admin/groups", "/admin/workspace"].includes(path) ? path : "/";

  const logo = (
    <div style={{ height: 60, display: "flex", alignItems: "center", gap: 10, paddingInline: 20 }}>
      <Brand size={26} />
      <span style={{ fontWeight: 700, fontSize: 17, color: BRAND.ink, letterSpacing: 0.3 }}>PMH ID</span>
    </div>
  );
  const menu = (
    <Menu
      mode="inline"
      selectedKeys={[selected]}
      items={items}
      style={{ borderInlineEnd: 0, paddingInline: 8 }}
      onClick={({ key }) => {
        nav(key);
        setDrawer(false);
      }}
    />
  );

  return (
    <Layout style={{ minHeight: "100vh" }}>
      {!mobile && (
        <Sider theme="light" width={224} style={{ borderRight: "1px solid #eef0f2", position: "sticky", top: 0, height: "100vh" }}>
          {logo}
          {menu}
        </Sider>
      )}
      <Layout>
        <Header style={{ borderBottom: "1px solid #eef0f2", display: "flex", alignItems: "center", gap: 12, paddingInline: mobile ? 12 : 24 }}>
          {mobile && (
            <>
              <MenuOutlined style={{ fontSize: 18, cursor: "pointer" }} onClick={() => setDrawer(true)} />
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Brand size={22} />
                <span style={{ fontWeight: 700, color: BRAND.ink }}>PMH ID</span>
              </div>
            </>
          )}
          <div style={{ flex: 1 }} />
          <Dropdown
            trigger={["click"]}
            menu={{
              items: [
                { key: "email", label: profile.email, disabled: true },
                { type: "divider" },
                { key: "logout", icon: <LogoutOutlined />, label: "Đăng xuất", danger: true },
              ],
              onClick: ({ key }) => key === "logout" && logout(),
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <Avatar style={{ background: BRAND.green, verticalAlign: "middle" }} size={32}>
                {initials(profile.full_name)}
              </Avatar>
              {!mobile && <span style={{ fontWeight: 600, color: BRAND.ink }}>{profile.full_name}</span>}
            </div>
          </Dropdown>
        </Header>
        <Content style={{ padding: mobile ? 16 : 28, maxWidth: 1120, width: "100%", margin: "0 auto" }}>
          {selected === "/" && <Launcher greeting={profile.full_name} />}
          {selected === "/account" && <SelfService profile={profile} onProfile={setProfile} />}
          {selected === "/docs" && <Docs />}
          {selected === "/admin/users" && <AdminUsers isSsa={profile.isSsa} />}
          {selected === "/admin/groups" && <AdminGroups isSsa={profile.isSsa} />}
          {selected === "/admin/workspace" && <AdminWorkspace isSsa={profile.isSsa} />}
          {selected === "/audit" && <Audit isSsa={profile.isSsa} />}
          {selected === "/settings" && <Settings />}
        </Content>
      </Layout>
      <Drawer open={drawer} onClose={() => setDrawer(false)} placement="left" width={224} title={logo} styles={{ header: { padding: 0, borderBottom: "1px solid #eef0f2" }, body: { padding: 0 } }}>
        {menu}
      </Drawer>
    </Layout>
  );
}
