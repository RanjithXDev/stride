import { Response } from "express";
import { ApiError } from "../lib/api-error";
import { AuthRequest } from "../middleware/auth";
import { listTicketAuditEvents, previewTicketReversal, reverseTicketAuditEvent } from "../services/audit.service";
import { prisma } from "../lib/prisma";

function actor(req: AuthRequest) {
  if (!req.user) throw new ApiError(401, "Unauthorized", "UNAUTHORIZED");
  return req.user;
}

export async function listTicketAudit(req: AuthRequest, res: Response) {
  return res.json(await listTicketAuditEvents(actor(req), String(req.params.id ?? "")));
}

export async function previewReversal(req: AuthRequest, res: Response) {
  return res.json(await previewTicketReversal(actor(req), String(req.params.eventId ?? "")));
}

export async function reverseAuditEvent(req: AuthRequest, res: Response) {
  const expectedVersion = Number(req.body?.expectedVersion);
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) throw new ApiError(400, "expectedVersion must be a positive integer", "VALIDATION_ERROR");
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : undefined;
  if (reason && reason.length > 500) throw new ApiError(400, "reason must be 500 characters or fewer", "VALIDATION_ERROR");
  return res.status(201).json(await reverseTicketAuditEvent(actor(req), String(req.params.eventId ?? ""), expectedVersion, reason || undefined));
}

export async function listOrgAuditEvents(req: AuthRequest, res: Response) {
  const { organizationId, role } = req.user!;
  if (!["FOUNDER", "CFO", "CPO"].includes(role)) {
    return res.status(403).json({ message: "Insufficient permissions" });
  }

  const page = Math.max(1, parseInt((req.query.page as string) ?? "1", 10));
  const pageSize = Math.min(50, Math.max(1, parseInt((req.query.pageSize as string) ?? "20", 10)));
  const action = req.query.action as string | undefined;
  const resourceType = req.query.resourceType as string | undefined;
  const actorId = req.query.actorId as string | undefined;

  const where: any = { organizationId };
  if (action) where.action = { contains: action, mode: "insensitive" };
  if (resourceType) where.resourceType = resourceType;
  if (actorId) where.actorId = actorId;

  const [events, total] = await Promise.all([
    prisma.auditEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { actor: { select: { id: true, name: true, email: true, avatar: true } } },
    }),
    prisma.auditEvent.count({ where }),
  ]);

  return res.json({ events, total, page, pageSize });
}
