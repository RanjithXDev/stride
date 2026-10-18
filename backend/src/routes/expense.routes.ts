import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth";
import { Role } from "@prisma/client";
import { upload, validateUploadedFile } from "../lib/upload";
import { uploadRateLimit } from "../middleware/rate-limit";
import {
  listExpenses, getExpense, createExpense, updateExpense,
  approveExpense, getPendingApprovals, getFinancialSummary,
  markAsPaid, revokePayment, revokeApproval, revokeL1Approval,
} from "../controllers/expense.controller";

const router = Router();
router.use(authenticate);

router.get("/",               listExpenses);
router.post("/", uploadRateLimit, upload.single("proof"), validateUploadedFile, createExpense);
router.get("/pending",        getPendingApprovals);
router.get("/financial",      authorize(Role.FOUNDER, Role.CFO), getFinancialSummary);
router.get("/:id",            getExpense);
router.put("/:id", uploadRateLimit, upload.single("proof"), validateUploadedFile, updateExpense);
router.post("/:id/approve",        authorize(Role.FOUNDER, Role.CFO, Role.MANAGER), approveExpense);
router.post("/:id/pay",             authorize(Role.FOUNDER, Role.CFO), markAsPaid);
router.post("/:id/revoke-payment",  authorize(Role.FOUNDER, Role.CFO), revokePayment);
router.post("/:id/revoke-approval",    authorize(Role.FOUNDER, Role.CFO), revokeApproval);
router.post("/:id/revoke-l1-approval", authorize(Role.FOUNDER, Role.CFO, Role.MANAGER), revokeL1Approval);

export default router;
