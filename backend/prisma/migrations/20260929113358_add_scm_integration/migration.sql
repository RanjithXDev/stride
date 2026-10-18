-- CreateEnum
CREATE TYPE "ScmProvider" AS ENUM ('GITHUB', 'GITLAB');

-- CreateEnum
CREATE TYPE "ScmConnStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED', 'ERROR');

-- CreateEnum
CREATE TYPE "RepoSetupMode" AS ENUM ('CREATED', 'MAPPED');

-- CreateEnum
CREATE TYPE "AccessGrantStatus" AS ENUM ('QUEUED', 'INVITATION_PENDING', 'ACTIVE', 'UPDATE_PENDING', 'REVOKE_PENDING', 'REVOKED', 'FAILED', 'BLOCKED', 'EXTERNALLY_MANAGED');

-- CreateEnum
CREATE TYPE "IntegrationJobStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED', 'DEAD');

-- CreateEnum
CREATE TYPE "IntegrationJobOp" AS ENUM ('GRANT_ACCESS', 'REVOKE_ACCESS', 'UPDATE_PERMISSION', 'SYNC_REPO', 'CREATE_REPO');

-- AlterTable
ALTER TABLE "ProjectMember" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Ticket" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TicketActivity" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TicketComment" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TicketLink" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TimeLog" ALTER COLUMN "id" DROP DEFAULT;

-- CreateTable
CREATE TABLE "SourceControlConnection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" "ScmProvider" NOT NULL,
    "providerHost" TEXT NOT NULL DEFAULT 'https://github.com',
    "externalAccountId" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "encryptedAccessToken" TEXT NOT NULL,
    "encryptedRefreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "status" "ScmConnStatus" NOT NULL DEFAULT 'ACTIVE',
    "connectedById" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceControlConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeSourceIdentity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "avatarUrl" TEXT,
    "verificationStatus" TEXT NOT NULL DEFAULT 'VERIFIED',
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeSourceIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectRepository" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "setupMode" "RepoSetupMode" NOT NULL DEFAULT 'MAPPED',
    "setupStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "providerRepositoryId" TEXT NOT NULL,
    "namespace" TEXT NOT NULL,
    "repositoryName" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "webUrl" TEXT NOT NULL,
    "defaultBranch" TEXT NOT NULL DEFAULT 'main',
    "isPrivate" BOOLEAN NOT NULL DEFAULT true,
    "defaultPermission" TEXT NOT NULL DEFAULT 'DEVELOPER',
    "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdByIntegration" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectRepository_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepositoryAccessGrant" (
    "id" TEXT NOT NULL,
    "projectRepositoryId" TEXT NOT NULL,
    "projectMemberId" TEXT NOT NULL,
    "employeeIdentityId" TEXT,
    "externalUserId" TEXT,
    "requestedPermission" TEXT NOT NULL,
    "actualPermission" TEXT,
    "status" "AccessGrantStatus" NOT NULL DEFAULT 'QUEUED',
    "managedByApp" BOOLEAN NOT NULL DEFAULT true,
    "externalInvitationId" TEXT,
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "lastAttemptAt" TIMESTAMP(3),
    "grantedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepositoryAccessGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationJob" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "connectionId" TEXT,
    "operation" "IntegrationJobOp" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "IntegrationJobStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotencyKey" TEXT NOT NULL,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SourceControlConnection_organizationId_provider_providerHos_key" ON "SourceControlConnection"("organizationId", "provider", "providerHost", "externalAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeSourceIdentity_userId_connectionId_key" ON "EmployeeSourceIdentity"("userId", "connectionId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectRepository_connectionId_providerRepositoryId_key" ON "ProjectRepository"("connectionId", "providerRepositoryId");

-- CreateIndex
CREATE UNIQUE INDEX "RepositoryAccessGrant_projectRepositoryId_projectMemberId_key" ON "RepositoryAccessGrant"("projectRepositoryId", "projectMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationJob_idempotencyKey_key" ON "IntegrationJob"("idempotencyKey");

-- AddForeignKey
ALTER TABLE "SourceControlConnection" ADD CONSTRAINT "SourceControlConnection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceControlConnection" ADD CONSTRAINT "SourceControlConnection_connectedById_fkey" FOREIGN KEY ("connectedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSourceIdentity" ADD CONSTRAINT "EmployeeSourceIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSourceIdentity" ADD CONSTRAINT "EmployeeSourceIdentity_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "SourceControlConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRepository" ADD CONSTRAINT "ProjectRepository_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRepository" ADD CONSTRAINT "ProjectRepository_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "SourceControlConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepositoryAccessGrant" ADD CONSTRAINT "RepositoryAccessGrant_projectRepositoryId_fkey" FOREIGN KEY ("projectRepositoryId") REFERENCES "ProjectRepository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepositoryAccessGrant" ADD CONSTRAINT "RepositoryAccessGrant_employeeIdentityId_fkey" FOREIGN KEY ("employeeIdentityId") REFERENCES "EmployeeSourceIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationJob" ADD CONSTRAINT "IntegrationJob_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "SourceControlConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
