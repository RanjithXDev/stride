"use client";
import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Typography, Space, Tag, Button, Card, Descriptions,
  Timeline, Spin, Avatar, Divider, Modal, Input, message,
  Alert, Row, Col,
} from "antd";
import {
  ArrowLeftOutlined, CheckCircleOutlined, CloseCircleOutlined,
  FilePdfOutlined, FileImageOutlined, ClockCircleOutlined,
  DollarOutlined, RollbackOutlined,
} from "@ant-design/icons";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { expensesApi, ExpenseApproval, STATUS_LABELS, CATEGORY_LABELS } from "@/lib/expenses";
import { useAuthStore } from "@/store/auth";
import { openSecureFile, useSecureFile } from "@/hooks/useSecureFile";

dayjs.extend(relativeTime);

const { Title, Text } = Typography;
const { TextArea } = Input;

const roleColors: Record<string, string> = { FOUNDER: "purple", CFO: "green", MANAGER: "blue", EMPLOYEE: "default" };

function ApprovalTimeline({ approvals, status }: { approvals: ExpenseApproval[]; status: string }) {
  const l1 = approvals.find((a) => a.level === 1);
  const l2 = approvals.find((a) => a.level === 2);

  const items = [
    {
      icon: <CheckCircleOutlined style={{ color: "#52c41a" }} />,
      content: (
        <div>
          <Text strong style={{ fontSize: 13 }}>Submitted</Text>
          <div style={{ fontSize: 12, color: "#888" }}>Pending Manager approval</div>
        </div>
      ),
    },
    {
      icon: l1
        ? l1.decision === "APPROVED"
          ? <CheckCircleOutlined style={{ color: "#52c41a" }} />
          : <CloseCircleOutlined style={{ color: "#f5222d" }} />
        : <ClockCircleOutlined style={{ color: "#d9d9d9" }} />,
      content: (
        <div>
          <Space>
            <Text strong style={{ fontSize: 13 }}>Manager Review (L1)</Text>
            {l1 && <Tag color={l1.decision === "APPROVED" ? "success" : "error"}>{l1.decision}</Tag>}
          </Space>
          {l1 && (
            <div style={{ fontSize: 12, color: "#888" }}>
              By {l1.approver.name} · {dayjs(l1.decidedAt).fromNow()}
              {l1.note && <div style={{ marginTop: 4, fontStyle: "italic" }}>"{l1.note}"</div>}
            </div>
          )}
          {!l1 && <div style={{ fontSize: 12, color: "#bbb" }}>Waiting for manager</div>}
        </div>
      ),
    },
    {
      icon: l2
        ? l2.decision === "APPROVED"
          ? <CheckCircleOutlined style={{ color: "#52c41a" }} />
          : <CloseCircleOutlined style={{ color: "#f5222d" }} />
        : <ClockCircleOutlined style={{ color: "#d9d9d9" }} />,
      content: (
        <div>
          <Space>
            <Text strong style={{ fontSize: 13 }}>Finance Review (L2)</Text>
            {l2 && <Tag color={l2.decision === "APPROVED" ? "success" : "error"}>{l2.decision}</Tag>}
          </Space>
          {l2 && (
            <div style={{ fontSize: 12, color: "#888" }}>
              By {l2.approver.name} · {dayjs(l2.decidedAt).fromNow()}
              {l2.note && <div style={{ marginTop: 4, fontStyle: "italic" }}>"{l2.note}"</div>}
            </div>
          )}
          {!l2 && <div style={{ fontSize: 12, color: "#bbb" }}>Waiting for CFO / Founder</div>}
        </div>
      ),
    },
    {
      icon: status === "APPROVED" || status === "PAID"
        ? <CheckCircleOutlined style={{ color: "#13c2c2" }} />
        : <ClockCircleOutlined style={{ color: "#d9d9d9" }} />,
      content: (
        <Text strong style={{ fontSize: 13, color: status === "APPROVED" || status === "PAID" ? "#13c2c2" : "#bbb" }}>
          Fully Approved
        </Text>
      ),
    },
    {
      icon: status === "PAID"
        ? <CheckCircleOutlined style={{ color: "#52c41a" }} />
        : <ClockCircleOutlined style={{ color: "#d9d9d9" }} />,
      content: (
        <Text strong style={{ fontSize: 13, color: status === "PAID" ? "#52c41a" : "#bbb" }}>
          Paid
        </Text>
      ),
    },
  ];

  return <Timeline items={items} />;
}

export default function ExpenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [approveNote, setApproveNote] = useState("");

  const { data: expense, isLoading } = useQuery({
    queryKey: ["expense", id],
    queryFn: () => expensesApi.get(id),
  });
  const proofUrl = useSecureFile(expense?.proofUrl);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["expense", id] });
    queryClient.invalidateQueries({ queryKey: ["expenses"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const approveMutation = useMutation({
    mutationFn: ({ decision, note }: { decision: "APPROVED" | "REJECTED"; note?: string }) =>
      expensesApi.approve(id, decision, note),
    onSuccess: () => {
      invalidate();
      setRejectOpen(false);
      message.success("Decision recorded");
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? "Action failed"),
  });

  const paidMutation = useMutation({
    mutationFn: () => expensesApi.markAsPaid(id),
    onSuccess: () => { invalidate(); message.success("Expense marked as paid"); },
    onError: (e: any) => message.error(e?.response?.data?.message ?? "Action failed"),
  });

  const revokeMutation = useMutation({
    mutationFn: () => expensesApi.revokePayment(id),
    onSuccess: () => { invalidate(); message.success("Payment revoked"); },
    onError: (e: any) => message.error(e?.response?.data?.message ?? "Action failed"),
  });

  const revokeApprovalMutation = useMutation({
    mutationFn: () => expensesApi.revokeApproval(id),
    onSuccess: () => { invalidate(); message.success("L2 approval revoked — sent back for re-review"); },
    onError: (e: any) => message.error(e?.response?.data?.message ?? "Action failed"),
  });

  const revokeL1Mutation = useMutation({
    mutationFn: () => expensesApi.revokeL1Approval(id),
    onSuccess: () => { invalidate(); message.success("L1 approval revoked — sent back to submitted"); },
    onError: (e: any) => message.error(e?.response?.data?.message ?? "Action failed"),
  });

  if (isLoading) return <Spin style={{ display: "block", margin: "80px auto" }} />;
  if (!expense)  return <Text type="danger">Expense not found.</Text>;

  const cfg = STATUS_LABELS[expense.status];
  const isFinance = user?.role === "FOUNDER" || user?.role === "CFO";
  const isManager = user?.role === "MANAGER";

  const canApproveL1 = isManager && expense.status === "SUBMITTED";
  const canApproveL2 = isFinance && expense.status === "L1_APPROVED";
  const canAct       = canApproveL1 || canApproveL2;
  // Founder can approve SUBMITTED directly as L2
  const founderDirectApprove = user?.role === "FOUNDER" && expense.status === "SUBMITTED";

  const isRejected        = expense.status === "REJECTED";
  const isApproved        = expense.status === "APPROVED";
  const isPaid            = expense.status === "PAID";
  const canMarkPaid        = isFinance && isApproved;
  const canRevoke          = isFinance && isPaid;
  const canRevokeApproval  = isFinance && isApproved;
  const canRevokeL1        = (isManager || isFinance) && expense.status === "L1_APPROVED";

  const isImage = expense.proofType?.startsWith("image/");
  const isPdf   = expense.proofType === "application/pdf";

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <Button icon={<ArrowLeftOutlined />} type="link" style={{ paddingLeft: 0, marginBottom: 16 }}
        onClick={() => router.push("/expenses")}>
        Back to Expenses
      </Button>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div>
          <Space style={{ marginBottom: 6 }}>
            <Tag color={cfg.color} style={{ fontWeight: 600 }}>{cfg.label}</Tag>
            <Tag>{CATEGORY_LABELS[expense.category]}</Tag>
          </Space>
          <Title level={3} style={{ margin: 0 }}>{expense.title}</Title>
          <Text type="secondary">Submitted by <Text strong>{expense.submittedBy.name}</Text> · {dayjs(expense.createdAt).format("D MMM YYYY")}</Text>
        </div>
        <Title level={2} style={{ margin: 0, color: isPaid ? "#52c41a" : undefined }}>
          ₹{Number(expense.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
        </Title>
      </div>

      {isRejected && (
        <Alert type="error" showIcon title="This expense was rejected." style={{ marginBottom: 16 }} />
      )}
      {isApproved && (
        <Alert type="info" showIcon title="This expense is fully approved and awaiting payment." style={{ marginBottom: 16 }} />
      )}
      {isPaid && (
        <Alert type="success" showIcon title="This expense has been approved and paid." style={{ marginBottom: 16 }} />
      )}

      <Row gutter={24}>
        <Col xs={24} md={14}>
          {/* Details */}
          <Card title="Details" style={{ marginBottom: 20 }}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Submitted By">
                <Space>
                  <Avatar size={22} style={{ background: roleColors[expense.submittedBy.role] === "default" ? "#8c8c8c" : undefined, fontSize: 11 }}>
                    {expense.submittedBy.name.charAt(0)}
                  </Avatar>
                  <span>{expense.submittedBy.name}</span>
                  <Tag color={roleColors[expense.submittedBy.role]}>{expense.submittedBy.role}</Tag>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Department">
                {expense.submittedBy.department?.name ?? "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Manager">
                {expense.submittedBy.manager?.name ?? "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Submitted">
                {dayjs(expense.createdAt).format("D MMM YYYY, h:mm A")}
              </Descriptions.Item>
            </Descriptions>
            {expense.description && (
              <>
                <Divider style={{ margin: "12px 0" }} />
                <Text type="secondary" style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>JUSTIFICATION</Text>
                <Text style={{ whiteSpace: "pre-wrap" }}>{expense.description}</Text>
              </>
            )}
          </Card>

          {/* Proof */}
          <Card title="Proof / Receipt" style={{ marginBottom: 20 }}>
            {proofUrl ? (
              <div>
                <Space style={{ marginBottom: 12 }}>
                  {isPdf ? <FilePdfOutlined style={{ color: "#f5222d", fontSize: 18 }} /> : <FileImageOutlined style={{ color: "#1677ff", fontSize: 18 }} />}
                  <Text>{expense.proofName}</Text>
                  <Button size="small" onClick={() => expense.proofUrl && openSecureFile(expense.proofUrl)}>Open</Button>
                </Space>
                {isImage && (
                  <img
                    src={proofUrl}
                    alt="Expense proof"
                    style={{ maxWidth: "100%", borderRadius: 8, border: "1px solid #f0f0f0" }}
                  />
                )}
                {isPdf && (
                  <iframe
                    src={proofUrl}
                    style={{ width: "100%", height: 400, border: "1px solid #f0f0f0", borderRadius: 8 }}
                    title="Expense proof PDF"
                  />
                )}
              </div>
            ) : (
              <Text type="secondary">No proof attached.</Text>
            )}
          </Card>
        </Col>

        <Col xs={24} md={10}>
          {/* Approval Actions */}
          {(canAct || founderDirectApprove) && (
            <Card title="Your Action" style={{ marginBottom: 20, borderColor: "#1677ff" }}>
              <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 12 }}>
                {canApproveL1 && "Review this expense from your team member."}
                {canApproveL2 && "Final approval — this expense is L1 approved."}
                {founderDirectApprove && "You can directly approve or reject this expense."}
              </Text>
              <Input.TextArea
                rows={2} placeholder="Note (optional)"
                value={approveNote}
                onChange={(e) => setApproveNote(e.target.value)}
                style={{ marginBottom: 10 }}
              />
              <Space>
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  loading={approveMutation.isPending}
                  onClick={() => approveMutation.mutate({ decision: "APPROVED", note: approveNote || undefined })}
                >
                  Approve
                </Button>
                <Button
                  danger
                  icon={<CloseCircleOutlined />}
                  onClick={() => setRejectOpen(true)}
                >
                  Reject
                </Button>
              </Space>
            </Card>
          )}

          {/* Mark as Paid + Revoke Approval — shown when APPROVED */}
          {canMarkPaid && (
            <Card
              style={{ marginBottom: 20, borderColor: "#52c41a" }}
              styles={{ body: { padding: "16px 20px" } }}
            >
              <Text strong style={{ display: "block", marginBottom: 4, color: "var(--app-text)" }}>
                Payment Actions
              </Text>
              <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 12 }}>
                This expense is fully approved. Confirm payment or revoke the L2 approval to send it back for re-review.
              </Text>
              <Space wrap>
                <Button
                  type="primary"
                  icon={<DollarOutlined />}
                  loading={paidMutation.isPending}
                  onClick={() => paidMutation.mutate()}
                  style={{ background: "#52c41a", borderColor: "#52c41a" }}
                >
                  Mark as Paid
                </Button>
                {canRevokeApproval && (
                  <Button
                    icon={<RollbackOutlined />}
                    loading={revokeApprovalMutation.isPending}
                    onClick={() => revokeApprovalMutation.mutate()}
                    danger
                  >
                    Revoke Approval
                  </Button>
                )}
              </Space>
            </Card>
          )}

          {/* Revoke L1 Approval */}
          {canRevokeL1 && (
            <Card
              style={{ marginBottom: 20, borderColor: "#fa8c16" }}
              styles={{ body: { padding: "16px 20px" } }}
            >
              <Text strong style={{ display: "block", marginBottom: 4, color: "var(--app-text)" }}>
                Revoke L1 Approval
              </Text>
              <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 12 }}>
                Send this expense back to submitted so it can be reviewed and re-approved.
              </Text>
              <Button
                icon={<RollbackOutlined />}
                loading={revokeL1Mutation.isPending}
                onClick={() => revokeL1Mutation.mutate()}
                danger
              >
                Revoke L1 Approval
              </Button>
            </Card>
          )}

          {/* Revoke Payment */}
          {canRevoke && (
            <Card
              style={{ marginBottom: 20, borderColor: "#fa8c16" }}
              styles={{ body: { padding: "16px 20px" } }}
            >
              <Text strong style={{ display: "block", marginBottom: 4, color: "var(--app-text)" }}>
                Revoke Payment
              </Text>
              <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 12 }}>
                Revert this expense back to "Approved" status if the payment needs to be re-processed.
              </Text>
              <Button
                icon={<RollbackOutlined />}
                loading={revokeMutation.isPending}
                onClick={() => revokeMutation.mutate()}
                danger
              >
                Revoke Payment
              </Button>
            </Card>
          )}

          {/* Approval Timeline */}
          <Card title="Approval Trail">
            <ApprovalTimeline approvals={expense.approvals} status={expense.status} />
          </Card>
        </Col>
      </Row>

      {/* Reject Modal */}
      <Modal
        title="Reject Expense"
        open={rejectOpen}
        onCancel={() => setRejectOpen(false)}
        onOk={() => approveMutation.mutate({ decision: "REJECTED", note: rejectNote || undefined })}
        okText="Confirm Rejection"
        okButtonProps={{ danger: true, loading: approveMutation.isPending }}
      >
        <TextArea
          rows={3}
          placeholder="Reason for rejection (optional but recommended)..."
          value={rejectNote}
          onChange={(e) => setRejectNote(e.target.value)}
          style={{ marginTop: 12 }}
        />
      </Modal>
    </div>
  );
}
