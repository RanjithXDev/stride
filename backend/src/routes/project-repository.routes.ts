import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth";
import { Role } from "@prisma/client";
import {
  listProjectRepos,
  addProjectRepo,
  removeProjectRepo,
  getRepoAccessStatus,
  syncRepo,
  retryGrant,
  getProjectGitActivity,
} from "../controllers/project-repository.controller";

const router = Router();

router.use(authenticate);

router.get("/projects/:id/repositories", listProjectRepos);
router.post("/projects/:id/repositories", authorize(Role.FOUNDER, Role.MANAGER), addProjectRepo);
router.delete("/projects/:id/repositories/:repoId", authorize(Role.FOUNDER, Role.MANAGER), removeProjectRepo);
router.get("/projects/:id/repositories/:repoId/access", getRepoAccessStatus);
router.post("/projects/:id/repositories/:repoId/sync", authorize(Role.FOUNDER, Role.MANAGER), syncRepo);
router.post("/repository-access/:grantId/retry", authorize(Role.FOUNDER, Role.MANAGER), retryGrant);
router.get("/projects/:id/git-activity", getProjectGitActivity);

export default router;
