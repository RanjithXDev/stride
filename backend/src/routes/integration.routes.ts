import { Router } from "express";
import { authenticate, requireOrgAdmin } from "../middleware/auth";
import {
  getConnections,
  initiateGitHubOAuth,
  githubCallback,
  initiateGitLabOAuth,
  gitlabCallback,
  deleteConnection,
  listConnectionRepositories,
  getMyIdentities,
  initiateIdentityConnect,
  disconnectIdentity,
  getScmConfig_endpoint,
  saveScmConfig,
  clearScmConfig,
} from "../controllers/integration.controller";

const router = Router();

// Public OAuth callbacks — must be BEFORE authenticate middleware
router.get("/github/callback", githubCallback);
router.get("/gitlab/callback", gitlabCallback);

// All routes below require authentication
router.use(authenticate);

router.get("/scm-config", requireOrgAdmin, getScmConfig_endpoint);
router.put("/scm-config", requireOrgAdmin, saveScmConfig);
router.delete("/scm-config/:provider", requireOrgAdmin, clearScmConfig);

router.get("/connections", getConnections);
router.post("/github/initiate", requireOrgAdmin, initiateGitHubOAuth);
router.post("/gitlab/initiate", requireOrgAdmin, initiateGitLabOAuth);
router.delete("/connections/:id", requireOrgAdmin, deleteConnection);
router.get("/connections/:id/repositories", listConnectionRepositories);

router.get("/identities", getMyIdentities);
router.post("/identities/:provider/initiate", initiateIdentityConnect);
router.delete("/identities/:id", disconnectIdentity);

export default router;
