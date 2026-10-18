import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getJwtSecret } from "../lib/security-config";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: Role;
    organizationId: string | null;
    isSuperAdmin: boolean;
  };
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : req.cookies?.stride_session;
  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const payload = jwt.verify(token, getJwtSecret(), {
      algorithms: ["HS256"],
      issuer: process.env.JWT_ISSUER ?? "stride-api",
      audience: process.env.JWT_AUDIENCE ?? "stride-web",
    }) as {
      id: string;
      email: string;
      role: Role;
      organizationId: string | null;
      isSuperAdmin: boolean;
    };
    if (!payload.id || !payload.email || !Object.values(Role).includes(payload.role)) throw new Error("Invalid claims");
    const current = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { id: true, email: true, role: true, organizationId: true, isSuperAdmin: true, isActive: true, organization: { select: { isActive: true } } },
    });
    if (!current?.isActive || (!current.isSuperAdmin && !current.organization?.isActive)) throw new Error("Inactive account");
    req.user = { id: current.id, email: current.email, role: current.role, organizationId: current.organizationId, isSuperAdmin: current.isSuperAdmin };
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

export function authorize(...roles: Role[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    next();
  };
}

export function requireSuperAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user?.isSuperAdmin) {
    return res.status(403).json({ message: "Super admin access required" });
  }
  next();
}

export function requireOrgAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  if (req.user.isSuperAdmin) return next();
  const adminRoles: Role[] = [Role.FOUNDER, Role.CPO, Role.CFO, Role.HR];
  if (adminRoles.includes(req.user.role)) return next();
  return res.status(403).json({ message: "Organisation admin access required" });
}
