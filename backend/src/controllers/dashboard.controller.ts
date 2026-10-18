import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { Role, ExpenseStatus, IncomeStatus, TicketStatus } from "@prisma/client";

export async function getDashboard(req: AuthRequest, res: Response) {
  const user = req.user!;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  if (user.role === Role.FOUNDER) {
    const orgFilter = user.organizationId ? { organizationId: user.organizationId } : {};
    const [employees, projects, tickets, expensesAgg, pendingExpenses, recentTickets, allExpenses, incomeMonthly, incomeYearly, projectSummaries] = await Promise.all([
      prisma.user.count({ where: { isActive: true, ...orgFilter } }),
      prisma.project.groupBy({ by: ["status"], where: orgFilter, _count: true }),
      prisma.ticket.groupBy({ by: ["status"], where: { ...orgFilter, deletedAt: null }, _count: true }),
      prisma.expense.aggregate({
        where: { ...orgFilter, status: ExpenseStatus.PAID, createdAt: { gte: startOfMonth } },
        _sum: { amount: true }, _count: true,
      }),
      prisma.expense.count({ where: { ...orgFilter, status: { in: [ExpenseStatus.SUBMITTED, ExpenseStatus.L1_APPROVED] } } }),
      prisma.ticket.findMany({
        where: { ...orgFilter, status: { not: TicketStatus.CLOSED }, deletedAt: null },
        select: { id: true, title: true, status: true, priority: true,
          assignee: { select: { id: true, name: true } }, updatedAt: true },
        orderBy: { updatedAt: "desc" }, take: 8,
      }),
      prisma.expense.groupBy({ by: ["status"], where: orgFilter, _count: true, _sum: { amount: true } }),
      prisma.income.aggregate({
        where: { status: IncomeStatus.RECEIVED, ...orgFilter, date: { gte: startOfMonth } },
        _sum: { amount: true }, _count: true,
      }),
      prisma.income.aggregate({
        where: { status: IncomeStatus.RECEIVED, ...orgFilter, date: { gte: new Date(now.getFullYear(), 0, 1) } },
        _sum: { amount: true }, _count: true,
      }),
      prisma.project.findMany({
        where: orgFilter,
        select: {
          id: true, name: true, status: true, deadline: true, updatedAt: true,
          _count: { select: { members: true } },
          tickets: {
            where: { deletedAt: null },
            select: { status: true, priority: true, dueDate: true },
          },
        },
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      }),
    ]);
    return res.json({
      role: user.role, employees, projects, tickets, pendingExpenses, recentTickets, projectSummaries,
      expenses: {
        total:      Number(expensesAgg._sum.amount ?? 0),
        count:      expensesAgg._count,
        allByStatus: allExpenses,
      },
      income: {
        monthly: { total: Number(incomeMonthly._sum.amount ?? 0), count: incomeMonthly._count },
        yearly:  { total: Number(incomeYearly._sum.amount  ?? 0), count: incomeYearly._count },
      },
    });
  }

  if (user.role === Role.CFO) {
    const orgFilter = user.organizationId ? { organizationId: user.organizationId } : {};
    const [monthlyAgg, yearlyAgg, pendingL2, byCategory, recentApproved, byStatus, incomeMonthly, incomeYearly] = await Promise.all([
      prisma.expense.aggregate({
        where: { ...orgFilter, status: ExpenseStatus.PAID, createdAt: { gte: startOfMonth } },
        _sum: { amount: true }, _count: true,
      }),
      prisma.expense.aggregate({
        where: { ...orgFilter, status: ExpenseStatus.PAID, createdAt: { gte: new Date(now.getFullYear(), 0, 1) } },
        _sum: { amount: true }, _count: true,
      }),
      prisma.expense.findMany({
        where: { ...orgFilter, status: ExpenseStatus.L1_APPROVED },
        select: {
          id: true, title: true, amount: true, category: true, createdAt: true,
          submittedBy: { select: { id: true, name: true, department: { select: { name: true } } } },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.expense.groupBy({
        by: ["category"],
        where: { ...orgFilter, status: ExpenseStatus.PAID, createdAt: { gte: new Date(now.getFullYear(), 0, 1) } },
        _sum: { amount: true }, _count: true,
      }),
      prisma.expense.findMany({
        where: { ...orgFilter, status: ExpenseStatus.PAID },
        select: {
          id: true, title: true, amount: true, category: true, updatedAt: true,
          submittedBy: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: "desc" }, take: 8,
      }),
      prisma.expense.groupBy({ by: ["status"], where: orgFilter, _count: true }),
      prisma.income.aggregate({
        where: { status: IncomeStatus.RECEIVED, ...orgFilter, date: { gte: startOfMonth } },
        _sum: { amount: true }, _count: true,
      }),
      prisma.income.aggregate({
        where: { status: IncomeStatus.RECEIVED, ...orgFilter, date: { gte: new Date(now.getFullYear(), 0, 1) } },
        _sum: { amount: true }, _count: true,
      }),
    ]);
    return res.json({
      role: user.role,
      monthlySpend: { total: Number(monthlyAgg._sum.amount ?? 0), count: monthlyAgg._count },
      yearlySpend:  { total: Number(yearlyAgg._sum.amount  ?? 0), count: yearlyAgg._count },
      pendingL2, byCategory, recentApproved, byStatus,
      income: {
        monthly: { total: Number(incomeMonthly._sum.amount ?? 0), count: incomeMonthly._count },
        yearly:  { total: Number(incomeYearly._sum.amount  ?? 0), count: incomeYearly._count },
      },
    });
  }

  if (user.role === Role.MANAGER) {
    const teamIds = (await prisma.user.findMany({
      where: { managerId: user.id, ...(user.organizationId ? { organizationId: user.organizationId } : {}) },
      select: { id: true },
    })).map((u) => u.id);

    const allTeamIds = [user.id, ...teamIds];
    const [teamSize, myProjects, openTickets, pendingL1, teamExpenseAgg, teamExpenseByStatus] = await Promise.all([
      prisma.user.count({ where: { managerId: user.id, isActive: true, ...(user.organizationId ? { organizationId: user.organizationId } : {}) } }),
      prisma.project.findMany({
        where: { ...(user.organizationId ? { organizationId: user.organizationId } : {}), members: { some: { userId: user.id } } },
        select: {
          id: true, name: true, status: true, deadline: true,
          _count: { select: { members: true } },
          tickets: { where: { deletedAt: null }, select: { status: true, priority: true, dueDate: true } },
        },
      }),
      prisma.ticket.findMany({
        where: {
          status: { not: TicketStatus.CLOSED },
          ...(user.organizationId ? { organizationId: user.organizationId } : {}),
          deletedAt: null,
          OR: [{ assigneeId: { in: allTeamIds } }, { reporterId: { in: allTeamIds } }],
        },
        select: { id: true, title: true, status: true, priority: true,
          assignee: { select: { id: true, name: true } }, updatedAt: true },
        orderBy: { updatedAt: "desc" }, take: 8,
      }),
      prisma.expense.findMany({
        where: { ...(user.organizationId ? { organizationId: user.organizationId } : {}), status: ExpenseStatus.SUBMITTED, submittedById: { in: teamIds } },
        select: {
          id: true, title: true, amount: true, category: true, createdAt: true,
          submittedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.expense.aggregate({
        where: { ...(user.organizationId ? { organizationId: user.organizationId } : {}), submittedById: { in: allTeamIds }, createdAt: { gte: startOfMonth } },
        _sum: { amount: true }, _count: true,
      }),
      prisma.expense.groupBy({
        by: ["status"],
        where: { ...(user.organizationId ? { organizationId: user.organizationId } : {}), submittedById: { in: allTeamIds }, createdAt: { gte: startOfMonth } },
        _count: true, _sum: { amount: true },
      }),
    ]);
    return res.json({
      role: user.role, teamSize, myProjects, openTickets, pendingL1,
      teamExpenses: {
        total:    Number(teamExpenseAgg._sum.amount ?? 0),
        count:    teamExpenseAgg._count,
        byStatus: teamExpenseByStatus,
      },
    });
  }

  // EMPLOYEE
  const [myTickets, myExpenses, myProjects] = await Promise.all([
    prisma.ticket.findMany({
      where: { OR: [{ assigneeId: user.id }, { reporterId: user.id }], status: { not: TicketStatus.CLOSED } },
      select: { id: true, title: true, status: true, priority: true, updatedAt: true },
      orderBy: { updatedAt: "desc" }, take: 5,
    }),
    prisma.expense.findMany({
      where: { submittedById: user.id },
      select: { id: true, title: true, amount: true, status: true, category: true, createdAt: true },
      orderBy: { createdAt: "desc" }, take: 5,
    }),
    prisma.project.findMany({
      where: { members: { some: { userId: user.id } } },
      select: {
        id: true, name: true, status: true, deadline: true,
        tickets: { where: { deletedAt: null }, select: { status: true, priority: true, dueDate: true } },
      },
    }),
  ]);
  return res.json({ role: user.role, myTickets, myExpenses, myProjects });
}
