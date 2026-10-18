"use client";
import { Modal, Form, Input, Select, DatePicker, Button, message, InputNumber, Avatar, Space } from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ticketsApi } from "@/lib/tickets";
import { employeesApi } from "@/lib/employees";
import { projectsApi } from "@/lib/projects";
import { CreateTicketPayload } from "@/types";

const { TextArea } = Input;
const { Option } = Select;

interface Props {
  open: boolean;
  onClose: () => void;
  projectId?: string;
}

export default function CreateTicketModal({ open, onClose, projectId }: Props) {
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const { data: employees = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: () => employeesApi.list({ isActive: true }),
    enabled: open,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => projectsApi.list(),
    enabled: open && !projectId,
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (values: any) =>
      ticketsApi.create({
        ...values,
        projectId: projectId ?? values.projectId,
        dueDate: values.dueDate?.toISOString(),
        estimation: values.estimation ?? undefined,
      } as CreateTicketPayload),
    onSuccess: () => {
      message.success("Ticket created");
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      form.resetFields();
      onClose();
    },
    onError: () => message.error("Failed to create ticket"),
  });

  return (
    <Modal
      title="Create Ticket"
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnClose
      width={560}
    >
      <Form form={form} layout="vertical" onFinish={mutate} style={{ marginTop: 16 }}>
        <Form.Item name="title" label="Title" rules={[{ required: true, message: "Title is required" }]}>
          <Input placeholder="Short description of the issue or task" />
        </Form.Item>

        <Form.Item name="description" label="Description">
          <TextArea rows={3} placeholder="Detailed description, steps to reproduce, acceptance criteria..." />
        </Form.Item>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Form.Item name="type" label="Type" initialValue="TASK">
            <Select>
              <Option value="TASK">Task</Option>
              <Option value="BUG">Bug</Option>
              <Option value="FEATURE">Feature</Option>
              <Option value="IMPROVEMENT">Improvement</Option>
            </Select>
          </Form.Item>
          <Form.Item name="priority" label="Priority" initialValue="MEDIUM">
            <Select>
              <Option value="LOW">Low</Option>
              <Option value="MEDIUM">Medium</Option>
              <Option value="HIGH">High</Option>
              <Option value="CRITICAL">Critical</Option>
            </Select>
          </Form.Item>
        </div>

        <Form.Item name="assigneeId" label="Assign To">
          <Select
            showSearch
            allowClear
            placeholder="Search and assign an employee..."
            optionFilterProp="label"
            options={employees.map((e) => ({
              value: e.id,
              label: `${e.name} — ${e.role}${e.department ? ` · ${(e as any).department?.name}` : ""}`,
              name: e.name,
              role: e.role,
              dept: (e as any).department?.name,
            }))}
            optionRender={(opt) => (
              <Space>
                <Avatar size={22} style={{ background: "#1677ff", fontSize: 11, flexShrink: 0 }}>
                  {String(opt.data.name).charAt(0)}
                </Avatar>
                <div>
                  <div style={{ fontWeight: 500, fontSize: 13 }}>{opt.data.name}</div>
                  <div style={{ fontSize: 11, color: "#888" }}>
                    {opt.data.role}{opt.data.dept ? ` · ${opt.data.dept}` : ""}
                  </div>
                </div>
              </Space>
            )}
          />
        </Form.Item>

        {!projectId && (
          <Form.Item name="projectId" label="Project">
            <Select allowClear placeholder="Link to a project (optional)" showSearch optionFilterProp="children">
              {projects.map((p) => (
                <Option key={p.id} value={p.id}>{p.name}</Option>
              ))}
            </Select>
          </Form.Item>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Form.Item name="estimation" label="Dev Estimation (hours)">
            <InputNumber
              min={0.5} step={0.5} precision={1}
              style={{ width: "100%" }}
              placeholder="e.g. 4"
              addonAfter="hrs"
            />
          </Form.Item>
          <Form.Item name="dueDate" label="Deadline">
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
        </div>

        <Form.Item style={{ marginBottom: 0, textAlign: "right" }}>
          <Button onClick={onClose} style={{ marginRight: 8 }}>Cancel</Button>
          <Button type="primary" htmlType="submit" loading={isPending}>Create Ticket</Button>
        </Form.Item>
      </Form>
    </Modal>
  );
}
