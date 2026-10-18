import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { getProtectedUpload } from "../controllers/file.controller";

const router = Router();
router.use(authenticate);
router.get("/:filename", getProtectedUpload);
export default router;
