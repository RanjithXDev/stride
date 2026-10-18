"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Typography, Table, Tag, Button, Modal, Form, Input, Select,
  Card, Row, Col, Statistic, Space, Popconfirm, message, Tabs,
  Badge, Tooltip, Switch, Divider,
} from "antd";
import {
  CrownOutlined, PlusOutlined, TeamOutlined,
  CheckCircleOutlined, StopOutlined, EditOutlined,
  GlobalOutlined, UserOutlined, ProjectOutlined,
} from "@ant-design/icons";
import { orgApi, CreateOrgPayload, OrgSummary } from "@/lib/organization";
import { PlanType } from "@/types";
import dayjs from "dayjs";

const { Title, Text } = Typography;
const { Option } = Select;

const PLAN_COLORS: Record<string, string> = {
  FREE: "default", STARTER: "blue", GROWTH: "green", ENTERPRISE: "gold",
};

const PLANS: PlanType[] = ["FREE", "STARTER", "GROWTH", "ENTERPRISE"];

export default function AdminPage() {
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [editOrg, setEditOrg] = useState<OrgSummary | null>(null);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();

  const { data: stats } = useQuery({ queryKey: ["superadmin-stats"], queryFn: orgApi.superAdminStats });
  const { data: orgs, isLoading } = useQuery({ queryKey: ["superadmin-orgs"], queryFn: orgApi.listAll });

  const createMutation = useMutation({
    mutationFn: (payload: CreateOrgPayload) => orgApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin-orgs", "superadmin-stats"] });
      message.success("Company onboarded successfully");
      setCreateOpen(false);
      createForm.resetFields();
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? "Failed to create organisation"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...payload }: any) => orgApi.updatePlan(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin-orgs"] });
      message.success("Updated");
      setEditOrg(null);
    },
    onError: () => message.error("Update failed"),
  });

  function openEdit(org: OrgSummary) {
    setEditOrg(org);
    editForm.setFieldsValue({ name: org.name, plan: org.plan, isActive: org.isActive, logoUrl: org.logoUrl });
  }

  const columns = [
    {
      title: "Company",
      key: "name",
      render: (_: any, r: OrgSummary) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{r.name}</div>
          <Text type="secondary" style={{ fontSize: 11 }}>/{r.slug}</Text>
        </div>
      ),
    },
    {
      title: "Plan",
      dataIndex: "plan",
      render: (plan: string) => <Tag color={PLAN_COLORS[plan]}>{plan}</Tag>,
    },
    {
      title: "Status",
      dataIndex: "isActive",
      render: (active: boolean) =>
        active
          ? <Badge status="success" text="Active" />
          : <Badge status="error" text="Inactive" />,
    },
    {
      title: "Users",
      key: "users",
      render: (_: any, r: OrgSummary) => (
        <Space>
          <UserOutlined style={{ color: "#1677ff" }} />
          {r._count.users}
        </Space>
      ),
    },
    {
      title: "Projects",
      key: "projects",
      render: (_: any, r: OrgSummary) => (
        <Space>
          <ProjectOutlined style={{ color: "#52c41a" }} />
          {r._count.projects}
        </Space>
      ),
    },
    {
      title: "Created",
      dataIndex: "createdAt",
      render: (d: string) => dayjs(d).format("DD MMM YYYY"),
    },
    {
      title: "Actions",
      key: "actions",
      render: (_: any, r: OrgSummary) => (
        <Space>
          <Tooltip title="Edit plan / status">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          </Tooltip>
          <Popconfirm
            title={r.isActive ? "Deactivate this organisation?" : "Reactivate this organisation?"}
            onConfirm={() => updateMutation.mutate({ id: r.id, isActive: !r.isActive })}
            okText="Yes"
          >
            <Tooltip title={r.isActive ? "Deactivate" : "Activate"}>
              <Button
                size="small"
                danger={r.isActive}
                icon={r.isActive ? <StopOutlined /> : <CheckCircleOutlined />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <CrownOutlined style={{ fontSize: 24, color: "#faad14" }} />
          <div>
            <Title level={4} style={{ margin: 0, color: "#e8e8e8" }}>Organisation Management</Title>
            <Text type="secondary" style={{ fontSize: 13 }}>Manage all companies on the Stride platform</Text>
          </div>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          Onboard Company
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          {[
            { title: "Total Companies", value: stats.totalOrgs,   color: "#1677ff", icon: <GlobalOutlined /> },
            { title: "Active Companies", value: stats.activeOrgs, color: "#52c41a", icon: <CheckCircleOutlined /> },
            { title: "Total Users",      value: stats.totalUsers, color: "#faad14", icon: <TeamOutlined /> },
          ].map((s) => (
            <Col key={s.title} xs={24} sm={8}>
              <Card styles={{ body: { padding: "16px 20px" } }} style={{ borderRadius: 8, background: "#1a1a1a", border: "1px solid #2a2a2a" }}>
                <Statistic title={s.title} value={s.value} valueStyle={{ color: s.color }} prefix={s.icon} />
              </Card>
            </Col>
          ))}
          {stats.planBreakdown.map((pb: any) => (
            <Col key={pb.plan} xs={12} sm={6}>
              <Card styles={{ body: { padding: "16px 20px" } }} style={{ borderRadius: 8, background: "#1a1a1a", border: "1px solid #2a2a2a" }}>
                <Statistic
                  title={<Tag color={PLAN_COLORS[pb.plan]}>{pb.plan}</Tag>}
                  value={pb.count}
                  suffix="orgs"
                />
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* Table */}
      <Card style={{ borderRadius: 8, background: "#1a1a1a", border: "1px solid #2a2a2a" }}>
        <Table
          dataSource={orgs ?? []}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 10 }}
          size="middle"
        />
      </Card>

      {/* Create Modal */}
      <Modal
        open={createOpen}
        onCancel={() => { setCreateOpen(false); createForm.resetFields(); }}
        title={<><PlusOutlined style={{ marginRight: 8 }} />Onboard New Company</>}
        footer={null}
        width={560}
      >
        <Form form={createForm} layout="vertical" onFinish={(v) => createMutation.mutate(v)} style={{ marginTop: 16 }}>
          <Divider orientationMargin={0} style={{ fontSize: 12, color: "#888" }}>Company Details</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="name" label="Company Name" rules={[{ required: true }]}>
                <Input placeholder="Acme Corp" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="slug"
                label="Slug"
                rules={[{ required: true, pattern: /^[a-z0-9-]+$/, message: "lowercase letters, numbers, hyphens only" }]}
                extra="Used in URLs — lowercase only"
              >
                <Input placeholder="acme-corp" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="plan" label="Plan" initialValue="FREE">
            <Select>
              {PLANS.map((p) => <Option key={p} value={p}><Tag color={PLAN_COLORS[p]}>{p}</Tag></Option>)}
            </Select>
          </Form.Item>

          <Divider orientationMargin={0} style={{ fontSize: 12, color: "#888" }}>Admin Account</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="adminName" label="Admin Name" rules={[{ required: true }]}>
                <Input placeholder="Jane Smith" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="adminEmail" label="Admin Email" rules={[{ required: true, type: "email" }]}>
                <Input placeholder="jane@acme.com" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="adminPassword"
            label="Temporary Password"
            rules={[{ required: true, min: 8, message: "At least 8 characters" }]}
          >
            <Input.Password placeholder="Min 8 characters" />
          </Form.Item>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
            <Button onClick={() => { setCreateOpen(false); createForm.resetFields(); }}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={createMutation.isPending}>
              Onboard Company
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={!!editOrg}
        onCancel={() => setEditOrg(null)}
        title={<><EditOutlined style={{ marginRight: 8 }} />Edit {editOrg?.name}</>}
        footer={null}
        width={400}
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={(v) => updateMutation.mutate({ id: editOrg!.id, ...v })}
          style={{ marginTop: 16 }}
        >
          <Form.Item name="name" label="Company Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="plan" label="Plan">
            <Select>
              {PLANS.map((p) => <Option key={p} value={p}><Tag color={PLAN_COLORS[p]}>{p}</Tag></Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="isActive" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button onClick={() => setEditOrg(null)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={updateMutation.isPending}>Save Changes</Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
