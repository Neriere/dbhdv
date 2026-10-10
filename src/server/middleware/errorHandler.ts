import type { Request, Response, NextFunction, ErrorRequestHandler } from "express";

export const errorHandler: ErrorRequestHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const status = typeof err?.status === "number" ? err.status : 500;
  const message = err?.message || "Internal server error";

  console.error(`[Server Error] [Status ${status}]:`, err);

  if (!res.headersSent) {
    res.status(status).json({
      error: message,
      details: process.env.NODE_ENV !== "production" ? err?.stack : undefined,
    });
  }
};
