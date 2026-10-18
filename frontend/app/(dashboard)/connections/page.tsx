"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Typography, Card, Tag, Button, Modal, Form, Input, Row, Col,
  Space, Badge, Popconfirm, Spin, message, Avatar, Divider,
} from "antd";
import {
  GithubOutlined, LinkOutlined, ApiOutlined, CheckCircleOutlined,
  ClockCircleOutlined, SettingOutlined, DisconnectOutlined, PlusOutlined,
  LockOutlined, UserOutlined,
} from "@ant-design/icons";
import { integrationApi, ScmAppConfig } from "@/lib/integrations";
import { ScmConnection, EmployeeIdentity } from "@/types";
import { useAuthStore } from "@/store/auth";

const { Title, Text } = Typography;

// Roles that can manage org-level connectors
const CAN_MANAGE_ROLES = ["FOUNDER", "CPO", "CFO", "HR", "MANAGER"];

interface Connector {
  key: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: string;
  active: boolean;
  providerKey?: "GITHUB" | "GITLAB";
  color: string;
}

const CONNECTORS: Connector[] = [
  {
    key: "github",
    name: "GitHub",
    description: "Sync repositories, automate access control for project members, and track code changes.",
    icon: <GithubOutlined style={{ fontSize: 32 }} />,
    category: "Source Control",
    active: true,
    providerKey: "GITHUB",
    color: "#24292f",
  },
  {
    key: "gitlab",
    name: "GitLab",
    description: "Connect self-managed or cloud GitLab instances to manage repo access across projects.",
    icon: <LinkOutlined style={{ fontSize: 32, color: "#fc6d26" }} />,
    category: "Source Control",
    active: true,
    providerKey: "GITLAB",
    color: "#fc6d26",
  },
  {
    key: "slack",
    name: "Slack",
    description: "Send ticket updates, attendance alerts, and project notifications directly to Slack channels.",
    icon: <ApiOutlined style={{ fontSize: 32, color: "#4a154b" }} />,
    category: "Messaging",
    active: false,
    color: "#4a154b",
  },
  {
    key: "msteams",
    name: "Microsoft Teams",
    description: "Post standup summaries, expense approvals, and HR notifications to Teams channels.",
    icon: <ApiOutlined style={{ fontSize: 32, color: "#6264a7" }} />,
    category: "Messaging",
    active: false,
    color: "#6264a7",
  },
  {
    key: "google",
    name: "Google Workspace",
    description: "Sync attendance with Google Calendar and auto-provision GSuite accounts for new hires.",
    icon: <ApiOutlined style={{ fontSize: 32, color: "#ea4335" }} />,
    category: "Productivity",
    active: false,
    color: "#ea4335",
  },
  {
    key: "notion",
    name: "Notion",
    description: "Export project wikis and meeting notes to Notion pages automatically.",
    icon: <ApiOutlined style={{ fontSize: 32, color: "#000000" }} />,
    category: "Productivity",
    active: false,
    color: "#000000",
  },
];

const PROVIDER_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  GITHUB: { label: "GitHub",    icon: <GithubOutlined />, color: "#24292f" },
  GITLAB: { label: "GitLab",    icon: <LinkOutlined />,   color: "#fc6d26" },
};

function MyDeveloperAccounts() {
  const qc = useQueryClient();
  const { data: identities = [], isLoading } = useQuery<EmployeeIdentity[]>({
    queryKey: ["my-identities"],
    queryFn: integrationApi.getMyIdentities,
  });

  const { data: connections = [] } = useQuery<ScmConnection[]>({
    queryKey: ["scm-connections"],
    queryFn: integrationApi.getConnections,
  });

  const disconnectMut = useMutation({
    mutationFn: (id: string) => integrationApi.disconnectIdentity(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-identities"] }); message.success("Account disconnected"); },
    onError: (e: any) => message.error(e?.response?.data?.message ?? "Failed to disconnect"),
  });

  // Only show providers that the org has configured+connected
  const availableProviders = [...new Set(
    connections.filter((c) => c.status === "ACTIVE").map((c) => c.provider)
  )];
  const linkedProviders = new Set(identities.map((i) => i.connection.provider));

  return (
    <Card
      title={
        <Space>
          <UserOutlined />
          My Developer Accounts
        </Space>
      }
      styles={{ body: { padding: "16px 24px" } }}
    >
      <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 16 }}>
        Link your personal GitHub or GitLab account so Stride can grant you access to project repositories automatically.
      </Text>

      {isLoading ? <Spin size="small" /> : (
        <>
          {identities.length === 0 && availableProviders.length === 0 && (
            <Text type="secondary" style={{ fontSize: 13 }}>
              No integrations are active yet. Ask your admin to set up a GitHub or GitLab connection first.
            </Text>
          )}

          {/* Linked identities */}
          {identities.map((identity) => {
            const meta = PROVIDER_META[identity.connection.provider] ?? PROVIDER_META["GITHUB"];
            return (
              <div
                key={identity.id}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 0", borderBottom: "1px solid #f0f0f0",
                }}
              >
                <Space>
                  <Avatar
                    src={identity.avatarUrl}
                    size={32}
                    icon={<UserOutlined />}
                    style={{ background: meta.color, flexShrink: 0 }}
                  />
                  <div>
                    <Space size={6}>
                      <Text strong style={{ fontSize: 13 }}>{identity.username}</Text>
                      <Tag color="default" style={{ fontSize: 10 }}>
                        {meta.icon} {meta.label}
                      </Tag>
                      <Badge status="success" text="Linked" style={{ fontSize: 11 }} />
                    </Space>
                    {identity.email && (
                      <div style={{ fontSize: 11, color: "#888" }}>{identity.email}</div>
                    )}
                  </div>
                </Space>
                <Popconfirm
                  title="Disconnect this account?"
                  description="This may affect your access to linked repositories."
                  onConfirm={() => disconnectMut.mutate(identity.id)}
                  okButtonProps={{ danger: true }}
                >
                  <Button size="small" danger icon={<DisconnectOutlined />}>Disconnect</Button>
                </Popconfirm>
              </div>
            );
          })}

          {/* Connect buttons for unlinked but available providers */}
          {availableProviders.filter((p) => !linkedProviders.has(p)).map((provider) => {
            const meta = PROVIDER_META[provider] ?? PROVIDER_META["GITHUB"];
            return (
              <div key={provider} style={{ paddingTop: identities.length > 0 ? 14 : 0, display: "flex", gap: 12, flexWrap: "wrap" }}>
                <Button
                  icon={meta.icon}
                  onClick={() => integrationApi.connectIdentity(provider.toLowerCase() as "github" | "gitlab")}
                  style={{ borderColor: meta.color, color: meta.color }}
                >
                  Connect {meta.label} Account
                </Button>
              </div>
            );
          })}

          {/* Already linked all available providers */}
          {availableProviders.length > 0 && availableProviders.every((p) => linkedProviders.has(p)) && (
            <div style={{ marginTop: identities.length > 0 ? 14 : 0 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                <CheckCircleOutlined style={{ color: "#52c41a", marginRight: 6 }} />
                All available developer accounts are linked.
              </Text>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

export default function ConnectionsPage() {
  const { user } = useAuthStore();
  const [activeConnector, setActiveConnector] = useState<Connector | null>(null);

  const canManage = CAN_MANAGE_ROLES.includes(user?.role ?? "");
  const categories = [...new Set(CONNECTORS.map((c) => c.category))];

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ marginBottom: 28 }}>
        <Title level={4} style={{ margin: 0 }}>Connections</Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          Link your personal developer accounts and manage integrations with external tools.
        </Text>
      </div>

      {/* My Developer Accounts — visible to everyone */}
      <MyDeveloperAccounts />

      {/* Org-level connectors — managers+ only */}
      {canManage ? (
        <>
          <Divider style={{ margin: "28px 0 20px" }} />
          <div style={{ marginBottom: 20 }}>
            <Title level={5} style={{ margin: 0 }}>Organisation Connectors</Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Set up OAuth App credentials and authorise organisation-level accounts for each integration.
            </Text>
          </div>
          {categories.map((cat) => (
            <div key={cat} style={{ marginBottom: 32 }}>
              <Text style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "#888", textTransform: "uppercase", display: "block", marginBottom: 12 }}>
                {cat}
              </Text>
              <Row gutter={[16, 16]}>
                {CONNECTORS.filter((c) => c.category === cat).map((connector) => (
                  <Col key={connector.key} xs={24} sm={12} lg={8}>
                    <ConnectorCard
                      connector={connector}
                      canManage={canManage}
                      onConfigure={() => setActiveConnector(connector)}
                    />
                  </Col>
                ))}
              </Row>
            </div>
          ))}
        </>
      ) : (
        <div style={{ marginTop: 12 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            <LockOutlined style={{ marginRight: 6 }} />
            Organisation connector setup is restricted to managers and admins.
          </Text>
        </div>
      )}

      {activeConnector?.active && (
        <ConnectorConfigModal
          connector={activeConnector}
          open={!!activeConnector}
          onClose={() => setActiveConnector(null)}
        />
      )}
    </div>
  );
}

function ConnectorCard({ connector, canManage, onConfigure }: { connector: Connector; canManage: boolean; onConfigure: () => void }) {
  const { data: connections = [] } = useQuery<ScmConnection[]>({
    queryKey: ["scm-connections"],
    queryFn: integrationApi.getConnections,
    enabled: connector.active,
  });

  const { data: scmConfig } = useQuery<ScmAppConfig>({
    queryKey: ["scm-config"],
    queryFn: integrationApi.getScmConfig,
    enabled: connector.active,
  });

  const connected = connections.filter((c) => c.provider === connector.providerKey && c.status === "ACTIVE");
  const isConfigured = connector.providerKey === "GITHUB" ? scmConfig?.github.configured : scmConfig?.gitlab.configured;

  return (
    <Card
      style={{
        borderRadius: 10,
        border: connector.active && isConfigured ? `1.5px solid ${connector.color}22` : "1px solid #f0f0f0",
        height: "100%",
        opacity: connector.active ? 1 : 0.75,
      }}
      styles={{ body: { padding: 20, display: "flex", flexDirection: "column", height: "100%" } }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 12,
          background: connector.active ? `${connector.color}12` : "var(--app-subtle)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {connector.icon}
        </div>
        {!connector.active ? (
          <Tag icon={<ClockCircleOutlined />} color="default">Coming Soon</Tag>
        ) : connected.length > 0 ? (
          <Badge status="success" text={`${connected.length} connected`} style={{ fontSize: 12 }} />
        ) : (
          <Badge status="default" text="Not connected" style={{ fontSize: 12 }} />
        )}
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{connector.name}</div>
        <Tag color="default" style={{ fontSize: 10, marginBottom: 8 }}>{connector.category}</Tag>
        <Text type="secondary" style={{ fontSize: 12, display: "block", lineHeight: 1.5 }}>
          {connector.description}
        </Text>
      </div>

      <div style={{ marginTop: 16 }}>
        {!connector.active ? (
          <Button disabled block style={{ borderRadius: 6 }}>Coming Soon</Button>
        ) : canManage ? (
          <Button
            type={isConfigured ? "default" : "primary"}
            icon={isConfigured ? <SettingOutlined /> : <PlusOutlined />}
            block
            style={{ borderRadius: 6 }}
            onClick={onConfigure}
          >
            {isConfigured ? "Manage Connection" : "Set Up Connection"}
          </Button>
        ) : (
          <Button disabled block style={{ borderRadius: 6 }} icon={<LockOutlined />}>
            Admin access required
          </Button>
        )}
      </div>
    </Card>
  );
}

function ConnectorConfigModal({ connector, open, onClose }: { connector: Connector; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [ghForm] = Form.useForm();
  const [glForm] = Form.useForm();
  const isGithub = connector.providerKey === "GITHUB";

  const { data: scmConfig, isLoading: configLoading } = useQuery<ScmAppConfig>({
    queryKey: ["scm-config"],
    queryFn: integrationApi.getScmConfig,
  });

  const { data: connections = [], isLoading: connLoading } = useQuery<ScmConnection[]>({
    queryKey: ["scm-connections"],
    queryFn: integrationApi.getConnections,
  });

  const providerConns = connections.filter((c) => c.provider === connector.providerKey && c.status === "ACTIVE");
  const configured = isGithub ? scmConfig?.github.configured : scmConfig?.gitlab.configured;

  const saveMut = useMutation({
    mutationFn: integrationApi.saveScmConfig,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["scm-config"] }); message.success("Credentials saved"); },
    onError: (e: any) => message.error(e?.response?.data?.message ?? "Save failed"),
  });

  const clearMut = useMutation({
    mutationFn: integrationApi.clearScmConfig,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["scm-config", "scm-connections"] }); message.success("Configuration cleared"); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => integrationApi.deleteConnection(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["scm-connections"] }); message.success("Account disconnected"); },
  });

  const connectFn = isGithub ? integrationApi.connectGitHub : () => integrationApi.connectGitLab();
  const callbackPlaceholder = `http://localhost:4000/api/v1/integrations/${isGithub ? "github" : "gitlab"}/callback`;
  const docsUrl = isGithub ? "https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app" : "https://docs.gitlab.com/ee/integration/oauth_provider.html";

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={
        <Space>
          {connector.icon}
          <span>{connector.name} Connection</span>
        </Space>
      }
      footer={null}
      width={620}
      destroyOnClose
    >
      {/* Step 1: App Credentials */}
      <div style={{ background: "var(--app-subtle)", borderRadius: 8, padding: "16px 20px", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <Space>
            <div style={{ width: 22, height: 22, borderRadius: "50%", background: configured ? "#52c41a" : "#1677ff", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 700 }}>
              {configured ? <CheckCircleOutlined /> : "1"}
            </div>
            <Text strong>OAuth App Credentials</Text>
          </Space>
          {configured && <Tag color="success">Configured</Tag>}
        </div>
        <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 12 }}>
          Register an OAuth App on {connector.name} and paste the credentials below.{" "}
          <a href={docsUrl} target="_blank" rel="noreferrer">How to create an OAuth App →</a>
        </Text>

        {configLoading ? <Spin size="small" /> : isGithub ? (
          <Form
            form={ghForm}
            layout="vertical"
            size="small"
            initialValues={{ clientId: scmConfig?.github.clientId, callbackUrl: scmConfig?.github.callbackUrl || callbackPlaceholder }}
            onFinish={(v) => saveMut.mutate({ provider: "GITHUB", ...v })}
          >
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="clientId" label="Client ID" rules={[{ required: true }]}>
                  <Input placeholder="Ov23li..." />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="clientSecret" label={`Client Secret${configured ? " (leave blank to keep)" : ""}`}>
                  <Input.Password placeholder={configured ? "••••••••" : "Required"} />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="callbackUrl" label="Authorization Callback URL" extra="Copy this into your GitHub OAuth App settings">
              <Input />
            </Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" size="small" loading={saveMut.isPending}>
                {configured ? "Update Credentials" : "Save Credentials"}
              </Button>
              {configured && (
                <Popconfirm title="Clear credentials and all connections?" onConfirm={() => clearMut.mutate("GITHUB")} okButtonProps={{ danger: true }}>
                  <Button size="small" danger>Clear</Button>
                </Popconfirm>
              )}
            </Space>
          </Form>
        ) : (
          <Form
            form={glForm}
            layout="vertical"
            size="small"
            initialValues={{ clientId: scmConfig?.gitlab.clientId, callbackUrl: scmConfig?.gitlab.callbackUrl || callbackPlaceholder, host: scmConfig?.gitlab.host || "https://gitlab.com" }}
            onFinish={(v) => saveMut.mutate({ provider: "GITLAB", ...v })}
          >
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="clientId" label="Application ID" rules={[{ required: true }]}>
                  <Input placeholder="abc123..." />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="clientSecret" label={`Secret${configured ? " (leave blank to keep)" : ""}`}>
                  <Input.Password placeholder={configured ? "••••••••" : "Required"} />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="host" label="GitLab Host">
                  <Input placeholder="https://gitlab.com" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="callbackUrl" label="Redirect URI">
                  <Input />
                </Form.Item>
              </Col>
            </Row>
            <Space>
              <Button type="primary" htmlType="submit" size="small" loading={saveMut.isPending}>
                {configured ? "Update Credentials" : "Save Credentials"}
              </Button>
              {configured && (
                <Popconfirm title="Clear credentials and all connections?" onConfirm={() => clearMut.mutate("GITLAB")} okButtonProps={{ danger: true }}>
                  <Button size="small" danger>Clear</Button>
                </Popconfirm>
              )}
            </Space>
          </Form>
        )}
      </div>

      {/* Step 2: Connected Accounts */}
      <div style={{ background: "var(--app-subtle)", borderRadius: 8, padding: "16px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <Space>
            <div style={{ width: 22, height: 22, borderRadius: "50%", background: providerConns.length > 0 ? "#52c41a" : "#d9d9d9", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 700 }}>
              {providerConns.length > 0 ? <CheckCircleOutlined /> : "2"}
            </div>
            <Text strong>Connected Accounts</Text>
          </Space>
          {providerConns.length > 0 && <Tag color="success">{providerConns.length} active</Tag>}
        </div>
        <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 12 }}>
          Authorize your {connector.name} account. This account will be used to manage repository access.
        </Text>

        {connLoading ? <Spin size="small" /> : (
          <>
            {providerConns.length === 0 ? (
              <Text type="secondary" style={{ fontSize: 12 }}>No accounts connected yet.</Text>
            ) : (
              providerConns.map((conn) => (
                <div key={conn.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f0f0f0" }}>
                  <Space>
                    {isGithub ? <GithubOutlined /> : <LinkOutlined />}
                    <Text style={{ fontWeight: 600, fontSize: 13 }}>{conn.accountName}</Text>
                    <Badge status="success" text="Active" style={{ fontSize: 11 }} />
                  </Space>
                  <Popconfirm title="Disconnect this account?" onConfirm={() => deleteMut.mutate(conn.id)} okButtonProps={{ danger: true }}>
                    <Button size="small" danger icon={<DisconnectOutlined />}>Disconnect</Button>
                  </Popconfirm>
                </div>
              ))
            )}
            <Button
              type={providerConns.length === 0 ? "primary" : "default"}
              size="small"
              icon={isGithub ? <GithubOutlined /> : <LinkOutlined />}
              style={{ marginTop: 12 }}
              disabled={!configured}
              onClick={() => connectFn()}
              title={!configured ? "Set up OAuth App credentials first (Step 1)" : undefined}
            >
              {providerConns.length === 0 ? `Connect ${connector.name} Account` : `Add Another Account`}
            </Button>
            {!configured && (
              <div style={{ fontSize: 11, color: "#ff7a45", marginTop: 4 }}>Complete Step 1 first.</div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
