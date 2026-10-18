import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { Role } from "@prisma/client";
import { queueGrant, queueRevoke } from "../services/scm/access.service";

const projectSelect = {
  id: true, organizationId: true, key: true, name: true, description: true, status: true,
  startDate: true, deadline: true, createdAt: true, updatedAt: true,
  department: { select: { id: true, name: true } },
  _count: { select: { tickets: true, members: true, timeLogs: true } },
};

async function nextProjectKey(name: string, organizationId: string | null) {
  const base = name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5) || "PRJ";
  const existing = await prisma.project.findMany({
    where: { organizationId, key: { startsWith: base } },
    select: { key: true },
  });
  const used = new Set(existing.map((project) => project.key));
  if (!used.has(base)) return base;
  let suffix = 2;
  while (used.has(`${base}${suffix}`)) suffix += 1;
  return `${base}${suffix}`;
}

const projectDetailSelect = {
  ...projectSelect,
  members: {
    select: {
      role: true, joinedAt: true,
      user: { select: { id: true, name: true, email: true, role: true, avatar: true,
        department: { select: { id: true, name: true } } } },
    },
    orderBy: { joinedAt: "asc" as const },
  },
  tickets: {
    select: { id: true, title: true, status: true, priority: true, type: true,
      assignee: { select: { id: true, name: true } }, updatedAt: true },
    orderBy: { updatedAt: "desc" as const },
    take: 20,
  },
};

export async function listProjects(req: AuthRequest, res: Response) {
  const { status, departmentId, search } = req.query;
  const user = req.user!;

  const where: any = {};
  if (user.organizationId) where.organizationId = user.organizationId;
  if (status)       where.status       = String(status);
  if (departmentId) where.departmentId = String(departmentId);
  if (search) {
    where.OR = [
      { name: { contains: String(search), mode: "insensitive" } },
      { description: { contains: String(search), mode: "insensitive" } },
    ];
  }

  // Employees only see projects they are members of
  if (user.role === Role.EMPLOYEE) {
    where.members = { some: { userId: user.id } };
  }

  const projects = await prisma.project.findMany({
    where,
    select: projectSelect,
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
  });
  return res.json(projects);
}

export async function getProject(req: AuthRequest, res: Response) {
  const id = String(req.params.id);
  const user = req.user!;

  const project = await prisma.project.findFirst({
    where: { id, ...(user.organizationId ? { organizationId: user.organizationId } : {}), ...(user.role === Role.EMPLOYEE ? { members: { some: { userId: user.id } } } : {}) },
    select: projectDetailSelect,
  });
  if (!project) return res.status(404).json({ message: "Project not found" });

  return res.json(project);
}

export async function createProject(req: AuthRequest, res: Response) {
  const { name, description, status, startDate, deadline, departmentId } = req.body;
  if (!name) return res.status(400).json({ message: "name required" });

  const organizationId = req.user!.organizationId;
  const key = await nextProjectKey(name, organizationId);
  const project = await prisma.project.create({
    data: { name, key, description, status, startDate, deadline, departmentId, organizationId },
    select: projectSelect,
  });
  return res.status(201).json(project);
}

export async function updateProject(req: AuthRequest, res: Response) {
  const id = String(req.params.id);
  const user = req.user!;
  const { name, description, status, startDate, deadline, departmentId } = req.body;

  const where: any = { id };
  if (user.organizationId) where.organizationId = user.organizationId;

  const exists = await prisma.project.findFirst({ where });
  if (!exists) return res.status(404).json({ message: "Project not found" });

  const project = await prisma.project.update({
    where: { id },
    data: { name, description, status, startDate, deadline, departmentId },
    select: projectSelect,
  });
  return res.json(project);
}

export async function deleteProject(req: AuthRequest, res: Response) {
  const id = String(req.params.id);
  const user = req.user!;

  const where: any = { id };
  if (user.organizationId) where.organizationId = user.organizationId;

  const exists = await prisma.project.findFirst({ where });
  if (!exists) return res.status(404).json({ message: "Project not found" });

  await prisma.project.delete({ where: { id } });
  return res.status(204).send();
}

export async function addMember(req: AuthRequest, res: Response) {
  const id = String(req.params.id);
  const { userId, role } = req.body;
  if (!userId) return res.status(400).json({ message: "userId required" });

  const project = await prisma.project.findFirst({ where: { id, ...(req.user!.organizationId ? { organizationId: req.user!.organizationId } : {}) } });
  if (!project) return res.status(404).json({ message: "Project not found" });
  const targetUser = await prisma.user.findFirst({ where: { id: userId, organizationId: project.organizationId, isActive: true } });
  if (!targetUser) return res.status(400).json({ message: "User does not belong to this organization" });

  const member = await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: id, userId } },
    create: { projectId: id, userId, role: role ?? "Member" },
    update: { role: role ?? "Member" },
    select: {
      id: true, role: true, joinedAt: true,
      user: { select: { id: true, name: true, email: true, role: true, avatar: true } },
    },
  });

  // Queue repo access grants for all linked repositories
  const repos = await prisma.projectRepository.findMany({ where: { projectId: id } });
  for (const repo of repos) {
    queueGrant({
      organizationId: project.organizationId!,
      projectRepositoryId: repo.id,
      projectMemberId: member.id,
      permission: repo.defaultPermission,
      connectionId: repo.connectionId,
    }).catch(() => {});
  }

  return res.status(201).json(member);
}

export async function removeMember(req: AuthRequest, res: Response) {
  const id = String(req.params.id);
  const userId = String(req.params.userId);

  const project = await prisma.project.findFirst({ where: { id, ...(req.user!.organizationId ? { organizationId: req.user!.organizationId } : {}) } });
  if (!project) return res.status(404).json({ message: "Project not found" });

  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: id, userId } },
  });
  if (!member) return res.status(404).json({ message: "Member not found" });

  // Queue revoke for all linked repositories before removing the member
  const repos = await prisma.projectRepository.findMany({ where: { projectId: id } });
  for (const repo of repos) {
    queueRevoke({
      organizationId: project.organizationId!,
      projectRepositoryId: repo.id,
      projectMemberId: member.id,
      connectionId: repo.connectionId,
    }).catch(() => {});
  }

  await prisma.projectMember.delete({
    where: { projectId_userId: { projectId: id, userId } },
  });
  return res.status(204).send();
}

export async function getProjectStats(req: AuthRequest, res: Response) {
  const id = String(req.params.id);
  const user = req.user!;
  const project = await prisma.project.findFirst({ where: { id, ...(user.organizationId ? { organizationId: user.organizationId } : {}), ...(user.role === Role.EMPLOYEE ? { members: { some: { userId: user.id } } } : {}) }, select: { id: true } });
  if (!project) return res.status(404).json({ message: "Project not found" });

  const [ticketsByStatus, ticketsByPriority, totalTime] = await Promise.all([
    prisma.ticket.groupBy({
      by: ["status"],
      where: { projectId: id },
      _count: { _all: true },
    }),
    prisma.ticket.groupBy({
      by: ["priority"],
      where: { projectId: id },
      _count: { _all: true },
    }),
    prisma.timeLog.aggregate({
      where: { projectId: id },
      _sum: { minutes: true },
    }),
  ]);

  return res.json({ ticketsByStatus, ticketsByPriority, totalMinutes: totalTime._sum?.minutes ?? 0 });
}
