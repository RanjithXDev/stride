import { IPmProvider, ExternalIssue, ExternalProject, IssueStatus, IssuePriority, IssueType } from "./provider.interface";

function mapStatus(s: string): IssueStatus {
  const lower = s.toLowerCase();
  if (lower.includes("done") || lower.includes("closed") || lower.includes("resolved")) return "done";
  if (lower.includes("progress") || lower.includes("active") || lower.includes("started")) return "in_progress";
  if (lower.includes("review") || lower.includes("testing")) return "review";
  if (lower.includes("block")) return "blocked";
  if (lower.includes("cancel") || lower.includes("wont")) return "cancelled";
  return "todo";
}

function mapPriority(p: string): IssuePriority {
  const lower = p.toLowerCase();
  if (lower === "critical" || lower === "blocker") return "critical";
  if (lower === "high" || lower === "major") return "high";
  if (lower === "medium" || lower === "normal") return "medium";
  if (lower === "low" || lower === "minor") return "low";
  return "none";
}

function mapType(t: string): IssueType {
  const lower = t.toLowerCase();
  if (lower === "bug") return "bug";
  if (lower === "story" || lower === "user story") return "story";
  if (lower === "epic") return "epic";
  if (lower === "sub-task" || lower === "subtask") return "subtask";
  if (lower === "feature" || lower === "new feature") return "feature";
  if (lower === "task") return "task";
  return "other";
}

export class JiraProvider implements IPmProvider {
  private host: string;

  constructor(host = "https://api.atlassian.com") {
    this.host = host.replace(/\/$/, "");
  }

  private headers(token: string) {
    return { Authorization: `Basic ${token}`, "Content-Type": "application/json", Accept: "application/json" };
  }

  private base(cloudId?: string) {
    return cloudId ? `${this.host}/ex/jira/${cloudId}/rest/api/3` : `${this.host}/rest/api/3`;
  }

  async listProjects(token: string, cloudId?: string): Promise<ExternalProject[]> {
    const url = `${this.base(cloudId)}/project/search?maxResults=50&orderBy=name`;
    const res = await fetch(url, { headers: this.headers(token) });
    if (!res.ok) {
      const err: any = await res.json().catch(() => ({}));
      throw new Error(err?.message ?? `Jira projects failed: ${res.status}`);
    }
    const data: any = await res.json();
    return (data.values ?? data.projects ?? []).map((p: any) => ({
      id: p.id,
      key: p.key,
      name: p.name,
      url: `${p.self?.split("/rest")[0]}/browse/${p.key}`,
      description: p.description ?? undefined,
    }));
  }

  async listIssues(token: string, projectId: string, cloudId?: string, opts: {
    status?: string; assignee?: string; limit?: number; offset?: number;
  } = {}): Promise<{ issues: ExternalIssue[]; total: number }> {
    const { limit = 50, offset = 0, status, assignee } = opts;
    let jql = `project = "${projectId}" ORDER BY updated DESC`;
    if (status) jql = `project = "${projectId}" AND status = "${status}" ORDER BY updated DESC`;
    if (assignee) jql += ` AND assignee = "${assignee}"`;

    const url = `${this.base(cloudId)}/search`;
    const res = await fetch(url, {
      method: "POST",
      headers: this.headers(token),
      body: JSON.stringify({
        jql,
        maxResults: limit,
        startAt: offset,
        fields: ["summary", "description", "status", "priority", "issuetype", "assignee", "reporter",
          "project", "created", "updated", "duedate", "labels"],
      }),
    });
    if (!res.ok) {
      const err: any = await res.json().catch(() => ({}));
      throw new Error(err?.errorMessages?.[0] ?? err?.message ?? `Jira issues failed: ${res.status}`);
    }
    const data: any = await res.json();
    const issues: ExternalIssue[] = (data.issues ?? []).map((i: any): ExternalIssue => ({
      id: i.id,
      key: i.key,
      title: i.fields.summary,
      status: mapStatus(i.fields.status?.name ?? ""),
      priority: mapPriority(i.fields.priority?.name ?? ""),
      type: mapType(i.fields.issuetype?.name ?? ""),
      assignee: i.fields.assignee?.displayName,
      assigneeAvatar: i.fields.assignee?.avatarUrls?.["24x24"],
      reporter: i.fields.reporter?.displayName,
      projectId: i.fields.project?.id,
      projectName: i.fields.project?.name ?? projectId,
      url: `${i.self?.split("/rest")[0]}/browse/${i.key}`,
      createdAt: i.fields.created,
      updatedAt: i.fields.updated,
      dueDate: i.fields.duedate ?? undefined,
      labels: i.fields.labels ?? [],
    }));
    return { issues, total: data.total ?? issues.length };
  }
}
