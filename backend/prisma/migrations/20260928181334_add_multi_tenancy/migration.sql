-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('FREE', 'STARTER', 'GROWTH', 'ENTERPRISE');

-- DropIndex
DROP INDEX "Department_name_key";

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "plan" "PlanType" NOT NULL DEFAULT 'FREE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN "organizationId" TEXT;

-- AlterTable
ALTER TABLE "Department" ADD COLUMN "organizationId" TEXT;

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN "organizationId" TEXT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN "organizationId" TEXT;

-- AlterTable
ALTER TABLE "User"
  ADD COLUMN "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "organizationId" TEXT;

-- Seed a default organization for existing data
INSERT INTO "Organization" ("id", "name", "slug", "plan", "isActive", "settings", "createdAt", "updatedAt")
VALUES (
  'org_default',
  'Stride Demo Company',
  'stride-demo',
  'ENTERPRISE',
  true,
  '{"halfDayMinutes":240,"fullDayMinutes":480,"workdayStart":"09:00","workdayEnd":"18:00","timezone":"Asia/Kolkata","allowWFH":true,"requireLocation":false,"enabledRoles":["FOUNDER","CFO","MANAGER","TEAM_LEAD","EMPLOYEE"],"roleLabels":{"FOUNDER":"Founder","CFO":"CFO","MANAGER":"Manager","TEAM_LEAD":"Team Lead","EMPLOYEE":"Employee"}}',
  NOW(),
  NOW()
);

-- Associate all existing data with the default org
UPDATE "User"       SET "organizationId" = 'org_default';
UPDATE "Department" SET "organizationId" = 'org_default';
UPDATE "Project"    SET "organizationId" = 'org_default';
UPDATE "Attendance" SET "organizationId" = 'org_default';
UPDATE "Expense"    SET "organizationId" = 'org_default';

-- Set first FOUNDER user as isSuperAdmin
UPDATE "User" SET "isSuperAdmin" = true
WHERE id = (SELECT id FROM "User" WHERE role = 'FOUNDER' ORDER BY "createdAt" ASC LIMIT 1);

-- CreateIndex
CREATE INDEX "Attendance_organizationId_date_idx" ON "Attendance"("organizationId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_organizationId_key" ON "Department"("name", "organizationId");

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
