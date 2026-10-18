import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth";
import { Role } from "@prisma/client";
import { upload, validateUploadedFile } from "../lib/upload";
import { uploadRateLimit } from "../middleware/rate-limit";
import {
  listIncomes, getIncome, createIncome, updateIncome, deleteIncome, getIncomeSummary,
} from "../controllers/income.controller";

const router = Router();
router.use(authenticate);

router.get("/",        listIncomes);
router.get("/summary", getIncomeSummary);
router.get("/:id",     getIncome);
router.post("/",       uploadRateLimit, upload.single("proof"), validateUploadedFile, createIncome);
router.put("/:id",     uploadRateLimit, upload.single("proof"), validateUploadedFile, updateIncome);
router.delete("/:id",  authorize(Role.FOUNDER), deleteIncome);

export default router;
