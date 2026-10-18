import { IScmProvider, TokenResponse, ProviderUser, ProviderRepo, CreateRepoOpts, GrantResult, AccessCheckResult, GitActivityEvent, GitActivityStatus } from "./provider.interface";
import { normalizeAllowedScmHost } from "../../lib/scm-host";

const ACCESS_LEVELS: Record<string, number> = {
  VIEWER: 20,
  DEVELOPER: 30,
  MAINTAINER: 40,
  ADMIN: 50,
};

export class GitLabProvider implements IScmProvider {
  private clientId: string;
  private clientSecret: string;
  private host: string;

  constructor(host = "https://gitlab.com") {
    this.clientId = process.env.GITLAB_CLIENT_ID ?? "";
    this.clientSecret = process.env.GITLAB_CLIENT_SECRET ?? "";
    this.host = normalizeAllowedScmHost(host);
  }

  getAuthUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "api read_user",
      state,
    });
    return `${this.host}/oauth/authorize?${params}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<TokenResponse> {
    const res = await fetch(`${this.host}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });
    const data: any = await res.json();
    if (!res.ok) throw new Error(data.error_description ?? data.error ?? "GitLab token exchange failed");
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
    };
  }

  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    const res = await fetch(`${this.host}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    const data: any = await res.json();
    if (!res.ok) throw new Error(data.error_description ?? "GitLab refresh failed");
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
    };
  }

  async getAuthenticatedUser(accessToken: string): Promise<ProviderUser> {
    const res = await fetch(`${this.host}/api/v4/user`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const data: any = await res.json();
    if (!res.ok) throw new Error(data.message ?? "GitLab user fetch failed");
    return { id: String(data.id), username: data.username, email: data.email ?? undefined, avatarUrl: data.avatar_url };
  }

  async listRepositories(accessToken: string): Promise<ProviderRepo[]> {
    const res = await fetch(`${this.host}/api/v4/projects?membership=true&per_page=100&order_by=last_activity_at`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json() as any[];
    if (!res.ok) throw new Error((data as any).message ?? "GitLab repos fetch failed");
    return data.map((r: any) => ({
      id: String(r.id),
      namespace: r.namespace?.path ?? "",
      name: r.path,
      fullName: r.path_with_namespace,
      webUrl: r.web_url,
      defaultBranch: r.default_branch ?? "main",
      isPrivate: r.visibility !== "public",
    }));
  }

  async getRepository(accessToken: string, owner: string, repo: string): Promise<ProviderRepo> {
    const encodedPath = encodeURIComponent(`${owner}/${repo}`);
    const res = await fetch(`${this.host}/api/v4/projects/${encodedPath}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const r: any = await res.json();
    if (!res.ok) throw new Error(r.message ?? "GitLab repo fetch failed");
    return { id: String(r.id), namespace: r.namespace?.path ?? owner, name: r.path, fullName: r.path_with_namespace, webUrl: r.web_url, defaultBranch: r.default_branch ?? "main", isPrivate: r.visibility !== "public" };
  }

  async createRepository(accessToken: string, opts: CreateRepoOpts): Promise<ProviderRepo> {
    const body: any = { name: opts.name, visibility: opts.isPrivate ? "private" : "public", description: opts.description ?? "" };
    if (opts.namespace) body.namespace_path = opts.namespace;
    const res = await fetch(`${this.host}/api/v4/projects`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const r: any = await res.json();
    if (!res.ok) throw new Error(r.message ?? "GitLab create repo failed");
    return { id: String(r.id), namespace: r.namespace?.path ?? "", name: r.path, fullName: r.path_with_namespace, webUrl: r.web_url, defaultBranch: r.default_branch ?? "main", isPrivate: r.visibility !== "public" };
  }

  async grantAccess(accessToken: string, _owner: string, repoId: string, userId: string, permission: string): Promise<GrantResult> {
    const accessLevel = ACCESS_LEVELS[permission] ?? 30;
    const res = await fetch(`${this.host}/api/v4/projects/${repoId}/members`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, access_level: accessLevel }),
    });
    if (res.ok || res.status === 409) return "ACTIVE";
    const data: any = await res.json();
    throw new Error(data.message ?? `GitLab grant failed: ${res.status}`);
  }

  async revokeAccess(accessToken: string, _owner: string, repoId: string, userId: string): Promise<void> {
    const res = await fetch(`${this.host}/api/v4/projects/${repoId}/members/${userId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.status !== 204 && res.status !== 404) {
      throw new Error(`GitLab revoke failed: ${res.status}`);
    }
  }

  async checkAccess(accessToken: string, _owner: string, repoId: string, userId: string): Promise<AccessCheckResult | null> {
    const res = await fetch(`${this.host}/api/v4/projects/${repoId}/members/${userId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    const data: any = await res.json();
    const level = data.access_level;
    const perm = Object.entries(ACCESS_LEVELS).find(([, v]) => v === level)?.[0] ?? "DEVELOPER";
    return { permission: perm, isActive: true };
  }

  async listBranches(accessToken: string, _owner: string, repoId: string): Promise<string[]> {
    const res = await fetch(`${this.host}/api/v4/projects/${repoId}/repository/branches?per_page=100`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return [];
    const data = await res.json() as any[];
    return data.map((b: any) => b.name);
  }

  async getRecentActivity(accessToken: string, _owner: string, repoId: string, repoFullName: string, branch?: string): Promise<GitActivityEvent[]> {
    const headers = { Authorization: `Bearer ${accessToken}` };
    const events: GitActivityEvent[] = [];
    const branchParam = branch ? `&ref_name=${encodeURIComponent(branch)}` : "";

    const [commitsRes, mrsRes, pipelinesRes] = await Promise.allSettled([
      fetch(`${this.host}/api/v4/projects/${repoId}/repository/commits?per_page=15${branchParam}`, { headers }).then((r) => r.json()),
      fetch(`${this.host}/api/v4/projects/${repoId}/merge_requests?per_page=10&order_by=updated_at&sort=desc`, { headers }).then((r) => r.json()),
      fetch(`${this.host}/api/v4/projects/${repoId}/pipelines?per_page=10${branchParam}`, { headers }).then((r) => r.json()),
    ]);

    if (commitsRes.status === "fulfilled" && Array.isArray(commitsRes.value)) {
      for (const c of commitsRes.value as any[]) {
        events.push({
          id: `gl-commit-${c.id}`,
          type: "COMMIT",
          title: (c.title ?? c.message ?? "").split("\n")[0].slice(0, 80),
          author: c.author_name ?? c.committer_name ?? "unknown",
          sha: (c.short_id ?? c.id ?? "").slice(0, 7),
          url: c.web_url,
          repoFullName,
          provider: "GITLAB",
          timestamp: c.committed_date ?? c.created_at,
        });
      }
    }

    if (mrsRes.status === "fulfilled" && Array.isArray(mrsRes.value)) {
      for (const mr of mrsRes.value as any[]) {
        let status: GitActivityStatus = "open";
        if (mr.state === "merged") status = "merged";
        else if (mr.state === "closed") status = "closed";
        else if (mr.draft || mr.work_in_progress) status = "draft";
        events.push({
          id: `gl-mr-${mr.id}`,
          type: "MERGE_REQUEST",
          title: mr.title ?? "",
          description: `!${mr.iid} by ${mr.author?.username}`,
          author: mr.author?.username ?? "unknown",
          authorAvatar: mr.author?.avatar_url,
          status,
          branch: mr.source_branch,
          url: mr.web_url,
          repoFullName,
          provider: "GITLAB",
          timestamp: mr.updated_at ?? mr.created_at,
        });
      }
    }

    if (pipelinesRes.status === "fulfilled" && Array.isArray(pipelinesRes.value)) {
      for (const p of pipelinesRes.value as any[]) {
        let status: GitActivityStatus = "pending";
        if (p.status === "success") status = "success";
        else if (p.status === "failed") status = "failure";
        else if (p.status === "canceled") status = "cancelled";
        else if (p.status === "running") status = "running";
        else if (p.status === "skipped") status = "skipped";
        events.push({
          id: `gl-pipeline-${p.id}`,
          type: "PIPELINE",
          title: `Pipeline #${p.id}`,
          description: p.ref,
          author: p.user?.username ?? "unknown",
          authorAvatar: p.user?.avatar_url,
          status,
          branch: p.ref,
          sha: (p.sha ?? "").slice(0, 7),
          url: p.web_url,
          repoFullName,
          provider: "GITLAB",
          timestamp: p.updated_at ?? p.created_at,
        });
      }
    }

    return events;
  }

  async registerWebhook(accessToken: string, _owner: string, repoId: string, webhookUrl: string, secret: string): Promise<string> {
    const res = await fetch(`${this.host}/api/v4/projects/${repoId}/hooks`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        token: secret,
        push_events: true,
        merge_requests_events: true,
        pipeline_events: true,
      }),
    });
    const data: any = await res.json();
    if (!res.ok) throw new Error(data.message ?? `GitLab webhook registration failed: ${res.status}`);
    return String(data.id);
  }

  async deleteWebhook(accessToken: string, _owner: string, repoId: string, hookId: string): Promise<void> {
    const res = await fetch(`${this.host}/api/v4/projects/${repoId}/hooks/${hookId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.status !== 204 && res.status !== 404 && res.status !== 204) {
      const data: any = await res.json().catch(() => ({}));
      throw new Error(data.message ?? `GitLab webhook deletion failed: ${res.status}`);
    }
  }
}

export function getGitLabProvider(host?: string): GitLabProvider {
  return new GitLabProvider(host ?? "https://gitlab.com");
}
