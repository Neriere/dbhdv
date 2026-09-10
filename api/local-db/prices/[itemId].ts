export default async function handler(req: any, res: any) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "PUT, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.status(200).end();
  }

  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    const itemId = Number(req.query?.itemId ?? req.query?.id);
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const price = Number(body?.price);
    const profileId = Number(body?.profileId) || 1;
    const now = Number(body?.updatedAt) || Date.now();

    if (!itemId || isNaN(itemId) || isNaN(price)) {
      return res.status(400).json({ error: "itemId y price válidos son requeridos" });
    }

    const cleanPrice = Math.max(0, Math.trunc(price));

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

    if (!dbUrl) {
      return res.status(200).json({
        prices: { [itemId]: cleanPrice },
        priceUpdatedAt: { [itemId]: now },
        activePriceProfileId: profileId,
        applied: true,
      });
    }

    const endpoint = dbUrl.endsWith("/v2/pipeline") ? dbUrl : `${dbUrl}/v2/pipeline`;

    // 1. Obtener precio anterior
    const prevRes = await fetch(endpoint, {
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
              sql: `SELECT price FROM profile_prices WHERE profile_id = ? AND item_id = ?`,
              args: [
                { type: "integer", value: String(profileId) },
                { type: "integer", value: String(itemId) },
              ],
            },
          },
          { type: "close" },
        ],
      }),
    });

    const prevData = await prevRes.json();
    const prevRows = prevData?.results?.[0]?.response?.result?.rows || [];
    const oldPrice = prevRows.length > 0 ? Number(prevRows[0][0]?.value ?? prevRows[0][0]) || 0 : 0;

    const pipelineRequests: any[] = [
      {
        type: "execute",
        stmt: {
          sql: `INSERT INTO profile_prices (profile_id, item_id, price, updated_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(profile_id, item_id) DO UPDATE SET price = excluded.price, updated_at = excluded.updated_at`,
          args: [
            { type: "integer", value: String(profileId) },
            { type: "integer", value: String(itemId) },
            { type: "integer", value: String(cleanPrice) },
            { type: "integer", value: String(now) },
          ],
        },
      },
    ];

    if (cleanPrice !== oldPrice) {
      const diff = cleanPrice - oldPrice;
      const pct = oldPrice > 0 ? ((cleanPrice - oldPrice) / oldPrice) * 100 : (cleanPrice > 0 ? 100 : 0);

      pipelineRequests.push({
        type: "execute",
        stmt: {
          sql: `INSERT INTO price_history (profile_id, item_id, price, old_price, difference, percentage_change, source, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, 'manual', ?)`,
          args: [
            { type: "integer", value: String(profileId) },
            { type: "integer", value: String(itemId) },
            { type: "integer", value: String(cleanPrice) },
            { type: "integer", value: String(oldPrice) },
            { type: "integer", value: String(diff) },
            { type: "float", value: Number(pct.toFixed(2)) },
            { type: "integer", value: String(now) },
          ],
        },
      });
    }

    await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${dbToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: [...pipelineRequests, { type: "close" }],
      }),
    });

    return res.status(200).json({
      prices: { [itemId]: cleanPrice },
      priceUpdatedAt: { [itemId]: now },
      activePriceProfileId: profileId,
      applied: true,
    });
  } catch (error: any) {
    console.error("[Set Price API Error]:", error);
    return res.status(500).json({
      error: error.message || "Error al actualizar precio",
    });
  }
}
