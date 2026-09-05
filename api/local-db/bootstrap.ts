import { getBootstrapData, changeActivePriceProfile } from "../../src/server/localDataStore";

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key");
  res.setHeader("Cache-Control", "public, max-age=15, s-maxage=60, stale-while-revalidate=300");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const profileIdParam = Number(req.query?.profileId);
    if (profileIdParam && !Number.isNaN(profileIdParam) && profileIdParam > 0) {
      await changeActivePriceProfile(profileIdParam);
    }
    const data = await getBootstrapData();
    return res.status(200).json(data);
  } catch (error: any) {
    console.error("[API local-db/bootstrap Error]:", error);
    return res.status(500).json({ error: "Failed to load bootstrap data", details: error?.message });
  }
}
