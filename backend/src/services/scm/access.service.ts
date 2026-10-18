import { IntegrationJob } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { decrypt } from "../../lib/encrypt";
import { GitHubProvider } from "./github.provider";
import { getGitLabProvider } from "./gitlab.provider";
import { IScmProvider } from "./provider.interface";

function getProvider(provider: string, host?: string): IScmProvider {
  if (provider === "GITHUB") return new GitHubProvider();
  return getGitLabProvider(host);
}

export async function processJob(job: IntegrationJob): Promise<void> {
  const payload = job.payload as any;

  if (job.operation === "GRANT_ACCESS") {
    await handleGrant(job, payload);
  } else if (job.operation === "REVOKE_ACCESS") {
    await handleRevoke(job, payload);
  } else if (job.operation === "UPDATE_PERMISSION") {
    await handleGrant(job, payload);
  } else if (job.operation === "SYNC_REPO") {
    await handleSync(job, payload);
  }
}

async function handleGrant(job: IntegrationJob, payload: any): Promise<void> {
  const grant = await prisma.repositoryAccessGrant.findUnique({ where: { id: payload.grantId }, include: { projectRepository: { include: { connection: true } }, employeeIdentity: true } });
  if (!grant) throw new Error("Grant not found");

  const conn = grant.projectRepository.connection;
  const accessToken = decrypt(conn.encryptedAccessToken);
  const provider = getProvider(conn.provider, conn.providerHost);

  if (!grant.employeeIdentity) {
    await prisma.repositoryAccessGrant.update({ where: { id: grant.id }, data: { status: "BLOCKED", lastErrorMessage: "No linked identity for this provider" } });
    return;
  }

  await prisma.repositoryAccessGrant.update({ where: { id: grant.id }, data: { status: "QUEUED", lastAttemptAt: new Date() } });

  const result = await provider.grantAccess(
    accessToken,
    grant.projectRepository.namespace,
    conn.provider === "GITLAB" ? grant.projectRepository.providerRepositoryId : grant.projectRepository.repositoryName,
    grant.employeeIdentity.username,
    grant.requestedPermission,
  );

  await prisma.repositoryAccessGrant.update({
    where: { id: grant.id },
    data: {
      status: result === "ACTIVE" ? "ACTIVE" : "INVITATION_PENDING",
      actualPermission: grant.requestedPermission,
      grantedAt: result === "ACTIVE" ? new Date() : null,
    },
  });
}

async function handleRevoke(job: IntegrationJob, payload: any): Promise<void> {
  const grant = await prisma.repositoryAccessGrant.findUnique({ where: { id: payload.grantId }, include: { projectRepository: { include: { connection: true } }, employeeIdentity: true } });
  if (!grant) return;

  const conn = grant.projectRepository.connection;
  const accessToken = decrypt(conn.encryptedAccessToken);
  const provider = getProvider(conn.provider, conn.providerHost);

  if (!grant.employeeIdentity) {
    await prisma.repositoryAccessGrant.update({ where: { id: grant.id }, data: { status: "REVOKED", revokedAt: new Date() } });
    return;
  }

  const usernameOrId = conn.provider === "GITLAB" ? grant.employeeIdentity.providerUserId : grant.employeeIdentity.username;
  await provider.revokeAccess(accessToken, grant.projectRepository.namespace, conn.provider === "GITLAB" ? grant.projectRepository.providerRepositoryId : grant.projectRepository.repositoryName, usernameOrId);

  await prisma.repositoryAccessGrant.update({ where: { id: grant.id }, data: { status: "REVOKED", revokedAt: new Date() } });
}

async function handleSync(_job: IntegrationJob, payload: any): Promise<void> {
  const repo = await prisma.projectRepository.findUnique({ where: { id: payload.repoId }, include: { connection: true, accessGrants: { include: { employeeIdentity: true } } } });
  if (!repo) return;

  await prisma.projectRepository.update({ where: { id: repo.id }, data: { lastSyncedAt: new Date() } });
}

export async function queueGrant(opts: { organizationId: string; projectRepositoryId: string; projectMemberId: string; permission: string; connectionId: string }): Promise<void> {
  const idempotencyKey = `grant:${opts.projectRepositoryId}:${opts.projectMemberId}:${opts.permission}`;

  await prisma.$transaction(async (tx) => {
    const existing = await tx.repositoryAccessGrant.findUnique({ where: { projectRepositoryId_projectMemberId: { projectRepositoryId: opts.projectRepositoryId, projectMemberId: opts.projectMemberId } } });

    let grantId: string;
    if (existing) {
      await tx.repositoryAccessGrant.update({ where: { id: existing.id }, data: { status: "QUEUED", requestedPermission: opts.permission } });
      grantId = existing.id;
    } else {
      const member = await tx.projectMember.findUnique({ where: { id: opts.projectMemberId }, include: { user: { include: { sourceIdentities: true } } } });
      const identity = member?.user.sourceIdentities?.[0];

      const grant = await tx.repositoryAccessGrant.create({
        data: {
          projectRepositoryId: opts.projectRepositoryId,
          projectMemberId: opts.projectMemberId,
          employeeIdentityId: identity?.id ?? null,
          requestedPermission: opts.permission,
          status: "QUEUED",
        },
      });
      grantId = grant.id;
    }

    await tx.integrationJob.upsert({
      where: { idempotencyKey },
      update: { status: "PENDING", nextAttemptAt: new Date() },
      create: {
        organizationId: opts.organizationId,
        connectionId: opts.connectionId,
        operation: "GRANT_ACCESS",
        entityType: "RepositoryAccessGrant",
        entityId: grantId,
        payload: { grantId },
        idempotencyKey,
      },
    });
  });
}

export async function queueRevoke(opts: { organizationId: string; projectRepositoryId: string; projectMemberId: string; connectionId: string }): Promise<void> {
  const idempotencyKey = `revoke:${opts.projectRepositoryId}:${opts.projectMemberId}`;

  await prisma.$transaction(async (tx) => {
    const grant = await tx.repositoryAccessGrant.findUnique({ where: { projectRepositoryId_projectMemberId: { projectRepositoryId: opts.projectRepositoryId, projectMemberId: opts.projectMemberId } } });
    if (!grant || grant.status === "REVOKED") return;

    await tx.repositoryAccessGrant.update({ where: { id: grant.id }, data: { status: "REVOKE_PENDING" } });

    await tx.integrationJob.upsert({
      where: { idempotencyKey },
      update: { status: "PENDING", nextAttemptAt: new Date() },
      create: {
        organizationId: opts.organizationId,
        connectionId: opts.connectionId,
        operation: "REVOKE_ACCESS",
        entityType: "RepositoryAccessGrant",
        entityId: grant.id,
        payload: { grantId: grant.id },
        idempotencyKey,
      },
    });
  });
}
