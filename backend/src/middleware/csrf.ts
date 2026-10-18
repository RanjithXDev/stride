import crypto from "crypto";
import { NextFunction, Request, Response } from "express";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method) || !req.cookies?.stride_session) return next();
  const cookie = String(req.cookies.stride_csrf ?? "");
  const header = String(req.headers["x-csrf-token"] ?? "");
  const valid = cookie.length === 64 && header.length === cookie.length && crypto.timingSafeEqual(Buffer.from(cookie), Buffer.from(header));
  if (!valid) return res.status(403).json({ message: "Invalid CSRF token" });
  next();
}
