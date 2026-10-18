import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { Role, IncomeStatus } from "@prisma/client";

const FINANCE_ROLES: Role[] = [Role.FOUNDER, Role.CFO];

const incomeSelect = {
  id: true, title: true, amount: true, category: true,
  description: true, status: true, proofUrl: true, proofName: true, proofType: true,
  date: true, createdAt: true, updatedAt: true,
  recordedBy: {
    select: {
      id: true, name: true, role: true,
      department: { select: { id: true, name: true } },
    },
  },
};

export async function listIncomes(req: AuthRequest, res: Response) {
  const { status, category, search } = req.query;
  const user = req.user!;

  if (!FINANCE_ROLES.includes(user.role)) {
    return res.status(403).json({ message: "Only finance team can access income records" });
  }

  const where: any = {};
  if (user.organizationId) where.organizationId = user.organizationId;
  if (status)   where.status   = String(status);
  if (category) where.category = String(category);
  if (search) {
    where.OR = [
      { title: { contains: String(search), mode: "insensitive" } },
      { description: { contains: String(search), mode: "insensitive" } },
    ];
  }

  const incomes = await prisma.income.findMany({
    where, select: incomeSelect, orderBy: { date: "desc" },
  });
  return res.json(incomes);
}

export async function getIncome(req: AuthRequest, res: Response) {
  const id = String(req.params.id);
  const user = req.user!;

  if (!FINANCE_ROLES.includes(user.role)) {
    return res.status(403).json({ message: "Access denied" });
  }

  const income = await prisma.income.findFirst({ where: { id, ...(user.organizationId ? { organizationId: user.organizationId } : {}) }, select: incomeSelect });
  if (!income) return res.status(404).json({ message: "Income record not found" });
  return res.json(income);
}

export async function createIncome(req: AuthRequest, res: Response) {
  const user = req.user!;
  if (!FINANCE_ROLES.includes(user.role)) {
    return res.status(403).json({ message: "Only finance team can record income" });
  }

  const { title, amount, category, description, status, date } = req.body;
  const parsedAmount = Number(amount);
  if (typeof title !== "string" || !title.trim() || title.length > 300 || !Number.isFinite(parsedAmount) || parsedAmount <= 0 || parsedAmount > 1_000_000_000) return res.status(400).json({ message: "A valid title and positive amount are required" });
  if (status && !Object.values(IncomeStatus).includes(status)) return res.status(400).json({ message: "Invalid status" });

  const file = (req as any).file as Express.Multer.File | undefined;

  const income = await prisma.income.create({
    data: {
      title, category, description,
      amount: parsedAmount,
      status: (status as IncomeStatus) ?? IncomeStatus.PENDING,
      date: date ? new Date(date) : new Date(),
      recordedById: user.id,
      organizationId: user.organizationId,
      proofUrl:  file ? `/uploads/${file.filename}` : undefined,
      proofName: file ? file.originalname : undefined,
      proofType: file ? file.mimetype : undefined,
    },
    select: incomeSelect,
  });
  return res.status(201).json(income);
}

export async function updateIncome(req: AuthRequest, res: Response) {
  const id = String(req.params.id);
  const user = req.user!;

  if (!FINANCE_ROLES.includes(user.role)) {
    return res.status(403).json({ message: "Access denied" });
  }

  const existing = await prisma.income.findFirst({ where: { id, ...(user.organizationId ? { organizationId: user.organizationId } : {}) } });
  if (!existing) return res.status(404).json({ message: "Income record not found" });

  const { title, amount, category, description, status, date } = req.body;
  const parsedAmount = amount === undefined ? undefined : Number(amount);
  if (title !== undefined && (typeof title !== "string" || !title.trim() || title.length > 300)) return res.status(400).json({ message: "Invalid title" });
  if (parsedAmount !== undefined && (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || parsedAmount > 1_000_000_000)) return res.status(400).json({ message: "Invalid amount" });
  if (status && !Object.values(IncomeStatus).includes(status)) return res.status(400).json({ message: "Invalid status" });
  const file = (req as any).file as Express.Multer.File | undefined;

  const income = await prisma.income.update({
    where: { id },
    data: {
      ...(title       && { title }),
      ...(category    && { category }),
      ...(description !== undefined && { description }),
      ...(parsedAmount !== undefined && { amount: parsedAmount }),
      ...(status      && { status: status as IncomeStatus }),
      ...(date        && { date: new Date(date) }),
      ...(file && {
        proofUrl:  `/uploads/${file.filename}`,
        proofName: file.originalname,
        proofType: file.mimetype,
      }),
    },
    select: incomeSelect,
  });
  return res.json(income);
}

export async function deleteIncome(req: AuthRequest, res: Response) {
  const id = String(req.params.id);
  const user = req.user!;

  if (user.role !== Role.FOUNDER) {
    return res.status(403).json({ message: "Only Founder can delete income records" });
  }

  const existing = await prisma.income.findFirst({ where: { id, ...(user.organizationId ? { organizationId: user.organizationId } : {}) } });
  if (!existing) return res.status(404).json({ message: "Income record not found" });

  await prisma.income.delete({ where: { id } });
  return res.status(204).send();
}

export async function getIncomeSummary(req: AuthRequest, res: Response) {
  const user = req.user!;
  if (!FINANCE_ROLES.includes(user.role)) {
    return res.status(403).json({ message: "Access restricted to finance team" });
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear  = new Date(now.getFullYear(), 0, 1);
  const orgFilter = user.organizationId ? { organizationId: user.organizationId } : {};

  const [monthly, yearly, byCategory, byStatus] = await Promise.all([
    prisma.income.aggregate({
      where: { status: IncomeStatus.RECEIVED, ...orgFilter, date: { gte: startOfMonth } },
      _sum: { amount: true }, _count: true,
    }),
    prisma.income.aggregate({
      where: { status: IncomeStatus.RECEIVED, ...orgFilter, date: { gte: startOfYear } },
      _sum: { amount: true }, _count: true,
    }),
    prisma.income.groupBy({
      by: ["category"],
      where: { status: IncomeStatus.RECEIVED, ...orgFilter, date: { gte: startOfYear } },
      _sum: { amount: true }, _count: true,
    }),
    prisma.income.groupBy({
      by: ["status"],
      where: { ...orgFilter },
      _count: true, _sum: { amount: true },
    }),
  ]);

  return res.json({
    monthly: { total: Number(monthly._sum.amount ?? 0), count: monthly._count },
    yearly:  { total: Number(yearly._sum.amount  ?? 0), count: yearly._count },
    byCategory, byStatus,
  });
}
