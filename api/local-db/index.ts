import { app } from "../../src/server/expressApp";

export default function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.url && !req.url.startsWith("/api/local-db")) {
    const cleanUrl = req.url.startsWith("/") ? req.url : `/${req.url}`;
    req.url = `/api/local-db${cleanUrl}`;
  }

  return app(req, res);
}
