import { Request, Response } from "express";
import crypto from "crypto";
import { AuthRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { encrypt, decrypt } from "../lib/encrypt";
import { GitHubProvider } from "../services/scm/github.provider";
import { getGitLabProvider } from "../services/scm/gitlab.provider";
import { normalizeAllowedScmHost } from "../lib/scm-host";

// In-memory OAuth state map: state → { userId, orgId, ts }
const OAUTH_STATES = new Map<string, { userId: string; orgId: string; provider: string; isIdentity?: boolean; ts: number }>();

// Helper: get org-level SCM app config, merging with env fallbacks
async function getScmConfig(orgId: string, provider: "GITHUB" | "GITLAB"): Promise<{ clientId: string; clientSecret: string; callbackUrl: string; host?: string }> {
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { settings: true } });
  const settings = (org?.settings ?? {}) as any;
  const scm = settings.scm ?? {};
  const cfg = scm[provider.toLowerCase()] ?? {};

  if (provider === "GITHUB") {
    return {
      clientId: cfg.clientId || process.env.GITHUB_CLIENT_ID || "",
      clientSecret: cfg.clientSecretEnc ? decrypt(cfg.clientSecretEnc) : (process.env.GITHUB_CLIENT_SECRET || ""),
      callbackUrl: cfg.callbackUrl || process.env.GITHUB_CALLBACK_URL || `${process.env.BACKEND_URL ?? "http://localhost:4000"}/api/v1/integrations/github/callback`,
    };
  } else {
    return {
      clientId: cfg.clientId || process.env.GITLAB_CLIENT_ID || "",
      clientSecret: cfg.clientSecretEnc ? decrypt(cfg.clientSecretEnc) : (process.env.GITLAB_CLIENT_SECRET || ""),
      callbackUrl: cfg.callbackUrl || process.env.GITLAB_CALLBACK_URL || `${process.env.BACKEND_URL ?? "http://localhost:4000"}/api/v1/integrations/gitlab/callback`,
      host: cfg.host || "https://gitlab.com",
    };
  }
}

// GET /integrations/scm-config — get org's SCM app config (clientId, host only — no secrets)
export async function getScmConfig_endpoint(req: AuthRequest, res: Response) {
  const orgId = req.user!.organizationId;
  const org = await prisma.organization.findUnique({ where: { id: orgId! }, select: { settings: true } });
  const settings = (org?.settings ?? {}) as any;
  const scm = settings.scm ?? {};
  // Return config without secrets
  return res.json({
    github: { clientId: scm.github?.clientId ?? "", callbackUrl: scm.github?.callbackUrl ?? "", configured: !!scm.github?.clientId },
    gitlab: { clientId: scm.gitlab?.clientId ?? "", host: scm.gitlab?.host ?? "https://gitlab.com", callbackUrl: scm.gitlab?.callbackUrl ?? "", configured: !!scm.gitlab?.clientId },
  });
}

// PUT /integrations/scm-config — save org's SCM app credentials
export async function saveScmConfig(req: AuthRequest, res: Response) {
  const orgId = req.user!.organizationId;
  const { provider, clientId, clientSecret, callbackUrl, host } = req.body as {
    provider: "GITHUB" | "GITLAB";
    clientId: string;
    clientSecret?: string;
    callbackUrl?: string;
    host?: string;
  };

  if (!provider || !clientId) return res.status(400).json({ message: "provider and clientId are required" });

  const org = await prisma.organization.findUnique({ where: { id: orgId! }, select: { settings: true } });
  const settings = (org?.settings ?? {}) as any;
  const scm = { ...(settings.scm ?? {}) };

  const key = provider.toLowerCase() as "github" | "gitlab";
  const safeHost = provider === "GITLAB" && host ? normalizeAllowedScmHost(host) : undefined;
  scm[key] = {
    ...scm[key],
    clientId,
    ...(clientSecret ? { clientSecretEnc: encrypt(clientSecret) } : {}),
    ...(callbackUrl ? { callbackUrl } : {}),
    ...(safeHost ? { host: safeHost } : {}),
  };

  await prisma.organization.update({ where: { id: orgId! }, data: { settings: { ...settings, scm } } });
  return res.json({ message: "SCM config saved" });
}

// DELETE /integrations/scm-config/:provider — clear org's SCM app config
export async function clearScmConfig(req: AuthRequest, res: Response) {
  const orgId = req.user!.organizationId;
  const provider = (String(req.params.provider)).toLowerCase() as "github" | "gitlab";

  const org = await prisma.organization.findUnique({ where: { id: orgId! }, select: { settings: true } });
  const settings = (org?.settings ?? {}) as any;
  const scm = { ...(settings.scm ?? {}) };
  delete scm[provider];

  await prisma.organization.update({ where: { id: orgId! }, data: { settings: { ...settings, scm } } });
  return res.json({ message: "SCM config cleared" });
}

// Clean up expired states every 5 min
setInterval(() => {
  const cutoff = Date.now() - 10 * 60_000;
  for (const [k, v] of OAUTH_STATES) {
    if (v.ts < cutoff) OAUTH_STATES.delete(k);
  }
}, 5 * 60_000);

export async function getConnections(req: AuthRequest, res: Response) {
  const orgId = req.user!.organizationId;
  const connections = await prisma.sourceControlConnection.findMany({
    where: { organizationId: orgId! },
    select: { id: true, provider: true, providerHost: true, accountName: true, status: true, lastSyncedAt: true, createdAt: true, connectedById: true },
    orderBy: { createdAt: "asc" },
  });
  return res.json(connections);
}

// POST /integrations/github/initiate
export async function initiateGitHubOAuth(req: AuthRequest, res: Response) {
  const user = req.user!;
  if (!user.organizationId) return res.status(400).json({ message: "No organization" });

  const cfg = await getScmConfig(user.organizationId, "GITHUB");
  if (!cfg.clientId) return res.status(400).json({ message: "GitHub OAuth App not configured. Go to Settings → Integrations to set up your GitHub App credentials." });

  const state = crypto.randomBytes(20).toString("hex");
  OAUTH_STATES.set(state, { userId: user.id, orgId: user.organizationId, provider: "GITHUB", ts: Date.now() });

  const provider = new GitHubProvider(cfg.clientId, cfg.clientSecret);
  const url = provider.getAuthUrl(state, cfg.callbackUrl);

  return res.json({ url });
}

// GET /integrations/github/callback (public)
export async function githubCallback(req: Request, res: Response) {
  const { code, state, error } = req.query as Record<string, string>;
  const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";

  if (error || !code || !state) {
    return res.redirect(`${frontendUrl}/settings?tab=integrations&error=github_oauth_denied`);
  }

  const stateData = OAUTH_STATES.get(state);
  if (!stateData || stateData.provider !== "GITHUB") {
    return res.redirect(`${frontendUrl}/settings?tab=integrations&error=invalid_state`);
  }
  OAUTH_STATES.delete(state);

  try {
    const cfg = await getScmConfig(stateData.orgId, "GITHUB");
    const provider = new GitHubProvider(cfg.clientId, cfg.clientSecret);
    const tokens = await provider.exchangeCode(code, cfg.callbackUrl);
    const ghUser = await provider.getAuthenticatedUser(tokens.accessToken);

    if (stateData.isIdentity) {
      // Link employee identity
      await prisma.employeeSourceIdentity.upsert({
        where: { userId_connectionId: { userId: stateData.userId, connectionId: stateData.orgId } },
        update: { providerUserId: ghUser.id, username: ghUser.username, email: ghUser.email },
        create: { userId: stateData.userId, connectionId: stateData.orgId, providerUserId: ghUser.id, username: ghUser.username, email: ghUser.email, avatarUrl: ghUser.avatarUrl },
      });
      return res.redirect(`${frontendUrl}/employees/me?tab=developer&success=github_linked`);
    }

    // Org-level connection
    const existingConn = await prisma.sourceControlConnection.findFirst({
      where: { organizationId: stateData.orgId, provider: "GITHUB", externalAccountId: ghUser.id },
    });

    if (existingConn) {
      await prisma.sourceControlConnection.update({
        where: { id: existingConn.id },
        data: { encryptedAccessToken: encrypt(tokens.accessToken), accountName: ghUser.username, status: "ACTIVE" },
      });
    } else {
      await prisma.sourceControlConnection.create({
        data: {
          organizationId: stateData.orgId,
          provider: "GITHUB",
          externalAccountId: ghUser.id,
          accountName: ghUser.username,
          encryptedAccessToken: encrypt(tokens.accessToken),
          connectedById: stateData.userId,
          status: "ACTIVE",
        },
      });
    }

    return res.redirect(`${frontendUrl}/settings?tab=integrations&success=github_connected`);
  } catch (err: any) {
    console.error("GitHub callback error:", err);
    return res.redirect(`${frontendUrl}/settings?tab=integrations&error=github_callback_failed`);
  }
}

// POST /integrations/gitlab/initiate
export async function initiateGitLabOAuth(req: AuthRequest, res: Response) {
  const user = req.user!;
  if (!user.organizationId) return res.status(400).json({ message: "No organization" });

  const cfg = await getScmConfig(user.organizationId, "GITLAB");
  if (!cfg.clientId) return res.status(400).json({ message: "GitLab OAuth App not configured. Go to Settings → Integrations to set up your GitLab App credentials." });

  const state = crypto.randomBytes(20).toString("hex");
  OAUTH_STATES.set(state, { userId: user.id, orgId: user.organizationId, provider: "GITLAB", ts: Date.now() });

  const provider = getGitLabProvider(cfg.host);
  const url = provider.getAuthUrl(state, cfg.callbackUrl);

  return res.json({ url });
}

// GET /integrations/gitlab/callback (public)
export async function gitlabCallback(req: Request, res: Response) {
  const { code, state, error } = req.query as Record<string, string>;
  const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";

  if (error || !code || !state) {
    return res.redirect(`${frontendUrl}/settings?tab=integrations&error=gitlab_oauth_denied`);
  }

  const stateData = OAUTH_STATES.get(state);
  if (!stateData || stateData.provider !== "GITLAB") {
    return res.redirect(`${frontendUrl}/settings?tab=integrations&error=invalid_state`);
  }
  OAUTH_STATES.delete(state);

  try {
    const cfg = await getScmConfig(stateData.orgId, "GITLAB");
    const provider = getGitLabProvider(cfg.host);
    const tokens = await provider.exchangeCode(code, cfg.callbackUrl);
    const glUser = await provider.getAuthenticatedUser(tokens.accessToken);

    await prisma.sourceControlConnection.upsert({
      where: { organizationId_provider_providerHost_externalAccountId: { organizationId: stateData.orgId, provider: "GITLAB", providerHost: cfg.host ?? "https://gitlab.com", externalAccountId: glUser.id } },
      update: {
        encryptedAccessToken: encrypt(tokens.accessToken),
        encryptedRefreshToken: tokens.refreshToken ? encrypt(tokens.refreshToken) : undefined,
        tokenExpiresAt: tokens.expiresAt,
        accountName: glUser.username,
        status: "ACTIVE",
      },
      create: {
        organizationId: stateData.orgId,
        provider: "GITLAB",
        providerHost: cfg.host ?? "https://gitlab.com",
        externalAccountId: glUser.id,
        accountName: glUser.username,
        encryptedAccessToken: encrypt(tokens.accessToken),
        encryptedRefreshToken: tokens.refreshToken ? encrypt(tokens.refreshToken) : undefined,
        tokenExpiresAt: tokens.expiresAt,
        connectedById: stateData.userId,
        status: "ACTIVE",
      },
    });

    return res.redirect(`${frontendUrl}/settings?tab=integrations&success=gitlab_connected`);
  } catch (err: any) {
    console.error("GitLab callback error:", err);
    return res.redirect(`${frontendUrl}/settings?tab=integrations&error=gitlab_callback_failed`);
  }
}

export async function deleteConnection(req: AuthRequest, res: Response) {
  const id = String(req.params.id);
  const orgId = req.user!.organizationId;

  const conn = await prisma.sourceControlConnection.findFirst({ where: { id, organizationId: orgId! } });
  if (!conn) return res.status(404).json({ message: "Connection not found" });

  await prisma.sourceControlConnection.update({ where: { id }, data: { status: "REVOKED" } });
  return res.json({ message: "Connection revoked" });
}

export async function listConnectionRepositories(req: AuthRequest, res: Response) {
  const id = String(req.params.id);
  const orgId = req.user!.organizationId;

  const conn = await prisma.sourceControlConnection.findFirst({ where: { id, organizationId: orgId! } });
  if (!conn) return res.status(404).json({ message: "Connection not found" });

  let accessToken = decrypt(conn.encryptedAccessToken);

  // Refresh GitLab token if expired
  if (conn.provider === "GITLAB" && conn.tokenExpiresAt && conn.tokenExpiresAt < new Date() && conn.encryptedRefreshToken) {
    try {
      const provider = getGitLabProvider(conn.providerHost);
      const tokens = await provider.refreshToken(decrypt(conn.encryptedRefreshToken));
      await prisma.sourceControlConnection.update({
        where: { id },
        data: { encryptedAccessToken: encrypt(tokens.accessToken), encryptedRefreshToken: tokens.refreshToken ? encrypt(tokens.refreshToken) : undefined, tokenExpiresAt: tokens.expiresAt },
      });
      accessToken = tokens.accessToken;
    } catch (err) {
      await prisma.sourceControlConnection.update({ where: { id }, data: { status: "EXPIRED" } });
      return res.status(401).json({ message: "Token expired and refresh failed" });
    }
  }

  const provider = conn.provider === "GITHUB" ? new GitHubProvider() : getGitLabProvider(conn.providerHost);
  const repos = await provider.listRepositories(accessToken);
  return res.json(repos);
}

export async function getMyIdentities(req: AuthRequest, res: Response) {
  const userId = req.user!.id;
  const identities = await prisma.employeeSourceIdentity.findMany({
    where: { userId },
    include: { connection: { select: { id: true, provider: true, accountName: true } } },
  });
  return res.json(identities);
}

export async function initiateIdentityConnect(req: AuthRequest, res: Response) {
  const user = req.user!;
  const { provider } = req.params as { provider: string };

  if (provider !== "github" && provider !== "gitlab") {
    return res.status(400).json({ message: "Unknown provider" });
  }

  // Find org connection for this provider
  const conn = await prisma.sourceControlConnection.findFirst({
    where: { organizationId: user.organizationId!, provider: provider.toUpperCase() as any, status: "ACTIVE" },
  });
  if (!conn) return res.status(400).json({ message: `No active ${provider} connection for your organization` });

  const state = crypto.randomBytes(20).toString("hex");
  OAUTH_STATES.set(state, { userId: user.id, orgId: conn.id, provider: provider.toUpperCase(), isIdentity: true, ts: Date.now() });

  let url: string;
  if (provider === "github") {
    const p = new GitHubProvider();
    const redirectUri = process.env.GITHUB_CALLBACK_URL ?? `${process.env.BACKEND_URL ?? "http://localhost:4000"}/api/v1/integrations/github/callback`;
    url = p.getAuthUrl(state, redirectUri);
  } else {
    const p = getGitLabProvider(conn.providerHost);
    const redirectUri = process.env.GITLAB_CALLBACK_URL ?? `${process.env.BACKEND_URL ?? "http://localhost:4000"}/api/v1/integrations/gitlab/callback`;
    url = p.getAuthUrl(state, redirectUri);
  }

  return res.json({ url });
}

export async function disconnectIdentity(req: AuthRequest, res: Response) {
  const id = String(req.params.id);
  const userId = req.user!.id;

  const identity = await prisma.employeeSourceIdentity.findFirst({ where: { id, userId } });
  if (!identity) return res.status(404).json({ message: "Identity not found" });

  await prisma.employeeSourceIdentity.delete({ where: { id } });
  return res.json({ message: "Identity disconnected" });
}
