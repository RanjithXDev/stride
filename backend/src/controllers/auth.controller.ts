import { Request, Response } from "express";
import { Role } from "@prisma/client";
import crypto from "crypto";
import { recordSecurityAudit } from "../services/security-audit.service";
import { getJwtSecret } from "../lib/security-config";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";

function signToken(user: {
  id: string; email: string; role: string;
  organizationId: string | null; isSuperAdmin: boolean;
}) {
  return (jwt as any).sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      isSuperAdmin: user.isSuperAdmin,
    },
    getJwtSecret(),
    {
      algorithm: "HS256",
      expiresIn: process.env.JWT_EXPIRES_IN ?? "15m",
      issuer: process.env.JWT_ISSUER ?? "stride-api",
      audience: process.env.JWT_AUDIENCE ?? "stride-web",
    }
  );
}

const userSelect = {
  id: true, name: true, email: true, role: true,
  avatar: true, departmentId: true, managerId: true,
  organizationId: true, isSuperAdmin: true,
  isActive: true, createdAt: true,
  department: { select: { id: true, name: true } },
  organization: { select: { id: true, name: true, slug: true, plan: true, settings: true } },
};

export async function login(req: Request, res: Response) {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  if (typeof email !== "string" || typeof password !== "string" || email.length > 320 || password.length > 128) return res.status(400).json({ message: "Invalid credentials" });
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user || !user.isActive) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const token = signToken(user);
  const { password: _p, ...safeUser } = user;
  const fullUser = await prisma.user.findUnique({ where: { id: user.id }, select: userSelect });
  await recordSecurityAudit({ organizationId: user.organizationId, actorId: user.id, action: "auth.login.succeeded", resourceType: "user", resourceId: user.id });
  const secure = process.env.NODE_ENV === "production";
  const csrfToken = crypto.randomBytes(32).toString("hex");
  res.cookie("stride_session", token, { httpOnly: true, secure, sameSite: "strict", maxAge: 15 * 60_000, path: "/" });
  res.cookie("stride_csrf", csrfToken, { httpOnly: false, secure, sameSite: "strict", maxAge: 15 * 60_000, path: "/" });
  return res.json({ user: fullUser });
}

export async function logout(_req: Request, res: Response) {
  const secure = process.env.NODE_ENV === "production";
  res.clearCookie("stride_session", { httpOnly: true, secure, sameSite: "strict", path: "/" });
  res.clearCookie("stride_csrf", { httpOnly: false, secure, sameSite: "strict", path: "/" });
  return res.status(204).send();
}

export async function me(req: AuthRequest, res: Response) {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: userSelect,
  });
  if (!user) return res.status(404).json({ message: "User not found" });
  return res.json(user);
}

export async function register(req: AuthRequest, res: Response) {
  const { name, email, password, role, departmentId, managerId } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: "name, email, password required" });
  }

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return res.status(409).json({ message: "Email already in use" });

  if (typeof password !== "string" || password.length < 12 || password.length > 128) return res.status(400).json({ message: "Password must be between 12 and 128 characters" });
  const organizationId = req.user!.organizationId;
  if (!organizationId) return res.status(403).json({ message: "Organization membership required" });
  const assignedRole = role && Object.values(Role).includes(role) ? role as Role : Role.EMPLOYEE;
  if (assignedRole === Role.FOUNDER) return res.status(403).json({ message: "Founder accounts must be provisioned by a platform administrator" });
  if (departmentId && !await prisma.department.findFirst({ where: { id: departmentId, organizationId } })) return res.status(400).json({ message: "Invalid department" });
  if (managerId && !await prisma.user.findFirst({ where: { id: managerId, organizationId, isActive: true } })) return res.status(400).json({ message: "Invalid manager" });
  const hashed = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { name, email: String(email).trim().toLowerCase(), password: hashed, role: assignedRole, departmentId, managerId, organizationId },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });
  await recordSecurityAudit({ organizationId, actorId: req.user!.id, action: "user.created", resourceType: "user", resourceId: user.id, metadata: { role: assignedRole } });
  return res.status(201).json(user);
}

export async function forgotPassword(req: Request, res: Response) {
  const { email } = req.body ?? {};
  if (!email || typeof email !== "string") {
    return res.status(400).json({ message: "Email is required" });
  }

  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user || !user.isActive) {
    return res.json({ message: "If that email exists, a reset link has been sent." });
  }

  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await prisma.passwordResetToken.create({
    data: { token, userId: user.id, expiresAt },
  });

  const resetUrl = `${process.env.FRONTEND_URL ?? "http://localhost:3000"}/reset-password?token=${token}`;
  console.log(`[PASSWORD RESET] Reset URL for ${user.email}: ${resetUrl}`);

  return res.json({ message: "If that email exists, a reset link has been sent." });
}

export async function resetPassword(req: Request, res: Response) {
  const { token, password } = req.body ?? {};
  if (!token || !password || typeof token !== "string" || typeof password !== "string") {
    return res.status(400).json({ message: "Token and new password are required" });
  }
  if (password.length < 8) {
    return res.status(400).json({ message: "Password must be at least 8 characters" });
  }

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    return res.status(400).json({ message: "This reset link is invalid or has expired" });
  }

  const hashed = await bcrypt.hash(password, 12);

  await prisma.$transaction([
    prisma.user.update({ where: { id: resetToken.userId }, data: { password: hashed } }),
    prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } }),
  ]);

  return res.json({ message: "Password updated. You can now log in." });
}
