import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { getTimesheets, getTimesheetSummary } from "../controllers/timesheet.controller";

const router = Router();
router.use(authenticate);

router.get("/",        getTimesheets);
router.get("/summary", getTimesheetSummary);

export default router;
