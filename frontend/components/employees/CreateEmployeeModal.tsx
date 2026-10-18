"use client";
import { Modal, Form, Input, Select, Button, message } from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { employeesApi, CreateEmployeePayload } from "@/lib/employees";

const { Option } = Select;

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function CreateEmployeeModal({ open, onClose }: Props) {
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: () => employeesApi.departments(),
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: () => employeesApi.list(),
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (values: CreateEmployeePayload) => employeesApi.create(values),
    onSuccess: () => {
      message.success("Employee created");
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      form.resetFields();
      onClose();
    },
    onError: (err: any) =>
      message.error(err?.response?.data?.message ?? "Failed to create employee"),
  });

  return (
    <Modal title="Add Employee" open={open} onCancel={onClose} footer={null} destroyOnClose>
      <Form form={form} layout="vertical" onFinish={mutate} style={{ marginTop: 16 }}>
        <Form.Item name="name" label="Full Name" rules={[{ required: true }]}>
          <Input placeholder="Jane Smith" />
        </Form.Item>
        <Form.Item name="email" label="Email" rules={[{ required: true, type: "email" }]}>
          <Input placeholder="jane@company.com" />
        </Form.Item>
        <Form.Item name="password" label="Temporary Password" rules={[{ required: true, min: 6 }]}>
          <Input.Password placeholder="Min 6 characters" />
        </Form.Item>
        <Form.Item name="role" label="Role" initialValue="EMPLOYEE">
          <Select>
            <Option value="EMPLOYEE">Employee</Option>
            <Option value="TEAM_LEAD">Team Lead</Option>
            <Option value="MANAGER">Manager</Option>
            <Option value="CFO">CFO</Option>
            <Option value="FOUNDER">Founder</Option>
          </Select>
        </Form.Item>
        <Form.Item name="departmentId" label="Department">
          <Select allowClear placeholder="Select department">
            {departments.map((d) => (
              <Option key={d.id} value={d.id}>{d.name}</Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item name="managerId" label="Manager">
          <Select allowClear placeholder="Select manager" showSearch optionFilterProp="children">
            {employees
              .filter((e) => ["MANAGER", "FOUNDER", "TEAM_LEAD"].includes(e.role))
              .map((e) => (
                <Option key={e.id} value={e.id}>{e.name}</Option>
              ))}
          </Select>
        </Form.Item>
        <Form.Item style={{ marginBottom: 0, textAlign: "right" }}>
          <Button onClick={onClose} style={{ marginRight: 8 }}>Cancel</Button>
          <Button type="primary" htmlType="submit" loading={isPending}>Add Employee</Button>
        </Form.Item>
      </Form>
    </Modal>
  );
}
