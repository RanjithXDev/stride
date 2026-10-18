import api from "./api";
import { User, Role } from "@/types";

export interface EmployeeFilters {
  departmentId?: string;
  role?: Role;
  isActive?: boolean;
  search?: string;
}

export interface EmployeeListItem extends User {
  manager?: { id: string; name: string } | null;
  _count?: { assignedTickets: number; reportedTickets: number };
}

export interface CreateEmployeePayload {
  name: string;
  email: string;
  password: string;
  role?: Role;
  departmentId?: string;
  managerId?: string;
}

export interface UpdateEmployeePayload {
  name?: string;
  role?: Role;
  departmentId?: string;
  managerId?: string;
  isActive?: boolean;
}

export interface Department {
  id: string;
  name: string;
  _count: { employees: number };
}

export interface OrgNode {
  id: string;
  name: string;
  role: Role;
  managerId: string | null;
  avatar: string | null;
  department: { id: string; name: string } | null;
  children: OrgNode[];
}

export const employeesApi = {
  list: (filters?: EmployeeFilters) =>
    api.get<EmployeeListItem[]>("/employees", { params: filters }).then((r) => r.data),

  get: (id: string) =>
    api.get<any>(`/employees/${id}`).then((r) => r.data),

  create: (payload: CreateEmployeePayload) =>
    api.post<User>("/employees", payload).then((r) => r.data),

  update: (id: string, payload: UpdateEmployeePayload) =>
    api.put<User>(`/employees/${id}`, payload).then((r) => r.data),

  departments: () =>
    api.get<Department[]>("/employees/departments/all").then((r) => r.data),

  createDepartment: (name: string) =>
    api.post<Department>("/employees/departments", { name }).then((r) => r.data),

  orgTree: () =>
    api.get<OrgNode[]>("/employees/org-tree").then((r) => r.data),

  remove: (id: string) =>
    api.delete(`/employees/${id}`).then((r) => r.data),
};
