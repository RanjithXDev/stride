"use client";
import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Tabs, Card, Tag, Avatar, Button, Select, Space, Table,
  Typography, Spin, Empty, Popconfirm, message, Row, Col, List, Badge,
} from "antd";
import {
  ArrowLeftOutlined, GithubOutlined, ApiOutlined, LinkOutlined,
  ExportOutlined, BranchesOutlined, ReloadOutlined,
} from "@ant-design/icons";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { useAuthStore } from "@/store/auth";
import { scmApi, RepoMember, GitActivityEvent, GitActivityStatus } from "@/lib/scm";

dayjs.extend(relativeTime);
const { Title, Text } = Typography;
const { Option } = Select;

const PERMISSIONS = ["VIEWER", "DEVELOPER", "MAINTAINER", "ADMIN"];
const SCM_WRITE_ROLES = ["FOUNDER", "MANAGER"];

const GRANT_STATUS_COLOR: Record<string, string> = {
  ACTIVE: "success",
  QUEUED: "processing",
  INVITATION_PENDING: "warning",
  REVOKE_PENDING: "orange",
  BLOCKED: "error",
  REVOKED: "default",
  FAILED: "error",
  EXTERNALLY_MANAGED: "default",
  NOT_GRANTED: "default",
};

const ACT_STATUS_COLOR: Record<GitActivityStatus, string> = {
  success: "success", failure: "error", running: "processing",
  pending: "default", cancelled: "default", skipped: "default",
  open: "processing", merged: "purple", closed: "default", draft: "warning",
};

const TYPE_COLOR: Record<string, string> = {
  COMMIT: "blue", PULL_REQUEST: "purple", MERGE_REQUEST: "purple", CI_RUN: "cyan", PIPELINE: "cyan",
};

export default function RepoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const canWrite = SCM_WRITE_ROLES.includes(user?.role ?? "");

  const [selectedBranch, setSelectedBranch] = useState<string | undefined>();
  const [activityType, setActivityType] = useState<string>("ALL");
  const [pendingPermissions, setPendingPermissions] = useState<Record<string, string>>({});

  // Repo info
  const { data: repo, isLoading: repoLoading } = useQuery({
    queryKey: ["scm-repo", id],
    queryFn: () => scmApi.getRepo(id),
  });

  // Branches list
  const { data: branchData } = useQuery({
    queryKey: ["scm-repo-branches", id],
    queryFn: () => scmApi.branches(id),
    enabled: !!repo,
    staleTime: 2 * 60 * 1000,
  });

  const activeBranch = selectedBranch ?? repo?.defaultBranch;

  // Activity for selected branch
  const { data: actData, isFetching: actFetching, refetch: refetchActivity } = useQuery({
    queryKey: ["scm-repo-activity", id, activeBranch, activityType],
    queryFn: () => scmApi.repoActivity(id, {
      branch: activeBranch,
      type: activityType === "ALL" ? undefined : activityType,
      limit: "30",
    }),
    enabled: !!repo,
    staleTime: 2 * 60 * 1000,
  });

  // Members & access
  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: ["scm-repo-members", id],
    queryFn: () => scmApi.repoMembers(id),
  });

  const grantMutation = useMutation({
    mutationFn: ({ userId, permission }: { userId: string; permission: string }) =>
      scmApi.grantAccess(id, userId, permission),
    onSuccess: (_data, { userId }) => {
      message.success("Access queued — will be applied within 30 seconds");
      setPendingPermissions((p) => { const n = { ...p }; delete n[userId]; return n; });
      qc.invalidateQueries({ queryKey: ["scm-repo-members", id] });
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? "Failed to grant access"),
  });

  const revokeMutation = useMutation({
    mutationFn: (userId: string) => scmApi.revokeAccess(id, userId),
    onSuccess: () => {
      message.success("Revoke queued — access will be removed shortly");
      qc.invalidateQueries({ queryKey: ["scm-repo-members", id] });
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? "Failed to revoke access"),
  });

  const members = membersData?.members ?? [];
  const events = actData?.events ?? [];
  const branches = branchData?.branches ?? [];

  const memberColumns = [
    {
      title: "Employee",
      key: "user",
      width: 200,
      render: (_: unknown, row: RepoMember) => (
        <Space size={8}>
          <Avatar size={30} style={{ background: "#1677ff", fontSize: 12, flexShrink: 0 }}>
            {row.user.name[0]?.toUpperCase()}
          </Avatar>
          <div>
            <Text strong style={{ fontSize: 13, display: "block" }}>{row.user.name}</Text>
            <Tag style={{ fontSize: 10 }}>{row.user.role}</Tag>
          </div>
        </Space>
      ),
    },
    {
      title: "SCM Identity",
      key: "identity",
      width: 150,
      render: (_: unknown, row: RepoMember) =>
        row.identity ? (
          <Space size={4}>
            {repo?.connection?.provider === "GITHUB"
              ? <GithubOutlined style={{ fontSize: 13 }} />
              : <ApiOutlined style={{ fontSize: 13 }} />}
            <Text style={{ fontSize: 12 }}>{row.identity.username}</Text>
          </Space>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>Not linked</Text>
        ),
    },
    {
      title: "Permission",
      key: "permission",
      width: 160,
      render: (_: unknown, row: RepoMember) => {
        if (!canWrite || !row.identity) {
          return <Text style={{ fontSize: 12 }}>{row.grant?.requestedPermission ?? "—"}</Text>;
        }
        return (
          <Select
            size="small"
            style={{ width: 140 }}
            value={pendingPermissions[row.user.id] ?? row.grant?.requestedPermission ?? "DEVELOPER"}
            onChange={(v) => setPendingPermissions((p) => ({ ...p, [row.user.id]: v }))}
          >
            {PERMISSIONS.map((p) => <Option key={p} value={p}>{p}</Option>)}
          </Select>
        );
      },
    },
    {
      title: "Status",
      key: "status",
      width: 160,
      render: (_: unknown, row: RepoMember) => {
        const s = row.grant?.status ?? "NOT_GRANTED";
        return (
          <Tag color={GRANT_STATUS_COLOR[s] ?? "default"} style={{ fontSize: 11 }}>
            {s.replace(/_/g, " ")}
          </Tag>
        );
      },
    },
    {
      title: "Actions",
      key: "actions",
      render: (_: unknown, row: RepoMember) => {
        if (!canWrite) return null;
        const s = row.grant?.status;
        const notLinked = !row.identity;
        const canGrant = !notLinked && (!s || s === "REVOKED" || s === "FAILED" || s === "BLOCKED");
        const canRevoke = s === "ACTIVE" || s === "INVITATION_PENDING" || s === "QUEUED";
        const canUpdate = !notLinked && s === "ACTIVE";

        return (
          <Space size={4} wrap>
            {notLinked && (
              <Text type="secondary" style={{ fontSize: 11 }}>No SCM identity linked</Text>
            )}
            {canGrant && (
              <Button
                size="small"
                type="primary"
                loading={grantMutation.isPending}
                onClick={() => grantMutation.mutate({
                  userId: row.user.id,
                  permission: pendingPermissions[row.user.id] ?? "DEVELOPER",
                })}
              >
                Grant
              </Button>
            )}
            {canUpdate && (
              <Button
                size="small"
                loading={grantMutation.isPending}
                onClick={() => grantMutation.mutate({
                  userId: row.user.id,
                  permission: pendingPermissions[row.user.id] ?? row.grant?.requestedPermission ?? "DEVELOPER",
                })}
              >
                Update
              </Button>
            )}
            {canRevoke && (
              <Popconfirm
                title="Remove access?"
                description="This will revoke their repository access."
                onConfirm={() => revokeMutation.mutate(row.user.id)}
                okButtonProps={{ danger: true }}
                okText="Revoke"
              >
                <Button size="small" danger loading={revokeMutation.isPending}>Revoke</Button>
              </Popconfirm>
            )}
          </Space>
        );
      },
    },
  ];

  if (repoLoading) return <Spin style={{ display: "block", margin: "80px auto" }} />;
  if (!repo) return <Empty description="Repo not found" style={{ marginTop: 80 }} />;

  const providerIcon = repo.connection.provider === "GITHUB"
    ? <GithubOutlined style={{ fontSize: 18 }} />
    : <ApiOutlined style={{ fontSize: 18 }} />;

  const activeCount = members.filter((m) => m.grant?.status === "ACTIVE" || m.grant?.status === "INVITATION_PENDING").length;

  const tabItems = [
    {
      key: "overview",
      label: "Activity",
      children: (
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          {/* Repo info bar */}
          <Card size="small">
            <Row gutter={[16, 8]} align="middle">
              <Col flex="auto">
                <Space wrap size={8}>
                  {providerIcon}
                  <Title level={5} style={{ margin: 0 }}>{repo.fullName}</Title>
                  <Tag>{repo.isPrivate ? "private" : "public"}</Tag>
                  {repo.webhooks?.[0]?.active
                    ? <Tag color="success">Webhook active</Tag>
                    : <Tag color="default">No webhook</Tag>}
                </Space>
              </Col>
              <Col>
                <a href={repo.webUrl} target="_blank" rel="noopener noreferrer">
                  <Button icon={<ExportOutlined />} size="small">
                    Open on {repo.connection.provider === "GITHUB" ? "GitHub" : "GitLab"}
                  </Button>
                </a>
              </Col>
            </Row>
          </Card>

          {/* Branch switcher + type filter */}
          <Card size="small" title={
            <Space>
              <BranchesOutlined />
              <span>Activity</span>
              {actFetching && <Spin size="small" />}
            </Space>
          } extra={
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => refetchActivity()}
              loading={actFetching}
            >
              Refresh
            </Button>
          }>
            <Space wrap style={{ marginBottom: 16 }}>
              <Select
                size="small"
                style={{ width: 200 }}
                value={activeBranch}
                placeholder="Select branch"
                onChange={(v) => setSelectedBranch(v)}
                loading={!branchData}
                showSearch
                optionFilterProp="children"
              >
                {branches.map((b) => (
                  <Option key={b} value={b}>
                    <Space size={4}>
                      <BranchesOutlined style={{ fontSize: 11, color: "#8c8c8c" }} />
                      {b}
                      {b === repo.defaultBranch && (
                        <Tag style={{ fontSize: 10, margin: 0 }}>default</Tag>
                      )}
                    </Space>
                  </Option>
                ))}
              </Select>
              <Select
                size="small"
                style={{ width: 140 }}
                value={activityType}
                onChange={setActivityType}
              >
                <Option value="ALL">All types</Option>
                <Option value="COMMIT">Commits</Option>
                <Option value="PULL_REQUEST">Pull Requests</Option>
                <Option value="CI_RUN">CI Runs</Option>
              </Select>
            </Space>

            {events.length === 0 && !actFetching
              ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={`No activity on ${activeBranch ?? "this branch"}`} />
              : (
                <List
                  dataSource={events}
                  renderItem={(e: GitActivityEvent) => (
                    <List.Item style={{ padding: "10px 0", alignItems: "flex-start" }}>
                      <Space align="start" size={10} style={{ width: "100%" }}>
                        <Tag color={TYPE_COLOR[e.type] ?? "default"} style={{ fontSize: 10, marginTop: 2 }}>
                          {e.type.replace("_", " ")}
                        </Tag>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Space size={6} wrap>
                            <Text strong style={{ fontSize: 13 }}>{e.title.slice(0, 100)}</Text>
                            {e.status && (
                              <Tag color={ACT_STATUS_COLOR[e.status] ?? "default"} style={{ fontSize: 10 }}>
                                {e.status}
                              </Tag>
                            )}
                            {e.sha && (
                              <Text type="secondary" style={{ fontSize: 11, fontFamily: "monospace" }}>{e.sha}</Text>
                            )}
                            <a href={e.url} target="_blank" rel="noopener noreferrer">
                              <LinkOutlined style={{ fontSize: 11, color: "#8c8c8c" }} />
                            </a>
                          </Space>
                          <div style={{ marginTop: 2 }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {e.author}
                              {e.branch && e.branch !== activeBranch && (
                                <> · <BranchesOutlined style={{ fontSize: 10 }} /> {e.branch}</>
                              )}
                              {" · "}{dayjs(e.timestamp).fromNow()}
                            </Text>
                          </div>
                        </div>
                      </Space>
                    </List.Item>
                  )}
                />
              )
            }
          </Card>
        </Space>
      ),
    },
    {
      key: "members",
      label: (
        <Space size={4}>
          Members & Access
          {activeCount > 0 && <Badge count={activeCount} size="small" style={{ backgroundColor: "#52c41a" }} />}
        </Space>
      ),
      children: (
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          {canWrite && (
            <Card size="small" style={{ background: "var(--ant-color-bg-container-disabled, #fafafa)" }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Grant or revoke repository access for any org member. Members must first link their SCM identity
                (GitHub/GitLab account) via their employee profile before access can be granted.
              </Text>
            </Card>
          )}
          <Spin spinning={membersLoading}>
            {members.length === 0
              ? <Empty description="No employees in organization" />
              : (
                <Table
                  dataSource={members}
                  columns={memberColumns}
                  rowKey={(r) => r.user.id}
                  size="small"
                  pagination={{ pageSize: 20, hideOnSinglePage: true }}
                  scroll={{ x: 700 }}
                  rowClassName={(row) => {
                    const s = row.grant?.status;
                    if (s === "ACTIVE") return "row-active";
                    if (s === "BLOCKED" || s === "FAILED") return "row-error";
                    return "";
                  }}
                />
              )
            }
          </Spin>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <Button
        icon={<ArrowLeftOutlined />}
        type="link"
        style={{ paddingLeft: 0, marginBottom: 16 }}
        onClick={() => router.push("/scm?tab=repos")}
      >
        Back to Developer
      </Button>
      <Tabs items={tabItems} defaultActiveKey="overview" />
    </div>
  );
}
