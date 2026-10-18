import { prisma } from "./prisma";
import { Role } from "@prisma/client";

// BFS to collect all user IDs in the reporting subtree below userId (inclusive)
export async function getSubtreeIds(userId: string, organizationId?: string | null): Promise<string[]> {
  const ids: string[] = [userId];
  const queue = [userId];
  while (queue.length) {
    const current = queue.shift()!;
    const reports = await prisma.user.findMany({
      where: { managerId: current, isActive: true, ...(organizationId ? { organizationId } : {}) },
      select: { id: true },
    });
    for (const r of reports) {
      ids.push(r.id);
      queue.push(r.id);
    }
  }
  return ids;
}

// Read the hierarchy config for an org from its settings JSON.
// Returns sensible defaults when not configured.
export async function getHierarchyConfig(organizationId: string | null | undefined): Promise<{
  hierarchyAdminRoles: Role[];
  orgWideVisibilityRoles: Role[];
}> {
  const defaults = {
    hierarchyAdminRoles: [Role.FOUNDER, Role.CPO, Role.CFO, Role.HR] as Role[],
    orgWideVisibilityRoles: [Role.FOUNDER, Role.CPO, Role.CFO, Role.HR] as Role[],
  };
  if (!organizationId) return defaults;

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });
  const s = (org?.settings ?? {}) as Record<string, any>;

  return {
    hierarchyAdminRoles: Array.isArray(s.hierarchyAdminRoles) && s.hierarchyAdminRoles.length > 0
      ? s.hierarchyAdminRoles as Role[]
      : defaults.hierarchyAdminRoles,
    orgWideVisibilityRoles: Array.isArray(s.orgWideVisibilityRoles) && s.orgWideVisibilityRoles.length > 0
      ? s.orgWideVisibilityRoles as Role[]
      : defaults.orgWideVisibilityRoles,
  };
}

// Returns the set of userIds the caller may see for attendance.
// null means "no restriction" (see everyone).
export async function getVisibleUserIds(
  requestingUser: { id: string; role: Role; organizationId?: string | null }
): Promise<string[] | null> {
  const { orgWideVisibilityRoles } = await getHierarchyConfig(requestingUser.organizationId);

  if (orgWideVisibilityRoles.includes(requestingUser.role)) {
    return null;
  }
  // Full subtree (themselves + all direct/indirect reports)
  if (requestingUser.role === Role.MANAGER) {
    return getSubtreeIds(requestingUser.id, requestingUser.organizationId);
  }
  // Direct reports only
  if (requestingUser.role === Role.TEAM_LEAD) {
    const reports = await prisma.user.findMany({
      where: { managerId: requestingUser.id, isActive: true, ...(requestingUser.organizationId ? { organizationId: requestingUser.organizationId } : {}) },
      select: { id: true },
    });
    return [requestingUser.id, ...reports.map((r) => r.id)];
  }
  // Default: only themselves
  return [requestingUser.id];
}
