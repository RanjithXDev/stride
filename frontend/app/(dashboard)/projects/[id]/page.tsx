"use client";
import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Typography, Space, Tag, Button, Select, Avatar,
  Card, Table, Descriptions, Spin, Row, Col,
  Statistic, message, Modal, Form, Input, Popconfirm,
  List,
} from "antd";
import {
  ArrowLeftOutlined, PlusOutlined, UserDeleteOutlined,
  EditOutlined, CloseOutlined,
} from "@ant-design/icons";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
dayjs.extend(relativeTime);
import { projectsApi } from "@/lib/projects";
import { employeesApi } from "@/lib/employees";
import { useAuthStore } from "@/store/auth";
import { StatusTag, PriorityTag } from "@/components/tickets/TicketStatusBadge";
import CreateTicketModal from "@/components/tickets/CreateTicketModal";
import { projectRepoApi, integrationApi, GitActivityEvent, GitActivityType, GitActivityStatus } from "@/lib/integrations";
import { ProjectRepo, RepoAccessGrant, ScmConnection, ProviderRepo } from "@/types";
import {
  GithubOutlined, LinkOutlined, SyncOutlined, RetweetOutlined,
  GitlabOutlined, BranchesOutlined, MergeCellsOutlined, CheckCircleOutlined,
  CloseCircleOutlined, LoadingOutlined, ClockCircleOutlined as ClockIcon,
  MinusCircleOutlined, CodeOutlined, DeploymentUnitOutlined,
} from "@ant-design/icons";
import { Tabs, Timeline, Badge } from "antd";

const { Title, Text } = Typography;
const { Option } = Select;

const projectStatusColors: Record<string, string> = {
  PLANNING: "default", ACTIVE: "processing",
  ON_HOLD: "warning", COMPLETED: "success", CANCELLED: "error",
};

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [createTicketOpen, setCreateTicketOpen] = useState(false);
  const [editStatus, setEditStatus] = useState(false);
  const [addMemberForm] = Form.useForm();

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: () => projectsApi.get(id),
  });

  const { data: stats } = useQuery({
    queryKey: ["project-stats", id],
    queryFn: () => projectsApi.stats(id),
    enabled: !!project,
  });

  const { data: allEmployees = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: () => employeesApi.list(),
    enabled: addMemberOpen,
  });

  const updateMutation = useMutation({
    mutationFn: (payload: any) => projectsApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", id] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setEditStatus(false);
      message.success("Project updated");
    },
    onError: () => message.error("Update failed"),
  });

  const addMemberMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      projectsApi.addMember(id, userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", id] });
      addMemberForm.resetFields();
      setAddMemberOpen(false);
      message.success("Member added");
    },
    onError: () => message.error("Failed to add member"),
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => projectsApi.removeMember(id, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", id] });
      message.success("Member removed");
    },
  });

  if (isLoading) return <Spin style={{ display: "block", margin: "80px auto" }} />;
  if (!project)  return <Text type="danger">Project not found.</Text>;

  const canManage = user?.role === "FOUNDER" || user?.role === "MANAGER";
  const memberIds = new Set(project.members.map((m) => m.user.id));
  const nonMembers = allEmployees.filter((e: any) => !memberIds.has(e.id));

  const totalHours = Math.floor((stats?.totalMinutes ?? 0) / 60);

  const ticketColumns = [
    {
      title: "Title",
      dataIndex: "title",
      key: "title",
      render: (text: string, r: any) => (
        <a onClick={() => router.push(`/tickets/${r.id}`)} style={{ fontWeight: 500 }}>{text}</a>
      ),
    },
    { title: "Status",   dataIndex: "status",   key: "status",   width: 130, render: (s: any) => <StatusTag status={s} /> },
    { title: "Priority", dataIndex: "priority", key: "priority", width: 110, render: (p: any) => <PriorityTag priority={p} /> },
    {
      title: "Assignee", key: "assignee", width: 130,
      render: (_: any, r: any) => r.assignee
        ? <Space size={6}><Avatar size={20} style={{ background: "#1677ff", fontSize: 11 }}>{r.assignee.name.charAt(0)}</Avatar>{r.assignee.name.split(" ")[0]}</Space>
        : <Text type="secondary">—</Text>,
    },
    {
      title: "Updated", dataIndex: "updatedAt", key: "updatedAt", width: 100,
      render: (d: string) => <Text style={{ fontSize: 12 }} type="secondary">{dayjs(d).format("MMM D")}</Text>,
    },
  ];

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <Button
        icon={<ArrowLeftOutlined />} type="link"
        style={{ paddingLeft: 0, marginBottom: 16 }}
        onClick={() => router.push("/projects")}
      >
        Back to Projects
      </Button>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
        <div>
          <Space style={{ marginBottom: 6 }}>
            {editStatus ? (
              <Space>
                <Select
                  defaultValue={project.status}
                  onChange={(v) => updateMutation.mutate({ status: v })}
                  style={{ width: 140 }}
                  loading={updateMutation.isPending}
                >
                  {["PLANNING","ACTIVE","ON_HOLD","COMPLETED","CANCELLED"].map((s) => (
                    <Option key={s} value={s}>{s.replace("_", " ")}</Option>
                  ))}
                </Select>
                <Button size="small" icon={<CloseOutlined />} onClick={() => setEditStatus(false)} />
              </Space>
            ) : (
              <Space>
                <Tag color={projectStatusColors[project.status]} style={{ fontWeight: 600 }}>
                  {project.status.replace("_", " ")}
                </Tag>
                {canManage && (
                  <Button size="small" type="text" icon={<EditOutlined />} onClick={() => setEditStatus(true)} />
                )}
              </Space>
            )}
            {project.department && <Tag>{project.department.name}</Tag>}
          </Space>
          <Title level={3} style={{ margin: 0 }}>{project.name}</Title>
          {project.description && (
            <Text type="secondary" style={{ display: "block", marginTop: 4 }}>{project.description}</Text>
          )}
        </div>
        <Space>
          <Button onClick={() => router.push(`/projects/${id}/board`)}>
            Board
          </Button>
          {canManage && (
            <Button icon={<PlusOutlined />} onClick={() => setAddMemberOpen(true)}>
              Add Member
            </Button>
          )}
        </Space>
      </div>

      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        {[
          { label: "Members",      value: project._count.members },
          { label: "Tickets",      value: project._count.tickets },
          { label: "Hours Logged", value: totalHours },
        ].map(({ label, value }) => (
          <Col key={label} xs={8}>
            <Card styles={{ body: { padding: "14px 18px" } }}>
              <Statistic title={label} value={value} styles={{ content: { fontSize: 22, fontWeight: 700 } }} />
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={24}>
        <Col xs={24} md={8}>
          {/* Details */}
          <Card title="Details" style={{ marginBottom: 20 }}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Start">
                {project.startDate ? dayjs(project.startDate).format("D MMM YYYY") : "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Deadline">
                {project.deadline
                  ? <Text type={dayjs(project.deadline).isBefore(dayjs()) && project.status === "ACTIVE" ? "danger" : undefined}>
                      {dayjs(project.deadline).format("D MMM YYYY")}
                    </Text>
                  : "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Created">
                {dayjs(project.createdAt).format("D MMM YYYY")}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {/* Members */}
          <Card
            title={`Members (${project.members.length})`}
            extra={canManage && <Button size="small" type="link" icon={<PlusOutlined />} onClick={() => setAddMemberOpen(true)}>Add</Button>}
          >
            <List
              size="small"
              dataSource={project.members}
              locale={{ emptyText: "No members yet" }}
              renderItem={(m) => (
                <List.Item
                  actions={canManage ? [
                    <Popconfirm
                      key="remove"
                      title="Remove this member?"
                      onConfirm={() => removeMemberMutation.mutate(m.user.id)}
                    >
                      <Button type="text" danger size="small" icon={<UserDeleteOutlined />} />
                    </Popconfirm>,
                  ] : undefined}
                >
                  <List.Item.Meta
                    avatar={
                      <Avatar size={30} style={{ background: "#1677ff", fontSize: 12 }}>
                        {m.user.name.charAt(0)}
                      </Avatar>
                    }
                    title={
                      <Space size={6}>
                        <Text style={{ fontSize: 13 }}>{m.user.name}</Text>
                        <Tag style={{ fontSize: 10 }}>{m.role}</Tag>
                      </Space>
                    }
                    description={<Text style={{ fontSize: 11 }} type="secondary">{m.user.department?.name ?? m.user.role}</Text>}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>

        <Col xs={24} md={16}>
          {/* Repositories */}
          <RepositoriesCard projectId={id} canManage={canManage} />

          {/* Git Activity */}
          <GitActivityCard projectId={id} />

          {/* Tickets */}
          <Card
            style={{ marginTop: 20 }}
            title={`Tickets (${project._count.tickets})`}
            extra={
              <Space size={6}>
                <Button size="small" onClick={() => router.push(`/tickets?projectId=${id}`)}>
                  View All
                </Button>
                <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => setCreateTicketOpen(true)}>
                  New Ticket
                </Button>
              </Space>
            }
          >
            <Table
              dataSource={project.tickets}
              columns={ticketColumns}
              rowKey="id"
              size="small"
              pagination={false}
              scroll={{ x: 500 }}
              locale={{ emptyText: "No tickets yet" }}
              onRow={(r) => ({ onClick: () => router.push(`/tickets/${r.id}`), style: { cursor: "pointer" } })}
            />
          </Card>
        </Col>
      </Row>

      {/* Create Ticket Modal */}
      <CreateTicketModal
        open={createTicketOpen}
        onClose={() => {
          setCreateTicketOpen(false);
          queryClient.invalidateQueries({ queryKey: ["project", id] });
        }}
        projectId={id}
      />

      {/* Add Member Modal */}
      <Modal
        title="Add Member"
        open={addMemberOpen}
        onCancel={() => setAddMemberOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <Form form={addMemberForm} layout="vertical" onFinish={addMemberMutation.mutate} style={{ marginTop: 16 }}>
          <Form.Item name="userId" label="Employee" rules={[{ required: true, message: "Select an employee" }]}>
            <Select showSearch optionFilterProp="children" placeholder="Search employee...">
              {nonMembers.map((e: any) => (
                <Option key={e.id} value={e.id}>{e.name} — {e.role}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="role" label="Project Role" initialValue="Member">
            <Input placeholder="e.g. Developer, Designer, Lead" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: "right" }}>
            <Button onClick={() => setAddMemberOpen(false)} style={{ marginRight: 8 }}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={addMemberMutation.isPending}>Add</Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// ─── Git Activity ────────────────────────────────────────────────────────────

const CI_STATUS_COLOR: Record<string, string> = {
  success: "#52c41a", failure: "#ff4d4f", running: "#1677ff",
  pending: "#faad14", cancelled: "#8c8c8c", skipped: "#8c8c8c",
  open: "#1677ff", merged: "#722ed1", closed: "#8c8c8c", draft: "#8c8c8c",
};

const CI_STATUS_ICON: Record<string, React.ReactNode> = {
  success: <CheckCircleOutlined style={{ color: "#52c41a" }} />,
  failure: <CloseCircleOutlined style={{ color: "#ff4d4f" }} />,
  running: <LoadingOutlined style={{ color: "#1677ff" }} />,
  pending: <ClockIcon style={{ color: "#faad14" }} />,
  cancelled: <MinusCircleOutlined style={{ color: "#8c8c8c" }} />,
  skipped: <MinusCircleOutlined style={{ color: "#8c8c8c" }} />,
  open:   <MergeCellsOutlined style={{ color: "#1677ff" }} />,
  merged: <MergeCellsOutlined style={{ color: "#722ed1" }} />,
  closed: <CloseCircleOutlined style={{ color: "#8c8c8c" }} />,
  draft:  <MergeCellsOutlined style={{ color: "#8c8c8c" }} />,
};

function activityIcon(event: GitActivityEvent): React.ReactNode {
  if (event.type === "COMMIT") return <CodeOutlined style={{ color: "#595959" }} />;
  if (event.type === "CI_RUN" || event.type === "PIPELINE") {
    return CI_STATUS_ICON[event.status ?? "pending"] ?? <DeploymentUnitOutlined />;
  }
  return CI_STATUS_ICON[event.status ?? "open"] ?? <MergeCellsOutlined />;
}

function activityDotColor(event: GitActivityEvent): string {
  if (event.type === "COMMIT") return "#595959";
  return CI_STATUS_COLOR[event.status ?? "pending"] ?? "#595959";
}

const TYPE_LABELS: Record<GitActivityType, string> = {
  COMMIT: "Commit",
  PULL_REQUEST: "PR",
  MERGE_REQUEST: "MR",
  CI_RUN: "CI",
  PIPELINE: "Pipeline",
};

function GitActivityCard({ projectId }: { projectId: string }) {
  const [filter, setFilter] = useState<string>("all");

  const { data: events = [], isLoading, refetch, isFetching } = useQuery<GitActivityEvent[]>({
    queryKey: ["git-activity", projectId],
    queryFn: () => projectRepoApi.getGitActivity(projectId),
    staleTime: 60_000,
  });

  const { data: repos = [] } = useQuery<ProjectRepo[]>({
    queryKey: ["project-repos", projectId],
    queryFn: () => projectRepoApi.list(projectId),
  });

  const filtered = filter === "all" ? events : events.filter((e) => {
    if (filter === "commits") return e.type === "COMMIT";
    if (filter === "prs") return e.type === "PULL_REQUEST" || e.type === "MERGE_REQUEST";
    if (filter === "ci") return e.type === "CI_RUN" || e.type === "PIPELINE";
    return true;
  });

  if (repos.length === 0) return null;

  return (
    <Card
      style={{ marginTop: 20 }}
      styles={{ body: { padding: "0 24px 16px" } }}
      title={
        <Space>
          <DeploymentUnitOutlined />
          Git Activity
        </Space>
      }
      extra={
        <Button
          size="small"
          icon={<SyncOutlined spin={isFetching} />}
          onClick={() => refetch()}
          type="text"
        >
          Refresh
        </Button>
      }
    >
      <Tabs
        size="small"
        style={{ marginBottom: 8 }}
        activeKey={filter}
        onChange={setFilter}
        items={[
          { key: "all",     label: `All (${events.length})` },
          { key: "commits", label: `Commits (${events.filter((e) => e.type === "COMMIT").length})` },
          { key: "prs",     label: `PRs / MRs (${events.filter((e) => e.type === "PULL_REQUEST" || e.type === "MERGE_REQUEST").length})` },
          { key: "ci",      label: `CI / CD (${events.filter((e) => e.type === "CI_RUN" || e.type === "PIPELINE").length})` },
        ]}
      />

      {isLoading ? (
        <div style={{ textAlign: "center", padding: 32 }}><Spin /></div>
      ) : filtered.length === 0 ? (
        <Text type="secondary" style={{ fontSize: 13, display: "block", padding: "16px 0" }}>
          {events.length === 0
            ? "No activity yet. Make sure your GitHub/GitLab connection has valid credentials."
            : "No events in this category."}
        </Text>
      ) : (
        <div style={{ maxHeight: 420, overflowY: "auto" }}>
          <Timeline
            style={{ paddingTop: 8 }}
            items={filtered.map((event) => ({
              key: event.id,
              dot: activityIcon(event),
              color: activityDotColor(event),
              children: (
                <div style={{ paddingBottom: 4 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
                    <Tag
                      style={{ fontSize: 10, lineHeight: "18px", margin: 0 }}
                      color={
                        event.type === "COMMIT" ? "default"
                        : event.type === "CI_RUN" || event.type === "PIPELINE" ? "geekblue"
                        : "purple"
                      }
                    >
                      {event.provider === "GITHUB" ? <GithubOutlined style={{ marginRight: 3 }} /> : <GitlabOutlined style={{ marginRight: 3 }} />}
                      {TYPE_LABELS[event.type]}
                    </Tag>
                    {event.status && (
                      <Tag
                        style={{ fontSize: 10, lineHeight: "18px", margin: 0, color: CI_STATUS_COLOR[event.status], borderColor: CI_STATUS_COLOR[event.status] }}
                      >
                        {event.status}
                      </Tag>
                    )}
                    {event.branch && (
                      <Tag icon={<BranchesOutlined />} style={{ fontSize: 10, lineHeight: "18px", margin: 0 }}>
                        {event.branch}
                      </Tag>
                    )}
                  </div>

                  <div style={{ marginTop: 4 }}>
                    <a href={event.url} target="_blank" rel="noreferrer" style={{ fontWeight: 500, fontSize: 13, wordBreak: "break-word" }}>
                      {event.title}
                    </a>
                    {event.sha && (
                      <Text type="secondary" style={{ fontSize: 11, marginLeft: 6 }}>
                        {event.sha}
                      </Text>
                    )}
                  </div>

                  <div style={{ marginTop: 2 }}>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {event.author}
                      {event.description && event.type !== "COMMIT" && (
                        <span style={{ marginLeft: 6 }}>{event.description}</span>
                      )}
                      <span style={{ marginLeft: 6 }}>·</span>
                      <span style={{ marginLeft: 6 }}>{dayjs(event.timestamp).fromNow()}</span>
                      <span style={{ marginLeft: 6 }}>·</span>
                      <span style={{ marginLeft: 6, color: "#999" }}>{event.repoFullName}</span>
                    </Text>
                  </div>
                </div>
              ),
            }))}
          />
        </div>
      )}
    </Card>
  );
}

const GRANT_STATUS_COLOR: Record<string, string> = {
  QUEUED: "default", INVITATION_PENDING: "processing", ACTIVE: "success",
  UPDATE_PENDING: "processing", REVOKE_PENDING: "warning", REVOKED: "default",
  FAILED: "error", BLOCKED: "error", EXTERNALLY_MANAGED: "geekblue",
};

function RepositoriesCard({ projectId, canManage }: { projectId: string; canManage: boolean }) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [expandedRepo, setExpandedRepo] = useState<string | null>(null);
  const [repoForm] = Form.useForm();
  const [setupMode, setSetupMode] = useState<"map" | "create">("map");
  const [selectedConn, setSelectedConn] = useState<string>("");

  const { data: repos = [], isLoading } = useQuery<ProjectRepo[]>({ queryKey: ["project-repos", projectId], queryFn: () => projectRepoApi.list(projectId) });
  const { data: connections = [] } = useQuery<ScmConnection[]>({ queryKey: ["scm-connections"], queryFn: integrationApi.getConnections });
  const { data: providerRepos = [], isFetching: reposFetching } = useQuery<ProviderRepo[]>({ queryKey: ["provider-repos", selectedConn], queryFn: () => integrationApi.getRepositories(selectedConn), enabled: !!selectedConn && setupMode === "map" });
  const { data: accessGrants = [] } = useQuery<RepoAccessGrant[]>({ queryKey: ["repo-access", projectId, expandedRepo], queryFn: () => projectRepoApi.getAccess(projectId, expandedRepo!), enabled: !!expandedRepo });

  const syncMutation = useMutation({ mutationFn: (repoId: string) => projectRepoApi.sync(projectId, repoId), onSuccess: () => message.success("Sync queued") });
  const retryMutation = useMutation({ mutationFn: (grantId: string) => projectRepoApi.retryGrant(grantId), onSuccess: () => { message.success("Retry queued"); qc.invalidateQueries({ queryKey: ["repo-access"] }); } });
  const addMutation = useMutation({
    mutationFn: (v: any) => {
      const conn = connections.find((c) => c.id === v.connectionId);
      if (setupMode === "create") return projectRepoApi.add(projectId, { connectionId: v.connectionId, createNew: true, repoName: v.repoName, defaultPermission: v.defaultPermission ?? "DEVELOPER" });
      const repo = providerRepos.find((r) => r.id === v.repoId);
      if (!repo) throw new Error("Repo not found");
      return projectRepoApi.add(projectId, { connectionId: v.connectionId, providerRepositoryId: repo.id, namespace: repo.namespace, repositoryName: repo.name, fullName: repo.fullName, webUrl: repo.webUrl, defaultBranch: repo.defaultBranch, isPrivate: repo.isPrivate, defaultPermission: v.defaultPermission ?? "DEVELOPER" });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["project-repos", projectId] }); message.success("Repository linked"); setAddOpen(false); repoForm.resetFields(); },
    onError: (e: any) => message.error(e?.response?.data?.message ?? "Failed to link repository"),
  });
  const removeMutation = useMutation({
    mutationFn: (repoId: string) => projectRepoApi.remove(projectId, repoId, "KEEP_ACCESS"),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["project-repos", projectId] }); message.success("Repository unlinked"); },
  });

  const providerIcon = (p: string) => p === "GITHUB" ? <GithubOutlined /> : <LinkOutlined />;

  return (
    <>
      <Card
        title="Repositories"
        extra={canManage && <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>Link Repo</Button>}
        style={{ marginBottom: 0 }}
      >
        {isLoading ? <Spin size="small" /> : repos.length === 0 ? (
          <Text type="secondary" style={{ fontSize: 13 }}>No repositories linked. Link a GitHub or GitLab repo to automate access control.</Text>
        ) : (
          repos.map((repo) => (
            <div key={repo.id} style={{ padding: "12px 0", borderBottom: "1px solid #f0f0f0" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Space>
                  {providerIcon(repo.connection.provider)}
                  <a href={repo.webUrl} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>{repo.fullName}</a>
                  <Tag color={repo.isPrivate ? "default" : "blue"} style={{ fontSize: 10 }}>{repo.isPrivate ? "Private" : "Public"}</Tag>
                  <Tag style={{ fontSize: 10 }}>{repo.defaultPermission}</Tag>
                </Space>
                <Space>
                  <Button size="small" icon={<SyncOutlined />} onClick={() => syncMutation.mutate(repo.id)} loading={syncMutation.isPending}>Sync</Button>
                  <Button size="small" onClick={() => setExpandedRepo(expandedRepo === repo.id ? null : repo.id)}>{expandedRepo === repo.id ? "Hide Access" : "Show Access"}</Button>
                  {canManage && (
                    <Popconfirm title="Unlink this repository?" onConfirm={() => removeMutation.mutate(repo.id)} okText="Unlink">
                      <Button size="small" danger>Unlink</Button>
                    </Popconfirm>
                  )}
                </Space>
              </div>

              {expandedRepo === repo.id && (
                <Table
                  style={{ marginTop: 12 }}
                  size="small"
                  dataSource={accessGrants}
                  rowKey="id"
                  pagination={false}
                  columns={[
                    { title: "Username", key: "username", render: (_: any, r: RepoAccessGrant) => r.employeeIdentity?.username ?? <Text type="secondary">No identity linked</Text> },
                    { title: "Permission", dataIndex: "requestedPermission", key: "perm" },
                    {
                      title: "Status", dataIndex: "status", key: "status",
                      render: (s: string) => <Tag color={GRANT_STATUS_COLOR[s] ?? "default"}>{s}</Tag>,
                    },
                    {
                      title: "Actions", key: "actions",
                      render: (_: any, r: RepoAccessGrant) => r.status === "FAILED" ? (
                        <Button size="small" icon={<RetweetOutlined />} onClick={() => retryMutation.mutate(r.id)} loading={retryMutation.isPending}>Retry</Button>
                      ) : null,
                    },
                  ]}
                />
              )}
            </div>
          ))
        )}
      </Card>

      <Modal title="Link Repository" open={addOpen} onCancel={() => { setAddOpen(false); repoForm.resetFields(); }} footer={null} destroyOnClose>
        <Form form={repoForm} layout="vertical" onFinish={addMutation.mutate} style={{ marginTop: 16 }}>
          <Form.Item name="connectionId" label="Connection" rules={[{ required: true }]}>
            <Select placeholder="Select account" onChange={(v) => { setSelectedConn(v); repoForm.setFieldValue("repoId", undefined); }}>
              {connections.filter((c) => c.status === "ACTIVE").map((c) => <Option key={c.id} value={c.id}>{providerIcon(c.provider)} {c.accountName} ({c.provider})</Option>)}
            </Select>
          </Form.Item>
          <Form.Item label="Setup Mode">
            <Select value={setupMode} onChange={(v: any) => setSetupMode(v)}>
              <Option value="map">Map Existing Repository</Option>
              <Option value="create">Create New Repository</Option>
            </Select>
          </Form.Item>
          {setupMode === "map" && selectedConn && (
            <Form.Item name="repoId" label="Repository" rules={[{ required: true }]}>
              <Select showSearch loading={reposFetching} placeholder="Search repositories…" filterOption={(input, option) => (option?.label ?? "").toString().toLowerCase().includes(input.toLowerCase())} options={providerRepos.map((r) => ({ value: r.id, label: r.fullName }))} />
            </Form.Item>
          )}
          {setupMode === "create" && (
            <Form.Item name="repoName" label="Repository Name" rules={[{ required: true }]}>
              <Input placeholder="my-project" />
            </Form.Item>
          )}
          <Form.Item name="defaultPermission" label="Default Member Permission" initialValue="DEVELOPER">
            <Select>
              <Option value="VIEWER">Viewer (read-only)</Option>
              <Option value="DEVELOPER">Developer (push)</Option>
              <Option value="MAINTAINER">Maintainer</Option>
            </Select>
          </Form.Item>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button onClick={() => { setAddOpen(false); repoForm.resetFields(); }}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={addMutation.isPending}>Link Repository</Button>
          </div>
        </Form>
      </Modal>
    </>
  );
}
