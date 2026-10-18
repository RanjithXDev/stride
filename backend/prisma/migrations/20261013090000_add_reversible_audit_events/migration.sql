CREATE TYPE "AuditSource" AS ENUM ('UI', 'API', 'SYSTEM', 'JOB', 'INTEGRATION', 'WEBHOOK');
CREATE TYPE "ReversalStatus" AS ENUM ('NOT_REQUESTED', 'AVAILABLE', 'REVERSED', 'EXPIRED', 'BLOCKED', 'FAILED');

CREATE TABLE "AuditEvent" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "source" "AuditSource" NOT NULL DEFAULT 'API',
  "beforeState" JSONB,
  "afterState" JSONB,
  "metadata" JSONB,
  "reason" TEXT,
  "requestId" TEXT,
  "resourceVersion" INTEGER,
  "reversible" BOOLEAN NOT NULL DEFAULT false,
  "reversibleUntil" TIMESTAMP(3),
  "reversalStatus" "ReversalStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
  "reversesEventId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuditEvent_reversesEventId_key" ON "AuditEvent"("reversesEventId");
CREATE INDEX "AuditEvent_organizationId_createdAt_idx" ON "AuditEvent"("organizationId", "createdAt");
CREATE INDEX "AuditEvent_organizationId_resourceType_resourceId_createdAt_idx" ON "AuditEvent"("organizationId", "resourceType", "resourceId", "createdAt");
CREATE INDEX "AuditEvent_actorId_createdAt_idx" ON "AuditEvent"("actorId", "createdAt");

ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_reversesEventId_fkey"
  FOREIGN KEY ("reversesEventId") REFERENCES "AuditEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
