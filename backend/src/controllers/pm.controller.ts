import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { encrypt, decrypt } from "../lib/encrypt";
import { JiraProvider } from "../services/pm/jira.provider";
import { YouTrackProvider } from "../services/pm/youtrack.provider";
import { IPmProvider } from "../services/pm/provider.interface";

const ALLOWED_ROLES = ["FOUNDER", "CPO", "CFO", "MANAGER", "TEAM_LEAD", "EMPLOYEE"];

function canRead(role: string) { return ALLOWED_ROLES.includes(role); }
function canWrite(role: string) { return ["FOUNDER", "CPO"].includes(role); }
function param(req: AuthRequest, key: string): string { return String(Array.isArray(req.params[key]) ? req.params[key][0] : req.params[key]); }

function getProvider(provider: string, host: string): IPmProvider {
  if (provider === "JIRA") return new JiraProvider(host);
  if (provider === "YOUTRACK") return new YouTrackProvider(host);
  throw new Error(`Unsupported provider: ${provider}`);
}

// GET /pm/connections
export async function listPmConnections(req: AuthRequest, res: Response) {
  const { role, organizationId } = req.user!;
  if (!canRead(role)) return res.status(403).json({ message: "Insufficient permissions" });

  const connections = await prisma.projectManagementConnection.findMany({
    where: { organizationId: organizationId! },
    select: {
      id: true, provider: true, providerHost: true, accountName: true,
      cloudId: true, status: true, lastSyncedAt: true, lastError: true, createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
  return res.json({ connections });
}

// POST /pm/connections — create with email+apiToken (Jira) or token (YouTrack)
export async function createPmConnection(req: AuthRequest, res: Response) {
  const { role, organizationId, id: userId } = req.user!;
  if (!canWrite(role)) return res.status(403).json({ message: "Insufficient permissions" });

  const { provider, host, token, cloudId } = req.body ?? {};
  if (!provider || !token) return res.status(400).json({ message: "provider and token are required" });

  const providerHost = (host ?? (provider === "JIRA" ? "https://api.atlassian.com" : "")).replace(/\/$/, "");
  if (!providerHost) return res.status(400).json({ message: "host is required for this provider" });

  // Test the connection
  let accountName = "";
  try {
    const prov = getProvider(provider, providerHost);
    const projects = await prov.listProjects(token, cloudId);
    accountName = projects.length > 0 ? `${projects.length} project(s)` : "Connected";
  } catch (err: any) {
    return res.status(422).json({ message: `Connection test failed: ${err.message}` });
  }

  const encryptedToken = encrypt(token);

  const conn = await prisma.projectManagementConnection.upsert({
    where: {
      organizationId_provider_providerHost_accountName: {
        organizationId: organizationId!,
        provider: provider as any,
        providerHost,
        accountName,
      },
    },
    create: {
      organizationId: organizationId!,
      provider: provider as any,
      providerHost,
      accountName,
      encryptedToken,
      cloudId: cloudId ?? null,
      connectedById: userId,
      status: "ACTIVE",
    },
    update: {
      encryptedToken,
      cloudId: cloudId ?? null,
      status: "ACTIVE",
      lastError: null,
    },
    select: {
      id: true, provider: true, providerHost: true, accountName: true,
      cloudId: true, status: true, createdAt: true,
    },
  });

  return res.status(201).json({ connection: conn });
}

// DELETE /pm/connections/:id
export async function deletePmConnection(req: AuthRequest, res: Response) {
  const { role, organizationId } = req.user!;
  if (!canWrite(role)) return res.status(403).json({ message: "Insufficient permissions" });

  await prisma.projectManagementConnection.deleteMany({
    where: { id: param(req, "id"), organizationId: organizationId! },
  });
  return res.status(204).send();
}

// GET /pm/connections/:id/projects
export async function listPmProjects(req: AuthRequest, res: Response) {
  const { role, organizationId } = req.user!;
  if (!canRead(role)) return res.status(403).json({ message: "Insufficient permissions" });

  const conn = await prisma.projectManagementConnection.findFirst({
    where: { id: param(req, "id"), organizationId: organizationId! },
  });
  if (!conn) return res.status(404).json({ message: "Connection not found" });

  try {
    const token = decrypt(conn.encryptedToken);
    const prov = getProvider(conn.provider, conn.providerHost);
    const projects = await prov.listProjects(token, conn.cloudId ?? undefined);
    return res.json({ projects });
  } catch (err: any) {
    await prisma.projectManagementConnection.update({
      where: { id: conn.id },
      data: { status: "ERROR", lastError: err.message },
    });
    return res.status(502).json({ message: err.message ?? "Failed to fetch projects" });
  }
}

// GET /pm/connections/:id/projects/:projectId/issues
export async function listExternalIssues(req: AuthRequest, res: Response) {
  const { role, organizationId } = req.user!;
  if (!canRead(role)) return res.status(403).json({ message: "Insufficient permissions" });

  const conn = await prisma.projectManagementConnection.findFirst({
    where: { id: param(req, "id"), organizationId: organizationId! },
  });
  if (!conn) return res.status(404).json({ message: "Connection not found" });

  const { status, assignee, limit: limitStr, offset: offsetStr } = req.query as Record<string, string>;
  const limit = Math.min(100, parseInt(limitStr ?? "50", 10));
  const offset = Math.max(0, parseInt(offsetStr ?? "0", 10));

  try {
    const token = decrypt(conn.encryptedToken);
    const prov = getProvider(conn.provider, conn.providerHost);
    const result = await prov.listIssues(
      token,
      param(req, "projectId"),
      conn.cloudId ?? undefined,
      { status, assignee, limit, offset }
    );
    return res.json(result);
  } catch (err: any) {
    return res.status(502).json({ message: err.message ?? "Failed to fetch issues" });
  }
}

// GET /pm/issues — unified issues across all connections (overview)
export async function listAllExternalIssues(req: AuthRequest, res: Response) {
  const { role, organizationId } = req.user!;
  if (!canRead(role)) return res.status(403).json({ message: "Insufficient permissions" });

  const connections = await prisma.projectManagementConnection.findMany({
    where: { organizationId: organizationId!, status: "ACTIVE" },
  });

  if (connections.length === 0) {
    return res.json({ issues: [], total: 0, connections: [] });
  }

  const { status, limit: limitStr } = req.query as Record<string, string>;
  const limit = Math.min(50, parseInt(limitStr ?? "20", 10));

  const results = await Promise.allSettled(
    connections.map(async (conn) => {
      const token = decrypt(conn.encryptedToken);
      const prov = getProvider(conn.provider, conn.providerHost);
      // Get first project from each connection
      const projects = await prov.listProjects(token, conn.cloudId ?? undefined);
      if (projects.length === 0) return [];
      const allIssues: any[] = [];
      for (const project of projects.slice(0, 3)) {
        const { issues } = await prov.listIssues(token, project.id, conn.cloudId ?? undefined, {
          status, limit: Math.ceil(limit / projects.slice(0, 3).length),
        });
        allIssues.push(...issues.map(i => ({ ...i, _provider: conn.provider, _connectionId: conn.id })));
      }
      return allIssues;
    })
  );

  const issues = results
    .filter((r): r is PromiseFulfilledResult<any[]> => r.status === "fulfilled")
    .flatMap((r) => r.value)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, limit * connections.length);

  return res.json({
    issues,
    total: issues.length,
    connections: connections.map((c) => ({ id: c.id, provider: c.provider, accountName: c.accountName })),
  });
}
