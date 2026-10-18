"use client";
import { Input, Select, Space } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { TicketFilters } from "@/lib/tickets";

const { Option } = Select;

interface Props {
  filters: TicketFilters;
  onChange: (next: TicketFilters) => void;
}

export default function TicketFiltersBar({ filters, onChange }: Props) {
  return (
    <Space wrap style={{ marginBottom: 16 }}>
      <Input
        placeholder="Search tickets..."
        prefix={<SearchOutlined />}
        value={filters.search}
        onChange={(e) => onChange({ ...filters, search: e.target.value || undefined })}
        style={{ width: 220 }}
        allowClear
      />
      <Select
        placeholder="Status"
        value={filters.status}
        onChange={(v) => onChange({ ...filters, status: v })}
        allowClear
        style={{ width: 140 }}
      >
        <Option value="OPEN">Open</Option>
        <Option value="IN_PROGRESS">In Progress</Option>
        <Option value="IN_REVIEW">In Review</Option>
        <Option value="CLOSED">Closed</Option>
      </Select>
      <Select
        placeholder="Priority"
        value={filters.priority}
        onChange={(v) => onChange({ ...filters, priority: v })}
        allowClear
        style={{ width: 130 }}
      >
        <Option value="LOW">Low</Option>
        <Option value="MEDIUM">Medium</Option>
        <Option value="HIGH">High</Option>
        <Option value="CRITICAL">Critical</Option>
      </Select>
      <Select
        placeholder="Type"
        value={filters.type}
        onChange={(v) => onChange({ ...filters, type: v })}
        allowClear
        style={{ width: 140 }}
      >
        <Option value="TASK">Task</Option>
        <Option value="BUG">Bug</Option>
        <Option value="FEATURE">Feature</Option>
        <Option value="IMPROVEMENT">Improvement</Option>
      </Select>
    </Space>
  );
}
