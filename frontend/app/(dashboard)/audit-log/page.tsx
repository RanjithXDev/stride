"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Table, Tag, Avatar, Space, Typography, Input, Select, Card, Empty } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import api from "@/lib/api";

dayjs.extend(relativeTime);
const { Text } = Typography;
const { Option } = Select;

interface AuditEvent {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string;
  createdAt: string;
  actor: { id: string; name: string; email: string; avatar?: string } | null;
  source: string;
  reason?: string;
}

async function fetchAuditEvents(params: Record<string, string>) {
  const res = await api.get<{ events: AuditEvent[]; total: number; page: number; pageSize: number }>("/audit", { params });
  return res.data;
}

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [actionFilter, setActionFilter] = useState("");
  const [resourceType, setResourceType] = useState("");

  const params: Record<string, string> = { page: String(page), pageSize: String(pageSize) };
  if (actionFilter) params.action = actionFilter;
  if (resourceType) params.resourceType = resourceType;

  const { data, isLoading } = useQuery({
    queryKey: ["audit-log", page, actionFilter, resourceType],
    queryFn: () => fetchAuditEvents(params),
    staleTime: 30_000,
  });

  const columns = [
    {
      title: "When",
      key: "when",
      width: 120,
      render: (_: unknown, r: AuditEvent) => (
        <Text style={{ fontSize: 12 }} type="secondary">{dayjs(r.createdAt).fromNow()}</Text>
      ),
    },
    {
      title: "Actor",
      key: "actor",
      width: 160,
      render: (_: unknown, r: AuditEvent) =>
        r.actor ? (
          <Space size={6}>
            <Avatar size={22} style={{ background: "#1677ff", fontSize: 10 }}>{r.actor.name[0]?.toUpperCase()}</Avatar>
            <Text style={{ fontSize: 12 }}>{r.actor.name}</Text>
          </Space>
        ) : <Text type="secondary" style={{ fontSize: 12 }}>System</Text>,
    },
    {
      title: "Action",
      dataIndex: "action",
      key: "action",
      render: (v: string) => (
        <Tag style={{ fontSize: 11, fontFamily: "monospace" }}>{v}</Tag>
      ),
    },
    {
      title: "Resource",
      key: "resource",
      render: (_: unknown, r: AuditEvent) => (
        <Space size={4}>
          <Tag color="blue" style={{ fontSize: 11 }}>{r.resourceType}</Tag>
          <Text type="secondary" style={{ fontSize: 11, fontFamily: "monospace" }}>{r.resourceId.slice(0, 12)}…</Text>
        </Space>
      ),
    },
    {
      title: "Source",
      dataIndex: "source",
      key: "source",
      width: 80,
      render: (v: string) => <Tag style={{ fontSize: 10 }}>{v}</Tag>,
    },
  ];

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <Card
        size="small"
        title="Audit Log"
        extra={
          <Space wrap>
            <Input
              size="small"
              prefix={<SearchOutlined />}
              placeholder="Filter by action"
              style={{ width: 180 }}
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
              allowClear
            />
            <Select
              size="small"
              placeholder="Resource type"
              style={{ width: 140 }}
              value={resourceType || undefined}
              onChange={(v) => { setResourceType(v ?? ""); setPage(1); }}
              allowClear
            >
              {["user", "expense", "ticket", "project", "scm_repo", "income", "attendance"].map(t => (
                <Option key={t} value={t}>{t}</Option>
              ))}
            </Select>
          </Space>
        }
      >
        {data?.events.length === 0 && !isLoading
          ? <Empty description="No audit events found" />
          : (
            <Table
              dataSource={data?.events ?? []}
              columns={columns}
              rowKey="id"
              size="small"
              loading={isLoading}
              scroll={{ x: 700 }}
              pagination={{
                current: page,
                pageSize,
                total: data?.total ?? 0,
                onChange: setPage,
                showSizeChanger: false,
                showTotal: (t) => `${t} events`,
              }}
            />
          )
        }
      </Card>
    </div>
  );
}
