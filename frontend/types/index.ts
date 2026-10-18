export type Role = "FOUNDER" | "CPO" | "CFO" | "HR" | "MANAGER" | "TEAM_LEAD" | "EMPLOYEE";
export type PlanType = "FREE" | "STARTER" | "GROWTH" | "ENTERPRISE";

export interface OrgSettings {
  halfDayMinutes:  number;
  fullDayMinutes:  number;
  workdayStart:    string;
  workdayEnd:      string;
  timezone:        string;
  allowWFH:        boolean;
  requireLocation: boolean;
  enabledRoles:    Role[];
  roleLabels:      Record<Role, string>;
  roleColors:      Record<Role, string>;
  // which roles can remap the org chart reporting lines
  hierarchyAdminRoles: Role[];
  // which roles can see all employees' attendance (org-wide)
  orgWideVisibilityRoles: Role[];
}

export interface Organization {
  id:        string;
  name:      string;
  slug:      string;
  logoUrl?:  string | null;
  plan:      PlanType;
  isActive:  boolean;
  settings:  OrgSettings;
  createdAt: string;
}
export type TicketStatus = "OPEN" | "IN_PROGRESS" | "IN_REVIEW" | "CLOSED";
export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type TicketType = "BUG" | "FEATURE" | "TASK" | "IMPROVEMENT";
export type ProjectStatus = "PLANNING" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED";
export type LinkType = "RELATES_TO" | "BLOCKS" | "BLOCKED_BY" | "DUPLICATES";
export type WorkType = "DEVELOPMENT" | "TESTING" | "MEETING" | "DOCUMENTATION" | "REVIEW" | "DESIGN" | "BUG_FIX" | "PLANNING" | "OTHER";

export interface UserMini {
  id: string;
  name: string;
  avatar?: string | null;
}

export interface User extends UserMini {
  email: string;
  role: Role;
  jobTitle?: string | null;
  isSuperAdmin: boolean;
  departmentId?: string | null;
  managerId?: string | null;
  organizationId?: string | null;
  isActive: boolean;
  createdAt: string;
  department?: { id: string; name: string } | null;
  organization?: Pick<Organization, "id" | "name" | "slug" | "plan" | "settings"> | null;
}

export interface ProjectMini {
  id: string;
  key?: string | null;
  name: string;
}

export interface TicketMini {
  id: string;
  key: string;
  ticketNumber: number;
  projectSequence?: number | null;
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  type: TicketType;
}

export interface Ticket {
  id: string;
  key: string;
  ticketNumber: number;
  projectSequence?: number | null;
  version: number;
  title: string;
  description?: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  type: TicketType;
  estimation?: number | null;
  project?: ProjectMini | null;
  assignee?: (UserMini & { role?: Role; department?: { id: string; name: string } | null }) | null;
  reporter: UserMini;
  parent?: TicketMini | null;
  dueDate?: string | null;
  closedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface TicketComment {
  id: string;
  content: string;
  author: UserMini;
  createdAt: string;
  updatedAt: string;
}

export interface TimeLog {
  id: string;
  minutes: number;
  notes?: string | null;
  workType: WorkType;
  user: UserMini;
  loggedAt: string;
}

export interface TimesheetEntry extends TimeLog {
  ticket?: { id: string; title: string; status: string } | null;
  project?: { id: string; name: string } | null;
}

export interface TicketActivity {
  id: string;
  type: string;
  from?: string | null;
  to?: string | null;
  user: UserMini;
  createdAt: string;
}

export interface TicketLink {
  id: string;
  linkType: LinkType;
  direction: "FROM" | "TO";
  ticket: TicketMini;
}

export interface TicketDetail extends Ticket {
  comments: TicketComment[];
  timeLogs: TimeLog[];
  activities: TicketActivity[];
  links: TicketLink[];
  children: TicketMini[];
}

export interface CreateTicketPayload {
  title: string;
  description?: string;
  priority?: TicketPriority;
  type?: TicketType;
  projectId?: string;
  assigneeId?: string;
  parentId?: string;
  dueDate?: string;
  estimation?: number;
}

export interface UpdateTicketPayload extends Omit<Partial<CreateTicketPayload>, "description" | "assigneeId" | "parentId" | "dueDate"> {
  version: number;
  status?: TicketStatus;
  description?: string | null;
  assigneeId?: string | null;
  parentId?: string | null;
  dueDate?: string | null;
}

// SCM Integration types
export type ScmProvider = "GITHUB" | "GITLAB";
export type ScmConnStatus = "ACTIVE" | "EXPIRED" | "REVOKED" | "ERROR";
export type AccessGrantStatus =
  | "QUEUED"
  | "INVITATION_PENDING"
  | "ACTIVE"
  | "UPDATE_PENDING"
  | "REVOKE_PENDING"
  | "REVOKED"
  | "FAILED"
  | "BLOCKED"
  | "EXTERNALLY_MANAGED";

export interface ScmConnection {
  id: string;
  provider: ScmProvider;
  providerHost: string;
  accountName: string;
  status: ScmConnStatus;
  lastSyncedAt: string | null;
  createdAt: string;
  connectedById: string;
}

export interface EmployeeIdentity {
  id: string;
  userId: string;
  connectionId: string;
  providerUserId: string;
  username: string;
  email?: string;
  avatarUrl?: string;
  connection: { id: string; provider: ScmProvider; accountName: string };
}

export interface ProviderRepo {
  id: string;
  namespace: string;
  name: string;
  fullName: string;
  webUrl: string;
  defaultBranch: string;
  isPrivate: boolean;
}

export interface ProjectRepo {
  id: string;
  projectId: string;
  connectionId: string;
  setupMode: "CREATED" | "MAPPED";
  providerRepositoryId: string;
  namespace: string;
  repositoryName: string;
  fullName: string;
  webUrl: string;
  defaultBranch: string;
  isPrivate: boolean;
  defaultPermission: string;
  syncEnabled: boolean;
  lastSyncedAt: string | null;
  lastError: string | null;
  connection: { id: string; provider: ScmProvider; accountName: string };
}

export interface RepoAccessGrant {
  id: string;
  projectRepositoryId: string;
  projectMemberId: string;
  employeeIdentityId: string | null;
  requestedPermission: string;
  actualPermission: string | null;
  status: AccessGrantStatus;
  lastErrorMessage: string | null;
  grantedAt: string | null;
  revokedAt: string | null;
  employeeIdentity: { username: string; email?: string; avatarUrl?: string } | null;
}
