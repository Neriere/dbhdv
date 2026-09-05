import { getSyncStatus } from "../../src/server/localDataStore";

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const status = await getSyncStatus();
    return res.status(200).json(status);
  } catch (error: any) {
    console.error("[API local-db/sync-status Error]:", error);
    return res.status(500).json({ error: "Failed to load sync status", details: error?.message });
  }
}
