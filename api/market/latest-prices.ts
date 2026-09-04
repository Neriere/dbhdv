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

    const prices: Record<number, number> = {};
    const priceUpdatedAt: Record<number, number> = {};
    let totalUpdated = 0;
    const serverTime = Date.now();

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
                sql: "SELECT item_id, price, updated_at FROM profile_prices WHERE profile_id = ? AND updated_at >= ? ORDER BY updated_at ASC",
                args: [
                  { type: "integer", value: String(targetProfileId) },
                  { type: "integer", value: String(sinceParam) },
                ],
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

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    return res.status(200).json({
      success: true,
      profile_id: targetProfileId,
      prices,
      priceUpdatedAt,
      serverTime,
      totalUpdated,
    });
  } catch (error: any) {
    console.error("[Market Latest Prices API Error]:", error);
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(500).json({
      error: error.message || "Error al obtener precios recientes",
    });
  }
}
