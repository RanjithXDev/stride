"use client";
import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Typography, Space, Avatar, Tag, Button, Select,
  Descriptions, Card, List, Spin, Badge, message, Row, Col,
} from "antd";
import { ArrowLeftOutlined, EditOutlined, CheckOutlined, CloseOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";
import { employeesApi } from "@/lib/employees";
import { useAuthStore } from "@/store/auth";
import { StatusTag, PriorityTag } from "@/components/tickets/TicketStatusBadge";
import { integrationApi } from "@/lib/integrations";
import { EmployeeIdentity } from "@/types";
import { GithubOutlined, LinkOutlined, DisconnectOutlined } from "@ant-design/icons";
import { scmApi } from "@/lib/scm";

const { Title, Text } = Typography;
const { Option } = Select;

const roleColors: Record<string, string> = {
  FOUNDER: "purple", CFO: "green", MANAGER: "blue", EMPLOYEE: "default",
};

export default function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const { user: me } = useAuthStore();
  const queryClient = useQueryClient();
  const [editRole, setEditRole] = useState(false);
  const [newRole, setNewRole] = useState<string>("");

  const { data: employee, isLoading } = useQuery({
    queryKey: ["employee", id],
    queryFn: () => employeesApi.get(id),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: () => employeesApi.departments(),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: any) => employeesApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee", id] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      setEditRole(false);
      message.success("Updated");
    },
    onError: () => message.error("Update failed"),
  });

  if (isLoading) return <Spin style={{ display: "block", margin: "80px auto" }} />;
  if (!employee) return <Text type="danger">Employee not found.</Text>;

  const canManage = me?.role === "FOUNDER" || me?.role === "MANAGER";
  const isSelf = me?.id === id;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <Button
        icon={<ArrowLeftOutlined />}
        type="link"
        style={{ paddingLeft: 0, marginBottom: 16 }}
        onClick={() => router.push("/employees")}
      >
        Back to Employees
      </Button>

      {/* Header Card */}
      <Card style={{ marginBottom: 24 }}>
        <Space size={20} align="start" style={{ width: "100%", flexWrap: "wrap" }}>
          <Avatar size={72} style={{ background: "#1677ff", fontSize: 28, flexShrink: 0 }}>
            {employee.name.charAt(0).toUpperCase()}
          </Avatar>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <Title level={3} style={{ margin: 0 }}>{employee.name}</Title>
              {editRole && canManage ? (
                <Space>
                  <Select value={newRole || employee.role} onChange={setNewRole} style={{ width: 130 }}>
                    <Option value="EMPLOYEE">Employee</Option>
                    <Option value="MANAGER">Manager</Option>
                    <Option value="CFO">CFO</Option>
                    <Option value="FOUNDER">Founder</Option>
                  </Select>
                  <Button
                    size="small" type="primary" icon={<CheckOutlined />}
                    onClick={() => updateMutation.mutate({ role: newRole || employee.role })}
                    loading={updateMutation.isPending}
                  />
                  <Button size="small" icon={<CloseOutlined />} onClick={() => setEditRole(false)} />
                </Space>
              ) : (
                <Space>
                  <Tag color={roleColors[employee.role]} style={{ fontWeight: 600 }}>
                    {employee.role}
                  </Tag>
                  {canManage && (
                    <Button
                      size="small" icon={<EditOutlined />} type="text"
                      onClick={() => { setEditRole(true); setNewRole(employee.role); }}
                    />
                  )}
                </Space>
              )}
              <Badge
                status={employee.isActive ? "success" : "default"}
                text={employee.isActive ? "Active" : "Inactive"}
              />
            </div>
            <Text type="secondary">{employee.email}</Text>
          </div>
          {canManage && !isSelf && (
            <Button
              danger={employee.isActive}
              onClick={() => updateMutation.mutate({ isActive: !employee.isActive })}
              loading={updateMutation.isPending}
            >
              {employee.isActive ? "Deactivate" : "Activate"}
            </Button>
          )}
        </Space>
      </Card>

      <Row gutter={24}>
        <Col xs={24} md={12}>
          {/* Details */}
          <Card title="Details" style={{ marginBottom: 24 }}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Department">
                {canManage ? (
                  <Select
                    value={employee.department?.id ?? undefined}
                    onChange={(v) => updateMutation.mutate({ departmentId: v })}
                    style={{ width: 180 }}
                    allowClear
                    placeholder="Assign department"
                  >
                    {departments.map((d: any) => (
                      <Option key={d.id} value={d.id}>{d.name}</Option>
                    ))}
                  </Select>
                ) : (
                  employee.department?.name ?? "—"
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Manager">
                {employee.manager?.name ?? "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Joined">
                {dayjs(employee.createdAt).format("D MMM YYYY")}
              </Descriptions.Item>
              <Descriptions.Item label="Assigned Tickets">
                {employee._count?.assignedTickets ?? 0}
              </Descriptions.Item>
              <Descriptions.Item label="Reported Tickets">
                {employee._count?.reportedTickets ?? 0}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {/* Projects */}
          {employee.projectMembers?.length > 0 && (
            <Card title="Projects">
              <List
                size="small"
                dataSource={employee.projectMembers}
                renderItem={(pm: any) => (
                  <List.Item
                    style={{ cursor: "pointer" }}
                    onClick={() => router.push(`/projects/${pm.project.id}`)}
                  >
                    <List.Item.Meta
                      title={pm.project.name}
                      description={
                        <Space>
                          <Tag>{pm.role}</Tag>
                          <Tag color={pm.project.status === "ACTIVE" ? "green" : "default"}>
                            {pm.project.status}
                          </Tag>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            </Card>
          )}
        </Col>

        <Col xs={24} md={12}>
          {/* Direct Reports */}
          {employee.reports?.length > 0 && (
            <Card title="Direct Reports" style={{ marginBottom: 24 }}>
              <List
                size="small"
                dataSource={employee.reports}
                renderItem={(r: any) => (
                  <List.Item
                    style={{ cursor: "pointer" }}
                    onClick={() => router.push(`/employees/${r.id}`)}
                  >
                    <List.Item.Meta
                      avatar={<Avatar size={28} style={{ background: "#722ed1", fontSize: 12 }}>{r.name.charAt(0)}</Avatar>}
                      title={r.name}
                      description={<Space><Tag color={roleColors[r.role]}>{r.role}</Tag>{r.department?.name}</Space>}
                    />
                  </List.Item>
                )}
              />
            </Card>
          )}

          {/* Recent Tickets */}
          {employee.assignedTickets?.length > 0 && (
            <Card title="Recent Assigned Tickets">
              <List
                size="small"
                dataSource={employee.assignedTickets}
                renderItem={(t: any) => (
                  <List.Item
                    style={{ cursor: "pointer" }}
                    onClick={() => router.push(`/tickets/${t.id}`)}
                  >
                    <List.Item.Meta
                      title={<Text ellipsis style={{ fontSize: 13 }}>{t.title}</Text>}
                      description={
                        <Space size={4}>
                          <StatusTag status={t.status} />
                          <PriorityTag priority={t.priority} />
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            </Card>
          )}
        </Col>
      </Row>

      {/* Developer Accounts — only shown on own profile or for admins */}
      <DeveloperAccountsSection employeeId={id} isOwnProfile={me?.id === id} />
    </div>
  );
}

function DeveloperAccountsSection({ employeeId, isOwnProfile }: { employeeId: string; isOwnProfile: boolean }) {
  const qc = useQueryClient();
  const { data: identities = [], isLoading } = useQuery<EmployeeIdentity[]>({
    queryKey: ["identities", employeeId],
    queryFn: integrationApi.getMyIdentities,
    enabled: isOwnProfile,
  });

  const disconnectMutation = useMutation({
    mutationFn: (id: string) => integrationApi.disconnectIdentity(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["identities", employeeId] }); message.success("Account disconnected"); },
    onError: () => message.error("Failed to disconnect"),
  });

  if (!isOwnProfile) return null;

  const hasGithub = identities.some((i) => i.connection.provider === "GITHUB");
  const hasGitlab = identities.some((i) => i.connection.provider === "GITLAB");

  return (
    <Card title="Developer Accounts" style={{ marginTop: 24 }}>
      {isLoading ? <Spin size="small" /> : (
        <>
          {identities.length === 0 ? (
            <Text type="secondary" style={{ fontSize: 13 }}>No developer accounts linked. Connect your GitHub or GitLab account to enable repository access management.</Text>
          ) : (
            identities.map((identity) => (
              <div key={identity.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #f0f0f0" }}>
                <Space>
                  {identity.connection.provider === "GITHUB" ? <GithubOutlined style={{ fontSize: 18 }} /> : <LinkOutlined style={{ fontSize: 18 }} />}
                  {identity.avatarUrl && <Avatar src={identity.avatarUrl} size={28} />}
                  <div>
                    <div style={{ fontWeight: 600 }}>{identity.username}</div>
                    <Tag style={{ fontSize: 10 }}>{identity.connection.provider}</Tag>
                  </div>
                </Space>
                <Button size="small" danger icon={<DisconnectOutlined />} onClick={() => disconnectMutation.mutate(identity.id)} loading={disconnectMutation.isPending}>Disconnect</Button>
              </div>
            ))
          )}
          <Space style={{ marginTop: 16 }}>
            {!hasGithub && <Button icon={<GithubOutlined />} onClick={() => integrationApi.connectIdentity("github")}>Connect GitHub</Button>}
            {!hasGitlab && <Button icon={<LinkOutlined />} onClick={() => integrationApi.connectIdentity("gitlab")}>Connect GitLab</Button>}
          </Space>
          {identities.length > 0 && <ContributionStats identities={identities} />}
        </>
      )}
    </Card>
  );
}

function ContributionStats({ identities }: { identities: EmployeeIdentity[] }) {
  const { data } = useQuery({
    queryKey: ["scm-analytics"],
    queryFn: scmApi.analytics,
    staleTime: 5 * 60 * 1000,
  });

  const usernames = new Set(identities.map((i) => i.username.toLowerCase()));
  const match = data?.contributors?.find((c) => usernames.has(c.author.toLowerCase()));
  if (!match) return null;

  return (
    <Row gutter={16} style={{ marginTop: 16 }}>
      <Col span={8}><Card size="small" style={{ textAlign: "center" }}><div style={{ fontSize: 22, fontWeight: 700 }}>{match.commits}</div><Text type="secondary" style={{ fontSize: 12 }}>Commits</Text></Card></Col>
      <Col span={8}><Card size="small" style={{ textAlign: "center" }}><div style={{ fontSize: 22, fontWeight: 700 }}>{match.prsOpened}</div><Text type="secondary" style={{ fontSize: 12 }}>PRs Opened</Text></Card></Col>
      <Col span={8}><Card size="small" style={{ textAlign: "center" }}><div style={{ fontSize: 22, fontWeight: 700 }}>{match.prsMerged}</div><Text type="secondary" style={{ fontSize: 12 }}>PRs Merged</Text></Card></Col>
    </Row>
  );
}
