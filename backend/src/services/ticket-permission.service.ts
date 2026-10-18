import { Role } from "@prisma/client";
import { ApiError } from "../lib/api-error";
import { AuthRequest } from "../middleware/auth";

export type TicketActor = NonNullable<AuthRequest["user"]>;
export type TicketAccessRecord = { organizationId: string; reporterId: string; assigneeId: string | null; projectId: string | null; deletedAt: Date | null };
const MANAGE_ROLES: Role[] = [Role.FOUNDER, Role.CPO, Role.CFO, Role.HR, Role.MANAGER, Role.TEAM_LEAD];
export const sameOrganization = (actor: TicketActor, ticket: TicketAccessRecord) => actor.isSuperAdmin || (!!actor.organizationId && actor.organizationId === ticket.organizationId);
export const canViewTicket = (actor: TicketActor, ticket: TicketAccessRecord) => sameOrganization(actor, ticket) && (actor.isSuperAdmin || MANAGE_ROLES.includes(actor.role) || ticket.reporterId === actor.id || ticket.assigneeId === actor.id);
export const canCreateTicket = (actor: TicketActor) => actor.isSuperAdmin || !!actor.organizationId;
export const canEditTicket = (actor: TicketActor, ticket: TicketAccessRecord) => canViewTicket(actor, ticket) && (actor.isSuperAdmin || MANAGE_ROLES.includes(actor.role) || ticket.reporterId === actor.id || ticket.assigneeId === actor.id);
export const canDeleteTicket = (actor: TicketActor, ticket: TicketAccessRecord) => sameOrganization(actor, ticket) && (actor.isSuperAdmin || MANAGE_ROLES.includes(actor.role));
export const canTransitionTicket = canEditTicket;
export const canAssignTicket = canEditTicket;
export const canComment = canViewTicket;
export const canLogTime = canEditTicket;
export function assertTicketPermission(allowed: boolean, message = "You do not have permission to perform this action") { if (!allowed) throw new ApiError(403, message, "FORBIDDEN"); }
