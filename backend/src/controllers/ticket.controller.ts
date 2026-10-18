import { Response } from "express";
import {
  Prisma, Role, TicketActivityType, TicketPriority, TicketStatus, TicketType,
} from "@prisma/client";
import { AuthRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { ApiError } from "../lib/api-error";
import {
  parseBulkUpdate, parseComment, parseLink, parsePagination,
  parseTicketCreate, parseTicketUpdate, parseTimeLog,
} from "../validation/ticket.validation";
import {
  assertTicketPermission, canAssignTicket, canComment, canCreateTicket,
  canDeleteTicket, canEditTicket, canLogTime, canViewTicket,
} from "../services/ticket-permission.service";
import { createTicketAuditEvent, ticketAuditSnapshot } from "../services/audit.service";

const ticketMiniSelect = {
  id: true, key: true, ticketNumber: true, projectSequence: true,
  title: true, status: true, priority: true, type: true, version: true,
} satisfies Prisma.TicketSelect;

const ticketSelect = {
  ...ticketMiniSelect,
  description: true, estimation: true, dueDate: true, closedAt: true,
  createdAt: true, updatedAt: true, deletedAt: true, organizationId: true,
  parent: { select: ticketMiniSelect },
  project: { select: { id: true, key: true, name: true, organizationId: true } },
  assignee: { select: { id: true, name: true, avatar: true, role: true, department: { select: { id: true, name: true } } } },
  reporter: { select: { id: true, name: true, avatar: true } },
} satisfies Prisma.TicketSelect;

const accessSelect = {
  id: true, organizationId: true, reporterId: true, assigneeId: true,
  projectId: true, parentId: true, deletedAt: true, version: true,
} satisfies Prisma.TicketSelect;

function actor(req: AuthRequest) {
  if (!req.user) throw new ApiError(401, "Unauthorized", "UNAUTHORIZED");
  return req.user;
}

function ticketIdentifier(req: AuthRequest) { return String(req.params.id ?? "").trim(); }

function identifierWhere(identifier: string, organizationId?: string | null): Prisma.TicketWhereInput {
  return {
    ...(organizationId ? { organizationId } : {}),
    OR: [{ id: identifier }, { key: identifier.toUpperCase() }],
  };
}

async function findAccessTicket(identifier: string, organizationId?: string | null, includeDeleted = false) {
  return prisma.ticket.findFirst({
    where: { ...identifierWhere(identifier, organizationId), ...(!includeDeleted ? { deletedAt: null } : {}) },
    select: accessSelect,
  });
}

async function requireProject(projectId: string | null | undefined, organizationId: string | null) {
  if (!projectId) return null;
  const project = await prisma.project.findFirst({
    where: { id: projectId, ...(organizationId ? { organizationId } : {}) },
    select: { id: true, organizationId: true, key: true, name: true },
  });
  if (!project?.organizationId) throw new ApiError(400, "Project does not belong to your organization", "INVALID_REFERENCE", { field: "projectId" });
  return project;
}

async function requireOrganizationUser(userId: string | null | undefined, organizationId: string, field: string) {
  if (!userId) return null;
  const user = await prisma.user.findFirst({ where: { id: userId, organizationId, isActive: true }, select: { id: true, name: true } });
  if (!user) throw new ApiError(400, `${field} does not belong to your organization`, "INVALID_REFERENCE", { field });
  return user;
}

async function requireRelatedTicket(id: string | null | undefined, organizationId: string, field: string) {
  if (!id) return null;
  const ticket = await prisma.ticket.findFirst({ where: { id, organizationId, deletedAt: null }, select: { ...accessSelect, title: true } });
  if (!ticket) throw new ApiError(400, `${field} does not belong to your organization`, "INVALID_REFERENCE", { field });
  return ticket;
}

async function assertNoParentCycle(ticketId: string, proposedParentId: string | null) {
  let cursor: string | null = proposedParentId;
  const seen = new Set<string>();
  while (cursor) {
    if (cursor === ticketId || seen.has(cursor)) throw new ApiError(409, "Parent relationship would create a cycle", "PARENT_CYCLE");
    seen.add(cursor);
    const parent: { parentId: string | null } | null = await prisma.ticket.findUnique({ where: { id: cursor }, select: { parentId: true } });
    cursor = parent?.parentId ?? null;
  }
}

function activity(type: TicketActivityType, from?: string | null, to?: string | null) {
  return { type, from: from ?? undefined, to: to ?? undefined };
}

export async function listTickets(req: AuthRequest, res: Response) {
  const user = actor(req);
  if (!user.organizationId && !user.isSuperAdmin) throw new ApiError(403, "Organization membership is required", "ORGANIZATION_REQUIRED");
  const { page, pageSize } = parsePagination(req.query as Record<string, unknown>);
  const q = req.query;
  const and: Prisma.TicketWhereInput[] = [{ deletedAt: null }];
  if (user.organizationId) and.push({ organizationId: user.organizationId });
  if (user.role === Role.EMPLOYEE) and.push({ OR: [{ assigneeId: user.id }, { reporterId: user.id }] });
  if (q.myIssues === "true") and.push({ OR: [{ assigneeId: user.id }, { reporterId: user.id }] });
  if (q.search) and.push({ OR: [
    { title: { contains: String(q.search), mode: "insensitive" } },
    { description: { contains: String(q.search), mode: "insensitive" } },
    { key: { contains: String(q.search).toUpperCase(), mode: "insensitive" } },
  ] });
  if (q.status) and.push({ status: String(q.status) as TicketStatus });
  if (q.priority) and.push({ priority: String(q.priority) as TicketPriority });
  if (q.type) and.push({ type: String(q.type) as TicketType });
  if (q.projectId) and.push({ projectId: String(q.projectId) });
  if (q.assigneeId) and.push({ assigneeId: String(q.assigneeId) });
  if (q.reporterId) and.push({ reporterId: String(q.reporterId) });
  if (q.parentId !== undefined) and.push({ parentId: q.parentId === "null" ? null : String(q.parentId) });

  const sortDir: Prisma.SortOrder = q.sortDir === "asc" ? "asc" : "desc";
  const sortBy = String(q.sortBy ?? "createdAt");
  const sortable = new Set(["createdAt", "updatedAt", "dueDate", "ticketNumber", "projectSequence", "key", "title", "priority"]);
  const orderBy = { [sortable.has(sortBy) ? sortBy : "createdAt"]: sortDir } as Prisma.TicketOrderByWithRelationInput;
  const where: Prisma.TicketWhereInput = { AND: and };
  const [items, total] = await Promise.all([
    prisma.ticket.findMany({ where, select: ticketSelect, orderBy, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.ticket.count({ where }),
  ]);
  return res.json({ items, total, page, pageSize });
}

export async function getTicket(req: AuthRequest, res: Response) {
  const user = actor(req);
  const ticket = await prisma.ticket.findFirst({
    where: { ...identifierWhere(ticketIdentifier(req), user.organizationId), deletedAt: null },
    select: {
      ...ticketSelect,
      reporterId: true, assigneeId: true, projectId: true,
      children: { where: { deletedAt: null }, select: ticketMiniSelect, orderBy: { createdAt: "asc" } },
      comments: { select: { id: true, content: true, createdAt: true, updatedAt: true, author: { select: { id: true, name: true, avatar: true } } }, orderBy: { createdAt: "asc" } },
      timeLogs: { select: { id: true, minutes: true, notes: true, workType: true, loggedAt: true, user: { select: { id: true, name: true } } }, orderBy: { loggedAt: "desc" } },
      activities: { select: { id: true, type: true, from: true, to: true, createdAt: true, user: { select: { id: true, name: true, avatar: true } } }, orderBy: { createdAt: "asc" } },
      linksFrom: { select: { id: true, linkType: true, target: { select: ticketMiniSelect } } },
      linksTo: { select: { id: true, linkType: true, source: { select: ticketMiniSelect } } },
    },
  });
  if (!ticket) throw new ApiError(404, "Ticket not found", "NOT_FOUND");
  assertTicketPermission(canViewTicket(user, ticket), "You cannot view this ticket");
  const links = [
    ...ticket.linksFrom.map((link) => ({ id: link.id, linkType: link.linkType, direction: "FROM", ticket: link.target })),
    ...ticket.linksTo.map((link) => ({ id: link.id, linkType: link.linkType, direction: "TO", ticket: link.source })),
  ];
  const { linksFrom, linksTo, reporterId: _reporterId, assigneeId: _assigneeId, projectId: _projectId, ...rest } = ticket;
  return res.json({ ...rest, links });
}

export async function createTicket(req: AuthRequest, res: Response) {
  const user = actor(req);
  assertTicketPermission(canCreateTicket(user), "Organization membership is required to create tickets");
  const input = parseTicketCreate(req.body);
  const project = await requireProject(input.projectId, user.organizationId);
  const organizationId = user.organizationId ?? project?.organizationId;
  if (!organizationId) throw new ApiError(400, "A project is required when creating as a platform administrator", "ORGANIZATION_REQUIRED");
  await requireOrganizationUser(input.assigneeId, organizationId, "assigneeId");
  const parent = await requireRelatedTicket(input.parentId, organizationId, "parentId");
  if (parent && input.projectId && parent.projectId !== input.projectId) throw new ApiError(400, "Parent ticket must belong to the same project", "INVALID_REFERENCE", { field: "parentId" });

  const ticket = await prisma.$transaction(async (tx) => {
    let sequence: number | null = null;
    let prefix = "GEN";
    if (project) {
      const updatedProject = await tx.project.update({ where: { id: project.id }, data: { nextTicketNumber: { increment: 1 } }, select: { nextTicketNumber: true, key: true } });
      sequence = updatedProject.nextTicketNumber - 1;
      prefix = updatedProject.key ?? "PRJ";
    } else {
      const updatedOrganization = await tx.organization.update({ where: { id: organizationId }, data: { nextTicketNumber: { increment: 1 } }, select: { nextTicketNumber: true } });
      sequence = updatedOrganization.nextTicketNumber - 1;
    }
    const created = await tx.ticket.create({
      data: { ...input, description: input.description ?? undefined, assigneeId: input.assigneeId ?? undefined, parentId: input.parentId ?? undefined, dueDate: input.dueDate ?? undefined, projectId: input.projectId ?? undefined, organizationId, reporterId: user.id, projectSequence: sequence, key: `${prefix}-${sequence}` },
      select: ticketSelect,
    });
    await tx.ticketActivity.create({ data: { ticketId: created.id, userId: user.id, type: TicketActivityType.CREATED } });
    await createTicketAuditEvent(tx, {
      organizationId, actorId: user.id, ticketId: created.id, action: "ticket.created",
      afterState: ticketAuditSnapshot(created as unknown as Record<string, unknown>), resourceVersion: created.version,
    });
    return created;
  });
  return res.status(201).json(ticket);
}

export async function updateTicket(req: AuthRequest, res: Response) {
  const user = actor(req);
  const existing = await findAccessTicket(ticketIdentifier(req), user.organizationId);
  if (!existing) throw new ApiError(404, "Ticket not found", "NOT_FOUND");
  assertTicketPermission(canEditTicket(user, existing), "You cannot edit this ticket");
  const input = parseTicketUpdate(req.body);
  if (input.assigneeId !== undefined) { assertTicketPermission(canAssignTicket(user, existing)); await requireOrganizationUser(input.assigneeId, existing.organizationId, "assigneeId"); }
  if (input.parentId !== undefined) {
    const parent = await requireRelatedTicket(input.parentId, existing.organizationId, "parentId");
    if (parent && parent.projectId !== existing.projectId) throw new ApiError(400, "Parent ticket must belong to the same project", "INVALID_REFERENCE", { field: "parentId" });
    await assertNoParentCycle(existing.id, input.parentId ?? null);
  }
  const current = await prisma.ticket.findUnique({ where: { id: existing.id }, select: { title: true, description: true, status: true, priority: true, type: true, assigneeId: true, dueDate: true, estimation: true, parentId: true, closedAt: true, deletedAt: true, version: true, assignee: { select: { name: true } } } });
  if (!current) throw new ApiError(404, "Ticket not found", "NOT_FOUND");
  const nextAssignee = input.assigneeId !== undefined ? await requireOrganizationUser(input.assigneeId, existing.organizationId, "assigneeId") : null;
  const activities = [] as ReturnType<typeof activity>[];
  if (input.title !== undefined && input.title !== current.title) activities.push(activity(TicketActivityType.TITLE_CHANGED, current.title, input.title));
  if (input.description !== undefined && input.description !== current.description) activities.push(activity(TicketActivityType.DESCRIPTION_CHANGED));
  if (input.status !== undefined && input.status !== current.status) activities.push(activity(TicketActivityType.STATUS_CHANGED, current.status, input.status));
  if (input.priority !== undefined && input.priority !== current.priority) activities.push(activity(TicketActivityType.PRIORITY_CHANGED, current.priority, input.priority));
  if (input.type !== undefined && input.type !== current.type) activities.push(activity(TicketActivityType.TYPE_CHANGED, current.type, input.type));
  if (input.assigneeId !== undefined && input.assigneeId !== current.assigneeId) activities.push(activity(TicketActivityType.ASSIGNEE_CHANGED, current.assignee?.name ?? "Unassigned", nextAssignee?.name ?? "Unassigned"));
  if (input.estimation !== undefined && input.estimation !== current.estimation) activities.push(activity(TicketActivityType.ESTIMATION_SET, current.estimation?.toString(), input.estimation?.toString()));
  if (input.dueDate !== undefined && input.dueDate?.getTime() !== current.dueDate?.getTime()) activities.push(activity(TicketActivityType.DUE_DATE_SET, current.dueDate?.toISOString(), input.dueDate?.toISOString()));
  if (input.parentId !== undefined && input.parentId !== current.parentId) activities.push(activity(TicketActivityType.PARENT_SET, current.parentId, input.parentId));
  const { version, ...data } = input;
  const expectedVersion = version!;
  const nextClosedAt = input.status === TicketStatus.CLOSED ? current.closedAt ?? new Date() : input.status ? null : current.closedAt;
  await prisma.$transaction(async (tx) => {
    const updated = await tx.ticket.updateMany({ where: { id: existing.id, organizationId: existing.organizationId, version: expectedVersion, deletedAt: null }, data: { ...data, closedAt: nextClosedAt, version: { increment: 1 } } });
    if (updated.count !== 1) throw new ApiError(409, "This ticket was changed by someone else. Refresh and try again.", "VERSION_CONFLICT");
    if (activities.length) {
      await tx.ticketActivity.createMany({ data: activities.map((entry) => ({ ticketId: existing.id, userId: user.id, ...entry })) });
      const beforeState = ticketAuditSnapshot(current as unknown as Record<string, unknown>);
      const afterState = ticketAuditSnapshot({ ...current, ...data, closedAt: nextClosedAt, version: expectedVersion + 1 });
      await createTicketAuditEvent(tx, {
        organizationId: existing.organizationId, actorId: user.id, ticketId: existing.id,
        action: "ticket.updated", beforeState, afterState, resourceVersion: expectedVersion + 1,
        reversible: true, metadata: { changedFields: activities.map((entry) => entry.type) },
      });
    }
  });
  const result = await prisma.ticket.findUnique({ where: { id: existing.id }, select: ticketSelect });
  return res.json(result);
}

export async function deleteTicket(req: AuthRequest, res: Response) {
  const user = actor(req);
  const ticket = await findAccessTicket(ticketIdentifier(req), user.organizationId);
  if (!ticket) throw new ApiError(404, "Ticket not found", "NOT_FOUND");
  assertTicketPermission(canDeleteTicket(user, ticket), "You cannot delete this ticket");
  await prisma.$transaction(async (tx) => {
    const before = await tx.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    const deletedAt = new Date();
    await tx.ticket.update({ where: { id: ticket.id }, data: { deletedAt, version: { increment: 1 } } });
    await tx.ticketActivity.create({ data: { ticketId: ticket.id, userId: user.id, type: TicketActivityType.SOFT_DELETED } });
    await createTicketAuditEvent(tx, {
      organizationId: ticket.organizationId, actorId: user.id, ticketId: ticket.id, action: "ticket.deleted",
      beforeState: ticketAuditSnapshot(before as unknown as Record<string, unknown>),
      afterState: ticketAuditSnapshot({ ...before, deletedAt, version: before.version + 1 }),
      resourceVersion: before.version + 1, reversible: true,
    });
  });
  return res.status(204).send();
}

export async function restoreTicket(req: AuthRequest, res: Response) {
  const user = actor(req);
  const ticket = await findAccessTicket(ticketIdentifier(req), user.organizationId, true);
  if (!ticket) throw new ApiError(404, "Ticket not found", "NOT_FOUND");
  assertTicketPermission(canDeleteTicket(user, ticket), "You cannot restore this ticket");
  await prisma.$transaction(async (tx) => {
    const before = await tx.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    await tx.ticket.update({ where: { id: ticket.id }, data: { deletedAt: null, version: { increment: 1 } } });
    await tx.ticketActivity.create({ data: { ticketId: ticket.id, userId: user.id, type: TicketActivityType.RESTORED } });
    await createTicketAuditEvent(tx, {
      organizationId: ticket.organizationId, actorId: user.id, ticketId: ticket.id, action: "ticket.restored",
      beforeState: ticketAuditSnapshot(before as unknown as Record<string, unknown>),
      afterState: ticketAuditSnapshot({ ...before, deletedAt: null, version: before.version + 1 }),
      resourceVersion: before.version + 1, reversible: true,
    });
  });
  return res.json(await prisma.ticket.findUnique({ where: { id: ticket.id }, select: ticketSelect }));
}

export async function bulkUpdateTickets(req: AuthRequest, res: Response) {
  const user = actor(req);
  const { ids, update } = parseBulkUpdate(req.body);
  const tickets = await prisma.ticket.findMany({ where: { id: { in: ids }, ...(user.organizationId ? { organizationId: user.organizationId } : {}), deletedAt: null }, select: accessSelect });
  if (tickets.length !== ids.length || tickets.some((ticket) => !canEditTicket(user, ticket))) throw new ApiError(403, "One or more tickets cannot be updated", "BULK_FORBIDDEN");
  if (update.assigneeId !== undefined && tickets[0]) await requireOrganizationUser(update.assigneeId, tickets[0].organizationId, "assigneeId");
  const data = Object.fromEntries(Object.entries(update).filter(([, value]) => value !== undefined));
  if (!Object.keys(data).length) throw new ApiError(400, "No supported update fields were provided", "VALIDATION_ERROR");
  const result = await prisma.ticket.updateMany({ where: { id: { in: ids }, organizationId: tickets[0].organizationId, deletedAt: null }, data: { ...data, version: { increment: 1 } } });
  return res.json({ updated: result.count });
}

export async function addComment(req: AuthRequest, res: Response) {
  const user = actor(req); const ticket = await findAccessTicket(ticketIdentifier(req), user.organizationId);
  if (!ticket) throw new ApiError(404, "Ticket not found", "NOT_FOUND"); assertTicketPermission(canComment(user, ticket));
  const { content } = parseComment(req.body);
  const comment = await prisma.$transaction(async (tx) => {
    const created = await tx.ticketComment.create({ data: { content, ticketId: ticket.id, authorId: user.id }, select: { id: true, content: true, createdAt: true, updatedAt: true, author: { select: { id: true, name: true, avatar: true } } } });
    await tx.ticketActivity.create({ data: { ticketId: ticket.id, userId: user.id, type: TicketActivityType.COMMENT_ADDED, to: created.id } });
    return created;
  });
  return res.status(201).json(comment);
}

export async function updateComment(req: AuthRequest, res: Response) {
  const user = actor(req); const ticket = await findAccessTicket(ticketIdentifier(req), user.organizationId);
  if (!ticket) throw new ApiError(404, "Ticket not found", "NOT_FOUND"); assertTicketPermission(canComment(user, ticket));
  const commentId = String(req.params.commentId); const { content } = parseComment(req.body);
  const comment = await prisma.ticketComment.findFirst({ where: { id: commentId, ticketId: ticket.id } });
  if (!comment) throw new ApiError(404, "Comment not found", "NOT_FOUND");
  if (comment.authorId !== user.id) throw new ApiError(403, "Cannot edit another user's comment", "FORBIDDEN");
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.ticketComment.update({ where: { id: commentId }, data: { content }, select: { id: true, content: true, createdAt: true, updatedAt: true, author: { select: { id: true, name: true, avatar: true } } } });
    await tx.ticketActivity.create({ data: { ticketId: ticket.id, userId: user.id, type: TicketActivityType.COMMENT_EDITED, to: commentId } }); return result;
  });
  return res.json(updated);
}

export async function deleteComment(req: AuthRequest, res: Response) {
  const user = actor(req); const ticket = await findAccessTicket(ticketIdentifier(req), user.organizationId);
  if (!ticket) throw new ApiError(404, "Ticket not found", "NOT_FOUND"); assertTicketPermission(canComment(user, ticket));
  const commentId = String(req.params.commentId); const comment = await prisma.ticketComment.findFirst({ where: { id: commentId, ticketId: ticket.id } });
  if (!comment) throw new ApiError(404, "Comment not found", "NOT_FOUND");
  if (comment.authorId !== user.id && !canDeleteTicket(user, ticket)) throw new ApiError(403, "Cannot delete this comment", "FORBIDDEN");
  await prisma.$transaction([prisma.ticketComment.delete({ where: { id: commentId } }), prisma.ticketActivity.create({ data: { ticketId: ticket.id, userId: user.id, type: TicketActivityType.COMMENT_DELETED, to: commentId } })]);
  return res.status(204).send();
}

export async function logTime(req: AuthRequest, res: Response) {
  const user = actor(req); const ticket = await findAccessTicket(ticketIdentifier(req), user.organizationId);
  if (!ticket) throw new ApiError(404, "Ticket not found", "NOT_FOUND"); assertTicketPermission(canLogTime(user, ticket), "You cannot log time on this ticket");
  const input = parseTimeLog(req.body);
  const log = await prisma.$transaction(async (tx) => {
    const created = await tx.timeLog.create({ data: { ...input, notes: input.notes ?? undefined, ticketId: ticket.id, projectId: ticket.projectId, userId: user.id }, select: { id: true, minutes: true, notes: true, workType: true, loggedAt: true, user: { select: { id: true, name: true } } } });
    await tx.ticketActivity.create({ data: { ticketId: ticket.id, userId: user.id, type: TicketActivityType.TIME_LOGGED, to: `${input.minutes}m` } }); return created;
  });
  return res.status(201).json(log);
}

export async function addLink(req: AuthRequest, res: Response) {
  const user = actor(req); const source = await findAccessTicket(ticketIdentifier(req), user.organizationId);
  if (!source) throw new ApiError(404, "Ticket not found", "NOT_FOUND"); assertTicketPermission(canEditTicket(user, source));
  const input = parseLink(req.body); if (input.targetId === source.id) throw new ApiError(400, "Cannot link a ticket to itself", "INVALID_REFERENCE");
  const target = await requireRelatedTicket(input.targetId, source.organizationId, "targetId");
  if (!target || !canViewTicket(user, target)) throw new ApiError(400, "Target ticket is unavailable", "INVALID_REFERENCE");
  const reverse = await prisma.ticketLink.findFirst({ where: { OR: [{ sourceId: source.id, targetId: target.id }, { sourceId: target.id, targetId: source.id }] } });
  if (reverse) throw new ApiError(409, "These tickets are already linked", "LINK_EXISTS");
  const link = await prisma.$transaction(async (tx) => {
    const created = await tx.ticketLink.create({ data: { sourceId: source.id, targetId: target.id, linkType: input.linkType }, select: { id: true, linkType: true, target: { select: ticketMiniSelect } } });
    await tx.ticketActivity.create({ data: { ticketId: source.id, userId: user.id, type: TicketActivityType.LINKED, to: `${input.linkType}: ${target.title}` } }); return created;
  });
  return res.status(201).json({ id: link.id, linkType: link.linkType, direction: "FROM", ticket: link.target });
}

export async function removeLink(req: AuthRequest, res: Response) {
  const user = actor(req); const linkId = String(req.params.linkId);
  const link = await prisma.ticketLink.findFirst({ where: { id: linkId, source: user.organizationId ? { organizationId: user.organizationId } : undefined }, include: { source: { select: accessSelect }, target: { select: { title: true } } } });
  if (!link) throw new ApiError(404, "Link not found", "NOT_FOUND"); assertTicketPermission(canEditTicket(user, link.source));
  await prisma.$transaction([prisma.ticketLink.delete({ where: { id: linkId } }), prisma.ticketActivity.create({ data: { ticketId: link.sourceId, userId: user.id, type: TicketActivityType.LINK_REMOVED, to: link.target.title } })]);
  return res.status(204).send();
}
