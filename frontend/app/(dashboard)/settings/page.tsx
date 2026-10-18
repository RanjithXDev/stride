"use client";
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Typography, Form, Input, InputNumber, Switch, Select,
  Button, Card, Row, Col, Tag, Divider, message, Spin, Tabs,
  Space, Badge, Popconfirm,
} from "antd";
import {
  SettingOutlined, ClockCircleOutlined, TeamOutlined,
  GlobalOutlined, SaveOutlined, BuildOutlined,
  GithubOutlined, ApiOutlined, LinkOutlined, DisconnectOutlined, PlusOutlined,
} from "@ant-design/icons";
import { integrationApi, ScmAppConfig } from "@/lib/integrations";
import { ScmConnection } from "@/types";
import { orgApi } from "@/lib/organization";
import { OrgSettings, Role } from "@/types";
import { useAuthStore } from "@/store/auth";
import { useRouter } from "next/navigation";

const { Title, Text } = Typography;
const { Option } = Select;

const TIMEZONES = [
  "Asia/Kolkata", "Asia/Singapore", "Asia/Dubai", "Asia/Tokyo",
  "Europe/London", "Europe/Paris", "America/New_York", "America/Los_Angeles",
  "UTC",
];

const ALL_ROLES: Role[] = ["FOUNDER", "CPO", "CFO", "HR", "MANAGER", "TEAM_LEAD", "EMPLOYEE"];

const ROLE_DESCRIPTIONS: Record<Role, string> = {
  FOUNDER:   "Top-level authority, full access",
  CPO:       "Chief People Officer, oversees HR",
  CFO:       "Chief Financial Officer, financial control",
  HR:        "HR Manager, manages employee onboarding & records",
  MANAGER:   "Department manager, manages team",
  TEAM_LEAD: "Team lead, supervises a small group",
  EMPLOYEE:  "Individual contributor",
};
const PLAN_COLORS: Record<string, string> = {
  FREE: "default", STARTER: "blue", GROWTH: "green", ENTERPRISE: "gold",
};

export default function SettingsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const isOrgAdmin = ["FOUNDER","CPO","CFO","HR"].includes(user?.role ?? "") || user?.isSuperAdmin;
  useEffect(() => {
    if (user && !isOrgAdmin) router.replace("/dashboard");
  }, [user, isOrgAdmin, router]);

  const { data: org, isLoading } = useQuery({
    queryKey: ["org-settings"],
    queryFn: orgApi.getSettings,
    enabled: !!isOrgAdmin,
  });

  const [generalForm] = Form.useForm();
  const [attendanceForm] = Form.useForm();
  const [rolesForm] = Form.useForm();

  useEffect(() => {
    if (!org) return;
    const s = org.settings;
    generalForm.setFieldsValue({ name: org.name, logoUrl: org.logoUrl, timezone: s.timezone });
    attendanceForm.setFieldsValue({
      halfDayMinutes: s.halfDayMinutes,
      fullDayMinutes: s.fullDayMinutes,
      workdayStart: s.workdayStart,
      workdayEnd: s.workdayEnd,
      allowWFH: s.allowWFH,
      requireLocation: s.requireLocation,
    });
    rolesForm.setFieldsValue({
      enabledRoles: s.enabledRoles,
      hierarchyAdminRoles:    s.hierarchyAdminRoles    ?? ["FOUNDER","CPO","CFO","HR"],
      orgWideVisibilityRoles: s.orgWideVisibilityRoles ?? ["FOUNDER","CPO","CFO","HR"],
      ...Object.fromEntries(ALL_ROLES.map((r) => [`label_${r}`, s.roleLabels?.[r] ?? r])),
      ...Object.fromEntries(ALL_ROLES.map((r) => [`color_${r}`, s.roleColors?.[r] ?? ""])),
    });
  }, [org, generalForm, attendanceForm, rolesForm]);

  const saveMutation = useMutation({
    mutationFn: orgApi.updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-settings"] });
      message.success("Settings saved");
    },
    onError: () => message.error("Failed to save settings"),
  });

  function saveGeneral(values: any) {
    saveMutation.mutate({
      name: values.name,
      logoUrl: values.logoUrl || null,
      settings: { timezone: values.timezone },
    });
  }

  function saveAttendance(values: any) {
    saveMutation.mutate({
      settings: {
        halfDayMinutes: values.halfDayMinutes,
        fullDayMinutes: values.fullDayMinutes,
        workdayStart: values.workdayStart,
        workdayEnd: values.workdayEnd,
        allowWFH: values.allowWFH,
        requireLocation: values.requireLocation,
      },
    });
  }

  function saveRoles(values: any) {
    const roleLabels: Record<string, string> = {};
    const roleColors: Record<string, string> = {};
    ALL_ROLES.forEach((r) => {
      roleLabels[r] = values[`label_${r}`] || r;
      if (values[`color_${r}`]) roleColors[r] = values[`color_${r}`];
    });
    saveMutation.mutate({
      settings: {
        enabledRoles: values.enabledRoles,
        roleLabels,
        roleColors,
        hierarchyAdminRoles:    values.hierarchyAdminRoles,
        orgWideVisibilityRoles: values.orgWideVisibilityRoles,
      },
    });
  }

  if (isLoading) return (
    <div style={{ display: "flex", justifyContent: "center", padding: 64 }}>
      <Spin size="large" />
    </div>
  );

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <div style={{ marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <SettingOutlined style={{ fontSize: 24, color: "#1677ff" }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>Company Settings</Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Configure your organisation&apos;s policies and structure
            </Text>
          </div>
        </div>
        {org && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Plan:</Text>
            <Tag color={PLAN_COLORS[org.plan] ?? "default"} style={{ fontWeight: 600 }}>
              {org.plan}
            </Tag>
          </div>
        )}
      </div>

      <Tabs
        items={[
          {
            key: "general",
            label: <span><GlobalOutlined /> General</span>,
            children: (
              <Card style={{ borderRadius: 8 }}>
                <Form form={generalForm} layout="vertical" onFinish={saveGeneral}>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item name="name" label="Company Name" rules={[{ required: true }]}>
                        <Input placeholder="Acme Corp" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="logoUrl" label="Logo URL">
                        <Input placeholder="https://..." />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item name="timezone" label="Timezone">
                    <Select showSearch>
                      {TIMEZONES.map((tz) => <Option key={tz} value={tz}>{tz}</Option>)}
                    </Select>
                  </Form.Item>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saveMutation.isPending}>
                      Save General Settings
                    </Button>
                  </div>
                </Form>
              </Card>
            ),
          },
          {
            key: "attendance",
            label: <span><ClockCircleOutlined /> Attendance</span>,
            children: (
              <Card style={{ borderRadius: 8 }}>
                <Text type="secondary" style={{ display: "block", marginBottom: 20, fontSize: 13 }}>
                  Configure working hours and attendance thresholds for your organisation.
                </Text>
                <Form form={attendanceForm} layout="vertical" onFinish={saveAttendance}>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        name="halfDayMinutes"
                        label="Half Day Threshold (minutes)"
                        extra="Sessions totalling at least this many minutes count as half day"
                      >
                        <InputNumber min={60} max={480} style={{ width: "100%" }} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="fullDayMinutes"
                        label="Full Day Threshold (minutes)"
                        extra="Sessions totalling at least this many minutes count as full day"
                      >
                        <InputNumber min={120} max={720} style={{ width: "100%" }} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item name="workdayStart" label="Workday Start">
                        <Input placeholder="09:00" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="workdayEnd" label="Workday End">
                        <Input placeholder="18:00" />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item name="allowWFH" label="Allow Work From Home" valuePropName="checked">
                        <Switch />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="requireLocation" label="Require Location on Check-In" valuePropName="checked">
                        <Switch />
                      </Form.Item>
                    </Col>
                  </Row>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saveMutation.isPending}>
                      Save Attendance Settings
                    </Button>
                  </div>
                </Form>
              </Card>
            ),
          },
          {
            key: "roles",
            label: <span><TeamOutlined /> Roles & Hierarchy</span>,
            children: (
              <Card style={{ borderRadius: 8 }}>
                <Text type="secondary" style={{ display: "block", marginBottom: 20, fontSize: 13 }}>
                  Configure which roles are active, their display names, brand colours, and which roles control the org hierarchy and attendance visibility.
                </Text>
                <Form form={rolesForm} layout="vertical" onFinish={saveRoles}>

                  {/* ── Active roles ───────────────────────────────────── */}
                  <Form.Item
                    name="enabledRoles"
                    label="Active Roles"
                    extra="Only enabled roles can be assigned to employees"
                  >
                    <Select mode="multiple" placeholder="Select roles">
                      {ALL_ROLES.map((r) => <Option key={r} value={r}>{r}</Option>)}
                    </Select>
                  </Form.Item>

                  {/* ── Role labels + colours ──────────────────────────── */}
                  <Divider>Role Display Names &amp; Colours</Divider>
                  <Row gutter={[16, 0]}>
                    {ALL_ROLES.map((r) => (
                      <Col span={12} key={r}>
                        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                          <Form.Item name={`label_${r}`} label={`${r}`} style={{ flex: 1, marginBottom: 12 }}>
                            <Input placeholder={r} prefix={<Tag style={{ margin: 0, fontSize: 10 }}>{r}</Tag>} />
                          </Form.Item>
                          <Form.Item name={`color_${r}`} label="Colour" style={{ width: 80, marginBottom: 12 }}>
                            <Input type="color" style={{ padding: "2px 4px", height: 32, cursor: "pointer" }} />
                          </Form.Item>
                        </div>
                      </Col>
                    ))}
                  </Row>

                  {/* ── Hierarchy permissions ──────────────────────────── */}
                  <Divider>Hierarchy Permissions</Divider>
                  <Row gutter={[16, 16]}>
                    <Col span={12}>
                      <Form.Item
                        name="hierarchyAdminRoles"
                        label="Can change org chart / reporting lines"
                        extra="Only these roles can reassign who reports to whom"
                      >
                        <Select mode="multiple" placeholder="Select roles">
                          {ALL_ROLES.filter((r) => r !== "EMPLOYEE").map((r) => (
                            <Option key={r} value={r}>{r}</Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="orgWideVisibilityRoles"
                        label="Can see all employees' attendance"
                        extra="These roles have org-wide attendance visibility"
                      >
                        <Select mode="multiple" placeholder="Select roles">
                          {ALL_ROLES.filter((r) => r !== "EMPLOYEE").map((r) => (
                            <Option key={r} value={r}>{r}</Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>

                  <div style={{ padding: "12px 16px", background: "color-mix(in srgb, #faad14 12%, var(--app-surface))", borderRadius: 8, marginBottom: 16, fontSize: 12 }}>
                    <strong>Visibility rules:</strong> roles in "org-wide" see everyone's attendance.
                    MANAGER always sees their full reporting subtree. TEAM_LEAD sees direct reports only.
                    EMPLOYEE sees only themselves.
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saveMutation.isPending}>
                      Save Role Settings
                    </Button>
                  </div>
                </Form>
              </Card>
            ),
          },
          {
            key: "integrations",
            label: <span><ApiOutlined /> Integrations</span>,
            children: <IntegrationsTab />,
          },
        ]}
      />
    </div>
  );
}

function IntegrationsTab() {
  const qc = useQueryClient();
  const [ghForm] = Form.useForm();
  const [glForm] = Form.useForm();

  const { data: scmConfig, isLoading: configLoading } = useQuery<ScmAppConfig>({ queryKey: ["scm-config"], queryFn: integrationApi.getScmConfig });
  const { data: connections = [], isLoading: connLoading } = useQuery<ScmConnection[]>({ queryKey: ["scm-connections"], queryFn: integrationApi.getConnections });

  const saveMut = useMutation({
    mutationFn: integrationApi.saveScmConfig,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["scm-config"] }); message.success("Configuration saved"); },
    onError: (e: any) => message.error(e?.response?.data?.message ?? "Save failed"),
  });

  const clearMut = useMutation({
    mutationFn: integrationApi.clearScmConfig,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["scm-config", "scm-connections"] }); message.success("Configuration cleared"); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => integrationApi.deleteConnection(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["scm-connections"] }); message.success("Connection revoked"); },
    onError: () => message.error("Failed to revoke connection"),
  });

  const github = connections.filter((c) => c.provider === "GITHUB");
  const gitlab = connections.filter((c) => c.provider === "GITLAB");
  const statusColor: Record<string, string> = { ACTIVE: "success", EXPIRED: "warning", REVOKED: "error", ERROR: "error" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* ─── Step 1: OAuth App Configuration ─── */}
      <Card
        title={<Space><SettingOutlined style={{ color: "#1677ff" }} /><span>OAuth App Configuration</span></Space>}
        style={{ borderRadius: 8 }}
        extra={<Tag color="blue">Step 1: Set up your app credentials</Tag>}
      >
        <div style={{ color: "#888", fontSize: 12, marginBottom: 20 }}>
          Register an OAuth App on GitHub or GitLab and enter the credentials below. Each company configures its own app — your client secret is stored encrypted.
        </div>

        {/* GitHub App Config */}
        <Divider orientationMargin={0} style={{ fontSize: 13 }}><GithubOutlined /> GitHub OAuth App</Divider>
        {configLoading ? <Spin size="small" /> : (
          <Form
            form={ghForm}
            layout="vertical"
            initialValues={{ clientId: scmConfig?.github.clientId, callbackUrl: scmConfig?.github.callbackUrl }}
            onFinish={(v) => saveMut.mutate({ provider: "GITHUB", ...v })}
          >
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="clientId" label="Client ID" rules={[{ required: true }]}>
                  <Input placeholder="Ghp_xxxxxxxxxxxx" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="clientSecret" label="Client Secret (leave blank to keep existing)">
                  <Input.Password placeholder="Enter new secret to update" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="callbackUrl" label="OAuth Callback URL" extra={`Set this as the Callback URL in your GitHub OAuth App settings`}>
              <Input placeholder={`${typeof window !== "undefined" ? window.location.origin.replace("3000", "4000") : "http://localhost:4000"}/api/v1/integrations/github/callback`} />
            </Form.Item>
            <div style={{ display: "flex", gap: 8 }}>
              <Button type="primary" htmlType="submit" loading={saveMut.isPending} icon={<SaveOutlined />}>
                {scmConfig?.github.configured ? "Update GitHub Config" : "Save GitHub Config"}
              </Button>
              {scmConfig?.github.configured && (
                <Popconfirm title="Clear GitHub app configuration?" onConfirm={() => clearMut.mutate("GITHUB")} okButtonProps={{ danger: true }}>
                  <Button danger>Clear</Button>
                </Popconfirm>
              )}
            </div>
          </Form>
        )}

        {/* GitLab App Config */}
        <Divider orientationMargin={0} style={{ fontSize: 13, marginTop: 24 }}><LinkOutlined /> GitLab OAuth App</Divider>
        {configLoading ? <Spin size="small" /> : (
          <Form
            form={glForm}
            layout="vertical"
            initialValues={{ clientId: scmConfig?.gitlab.clientId, callbackUrl: scmConfig?.gitlab.callbackUrl, host: scmConfig?.gitlab.host || "https://gitlab.com" }}
            onFinish={(v) => saveMut.mutate({ provider: "GITLAB", ...v })}
          >
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="clientId" label="Application ID" rules={[{ required: true }]}>
                  <Input placeholder="1234567890abcdef" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="clientSecret" label="Secret (leave blank to keep existing)">
                  <Input.Password placeholder="Enter new secret to update" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="host" label="GitLab Host" extra="For self-managed GitLab instances">
                  <Input placeholder="https://gitlab.com" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="callbackUrl" label="Redirect URI">
                  <Input placeholder={`${typeof window !== "undefined" ? window.location.origin.replace("3000", "4000") : "http://localhost:4000"}/api/v1/integrations/gitlab/callback`} />
                </Form.Item>
              </Col>
            </Row>
            <div style={{ display: "flex", gap: 8 }}>
              <Button type="primary" htmlType="submit" loading={saveMut.isPending} icon={<SaveOutlined />}>
                {scmConfig?.gitlab.configured ? "Update GitLab Config" : "Save GitLab Config"}
              </Button>
              {scmConfig?.gitlab.configured && (
                <Popconfirm title="Clear GitLab app configuration?" onConfirm={() => clearMut.mutate("GITLAB")} okButtonProps={{ danger: true }}>
                  <Button danger>Clear</Button>
                </Popconfirm>
              )}
            </div>
          </Form>
        )}
      </Card>

      {/* ─── Step 2: Connect Accounts ─── */}
      <Card
        title={<Space><LinkOutlined style={{ color: "#52c41a" }} /><span>Connected Accounts</span></Space>}
        style={{ borderRadius: 8 }}
        extra={<Tag color="green">Step 2: Connect your accounts</Tag>}
      >
        <div style={{ color: "#888", fontSize: 12, marginBottom: 20 }}>
          After configuring your OAuth App above, connect your GitHub or GitLab organization account here. This account will be used to manage repository access for all projects.
        </div>

        {/* GitHub Accounts */}
        <Divider orientationMargin={0} style={{ fontSize: 13 }}><GithubOutlined /> GitHub</Divider>
        {connLoading ? <Spin size="small" /> : (
          <>
            {github.length === 0 && <div style={{ color: "#888", fontSize: 13, marginBottom: 12 }}>No GitHub accounts connected.</div>}
            {github.map((conn) => (
              <div key={conn.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #f0f0f0" }}>
                <Space>
                  <GithubOutlined style={{ fontSize: 16 }} />
                  <div><div style={{ fontWeight: 600, fontSize: 13 }}>{conn.accountName}</div>
                  <Badge status={statusColor[conn.status] as any} text={conn.status} style={{ fontSize: 11 }} /></div>
                </Space>
                <Popconfirm title="Revoke this connection?" onConfirm={() => deleteMutation.mutate(conn.id)} okButtonProps={{ danger: true }}>
                  <Button size="small" danger icon={<DisconnectOutlined />}>Disconnect</Button>
                </Popconfirm>
              </div>
            ))}
            <Button
              icon={<GithubOutlined />}
              style={{ marginTop: 12 }}
              disabled={!scmConfig?.github.configured}
              title={!scmConfig?.github.configured ? "Configure GitHub OAuth App first (Step 1)" : undefined}
              onClick={() => integrationApi.connectGitHub()}
            >
              {github.length ? "Add another GitHub Account" : "Connect GitHub Account"}
            </Button>
            {!scmConfig?.github.configured && (
              <div style={{ fontSize: 11, color: "#ff7a45", marginTop: 4 }}>Configure GitHub OAuth App (Step 1) first to enable this.</div>
            )}
          </>
        )}

        {/* GitLab Accounts */}
        <Divider orientationMargin={0} style={{ fontSize: 13, marginTop: 16 }}><LinkOutlined /> GitLab</Divider>
        {connLoading ? <Spin size="small" /> : (
          <>
            {gitlab.length === 0 && <div style={{ color: "#888", fontSize: 13, marginBottom: 12 }}>No GitLab accounts connected.</div>}
            {gitlab.map((conn) => (
              <div key={conn.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #f0f0f0" }}>
                <Space>
                  <LinkOutlined style={{ fontSize: 16 }} />
                  <div><div style={{ fontWeight: 600, fontSize: 13 }}>{conn.accountName}</div>
                  <Badge status={statusColor[conn.status] as any} text={conn.status} style={{ fontSize: 11 }} /></div>
                </Space>
                <Popconfirm title="Revoke this connection?" onConfirm={() => deleteMutation.mutate(conn.id)} okButtonProps={{ danger: true }}>
                  <Button size="small" danger icon={<DisconnectOutlined />}>Disconnect</Button>
                </Popconfirm>
              </div>
            ))}
            <Button
              icon={<LinkOutlined />}
              style={{ marginTop: 12 }}
              disabled={!scmConfig?.gitlab.configured}
              title={!scmConfig?.gitlab.configured ? "Configure GitLab OAuth App first (Step 1)" : undefined}
              onClick={() => integrationApi.connectGitLab()}
            >
              {gitlab.length ? "Add another GitLab Account" : "Connect GitLab Account"}
            </Button>
            {!scmConfig?.gitlab.configured && (
              <div style={{ fontSize: 11, color: "#ff7a45", marginTop: 4 }}>Configure GitLab OAuth App (Step 1) first to enable this.</div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
