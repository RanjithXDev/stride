"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Tabs, Card, Table, Tag, Avatar, Button, Select, Space, Typography,
  Empty, Spin, Modal, Form, Input, Alert, Popconfirm, Row, Col, Statistic, message,
} from "antd";
import {
  PlusOutlined, DeleteOutlined, ExportOutlined, BugOutlined,
  CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { useAuthStore } from "@/store/auth";
import {
  pmApi, PmConnection, PmProvider, ExternalProject, ExternalIssue,
  IssueStatus, IssuePriority,
} from "@/lib/pm";

dayjs.extend(relativeTime);
const { Text, Title } = Typography;
const { Option } = Select;

const PROVIDER_LABELS: Record<PmProvider, string> = {
  JIRA: "Jira", YOUTRACK: "YouTrack", LINEAR: "Linear", ASANA: "Asana",
};

const PROVIDER_COLORS: Record<PmProvider, string> = {
  JIRA: "#0052CC", YOUTRACK: "#FC801D", LINEAR: "#5E6AD2", ASANA: "#F06A6A",
};

const STATUS_COLOR: Record<IssueStatus, string> = {
  todo: "default", in_progress: "processing", done: "success",
  cancelled: "default", blocked: "error", review: "warning",
};

const PRIORITY_COLOR: Record<IssuePriority, string> = {
  critical: "red", high: "orange", medium: "blue", low: "cyan", none: "default",
};

const WRITE_ROLES = ["FOUNDER", "CPO"];

function ProviderDot({ provider }: { provider: PmProvider }) {
  return (
    <span style={{
      display: "inline-block", width: 8, height: 8, borderRadius: "50%",
      background: PROVIDER_COLORS[provider], marginRight: 6, flexShrink: 0,
    }} />
  );
}

// ── Add Connection Modal ──────────────────────────────────────────
function AddConnectionModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [form] = Form.useForm();
  const [provider, setProvider] = useState<PmProvider>("JIRA");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: (values: any) => pmApi.createConnection({
      provider,
      host: values.host ?? "",
      token: values.token,
      cloudId: values.cloudId,
    }),
    onSuccess: () => {
      message.success("Connection added");
      qc.invalidateQueries({ queryKey: ["pm-connections"] });
      onClose();
      form.resetFields();
      setError("");
    },
    onError: (e: any) => setError(e?.response?.data?.message ?? "Failed to connect"),
  });

  const isJira = provider === "JIRA";
  const isYouTrack = provider === "YOUTRACK";

  return (
    <Modal
      title="Add project tool connection"
      open={open}
      onCancel={() => { onClose(); form.resetFields(); setError(""); }}
      onOk={() => form.validateFields().then((v) => mutation.mutate(v))}
      okText="Test & connect"
      okButtonProps={{ loading: mutation.isPending }}
      width={480}
    >
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        {error && <Alert type="error" message={error} />}

        <Form.Item label="Tool" style={{ marginBottom: 0 }}>
          <Select value={provider} onChange={setProvider} style={{ width: "100%" }}>
            <Option value="JIRA">Jira (Atlassian Cloud)</Option>
            <Option value="YOUTRACK">YouTrack</Option>
          </Select>
        </Form.Item>

        <Form form={form} layout="vertical" style={{ marginBottom: 0 }}>
          {isJira && (
            <>
              <Form.Item label="Atlassian Cloud ID" name="cloudId" tooltip="Found in your Jira URL: https://your-domain.atlassian.net — the 'your-domain' part, OR the UUID from the Atlassian admin">
                <Input placeholder="e.g. abc12345-..." />
              </Form.Item>
              <Form.Item
                label="API token (email:token)"
                name="token"
                required
                tooltip="Create at id.atlassian.com → Security → API tokens. Encode as Base64: email:token"
                rules={[{ required: true }]}
              >
                <Input.Password placeholder="Base64-encoded email:api_token" />
              </Form.Item>
            </>
          )}
          {isYouTrack && (
            <>
              <Form.Item label="YouTrack host URL" name="host" required rules={[{ required: true }]}>
                <Input placeholder="https://your-org.youtrack.cloud" />
              </Form.Item>
              <Form.Item label="Permanent token" name="token" required rules={[{ required: true }]}>
                <Input.Password placeholder="perm:..." />
              </Form.Item>
            </>
          )}
        </Form>

        <Alert
          type="info"
          showIcon={false}
          message={
            <Text style={{ fontSize: 12 }}>
              {isJira
                ? "Stride reads your Jira issues but never writes to them. Your team keeps working in Jira exactly as before."
                : "Stride reads your YouTrack issues in read-only mode. No changes are made to your YouTrack data."}
            </Text>
          }
        />
      </Space>
    </Modal>
  );
}

// ── Project Issues view ───────────────────────────────────────────
function ProjectIssuesView({ connection, project }: { connection: PmConnection; project: ExternalProject }) {
  const [statusFilter, setStatusFilter] = useState<string>("");

  const { data, isLoading } = useQuery({
    queryKey: ["pm-issues", connection.id, project.id, statusFilter],
    queryFn: () => pmApi.issues(connection.id, project.id, { status: statusFilter || undefined, limit: "50" }),
    staleTime: 2 * 60 * 1000,
  });

  const issues = data?.issues ?? [];

  const columns = [
    {
      title: "Key",
      dataIndex: "key",
      key: "key",
      width: 100,
      render: (v: string, r: ExternalIssue) => (
        <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, fontFamily: "monospace" }}>{v}</a>
      ),
    },
    {
      title: "Title",
      key: "title",
      render: (_: unknown, r: ExternalIssue) => (
        <div>
          <Text style={{ fontSize: 13 }}>{r.title.slice(0, 80)}{r.title.length > 80 ? "…" : ""}</Text>
          {r.labels && r.labels.length > 0 && (
            <div style={{ marginTop: 2 }}>
              {r.labels.slice(0, 3).map((l) => (
                <Tag key={l} style={{ fontSize: 10, marginRight: 2 }}>{l}</Tag>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Status",
      key: "status",
      width: 120,
      render: (_: unknown, r: ExternalIssue) => (
        <Tag color={STATUS_COLOR[r.status] ?? "default"} style={{ fontSize: 11 }}>
          {r.status.replace("_", " ")}
        </Tag>
      ),
    },
    {
      title: "Priority",
      key: "priority",
      width: 90,
      render: (_: unknown, r: ExternalIssue) => (
        <Tag color={PRIORITY_COLOR[r.priority] ?? "default"} style={{ fontSize: 11 }}>{r.priority}</Tag>
      ),
    },
    {
      title: "Type",
      key: "type",
      width: 80,
      render: (_: unknown, r: ExternalIssue) => (
        <Tag style={{ fontSize: 10 }}>{r.type}</Tag>
      ),
    },
    {
      title: "Assignee",
      key: "assignee",
      width: 120,
      render: (_: unknown, r: ExternalIssue) =>
        r.assignee ? (
          <Space size={4}>
            <Avatar size={18} src={r.assigneeAvatar} style={{ fontSize: 9 }}>
              {r.assignee[0]?.toUpperCase()}
            </Avatar>
            <Text style={{ fontSize: 12 }}>{r.assignee}</Text>
          </Space>
        ) : <Text type="secondary" style={{ fontSize: 11 }}>Unassigned</Text>,
    },
    {
      title: "Updated",
      key: "updated",
      width: 90,
      render: (_: unknown, r: ExternalIssue) => (
        <Text type="secondary" style={{ fontSize: 11 }}>{dayjs(r.updatedAt).fromNow()}</Text>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 12 }} wrap>
        <Select
          size="small"
          placeholder="Filter by status"
          style={{ width: 160 }}
          value={statusFilter || undefined}
          onChange={(v) => setStatusFilter(v ?? "")}
          allowClear
        >
          {(["todo", "in_progress", "review", "blocked", "done", "cancelled"] as IssueStatus[]).map((s) => (
            <Option key={s} value={s}>{s.replace("_", " ")}</Option>
          ))}
        </Select>
        <Text type="secondary" style={{ fontSize: 12 }}>{data?.total ?? 0} issues</Text>
        <a href={project.url} target="_blank" rel="noopener noreferrer">
          <Button size="small" icon={<ExportOutlined />}>Open in {PROVIDER_LABELS[connection.provider]}</Button>
        </a>
      </Space>
      {issues.length === 0 && !isLoading
        ? <Empty description="No issues found" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        : (
          <Table
            dataSource={issues}
            columns={columns}
            rowKey="id"
            size="small"
            loading={isLoading}
            scroll={{ x: 800 }}
            pagination={{ pageSize: 20, hideOnSinglePage: true, showTotal: (t) => `${t} issues` }}
          />
        )
      }
    </div>
  );
}

// ── Per-connection tab ────────────────────────────────────────────
function ConnectionTab({ connection }: { connection: PmConnection }) {
  const [selectedProject, setSelectedProject] = useState<ExternalProject | null>(null);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["pm-projects", connection.id],
    queryFn: () => pmApi.projects(connection.id),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <Spin style={{ display: "block", margin: "40px auto" }} />;

  if (projects.length === 0) {
    return <Empty description="No projects found in this connection" />;
  }

  return (
    <div>
      {!selectedProject ? (
        <div>
          <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 12 }}>
            Select a project to view its issues
          </Text>
          <Row gutter={[12, 12]}>
            {projects.map((p) => (
              <Col key={p.id} xs={24} sm={12} lg={8}>
                <Card
                  size="small"
                  hoverable
                  style={{ cursor: "pointer" }}
                  onClick={() => setSelectedProject(p)}
                >
                  <Space>
                    <Tag style={{ fontFamily: "monospace", fontSize: 11 }}>{p.key}</Tag>
                    <Text strong style={{ fontSize: 13 }}>{p.name}</Text>
                  </Space>
                  {p.description && (
                    <Text type="secondary" style={{ fontSize: 12, display: "block", marginTop: 4 }}>
                      {p.description.slice(0, 80)}
                    </Text>
                  )}
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      ) : (
        <div>
          <Button
            type="link"
            style={{ padding: 0, marginBottom: 12 }}
            onClick={() => setSelectedProject(null)}
          >
            ← All projects
          </Button>
          <div style={{ marginBottom: 8 }}>
            <Title level={5} style={{ margin: 0 }}>{selectedProject.name}</Title>
            <Text type="secondary" style={{ fontSize: 12 }}>{PROVIDER_LABELS[connection.provider]} · {selectedProject.key}</Text>
          </div>
          <ProjectIssuesView connection={connection} project={selectedProject} />
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────
export default function ExternalIssuesPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const canManage = WRITE_ROLES.includes(user?.role ?? "");

  const { data: connections = [], isLoading } = useQuery({
    queryKey: ["pm-connections"],
    queryFn: pmApi.connections,
    staleTime: 30_000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => pmApi.deleteConnection(id),
    onSuccess: () => { message.success("Connection removed"); qc.invalidateQueries({ queryKey: ["pm-connections"] }); },
    onError: (e: any) => message.error(e?.response?.data?.message ?? "Failed"),
  });

  const activeConnections = connections.filter((c) => c.status === "ACTIVE");

  if (isLoading) return <Spin style={{ display: "block", margin: "80px auto" }} />;

  if (connections.length === 0) {
    return (
      <div style={{ maxWidth: 600, margin: "80px auto", textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🔌</div>
        <Title level={4}>Connect your project tools</Title>
        <Text type="secondary">
          Keep using Jira, YouTrack, or Linear. Stride shows your team's issues right here — no migration needed.
        </Text>
        {canManage && (
          <div style={{ marginTop: 24 }}>
            <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => setAddOpen(true)}>
              Add connection
            </Button>
          </div>
        )}
        <AddConnectionModal open={addOpen} onClose={() => setAddOpen(false)} />
      </div>
    );
  }

  const tabItems = [
    ...activeConnections.map((conn) => ({
      key: conn.id,
      label: (
        <Space size={4}>
          <ProviderDot provider={conn.provider} />
          {PROVIDER_LABELS[conn.provider]}
        </Space>
      ),
      children: (
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          {canManage && (
            <div style={{ textAlign: "right" }}>
              <Popconfirm
                title="Remove this connection?"
                description="Issues from this tool will no longer be visible in Stride."
                onConfirm={() => deleteMutation.mutate(conn.id)}
                okText="Remove"
                okButtonProps={{ danger: true }}
              >
                <Button size="small" danger icon={<DeleteOutlined />} loading={deleteMutation.isPending}>
                  Remove connection
                </Button>
              </Popconfirm>
            </div>
          )}
          <ConnectionTab connection={conn} />
        </Space>
      ),
    })),
    ...(canManage ? [{
      key: "__add",
      label: <Space size={4}><PlusOutlined style={{ fontSize: 11 }} /><span>Add tool</span></Space>,
      children: null,
    }] : []),
  ];

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <Title level={4} style={{ marginBottom: 4 }}>External Issues</Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          Your team's issues from Jira, YouTrack, and other tools — read-only view. Your team keeps working in their existing tools.
        </Text>
      </div>

      <Tabs
        items={tabItems}
        onTabClick={(key) => { if (key === "__add") setAddOpen(true); }}
      />

      <AddConnectionModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
