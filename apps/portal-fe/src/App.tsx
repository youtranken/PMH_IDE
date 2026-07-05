import { AppstoreOutlined, AuditOutlined, SettingOutlined, UserOutlined, LogoutOutlined } from "@ant-design/icons";
import { App as AntApp, ConfigProvider, Layout, Menu, Spin, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";
import InteractionLogin from "./pages/InteractionLogin";
import Launcher from "./pages/Launcher";
import SelfService from "./pages/SelfService";
import Settings from "./pages/Settings";
import Audit from "./pages/Audit";
import { api, handleCallback, isAuthed, login, logout } from "./auth";

const { Header, Content, Sider } = Layout;
const { Text } = Typography;

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
    <ConfigProvider theme={{ token: { colorPrimary: "#1d6fb8" } }}>
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
let bootPromise: Promise<Profile | null> | null = null;
function boot(): Promise<Profile | null> {
  if (bootPromise) return bootPromise;
  bootPromise = (async () => {
    if (window.location.pathname === "/auth/callback") {
      await handleCallback(); // xong sẽ replaceState về "/"
    }
    if (!isAuthed()) {
      await login();
      return null; // đang điều hướng
    }
    return api<Profile>("/api/me");
  })();
  return bootPromise;
}

function Root() {
  const [path, nav] = usePath();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);

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
      .finally(() => setReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (interaction) {
    return <InteractionLogin uid={interaction[1]} />;
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
  const items = [
    { key: "/", icon: <AppstoreOutlined />, label: "Ứng dụng" },
    { key: "/account", icon: <UserOutlined />, label: "Tài khoản" },
    ...(isAdmin ? [{ key: "/audit", icon: <AuditOutlined />, label: "Nhật ký" }] : []),
    ...(profile.isSsa ? [{ key: "/settings", icon: <SettingOutlined />, label: "Cấu hình" }] : []),
    { key: "__logout", icon: <LogoutOutlined />, label: "Đăng xuất" },
  ];

  const selected = ["/", "/account", "/audit", "/settings"].includes(path) ? path : "/";

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider breakpoint="lg" collapsedWidth="0" theme="light" style={{ borderRight: "1px solid #eee" }}>
        <div style={{ height: 56, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 18, color: "#1d6fb8" }}>
          PMH ID
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selected]}
          items={items}
          onClick={({ key }) => (key === "__logout" ? logout() : nav(key))}
        />
      </Sider>
      <Layout>
        <Header style={{ background: "#fff", borderBottom: "1px solid #eee", display: "flex", alignItems: "center", justifyContent: "flex-end", paddingInline: 24 }}>
          <Text strong style={{ marginRight: 8 }}>{profile.full_name}</Text>
          <Text type="secondary">{profile.email}</Text>
        </Header>
        <Content style={{ padding: 24, maxWidth: 1100, width: "100%", margin: "0 auto" }}>
          {selected === "/" && <Launcher />}
          {selected === "/account" && <SelfService profile={profile} onProfile={setProfile} />}
          {selected === "/audit" && <Audit isSsa={profile.isSsa} />}
          {selected === "/settings" && <Settings />}
        </Content>
      </Layout>
    </Layout>
  );
}
