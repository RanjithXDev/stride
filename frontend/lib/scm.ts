import api from "./api";
import { ProviderRepo } from "@/types";

export interface ScmRepo {
  id: string;
  connectionId: string;
  externalId: string;
  namespace: string;
  name: string;
  fullName: string;
  webUrl: string;
  defaultBranch: string;
  isPrivate: boolean;
  isTracked: boolean;
  syncStatus: string;
  lastSyncedAt?: string;
  connection: { provider: "GITHUB" | "GITLAB"; providerHost: string; accountName: string; status: string };
  webhooks?: { id: string; active: boolean; lastDeliveryAt?: string }[];
}

export type GitActivityType = "COMMIT" | "PULL_REQUEST" | "MERGE_REQUEST" | "CI_RUN" | "PIPELINE";
export type GitActivityStatus =
  | "success" | "failure" | "running" | "pending" | "cancelled" | "skipped"
  | "open" | "merged" | "closed" | "draft";

export interface GitActivityEvent {
  id: string;
  type: GitActivityType;
  title: string;
  description?: string;
  author: string;
  authorAvatar?: string;
  status?: GitActivityStatus;
  branch?: string;
  sha?: string;
  url: string;
  repoFullName: string;
  provider: "GITHUB" | "GITLAB";
  timestamp: string;
  repoId?: string;
}

export interface PipelineRow {
  repo: { id: string; name: string; fullName: string; webUrl: string; provider: string };
  latest: GitActivityEvent | null;
}

export interface ScmStats {
  contributors: { author: string; avatar?: string; commits: number; prs: number }[];
  repoCount: number;
  totalCommits: number;
  totalPRs: number;
  openPRs: number;
}

export interface RepoMember {
  user: { id: string; name: string; email: string; role: string; avatar?: string };
  grant: {
    id: string; requestedPermission: string; actualPermission?: string;
    status: string; grantedAt?: string; revokedAt?: string;
    employeeIdentity?: { id: string; username: string } | null;
  } | null;
  identity: { id: string; username: string; providerUserId: string } | null;
}

export interface ScmAnalytics {
  contributors: { author: string; avatar?: string; commits: number; prsOpened: number; prsMerged: number }[];
  byRepo: { repoId: string; fullName: string; commits: number; prsOpen: number; prsTotal: number }[];
  totalCommits: number;
  totalPRs: number;
  openPRs: number;
  avgPRAgeDays: number;
}

export const scmApi = {
  repos: () =>
    api.get<{ repos: ScmRepo[] }>("/scm/repos").then((r) => r.data.repos),

  trackRepos: (connectionId: string, repoIds: string[]) =>
    api.post("/scm/repos/track", { connectionId, repoIds }).then((r) => r.data),

  untrackRepo: (id: string) =>
    api.delete(`/scm/repos/${id}/untrack`).then((r) => r.data),

  getRepo: (id: string) =>
    api.get<ScmRepo>(`/scm/repos/${id}`).then((r) => r.data),

  availableRepos: (connectionId: string) =>
    api
      .get<{ available: ProviderRepo[]; tracked: ProviderRepo[] }>(`/scm/connections/${connectionId}/available-repos`)
      .then((r) => r.data),

  activity: (params?: Record<string, string>) =>
    api
      .get<{ events: GitActivityEvent[]; total: number }>("/scm/activity", { params })
      .then((r) => r.data),

  prs: (params?: Record<string, string>) =>
    api
      .get<{ prs: (GitActivityEvent & { repoId: string })[]; total: number }>("/scm/prs", { params })
      .then((r) => r.data),

  pipelines: () =>
    api
      .get<{ pipelines: PipelineRow[]; summary: { passing: number; failing: number; running: number; total: number } }>("/scm/pipelines")
      .then((r) => r.data),

  stats: () =>
    api.get<ScmStats>("/scm/stats").then((r) => r.data),

  registerWebhook: (repoId: string) =>
    api.post(`/scm/repos/${repoId}/register-webhook`).then((r) => r.data),

  deleteWebhook: (repoId: string) =>
    api.delete(`/scm/repos/${repoId}/webhook`).then((r) => r.data),

  repoMembers: (repoId: string) =>
    api.get<{ repo: ScmRepo; members: RepoMember[]; projectRepoId: string | null }>(`/scm/repos/${repoId}/members`).then((r) => r.data),

  grantAccess: (repoId: string, userId: string, permission: string) =>
    api.post(`/scm/repos/${repoId}/grant-access`, { userId, permission }).then((r) => r.data),

  revokeAccess: (repoId: string, userId: string) =>
    api.delete(`/scm/repos/${repoId}/revoke-access/${userId}`).then((r) => r.data),

  analytics: () =>
    api.get<ScmAnalytics>("/scm/analytics").then((r) => r.data),

  branches: (repoId: string) =>
    api.get<{ branches: string[]; defaultBranch: string }>(`/scm/repos/${repoId}/branches`).then((r) => r.data),

  repoActivity: (repoId: string, params?: { branch?: string; type?: string; limit?: string }) =>
    api.get<{ events: GitActivityEvent[]; total: number; branch: string }>(`/scm/repos/${repoId}/activity`, { params }).then((r) => r.data),
};
