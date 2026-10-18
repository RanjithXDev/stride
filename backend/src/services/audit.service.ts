import { AuditSource, Prisma, ReversalStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { ApiError } from "../lib/api-error";
import { TicketActor, canDeleteTicket, canEditTicket, canViewTicket } from "./ticket-permission.service";
import { planTicketReversal, REVERSIBLE_TICKET_FIELDS, TicketReversalState } from "./audit-reversal";

const REVERSAL_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function ticketAuditSnapshot(ticket: TicketReversalState): Prisma.InputJsonObject {
  const snapshot: Record<string, unknown> = {};
  for (const field of [...REVERSIBLE_TICKET_FIELDS, "version"] as const) {
    const value = ticket[field];
    snapshot[field] = value instanceof Date ? value.toISOString() : value === undefined ? null : value;
  }
  return snapshot as Prisma.InputJsonObject;
}

export async function createTicketAuditEvent(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string; actorId: string; ticketId: string; action: string;
    beforeState?: Prisma.InputJsonObject; afterState?: Prisma.InputJsonObject;
    resourceVersion: number; reversible?: boolean; metadata?: Prisma.InputJsonObject;
  },
) {
  const reversible = input.reversible ?? false;
  return tx.auditEvent.create({ data: {
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: input.action,
    resourceType: "ticket",
    resourceId: input.ticketId,
    source: AuditSource.API,
    beforeState: input.beforeState,
    afterState: input.afterState,
    metadata: input.metadata,
    resourceVersion: input.resourceVersion,
    reversible,
    reversibleUntil: reversible ? new Date(Date.now() + REVERSAL_WINDOW_MS) : null,
    reversalStatus: reversible ? ReversalStatus.AVAILABLE : ReversalStatus.NOT_REQUESTED,
  } });
}

export async function listTicketAuditEvents(actor: TicketActor, identifier: string) {
  const ticket = await prisma.ticket.findFirst({
    where: { ...(actor.organizationId ? { organizationId: actor.organizationId } : {}), OR: [{ id: identifier }, { key: identifier.toUpperCase() }] },
    select: { id: true, organizationId: true, reporterId: true, assigneeId: true, projectId: true, deletedAt: true },
  });
  if (!ticket) throw new ApiError(404, "Ticket not found", "NOT_FOUND");
  if (!canViewTicket(actor, ticket)) throw new ApiError(403, "You cannot view this ticket", "FORBIDDEN");
  return prisma.auditEvent.findMany({
    where: { organizationId: ticket.organizationId, resourceType: "ticket", resourceId: ticket.id },
    select: {
      id: true, action: true, source: true, beforeState: true, afterState: true, metadata: true,
      reason: true, resourceVersion: true, reversible: true, reversibleUntil: true, reversalStatus: true,
      reversesEventId: true, createdAt: true, actor: { select: { id: true, name: true, avatar: true } },
      reversedByEvent: { select: { id: true, createdAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

async function loadReversalContext(actor: TicketActor, eventId: string) {
  const event = await prisma.auditEvent.findFirst({
    where: { id: eventId, ...(actor.organizationId ? { organizationId: actor.organizationId } : {}), resourceType: "ticket" },
    include: { reversedByEvent: { select: { id: true } } },
  });
  if (!event) throw new ApiError(404, "Activity not found", "NOT_FOUND");
  const ticket = await prisma.ticket.findFirst({
    where: { id: event.resourceId, organizationId: event.organizationId },
    select: {
      id: true, organizationId: true, reporterId: true, assigneeId: true, projectId: true,
      title: true, description: true, status: true, priority: true, type: true, dueDate: true,
      estimation: true, parentId: true, closedAt: true, deletedAt: true, version: true,
    },
  });
  if (!ticket) throw new ApiError(404, "Ticket not found", "NOT_FOUND");
  if (!canEditTicket(actor, ticket)) throw new ApiError(403, "You cannot reverse changes to this ticket", "FORBIDDEN");
  const preview = planTicketReversal({
    reversible: event.reversible,
    reversibleUntil: event.reversibleUntil,
    resourceVersion: event.resourceVersion,
    beforeState: event.beforeState as TicketReversalState | null,
    afterState: event.afterState as TicketReversalState | null,
    alreadyReversed: !!event.reversedByEvent,
  }, ticket);
  if (preview.allowed && preview.changes.some((change) => change.field === "deletedAt") && !canDeleteTicket(actor, ticket)) {
    throw new ApiError(403, "Only ticket managers can reverse deletion or restoration", "FORBIDDEN");
  }
  return { event, ticket, preview };
}

export async function previewTicketReversal(actor: TicketActor, eventId: string) {
  const { event, ticket, preview } = await loadReversalContext(actor, eventId);
  return { eventId: event.id, ticketId: ticket.id, currentVersion: ticket.version, ...preview };
}

export async function reverseTicketAuditEvent(actor: TicketActor, eventId: string, expectedVersion: number, reason?: string) {
  const context = await loadReversalContext(actor, eventId);
  if (!context.preview.allowed) throw new ApiError(409, context.preview.message ?? "Activity cannot be reversed", context.preview.code ?? "REVERSAL_BLOCKED");
  if (expectedVersion !== context.ticket.version) throw new ApiError(409, "The ticket changed after the reversal preview", "VERSION_CONFLICT");
  const beforeState = ticketAuditSnapshot(context.ticket);
  const restored = context.event.beforeState as TicketReversalState;
  const data: Record<string, unknown> = {};
  for (const field of REVERSIBLE_TICKET_FIELDS) {
    if (field in restored) data[field] = dateField(field) && restored[field] ? new Date(String(restored[field])) : restored[field];
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.ticket.updateMany({
      where: { id: context.ticket.id, organizationId: context.ticket.organizationId, version: expectedVersion },
      data: { ...data, version: { increment: 1 } },
    });
    if (updated.count !== 1) throw new ApiError(409, "The ticket changed while the reversal was being applied", "VERSION_CONFLICT");
    const afterState = ticketAuditSnapshot({ ...context.ticket, ...data, version: expectedVersion + 1 });
    const reversal = await tx.auditEvent.create({ data: {
      organizationId: context.ticket.organizationId,
      actorId: actor.id,
      action: "ticket.change.reversed",
      resourceType: "ticket",
      resourceId: context.ticket.id,
      source: AuditSource.API,
      beforeState,
      afterState,
      reason,
      metadata: { reversedAction: context.event.action },
      resourceVersion: expectedVersion + 1,
      reversible: false,
      reversalStatus: ReversalStatus.NOT_REQUESTED,
      reversesEventId: context.event.id,
    } });
    return { reversalEventId: reversal.id, ticketId: context.ticket.id, version: expectedVersion + 1 };
  });
}

function dateField(field: string) { return field === "dueDate" || field === "closedAt" || field === "deletedAt"; }
