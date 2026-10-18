CREATE TYPE "TicketActivityType" AS ENUM (
  'CREATED', 'TITLE_CHANGED', 'DESCRIPTION_CHANGED', 'STATUS_CHANGED',
  'PRIORITY_CHANGED', 'TYPE_CHANGED', 'ASSIGNEE_CHANGED', 'ESTIMATION_SET',
  'DUE_DATE_SET', 'PARENT_SET', 'COMMENT_ADDED', 'COMMENT_EDITED',
  'COMMENT_DELETED', 'TIME_LOGGED', 'LINKED', 'LINK_REMOVED',
  'SOFT_DELETED', 'RESTORED'
);

ALTER TABLE "Organization" ADD COLUMN "nextTicketNumber" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "Project"
  ADD COLUMN "key" TEXT,
  ADD COLUMN "nextTicketNumber" INTEGER NOT NULL DEFAULT 1;

UPDATE "Project"
SET "key" = UPPER(
  LEFT(REGEXP_REPLACE(COALESCE(NULLIF("name", ''), 'PRJ'), '[^A-Za-z0-9]', '', 'g'), 5)
  || RIGHT(REGEXP_REPLACE("id", '[^A-Za-z0-9]', '', 'g'), 3)
)
WHERE "key" IS NULL;

ALTER TABLE "Ticket"
  ADD COLUMN "organizationId" TEXT,
  ADD COLUMN "projectSequence" INTEGER,
  ADD COLUMN "key" TEXT,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "deletedAt" TIMESTAMP(3);

UPDATE "Ticket" t
SET "organizationId" = COALESCE(
  (SELECT p."organizationId" FROM "Project" p WHERE p."id" = t."projectId"),
  (SELECT u."organizationId" FROM "User" u WHERE u."id" = t."reporterId")
);

UPDATE "Ticket"
SET "projectSequence" = "ticketNumber",
    "key" = CASE WHEN "projectId" IS NULL THEN 'GEN-' || "ticketNumber"::TEXT ELSE NULL END;

UPDATE "Ticket" t
SET "key" = p."key" || '-' || t."ticketNumber"::TEXT
FROM "Project" p
WHERE t."projectId" = p."id" AND t."key" IS NULL;

ALTER TABLE "Ticket" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Ticket" ALTER COLUMN "key" SET NOT NULL;

UPDATE "Project" p
SET "nextTicketNumber" = COALESCE((
  SELECT MAX(t."projectSequence") + 1 FROM "Ticket" t WHERE t."projectId" = p."id"
), 1);

UPDATE "Organization" o
SET "nextTicketNumber" = COALESCE((
  SELECT MAX(t."projectSequence") + 1 FROM "Ticket" t
  WHERE t."organizationId" = o."id" AND t."projectId" IS NULL
), 1);

ALTER TABLE "TicketActivity"
  ALTER COLUMN "type" TYPE "TicketActivityType"
  USING "type"::"TicketActivityType";

CREATE UNIQUE INDEX "Project_organizationId_key_key" ON "Project"("organizationId", "key");
CREATE UNIQUE INDEX "Ticket_organizationId_key_key" ON "Ticket"("organizationId", "key");
CREATE INDEX "Ticket_organizationId_deletedAt_updatedAt_idx" ON "Ticket"("organizationId", "deletedAt", "updatedAt");
CREATE INDEX "Ticket_organizationId_projectId_status_idx" ON "Ticket"("organizationId", "projectId", "status");
CREATE INDEX "Ticket_organizationId_assigneeId_status_idx" ON "Ticket"("organizationId", "assigneeId", "status");
CREATE INDEX "Ticket_organizationId_reporterId_status_idx" ON "Ticket"("organizationId", "reporterId", "status");
CREATE INDEX "Ticket_organizationId_priority_idx" ON "Ticket"("organizationId", "priority");
CREATE INDEX "Ticket_organizationId_type_idx" ON "Ticket"("organizationId", "type");
CREATE INDEX "Ticket_organizationId_dueDate_idx" ON "Ticket"("organizationId", "dueDate");
CREATE INDEX "Ticket_organizationId_parentId_idx" ON "Ticket"("organizationId", "parentId");

ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
