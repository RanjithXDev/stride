import { Response } from "express";
import { Role } from "@prisma/client";
import { AuthRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";

export async function globalSearch(req: AuthRequest, res: Response) {
  const user = req.user!;
  const query = String(req.query.q ?? "").trim();
  const limit = Math.min(Math.max(Number(req.query.limit) || 5, 1), 10);

  if (query.length < 2) {
    return res.json({ projects: [], tickets: [], employees: [] });
  }

  const organizationId = user.organizationId ?? undefined;
  const employee = user.role === Role.EMPLOYEE;
  const self = employee
    ? await prisma.user.findUnique({ where: { id: user.id }, select: { departmentId: true } })
    : null;

  const [projects, tickets, employees] = await Promise.all([
    prisma.project.findMany({
      where: {
        organizationId,
        name: { contains: query, mode: "insensitive" },
        ...(employee ? { members: { some: { userId: user.id } } } : {}),
      },
      select: { id: true, name: true, key: true, status: true },
      orderBy: { updatedAt: "desc" },
      take: limit,
    }),
    prisma.ticket.findMany({
      where: {
        organizationId: user.organizationId ?? undefined,
        deletedAt: null,
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { key: { contains: query, mode: "insensitive" } },
        ],
        ...(employee ? { AND: [{ OR: [{ assigneeId: user.id }, { reporterId: user.id }] }] } : {}),
      },
      select: { id: true, key: true, title: true, status: true, priority: true, project: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      take: limit,
    }),
    prisma.user.findMany({
      where: {
        organizationId,
        isSuperAdmin: false,
        isActive: true,
        ...(employee && self?.departmentId ? { departmentId: self.departmentId } : {}),
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, role: true, jobTitle: true, department: { select: { name: true } } },
      orderBy: { name: "asc" },
      take: limit,
    }),
  ]);

  return res.json({ projects, tickets, employees });
}
