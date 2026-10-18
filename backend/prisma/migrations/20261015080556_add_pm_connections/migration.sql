-- CreateEnum
CREATE TYPE "PmProvider" AS ENUM ('JIRA', 'YOUTRACK', 'LINEAR', 'ASANA');

-- CreateEnum
CREATE TYPE "PmConnStatus" AS ENUM ('ACTIVE', 'ERROR', 'DISCONNECTED');

-- CreateTable
CREATE TABLE "ProjectManagementConnection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" "PmProvider" NOT NULL,
    "providerHost" TEXT NOT NULL DEFAULT 'https://api.atlassian.com',
    "accountName" TEXT NOT NULL,
    "encryptedToken" TEXT NOT NULL,
    "cloudId" TEXT,
    "status" "PmConnStatus" NOT NULL DEFAULT 'ACTIVE',
    "connectedById" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectManagementConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectManagementConnection_organizationId_idx" ON "ProjectManagementConnection"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectManagementConnection_organizationId_provider_provide_key" ON "ProjectManagementConnection"("organizationId", "provider", "providerHost", "accountName");

-- AddForeignKey
ALTER TABLE "ProjectManagementConnection" ADD CONSTRAINT "ProjectManagementConnection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectManagementConnection" ADD CONSTRAINT "ProjectManagementConnection_connectedById_fkey" FOREIGN KEY ("connectedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
