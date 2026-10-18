import { AuditSource, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

export async function recordSecurityAudit(input: {
  organizationId: string | null | undefined;
  actorId?: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata?: Prisma.InputJsonObject;
  beforeState?: Prisma.InputJsonObject;
  afterState?: Prisma.InputJsonObject;
  reason?: string;
}) {
  if (!input.organizationId) return;
  await prisma.auditEvent.create({ data: {
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    source: AuditSource.API,
    metadata: input.metadata,
    beforeState: input.beforeState,
    afterState: input.afterState,
    reason: input.reason,
    reversible: false,
  } });
}
