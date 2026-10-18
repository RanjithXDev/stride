export interface TokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  tokenType?: string;
}

export interface ProviderUser {
  id: string;
  username: string;
  email?: string;
  avatarUrl?: string;
}

export interface ProviderRepo {
  id: string;
  namespace: string;
  name: string;
  fullName: string;
  webUrl: string;
  defaultBranch: string;
  isPrivate: boolean;
  cloneUrl?: string;
}

export interface CreateRepoOpts {
  name: string;
  namespace?: string;
  isPrivate?: boolean;
  description?: string;
}

export type GrantResult = "ACTIVE" | "INVITATION_PENDING";

export interface AccessCheckResult {
  permission: string;
  isActive: boolean;
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
}

export interface IScmProvider {
  getAuthUrl(state: string, redirectUri: string): string;
  exchangeCode(code: string, redirectUri: string): Promise<TokenResponse>;
  refreshToken(refreshToken: string): Promise<TokenResponse>;
  getAuthenticatedUser(accessToken: string): Promise<ProviderUser>;
  listRepositories(accessToken: string): Promise<ProviderRepo[]>;
  getRepository(accessToken: string, owner: string, repo: string): Promise<ProviderRepo>;
  createRepository(accessToken: string, opts: CreateRepoOpts): Promise<ProviderRepo>;
  grantAccess(accessToken: string, owner: string, repo: string, username: string, permission: string): Promise<GrantResult>;
  revokeAccess(accessToken: string, owner: string, repo: string, usernameOrId: string): Promise<void>;
  checkAccess(accessToken: string, owner: string, repo: string, username: string): Promise<AccessCheckResult | null>;
  getRecentActivity(accessToken: string, owner: string, repo: string, repoFullName: string, branch?: string): Promise<GitActivityEvent[]>;
  listBranches(accessToken: string, owner: string, repo: string): Promise<string[]>;
  registerWebhook(accessToken: string, owner: string, repo: string, webhookUrl: string, secret: string): Promise<string>;
  deleteWebhook(accessToken: string, owner: string, repo: string, hookId: string): Promise<void>;
}
