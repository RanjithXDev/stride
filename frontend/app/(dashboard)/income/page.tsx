"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Table, Button, Typography, Space, Tag, Input, Select,
  Modal, Form, Upload, InputNumber, message, DatePicker, Statistic, Row, Col,
} from "antd";
import {
  PlusOutlined, UploadOutlined, SearchOutlined,
  FileTextOutlined, FilePdfOutlined, FileImageOutlined,
  ArrowUpOutlined,
} from "@ant-design/icons";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";
import { incomeApi, Income, IncomeStatus, IncomeCategory, STATUS_LABELS, CATEGORY_LABELS } from "@/lib/income";
import { useAuthStore } from "@/store/auth";
import { openSecureFile } from "@/hooks/useSecureFile";

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

function ProofIcon({ type }: { type?: string | null }) {
  if (!type) return null;
  if (type === "application/pdf") return <FilePdfOutlined style={{ color: "#f5222d" }} />;
  if (type.startsWith("image/")) return <FileImageOutlined style={{ color: "#1677ff" }} />;
  return <FileTextOutlined />;
}

export default function IncomePage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [form] = Form.useForm();
  const [fileList, setFileList] = useState<any[]>([]);

  const { data: incomes = [], isLoading } = useQuery({
    queryKey: ["incomes", filters],
    queryFn: () => incomeApi.list(filters),
  });

  const { data: summary } = useQuery({
    queryKey: ["income-summary"],
    queryFn: () => incomeApi.summary(),
  });

  const fmtINR = (n: number) =>
    `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const createMutation = useMutation({
    mutationFn: (values: any) => {
      const fd = new FormData();
      fd.append("title",    values.title);
      fd.append("amount",   String(values.amount));
      fd.append("category", values.category ?? "OTHER");
      fd.append("status",   values.status ?? "PENDING");
      if (values.date)        fd.append("date",        values.date.toISOString());
      if (values.description) fd.append("description", values.description);
      if (fileList[0]?.originFileObj) fd.append("proof", fileList[0].originFileObj);
      return incomeApi.create(fd);
    },
    onSuccess: () => {
      message.success("Income recorded");
      queryClient.invalidateQueries({ queryKey: ["incomes"] });
      queryClient.invalidateQueries({ queryKey: ["income-summary"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      form.resetFields();
      setFileList([]);
      setCreateOpen(false);
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? "Failed"),
  });

  const columns = [
    {
      title: "Title",
      dataIndex: "title",
      key: "title",
      render: (text: string, r: Income) => (
        <Space>
          <ProofIcon type={r.proofType} />
          <a onClick={() => router.push(`/income/${r.id}`)} style={{ fontWeight: 500 }}>{text}</a>
        </Space>
      ),
    },
    {
      title: "Amount",
      dataIndex: "amount",
      key: "amount",
      width: 120,
      render: (v: string) => (
        <Text strong style={{ fontVariantNumeric: "tabular-nums", color: "#52c41a" }}>
          ₹{Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
        </Text>
      ),
    },
    {
      title: "Category",
      dataIndex: "category",
      key: "category",
      width: 140,
      render: (c: IncomeCategory) => CATEGORY_LABELS[c],
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 110,
      render: (s: IncomeStatus) => {
        const cfg = STATUS_LABELS[s];
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
      width: 110,
      render: (d: string) => <Text style={{ fontSize: 12 }}>{dayjs(d).format("MMM D, YYYY")}</Text>,
    },
    {
      title: "Recorded By",
      key: "recordedBy",
      width: 130,
      render: (_: any, r: Income) => r.recordedBy.name,
    },
    {
      title: "Proof",
      key: "proof",
      width: 60,
      render: (_: any, r: Income) =>
        r.proofUrl ? (
          <a onClick={() => openSecureFile(r.proofUrl!).catch(() => message.error("Unable to open proof"))}>
            <ProofIcon type={r.proofType} />
          </a>
        ) : <Text type="secondary">—</Text>,
    },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Income</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}
          style={{ background: "#52c41a", borderColor: "#52c41a" }}>
          Record Income
        </Button>
      </div>

      {summary && (
        <Row gutter={16} style={{ marginBottom: 20 }}>
          <Col xs={12} sm={6}>
            <div style={{ padding: "14px 18px", background: "var(--app-bg-elevated, #fff)", borderRadius: 10, border: "1px solid #b7eb8f" }}>
              <Statistic
                title="Received This Month"
                value={summary.monthly.total}
                precision={0}
                prefix="₹"
                valueStyle={{ color: "#52c41a", fontSize: 20 }}
                formatter={(v) => Number(v).toLocaleString("en-IN")}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>{summary.monthly.count} entries</Text>
            </div>
          </Col>
          <Col xs={12} sm={6}>
            <div style={{ padding: "14px 18px", background: "var(--app-bg-elevated, #fff)", borderRadius: 10, border: "1px solid #b7eb8f" }}>
              <Statistic
                title="Received This Year"
                value={summary.yearly.total}
                precision={0}
                prefix="₹"
                valueStyle={{ color: "#52c41a", fontSize: 20 }}
                formatter={(v) => Number(v).toLocaleString("en-IN")}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>{summary.yearly.count} entries</Text>
            </div>
          </Col>
        </Row>
      )}

      <Space wrap style={{ marginBottom: 16 }}>
        <Input
          prefix={<SearchOutlined />}
          placeholder="Search income..."
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value || "" }))}
          style={{ width: 220 }}
          allowClear
        />
        <Select
          placeholder="Status"
          value={filters.status}
          onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
          allowClear style={{ width: 140 }}
        >
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <Option key={k} value={k}>{v.label}</Option>
          ))}
        </Select>
        <Select
          placeholder="Category"
          value={filters.category}
          onChange={(v) => setFilters((f) => ({ ...f, category: v }))}
          allowClear style={{ width: 160 }}
        >
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
            <Option key={k} value={k}>{v}</Option>
          ))}
        </Select>
      </Space>

      <Table
        dataSource={incomes}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        size="middle"
        pagination={{ pageSize: 20, showSizeChanger: false }}
        onRow={(r) => ({ onClick: () => router.push(`/income/${r.id}`), style: { cursor: "pointer" } })}
      />

      <Modal
        title={<Space><ArrowUpOutlined style={{ color: "#52c41a" }} /> Record Income</ Space>}
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={createMutation.mutate} style={{ marginTop: 16 }}>
          <Form.Item name="title" label="Title" rules={[{ required: true }]}>
            <Input placeholder="e.g. Client payment — Acme Corp" />
          </Form.Item>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Form.Item name="amount" label="Amount (₹)" rules={[{ required: true }]}>
              <InputNumber min={0.01} precision={2} style={{ width: "100%" }} placeholder="0.00" />
            </Form.Item>
            <Form.Item name="category" label="Category" initialValue="OTHER">
              <Select>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => <Option key={k} value={k}>{v}</Option>)}
              </Select>
            </Form.Item>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Form.Item name="status" label="Status" initialValue="PENDING">
              <Select>
                {Object.entries(STATUS_LABELS).map(([k, v]) => <Option key={k} value={k}>{v.label}</Option>)}
              </Select>
            </Form.Item>
            <Form.Item name="date" label="Date" initialValue={dayjs()}>
              <DatePicker style={{ width: "100%" }} />
            </Form.Item>
          </div>
          <Form.Item name="description" label="Notes">
            <TextArea rows={3} placeholder="Additional details..." />
          </Form.Item>
          <Form.Item label="Proof (invoice / receipt)">
            <Upload
              fileList={fileList}
              beforeUpload={() => false}
              onChange={({ fileList: fl }) => setFileList(fl.slice(-1))}
              accept=".jpg,.jpeg,.png,.webp,.pdf"
              maxCount={1}
            >
              <Button icon={<UploadOutlined />}>Attach File</Button>
            </Upload>
            <Text type="secondary" style={{ fontSize: 11 }}>JPEG, PNG, WebP or PDF · max 10 MB</Text>
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: "right" }}>
            <Button onClick={() => setCreateOpen(false)} style={{ marginRight: 8 }}>Cancel</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={createMutation.isPending}
              style={{ background: "#52c41a", borderColor: "#52c41a" }}
            >
              Record
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
