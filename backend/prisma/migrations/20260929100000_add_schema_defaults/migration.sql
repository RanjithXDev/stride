-- Add @default(cuid()) equivalents for String @id fields that lacked them.
-- In PostgreSQL these fields already exist; we just add DEFAULT gen_random_uuid() as a fallback.
-- Prisma client will use its own cuid() generation; DB default is a safety net.

ALTER TABLE "ProjectMember"   ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "Ticket"          ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "TicketActivity"  ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "TicketComment"   ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "TicketLink"      ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "TimeLog"         ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- Add @updatedAt behaviour at DB level for Ticket and TicketComment
-- (Prisma's @updatedAt sets this via client; the column already exists)
-- No DDL needed — Prisma handles @updatedAt in the client layer only.
