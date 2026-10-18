import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth";
import { Role } from "@prisma/client";
import {
  listProjects, getProject, createProject, updateProject,
  deleteProject, addMember, removeMember, getProjectStats,
} from "../controllers/project.controller";

const router = Router();
router.use(authenticate);

router.get("/",    listProjects);
router.post("/",   authorize(Role.FOUNDER, Role.MANAGER), createProject);
router.get("/:id", getProject);
router.put("/:id", authorize(Role.FOUNDER, Role.MANAGER), updateProject);
router.delete("/:id", authorize(Role.FOUNDER), deleteProject);

router.post("/:id/members",          authorize(Role.FOUNDER, Role.MANAGER), addMember);
router.delete("/:id/members/:userId", authorize(Role.FOUNDER, Role.MANAGER), removeMember);
router.get("/:id/stats",             getProjectStats);

export default router;
