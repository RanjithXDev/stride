import api from "./api";
import { ScmConnection, EmployeeIdentity, ProviderRepo, ProjectRepo, RepoAccessGrant } from "@/types";

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

export interface ScmAppConfig {
  github: { clientId: string; callbackUrl: string; configured: boolean };
  gitlab: { clientId: string; host: string; callbackUrl: string; configured: boolean };
}

export const integrationApi = {
  getScmConfig: async (): Promise<ScmAppConfig> => {
    const { data } = await api.get("/integrations/scm-config");
    return data;
  },

  saveScmConfig: async (payload: { provider: "GITHUB" | "GITLAB"; clientId: string; clientSecret?: string; callbackUrl?: string; host?: string }) => {
    const { data } = await api.put("/integrations/scm-config", payload);
    return data;
  },

  clearScmConfig: async (provider: "GITHUB" | "GITLAB") => {
    const { data } = await api.delete(`/integrations/scm-config/${provider}`);
    return data;
  },

  getConnections: async (): Promise<ScmConnection[]> => {
    const { data } = await api.get("/integrations/connections");
    return data;
  },

  connectGitHub: async () => {
    const { data } = await api.post("/integrations/github/initiate");
    window.location.href = data.url;
  },

  connectGitLab: async (host?: string) => {
    const { data } = await api.post("/integrations/gitlab/initiate", { host });
    window.location.href = data.url;
  },

  deleteConnection: async (id: string) => {
    const { data } = await api.delete(`/integrations/connections/${id}`);
    return data;
  },

  getRepositories: async (connectionId: string): Promise<ProviderRepo[]> => {
    const { data } = await api.get(`/integrations/connections/${connectionId}/repositories`);
    return data;
  },

  getMyIdentities: async (): Promise<EmployeeIdentity[]> => {
    const { data } = await api.get("/integrations/identities");
    return data;
  },

  connectIdentity: async (provider: "github" | "gitlab") => {
    const { data } = await api.post(`/integrations/identities/${provider}/initiate`);
    window.location.href = data.url;
  },

  disconnectIdentity: async (id: string) => {
    const { data } = await api.delete(`/integrations/identities/${id}`);
    return data;
  },
};

export const projectRepoApi = {
  list: async (projectId: string): Promise<ProjectRepo[]> => {
    const { data } = await api.get(`/projects/${projectId}/repositories`);
    return data;
  },

  add: async (projectId: string, payload: any): Promise<ProjectRepo> => {
    const { data } = await api.post(`/projects/${projectId}/repositories`, payload);
    return data;
  },

  remove: async (projectId: string, repoId: string, mode: "KEEP_ACCESS" | "REVOKE_ACCESS" = "KEEP_ACCESS") => {
    const { data } = await api.delete(`/projects/${projectId}/repositories/${repoId}`, { data: { mode } });
    return data;
  },

  getAccess: async (projectId: string, repoId: string): Promise<RepoAccessGrant[]> => {
    const { data } = await api.get(`/projects/${projectId}/repositories/${repoId}/access`);
    return data;
  },

  sync: async (projectId: string, repoId: string) => {
    const { data } = await api.post(`/projects/${projectId}/repositories/${repoId}/sync`);
    return data;
  },

  retryGrant: async (grantId: string) => {
    const { data } = await api.post(`/repository-access/${grantId}/retry`);
    return data;
  },

  getGitActivity: async (projectId: string): Promise<GitActivityEvent[]> => {
    const { data } = await api.get(`/projects/${projectId}/git-activity`);
    return data;
  },
};

