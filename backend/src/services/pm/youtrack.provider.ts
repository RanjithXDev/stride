import { IPmProvider, ExternalIssue, ExternalProject, IssueStatus, IssuePriority, IssueType } from "./provider.interface";

function mapStatus(s: string): IssueStatus {
  const lower = s.toLowerCase();
  if (lower === "fixed" || lower === "done" || lower === "resolved" || lower === "won\'t fix") return "done";
  if (lower === "in progress" || lower === "open" || lower === "in review") return "in_progress";
  if (lower === "review") return "review";
  if (lower.includes("block")) return "blocked";
  if (lower === "cancelled" || lower === "obsolete" || lower === "duplicate") return "cancelled";
  return "todo";
}

function mapPriority(p: string): IssuePriority {
  const lower = p.toLowerCase();
  if (lower === "critical") return "critical";
  if (lower === "major" || lower === "high") return "high";
  if (lower === "normal" || lower === "medium") return "medium";
  if (lower === "minor" || lower === "low") return "low";
  return "none";
}

function mapType(t: string): IssueType {
  const lower = t.toLowerCase();
  if (lower === "bug") return "bug";
  if (lower === "feature") return "feature";
  if (lower === "epic") return "epic";
  if (lower === "task") return "task";
  if (lower === "story" || lower === "user story") return "story";
  return "other";
}

export class YouTrackProvider implements IPmProvider {
  private host: string;

  constructor(host: string) {
    this.host = host.replace(/\/$/, "");
  }

  private headers(token: string) {
    return { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" };
  }

  async listProjects(token: string): Promise<ExternalProject[]> {
    const fields = "id,name,shortName,description,issues(id)";
    const res = await fetch(`${this.host}/api/admin/projects?fields=${fields}&$top=50`, {
      headers: this.headers(token),
    });
    if (!res.ok) throw new Error(`YouTrack projects failed: ${res.status}`);
    const data = await res.json() as any[];
    return data.map((p: any) => ({
      id: p.id,
      key: p.shortName,
      name: p.name,
      url: `${this.host}/projects/${p.shortName}`,
      description: p.description ?? undefined,
    }));
  }

  async listIssues(token: string, projectId: string, _cloudId?: string, opts: {
    status?: string; assignee?: string; limit?: number; offset?: number;
  } = {}): Promise<{ issues: ExternalIssue[]; total: number }> {
    const { limit = 50, offset = 0 } = opts;
    const fields = "id,idReadable,summary,description,created,updated,dueDate,customFields(name,value(name,login,avatarUrl)),tags(name)";
    const query = encodeURIComponent(`project: ${projectId}`);
    const url = `${this.host}/api/issues?query=${query}&fields=${fields}&$top=${limit}&$skip=${offset}`;
    const res = await fetch(url, { headers: this.headers(token) });
    if (!res.ok) throw new Error(`YouTrack issues failed: ${res.status}`);
    const data = await res.json() as any[];

    const issues: ExternalIssue[] = data.map((i: any): ExternalIssue => {
      const fields: Record<string, any> = {};
      for (const f of (i.customFields ?? [])) {
        fields[f.name?.toLowerCase()] = f.value;
      }
      return {
        id: i.id,
        key: i.idReadable,
        title: i.summary,
        status: mapStatus(fields["state"]?.name ?? fields["status"]?.name ?? ""),
        priority: mapPriority(fields["priority"]?.name ?? ""),
        type: mapType(fields["type"]?.name ?? ""),
        assignee: fields["assignee"]?.login ?? fields["assignee"]?.name,
        reporter: fields["reporter"]?.login,
        projectId,
        projectName: projectId,
        url: `${this.host}/issue/${i.idReadable}`,
        createdAt: i.created ? new Date(i.created).toISOString() : new Date().toISOString(),
        updatedAt: i.updated ? new Date(i.updated).toISOString() : new Date().toISOString(),
        dueDate: i.dueDate ? new Date(i.dueDate).toISOString() : undefined,
        labels: (i.tags ?? []).map((t: any) => t.name),
      };
    });
    return { issues, total: issues.length };
  }
}
