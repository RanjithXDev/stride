import { NextFunction, Request, Response } from "express";

export class ApiError extends Error {
  constructor(public readonly status: number, message: string, public readonly code = "REQUEST_FAILED", public readonly details?: unknown) {
    super(message);
  }
}

export function apiErrorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof ApiError) {
    return res.status(error.status).json({ message: error.message, error: { code: error.code, message: error.message, details: error.details } });
  }
  console.error(error);
  return res.status(500).json({ message: "An unexpected error occurred", error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } });
}
