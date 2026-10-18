import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth";
import { Role } from "@prisma/client";
import {
  listEmployees, getEmployee, updateEmployee, deleteEmployee,
  createEmployee, listDepartments, createDepartment, getOrgTree,
} from "../controllers/employee.controller";

const router = Router();
router.use(authenticate);

// Static routes MUST come before /:id to avoid being swallowed as a param
router.get("/org-tree",        getOrgTree);
router.get("/departments/all", listDepartments);
router.post("/departments",    authorize(Role.FOUNDER), createDepartment);

router.get("/",    listEmployees);
router.post("/",   authorize(Role.FOUNDER, Role.CPO, Role.HR, Role.MANAGER), createEmployee);
router.get("/:id",    getEmployee);
router.put("/:id",    updateEmployee);
router.delete("/:id", deleteEmployee);

export default router;
