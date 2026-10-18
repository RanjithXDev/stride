import api from "./api";
import { ProjectStatus } from "@/types";

export interface ProjectFilters {
  status?: ProjectStatus;
  departmentId?: string;
  search?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string | null;
  status: ProjectStatus;
  startDate?: string | null;
  deadline?: string | null;
  createdAt: string;
  updatedAt: string;
  department?: { id: string; name: string } | null;
  _count: { tickets: number; members: number; timeLogs: number };
}

export interface ProjectMember {
  role: string;
  joinedAt: string;
  user: { id: string; name: string; email: string; role: string; avatar?: string | null; department?: { id: string; name: string } | null };
}

export interface ProjectDetail extends Project {
  members: ProjectMember[];
  tickets: Array<{
    id: string; title: string; status: string; priority: string; type: string;
    assignee?: { id: string; name: string } | null; updatedAt: string;
  }>;
}

export interface CreateProjectPayload {
  name: string;
  description?: string;
  status?: ProjectStatus;
  startDate?: string;
  deadline?: string;
  departmentId?: string;
}

export const projectsApi = {
  list: (filters?: ProjectFilters) =>
    api.get<Project[]>("/projects", { params: filters }).then((r) => r.data),

  get: (id: string) =>
    api.get<ProjectDetail>(`/projects/${id}`).then((r) => r.data),

  create: (payload: CreateProjectPayload) =>
    api.post<Project>("/projects", payload).then((r) => r.data),

  update: (id: string, payload: Partial<CreateProjectPayload>) =>
    api.put<Project>(`/projects/${id}`, payload).then((r) => r.data),

  delete: (id: string) => api.delete(`/projects/${id}`),

  addMember: (id: string, userId: string, role?: string) =>
    api.post(`/projects/${id}/members`, { userId, role }).then((r) => r.data),

  removeMember: (id: string, userId: string) =>
    api.delete(`/projects/${id}/members/${userId}`),

  stats: (id: string) =>
    api.get<any>(`/projects/${id}/stats`).then((r) => r.data),
};
