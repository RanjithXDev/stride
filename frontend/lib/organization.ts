import api from "./api";
import { Organization, OrgSettings, PlanType } from "@/types";

export interface OrgSummary extends Organization {
  _count: { users: number; projects: number; attendances: number };
}

export interface CreateOrgPayload {
  name:          string;
  slug:          string;
  plan?:         PlanType;
  logoUrl?:      string;
  adminName:     string;
  adminEmail:    string;
  adminPassword: string;
}

export interface SuperAdminStats {
  totalOrgs:     number;
  activeOrgs:    number;
  totalUsers:    number;
  planBreakdown: { plan: PlanType; count: number }[];
}

export const orgApi = {
  // Super admin
  superAdminStats: () =>
    api.get<SuperAdminStats>("/org/superadmin/stats").then((r) => r.data),

  listAll: () =>
    api.get<OrgSummary[]>("/org/superadmin").then((r) => r.data),

  getOne: (id: string) =>
    api.get<OrgSummary>(`/org/superadmin/${id}`).then((r) => r.data),

  create: (payload: CreateOrgPayload) =>
    api.post<{ organization: Organization; admin: { id: string; name: string; email: string } }>(
      "/org/superadmin", payload
    ).then((r) => r.data),

  updatePlan: (id: string, payload: { plan?: PlanType; isActive?: boolean; name?: string; logoUrl?: string }) =>
    api.put<Organization>(`/org/superadmin/${id}`, payload).then((r) => r.data),

  // Company admin
  getSettings: () =>
    api.get<Organization>("/org/settings").then((r) => r.data),

  updateSettings: (payload: { name?: string; logoUrl?: string; settings?: Partial<OrgSettings> }) =>
    api.put<Organization>("/org/settings", payload).then((r) => r.data),
};
