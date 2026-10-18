import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { Role } from "@prisma/client";

export async function getTimesheets(req: AuthRequest, res: Response) {
  const { startDate, endDate, userId, projectId, workType } = req.query;
  const user = req.user!;

  const where: any = { ...(user.organizationId ? { user: { organizationId: user.organizationId } } : {}) };

  // Date range
  if (startDate || endDate) {
    where.loggedAt = {};
    if (startDate) where.loggedAt.gte = new Date(String(startDate));
    if (endDate) {
      const end = new Date(String(endDate));
      end.setHours(23, 59, 59, 999);
      where.loggedAt.lte = end;
    }
  }

  // Employees can only see their own timesheets
  if (user.role === Role.EMPLOYEE) {
    where.userId = user.id;
  } else if (userId) {
    where.userId = userId;
  }

  if (projectId) {
    const project = await prisma.project.findFirst({ where: { id: String(projectId), ...(user.organizationId ? { organizationId: user.organizationId } : {}) }, select: { id: true } });
    if (!project) return res.status(404).json({ message: "Project not found" });
    where.projectId = project.id;
  }
  if (userId && user.role !== Role.EMPLOYEE) {
    const target = await prisma.user.findFirst({ where: { id: String(userId), ...(user.organizationId ? { organizationId: user.organizationId } : {}) }, select: { id: true } });
    if (!target) return res.status(404).json({ message: "Employee not found" });
  }
  if (workType)  where.workType  = workType;

  const logs = await prisma.timeLog.findMany({
    where,
    select: {
      id: true, minutes: true, notes: true, workType: true, loggedAt: true,
      user:    { select: { id: true, name: true, avatar: true } },
      ticket:  { select: { id: true, title: true, status: true } },
      project: { select: { id: true, name: true } },
    },
    orderBy: { loggedAt: "desc" },
  });

  return res.json(logs);
}

export async function getTimesheetSummary(req: AuthRequest, res: Response) {
  const { startDate, endDate, projectId } = req.query;
  const user = req.user!;

  const where: any = { ...(user.organizationId ? { user: { organizationId: user.organizationId } } : {}) };
  if (user.role === Role.EMPLOYEE) where.userId = user.id;
  if (projectId) {
    const project = await prisma.project.findFirst({ where: { id: String(projectId), ...(user.organizationId ? { organizationId: user.organizationId } : {}) }, select: { id: true } });
    if (!project) return res.status(404).json({ message: "Project not found" });
    where.projectId = project.id;
  }
  if (startDate || endDate) {
    where.loggedAt = {};
    if (startDate) where.loggedAt.gte = new Date(String(startDate));
    if (endDate) {
      const end = new Date(String(endDate));
      end.setHours(23, 59, 59, 999);
      where.loggedAt.lte = end;
    }
  }

  const [total, byWorkType, byUser] = await Promise.all([
    prisma.timeLog.aggregate({ where, _sum: { minutes: true } }),
    prisma.timeLog.groupBy({
      by: ["workType"],
      where,
      _sum: { minutes: true },
    }),
    user.role !== Role.EMPLOYEE
      ? prisma.timeLog.groupBy({
          by: ["userId"],
          where,
          _sum: { minutes: true },
          orderBy: { _sum: { minutes: "desc" } },
          take: 10,
        })
      : Promise.resolve([]),
  ]);

  const userIds = (byUser as any[]).map((r: any) => r.userId);
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds }, ...(user.organizationId ? { organizationId: user.organizationId } : {}) },
        select: { id: true, name: true },
      })
    : [];

  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));

  return res.json({
    totalMinutes: total._sum.minutes ?? 0,
    byWorkType: (byWorkType as any[]).map((r: any) => ({
      workType: r.workType,
      minutes: r._sum.minutes ?? 0,
    })),
    byUser: (byUser as any[]).map((r: any) => ({
      userId: r.userId,
      name: userMap[r.userId] ?? "Unknown",
      minutes: r._sum.minutes ?? 0,
    })),
  });
}
