import crypto from "crypto";
import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { decrypt } from "../lib/encrypt";

function verifyGitHubSignature(secret: string, payload: Buffer, signature: string): boolean {
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(payload).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

// POST /scm/webhooks/github  (public — no auth middleware)
export async function githubWebhookIngress(req: Request, res: Response) {
  const sig = String(req.headers["x-hub-signature-256"] ?? "");
  const event = String(req.headers["x-github-event"] ?? "");
  const rawBody: Buffer = (req as any).rawBody;

  if (!sig || !rawBody) return res.status(400).json({ message: "Missing signature or body" });

  const payload = JSON.parse(rawBody.toString("utf8")) as any;
  const repoFullName: string = payload?.repository?.full_name ?? "";
  if (!repoFullName) return res.status(400).json({ message: "No repository in payload" });

  const repo = await prisma.scmRepo.findFirst({
    where: { fullName: repoFullName, isTracked: true },
    include: { webhooks: true },
  });
  if (!repo || repo.webhooks.length === 0) return res.status(404).json({ message: "Repo not found" });

  const webhook = repo.webhooks[0];
  const secret = decrypt(webhook.secretEnc);
  if (!verifyGitHubSignature(secret, rawBody, sig)) {
    return res.status(401).json({ message: "Invalid signature" });
  }

  const typeMap: Record<string, "PUSH" | "PULL_REQUEST" | "CI_RUN"> = {
    push: "PUSH",
    pull_request: "PULL_REQUEST",
    workflow_run: "CI_RUN",
  };
  const scmType = typeMap[event];

  if (!scmType) {
    await prisma.scmWebhook.update({ where: { id: webhook.id }, data: { lastDeliveryAt: new Date() } });
    return res.json({ message: "ok" });
  }

  await prisma.scmEvent.create({
    data: { organizationId: repo.organizationId, repoId: repo.id, type: scmType, payload, processedAt: new Date() },
  });
  await prisma.scmWebhook.update({ where: { id: webhook.id }, data: { lastDeliveryAt: new Date(), lastError: null } });

  if (scmType === "CI_RUN" && payload?.workflow_run?.conclusion === "failure") {
    await notifyFailedPipeline(repo.organizationId, repo.fullName, payload.workflow_run);
  }

  return res.json({ message: "ok" });
}

// POST /scm/webhooks/gitlab  (public — no auth middleware)
export async function gitlabWebhookIngress(req: Request, res: Response) {
  const token = String(req.headers["x-gitlab-token"] ?? "");
  const event = String(req.headers["x-gitlab-event"] ?? "");

  const payload = req.body as any;
  const projectId = String(payload?.project?.id ?? payload?.object_attributes?.target?.id ?? "");
  const repoFullName: string = payload?.project?.path_with_namespace ?? "";

  const repo = await prisma.scmRepo.findFirst({
    where: { isTracked: true, ...(projectId ? { externalId: projectId } : { fullName: repoFullName }) },
    include: { webhooks: true },
  });
  if (!repo || repo.webhooks.length === 0) return res.status(404).json({ message: "Repo not found" });

  const webhook = repo.webhooks[0];
  const secret = decrypt(webhook.secretEnc);
  if (token !== secret) return res.status(401).json({ message: "Invalid token" });

  const typeMap: Record<string, "PUSH" | "PULL_REQUEST" | "CI_RUN"> = {
    "Push Hook": "PUSH",
    "Merge Request Hook": "PULL_REQUEST",
    "Pipeline Hook": "CI_RUN",
  };
  const scmType = typeMap[event];

  if (!scmType) {
    await prisma.scmWebhook.update({ where: { id: webhook.id }, data: { lastDeliveryAt: new Date() } });
    return res.json({ message: "ok" });
  }

  await prisma.scmEvent.create({
    data: { organizationId: repo.organizationId, repoId: repo.id, type: scmType, payload, processedAt: new Date() },
  });
  await prisma.scmWebhook.update({ where: { id: webhook.id }, data: { lastDeliveryAt: new Date(), lastError: null } });

  if (scmType === "CI_RUN" && payload?.object_attributes?.status === "failed") {
    await notifyFailedPipeline(repo.organizationId, repo.fullName, {
      name: payload.object_attributes?.ref ?? "pipeline",
      conclusion: "failure",
    });
  }

  return res.json({ message: "ok" });
}

async function notifyFailedPipeline(organizationId: string, repoFullName: string, run: any) {
  try {
    const targets = await prisma.user.findMany({
      where: { organizationId, isActive: true, role: { in: ["FOUNDER", "MANAGER"] } },
      select: { id: true },
    });
    if (targets.length === 0) return;
    console.log(`[SCM] Pipeline failed on ${repoFullName}: ${run.name} — notify ${targets.length} users`);
  } catch (err) {
    console.error("[SCM] notifyFailedPipeline error:", err);
  }
}
