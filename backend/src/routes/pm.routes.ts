import { Router } from "express";
import { authenticate } from "../middleware/auth";
import {
  listPmConnections,
  createPmConnection,
  deletePmConnection,
  listPmProjects,
  listExternalIssues,
  listAllExternalIssues,
} from "../controllers/pm.controller";

const router = Router();

router.use(authenticate);

router.get("/connections", listPmConnections);
router.post("/connections", createPmConnection);
router.delete("/connections/:id", deletePmConnection);
router.get("/connections/:id/projects", listPmProjects);
router.get("/connections/:id/projects/:projectId/issues", listExternalIssues);
router.get("/issues", listAllExternalIssues);

export default router;
