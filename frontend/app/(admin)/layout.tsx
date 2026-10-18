"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ConfigProvider, theme, Layout, Button, Space, Avatar, Tag, Dropdown, Typography } from "antd";
import { CrownOutlined, LogoutOutlined, UserOutlined, ArrowLeftOutlined } from "@ant-design/icons";
import Link from "next/link";
import { useAuthStore } from "@/store/auth";
import { useThemeStore } from "@/store/theme";

const { Header, Content } = Layout;
const { Text } = Typography;

function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, clearAuth, _hasHydrated } = useAuthStore();
  const { isDark } = useThemeStore();

  useEffect(() => {
    if (_hasHydrated && !user) { router.replace("/login"); return; }
    if (_hasHydrated && user && !user.isSuperAdmin) router.replace("/dashboard");
  }, [_hasHydrated, user, router]);

  if (!_hasHydrated || !user) return null;
  if (!user.isSuperAdmin) return null;

  const headerBg  = "#0a0a0a";
  const contentBg = "#111111";

  const menuItems = [
    { key: "app", icon: <ArrowLeftOutlined />, label: <Link href="/dashboard">Back to App</Link> },
    { type: "divider" as const },
    { key: "logout", icon: <LogoutOutlined />, label: "Sign out", danger: true },
  ];

  return (
    <Layout style={{ minHeight: "100vh", background: contentBg }}>
      <Header style={{
        background: headerBg,
        borderBottom: "1px solid #1f1f1f",
        padding: "0 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 56,
      }}>
        <Space size={12} align="center">
          <CrownOutlined style={{ color: "#faad14", fontSize: 20 }} />
          <Text style={{ fontWeight: 700, fontSize: 16, color: "#e8e8e8", letterSpacing: -0.3 }}>
            Stride <Tag color="gold" style={{ fontSize: 10, marginLeft: 4 }}>Admin Console</Tag>
          </Text>
        </Space>

        <Space size={12}>
          <Link href="/dashboard">
            <Button type="text" size="small" icon={<ArrowLeftOutlined />} style={{ color: "#888" }}>
              Back to App
            </Button>
          </Link>
          <Dropdown menu={{ items: menuItems, onClick: ({ key }) => { if (key === "logout") { clearAuth(); router.push("/login"); } } }} placement="bottomRight">
            <Space style={{ cursor: "pointer" }}>
              <Avatar size={28} style={{ background: "#faad14", color: "#000" }} icon={<UserOutlined />} />
              <Text style={{ color: "#aaa", fontSize: 13 }}>{user.name}</Text>
            </Space>
          </Dropdown>
        </Space>
      </Header>

      <Content style={{ padding: 24, background: contentBg, minHeight: "calc(100vh - 56px)" }}>
        {children}
      </Content>
    </Layout>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isDark } = useThemeStore();
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: { colorPrimary: "#faad14", borderRadius: 8 },
      }}
    >
      <AdminShell>{children}</AdminShell>
    </ConfigProvider>
  );
}
