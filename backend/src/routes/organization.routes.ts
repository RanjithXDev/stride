import { Router } from "express";
import { authenticate, requireSuperAdmin, requireOrgAdmin } from "../middleware/auth";
import {
  listOrganizations, getOrganization, createOrganization,
  updateOrganization, getOrgSettings, updateOrgSettings, superAdminStats,
} from "../controllers/organization.controller";

const router = Router();
router.use(authenticate);

// Super-admin only
router.get("/superadmin/stats",   requireSuperAdmin, superAdminStats);
router.get("/superadmin",         requireSuperAdmin, listOrganizations);
router.post("/superadmin",        requireSuperAdmin, createOrganization);
router.get("/superadmin/:id",     requireSuperAdmin, getOrganization);
router.put("/superadmin/:id",     requireSuperAdmin, updateOrganization);

// Company admin (FOUNDER/CFO of own org)
router.get("/settings",           requireOrgAdmin, getOrgSettings);
router.put("/settings",           requireOrgAdmin, updateOrgSettings);

export default router;
