import crypto from "crypto";
import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { decrypt, encrypt } from "../lib/encrypt";
import { GitHubProvider } from "../services/scm/github.provider";
import { getGitLabProvider } from "../services/scm/gitlab.provider";
import { GitActivityEvent } from "../services/scm/provider.interface";
import { Role } from "@prisma/client";

const SCM_READ_ROLES: Role[] = [Role.FOUNDER, Role.CPO, Role.CFO, Role.MANAGER, Role.TEAM_LEAD];
const SCM_WRITE_ROLES: Role[] = [Role.FOUNDER, Role.MANAGER];

function canRead(role: Role) { return SCM_READ_ROLES.includes(role); }
function canWrite(role: Role) { return SCM_WRITE_ROLES.includes(role); }
// Express 5 types params as string | string[]; this helper normalises to string
function param(req: AuthRequest, key: string): string { return String(Array.isArray(req.params[key]) ? req.params[key][0] : req.params[key]); }

async function getAccessToken(conn: {
  id: string; provider: string; providerHost: string;
  encryptedAccessToken: string; encryptedRefreshToken: string | null;
  tokenExpiresAt: Date | null;
}): Promise<string> {
  if (conn.provider === "GITLAB" && conn.tokenExpiresAt && conn.tokenExpiresAt < new Date() && conn.encryptedRefreshToken) {
    const provider = getGitLabProvider(conn.providerHost);
    const tokens = await provider.refreshToken(decrypt(conn.encryptedRefreshToken));
    await prisma.sourceControlConnection.update({
      where: { id: conn.id },
      data: {
        encryptedAccessToken: encrypt(tokens.accessToken),
        encryptedRefreshToken: tokens.refreshToken ? encrypt(tokens.refreshToken) : undefined,
        tokenExpiresAt: tokens.expiresAt,
      },
    });
    return tokens.accessToken;
  }
  return decrypt(conn.encryptedAccessToken);
}

// GET /scm/repos — all tracked repos for the org
export async function listScmRepos(req: AuthRequest, res: Response) {
  const { role, organizationId } = req.user!;
  if (!canRead(role)) return res.status(403).json({ message: "Insufficient permissions" });

  const repos = await prisma.scmRepo.findMany({
    where: { organizationId: organizationId!, isTracked: true },
    include: { connection: { select: { provider: true, providerHost: true, accountName: true, status: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return res.json({ repos });
}

// POST /scm/repos/track — discover repos from a connection and mark selected ones as tracked
export async function trackRepos(req: AuthRequest, res: Response) {
  const { role, organizationId } = req.user!;
  if (!canWrite(role)) return res.status(403).json({ message: "Insufficient permissions" });

  const { connectionId, repoIds } = req.body as { connectionId: string; repoIds: string[] };
  if (!connectionId || !Array.isArray(repoIds) || repoIds.length === 0) {
    return res.status(400).json({ message: "connectionId and repoIds[] are required" });
  }

  const conn = await prisma.sourceControlConnection.findFirst({
    where: { id: connectionId, organizationId: organizationId!, status: "ACTIVE" },
  });
  if (!conn) return res.status(404).json({ message: "Connection not found or inactive" });

  const accessToken = await getAccessToken(conn);
  const provider = conn.provider === "GITHUB" ? new GitHubProvider() : getGitLabProvider(conn.providerHost);
  const allRepos = await provider.listRepositories(accessToken);

  const selectedRepos = allRepos.filter((r) => repoIds.includes(r.id));
  if (selectedRepos.length === 0) return res.status(400).json({ message: "No matching repos found" });

  const upserted = await Promise.all(
    selectedRepos.map((r) =>
      prisma.scmRepo.upsert({
        where: { connectionId_externalId: { connectionId, externalId: r.id } },
        update: {
          namespace: r.namespace,
          name: r.name,
          fullName: r.fullName,
          webUrl: r.webUrl,
          defaultBranch: r.defaultBranch,
          isPrivate: r.isPrivate,
          isTracked: true,
          syncStatus: "SYNCED",
          lastSyncedAt: new Date(),
        },
        create: {
          organizationId: organizationId!,
          connectionId,
          externalId: r.id,
          namespace: r.namespace,
          name: r.name,
          fullName: r.fullName,
          webUrl: r.webUrl,
          defaultBranch: r.defaultBranch,
          isPrivate: r.isPrivate,
          isTracked: true,
          syncStatus: "SYNCED",
          lastSyncedAt: new Date(),
        },
      })
    )
  );

  return res.json({ tracked: upserted.length, repos: upserted });
}

// DELETE /scm/repos/:id/untrack — stop tracking a repo (soft)
export async function untrackRepo(req: AuthRequest, res: Response) {
  const { role, organizationId } = req.user!;
  if (!canWrite(role)) return res.status(403).json({ message: "Insufficient permissions" });

  const repo = await prisma.scmRepo.findFirst({ where: { id: param(req, "id"), organizationId: organizationId! } });
  if (!repo) return res.status(404).json({ message: "Repo not found" });

  await prisma.scmRepo.update({ where: { id: repo.id }, data: { isTracked: false } });
  return res.json({ message: "Repo untracked" });
}

// GET /scm/repos/:id — single repo with connection info
export async function getScmRepo(req: AuthRequest, res: Response) {
  const { role, organizationId } = req.user!;
  if (!canRead(role)) return res.status(403).json({ message: "Insufficient permissions" });

  const repo = await prisma.scmRepo.findFirst({
    where: { id: param(req, "id"), organizationId: organizationId!, isTracked: true },
    include: {
      connection: { select: { provider: true, providerHost: true, accountName: true, status: true } },
      webhooks: { select: { id: true, active: true, lastDeliveryAt: true, lastError: true } },
    },
  });
  if (!repo) return res.status(404).json({ message: "Repo not found" });

  return res.json(repo);
}

// GET /scm/repos/:id/branches — list all branches for a tracked repo
export async function listRepoBranches(req: AuthRequest, res: Response) {
  const { role, organizationId } = req.user!;
  if (!canRead(role)) return res.status(403).json({ message: "Insufficient permissions" });

  const repo = await prisma.scmRepo.findFirst({
    where: { id: param(req, "id"), organizationId: organizationId!, isTracked: true },
    include: { connection: true },
  });
  if (!repo) return res.status(404).json({ message: "Repo not found" });

  try {
    const accessToken = await getAccessToken(repo.connection);
    const provider = repo.connection.provider === "GITHUB"
      ? new GitHubProvider()
      : getGitLabProvider(repo.connection.providerHost);
    const [owner, repoName] = repo.fullName.split("/");
    const branches = await provider.listBranches(accessToken, owner, repoName);
    return res.json({ branches, defaultBranch: repo.defaultBranch });
  } catch (err: any) {
    return res.status(502).json({ message: err.message ?? "Failed to fetch branches" });
  }
}

// GET /scm/repos/:id/activity?branch=&type=&limit= — activity for a single repo with branch filter
export async function getRepoActivity(req: AuthRequest, res: Response) {
  const { role, organizationId } = req.user!;
  if (!canRead(role)) return res.status(403).json({ message: "Insufficient permissions" });

  const repo = await prisma.scmRepo.findFirst({
    where: { id: param(req, "id"), organizationId: organizationId!, isTracked: true },
    include: { connection: true },
  });
  if (!repo) return res.status(404).json({ message: "Repo not found" });

  const { branch, type, limit: limitStr } = req.query as Record<string, string>;
  const limit = Math.min(parseInt(limitStr ?? "30", 10), 100);

  try {
    const accessToken = await getAccessToken(repo.connection);
    const provider = repo.connection.provider === "GITHUB"
      ? new GitHubProvider()
      : getGitLabProvider(repo.connection.providerHost);
    const [owner, repoName] = repo.fullName.split("/");
    let events = await provider.getRecentActivity(accessToken, owner, repoName, repo.fullName, branch);
    if (type) events = events.filter((e) => e.type === type.toUpperCase());
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return res.json({ events: events.slice(0, limit), total: events.length, branch: branch ?? repo.defaultBranch });
  } catch (err: any) {
    return res.status(502).json({ message: err.message ?? "Failed to fetch activity" });
  }
}

// GET /scm/connections/:id/available-repos — repos from provider not yet tracked
export async function listAvailableRepos(req: AuthRequest, res: Response) {
  const { role, organizationId } = req.user!;
  if (!canRead(role)) return res.status(403).json({ message: "Insufficient permissions" });

  const conn = await prisma.sourceControlConnection.findFirst({
    where: { id: param(req, "id"), organizationId: organizationId!, status: "ACTIVE" },
  });
  if (!conn) return res.status(404).json({ message: "Connection not found or inactive" });

  const accessToken = await getAccessToken(conn);
  const provider = conn.provider === "GITHUB" ? new GitHubProvider() : getGitLabProvider(conn.providerHost);
  const allRepos = await provider.listRepositories(accessToken);

  const tracked = await prisma.scmRepo.findMany({
    where: { connectionId: conn.id, isTracked: true },
    select: { externalId: true },
  });
  const trackedIds = new Set(tracked.map((r) => r.externalId));

  return res.json({
    available: allRepos.filter((r) => !trackedIds.has(r.id)),
    tracked: allRepos.filter((r) => trackedIds.has(r.id)),
  });
}

// GET /scm/activity — unified activity feed across all tracked repos
export async function getActivity(req: AuthRequest, res: Response) {
  const { role, organizationId } = req.user!;
  if (!canRead(role)) return res.status(403).json({ message: "Insufficient permissions" });

  const { repoId, type, limit: limitStr } = req.query as Record<string, string>;
  const limit = Math.min(parseInt(limitStr ?? "50", 10), 100);

  const repoFilter = repoId ? { id: repoId } : {};
  const trackedRepos = await prisma.scmRepo.findMany({
    where: { organizationId: organizationId!, isTracked: true, ...repoFilter },
    include: { connection: true },
  });

  if (trackedRepos.length === 0) return res.json({ events: [], total: 0 });

  const results = await Promise.allSettled(
    trackedRepos.map(async (repo) => {
      const conn = repo.connection;
      try {
        const accessToken = await getAccessToken(conn);
        const provider = conn.provider === "GITHUB"
          ? new GitHubProvider()
          : getGitLabProvider(conn.providerHost);
        const [owner, repoName] = repo.fullName.split("/");
        return await provider.getRecentActivity(accessToken, owner, repoName, repo.fullName);
      } catch {
        return [] as GitActivityEvent[];
      }
    })
  );

  let events: GitActivityEvent[] = results
    .filter((r): r is PromiseFulfilledResult<GitActivityEvent[]> => r.status === "fulfilled")
    .flatMap((r) => r.value);

  if (type) events = events.filter((e) => e.type === type.toUpperCase());

  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const sliced = events.slice(0, limit);

  return res.json({ events: sliced, total: events.length });
}

// GET /scm/prs — open pull requests across all tracked repos
export async function getPullRequests(req: AuthRequest, res: Response) {
  const { role, organizationId } = req.user!;
  if (!canRead(role)) return res.status(403).json({ message: "Insufficient permissions" });

  const { repoId, status: statusFilter, author } = req.query as Record<string, string>;
  const repoFilter = repoId ? { id: repoId } : {};

  const trackedRepos = await prisma.scmRepo.findMany({
    where: { organizationId: organizationId!, isTracked: true, ...repoFilter },
    include: { connection: true },
  });

  if (trackedRepos.length === 0) return res.json({ prs: [], total: 0 });

  const results = await Promise.allSettled(
    trackedRepos.map(async (repo) => {
      const conn = repo.connection;
      try {
        const accessToken = await getAccessToken(conn);
        const provider = conn.provider === "GITHUB"
          ? new GitHubProvider()
          : getGitLabProvider(conn.providerHost);
        const [owner, repoName] = repo.fullName.split("/");
        const all = await provider.getRecentActivity(accessToken, owner, repoName, repo.fullName);
        return all
          .filter((e) => e.type === "PULL_REQUEST" || e.type === "MERGE_REQUEST")
          .map((e) => ({ ...e, repoId: repo.id }));
      } catch {
        return [];
      }
    })
  );

  let prs = results
    .filter((r): r is PromiseFulfilledResult<(GitActivityEvent & { repoId: string })[]> => r.status === "fulfilled")
    .flatMap((r) => r.value);

  if (statusFilter) prs = prs.filter((p) => p.status === statusFilter);
  if (author) prs = prs.filter((p) => p.author.toLowerCase().includes(author.toLowerCase()));

  prs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return res.json({ prs, total: prs.length });
}

// GET /scm/pipelines — latest CI run per tracked repo
export async function getPipelines(req: AuthRequest, res: Response) {
  const { role, organizationId } = req.user!;
  if (!canRead(role)) return res.status(403).json({ message: "Insufficient permissions" });

  const trackedRepos = await prisma.scmRepo.findMany({
    where: { organizationId: organizationId!, isTracked: true },
    include: { connection: true },
  });

  if (trackedRepos.length === 0) return res.json({ pipelines: [], summary: { passing: 0, failing: 0, running: 0, total: 0 } });

  const results = await Promise.allSettled(
    trackedRepos.map(async (repo) => {
      const conn = repo.connection;
      try {
        const accessToken = await getAccessToken(conn);
        const provider = conn.provider === "GITHUB"
          ? new GitHubProvider()
          : getGitLabProvider(conn.providerHost);
        const [owner, repoName] = repo.fullName.split("/");
        const all = await provider.getRecentActivity(accessToken, owner, repoName, repo.fullName);
        const ciRuns = all.filter((e) => e.type === "CI_RUN" || e.type === "PIPELINE");
        const latest = ciRuns[0] ?? null;
        return { repo: { id: repo.id, name: repo.name, fullName: repo.fullName, webUrl: repo.webUrl, provider: conn.provider }, latest };
      } catch {
        return { repo: { id: repo.id, name: repo.name, fullName: repo.fullName, webUrl: repo.webUrl, provider: conn.provider }, latest: null };
      }
    })
  );

  const pipelines = results
    .filter((r) => r.status === "fulfilled")
    .map((r) => (r as PromiseFulfilledResult<{ repo: any; latest: GitActivityEvent | null }>).value);

  const summary = {
    passing: pipelines.filter((p) => p.latest?.status === "success").length,
    failing: pipelines.filter((p) => p.latest?.status === "failure").length,
    running: pipelines.filter((p) => p.latest?.status === "running").length,
    total: pipelines.length,
  };

  return res.json({ pipelines, summary });
}

// GET /scm/stats — contributor commit/PR stats
export async function getStats(req: AuthRequest, res: Response) {
  const { role, organizationId } = req.user!;
  if (!canRead(role)) return res.status(403).json({ message: "Insufficient permissions" });

  const trackedRepos = await prisma.scmRepo.findMany({
    where: { organizationId: organizationId!, isTracked: true },
    include: { connection: true },
  });

  if (trackedRepos.length === 0) {
    return res.json({ contributors: [], repoCount: 0, totalCommits: 0, totalPRs: 0, openPRs: 0 });
  }

  const results = await Promise.allSettled(
    trackedRepos.map(async (repo) => {
      const conn = repo.connection;
      const accessToken = await getAccessToken(conn);
      const provider = conn.provider === "GITHUB" ? new GitHubProvider() : getGitLabProvider(conn.providerHost);
      const [owner, repoName] = repo.fullName.split("/");
      return provider.getRecentActivity(accessToken, owner, repoName, repo.fullName);
    })
  );

  const allEvents: GitActivityEvent[] = results
    .filter((r): r is PromiseFulfilledResult<GitActivityEvent[]> => r.status === "fulfilled")
    .flatMap((r) => r.value);

  // Aggregate commits per author
  const commitMap = new Map<string, { author: string; avatar?: string; commits: number; prs: number }>();
  for (const event of allEvents) {
    const key = event.author;
    if (!commitMap.has(key)) commitMap.set(key, { author: event.author, avatar: event.authorAvatar, commits: 0, prs: 0 });
    const entry = commitMap.get(key)!;
    if (event.type === "COMMIT") entry.commits++;
    if (event.type === "PULL_REQUEST" || event.type === "MERGE_REQUEST") entry.prs++;
  }

  const contributors = Array.from(commitMap.values())
    .sort((a, b) => b.commits + b.prs - (a.commits + a.prs))
    .slice(0, 20);

  const commits = allEvents.filter((e) => e.type === "COMMIT");
  const prs = allEvents.filter((e) => e.type === "PULL_REQUEST" || e.type === "MERGE_REQUEST");
  const openPRs = prs.filter((p) => p.status === "open" || p.status === "draft");

  return res.json({
    contributors,
    repoCount: trackedRepos.length,
    totalCommits: commits.length,
    totalPRs: prs.length,
    openPRs: openPRs.length,
  });
}

// POST /scm/repos/:id/register-webhook
export async function registerWebhook(req: AuthRequest, res: Response) {
  const { role, organizationId } = req.user!;
  if (!canWrite(role)) return res.status(403).json({ message: "Insufficient permissions" });

  const repo = await prisma.scmRepo.findFirst({
    where: { id: param(req, "id"), organizationId: organizationId! },
    include: { connection: true, webhooks: true },
  });
  if (!repo) return res.status(404).json({ message: "Repo not found" });

  const existing = repo.webhooks.find((w) => w.active);
  if (existing) return res.status(409).json({ message: "Webhook already active", hookId: existing.hookId });

  const secret = crypto.randomBytes(32).toString("hex");
  const backendUrl = process.env.BACKEND_URL ?? "http://localhost:4000";
  const provider = repo.connection.provider === "GITHUB" ? "github" : "gitlab";
  const webhookUrl = `${backendUrl}/api/v1/scm/webhooks/${provider}`;

  const accessToken = await getAccessToken(repo.connection);
  const providerInstance = repo.connection.provider === "GITHUB"
    ? new GitHubProvider()
    : getGitLabProvider(repo.connection.providerHost);

  const owner = repo.namespace;
  const repoArg = repo.connection.provider === "GITHUB" ? repo.name : repo.externalId;
  const hookId = await providerInstance.registerWebhook(accessToken, owner, repoArg, webhookUrl, secret);

  await prisma.scmWebhook.upsert({
    where: { repoId: repo.id },
    update: { hookId, secretEnc: encrypt(secret), active: true, lastError: null },
    create: { repoId: repo.id, organizationId: organizationId!, hookId, secretEnc: encrypt(secret), active: true },
  });
  await prisma.scmRepo.update({ where: { id: repo.id }, data: { syncStatus: "SYNCED", lastSyncedAt: new Date() } });

  return res.json({ message: "Webhook registered", hookId });
}

// DELETE /scm/repos/:id/webhook
export async function deleteWebhook(req: AuthRequest, res: Response) {
  const { role, organizationId } = req.user!;
  if (!canWrite(role)) return res.status(403).json({ message: "Insufficient permissions" });

  const repo = await prisma.scmRepo.findFirst({
    where: { id: param(req, "id"), organizationId: organizationId! },
    include: { connection: true, webhooks: true },
  });
  if (!repo) return res.status(404).json({ message: "Repo not found" });

  const webhook = repo.webhooks[0];
  if (!webhook) return res.status(404).json({ message: "No webhook registered" });

  try {
    const accessToken = await getAccessToken(repo.connection);
    const providerInstance = repo.connection.provider === "GITHUB"
      ? new GitHubProvider()
      : getGitLabProvider(repo.connection.providerHost);
    const repoArg = repo.connection.provider === "GITHUB" ? repo.name : repo.externalId;
    await providerInstance.deleteWebhook(accessToken, repo.namespace, repoArg, webhook.hookId);
  } catch (err: any) {
    console.warn("[SCM] deleteWebhook provider call failed (removing record anyway):", err?.message);
  }

  await prisma.scmWebhook.delete({ where: { id: webhook.id } });
  return res.json({ message: "Webhook removed" });
}

// GET /scm/repos/:id/members
export async function listRepoMembers(req: AuthRequest, res: Response) {
  const { role, organizationId } = req.user!;
  if (!canRead(role)) return res.status(403).json({ message: "Insufficient permissions" });

  const repo = await prisma.scmRepo.findFirst({
    where: { id: param(req, "id"), organizationId: organizationId!, isTracked: true },
    include: { connection: { select: { id: true, provider: true, providerHost: true, accountName: true } } },
  });
  if (!repo) return res.status(404).json({ message: "Repo not found" });

  const projectRepo = await prisma.projectRepository.findFirst({
    where: { connectionId: repo.connectionId, providerRepositoryId: repo.externalId },
  });

  const users = await prisma.user.findMany({
    where: { organizationId: organizationId!, isActive: true },
    select: { id: true, name: true, email: true, role: true, avatar: true },
  });

  const grants = projectRepo
    ? await prisma.repositoryAccessGrant.findMany({
        where: { projectRepositoryId: projectRepo.id },
        include: { employeeIdentity: { select: { id: true, username: true, providerUserId: true } } },
      })
    : [];

  const identities = await prisma.employeeSourceIdentity.findMany({
    where: { connectionId: repo.connectionId },
    select: { userId: true, id: true, username: true, providerUserId: true },
  });

  const identityByUser = new Map(identities.map((i) => [i.userId, i]));
  const grantByMember = new Map(grants.map((g) => [g.projectMemberId, g]));

  let memberIdByUserId = new Map<string, string>();
  if (projectRepo) {
    const projectMembers = await prisma.projectMember.findMany({
      where: { projectId: projectRepo.projectId },
      select: { id: true, userId: true },
    });
    memberIdByUserId = new Map(projectMembers.map((m) => [m.userId, m.id]));
  }

  const members = users.map((u) => {
    const memberId = memberIdByUserId.get(u.id);
    const grant = memberId ? (grantByMember.get(memberId) ?? null) : null;
    const identity = identityByUser.get(u.id) ?? null;
    return { user: u, grant, identity };
  });

  return res.json({ repo, members, projectRepoId: projectRepo?.id ?? null });
}

// POST /scm/repos/:id/grant-access
export async function grantRepoAccess(req: AuthRequest, res: Response) {
  const { role, organizationId } = req.user!;
  if (!canWrite(role)) return res.status(403).json({ message: "Insufficient permissions" });

  const { userId, permission } = req.body as { userId: string; permission: string };
  if (!userId || !permission) return res.status(400).json({ message: "userId and permission required" });

  const repo = await prisma.scmRepo.findFirst({
    where: { id: param(req, "id"), organizationId: organizationId!, isTracked: true },
    include: { connection: true },
  });
  if (!repo) return res.status(404).json({ message: "Repo not found" });

  const identity = await prisma.employeeSourceIdentity.findFirst({
    where: { userId, connectionId: repo.connectionId },
  });
  if (!identity) return res.status(400).json({ message: "User has not linked their SCM identity for this connection" });

  let projectRepo = await prisma.projectRepository.findFirst({
    where: { connectionId: repo.connectionId, providerRepositoryId: repo.externalId },
  });

  if (!projectRepo) {
    let project = await prisma.project.findFirst({ where: { organizationId: organizationId!, status: "ACTIVE" } });
    if (!project) {
      project = await prisma.project.create({
        data: { name: "SCM Repositories", organizationId: organizationId!, status: "ACTIVE", createdById: req.user!.id },
      });
    }
    projectRepo = await prisma.projectRepository.create({
      data: {
        projectId: project.id, connectionId: repo.connectionId,
        setupMode: "MAPPED", providerRepositoryId: repo.externalId,
        namespace: repo.namespace, repositoryName: repo.name,
        fullName: repo.fullName, webUrl: repo.webUrl,
        defaultBranch: repo.defaultBranch, isPrivate: repo.isPrivate,
        defaultPermission: permission,
      },
    });
  }

  let projectMember = await prisma.projectMember.findFirst({
    where: { projectId: projectRepo.projectId, userId },
  });
  if (!projectMember) {
    projectMember = await prisma.projectMember.create({
      data: { projectId: projectRepo.projectId, userId, role: "MEMBER" },
    });
  }

  const existing = await prisma.repositoryAccessGrant.findFirst({
    where: { projectRepositoryId: projectRepo.id, projectMemberId: projectMember.id },
  });

  let grant;
  if (existing) {
    grant = await prisma.repositoryAccessGrant.update({
      where: { id: existing.id },
      data: { requestedPermission: permission, status: "QUEUED", lastAttemptAt: null },
    });
  } else {
    grant = await prisma.repositoryAccessGrant.create({
      data: {
        projectRepositoryId: projectRepo.id,
        projectMemberId: projectMember.id,
        employeeIdentityId: identity.id,
        requestedPermission: permission,
        status: "QUEUED",
      },
    });
  }

  const idempotencyKey = `grant-${grant.id}-${Date.now()}`;
  await prisma.integrationJob.create({
    data: {
      organizationId: organizationId!,
      connectionId: repo.connectionId,
      operation: "GRANT_ACCESS",
      entityType: "RepositoryAccessGrant",
      entityId: grant.id,
      payload: { grantId: grant.id },
      idempotencyKey,
    },
  });

  return res.json({ message: "Access queued", grantId: grant.id });
}

// DELETE /scm/repos/:id/revoke-access/:userId
export async function revokeRepoAccess(req: AuthRequest, res: Response) {
  const { role, organizationId } = req.user!;
  if (!canWrite(role)) return res.status(403).json({ message: "Insufficient permissions" });

  const repo = await prisma.scmRepo.findFirst({
    where: { id: param(req, "id"), organizationId: organizationId! },
    include: { connection: true },
  });
  if (!repo) return res.status(404).json({ message: "Repo not found" });

  const projectRepo = await prisma.projectRepository.findFirst({
    where: { connectionId: repo.connectionId, providerRepositoryId: repo.externalId },
  });
  if (!projectRepo) return res.status(404).json({ message: "No access grants for this repo" });

  const projectMember = await prisma.projectMember.findFirst({
    where: { projectId: projectRepo.projectId, userId: param(req, "userId") },
  });
  if (!projectMember) return res.status(404).json({ message: "No grant found for this user" });

  const grant = await prisma.repositoryAccessGrant.findFirst({
    where: { projectRepositoryId: projectRepo.id, projectMemberId: projectMember.id },
  });
  if (!grant) return res.status(404).json({ message: "Grant not found" });

  await prisma.repositoryAccessGrant.update({ where: { id: grant.id }, data: { status: "REVOKE_PENDING" } });

  const idempotencyKey = `revoke-${grant.id}-${Date.now()}`;
  await prisma.integrationJob.create({
    data: {
      organizationId: organizationId!,
      connectionId: repo.connectionId,
      operation: "REVOKE_ACCESS",
      entityType: "RepositoryAccessGrant",
      entityId: grant.id,
      payload: { grantId: grant.id },
      idempotencyKey,
    },
  });

  return res.json({ message: "Revoke queued" });
}

// GET /scm/analytics
export async function getAnalytics(req: AuthRequest, res: Response) {
  const { role, organizationId } = req.user!;
  if (!canRead(role)) return res.status(403).json({ message: "Insufficient permissions" });

  const trackedRepos = await prisma.scmRepo.findMany({
    where: { organizationId: organizationId!, isTracked: true },
    include: { connection: true },
  });

  if (trackedRepos.length === 0) {
    return res.json({ contributors: [], byRepo: [], totalCommits: 0, totalPRs: 0, openPRs: 0, avgPRAgeDays: 0 });
  }

  const repoResults = await Promise.allSettled(
    trackedRepos.map(async (repo) => {
      const conn = repo.connection;
      const accessToken = await getAccessToken(conn);
      const provider = conn.provider === "GITHUB" ? new GitHubProvider() : getGitLabProvider(conn.providerHost);
      const [owner, repoName] = repo.fullName.split("/");
      const events = await provider.getRecentActivity(accessToken, owner, repoName, repo.fullName);
      return { repo, events };
    })
  );

  const allData = repoResults
    .filter((r): r is PromiseFulfilledResult<{ repo: typeof trackedRepos[0]; events: GitActivityEvent[] }> => r.status === "fulfilled")
    .map((r) => r.value);

  const authorMap = new Map<string, { author: string; avatar?: string; commits: number; prsOpened: number; prsMerged: number }>();
  const repoMap = new Map<string, { repoId: string; fullName: string; commits: number; prsOpen: number; prsTotal: number }>();

  let totalCommits = 0, totalPRs = 0, openPRs = 0;
  const prAges: number[] = [];

  for (const { repo, events } of allData) {
    const repoStats = { repoId: repo.id, fullName: repo.fullName, commits: 0, prsOpen: 0, prsTotal: 0 };
    for (const e of events) {
      const key = e.author;
      if (!authorMap.has(key)) authorMap.set(key, { author: e.author, avatar: e.authorAvatar, commits: 0, prsOpened: 0, prsMerged: 0 });
      const a = authorMap.get(key)!;
      if (e.type === "COMMIT") { a.commits++; repoStats.commits++; totalCommits++; }
      if (e.type === "PULL_REQUEST" || e.type === "MERGE_REQUEST") {
        a.prsOpened++;
        if (e.status === "merged") a.prsMerged++;
        repoStats.prsTotal++;
        if (e.status === "open" || e.status === "draft") { repoStats.prsOpen++; openPRs++; }
        totalPRs++;
        prAges.push((Date.now() - new Date(e.timestamp).getTime()) / (1000 * 60 * 60 * 24));
      }
    }
    repoMap.set(repo.id, repoStats);
  }

  const contributors = Array.from(authorMap.values())
    .sort((a, b) => (b.commits + b.prsMerged) - (a.commits + a.prsMerged))
    .slice(0, 20);
  const byRepo = Array.from(repoMap.values());
  const avgPRAgeDays = prAges.length ? Math.round(prAges.reduce((s, v) => s + v, 0) / prAges.length) : 0;

  return res.json({ contributors, byRepo, totalCommits, totalPRs, openPRs, avgPRAgeDays });
}
