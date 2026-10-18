export type IssueStatus = "todo" | "in_progress" | "done" | "cancelled" | "blocked" | "review";
export type IssuePriority = "critical" | "high" | "medium" | "low" | "none";
export type IssueType = "bug" | "story" | "task" | "epic" | "subtask" | "feature" | "other";

export interface ExternalIssue {
  id: string;
  key: string;
  title: string;
  description?: string;
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
}

export interface ExternalProject {
  id: string;
  key: string;
  name: string;
  url: string;
  description?: string;
  issueCount?: number;
}

export interface IPmProvider {
  listProjects(token: string, cloudId?: string): Promise<ExternalProject[]>;
  listIssues(token: string, projectId: string, cloudId?: string, opts?: {
    status?: string;
    assignee?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ issues: ExternalIssue[]; total: number }>;
}
