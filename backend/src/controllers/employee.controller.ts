import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { getHierarchyConfig } from "../lib/hierarchy";
import { recordSecurityAudit } from "../services/security-audit.service";

const userSelect = {
  id: true, name: true, email: true, role: true, jobTitle: true,
  avatar: true, isActive: true, createdAt: true,
  department: { select: { id: true, name: true } },
  manager: { select: { id: true, name: true } },
  _count: { select: { assignedTickets: true, reportedTickets: true } },
};

const ROLE_RANK: Record<Role, number> = {
  EMPLOYEE: 1, TEAM_LEAD: 2, MANAGER: 3, HR: 4, CFO: 4, CPO: 5, FOUNDER: 6,
};

function canAssignRole(actor: NonNullable<AuthRequest["user"]>, target: Role) {
  if (actor.isSuperAdmin) return true;
  if (actor.role === Role.FOUNDER) return target !== Role.FOUNDER;
  return ROLE_RANK[target] < ROLE_RANK[actor.role] && target !== Role.FOUNDER;
}

async function validOrgReference(model: "department" | "user", id: string | null | undefined, organizationId: string | null) {
  if (!id || !organizationId) return !id;
  return model === "department"
    ? !!await prisma.department.findFirst({ where: { id, organizationId } })
    : !!await prisma.user.findFirst({ where: { id, organizationId, isActive: true } });
}

export async function listEmployees(req: AuthRequest, res: Response) {
  const { departmentId, role, isActive, search } = req.query;

  const where: any = { isSuperAdmin: false };
  if (req.user!.organizationId) where.organizationId = req.user!.organizationId;
  if (departmentId) where.departmentId = departmentId;
  if (role) where.role = role;
  if (isActive !== undefined) where.isActive = isActive === "true";
  if (search) {
    where.OR = [
      { name: { contains: String(search), mode: "insensitive" } },
      { email: { contains: String(search), mode: "insensitive" } },
    ];
  }

  // Employees can only see their own department
  if (req.user!.role === Role.EMPLOYEE) {
    const self = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { departmentId: true } });
    if (self?.departmentId) where.departmentId = self.departmentId;
  }

  const employees = await prisma.user.findMany({
    where,
    select: userSelect,
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });
  return res.json(employees);
}

export async function getEmployee(req: AuthRequest, res: Response) {
  const id = String(req.params.id);
  const employee = await prisma.user.findFirst({
    where: { id, ...(req.user!.organizationId ? { organizationId: req.user!.organizationId } : {}) },
    select: {
      ...userSelect,
      directReports: { select: { id: true, name: true, role: true, department: { select: { id: true, name: true } } } },
      assignedTickets: {
        take: 5,
        orderBy: { updatedAt: "desc" },
        select: { id: true, title: true, status: true, priority: true, updatedAt: true },
      },
      projectMemberships: {
        select: {
          role: true,
          project: { select: { id: true, name: true, status: true } },
        },
      },
    },
  });
  if (!employee) return res.status(404).json({ message: "Employee not found" });
  if (req.user!.role === Role.EMPLOYEE && req.user!.id !== id) {
    const self = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { departmentId: true } });
    if (!self?.departmentId || employee.department?.id !== self.departmentId) return res.status(404).json({ message: "Employee not found" });
  }
  return res.json(employee);
}

export async function updateEmployee(req: AuthRequest, res: Response) {
  const id = String(req.params.id);
  const { name, jobTitle, role, departmentId, managerId, isActive } = req.body;
  const caller = req.user!;
  const managerRoles: Role[] = [Role.FOUNDER, Role.CPO, Role.CFO, Role.HR, Role.MANAGER];
  if (caller.id !== id && !caller.isSuperAdmin && !managerRoles.includes(caller.role)) return res.status(403).json({ message: "Cannot edit another employee" });

  const target = await prisma.user.findFirst({ where: { id, ...(caller.organizationId ? { organizationId: caller.organizationId } : {}) }, select: { id: true, role: true } });
  if (!target) return res.status(404).json({ message: "Employee not found" });

  // Employees can only update their own name/avatar
  if (caller.role === Role.EMPLOYEE && caller.id !== id) {
    return res.status(403).json({ message: "Cannot edit another employee" });
  }

  const data: any = {};
  if (name     !== undefined) data.name     = name;
  if (jobTitle !== undefined) data.jobTitle = jobTitle;

  const canManageFields = caller.isSuperAdmin || managerRoles.includes(caller.role);

  // Read which roles can change hierarchy from org settings
  const { hierarchyAdminRoles } = await getHierarchyConfig(caller.organizationId);
  const canChangeHierarchy = caller.isSuperAdmin || hierarchyAdminRoles.includes(caller.role);

  if (canManageFields) {
    if (role !== undefined) {
      if (!Object.values(Role).includes(role) || !canAssignRole(caller, role)) return res.status(403).json({ message: "You cannot assign this role" });
      data.role = role;
    }
    if (departmentId !== undefined) {
      if (!await validOrgReference("department", departmentId, caller.organizationId)) return res.status(400).json({ message: "Invalid department" });
      data.departmentId = departmentId;
    }
    if (isActive !== undefined)     data.isActive = isActive;
  }
  if (canChangeHierarchy) {
    if (managerId !== undefined) {
      if (managerId === id || !await validOrgReference("user", managerId, caller.organizationId)) return res.status(400).json({ message: "Invalid manager" });
      data.managerId = managerId;
    }
  }

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: userSelect,
  });
  await recordSecurityAudit({ organizationId: caller.organizationId, actorId: caller.id, action: "user.updated", resourceType: "user", resourceId: id, metadata: { changedFields: Object.keys(data) } });
  return res.json(updated);
}

export async function createEmployee(req: AuthRequest, res: Response) {
  const { name, email, password, role, jobTitle, departmentId, managerId } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: "name, email, password required" });
  }

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return res.status(409).json({ message: "Email already in use" });

  if (typeof password !== "string" || password.length < 12 || password.length > 128) return res.status(400).json({ message: "Password must be between 12 and 128 characters" });
  const requestedRole = role && Object.values(Role).includes(role) ? role as Role : Role.EMPLOYEE;
  if (!canAssignRole(req.user!, requestedRole)) return res.status(403).json({ message: "You cannot assign this role" });
  if (!await validOrgReference("department", departmentId, req.user!.organizationId)) return res.status(400).json({ message: "Invalid department" });
  if (!await validOrgReference("user", managerId, req.user!.organizationId)) return res.status(400).json({ message: "Invalid manager" });
  const hashed = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      name, email: String(email).trim().toLowerCase(), password: hashed,
      role: requestedRole,
      jobTitle: jobTitle ?? null,
      departmentId, managerId,
      organizationId: req.user!.organizationId,
    },
    select: userSelect,
  });
  await recordSecurityAudit({ organizationId: req.user!.organizationId, actorId: req.user!.id, action: "user.created", resourceType: "user", resourceId: user.id, metadata: { role: requestedRole } });
  return res.status(201).json(user);
}

export async function getOrgTree(req: AuthRequest, res: Response) {
  const users = await prisma.user.findMany({
    where: { isActive: true, isSuperAdmin: false, organizationId: req.user!.organizationId ?? undefined },
    select: { id: true, name: true, role: true, jobTitle: true, managerId: true, avatar: true, department: { select: { id: true, name: true } } },
    orderBy: { name: "asc" },
  });

  type OrgNode = (typeof users)[0] & { children: OrgNode[] };
  const map = new Map<string, OrgNode>();
  users.forEach((u) => map.set(u.id, { ...u, children: [] }));

  const roots: OrgNode[] = [];
  map.forEach((node) => {
    if (node.managerId && map.has(node.managerId)) {
      map.get(node.managerId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return res.json(roots);
}

export async function deleteEmployee(req: AuthRequest, res: Response) {
  const id = String(req.params.id);
  const caller = req.user!;

  const canRemove = caller.isSuperAdmin || ([Role.FOUNDER, Role.CPO, Role.MANAGER] as Role[]).includes(caller.role);
  if (!canRemove) {
    return res.status(403).json({ message: "Only a Founder, CPO, Manager, or Super Admin can remove employees" });
  }

  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, isSuperAdmin: true, organizationId: true } });
  if (!target) return res.status(404).json({ message: "Employee not found" });

  if (!caller.isSuperAdmin && target.organizationId !== caller.organizationId) {
    return res.status(403).json({ message: "Employee not in your organisation" });
  }

  if (target.id === caller.id) {
    return res.status(400).json({ message: "You cannot remove yourself" });
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { isActive: false, managerId: null } });
    await tx.user.updateMany({ where: { managerId: id }, data: { managerId: null } });
  });
  await recordSecurityAudit({ organizationId: caller.organizationId, actorId: caller.id, action: "user.deactivated", resourceType: "user", resourceId: id });

  return res.json({ message: "Employee deactivated" });
}

export async function listDepartments(req: AuthRequest, res: Response) {
  const departments = await prisma.department.findMany({
    where: { organizationId: req.user!.organizationId ?? undefined },
    orderBy: { name: "asc" },
    include: { _count: { select: { employees: true } } },
  });
  return res.json(departments);
}

export async function createDepartment(req: AuthRequest, res: Response) {
  const { name } = req.body;
  if (!name) return res.status(400).json({ message: "name required" });
  const dept = await prisma.department.create({
    data: { name, organizationId: req.user!.organizationId },
  });
  return res.status(201).json(dept);
}
