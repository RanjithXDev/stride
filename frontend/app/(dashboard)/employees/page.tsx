"use client";
import { useDeferredValue, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar, Badge, Button, Input, Popconfirm, Select, Table, Tag, Tooltip, message } from "antd";
import type { TableColumnsType } from "antd";
import { DeleteOutlined, PlusOutlined, SearchOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import { EmployeeFilters, EmployeeListItem, employeesApi } from "@/lib/employees";
import { Role } from "@/types";
import { useAuthStore } from "@/store/auth";
import CreateEmployeeModal from "@/components/employees/CreateEmployeeModal";
import { FilterBar, MetricGrid, MetricTile, PageEmpty, PageError, PageHeader } from "@/components/ui/AppPage";
import styles from "./employees.module.css";

const { Option } = Select;
const roleColors: Record<Role, string> = { FOUNDER: "purple", CPO: "magenta", CFO: "green", HR: "cyan", MANAGER: "blue", TEAM_LEAD: "geekblue", EMPLOYEE: "default" };
const roles: Array<{ value: Role; label: string }> = [
  { value: "FOUNDER", label: "Founder" }, { value: "CPO", label: "CPO" }, { value: "CFO", label: "CFO" }, { value: "HR", label: "HR Manager" }, { value: "MANAGER", label: "Manager" }, { value: "TEAM_LEAD", label: "Team Lead" }, { value: "EMPLOYEE", label: "Employee" },
];

export default function EmployeesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [filters, setFilters] = useState<EmployeeFilters>({});
  const [createOpen, setCreateOpen] = useState(false);
  const deferredFilters = useDeferredValue(filters);
  const { data: employees = [], isLoading, isError, refetch } = useQuery({ queryKey: ["employees", deferredFilters], queryFn: () => employeesApi.list(deferredFilters) });
  const { data: departments = [] } = useQuery({ queryKey: ["departments"], queryFn: employeesApi.departments });
  const canManage = ["FOUNDER", "CPO", "HR", "MANAGER"].includes(user?.role ?? "");
  const canRemove = ["FOUNDER", "CPO", "MANAGER"].includes(user?.role ?? "") || Boolean(user?.isSuperAdmin);
  const hasFilters = Boolean(filters.search || filters.departmentId || filters.role || filters.isActive !== undefined);
  const removeMutation = useMutation({ mutationFn: employeesApi.remove, onSuccess: () => { message.success("Employee deactivated"); queryClient.invalidateQueries({ queryKey: ["employees"] }); }, onError: (error: { response?: { data?: { message?: string } } }) => message.error(error.response?.data?.message ?? "Failed to remove employee") });

  const columns: TableColumnsType<EmployeeListItem> = [
    { title: "Employee", key: "name", render: (_, record) => <div className={styles.person}><Avatar className={styles.avatar}>{record.name.charAt(0).toUpperCase()}</Avatar><div><strong>{record.name}</strong><span>{record.jobTitle || record.email}</span></div></div> },
    { title: "Role", dataIndex: "role", key: "role", width: 120, render: (role: Role) => <Tag color={roleColors[role]}>{role.replaceAll("_", " ")}</Tag> },
    { title: "Department", key: "department", width: 150, render: (_, record) => record.department?.name ?? <span className={styles.muted}>Unassigned</span> },
    { title: "Manager", key: "manager", width: 150, render: (_, record) => record.manager?.name ?? <span className={styles.muted}>Not assigned</span> },
    { title: "Tickets", key: "tickets", width: 80, render: (_, record) => <Tooltip title="Assigned tickets">{record._count?.assignedTickets ?? 0}</Tooltip> },
    { title: "Status", dataIndex: "isActive", key: "isActive", width: 95, render: (active: boolean) => <Badge status={active ? "success" : "default"} text={active ? "Active" : "Inactive"} /> },
    ...(canRemove ? [{ title: "", key: "actions", width: 56, render: (_: unknown, record: EmployeeListItem) => { const isSelf = record.id === user?.id; return <Popconfirm title="Deactivate employee?" description={`${record.name} will lose access and be removed from the org chart.`} okText="Deactivate" okButtonProps={{ danger: true }} disabled={isSelf} onConfirm={(event) => { event?.stopPropagation(); removeMutation.mutate(record.id); }} onCancel={(event) => event?.stopPropagation()}><Tooltip title={isSelf ? "You cannot deactivate yourself" : "Deactivate employee"}><Button aria-label={`Deactivate ${record.name}`} size="small" danger type="text" icon={<DeleteOutlined />} disabled={isSelf || !record.isActive} loading={removeMutation.isPending && removeMutation.variables === record.id} onClick={(event) => event.stopPropagation()} /></Tooltip></Popconfirm>; } }] : []),
  ];
  const active = employees.filter((employee) => employee.isActive).length;
  const leadership = employees.filter((employee) => ["FOUNDER", "CPO", "CFO", "HR", "MANAGER", "TEAM_LEAD"].includes(employee.role)).length;

  return <div className={styles.page}>
    <PageHeader eyebrow="People directory" title="Employees" description="Find teammates, understand ownership, and manage access across your organization." action={canManage ? <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>Add Employee</Button> : undefined} />
    <MetricGrid><MetricTile label="Active" value={active} color="#16a34a" hint="Can access the workspace" /><MetricTile label="Departments" value={departments.length} color="#1677ff" hint="Organizational teams" /><MetricTile label="Leadership" value={leadership} color="#8b5cf6" hint="Leads and managers" /><MetricTile label="Total" value={employees.length} color="#0f766e" hint={hasFilters ? "Matching current filters" : "Visible to you"} /></MetricGrid>
    <FilterBar resultLabel={`${employees.length} employee${employees.length === 1 ? "" : "s"}`} hasFilters={hasFilters} onClear={() => setFilters({})}>
      <Input prefix={<SearchOutlined />} placeholder="Search name or email…" value={filters.search} onChange={(event) => setFilters((value) => ({ ...value, search: event.target.value || undefined }))} allowClear style={{ width: 230 }} />
      <Select placeholder="Department" value={filters.departmentId} onChange={(value) => setFilters((current) => ({ ...current, departmentId: value }))} allowClear style={{ width: 170 }}>{departments.map((department) => <Option key={department.id} value={department.id}>{department.name} ({department._count.employees})</Option>)}</Select>
      <Select placeholder="Role" value={filters.role} onChange={(value) => setFilters((current) => ({ ...current, role: value }))} allowClear style={{ width: 140 }}>{roles.map((role) => <Option key={role.value} value={role.value}>{role.label}</Option>)}</Select>
      <Select placeholder="Status" value={filters.isActive === undefined ? undefined : String(filters.isActive)} onChange={(value) => setFilters((current) => ({ ...current, isActive: value === undefined ? undefined : value === "true" }))} allowClear style={{ width: 120 }}><Option value="true">Active</Option><Option value="false">Inactive</Option></Select>
    </FilterBar>
    {isError ? <PageError onRetry={() => refetch()} /> : !isLoading && employees.length === 0 ? <PageEmpty title={hasFilters ? "No employees match these filters" : "No employees yet"} description={hasFilters ? "Try changing or clearing the current filters." : "Add the first employee to start building your organization."} action={hasFilters ? <Button onClick={() => setFilters({})}>Clear filters</Button> : undefined} /> : <Table<EmployeeListItem> className={styles.table} dataSource={employees} columns={columns} rowKey="id" loading={isLoading} size="middle" pagination={{ pageSize: 20, showSizeChanger: false, hideOnSinglePage: true }} onRow={(record) => ({ onClick: () => router.push(`/employees/${record.id}`), onKeyDown: (event) => { if (event.key === "Enter") router.push(`/employees/${record.id}`); }, tabIndex: 0, style: { cursor: "pointer" } })} />}
    <CreateEmployeeModal open={createOpen} onClose={() => setCreateOpen(false)} />
  </div>;
}
