import type { Request } from "express";

export function verifySnifferAuth(req: Request): boolean {
  const secret =
    process.env.MARKET_SNIFFER_SECRET || process.env.SNIFFER_SECRET;
  if (!secret || secret.trim() === "") {
    return true; // No secret configured -> open access
  }
  const cleanSecret = secret.trim();
  const headerKey =
    req.headers["x-api-key"] ||
    req.headers["x-market-sniffer-secret"] ||
    (typeof req.headers["authorization"] === "string"
      ? req.headers["authorization"].replace(/^Bearer\s+/i, "")
      : undefined) ||
    (typeof req.query.key === "string" ? req.query.key : undefined) ||
    (typeof req.query.api_key === "string" ? req.query.api_key : undefined);

  return typeof headerKey === "string" && headerKey.trim() === cleanSecret;
}
