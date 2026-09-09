const SERVER_MAP: Record<string, number> = {
  draconiros: 1,
  talok: 2,
  dakart: 3,
  boune: 4,
  crail: 5,
  eratz: 6,
  galgarion: 7,
  henual: 8,
  imagiro: 9,
  orukam: 10,
  tylezia: 11,
};

// In-memory short cache for identical poll requests within 1.5s to prevent hammering Turso
const recentPollCache = new Map<string, { time: number; response: any }>();

export default async function handler(req: any, res: any) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.status(200).end();
  }

  try {
    const serverParam = (req.query?.server as string) || "";
    const profileIdParam = req.query?.profileId
      ? Number(req.query.profileId)
      : 0;
    const sinceParam = req.query?.since ? Number(req.query.since) : 0;

    let targetProfileId = profileIdParam;
    if (!targetProfileId) {
      const clean = serverParam.trim().toLowerCase();
      targetProfileId = SERVER_MAP[clean] || 1;
    }

    const now = Date.now();
    const cacheKey = `${targetProfileId}:${sinceParam}`;
    const cached = recentPollCache.get(cacheKey);

    if (cached && (now - cached.time) < 1500) {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cache-Control", "public, max-age=1, s-maxage=2, stale-while-revalidate=4");
      return res.status(200).json(cached.response);
    }

    const prices: Record<number, number> = {};
    const priceUpdatedAt: Record<number, number> = {};
    let totalUpdated = 0;
    const serverTime = now;

    const dbUrl = (
      process.env.TURSO_DATABASE_URL ||
      process.env.LIBSQL_URL ||
      process.env.DATABASE_URL ||
      ""
    )
      .trim()
      .replace(/^libsql:\/\//, "https://");
    const dbToken = (
      process.env.TURSO_AUTH_TOKEN ||
      process.env.LIBSQL_AUTH_TOKEN ||
      process.env.DATABASE_AUTH_TOKEN ||
      ""
    ).trim();

    if (dbUrl) {
      const endpoint = dbUrl.endsWith("/v2/pipeline")
        ? dbUrl
        : `${dbUrl}/v2/pipeline`;

      const querySql = sinceParam > 0
        ? "SELECT item_id, price, updated_at FROM profile_prices WHERE profile_id = ? AND updated_at >= ? ORDER BY updated_at ASC LIMIT 1000"
        : "SELECT item_id, price, updated_at FROM profile_prices WHERE profile_id = ? ORDER BY updated_at DESC LIMIT 2000";

      const queryArgs = sinceParam > 0
        ? [
            { type: "integer", value: String(targetProfileId) },
            { type: "integer", value: String(sinceParam) },
          ]
        : [{ type: "integer", value: String(targetProfileId) }];

      const tursoRes = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${dbToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requests: [
            {
              type: "execute",
              stmt: {
                sql: querySql,
                args: queryArgs,
              },
            },
            { type: "close" },
          ],
        }),
      });

      if (tursoRes.ok) {
        const data = await tursoRes.json();
        const executeResult = data?.results?.[0]?.response?.result;
        const rows = executeResult?.rows || [];

        for (const row of rows) {
          if (Array.isArray(row) && row.length >= 3) {
            const itemId = Number(row[0]?.value ?? row[0]);
            const price = Number(row[1]?.value ?? row[1]);
            const updatedAt = Number(row[2]?.value ?? row[2]);

            if (itemId > 0 && price > 0) {
              prices[itemId] = price;
              priceUpdatedAt[itemId] = updatedAt;
              totalUpdated++;
            }
          }
        }
      }
    }

    const payload = {
      success: true,
      profile_id: targetProfileId,
      prices,
      priceUpdatedAt,
      serverTime,
      totalUpdated,
    };

    // Store in short cache (clean old keys if map exceeds 50 entries)
    if (recentPollCache.size > 50) {
      recentPollCache.clear();
    }
    recentPollCache.set(cacheKey, { time: now, response: payload });

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=1, s-maxage=2, stale-while-revalidate=4");
    return res.status(200).json(payload);
  } catch (error: any) {
    console.error("[Market Latest Prices API Error]:", error);
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(500).json({
      error: error.message || "Error al obtener precios recientes",
    });
  }
}
