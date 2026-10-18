"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Tabs, Row, Col, Card, Tag, Avatar, Button, Select, Input,
  Table, List, Typography, Space, Empty, Popconfirm, Modal,
  Checkbox, Statistic, message, Spin, Alert,
} from "antd";
import { Badge } from "antd";
import {
  GithubOutlined, ApiOutlined, ExportOutlined, BranchesOutlined,
  MergeCellsOutlined, ThunderboltOutlined, LinkOutlined, PlusOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { scmApi, ScmRepo, GitActivityEvent, GitActivityType, GitActivityStatus, ScmAnalytics } from "@/lib/scm";
import { integrationApi } from "@/lib/integrations";

dayjs.extend(relativeTime);

const { Text, Title } = Typography;
const { Option } = Select;

const SCM_READ_ROLES = ["FOUNDER", "CPO", "CFO", "MANAGER", "TEAM_LEAD"];
const SCM_WRITE_ROLES = ["FOUNDER", "MANAGER"];

const STATUS_COLOR: Record<GitActivityStatus, string> = {
  success: "success", failure: "error", running: "processing",
  pending: "default", cancelled: "default", skipped: "default",
  open: "processing", merged: "purple", closed: "default", draft: "warning",
};

function ProviderIcon({ provider }: { provider: string }) {
  return provider === "GITHUB"
    ? <GithubOutlined style={{ marginRight: 6 }} />
    : <ApiOutlined style={{ marginRight: 6 }} />;
}

function ActivityIcon({ type }: { type: GitActivityType }) {
  if (type === "COMMIT") return <BranchesOutlined style={{ color: "#1677ff" }} />;
  if (type === "PULL_REQUEST" || type === "MERGE_REQUEST") return <MergeCellsOutlined style={{ color: "#722ed1" }} />;
  return <ThunderboltOutlined style={{ color: "#fa8c16" }} />;
}

function EventItem({ e }: { e: GitActivityEvent }) {
  return (
    <List.Item style={{ padding: "10px 0" }}>
      <Space align="start" size={10}>
        <ActivityIcon type={e.type} />
        <div>
          <Space size={6}>
            <Text strong style={{ fontSize: 13 }}>{e.title.slice(0, 72)}{e.title.length > 72 ? "…" : ""}</Text>
            {e.status && <Tag color={STATUS_COLOR[e.status] ?? "default"} style={{ fontSize: 11 }}>{e.status}</Tag>}
            <a href={e.url} target="_blank" rel="noopener noreferrer">
              <LinkOutlined style={{ fontSize: 12, color: "#8c8c8c" }} />
            </a>
          </Space>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {e.author} · {e.repoFullName} · {dayjs(e.timestamp).fromNow()}
              {e.sha && <> · <code style={{ fontSize: 11 }}>{e.sha}</code></>}
            </Text>
          </div>
        </div>
      </Space>
    </List.Item>
  );
}

function TrackRepoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [connId, setConnId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  const { data: conns = [] } = useQuery({
    queryKey: ["scm-connections"],
    queryFn: () => integrationApi.getConnections(),
  });

  const { data: available, isFetching: loadingRepos } = useQuery({
    queryKey: ["scm-available", connId],
    queryFn: () => scmApi.availableRepos(connId!),
    enabled: !!connId,
  });

  const mutation = useMutation({
    mutationFn: () => scmApi.trackRepos(connId!, selected),
    onSuccess: () => {
      message.success("Repos tracked");
      qc.invalidateQueries({ queryKey: ["scm-repos"] });
      onClose();
      setConnId(null);
      setSelected([]);
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? "Failed"),
  });

  const activeConns = conns.filter((c) => c.status === "ACTIVE");
  const repos = available?.available ?? [];

  return (
    <Modal
      title="Track repositories"
      open={open}
      onCancel={() => { onClose(); setConnId(null); setSelected([]); }}
      onOk={() => mutation.mutate()}
      okText="Track selected"
      okButtonProps={{ disabled: selected.length === 0 || !connId, loading: mutation.isPending }}
    >
      <Space direction="vertical" style={{ width: "100%" }} size={16}>
        <Select
          style={{ width: "100%" }}
          placeholder="Select a connection"
          onChange={(v) => { setConnId(v); setSelected([]); }}
          value={connId}
        >
          {activeConns.map((c) => (
            <Option key={c.id} value={c.id}>
              <ProviderIcon provider={c.provider} />{c.accountName} ({c.provider})
            </Option>
          ))}
        </Select>

        {connId && (
          <Spin spinning={loadingRepos}>
            {repos.length === 0 && !loadingRepos && (
              <Empty description="All repos are already tracked or no repos found" />
            )}
            <div style={{ maxHeight: 280, overflowY: "auto" }}>
              {repos.map((r) => (
                <div key={r.id} style={{ padding: "6px 0", borderBottom: "1px solid #f0f0f0" }}>
                  <Checkbox
                    checked={selected.includes(r.id)}
                    onChange={(e) =>
                      setSelected(e.target.checked ? [...selected, r.id] : selected.filter((s) => s !== r.id))
                    }
                  >
                    <Text strong>{r.name}</Text>
                    <Text type="secondary" style={{ fontSize: 12, marginLeft: 6 }}>{r.namespace}</Text>
                    {r.isPrivate && <Tag style={{ marginLeft: 6, fontSize: 10 }}>private</Tag>}
                  </Checkbox>
                </div>
              ))}
            </div>
          </Spin>
        )}
      </Space>
    </Modal>
  );
}

function OverviewTab({ repos }: { repos: ScmRepo[] }) {
  const { data: conns = [] } = useQuery({ queryKey: ["scm-connections"], queryFn: () => integrationApi.getConnections() });
  const { data: stats } = useQuery({ queryKey: ["scm-stats"], queryFn: scmApi.stats });
  const { data: pipData } = useQuery({ queryKey: ["scm-pipelines"], queryFn: scmApi.pipelines });
  const { data: actData } = useQuery({ queryKey: ["scm-activity", "5"], queryFn: () => scmApi.activity({ limit: "5" }) });

  const summary = pipData?.summary ?? { passing: 0, failing: 0, running: 0, total: 0 };
  const recentEvents = actData?.events ?? [];

  if (conns.length === 0) {
    return (
      <Empty
        description={
          <span>No GitHub or GitLab connections.{" "}
            <a href="/connections">Connect via Settings → Connections</a>
          </span>
        }
      />
    );
  }

  return (
    <Space direction="vertical" size={24} style={{ width: "100%" }}>
      <div>
        <Text type="secondary" style={{ fontSize: 12, marginBottom: 8, display: "block" }}>CONNECTIONS</Text>
        <Space wrap>
          {conns.map((c) => (
            <Tag key={c.id} color={c.status === "ACTIVE" ? "success" : "error"} icon={<ProviderIcon provider={c.provider} />}>
              {c.accountName}
            </Tag>
          ))}
        </Space>
      </div>

      <Row gutter={16}>
        <Col xs={12} sm={6}><Card size="small"><Statistic title="Open PRs" value={stats?.openPRs ?? 0} /></Card></Col>
        <Col xs={12} sm={6}><Card size="small"><Statistic title="Passing Pipelines" value={summary.total ? `${summary.passing}/${summary.total}` : "—"} /></Card></Col>
        <Col xs={12} sm={6}><Card size="small"><Statistic title="Total Commits" value={stats?.totalCommits ?? 0} /></Card></Col>
        <Col xs={12} sm={6}><Card size="small"><Statistic title="Tracked Repos" value={repos.length} /></Card></Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} md={10}>
          <Card size="small" title="Top contributors">
            {(stats?.contributors ?? []).slice(0, 5).length === 0
              ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No data" />
              : (stats?.contributors ?? []).slice(0, 5).map((c) => (
                <div key={c.author} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid #f5f5f5" }}>
                  <Avatar size={28} src={c.avatar} style={{ background: "#1677ff", flexShrink: 0 }}>
                    {c.author[0]?.toUpperCase()}
                  </Avatar>
                  <div>
                    <Text strong style={{ fontSize: 13 }}>{c.author}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 11 }}>{c.commits} commits · {c.prs} PRs</Text>
                  </div>
                </div>
              ))
            }
          </Card>
        </Col>
        <Col xs={24} md={14}>
          <Card size="small" title="Recent activity">
            {recentEvents.length === 0
              ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No activity yet" />
              : <List dataSource={recentEvents} renderItem={(e) => <EventItem e={e} />} />
            }
          </Card>
        </Col>
      </Row>
    </Space>
  );
}

function ReposTab({ repos, canWrite }: { repos: ScmRepo[]; canWrite: boolean }) {
  const qc = useQueryClient();
  const router = useRouter();
  const [trackOpen, setTrackOpen] = useState(false);

  const untrackMutation = useMutation({
    mutationFn: (id: string) => scmApi.untrackRepo(id),
    onSuccess: () => { message.success("Repo untracked"); qc.invalidateQueries({ queryKey: ["scm-repos"] }); },
    onError: (e: any) => message.error(e?.response?.data?.message ?? "Failed"),
  });

  const registerWebhookMutation = useMutation({
    mutationFn: (id: string) => scmApi.registerWebhook(id),
    onSuccess: () => { message.success("Webhook registered"); qc.invalidateQueries({ queryKey: ["scm-repos"] }); },
    onError: (e: any) => message.error(e?.response?.data?.message ?? "Failed to register webhook"),
  });

  const deleteWebhookMutation = useMutation({
    mutationFn: (id: string) => scmApi.deleteWebhook(id),
    onSuccess: () => { message.success("Webhook removed"); qc.invalidateQueries({ queryKey: ["scm-repos"] }); },
    onError: (e: any) => message.error(e?.response?.data?.message ?? "Failed to remove webhook"),
  });

  if (repos.length === 0) {
    return (
      <>
        <Empty description={canWrite ? 'No repos tracked yet. Click "Track Repo" to get started.' : "No repos tracked."}>
          {canWrite && <Button type="primary" icon={<PlusOutlined />} onClick={() => setTrackOpen(true)}>Track Repo</Button>}
        </Empty>
        <TrackRepoModal open={trackOpen} onClose={() => setTrackOpen(false)} />
      </>
    );
  }

  return (
    <>
      {canWrite && (
        <div style={{ marginBottom: 16, textAlign: "right" }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setTrackOpen(true)}>Track Repo</Button>
        </div>
      )}
      <Row gutter={[16, 16]}>
        {repos.map((r) => (
          <Col key={r.id} xs={24} sm={12} lg={8}>
            <Card
              size="small"
              hoverable
              style={{ cursor: "pointer" }}
              onClick={() => router.push(`/scm/repos/${r.id}`)}
              title={
                <Space>
                  <ProviderIcon provider={r.connection.provider} />
                  <span style={{ fontWeight: 600 }}>{r.name}</span>
                </Space>
              }
              extra={
                <a href={r.webUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                  <ExportOutlined style={{ color: "#8c8c8c" }} />
                </a>
              }
            >
              <div style={{ marginBottom: 8 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>{r.namespace}</Text>
              </div>
              <Space wrap size={4}>
                <Tag color="blue" style={{ fontSize: 11 }}>{r.defaultBranch}</Tag>
                <Tag style={{ fontSize: 11 }}>{r.isPrivate ? "private" : "public"}</Tag>
                {r.webhooks?.[0]?.active
                  ? <Tag color="success" style={{ fontSize: 11 }}>Webhook active</Tag>
                  : <Tag color="default" style={{ fontSize: 11 }}>No webhook</Tag>
                }
              </Space>
              {canWrite && (
                <div style={{ marginTop: 12 }} onClick={(e) => e.stopPropagation()}>
                  <Space size={6} wrap>
                    {r.webhooks?.[0]?.active ? (
                      <Popconfirm title="Remove webhook?" onConfirm={() => deleteWebhookMutation.mutate(r.id)} okText="Remove" okButtonProps={{ danger: true }}>
                        <Button size="small" loading={deleteWebhookMutation.isPending}>Remove webhook</Button>
                      </Popconfirm>
                    ) : (
                      <Button
                        size="small"
                        type="dashed"
                        icon={<LinkOutlined />}
                        loading={registerWebhookMutation.isPending}
                        onClick={() => registerWebhookMutation.mutate(r.id)}
                      >
                        Register webhook
                      </Button>
                    )}
                    <Popconfirm title="Untrack this repo?" onConfirm={() => untrackMutation.mutate(r.id)} okText="Untrack">
                      <Button size="small" danger>Untrack</Button>
                    </Popconfirm>
                  </Space>
                </div>
              )}
              <div style={{ marginTop: 10, borderTop: "1px solid var(--ant-color-border-secondary, #f0f0f0)", paddingTop: 8 }}>
                <Button
                  type="link"
                  size="small"
                  style={{ padding: 0, fontSize: 12 }}
                  onClick={() => router.push(`/scm/repos/${r.id}`)}
                >
                  View branches &amp; access →
                </Button>
              </div>
            </Card>
          </Col>
        ))}
      </Row>
      <TrackRepoModal open={trackOpen} onClose={() => setTrackOpen(false)} />
    </>
  );
}

function PRsTab({ repos }: { repos: ScmRepo[] }) {
  const [filters, setFilters] = useState<Record<string, string>>({});

  const { data, isFetching } = useQuery({
    queryKey: ["scm-prs", filters],
    queryFn: () => scmApi.prs(filters),
  });

  const prs = data?.prs ?? [];

  const columns = [
    {
      title: "Title",
      key: "title",
      render: (_: unknown, r: GitActivityEvent) => (
        <a href={r.url} target="_blank" rel="noopener noreferrer">
          {r.title.slice(0, 70)}{r.title.length > 70 ? "…" : ""}
        </a>
      ),
    },
    { title: "Repo", dataIndex: "repoFullName", key: "repo", render: (v: string) => <Text style={{ fontSize: 12 }}>{v}</Text> },
    {
      title: "Author",
      key: "author",
      render: (_: unknown, r: GitActivityEvent) => (
        <Space size={6}>
          <Avatar size={20} src={r.authorAvatar}>{r.author[0]?.toUpperCase()}</Avatar>
          <Text style={{ fontSize: 12 }}>{r.author}</Text>
        </Space>
      ),
    },
    {
      title: "Status",
      key: "status",
      render: (_: unknown, r: GitActivityEvent) =>
        r.status ? <Tag color={STATUS_COLOR[r.status] ?? "default"}>{r.status}</Tag> : null,
    },
    { title: "Branch", dataIndex: "branch", key: "branch", render: (v: string) => v ? <Tag style={{ fontSize: 11 }}>{v}</Tag> : null },
    { title: "Age", key: "age", render: (_: unknown, r: GitActivityEvent) => <Text style={{ fontSize: 12 }}>{dayjs(r.timestamp).fromNow()}</Text> },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Row gutter={8}>
        <Col xs={24} sm={8}>
          <Select style={{ width: "100%" }} placeholder="All repos" allowClear onChange={(v) => setFilters((f) => ({ ...f, repoId: v ?? "" }))}>
            {repos.map((r) => <Option key={r.id} value={r.id}>{r.name}</Option>)}
          </Select>
        </Col>
        <Col xs={24} sm={6}>
          <Select style={{ width: "100%" }} placeholder="All statuses" allowClear onChange={(v) => setFilters((f) => ({ ...f, status: v ?? "" }))}>
            {(["open", "merged", "closed", "draft"] as const).map((s) => <Option key={s} value={s}>{s}</Option>)}
          </Select>
        </Col>
        <Col xs={24} sm={8}>
          <Input placeholder="Filter by author" allowClear onChange={(e) => setFilters((f) => ({ ...f, author: e.target.value }))} />
        </Col>
      </Row>
      <Table
        dataSource={prs}
        columns={columns}
        rowKey="id"
        size="small"
        loading={isFetching}
        pagination={{ pageSize: 20 }}
        locale={{ emptyText: <Empty description="No pull requests found" /> }}
      />
    </Space>
  );
}

function PipelinesTab() {
  const { data, isFetching } = useQuery({ queryKey: ["scm-pipelines"], queryFn: scmApi.pipelines });
  const summary = data?.summary ?? { passing: 0, failing: 0, running: 0, total: 0 };
  const pipelines = data?.pipelines ?? [];

  const columns = [
    {
      title: "Repo",
      key: "repo",
      render: (_: unknown, row: { repo: { name: string; webUrl: string; provider: string }; latest: GitActivityEvent | null }) => (
        <Space>
          <ProviderIcon provider={row.repo.provider} />
          <a href={row.repo.webUrl} target="_blank" rel="noopener noreferrer">{row.repo.name}</a>
        </Space>
      ),
    },
    {
      title: "Branch",
      key: "branch",
      render: (_: unknown, row: { latest: GitActivityEvent | null }) =>
        row.latest?.branch ? <Tag style={{ fontSize: 11 }}>{row.latest.branch}</Tag> : <Text type="secondary">—</Text>,
    },
    {
      title: "Status",
      key: "status",
      render: (_: unknown, row: { latest: GitActivityEvent | null }) =>
        row.latest?.status
          ? <Tag color={STATUS_COLOR[row.latest.status] ?? "default"}>{row.latest.status}</Tag>
          : <Tag>no CI</Tag>,
    },
    {
      title: "Triggered by",
      key: "author",
      render: (_: unknown, row: { latest: GitActivityEvent | null }) =>
        <Text style={{ fontSize: 12 }}>{row.latest?.author ?? "—"}</Text>,
    },
    {
      title: "Time",
      key: "time",
      render: (_: unknown, row: { latest: GitActivityEvent | null }) =>
        row.latest ? <Text style={{ fontSize: 12 }}>{dayjs(row.latest.timestamp).fromNow()}</Text> : null,
    },
    {
      title: "",
      key: "link",
      render: (_: unknown, row: { latest: GitActivityEvent | null }) =>
        row.latest ? (
          <a href={row.latest.url} target="_blank" rel="noopener noreferrer">
            <ExportOutlined style={{ color: "#8c8c8c" }} />
          </a>
        ) : null,
    },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Row gutter={12}>
        <Col xs={12} sm={6}><Card size="small"><Statistic title="Passing" value={summary.passing} valueStyle={{ color: "#52c41a" }} /></Card></Col>
        <Col xs={12} sm={6}><Card size="small"><Statistic title="Failing" value={summary.failing} valueStyle={{ color: "#ff4d4f" }} /></Card></Col>
        <Col xs={12} sm={6}><Card size="small"><Statistic title="Running" value={summary.running} valueStyle={{ color: "#fa8c16" }} /></Card></Col>
        <Col xs={12} sm={6}><Card size="small"><Statistic title="Total" value={summary.total} /></Card></Col>
      </Row>
      <Table
        dataSource={pipelines}
        columns={columns}
        rowKey={(r) => r.repo.id}
        size="small"
        loading={isFetching}
        rowClassName={(r) => r.latest?.status === "failure" ? "pipeline-row-failing" : ""}
        pagination={false}
        locale={{ emptyText: <Empty description="No pipelines found" /> }}
      />
      <style>{`.pipeline-row-failing td:first-child { border-left: 3px solid #ff4d4f; }`}</style>
    </Space>
  );
}

function ActivityTab({ repos }: { repos: ScmRepo[] }) {
  const [filters, setFilters] = useState<Record<string, string>>({ limit: "30" });

  const { data, isFetching } = useQuery({
    queryKey: ["scm-activity", filters],
    queryFn: () => scmApi.activity(filters),
  });

  const events = data?.events ?? [];
  const total = data?.total ?? 0;

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Row gutter={8}>
        <Col xs={24} sm={8}>
          <Select style={{ width: "100%" }} placeholder="All types" allowClear onChange={(v) => setFilters((f) => ({ ...f, type: v ?? "" }))}>
            {(["COMMIT", "PULL_REQUEST", "CI_RUN"] as const).map((t) => <Option key={t} value={t}>{t.replace("_", " ")}</Option>)}
          </Select>
        </Col>
        <Col xs={24} sm={8}>
          <Select style={{ width: "100%" }} placeholder="All repos" allowClear onChange={(v) => setFilters((f) => ({ ...f, repoId: v ?? "" }))}>
            {repos.map((r) => <Option key={r.id} value={r.id}>{r.name}</Option>)}
          </Select>
        </Col>
      </Row>
      <Spin spinning={isFetching}>
        {events.length === 0
          ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No recent activity across your tracked repositories" />
          : <List dataSource={events} renderItem={(e) => <EventItem e={e} />} />
        }
      </Spin>
      {events.length < total && (
        <div style={{ textAlign: "center" }}>
          <Button onClick={() => setFilters((f) => ({ ...f, limit: String((parseInt(f.limit ?? "30") + 30)) }))}>
            Load more
          </Button>
        </div>
      )}
    </Space>
  );
}

function AnalyticsTab({ enabled }: { enabled: boolean }) {
  const { data, isLoading } = useQuery({
    queryKey: ["scm-analytics"],
    queryFn: scmApi.analytics,
    enabled,
    staleTime: 5 * 60 * 1000,
  });

  if (!enabled) return <Empty description="Track some repositories first to see analytics." />;

  const contributorColumns = [
    { title: "#", key: "rank", render: (_: unknown, __: unknown, i: number) => i + 1, width: 48 },
    {
      title: "Author", dataIndex: "author", key: "author",
      render: (name: string, row: ScmAnalytics["contributors"][0]) => (
        <Space>
          <Avatar src={row.avatar} size={24}>{name[0]?.toUpperCase()}</Avatar>
          <Text>{name}</Text>
        </Space>
      ),
    },
    { title: "Commits", dataIndex: "commits", key: "commits", sorter: (a: { commits: number }, b: { commits: number }) => a.commits - b.commits },
    { title: "PRs Opened", dataIndex: "prsOpened", key: "prsOpened" },
    { title: "PRs Merged", dataIndex: "prsMerged", key: "prsMerged" },
  ];

  const repoColumns = [
    { title: "Repository", dataIndex: "fullName", key: "fullName", render: (n: string) => <Text code style={{ fontSize: 12 }}>{n}</Text> },
    { title: "Commits", dataIndex: "commits", key: "commits" },
    { title: "Open PRs", dataIndex: "prsOpen", key: "prsOpen" },
    { title: "Total PRs", dataIndex: "prsTotal", key: "prsTotal" },
  ];

  return (
    <Spin spinning={isLoading}>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}><Card><Statistic title="Total Commits" value={data?.totalCommits ?? 0} /></Card></Col>
        <Col xs={12} sm={6}><Card><Statistic title="Total PRs" value={data?.totalPRs ?? 0} /></Card></Col>
        <Col xs={12} sm={6}><Card><Statistic title="Open PRs" value={data?.openPRs ?? 0} /></Card></Col>
        <Col xs={12} sm={6}><Card><Statistic title="Avg PR Age" value={data?.avgPRAgeDays ?? 0} suffix="days" /></Card></Col>
      </Row>
      <Card title="Top Contributors" style={{ marginBottom: 16 }}>
        <Table
          dataSource={data?.contributors ?? []}
          columns={contributorColumns}
          rowKey="author"
          size="small"
          pagination={false}
          loading={isLoading}
        />
      </Card>
      <Card title="Per-Repo Breakdown">
        <Table
          dataSource={data?.byRepo ?? []}
          columns={repoColumns}
          rowKey="repoId"
          size="small"
          pagination={false}
          loading={isLoading}
        />
      </Card>
    </Spin>
  );
}

export default function ScmPage() {
  const { user } = useAuthStore();

  if (!user || !SCM_READ_ROLES.includes(user.role)) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <Empty description="You don't have access to the developer dashboard." />
      </div>
    );
  }

  const canWrite = SCM_WRITE_ROLES.includes(user.role);

  const { data: repos = [], isLoading, isError: reposError } = useQuery({
    queryKey: ["scm-repos"],
    queryFn: scmApi.repos,
  });

  const { data: pipelinesData } = useQuery({
    queryKey: ["scm-pipelines"],
    queryFn: scmApi.pipelines,
    enabled: repos.length > 0,
    staleTime: 5 * 60 * 1000,
  });
  const failingCount = pipelinesData?.summary?.failing ?? 0;

  const tabItems = [
    { key: "overview", label: "Overview", children: <OverviewTab repos={repos} /> },
    { key: "repos", label: "Repositories", children: <ReposTab repos={repos} canWrite={canWrite} /> },
    { key: "prs", label: "Pull Requests", children: <PRsTab repos={repos} /> },
    {
      key: "pipelines",
      label: (
        <span>
          Pipelines{failingCount > 0 && <Badge count={failingCount} size="small" style={{ marginLeft: 6 }} />}
        </span>
      ),
      children: <PipelinesTab />,
    },
    { key: "activity", label: "Activity", children: <ActivityTab repos={repos} /> },
    { key: "analytics", label: "Analytics", children: <AnalyticsTab enabled={repos.length > 0} /> },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>Developer</Title>
        <Text type="secondary">Repositories, PRs, and CI pipelines</Text>
      </div>
      {reposError && (
        <Alert
          type="warning"
          closable
          style={{ marginBottom: 16 }}
          message="Connection issue"
          description="Your SCM connection may need to be reconnected. Go to Settings → Connections to refresh your token."
        />
      )}
      <Spin spinning={isLoading}>
        <Tabs defaultActiveKey="overview" items={tabItems} />
      </Spin>
    </div>
  );
}
