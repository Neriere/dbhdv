import type { Request, Response, NextFunction } from "express";

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const { method, originalUrl } = req;

  // Don't log spammy SSE heartbeat connections continuously
  if (originalUrl === "/api/market/live-stream") {
    next();
    return;
  }

  res.on("finish", () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    // Log failures or requests taking longer than 200ms, or all non-GET requests
    if (status >= 400 || duration > 300 || method !== "GET") {
      const timestamp = new Date().toISOString();
      console.log(`[HTTP] ${timestamp} ${method} ${originalUrl} ${status} - ${duration}ms`);
    }
  });

  next();
}
