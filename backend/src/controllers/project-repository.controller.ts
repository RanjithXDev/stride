import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { decrypt } from "../lib/encrypt";
import { GitHubProvider } from "../services/scm/github.provider";
import { getGitLabProvider } from "../services/scm/gitlab.provider";
import { queueGrant, queueRevoke } from "../services/scm/access.service";

export async function listProjectRepos(req: AuthRequest, res: Response) {
  const projectId = String(req.params.id);
  const orgId = req.user!.organizationId;

  const project = await prisma.project.findFirst({ where: { id: projectId, organizationId: orgId! } });
  if (!project) return res.status(404).json({ message: "Project not found" });

  const repos = await prisma.projectRepository.findMany({
    where: { projectId },
    include: { connection: { select: { id: true, provider: true, accountName: true } } },
    orderBy: { createdAt: "asc" },
  });

  return res.json(repos);
}

export async function addProjectRepo(req: AuthRequest, res: Response) {
  const projectId = String(req.params.id);
  const orgId = req.user!.organizationId;
  const { connectionId, setupMode, providerRepositoryId, namespace, repositoryName, fullName, webUrl, defaultBranch, isPrivate, defaultPermission, createNew, repoName, repoNamespace, repoPrivate } = req.body;

  const project = await prisma.project.findFirst({ where: { id: projectId, organizationId: orgId! }, include: { members: true } });
  if (!project) return res.status(404).json({ message: "Project not found" });

  const conn = await prisma.sourceControlConnection.findFirst({ where: { id: connectionId, organizationId: orgId!, status: "ACTIVE" } });
  if (!conn) return res.status(400).json({ message: "Invalid or inactive connection" });

  let repoData: { providerRepositoryId: string; namespace: string; repositoryName: string; fullName: string; webUrl: string; defaultBranch: string; isPrivate: boolean };

  if (createNew) {
    const accessToken = decrypt(conn.encryptedAccessToken);
    const provider = conn.provider === "GITHUB" ? new GitHubProvider() : getGitLabProvider(conn.providerHost);
    const created = await provider.createRepository(accessToken, { name: repoName, namespace: repoNamespace, isPrivate: repoPrivate ?? true });
    repoData = { providerRepositoryId: created.id, namespace: created.namespace, repositoryName: created.name, fullName: created.fullName, webUrl: created.webUrl, defaultBranch: created.defaultBranch, isPrivate: created.isPrivate };
  } else {
    repoData = { providerRepositoryId, namespace, repositoryName, fullName, webUrl, defaultBranch: defaultBranch ?? "main", isPrivate: isPrivate ?? true };
  }

  // Check for duplicate
  const existing = await prisma.projectRepository.findFirst({ where: { projectId, connectionId, providerRepositoryId: repoData.providerRepositoryId } });
  if (existing) return res.status(409).json({ message: "Repository already mapped to this project" });

  const repo = await prisma.projectRepository.create({
    data: {
      projectId,
      connectionId,
      setupMode: createNew ? "CREATED" : "MAPPED",
      createdByIntegration: createNew ?? false,
      providerRepositoryId: repoData.providerRepositoryId,
      namespace: repoData.namespace,
      repositoryName: repoData.repositoryName,
      fullName: repoData.fullName,
      webUrl: repoData.webUrl,
      defaultBranch: repoData.defaultBranch,
      isPrivate: repoData.isPrivate,
      defaultPermission: defaultPermission ?? "DEVELOPER",
    },
  });

  // Queue grants for all existing project members
  const permission = defaultPermission ?? "DEVELOPER";
  for (const member of project.members) {
    await queueGrant({ organizationId: orgId!, projectRepositoryId: repo.id, projectMemberId: member.id, permission, connectionId }).catch(() => {});
  }

  return res.status(201).json(repo);
}

export async function removeProjectRepo(req: AuthRequest, res: Response) {
  const projectId = String(req.params.id);
  const repoId = String(req.params.repoId);
  const orgId = req.user!.organizationId;
  const { mode } = req.body as { mode?: "KEEP_ACCESS" | "REVOKE_ACCESS" };

  const project = await prisma.project.findFirst({ where: { id: projectId, organizationId: orgId! } });
  if (!project) return res.status(404).json({ message: "Project not found" });

  const repo = await prisma.projectRepository.findFirst({ where: { id: repoId, projectId }, include: { connection: true } });
  if (!repo) return res.status(404).json({ message: "Repository mapping not found" });

  if (mode === "REVOKE_ACCESS") {
    const grants = await prisma.repositoryAccessGrant.findMany({ where: { projectRepositoryId: repoId, status: { in: ["ACTIVE", "INVITATION_PENDING"] } } });
    for (const grant of grants) {
      await queueRevoke({ organizationId: orgId!, projectRepositoryId: repoId, projectMemberId: grant.projectMemberId, connectionId: repo.connectionId }).catch(() => {});
    }
  }

  await prisma.projectRepository.delete({ where: { id: repoId } });
  return res.json({ message: "Repository mapping removed" });
}

export async function getRepoAccessStatus(req: AuthRequest, res: Response) {
  const projectId = String(req.params.id);
  const repoId = String(req.params.repoId);
  const orgId = req.user!.organizationId;

  const project = await prisma.project.findFirst({ where: { id: projectId, organizationId: orgId! } });
  if (!project) return res.status(404).json({ message: "Project not found" });

  const grants = await prisma.repositoryAccessGrant.findMany({
    where: { projectRepositoryId: repoId, projectRepository: { projectId, project: { organizationId: orgId! } } },
    include: { employeeIdentity: { select: { username: true, email: true, avatarUrl: true } } },
    orderBy: { createdAt: "asc" },
  });

  return res.json(grants);
}

export async function syncRepo(req: AuthRequest, res: Response) {
  const projectId = String(req.params.id);
  const repoId = String(req.params.repoId);
  const orgId = req.user!.organizationId;

  const repo = await prisma.projectRepository.findFirst({ where: { id: repoId, projectId, project: { organizationId: orgId! } }, include: { connection: true } });
  if (!repo) return res.status(404).json({ message: "Repository not found" });

  await prisma.integrationJob.upsert({
    where: { idempotencyKey: `sync:${repoId}:${Date.now()}` },
    update: {},
    create: {
      organizationId: orgId!,
      connectionId: repo.connectionId,
      operation: "SYNC_REPO",
      entityType: "ProjectRepository",
      entityId: repoId,
      payload: { repoId },
      idempotencyKey: `sync:${repoId}:${Date.now()}`,
    },
  });

  return res.json({ message: "Sync job queued" });
}

export async function getProjectGitActivity(req: AuthRequest, res: Response) {
  const projectId = String(req.params.id);
  const orgId = req.user!.organizationId;

  const repos = await prisma.projectRepository.findMany({
    where: { projectId, project: { organizationId: orgId! } },
    include: { connection: true },
  });

  if (repos.length === 0) return res.json([]);

  const allEvents: any[] = [];

  await Promise.allSettled(
    repos.map(async (repo) => {
      try {
        const accessToken = decrypt(repo.connection.encryptedAccessToken);
        const provider =
          repo.connection.provider === "GITHUB"
            ? new GitHubProvider()
            : getGitLabProvider(repo.connection.providerHost ?? undefined);

        const events = await provider.getRecentActivity(
          accessToken,
          repo.namespace,
          repo.connection.provider === "GITLAB" ? repo.providerRepositoryId : repo.repositoryName,
          repo.fullName,
        );
        allEvents.push(...events);
      } catch {
        // skip repos that fail (expired token, private, etc)
      }
    }),
  );

  allEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return res.json(allEvents.slice(0, 50));
}

export async function retryGrant(req: AuthRequest, res: Response) {
  const grantId = String(req.params.grantId);
  const orgId = req.user!.organizationId;

  const grant = await prisma.repositoryAccessGrant.findFirst({
    where: { id: grantId, projectRepository: { project: { organizationId: orgId! } } },
    include: { projectRepository: true },
  });
  if (!grant) return res.status(404).json({ message: "Grant not found" });

  const idempotencyKey = `retry-grant:${grantId}:${Date.now()}`;
  await prisma.integrationJob.create({
    data: {
      organizationId: orgId!,
      connectionId: grant.projectRepository.connectionId,
      operation: "GRANT_ACCESS",
      entityType: "RepositoryAccessGrant",
      entityId: grantId,
      payload: { grantId },
      idempotencyKey,
      status: "PENDING",
    },
  });

  await prisma.repositoryAccessGrant.update({ where: { id: grantId }, data: { status: "QUEUED" } });
  return res.json({ message: "Retry queued" });
}
