import { Router } from "express";
import { login, logout, me, register, forgotPassword, resetPassword } from "../controllers/auth.controller";
import { authenticate, authorize } from "../middleware/auth";
import { Role } from "@prisma/client";
import { loginRateLimit } from "../middleware/rate-limit";

const router = Router();

router.post("/login", loginRateLimit, login);
router.post("/logout", authenticate, logout);
router.get("/me", authenticate, me);
// Only founders can create users (employee invites handled separately later)
router.post("/register", authenticate, authorize(Role.FOUNDER), register);
router.post("/forgot-password", loginRateLimit, forgotPassword);
router.post("/reset-password", resetPassword);

export default router;
