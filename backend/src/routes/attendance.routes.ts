import { Router } from "express";
import { authenticate } from "../middleware/auth";
import {
  checkIn, checkOut, getToday,
  listAttendance, getStats, getTeamToday, markLeave, fillAbsences,
} from "../controllers/attendance.controller";

const router = Router();
router.use(authenticate);

router.post("/check-in",        checkIn);
router.post("/check-out",       checkOut);
router.post("/leave",           markLeave);
router.post("/fill-absences",   fillAbsences);
router.get("/today",            getToday);
router.get("/team-today",       getTeamToday);
router.get("/stats",            getStats);
router.get("/",                 listAttendance);

export default router;
