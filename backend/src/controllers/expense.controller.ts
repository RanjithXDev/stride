import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { Role, ExpenseStatus } from "@prisma/client";
import { recordSecurityAudit } from "../services/security-audit.service";

const FINANCE_ROLES: Role[] = [Role.FOUNDER, Role.CFO];

const expenseSelect = {
  id: true, organizationId: true, title: true, amount: true, category: true,
  description: true, status: true, proofUrl: true, proofName: true, proofType: true,
  createdAt: true, updatedAt: true,
  submittedBy: { select: { id: true, name: true, role: true,
    department: { select: { id: true, name: true } },
    manager: { select: { id: true, name: true, role: true } },
  }},
  approvals: {
    select: {
      id: true, level: true, decision: true, note: true, decidedAt: true,
      approver: { select: { id: true, name: true, role: true } },
    },
    orderBy: { decidedAt: "asc" as const },
  },
};

export async function listExpenses(req: AuthRequest, res: Response) {
  const { status, category, submittedById, search } = req.query;
  const user = req.user!;

  const where: any = {};
  if (user.organizationId) where.organizationId = user.organizationId;
  if (status)          where.status          = String(status);
  if (category)        where.category        = String(category);
  if (submittedById)   where.submittedById   = String(submittedById);
  if (search) {
    where.OR = [
      { title: { contains: String(search), mode: "insensitive" } },
      { description: { contains: String(search), mode: "insensitive" } },
    ];
  }

  // Non-finance individual contributors only see their own expenses.
  if (!FINANCE_ROLES.includes(user.role) && user.role !== Role.MANAGER) {
    where.submittedById = user.id;
  }

  // Managers see their team's expenses + their own
  if (user.role === Role.MANAGER) {
    const teamIds = await prisma.user.findMany({
      where: { managerId: user.id },
      select: { id: true },
    });
    where.submittedById = { in: [user.id, ...teamIds.map((u) => u.id)] };
  }

  const expenses = await prisma.expense.findMany({
    where,
    select: expenseSelect,
    orderBy: { createdAt: "desc" },
  });
  return res.json(expenses);
}

export async function getExpense(req: AuthRequest, res: Response) {
  const id = String(req.params.id);
  const user = req.user!;

  const expense = await prisma.expense.findFirst({ where: { id, ...(user.organizationId ? { organizationId: user.organizationId } : {}) }, select: expenseSelect });
  if (!expense) return res.status(404).json({ message: "Expense not found" });

  if (!FINANCE_ROLES.includes(user.role) && user.role !== Role.MANAGER && expense.submittedBy.id !== user.id) {
    return res.status(403).json({ message: "Access denied" });
  }
  if (user.role === Role.MANAGER && expense.submittedBy.id !== user.id && expense.submittedBy.manager?.id !== user.id) return res.status(403).json({ message: "Access denied" });

  return res.json(expense);
}

export async function createExpense(req: AuthRequest, res: Response) {
  const { title, amount, category, description } = req.body;
  const parsedAmount = Number(amount);
  if (typeof title !== "string" || !title.trim() || title.length > 300 || !Number.isFinite(parsedAmount) || parsedAmount <= 0 || parsedAmount > 100_000_000) return res.status(400).json({ message: "A valid title and positive amount are required" });

  const file = (req as any).file as Express.Multer.File | undefined;

  const expense = await prisma.expense.create({
    data: {
      title, category, description,
      amount: parsedAmount,
      status: ExpenseStatus.SUBMITTED,
      submittedById: req.user!.id,
      organizationId: req.user!.organizationId,
      proofUrl:  file ? `/uploads/${file.filename}` : undefined,
      proofName: file ? file.originalname : undefined,
      proofType: file ? file.mimetype : undefined,
    },
    select: expenseSelect,
  });
  return res.status(201).json(expense);
}

export async function updateExpense(req: AuthRequest, res: Response) {
  const id = String(req.params.id);
  const user = req.user!;

  const existing = await prisma.expense.findFirst({ where: { id, ...(user.organizationId ? { organizationId: user.organizationId } : {}) } });
  if (!existing) return res.status(404).json({ message: "Expense not found" });

  if (existing.submittedById !== user.id) {
    return res.status(403).json({ message: "Cannot edit another employee's expense" });
  }
  if (!["DRAFT", "SUBMITTED"].includes(existing.status)) {
    return res.status(400).json({ message: "Cannot edit expense that is under approval" });
  }

  const { title, amount, category, description } = req.body;
  const parsedAmount = amount === undefined ? undefined : Number(amount);
  if (title !== undefined && (typeof title !== "string" || !title.trim() || title.length > 300)) return res.status(400).json({ message: "Invalid title" });
  if (parsedAmount !== undefined && (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || parsedAmount > 100_000_000)) return res.status(400).json({ message: "Invalid amount" });
  const file = (req as any).file as Express.Multer.File | undefined;

  const expense = await prisma.expense.update({
    where: { id },
    data: {
      title, category, description,
      amount: parsedAmount,
      proofUrl:  file ? `/uploads/${file.filename}` : undefined,
      proofName: file ? file.originalname : undefined,
      proofType: file ? file.mimetype : undefined,
    },
    select: expenseSelect,
  });
  return res.json(expense);
}

export async function approveExpense(req: AuthRequest, res: Response) {
  const id = String(req.params.id);
  const { decision, note } = req.body; // decision: "APPROVED" | "REJECTED"
  const user = req.user!;

  if (!["APPROVED", "REJECTED"].includes(decision)) {
    return res.status(400).json({ message: "decision must be APPROVED or REJECTED" });
  }

  const expense = await prisma.expense.findFirst({ where: { id, ...(user.organizationId ? { organizationId: user.organizationId } : {}) }, select: expenseSelect });
  if (!expense) return res.status(404).json({ message: "Expense not found" });
  if (user.role === Role.MANAGER && expense.submittedBy.manager?.id !== user.id) return res.status(403).json({ message: "You may only approve expenses for your direct reports" });
  if (expense.submittedBy.id === user.id) return res.status(403).json({ message: "You cannot approve your own expense" });

  // Determine what level this approver is acting at
  let level: number;
  let nextStatus: ExpenseStatus;

  if (user.role === Role.MANAGER || user.role === Role.FOUNDER) {
    if (expense.status === ExpenseStatus.SUBMITTED && user.role === Role.MANAGER) {
      level = 1;
      nextStatus = decision === "APPROVED" ? ExpenseStatus.L1_APPROVED : ExpenseStatus.REJECTED;
    } else if (
      (expense.status === ExpenseStatus.L1_APPROVED && FINANCE_ROLES.includes(user.role)) ||
      (expense.status === ExpenseStatus.SUBMITTED && user.role === Role.FOUNDER)
    ) {
      level = 2;
      nextStatus = decision === "APPROVED" ? ExpenseStatus.APPROVED : ExpenseStatus.REJECTED;
    } else {
      return res.status(400).json({ message: `Cannot approve expense in status ${expense.status} at your role` });
    }
  } else if (user.role === Role.CFO) {
    if (expense.status !== ExpenseStatus.L1_APPROVED) {
      return res.status(400).json({ message: "Expense must be L1 approved before CFO review" });
    }
    level = 2;
    nextStatus = decision === "APPROVED" ? ExpenseStatus.APPROVED : ExpenseStatus.REJECTED;
  } else {
    return res.status(403).json({ message: "You are not authorised to approve expenses" });
  }

  // Prevent duplicate approval at same level
  const alreadyActed = expense.approvals.some(
    (a: any) => a.level === level && a.approver.id === user.id
  );
  if (alreadyActed) {
    return res.status(400).json({ message: "You have already acted on this expense" });
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.expenseApproval.create({
      data: { expenseId: id, approverId: user.id, level, decision, note },
    });
    return tx.expense.update({
      where: { id },
      data: { status: nextStatus },
      select: expenseSelect,
    });
  });
  await recordSecurityAudit({ organizationId: user.organizationId, actorId: user.id, action: `expense.${decision.toLowerCase()}`, resourceType: "expense", resourceId: id, metadata: { level } });

  return res.json(updated);
}

export async function getPendingApprovals(req: AuthRequest, res: Response) {
  const user = req.user!;

  let statusFilter: ExpenseStatus[] = [];

  if (user.role === Role.MANAGER) {
    statusFilter = [ExpenseStatus.SUBMITTED];
    const teamIds = await prisma.user.findMany({
      where: { managerId: user.id, ...(user.organizationId ? { organizationId: user.organizationId } : {}) },
      select: { id: true },
    });
    const expenses = await prisma.expense.findMany({
      where: { status: { in: statusFilter }, submittedById: { in: teamIds.map((u) => u.id) }, ...(user.organizationId ? { organizationId: user.organizationId } : {}) },
      select: expenseSelect,
      orderBy: { createdAt: "asc" },
    });
    return res.json(expenses);
  }

  if (FINANCE_ROLES.includes(user.role)) {
    statusFilter = [ExpenseStatus.SUBMITTED, ExpenseStatus.L1_APPROVED, ExpenseStatus.APPROVED];
    const expenses = await prisma.expense.findMany({
      where: { status: { in: statusFilter }, ...(user.organizationId ? { organizationId: user.organizationId } : {}) },
      select: expenseSelect,
      orderBy: { createdAt: "asc" },
    });
    return res.json(expenses);
  }

  return res.json([]);
}

export async function revokeL1Approval(req: AuthRequest, res: Response) {
  const id = String(req.params.id);
  const user = req.user!;

  if (user.role !== Role.MANAGER && !FINANCE_ROLES.includes(user.role)) {
    return res.status(403).json({ message: "Only a Manager or Finance role can revoke L1 approval" });
  }

  const expense = await prisma.expense.findFirst({ where: { id, ...(user.organizationId ? { organizationId: user.organizationId } : {}) } });
  if (!expense) return res.status(404).json({ message: "Expense not found" });
  if (expense.status !== ExpenseStatus.L1_APPROVED) {
    return res.status(400).json({ message: "Expense must be in L1_APPROVED status to revoke" });
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.expenseApproval.deleteMany({ where: { expenseId: id, level: 1 } });
    return tx.expense.update({
      where: { id },
      data: { status: ExpenseStatus.SUBMITTED },
      select: expenseSelect,
    });
  });

  return res.json(updated);
}

export async function revokeApproval(req: AuthRequest, res: Response) {
  const id = String(req.params.id);
  const user = req.user!;

  if (!FINANCE_ROLES.includes(user.role)) {
    return res.status(403).json({ message: "Only CFO or Founder can revoke L2 approval" });
  }

  const expense = await prisma.expense.findFirst({ where: { id, ...(user.organizationId ? { organizationId: user.organizationId } : {}) } });
  if (!expense) return res.status(404).json({ message: "Expense not found" });
  if (expense.status !== ExpenseStatus.APPROVED) {
    return res.status(400).json({ message: "Expense must be in APPROVED status to revoke L2 approval" });
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.expenseApproval.deleteMany({ where: { expenseId: id, level: 2 } });
    return tx.expense.update({
      where: { id },
      data: { status: ExpenseStatus.L1_APPROVED },
      select: expenseSelect,
    });
  });

  return res.json(updated);
}

export async function markAsPaid(req: AuthRequest, res: Response) {
  const id = String(req.params.id);
  const user = req.user!;

  if (!FINANCE_ROLES.includes(user.role)) {
    return res.status(403).json({ message: "Only CFO or Founder can mark expenses as paid" });
  }

  const expense = await prisma.expense.findFirst({ where: { id, ...(user.organizationId ? { organizationId: user.organizationId } : {}) } });
  if (!expense) return res.status(404).json({ message: "Expense not found" });
  if (expense.status !== ExpenseStatus.APPROVED) {
    return res.status(400).json({ message: "Expense must be fully approved before marking as paid" });
  }

  const updated = await prisma.expense.update({
    where: { id },
    data: { status: ExpenseStatus.PAID },
    select: expenseSelect,
  });
  await recordSecurityAudit({ organizationId: user.organizationId, actorId: user.id, action: "expense.paid", resourceType: "expense", resourceId: id });
  return res.json(updated);
}

export async function revokePayment(req: AuthRequest, res: Response) {
  const id = String(req.params.id);
  const user = req.user!;

  if (!FINANCE_ROLES.includes(user.role)) {
    return res.status(403).json({ message: "Only CFO or Founder can revoke payments" });
  }

  const expense = await prisma.expense.findFirst({ where: { id, ...(user.organizationId ? { organizationId: user.organizationId } : {}) } });
  if (!expense) return res.status(404).json({ message: "Expense not found" });
  if (expense.status !== ExpenseStatus.PAID) {
    return res.status(400).json({ message: "Expense is not in PAID status" });
  }

  const updated = await prisma.expense.update({
    where: { id },
    data: { status: ExpenseStatus.APPROVED },
    select: expenseSelect,
  });
  await recordSecurityAudit({ organizationId: user.organizationId, actorId: user.id, action: "expense.payment_reversed", resourceType: "expense", resourceId: id });
  return res.json(updated);
}

// Financial summary — founders + CFO only
export async function getFinancialSummary(req: AuthRequest, res: Response) {
  const user = req.user!;
  if (!FINANCE_ROLES.includes(user.role)) {
    return res.status(403).json({ message: "Access restricted to finance team" });
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear  = new Date(now.getFullYear(), 0, 1);
  const orgFilter = user.organizationId ? { organizationId: user.organizationId } : {};

  const [monthly, yearly, byCategory, byStatus, recentPaid, topSpenders] = await Promise.all([
    prisma.expense.aggregate({
      where: { ...orgFilter, status: ExpenseStatus.PAID, createdAt: { gte: startOfMonth } },
      _sum: { amount: true }, _count: true,
    }),
    prisma.expense.aggregate({
      where: { ...orgFilter, status: ExpenseStatus.PAID, createdAt: { gte: startOfYear } },
      _sum: { amount: true }, _count: true,
    }),
    prisma.expense.groupBy({
      by: ["category"],
      where: { ...orgFilter, status: ExpenseStatus.PAID, createdAt: { gte: startOfYear } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.expense.groupBy({
      by: ["status"],
      where: orgFilter,
      _count: true,
    }),
    prisma.expense.findMany({
      where: { ...orgFilter, status: ExpenseStatus.PAID },
      select: expenseSelect,
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),
    prisma.expense.groupBy({
      by: ["submittedById"],
      where: { ...orgFilter, status: ExpenseStatus.PAID, createdAt: { gte: startOfYear } },
      _sum: { amount: true },
      _count: true,
      orderBy: { _sum: { amount: "desc" } },
      take: 10,
    }),
  ]);

  // Enrich top spenders with user info
  const spenderIds = topSpenders.map((s) => s.submittedById);
  const spenderUsers = await prisma.user.findMany({
    where: { id: { in: spenderIds }, ...(user.organizationId ? { organizationId: user.organizationId } : {}) },
    select: { id: true, name: true, role: true, department: { select: { name: true } } },
  });
  const spenderMap = Object.fromEntries(spenderUsers.map((u) => [u.id, u]));
  const topSpendersEnriched = topSpenders.map((s) => ({
    ...s,
    user: spenderMap[s.submittedById],
  }));

  return res.json({
    monthly:   { total: monthly._sum.amount ?? 0,  count: monthly._count },
    yearly:    { total: yearly._sum.amount ?? 0,   count: yearly._count },
    byCategory,
    byStatus,
    recentPaid,
    topSpenders: topSpendersEnriched,
  });
}
