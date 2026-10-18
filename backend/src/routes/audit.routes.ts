import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { previewReversal, reverseAuditEvent, listOrgAuditEvents } from "../controllers/audit.controller";

const router = Router();
router.use(authenticate);
router.get("/", listOrgAuditEvents);
router.get("/:eventId/reversal-preview", previewReversal);
router.post("/:eventId/reverse", reverseAuditEvent);
export default router;
