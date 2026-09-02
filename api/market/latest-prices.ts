import {
  getProfileIdByServerNameOrSlug,
  getLatestMarketPricesDelta,
} from "../../src/server/localDataStore";

export default async function handler(req: any, res: any) {
  try {
    const serverParam = (req.query?.server as string) || "";
    const profileIdParam = req.query?.profileId
      ? Number(req.query.profileId)
      : 0;
    const sinceParam = req.query?.since ? Number(req.query.since) : 0;

    let targetProfileId = profileIdParam;
    if (!targetProfileId) {
      const { profileId } = await getProfileIdByServerNameOrSlug(serverParam);
      targetProfileId = profileId;
    }

    const result = await getLatestMarketPricesDelta(
      targetProfileId,
      sinceParam,
    );
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    return res.status(200).json({
      success: true,
      profile_id: targetProfileId,
      ...result,
    });
  } catch (error: any) {
    console.error("[Market Latest Prices API Error]:", error);
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(500).json({
      error: error.message || "Error al obtener precios recientes",
    });
  }
}
