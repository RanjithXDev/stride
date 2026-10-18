"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ApiOutlined, ApartmentOutlined, AppstoreOutlined, ArrowUpOutlined,
  AuditOutlined, ClockCircleOutlined, CodeOutlined, CrownOutlined, DashboardOutlined, DollarOutlined, GlobalOutlined,
  FieldTimeOutlined, LogoutOutlined, MenuFoldOutlined, MenuOutlined, ReadOutlined,
  MenuUnfoldOutlined, MoonOutlined, ProjectOutlined, SettingOutlined,
  SunOutlined, TagsOutlined, TeamOutlined, UserOutlined, SearchOutlined,
} from "@ant-design/icons";
import {
  Avatar, Button, ConfigProvider, Drawer, Dropdown, Layout, Menu,
  Skeleton, Tag, Tooltip, theme,
} from "antd";
import Link from "next/link";
import { useAuthStore } from "@/store/auth";
import { useThemeStore } from "@/store/theme";
import styles from "./layout.module.css";
import CommandPalette from "@/components/navigation/CommandPalette";

const { Header, Sider, Content } = Layout;

const coreNavItems = [
  { key: "/dashboard", icon: <DashboardOutlined />, label: <Link href="/dashboard">Dashboard</Link> },
  { key: "/tickets", icon: <TagsOutlined />, label: <Link href="/tickets">Tickets</Link> },
  { key: "/board", icon: <AppstoreOutlined />, label: <Link href="/board">Board</Link> },
  { key: "/projects", icon: <ProjectOutlined />, label: <Link href="/projects">Projects</Link> },
  { key: "/timesheets", icon: <ClockCircleOutlined />, label: <Link href="/timesheets">Timesheets</Link> },
  { key: "/employees", icon: <TeamOutlined />, label: <Link href="/employees">Employees</Link> },
  { key: "/expenses", icon: <DollarOutlined />, label: <Link href="/expenses">Expenses</Link> },
  { key: "/income", icon: <ArrowUpOutlined />, label: <Link href="/income">Income</Link> },
  { key: "/scm", icon: <CodeOutlined />, label: <Link href="/scm">Developer</Link> },
  { key: "/external-issues", icon: <GlobalOutlined />, label: <Link href="/external-issues">External Issues</Link> },
  { key: "/attendance", icon: <FieldTimeOutlined />, label: <Link href="/attendance">Attendance</Link> },
  { key: "/org", icon: <ApartmentOutlined />, label: <Link href="/org">Org chart</Link> },
];

const pageMeta: Record<string, { title: string; description: string }> = {
  "/dashboard": { title: "Dashboard", description: "Your workspace at a glance" },
  "/tickets": { title: "Tickets", description: "Plan, assign, and deliver work" },
  "/board": { title: "Board", description: "Move work forward visually" },
  "/projects": { title: "Projects", description: "Keep initiatives aligned and on track" },
  "/timesheets": { title: "Timesheets", description: "Understand where team time goes" },
  "/employees": { title: "Employees", description: "People, roles, and reporting lines" },
  "/expenses":  { title: "Expenses", description: "Submit, review, and track spending" },
  "/income":    { title: "Income", description: "Track and manage incoming revenue" },
  "/scm":              { title: "Developer", description: "Repositories, PRs, and CI pipelines" },
  "/external-issues":  { title: "External Issues", description: "Issues from Jira, YouTrack, and other tools your team already uses" },
  "/attendance": { title: "Attendance", description: "Today’s team presence and history" },
  "/org": { title: "Org chart", description: "See how your team works together" },
  "/settings": { title: "Company settings", description: "Configure your workspace" },
  "/connections": { title: "Connections", description: "Connect the tools your team uses" },
  "/audit-log": { title: "Audit Log", description: "Track all changes and actions across your organization" },
  "/docs": { title: "Documentation", description: "Learn every Stride workflow and option" },
};

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/dashboard" className={styles.brand} aria-label="Stride dashboard">
      <span className={styles.brandMark}>S</span>
      {!compact && <span className={styles.brandName}>Str<span>ide</span></span>}
    </Link>
  );
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, clearAuth, _hasHydrated } = useAuthStore();
  const { isDark, toggle } = useThemeStore();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    if (_hasHydrated && !user) router.replace("/login");
  }, [_hasHydrated, user, router]);

  useEffect(() => {
    const openSearch = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", openSearch);
    return () => window.removeEventListener("keydown", openSearch);
  }, []);

  const isOrgAdmin = ["FOUNDER", "CPO", "CFO", "HR"].includes(user?.role ?? "");
  const canViewAuditLog = ["FOUNDER", "CPO", "CFO"].includes(user?.role ?? "");
  const adminItems = useMemo(() => [
    ...(isOrgAdmin ? [{ key: "/settings", icon: <SettingOutlined />, label: <Link href="/settings">Company settings</Link> }] : []),
    { key: "/connections", icon: <ApiOutlined />, label: <Link href="/connections">Connections</Link> },
    ...(canViewAuditLog ? [{ key: "/audit-log", icon: <AuditOutlined />, label: <Link href="/audit-log">Audit Log</Link> }] : []),
    ...(user?.isSuperAdmin ? [{ key: "/admin", icon: <CrownOutlined />, label: <Link href="/admin">Admin console</Link> }] : []),
    { key: "/docs", icon: <ReadOutlined />, label: <Link href="/docs">Documentation</Link> },
  ], [isOrgAdmin, canViewAuditLog, user?.isSuperAdmin]);

  if (!_hasHydrated || !user) {
    return <div className={styles.loadingShell}><Skeleton active paragraph={{ rows: 5 }} /></div>;
  }

  const allNav = [...coreNavItems, ...adminItems];
  const activeKey = allNav
    .filter((item) => pathname === item.key || pathname.startsWith(`${item.key}/`))
    .sort((a, b) => b.key.length - a.key.length)[0]?.key ?? "/dashboard";
  const currentMeta = pageMeta[activeKey] ?? { title: "Workspace", description: "" };
  const initials = user.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();

  const userMenuItems = [
    ...(isOrgAdmin ? [{ key: "settings", icon: <SettingOutlined />, label: <Link href="/settings">Company settings</Link> }] : []),
    { type: "divider" as const },
    { key: "logout", icon: <LogoutOutlined />, label: "Sign out", danger: true },
  ];

  const navContent = (mobile = false) => (
    <div className={styles.navBody}>
      <div className={styles.navBrand}><Brand compact={!mobile && collapsed} /></div>
      <div className={styles.navScroll}>
        {!collapsed || mobile ? <div className={styles.navLabel}>Workspace</div> : null}
        <Menu onClick={() => mobile && setMobileOpen(false)} mode="inline" inlineCollapsed={!mobile && collapsed} selectedKeys={[activeKey]} items={coreNavItems} theme={isDark ? "dark" : "light"} />
        {adminItems.length > 0 && <>
          {!collapsed || mobile ? <div className={styles.navLabel}>Manage</div> : <div className={styles.navDivider} />}
          <Menu onClick={() => mobile && setMobileOpen(false)} mode="inline" inlineCollapsed={!mobile && collapsed} selectedKeys={[activeKey]} items={adminItems} theme={isDark ? "dark" : "light"} />
        </>}
      </div>
      {(!collapsed || mobile) && <div className={styles.workspaceCard}>
        <span className={styles.workspaceIcon}>{user.organization?.name?.charAt(0) ?? "S"}</span>
        <div><strong>{user.organization?.name ?? "Stride workspace"}</strong><small>{user.organization?.plan ?? "Workspace"} plan</small></div>
      </div>}
    </div>
  );

  return (
    <>
    <a className={styles.skipLink} href="#main-content">Skip to main content</a>
    <Layout className={styles.appShell} data-theme={isDark ? "dark" : "light"}>
      <Sider className={styles.desktopSider} width={244} collapsedWidth={76} collapsed={collapsed} trigger={null} theme={isDark ? "dark" : "light"}>
        {navContent()}
      </Sider>

      <Drawer className={styles.mobileDrawer} placement="left" width={280} open={mobileOpen} onClose={() => setMobileOpen(false)} styles={{ body: { padding: 0 } }}>
        {navContent(true)}
      </Drawer>

      <Layout className={styles.mainLayout}>
        <Header className={styles.header}>
          <div className={styles.headerLeft}>
            <Button className={styles.mobileMenu} type="text" icon={<MenuOutlined />} onClick={() => setMobileOpen(true)} aria-label="Open navigation" />
            <Tooltip title={collapsed ? "Expand navigation" : "Collapse navigation"}>
              <Button className={styles.collapseButton} type="text" icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />} onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "Expand navigation" : "Collapse navigation"} />
            </Tooltip>
            <div className={styles.pageIdentity}><strong>{currentMeta.title}</strong><span>{currentMeta.description}</span></div>
          </div>

          <div className={styles.headerActions}>
            <button className={styles.searchButton} type="button" onClick={() => setSearchOpen(true)} aria-label="Search workspace">
              <SearchOutlined /><span>Search</span><kbd>⌘ K</kbd>
            </button>
            {user.isSuperAdmin && <Tag className={styles.adminTag} color="gold"><CrownOutlined /> Admin</Tag>}
            <Tooltip title={isDark ? "Use light theme" : "Use dark theme"}>
              <Button className={styles.iconButton} type="text" shape="circle" icon={isDark ? <SunOutlined /> : <MoonOutlined />} onClick={toggle} aria-label={isDark ? "Use light theme" : "Use dark theme"} />
            </Tooltip>
            <Dropdown menu={{ items: userMenuItems, onClick: ({ key }) => { if (key === "logout") { clearAuth(); router.push("/login"); } } }} placement="bottomRight" trigger={["click"]}>
              <button className={styles.profileButton} type="button" aria-label="Open account menu">
                <Avatar className={styles.userAvatar}>{initials || <UserOutlined />}</Avatar>
                <span className={styles.profileCopy}><strong>{user.name}</strong><small>{user.role.replaceAll("_", " ")}</small></span>
                <span className={styles.profileChevron}>⌄</span>
              </button>
            </Dropdown>
          </div>
        </Header>

        <Content className={styles.content} id="main-content" tabIndex={-1}>
          <div className={styles.dashboardSurface}>{children}</div>
        </Content>
      </Layout>
    </Layout>
    <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isDark } = useThemeStore();
  return (
    <ConfigProvider theme={{
      cssVar: {},
      algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
      token: {
        colorPrimary: "#2365e8", borderRadius: 10,
        colorBgLayout: isDark ? "#0b1019" : "#f4f6fa",
        colorBgContainer: isDark ? "#131a24" : "#ffffff",
        colorBgElevated: isDark ? "#19212d" : "#ffffff",
        colorFillAlter: isDark ? "#18212d" : "#f7f8fb",
        colorText: isDark ? "#e8edf5" : "#17233a",
        colorTextSecondary: isDark ? "#929fb2" : "#69768a",
        colorTextTertiary: isDark ? "#6f7c90" : "#929daf",
        colorBorder: isDark ? "#303b4b" : "#dfe4ec",
        colorBorderSecondary: isDark ? "#283140" : "#e8ebf1",
        fontFamily: "Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        controlHeight: 38,
      },
      components: {
        Button: { fontWeight: 650, primaryShadow: "0 6px 16px rgba(35,101,232,.18)" },
        Card: { borderRadiusLG: 13, boxShadowTertiary: "0 8px 24px rgba(22,40,75,.05)" },
        Table: { headerBg: isDark ? "#171d27" : "#f7f8fb", headerColor: isDark ? "#c7cfdb" : "#596579", rowHoverBg: isDark ? "#161d28" : "#f8faff" },
        Modal: { borderRadiusLG: 16 },
        Menu: { itemBorderRadius: 9, itemMarginInline: 10, itemHeight: 42 },
      },
    }}>
      <AppLayout>{children}</AppLayout>
    </ConfigProvider>
  );
}
