import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { PlanType } from "@prisma/client";
import bcrypt from "bcryptjs";

// ── Super Admin: list all orgs ──────────────────────────────────────────────
export async function listOrganizations(_req: AuthRequest, res: Response) {
  const orgs = await prisma.organization.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { users: true, projects: true, attendances: true } },
    },
  });
  return res.json(orgs);
}

// ── Super Admin: get one org ────────────────────────────────────────────────
export async function getOrganization(req: AuthRequest, res: Response) {
  const org = await prisma.organization.findUnique({
    where: { id: String(req.params.id) },
    include: {
      _count: { select: { users: true, projects: true } },
      users: {
        where: { role: "FOUNDER" },
        select: { id: true, name: true, email: true },
        take: 3,
      },
    },
  });
  if (!org) return res.status(404).json({ message: "Organization not found" });
  return res.json(org);
}

// ── Super Admin: onboard a new company ─────────────────────────────────────
export async function createOrganization(req: AuthRequest, res: Response) {
  const {
    name, slug, plan, logoUrl,
    adminName, adminEmail, adminPassword,
  } = req.body;

  if (!name || !slug || !adminName || !adminEmail || !adminPassword) {
    return res.status(400).json({ message: "name, slug, adminName, adminEmail, adminPassword required" });
  }

  const slugExists = await prisma.organization.findUnique({ where: { slug } });
  if (slugExists) return res.status(409).json({ message: "Slug already taken" });

  const emailExists = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (emailExists) return res.status(409).json({ message: "Admin email already in use" });

  const defaultSettings = {
    halfDayMinutes: 240,
    fullDayMinutes: 480,
    workdayStart: "09:00",
    workdayEnd: "18:00",
    timezone: "Asia/Kolkata",
    allowWFH: true,
    requireLocation: false,
    enabledRoles: ["FOUNDER", "CFO", "MANAGER", "TEAM_LEAD", "EMPLOYEE"],
    roleLabels: {
      FOUNDER: "Founder", CFO: "CFO", MANAGER: "Manager",
      TEAM_LEAD: "Team Lead", EMPLOYEE: "Employee",
    },
  };

  const org = await prisma.organization.create({
    data: {
      name, slug,
      logoUrl: logoUrl ?? null,
      plan: (plan as PlanType) ?? PlanType.FREE,
      settings: defaultSettings,
    },
  });

  const hashed = await bcrypt.hash(adminPassword, 10);
  const admin = await prisma.user.create({
    data: {
      name: adminName,
      email: adminEmail,
      password: hashed,
      role: "FOUNDER",
      organizationId: org.id,
    },
    select: { id: true, name: true, email: true, role: true },
  });

  return res.status(201).json({ organization: org, admin });
}

// ── Super Admin: update org plan / active status ────────────────────────────
export async function updateOrganization(req: AuthRequest, res: Response) {
  const { name, plan, isActive, logoUrl } = req.body;
  const data: any = {};
  if (name     !== undefined) data.name     = name;
  if (plan     !== undefined) data.plan     = plan;
  if (isActive !== undefined) data.isActive = isActive;
  if (logoUrl  !== undefined) data.logoUrl  = logoUrl;

  const org = await prisma.organization.update({
    where: { id: String(req.params.id) },
    data,
  });
  return res.json(org);
}

// ── Company Admin: get own org settings ────────────────────────────────────
export async function getOrgSettings(req: AuthRequest, res: Response) {
  const orgId = req.user!.organizationId;
  if (!orgId) return res.status(400).json({ message: "No organization assigned" });

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, name: true, slug: true, plan: true, isActive: true, settings: true, logoUrl: true, createdAt: true },
  });
  if (!org) return res.status(404).json({ message: "Organization not found" });
  return res.json(org);
}

// ── Company Admin: update own org settings ─────────────────────────────────
export async function updateOrgSettings(req: AuthRequest, res: Response) {
  const orgId = req.user!.organizationId;
  if (!orgId) return res.status(400).json({ message: "No organization assigned" });

  const { name, logoUrl, settings } = req.body;
  const data: any = {};
  if (name    !== undefined) data.name    = name;
  if (logoUrl !== undefined) data.logoUrl = logoUrl;
  if (settings !== undefined) {
    // Merge incoming settings over existing (don't overwrite fields not included)
    const current = await prisma.organization.findUnique({ where: { id: orgId }, select: { settings: true } });
    data.settings = { ...(current?.settings as object ?? {}), ...settings };
  }

  const org = await prisma.organization.update({
    where: { id: orgId },
    data,
    select: { id: true, name: true, slug: true, plan: true, settings: true, logoUrl: true },
  });
  return res.json(org);
}

// ── Super Admin: stats overview ─────────────────────────────────────────────
export async function superAdminStats(_req: AuthRequest, res: Response) {
  const [totalOrgs, activeOrgs, totalUsers, planBreakdown] = await Promise.all([
    prisma.organization.count(),
    prisma.organization.count({ where: { isActive: true } }),
    prisma.user.count({ where: { isSuperAdmin: false } }),
    prisma.organization.groupBy({ by: ["plan"], _count: { id: true } }),
  ]);

  return res.json({
    totalOrgs,
    activeOrgs,
    totalUsers,
    planBreakdown: planBreakdown.map((p) => ({ plan: p.plan, count: p._count.id })),
  });
}
