"use client";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Table, Button, Typography, Space, Tag, Input, Select,
  Modal, Form, Upload, InputNumber, message, Tooltip,
  Card, Row, Col, Progress, Tabs, Statistic, Avatar,
  Badge, Alert, Popconfirm, Empty, Spin, Divider,
} from "antd";
import {
  PlusOutlined, UploadOutlined, SearchOutlined,
  FileTextOutlined, FilePdfOutlined, FileImageOutlined,
  CheckOutlined, CloseOutlined, DollarOutlined,
  ClockCircleOutlined, CheckCircleOutlined, ExclamationCircleOutlined,
  CreditCardOutlined, TeamOutlined, BarChartOutlined, ArrowUpOutlined,
} from "@ant-design/icons";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import {
  expensesApi, Expense, ExpenseStatus, ExpenseCategory,
  STATUS_LABELS, CATEGORY_LABELS,
} from "@/lib/expenses";
import { useAuthStore } from "@/store/auth";
import { openSecureFile } from "@/hooks/useSecureFile";

dayjs.extend(relativeTime);

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const FINANCE_ROLES = ["FOUNDER", "CFO"];
const APPROVAL_ROLES = ["FOUNDER", "CFO", "MANAGER"];

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  TRAVEL: "#1677ff", MEALS: "#52c41a", EQUIPMENT: "#fa8c16",
  SOFTWARE: "#722ed1", TRAINING: "#13c2c2", OFFICE: "#eb2f96", OTHER: "#8c8c8c",
};

function fmtINR(v: number) {
  return `₹${v.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function ProofIcon({ type }: { type?: string | null }) {
  if (!type) return null;
  if (type === "application/pdf") return <FilePdfOutlined style={{ color: "#f5222d" }} />;
  if (type.startsWith("image/")) return <FileImageOutlined style={{ color: "#1677ff" }} />;
  return <FileTextOutlined />;
}

// ── Submit Expense Modal ──────────────────────────────────────
function SubmitExpenseModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [form] = Form.useForm();
  const [fileList, setFileList] = useState<any[]>([]);

  const createMutation = useMutation({
    mutationFn: (values: any) => {
      const fd = new FormData();
      fd.append("title", values.title);
      fd.append("amount", String(values.amount));
      fd.append("category", values.category ?? "OTHER");
      if (values.description) fd.append("description", values.description);
      if (fileList[0]?.originFileObj) fd.append("proof", fileList[0].originFileObj);
      return expensesApi.create(fd);
    },
    onSuccess: () => {
      message.success("Expense submitted");
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["expenses-pending"] });
      form.resetFields();
      setFileList([]);
      onClose();
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? "Failed to submit"),
  });

  return (
    <Modal
      title="Submit Expense"
      open={open}
      onCancel={() => { onClose(); form.resetFields(); setFileList([]); }}
      footer={null}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={createMutation.mutate} style={{ marginTop: 16 }}>
        <Form.Item name="title" label="Title" rules={[{ required: true }]}>
          <Input placeholder="e.g. Flight to client meeting" />
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
        <Form.Item name="description" label="Description / Justification">
          <TextArea rows={3} placeholder="Explain purpose of the expense..." />
        </Form.Item>
        <Form.Item label="Proof (receipt / invoice)">
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
          <Button onClick={() => { onClose(); form.resetFields(); setFileList([]); }} style={{ marginRight: 8 }}>Cancel</Button>
          <Button type="primary" htmlType="submit" loading={createMutation.isPending}>Submit</Button>
        </Form.Item>
      </Form>
    </Modal>
  );
}

// ── Approve/Reject inline for pending list ────────────────────
function ApproveActions({ expense, onDone }: { expense: Expense; onDone: () => void }) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [pendingDecision, setPendingDecision] = useState<"APPROVED" | "REJECTED" | null>(null);

  const mutation = useMutation({
    mutationFn: ({ decision, n }: { decision: "APPROVED" | "REJECTED"; n?: string }) =>
      expensesApi.approve(expense.id, decision, n),
    onSuccess: () => {
      message.success(pendingDecision === "APPROVED" ? "Expense approved" : "Expense rejected");
      setNoteOpen(false);
      setNote("");
      onDone();
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? "Action failed"),
  });

  const trigger = (decision: "APPROVED" | "REJECTED") => {
    setPendingDecision(decision);
    setNoteOpen(true);
  };

  return (
    <>
      <Space size={4}>
        <Button
          size="small"
          type="primary"
          icon={<CheckOutlined />}
          onClick={() => trigger("APPROVED")}
          loading={mutation.isPending && pendingDecision === "APPROVED"}
        >
          Approve
        </Button>
        <Button
          size="small"
          danger
          icon={<CloseOutlined />}
          onClick={() => trigger("REJECTED")}
          loading={mutation.isPending && pendingDecision === "REJECTED"}
        >
          Reject
        </Button>
      </Space>
      <Modal
        title={pendingDecision === "APPROVED" ? "Approve Expense" : "Reject Expense"}
        open={noteOpen}
        onOk={() => mutation.mutate({ decision: pendingDecision!, n: note || undefined })}
        onCancel={() => setNoteOpen(false)}
        okText={pendingDecision === "APPROVED" ? "Approve" : "Reject"}
        okButtonProps={{ danger: pendingDecision === "REJECTED", loading: mutation.isPending }}
        width={400}
      >
        <div style={{ marginTop: 12 }}>
          <Text strong style={{ display: "block", marginBottom: 8 }}>{expense.title}</Text>
          <Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
            {fmtINR(Number(expense.amount))} · {CATEGORY_LABELS[expense.category]} · by {expense.submittedBy.name}
          </Text>
          <Input.TextArea
            rows={3}
            placeholder="Optional note (visible to submitter)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </Modal>
    </>
  );
}

// ── Category bar chart ────────────────────────────────────────
function CategoryBreakdown({ byCategory }: { byCategory: { category: string; _sum: { amount: any }; _count: number }[] }) {
  const sorted = [...byCategory].sort((a, b) => Number(b._sum.amount) - Number(a._sum.amount));
  const max = sorted[0] ? Number(sorted[0]._sum.amount) : 1;

  if (sorted.length === 0) {
    return <Empty description="No paid expenses this year" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: "24px 0" }} />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {sorted.map((row) => {
        const cat = row.category as ExpenseCategory;
        const pct = Math.round((Number(row._sum.amount) / max) * 100);
        return (
          <div key={row.category}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: 500 }}>{CATEGORY_LABELS[cat] ?? cat}</Text>
              <Text style={{ fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
                {fmtINR(Number(row._sum.amount))} <Text type="secondary" style={{ fontSize: 11 }}>({row._count})</Text>
              </Text>
            </div>
            <Progress
              percent={pct}
              showInfo={false}
              strokeColor={CATEGORY_COLORS[cat] ?? "#1677ff"}
              size={["100%", 6]}
              style={{ margin: 0 }}
            />
          </div>
        );
      })}
    </div>
  );
}

// ── Status breakdown ──────────────────────────────────────────
function StatusBreakdown({ byStatus }: { byStatus: { status: string; _count: number }[] }) {
  const total = byStatus.reduce((s, r) => s + r._count, 0) || 1;
  const order: ExpenseStatus[] = ["SUBMITTED", "L1_APPROVED", "APPROVED", "PAID", "REJECTED", "DRAFT"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {order.map((s) => {
        const row = byStatus.find((r) => r.status === s);
        const count = row?._count ?? 0;
        if (count === 0) return null;
        const cfg = STATUS_LABELS[s];
        const pct = Math.round((count / total) * 100);
        return (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, display: "flex", justifyContent: "space-between" }}>
              <Tag color={cfg.color} style={{ margin: 0, fontSize: 11 }}>{cfg.label}</Tag>
              <Text style={{ fontSize: 12, fontVariantNumeric: "tabular-nums" }}>{count}</Text>
            </div>
            <div style={{ width: 80 }}>
              <Progress percent={pct} showInfo={false} size={["100%", 5]} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Top spenders ──────────────────────────────────────────────
function TopSpenders({ spenders }: { spenders: any[] }) {
  if (!spenders?.length) return <Empty description="No data" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  const max = Number(spenders[0]?._sum?.amount ?? 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {spenders.map((s, i) => (
        <div key={s.submittedById} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Text type="secondary" style={{ fontSize: 11, width: 16 }}>{i + 1}</Text>
          <Avatar size={28} style={{ background: "#1677ff", fontSize: 12, flexShrink: 0 }}>
            {s.user?.name?.[0]?.toUpperCase() ?? "?"}
          </Avatar>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
              <Text style={{ fontSize: 12, fontWeight: 500 }} ellipsis>{s.user?.name ?? "Unknown"}</Text>
              <Text style={{ fontSize: 12, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                {fmtINR(Number(s._sum?.amount ?? 0))}
              </Text>
            </div>
            <Progress
              percent={Math.round((Number(s._sum?.amount ?? 0) / max) * 100)}
              showInfo={false}
              size={["100%", 4]}
              strokeColor="#1677ff"
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Expense table ─────────────────────────────────────────────
function ExpenseTable({ expenses, loading }: { expenses: Expense[]; loading: boolean }) {
  const router = useRouter();
  const columns = [
    {
      title: "Title",
      dataIndex: "title",
      key: "title",
      render: (text: string, r: Expense) => (
        <Space>
          <ProofIcon type={r.proofType} />
          <a style={{ fontWeight: 500 }}>{text}</a>
        </Space>
      ),
    },
    {
      title: "Amount",
      dataIndex: "amount",
      key: "amount",
      width: 120,
      render: (v: string) => (
        <Text strong style={{ fontVariantNumeric: "tabular-nums" }}>
          {fmtINR(Number(v))}
        </Text>
      ),
    },
    {
      title: "Category",
      dataIndex: "category",
      key: "category",
      width: 120,
      render: (c: ExpenseCategory) => CATEGORY_LABELS[c],
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 130,
      render: (s: ExpenseStatus) => {
        const cfg = STATUS_LABELS[s];
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: "Submitted By",
      key: "submittedBy",
      width: 140,
      render: (_: any, r: Expense) => r.submittedBy.name,
    },
    {
      title: "Proof",
      key: "proof",
      width: 60,
      render: (_: any, r: Expense) =>
        r.proofUrl ? (
          <Tooltip title={r.proofName}>
            <a onClick={(e) => { e.stopPropagation(); openSecureFile(r.proofUrl!).catch(() => message.error("Unable to open proof")); }}>
              <ProofIcon type={r.proofType} />
            </a>
          </Tooltip>
        ) : <Text type="secondary">—</Text>,
    },
    {
      title: "Submitted",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 110,
      render: (d: string) => <Text style={{ fontSize: 12 }}>{dayjs(d).format("MMM D, YYYY")}</Text>,
    },
  ];

  return (
    <Table
      dataSource={expenses}
      columns={columns}
      rowKey="id"
      loading={loading}
      size="middle"
      pagination={{ pageSize: 20, showSizeChanger: false, showTotal: (t) => `${t} expenses` }}
      onRow={(r) => ({ onClick: () => router.push(`/expenses/${r.id}`), style: { cursor: "pointer" } })}
    />
  );
}

// ── Pending Approvals tab ─────────────────────────────────────
function PendingApprovalsTab() {
  const qc = useQueryClient();
  const { data: pending = [], isLoading } = useQuery({
    queryKey: ["expenses-pending"],
    queryFn: expensesApi.pending,
    staleTime: 30_000,
  });
  const router = useRouter();

  const columns = [
    {
      title: "Expense",
      key: "title",
      render: (_: any, r: Expense) => (
        <div>
          <Text strong style={{ display: "block" }}>{r.title}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {r.submittedBy.name} · {r.submittedBy.department?.name ?? r.submittedBy.role} · {dayjs(r.createdAt).fromNow()}
          </Text>
        </div>
      ),
    },
    {
      title: "Amount",
      dataIndex: "amount",
      key: "amount",
      width: 120,
      render: (v: string) => <Text strong style={{ fontVariantNumeric: "tabular-nums" }}>{fmtINR(Number(v))}</Text>,
    },
    {
      title: "Category",
      dataIndex: "category",
      key: "category",
      width: 110,
      render: (c: ExpenseCategory) => CATEGORY_LABELS[c],
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (s: ExpenseStatus) => <Tag color={STATUS_LABELS[s].color}>{STATUS_LABELS[s].label}</Tag>,
    },
    {
      title: "Actions",
      key: "actions",
      width: 200,
      render: (_: any, r: Expense) => (
        <ApproveActions
          expense={r}
          onDone={() => {
            qc.invalidateQueries({ queryKey: ["expenses-pending"] });
            qc.invalidateQueries({ queryKey: ["expenses"] });
            qc.invalidateQueries({ queryKey: ["expense-financial"] });
          }}
        />
      ),
    },
  ];

  if (isLoading) return <Spin style={{ display: "block", margin: "60px auto" }} />;
  if (pending.length === 0) return (
    <Empty
      description="No expenses awaiting your approval"
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      style={{ padding: "60px 0" }}
    />
  );

  return (
    <Table
      dataSource={pending}
      columns={columns}
      rowKey="id"
      size="middle"
      pagination={false}
      onRow={(r) => ({ onClick: () => router.push(`/expenses/${r.id}`), style: { cursor: "pointer" } })}
    />
  );
}

// ── Financial Report tab ──────────────────────────────────────
function FinancialTab() {
  const { data: fin, isLoading } = useQuery({
    queryKey: ["expense-financial"],
    queryFn: expensesApi.financial,
    staleTime: 60_000,
  });

  if (isLoading) return <Spin style={{ display: "block", margin: "60px auto" }} />;
  if (!fin) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic
              title="Paid This Month"
              value={Number(fin.monthly?.total ?? 0)}
              prefix="₹"
              formatter={(v) => Number(v).toLocaleString("en-IN")}
              valueStyle={{ color: "#52c41a", fontSize: 22 }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>{fin.monthly?.count ?? 0} expenses</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic
              title="Paid This Year"
              value={Number(fin.yearly?.total ?? 0)}
              prefix="₹"
              formatter={(v) => Number(v).toLocaleString("en-IN")}
              valueStyle={{ fontSize: 22 }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>{fin.yearly?.count ?? 0} expenses</Text>
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={12}>
          <Card title="Spending by Category (YTD)" size="small">
            <CategoryBreakdown byCategory={fin.byCategory ?? []} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Top Spenders (YTD)" size="small">
            <TopSpenders spenders={fin.topSpenders ?? []} />
          </Card>
        </Col>
      </Row>
    </div>
  );
}

// ── Overview tab ──────────────────────────────────────────────
function OverviewTab({
  expenses, loadingExpenses, isFinance, pendingCount,
}: {
  expenses: Expense[];
  loadingExpenses: boolean;
  isFinance: boolean;
  pendingCount: number;
}) {
  const router = useRouter();

  const byCategory = useMemo(() => {
    const map: Record<string, { amount: number; count: number }> = {};
    for (const e of expenses.filter((ex) => ex.status === "PAID")) {
      if (!map[e.category]) map[e.category] = { amount: 0, count: 0 };
      map[e.category].amount += Number(e.amount);
      map[e.category].count += 1;
    }
    return Object.entries(map).map(([category, v]) => ({
      category, _sum: { amount: v.amount }, _count: v.count,
    })).sort((a, b) => Number(b._sum.amount) - Number(a._sum.amount));
  }, [expenses]);

  const byStatus = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of expenses) {
      map[e.status] = (map[e.status] ?? 0) + 1;
    }
    return Object.entries(map).map(([status, _count]) => ({ status, _count }));
  }, [expenses]);

  const totalPaid = useMemo(
    () => expenses.filter((e) => e.status === "PAID").reduce((s, e) => s + Number(e.amount), 0),
    [expenses]
  );

  const recentExpenses = expenses.slice(0, 8);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {pendingCount > 0 && (
        <Alert
          type="warning"
          showIcon
          icon={<ExclamationCircleOutlined />}
          message={
            <span>
              <strong>{pendingCount}</strong> expense{pendingCount > 1 ? "s" : ""} awaiting your approval.
            </span>
          }
          action={
            <Button size="small" onClick={() => {}}>
              Review
            </Button>
          }
        />
      )}

      <Row gutter={[16, 16]}>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="Total Paid"
              value={totalPaid}
              prefix="₹"
              formatter={(v) => Number(v).toLocaleString("en-IN")}
              valueStyle={{ color: "#52c41a", fontSize: 18 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="Submitted"
              value={expenses.filter((e) => e.status === "SUBMITTED").length}
              valueStyle={{ fontSize: 18 }}
              suffix={<Text type="secondary" style={{ fontSize: 13 }}>pending</Text>}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="Approved"
              value={expenses.filter((e) => e.status === "APPROVED" || e.status === "L1_APPROVED").length}
              valueStyle={{ color: "#1677ff", fontSize: 18 }}
              suffix={<Text type="secondary" style={{ fontSize: 13 }}>ready</Text>}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="Total Expenses"
              value={expenses.length}
              valueStyle={{ fontSize: 18 }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card title="Spending by Category" size="small" style={{ minHeight: 220 }}>
            {byCategory.length > 0
              ? <CategoryBreakdown byCategory={byCategory} />
              : <Empty description="No paid expenses yet" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: "20px 0" }} />
            }
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="Status Distribution" size="small" style={{ minHeight: 220 }}>
            {byStatus.length > 0
              ? <StatusBreakdown byStatus={byStatus} />
              : <Empty description="No expenses yet" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: "20px 0" }} />
            }
          </Card>
        </Col>
      </Row>

      <Card
        title="Recent Expenses"
        size="small"
        extra={<Button type="link" size="small" style={{ padding: 0 }}>View all</Button>}
      >
        <Table
          dataSource={recentExpenses}
          loading={loadingExpenses}
          rowKey="id"
          size="small"
          pagination={false}
          onRow={(r) => ({ onClick: () => router.push(`/expenses/${r.id}`), style: { cursor: "pointer" } })}
          columns={[
            {
              title: "Title",
              dataIndex: "title",
              key: "title",
              render: (text: string) => <Text style={{ fontWeight: 500 }}>{text}</Text>,
            },
            {
              title: "Amount",
              dataIndex: "amount",
              key: "amount",
              width: 110,
              render: (v: string) => <Text style={{ fontVariantNumeric: "tabular-nums" }}>{fmtINR(Number(v))}</Text>,
            },
            {
              title: "Status",
              dataIndex: "status",
              key: "status",
              width: 120,
              render: (s: ExpenseStatus) => <Tag color={STATUS_LABELS[s].color} style={{ fontSize: 11 }}>{STATUS_LABELS[s].label}</Tag>,
            },
            {
              title: "Submitted By",
              key: "by",
              width: 140,
              render: (_: any, r: Expense) => <Text style={{ fontSize: 12 }}>{r.submittedBy.name}</Text>,
            },
            {
              title: "Date",
              dataIndex: "createdAt",
              key: "date",
              width: 100,
              render: (d: string) => <Text type="secondary" style={{ fontSize: 11 }}>{dayjs(d).fromNow()}</Text>,
            },
          ]}
        />
      </Card>
    </div>
  );
}

// ── All Expenses tab ──────────────────────────────────────────
function AllExpensesTab() {
  const [filters, setFilters] = useState<any>({});
  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["expenses", filters],
    queryFn: () => expensesApi.list(filters),
  });

  return (
    <div>
      <Space wrap style={{ marginBottom: 16 }}>
        <Input
          prefix={<SearchOutlined />}
          placeholder="Search expenses..."
          value={filters.search}
          onChange={(e) => setFilters((f: any) => ({ ...f, search: e.target.value || undefined }))}
          style={{ width: 220 }}
          allowClear
        />
        <Select
          placeholder="Status"
          value={filters.status}
          onChange={(v) => setFilters((f: any) => ({ ...f, status: v }))}
          allowClear
          style={{ width: 150 }}
        >
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <Option key={k} value={k}>{v.label}</Option>
          ))}
        </Select>
        <Select
          placeholder="Category"
          value={filters.category}
          onChange={(v) => setFilters((f: any) => ({ ...f, category: v }))}
          allowClear
          style={{ width: 140 }}
        >
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
            <Option key={k} value={k}>{v}</Option>
          ))}
        </Select>
      </Space>
      <ExpenseTable expenses={expenses} loading={isLoading} />
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function ExpensesPage() {
  const { user } = useAuthStore();
  const [submitOpen, setSubmitOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  const isFinance = FINANCE_ROLES.includes(user?.role ?? "");
  const canApprove = APPROVAL_ROLES.includes(user?.role ?? "");

  const { data: allExpenses = [], isLoading: loadingExpenses } = useQuery({
    queryKey: ["expenses", {}],
    queryFn: () => expensesApi.list({}),
    staleTime: 30_000,
  });

  const { data: pending = [] } = useQuery({
    queryKey: ["expenses-pending"],
    queryFn: expensesApi.pending,
    staleTime: 30_000,
    enabled: canApprove,
  });

  const tabs = [
    {
      key: "overview",
      label: "Overview",
      icon: <BarChartOutlined />,
      children: (
        <OverviewTab
          expenses={allExpenses}
          loadingExpenses={loadingExpenses}
          isFinance={isFinance}
          pendingCount={pending.length}
        />
      ),
    },
    {
      key: "all",
      label: "All Expenses",
      icon: <FileTextOutlined />,
      children: <AllExpensesTab />,
    },
    ...(canApprove ? [{
      key: "pending",
      label: (
        <Badge count={pending.length} size="small" offset={[6, -2]}>
          Pending Approvals
        </Badge>
      ),
      children: <PendingApprovalsTab />,
    }] : []),
    ...(isFinance ? [{
      key: "financial",
      label: "Financial Report",
      icon: <DollarOutlined />,
      children: <FinancialTab />,
    }] : []),
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0 }}>Expenses</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setSubmitOpen(true)}>
          Submit Expense
        </Button>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabs}
        size="small"
      />

      <SubmitExpenseModal open={submitOpen} onClose={() => setSubmitOpen(false)} />
    </div>
  );
}
