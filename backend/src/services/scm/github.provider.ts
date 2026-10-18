import { IScmProvider, TokenResponse, ProviderUser, ProviderRepo, CreateRepoOpts, GrantResult, AccessCheckResult, GitActivityEvent, GitActivityStatus } from "./provider.interface";

const GH_API = "https://api.github.com";

const PERM_MAP: Record<string, string> = {
  VIEWER: "pull",
  DEVELOPER: "push",
  MAINTAINER: "maintain",
  ADMIN: "admin",
};

async function ghFetch(url: string, opts: RequestInit = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: {
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(opts.headers ?? {}),
    },
  });
  return res;
}

export class GitHubProvider implements IScmProvider {
  private clientId: string;
  private clientSecret: string;

  constructor(clientId?: string, clientSecret?: string) {
    this.clientId = clientId ?? process.env.GITHUB_CLIENT_ID ?? "";
    this.clientSecret = clientSecret ?? process.env.GITHUB_CLIENT_SECRET ?? "";
  }

  getAuthUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      scope: "repo,read:org,read:user,user:email",
      state,
    });
    return `https://github.com/login/oauth/authorize?${params}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<TokenResponse> {
    const res = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Accept": "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: this.clientId, client_secret: this.clientSecret, code, redirect_uri: redirectUri }),
    });
    const data: any = await res.json();
    if (data.error) throw new Error(data.error_description ?? data.error);
    return { accessToken: data.access_token, tokenType: data.token_type };
  }

  async refreshToken(_refreshToken: string): Promise<TokenResponse> {
    throw new Error("GitHub OAuth Apps do not support token refresh");
  }

  async getAuthenticatedUser(accessToken: string): Promise<ProviderUser> {
    const res = await ghFetch(`${GH_API}/user`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const data: any = await res.json();
    if (!res.ok) throw new Error(data.message ?? "GitHub user fetch failed");
    return { id: String(data.id), username: data.login, email: data.email ?? undefined, avatarUrl: data.avatar_url };
  }

  async listRepositories(accessToken: string): Promise<ProviderRepo[]> {
    const res = await ghFetch(`${GH_API}/user/repos?type=all&per_page=100&sort=updated`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await res.json() as any[];
    if (!res.ok) throw new Error((data as any).message ?? "GitHub repos fetch failed");
    return data.map((r: any) => ({
      id: String(r.id),
      namespace: r.owner.login,
      name: r.name,
      fullName: r.full_name,
      webUrl: r.html_url,
      defaultBranch: r.default_branch ?? "main",
      isPrivate: r.private,
      cloneUrl: r.clone_url,
    }));
  }

  async getRepository(accessToken: string, owner: string, repo: string): Promise<ProviderRepo> {
    const res = await ghFetch(`${GH_API}/repos/${owner}/${repo}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const r: any = await res.json();
    if (!res.ok) throw new Error(r.message ?? "GitHub repo fetch failed");
    return { id: String(r.id), namespace: r.owner.login, name: r.name, fullName: r.full_name, webUrl: r.html_url, defaultBranch: r.default_branch ?? "main", isPrivate: r.private, cloneUrl: r.clone_url };
  }

  async createRepository(accessToken: string, opts: CreateRepoOpts): Promise<ProviderRepo> {
    const body: any = { name: opts.name, private: opts.isPrivate ?? true, description: opts.description ?? "" };
    const endpoint = opts.namespace ? `${GH_API}/orgs/${opts.namespace}/repos` : `${GH_API}/user/repos`;
    const res = await ghFetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const r: any = await res.json();
    if (!res.ok) throw new Error(r.message ?? "GitHub create repo failed");
    return { id: String(r.id), namespace: r.owner.login, name: r.name, fullName: r.full_name, webUrl: r.html_url, defaultBranch: r.default_branch ?? "main", isPrivate: r.private };
  }

  async grantAccess(accessToken: string, owner: string, repo: string, username: string, permission: string): Promise<GrantResult> {
    const ghPerm = PERM_MAP[permission] ?? "push";
    const res = await ghFetch(`${GH_API}/repos/${owner}/${repo}/collaborators/${username}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ permission: ghPerm }),
    });
    if (res.status === 201) return "INVITATION_PENDING";
    if (res.status === 204) return "ACTIVE";
    const data: any = await res.json();
    throw new Error(data.message ?? `GitHub grant failed: ${res.status}`);
  }

  async revokeAccess(accessToken: string, owner: string, repo: string, username: string): Promise<void> {
    const res = await ghFetch(`${GH_API}/repos/${owner}/${repo}/collaborators/${username}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.status !== 204 && res.status !== 404) {
      const data: any = await res.json();
      throw new Error(data.message ?? `GitHub revoke failed: ${res.status}`);
    }
  }

  async checkAccess(accessToken: string, owner: string, repo: string, username: string): Promise<AccessCheckResult | null> {
    const res = await ghFetch(`${GH_API}/repos/${owner}/${repo}/collaborators/${username}/permission`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    const data: any = await res.json();
    return { permission: data.permission, isActive: true };
  }

  async listBranches(accessToken: string, owner: string, repo: string): Promise<string[]> {
    const res = await ghFetch(`${GH_API}/repos/${owner}/${repo}/branches?per_page=100`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return [];
    const data = await res.json() as any[];
    return data.map((b: any) => b.name);
  }

  async getRecentActivity(accessToken: string, owner: string, repo: string, repoFullName: string, branch?: string): Promise<GitActivityEvent[]> {
    const headers = { Authorization: `Bearer ${accessToken}` };
    const events: GitActivityEvent[] = [];
    const branchParam = branch ? `&sha=${encodeURIComponent(branch)}` : "";
    const branchRunParam = branch ? `&branch=${encodeURIComponent(branch)}` : "";

    const [commitsRes, prsRes, runsRes] = await Promise.allSettled([
      ghFetch(`${GH_API}/repos/${owner}/${repo}/commits?per_page=15${branchParam}`, { headers }).then((r) => r.json()),
      ghFetch(`${GH_API}/repos/${owner}/${repo}/pulls?state=all&per_page=10&sort=updated`, { headers }).then((r) => r.json()),
      ghFetch(`${GH_API}/repos/${owner}/${repo}/actions/runs?per_page=10${branchRunParam}`, { headers }).then((r) => r.json()),
    ]);

    if (commitsRes.status === "fulfilled" && Array.isArray(commitsRes.value)) {
      for (const c of commitsRes.value as any[]) {
        events.push({
          id: `gh-commit-${c.sha}`,
          type: "COMMIT",
          title: (c.commit?.message ?? "").split("\n")[0].slice(0, 80),
          author: c.commit?.author?.name ?? c.author?.login ?? "unknown",
          authorAvatar: c.author?.avatar_url,
          sha: c.sha?.slice(0, 7),
          branch: undefined,
          url: c.html_url,
          repoFullName,
          provider: "GITHUB",
          timestamp: c.commit?.author?.date ?? new Date().toISOString(),
        });
      }
    }

    if (prsRes.status === "fulfilled" && Array.isArray(prsRes.value)) {
      for (const pr of prsRes.value as any[]) {
        let status: GitActivityStatus = "open";
        if (pr.merged_at) status = "merged";
        else if (pr.state === "closed") status = "closed";
        else if (pr.draft) status = "draft";
        events.push({
          id: `gh-pr-${pr.id}`,
          type: "PULL_REQUEST",
          title: pr.title ?? "",
          description: `#${pr.number} by ${pr.user?.login}`,
          author: pr.user?.login ?? "unknown",
          authorAvatar: pr.user?.avatar_url,
          status,
          branch: pr.head?.ref,
          url: pr.html_url,
          repoFullName,
          provider: "GITHUB",
          timestamp: pr.updated_at ?? pr.created_at,
        });
      }
    }

    if (runsRes.status === "fulfilled" && (runsRes.value as any)?.workflow_runs) {
      for (const run of (runsRes.value as any).workflow_runs as any[]) {
        let status: GitActivityStatus = "pending";
        if (run.conclusion === "success") status = "success";
        else if (run.conclusion === "failure") status = "failure";
        else if (run.conclusion === "cancelled") status = "cancelled";
        else if (run.conclusion === "skipped") status = "skipped";
        else if (run.status === "in_progress") status = "running";
        events.push({
          id: `gh-run-${run.id}`,
          type: "CI_RUN",
          title: run.name ?? run.display_title ?? "Workflow Run",
          description: run.display_title,
          author: run.triggering_actor?.login ?? "unknown",
          authorAvatar: run.triggering_actor?.avatar_url,
          status,
          branch: run.head_branch,
          sha: run.head_sha?.slice(0, 7),
          url: run.html_url,
          repoFullName,
          provider: "GITHUB",
          timestamp: run.updated_at ?? run.created_at,
        });
      }
    }

    return events;
  }

  async registerWebhook(accessToken: string, owner: string, repo: string, webhookUrl: string, secret: string): Promise<string> {
    const res = await ghFetch(`${GH_API}/repos/${owner}/${repo}/hooks`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "web",
        active: true,
        events: ["push", "pull_request", "workflow_run"],
        config: { url: webhookUrl, content_type: "json", secret },
      }),
    });
    const data: any = await res.json();
    if (!res.ok) throw new Error(data.message ?? `GitHub webhook registration failed: ${res.status}`);
    return String(data.id);
  }

  async deleteWebhook(accessToken: string, owner: string, repo: string, hookId: string): Promise<void> {
    const res = await ghFetch(`${GH_API}/repos/${owner}/${repo}/hooks/${hookId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.status !== 204 && res.status !== 404) {
      const data: any = await res.json().catch(() => ({}));
      throw new Error(data.message ?? `GitHub webhook deletion failed: ${res.status}`);
    }
  }
}
