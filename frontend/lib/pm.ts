import api from "./api";

export type PmProvider = "JIRA" | "YOUTRACK" | "LINEAR" | "ASANA";
export type PmConnStatus = "ACTIVE" | "ERROR" | "DISCONNECTED";
export type IssueStatus = "todo" | "in_progress" | "done" | "cancelled" | "blocked" | "review";
export type IssuePriority = "critical" | "high" | "medium" | "low" | "none";
export type IssueType = "bug" | "story" | "task" | "epic" | "subtask" | "feature" | "other";

export interface PmConnection {
  id: string;
  provider: PmProvider;
  providerHost: string;
  accountName: string;
  cloudId?: string;
  status: PmConnStatus;
  lastSyncedAt?: string;
  lastError?: string;
  createdAt: string;
}

export interface ExternalProject {
  id: string;
  key: string;
  name: string;
  url: string;
  description?: string;
}

export interface ExternalIssue {
  id: string;
  key: string;
  title: string;
  status: IssueStatus;
  priority: IssuePriority;
  type: IssueType;
  assignee?: string;
  assigneeAvatar?: string;
  reporter?: string;
  projectId: string;
  projectName: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  dueDate?: string;
  labels?: string[];
  _provider?: PmProvider;
  _connectionId?: string;
}

export const pmApi = {
  connections: () =>
    api.get<{ connections: PmConnection[] }>("/pm/connections").then((r) => r.data.connections),

  createConnection: (data: { provider: PmProvider; host: string; token: string; cloudId?: string }) =>
    api.post<{ connection: PmConnection }>("/pm/connections", data).then((r) => r.data.connection),

  deleteConnection: (id: string) =>
    api.delete(`/pm/connections/${id}`).then((r) => r.data),

  projects: (connectionId: string) =>
    api.get<{ projects: ExternalProject[] }>(`/pm/connections/${connectionId}/projects`).then((r) => r.data.projects),

  issues: (connectionId: string, projectId: string, params?: { status?: string; limit?: string; offset?: string }) =>
    api.get<{ issues: ExternalIssue[]; total: number }>(`/pm/connections/${connectionId}/projects/${projectId}/issues`, { params }).then((r) => r.data),

  allIssues: (params?: { status?: string; limit?: string }) =>
    api.get<{ issues: ExternalIssue[]; total: number; connections: { id: string; provider: PmProvider; accountName: string }[] }>("/pm/issues", { params }).then((r) => r.data),
};
