import { NextFunction, Request, Response } from "express";

type Bucket = { count: number; resetAt: number };

export function rateLimit(options: { windowMs: number; max: number; key?: (req: Request) => string; message?: string }) {
  const buckets = new Map<string, Bucket>();
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
  }, Math.min(options.windowMs, 60_000));
  timer.unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = options.key?.(req) ?? req.ip ?? req.socket.remoteAddress ?? "unknown";
    const existing = buckets.get(key);
    const bucket = !existing || existing.resetAt <= now ? { count: 0, resetAt: now + options.windowMs } : existing;
    bucket.count += 1;
    buckets.set(key, bucket);
    res.setHeader("RateLimit-Limit", String(options.max));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, options.max - bucket.count)));
    res.setHeader("RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));
    if (bucket.count > options.max) {
      res.setHeader("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)));
      return res.status(429).json({ message: options.message ?? "Too many requests. Try again later." });
    }
    next();
  };
}

export const apiRateLimit = rateLimit({ windowMs: 15 * 60_000, max: 300 });
export const loginRateLimit = rateLimit({
  windowMs: 15 * 60_000,
  max: 10,
  key: (req) => `${req.ip}:${String(req.body?.email ?? "").trim().toLowerCase()}`,
  message: "Too many login attempts. Try again later.",
});
export const uploadRateLimit = rateLimit({ windowMs: 60 * 60_000, max: 30 });
