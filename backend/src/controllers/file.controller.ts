import fs from "fs";
import path from "path";
import { Response } from "express";
import { Role } from "@prisma/client";
import { AuthRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { ApiError } from "../lib/api-error";

const FINANCE_ROLES: Role[] = [Role.FOUNDER, Role.CFO];

export async function getProtectedUpload(req: AuthRequest, res: Response) {
  const user = req.user!;
  const filename = String(req.params.filename ?? "");
  if (!/^[0-9]+-[0-9]+\.(?:jpg|png|webp|pdf)$/.test(filename)) throw new ApiError(404, "File not found", "NOT_FOUND");
  const proofUrl = `/uploads/${filename}`;
  const [expense, income] = await Promise.all([
    prisma.expense.findFirst({ where: { proofUrl, ...(user.organizationId ? { organizationId: user.organizationId } : {}) }, select: { submittedById: true, submittedBy: { select: { managerId: true } } } }),
    FINANCE_ROLES.includes(user.role) ? prisma.income.findFirst({ where: { proofUrl, ...(user.organizationId ? { organizationId: user.organizationId } : {}) }, select: { id: true } }) : null,
  ]);
  const canReadExpense = !!expense && (user.role !== Role.EMPLOYEE && user.role !== Role.MANAGER
    || expense.submittedById === user.id
    || (user.role === Role.MANAGER && expense.submittedBy.managerId === user.id));
  if (!canReadExpense && !income) throw new ApiError(404, "File not found", "NOT_FOUND");
  const filePath = path.join(process.cwd(), "uploads", filename);
  if (!fs.existsSync(filePath)) throw new ApiError(404, "File not found", "NOT_FOUND");
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
  return res.sendFile(filePath);
}
