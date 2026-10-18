-- CreateEnum
CREATE TYPE "ScmRepoSyncStatus" AS ENUM ('PENDING', 'SYNCED', 'ERROR');

-- CreateEnum
CREATE TYPE "ScmEventType" AS ENUM ('PUSH', 'PULL_REQUEST', 'MERGE_REQUEST', 'CI_RUN', 'PIPELINE');

-- CreateTable
CREATE TABLE "ScmRepo" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "namespace" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "webUrl" TEXT NOT NULL,
    "defaultBranch" TEXT NOT NULL DEFAULT 'main',
    "isPrivate" BOOLEAN NOT NULL DEFAULT true,
    "isTracked" BOOLEAN NOT NULL DEFAULT true,
    "syncStatus" "ScmRepoSyncStatus" NOT NULL DEFAULT 'PENDING',
    "lastSyncedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScmRepo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScmWebhook" (
    "id" TEXT NOT NULL,
    "repoId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "hookId" TEXT NOT NULL,
    "secretEnc" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastDeliveryAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScmWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScmEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "repoId" TEXT NOT NULL,
    "type" "ScmEventType" NOT NULL,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScmEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScmRepo_organizationId_isTracked_idx" ON "ScmRepo"("organizationId", "isTracked");

-- CreateIndex
CREATE UNIQUE INDEX "ScmRepo_connectionId_externalId_key" ON "ScmRepo"("connectionId", "externalId");

-- CreateIndex
CREATE INDEX "ScmWebhook_organizationId_idx" ON "ScmWebhook"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ScmWebhook_repoId_key" ON "ScmWebhook"("repoId");

-- CreateIndex
CREATE INDEX "ScmEvent_organizationId_type_idx" ON "ScmEvent"("organizationId", "type");

-- CreateIndex
CREATE INDEX "ScmEvent_repoId_createdAt_idx" ON "ScmEvent"("repoId", "createdAt");

-- AddForeignKey
ALTER TABLE "ScmRepo" ADD CONSTRAINT "ScmRepo_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScmRepo" ADD CONSTRAINT "ScmRepo_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "SourceControlConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScmWebhook" ADD CONSTRAINT "ScmWebhook_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "ScmRepo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScmEvent" ADD CONSTRAINT "ScmEvent_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "ScmRepo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
