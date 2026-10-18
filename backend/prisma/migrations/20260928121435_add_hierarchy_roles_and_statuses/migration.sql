-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AttendanceStatus" ADD VALUE 'WFH';
ALTER TYPE "AttendanceStatus" ADD VALUE 'LEAVE';

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'TEAM_LEAD';

-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "workMode" TEXT DEFAULT 'OFFICE';
