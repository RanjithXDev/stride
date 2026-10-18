import { Router } from "express";
import { authenticate } from "../middleware/auth";
import {
  listScmRepos,
  trackRepos,
  untrackRepo,
  getScmRepo,
  listRepoBranches,
  getRepoActivity,
  listAvailableRepos,
  getActivity,
  getPullRequests,
  getPipelines,
  getStats,
  registerWebhook,
  deleteWebhook,
  listRepoMembers,
  grantRepoAccess,
  revokeRepoAccess,
  getAnalytics,
} from "../controllers/scm.controller";
import { githubWebhookIngress, gitlabWebhookIngress } from "../controllers/scm-webhook.controller";

const router = Router();

// Public webhook ingress — no auth middleware
router.post("/webhooks/github", githubWebhookIngress);
router.post("/webhooks/gitlab", gitlabWebhookIngress);

router.use(authenticate);

router.get("/repos", listScmRepos);
router.post("/repos/track", trackRepos);
router.get("/repos/:id", getScmRepo);
router.get("/repos/:id/branches", listRepoBranches);
router.get("/repos/:id/activity", getRepoActivity);
router.delete("/repos/:id/untrack", untrackRepo);
router.post("/repos/:id/register-webhook", registerWebhook);
router.delete("/repos/:id/webhook", deleteWebhook);

router.get("/connections/:id/available-repos", listAvailableRepos);

router.get("/repos/:id/members", listRepoMembers);
router.post("/repos/:id/grant-access", grantRepoAccess);
router.delete("/repos/:id/revoke-access/:userId", revokeRepoAccess);

router.get("/activity", getActivity);
router.get("/prs", getPullRequests);
router.get("/pipelines", getPipelines);
router.get("/stats", getStats);
router.get("/analytics", getAnalytics);

export default router;
