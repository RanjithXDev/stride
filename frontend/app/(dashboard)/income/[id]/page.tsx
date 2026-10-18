"use client";
import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Typography, Space, Tag, Button, Card, Descriptions, Spin,
  Avatar, Divider, Modal, Form, Input, InputNumber, Select,
  Upload, DatePicker, message, Alert, Row, Col,
} from "antd";
import {
  ArrowLeftOutlined, CheckCircleOutlined, CloseCircleOutlined,
  FilePdfOutlined, FileImageOutlined, EditOutlined, UploadOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { incomeApi, STATUS_LABELS, CATEGORY_LABELS, IncomeStatus, IncomeCategory } from "@/lib/income";
import { useAuthStore } from "@/store/auth";
import { openSecureFile, useSecureFile } from "@/hooks/useSecureFile";

dayjs.extend(relativeTime);

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

export default function IncomeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen]     = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [form] = Form.useForm();
  const [fileList, setFileList] = useState<any[]>([]);

  const { data: income, isLoading } = useQuery({
    queryKey: ["income", id],
    queryFn: () => incomeApi.get(id),
  });
  const proofUrl = useSecureFile(income?.proofUrl);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["income", id] });
    queryClient.invalidateQueries({ queryKey: ["incomes"] });
    queryClient.invalidateQueries({ queryKey: ["income-summary"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const updateMutation = useMutation({
    mutationFn: (values: any) => {
      const fd = new FormData();
      if (values.title)       fd.append("title",       values.title);
      if (values.amount)      fd.append("amount",      String(values.amount));
      if (values.category)    fd.append("category",    values.category);
      if (values.status)      fd.append("status",      values.status);
      if (values.description !== undefined) fd.append("description", values.description ?? "");
      if (values.date)        fd.append("date",        values.date.toISOString());
      if (fileList[0]?.originFileObj) fd.append("proof", fileList[0].originFileObj);
      return incomeApi.update(id, fd);
    },
    onSuccess: () => {
      invalidate();
      message.success("Income updated");
      setEditOpen(false);
      setFileList([]);
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? "Update failed"),
  });

  const statusMutation = useMutation({
    mutationFn: (status: IncomeStatus) => {
      const fd = new FormData();
      fd.append("status", status);
      return incomeApi.update(id, fd);
    },
    onSuccess: () => { invalidate(); message.success("Status updated"); },
    onError: (e: any) => message.error(e?.response?.data?.message ?? "Failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => incomeApi.delete(id),
    onSuccess: () => {
      message.success("Income record deleted");
      router.push("/income");
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? "Delete failed"),
  });

  if (isLoading) return <Spin style={{ display: "block", margin: "80px auto" }} />;
  if (!income)   return <Text type="danger">Income record not found.</Text>;

  const cfg      = STATUS_LABELS[income.status];
  const isFounder = user?.role === "FOUNDER";
  const isImage   = income.proofType?.startsWith("image/");
  const isPdf     = income.proofType === "application/pdf";

  const openEdit = () => {
    form.setFieldsValue({
      title:       income.title,
      amount:      Number(income.amount),
      category:    income.category,
      status:      income.status,
      description: income.description,
      date:        dayjs(income.date),
    });
    setEditOpen(true);
  };

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <Button
        icon={<ArrowLeftOutlined />}
        type="link"
        style={{ paddingLeft: 0, marginBottom: 16 }}
        onClick={() => router.push("/income")}
      >
        Back to Income
      </Button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div>
          <Space style={{ marginBottom: 6 }}>
            <Tag color={cfg.color} style={{ fontWeight: 600 }}>{cfg.label}</Tag>
            <Tag>{CATEGORY_LABELS[income.category]}</Tag>
          </Space>
          <Title level={3} style={{ margin: 0 }}>{income.title}</Title>
          <Text type="secondary">
            Recorded by <Text strong>{income.recordedBy.name}</Text> · {dayjs(income.date).format("D MMM YYYY")}
          </Text>
        </div>
        <div style={{ textAlign: "right" }}>
          <Title level={2} style={{ margin: 0, color: "#52c41a" }}>
            ₹{Number(income.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </Title>
          <Space style={{ marginTop: 8 }}>
            <Button icon={<EditOutlined />} onClick={openEdit}>Edit</Button>
            {isFounder && (
              <Button icon={<DeleteOutlined />} danger onClick={() => setDeleteOpen(true)}>Delete</Button>
            )}
          </Space>
        </div>
      </div>

      {income.status === "PENDING" && (
        <Alert
          type="info"
          showIcon
          message="This income is pending — mark it as received once the payment clears."
          style={{ marginBottom: 16 }}
        />
      )}
      {income.status === "CANCELLED" && (
        <Alert type="error" showIcon message="This income entry has been cancelled." style={{ marginBottom: 16 }} />
      )}
      {income.status === "RECEIVED" && (
        <Alert type="success" showIcon message="Income received and confirmed." style={{ marginBottom: 16 }} />
      )}

      <Row gutter={24}>
        <Col xs={24} md={14}>
          <Card title="Details" style={{ marginBottom: 20 }}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Recorded By">
                <Space>
                  <Avatar size={22} style={{ fontSize: 11 }}>{income.recordedBy.name.charAt(0)}</Avatar>
                  <span>{income.recordedBy.name}</span>
                  <Tag>{income.recordedBy.role}</Tag>
                </Space>
              </Descriptions.Item>
              {income.recordedBy.department && (
                <Descriptions.Item label="Department">{income.recordedBy.department.name}</Descriptions.Item>
              )}
              <Descriptions.Item label="Income Date">{dayjs(income.date).format("D MMM YYYY")}</Descriptions.Item>
              <Descriptions.Item label="Recorded On">{dayjs(income.createdAt).format("D MMM YYYY, h:mm A")}</Descriptions.Item>
            </Descriptions>
            {income.description && (
              <>
                <Divider style={{ margin: "12px 0" }} />
                <Text type="secondary" style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>NOTES</Text>
                <Text style={{ whiteSpace: "pre-wrap" }}>{income.description}</Text>
              </>
            )}
          </Card>

          {proofUrl && (
            <Card title="Proof / Invoice" style={{ marginBottom: 20 }}>
              <Space style={{ marginBottom: 12 }}>
                {isPdf
                  ? <FilePdfOutlined style={{ color: "#f5222d", fontSize: 18 }} />
                  : <FileImageOutlined style={{ color: "#1677ff", fontSize: 18 }} />}
                <Text>{income.proofName}</Text>
                <Button size="small" onClick={() => income.proofUrl && openSecureFile(income.proofUrl)}>Open</Button>
              </Space>
              {isImage && (
                <img src={proofUrl} alt="Income proof" style={{ maxWidth: "100%", borderRadius: 8, border: "1px solid #f0f0f0" }} />
              )}
              {isPdf && (
                <iframe src={proofUrl} style={{ width: "100%", height: 400, border: "1px solid #f0f0f0", borderRadius: 8 }} title="Proof PDF" />
              )}
            </Card>
          )}
        </Col>

        <Col xs={24} md={10}>
          {income.status === "PENDING" && (
            <Card title="Actions" style={{ marginBottom: 20, borderColor: "#52c41a" }}>
              <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 12 }}>
                Confirm the payment has been received, or cancel this entry.
              </Text>
              <Space wrap>
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  loading={statusMutation.isPending}
                  onClick={() => statusMutation.mutate("RECEIVED")}
                  style={{ background: "#52c41a", borderColor: "#52c41a" }}
                >
                  Mark as Received
                </Button>
                <Button
                  danger
                  icon={<CloseCircleOutlined />}
                  loading={statusMutation.isPending}
                  onClick={() => statusMutation.mutate("CANCELLED")}
                >
                  Cancel
                </Button>
              </Space>
            </Card>
          )}
          {income.status === "RECEIVED" && (
            <Card style={{ marginBottom: 20, borderColor: "#fa8c16" }} styles={{ body: { padding: "16px 20px" } }}>
              <Text strong style={{ display: "block", marginBottom: 4 }}>Revert Status</Text>
              <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 12 }}>
                Move this back to pending if the payment needs to be re-confirmed.
              </Text>
              <Button
                loading={statusMutation.isPending}
                onClick={() => statusMutation.mutate("PENDING")}
              >
                Set Back to Pending
              </Button>
            </Card>
          )}
        </Col>
      </Row>

      {/* Edit Modal */}
      <Modal title="Edit Income" open={editOpen} onCancel={() => setEditOpen(false)} footer={null} destroyOnHidden>
        <Form form={form} layout="vertical" onFinish={updateMutation.mutate} style={{ marginTop: 16 }}>
          <Form.Item name="title" label="Title">
            <Input />
          </Form.Item>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Form.Item name="amount" label="Amount (₹)">
              <InputNumber min={0.01} precision={2} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="category" label="Category">
              <Select>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => <Option key={k} value={k}>{v}</Option>)}
              </Select>
            </Form.Item>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Form.Item name="status" label="Status">
              <Select>
                {Object.entries(STATUS_LABELS).map(([k, v]) => <Option key={k} value={k}>{v.label}</Option>)}
              </Select>
            </Form.Item>
            <Form.Item name="date" label="Date">
              <DatePicker style={{ width: "100%" }} />
            </Form.Item>
          </div>
          <Form.Item name="description" label="Notes">
            <TextArea rows={3} />
          </Form.Item>
          <Form.Item label="Replace Proof (optional)">
            <Upload
              fileList={fileList}
              beforeUpload={() => false}
              onChange={({ fileList: fl }) => setFileList(fl.slice(-1))}
              accept=".jpg,.jpeg,.png,.webp,.pdf"
              maxCount={1}
            >
              <Button icon={<UploadOutlined />}>Attach File</Button>
            </Upload>
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: "right" }}>
            <Button onClick={() => setEditOpen(false)} style={{ marginRight: 8 }}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={updateMutation.isPending}>Save</Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* Delete Confirm */}
      <Modal
        title="Delete Income Record"
        open={deleteOpen}
        onCancel={() => setDeleteOpen(false)}
        onOk={() => deleteMutation.mutate()}
        okText="Delete"
        okButtonProps={{ danger: true, loading: deleteMutation.isPending }}
      >
        <Text>Are you sure you want to permanently delete this income record? This cannot be undone.</Text>
      </Modal>
    </div>
  );
}
