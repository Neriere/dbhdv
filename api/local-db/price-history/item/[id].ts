export default async function handler(req: any, res: any) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.status(200).end();
  }

  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    const itemId = Number(req.query?.id ?? req.query?.itemId);
    const profileId = Number(req.query?.profileId) || 1;

    if (!itemId || isNaN(itemId)) {
      return res.status(400).json({ error: "itemId inválido o requerido" });
    }

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
        itemId,
        history: [],
        minPrice: 0,
        maxPrice: 0,
        avgPrice: 0,
        currentPrice: 0,
        firstRecordedAt: Date.now(),
        lastUpdatedAt: Date.now(),
        totalChanges: 0,
      });
    }

    const endpoint = dbUrl.endsWith("/v2/pipeline") ? dbUrl : `${dbUrl}/v2/pipeline`;

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
              sql: `
                SELECT 
                  h.id,
                  h.profile_id,
                  h.item_id,
                  h.price,
                  h.old_price,
                  h.difference,
                  h.percentage_change,
                  h.source,
                  h.timestamp,
                  i.name_es as item_name,
                  i.icon_id as item_icon_id,
                  i.level as item_level,
                  i.type_id as item_type_id
                FROM price_history h
                LEFT JOIN items i ON h.item_id = i.id
                WHERE h.profile_id = ? AND h.item_id = ?
                ORDER BY h.timestamp ASC, h.id ASC
              `,
              args: [
                { type: "integer", value: String(profileId) },
                { type: "integer", value: String(itemId) },
              ],
            },
          },
          {
            type: "execute",
            stmt: {
              sql: `SELECT price, updated_at FROM profile_prices WHERE profile_id = ? AND item_id = ?`,
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

    if (!tursoRes.ok) {
      throw new Error(`Turso returned HTTP ${tursoRes.status}`);
    }

    const data = await tursoRes.json();
    const historyRows = data?.results?.[0]?.response?.result?.rows || [];
    const currentPriceRows = data?.results?.[1]?.response?.result?.rows || [];

    const history: any[] = historyRows.map((row: any) => ({
      id: Number(row[0]?.value ?? row[0]),
      profileId: Number(row[1]?.value ?? row[1]),
      itemId: Number(row[2]?.value ?? row[2]),
      price: Number(row[3]?.value ?? row[3]),
      oldPrice: Number(row[4]?.value ?? row[4]),
      difference: Number(row[5]?.value ?? row[5]),
      percentageChange: Number(row[6]?.value ?? row[6]),
      source: String(row[7]?.value ?? row[7] ?? "manual"),
      timestamp: Number(row[8]?.value ?? row[8]),
      itemName: String(row[9]?.value ?? row[9] ?? `Objeto #${itemId}`),
      itemIconId: Number(row[10]?.value ?? row[10]) || itemId,
      itemLevel: Number(row[11]?.value ?? row[11]) || 1,
      itemTypeId: Number(row[12]?.value ?? row[12]) || 0,
    }));

    let currentPrice = 0;
    let lastUpdatedAt = Date.now();
    if (currentPriceRows.length > 0) {
      const cRow = currentPriceRows[0];
      currentPrice = Number(cRow[0]?.value ?? cRow[0]) || 0;
      lastUpdatedAt = Number(cRow[1]?.value ?? cRow[1]) || Date.now();
    }

    const pricesList = history.map((h) => h.price).filter((p) => p > 0);
    if (currentPrice > 0 && !pricesList.includes(currentPrice)) {
      pricesList.push(currentPrice);
    }

    if (history.length === 0 && currentPrice > 0) {
      history.push({
        id: 0,
        profileId,
        itemId,
        itemName: `Objeto #${itemId}`,
        itemIconId: itemId,
        itemLevel: 1,
        itemTypeId: 0,
        price: currentPrice,
        oldPrice: 0,
        difference: 0,
        percentageChange: 0,
        source: "actual",
        timestamp: lastUpdatedAt,
      });
    }

    const minPrice = pricesList.length > 0 ? Math.min(...pricesList) : currentPrice;
    const maxPrice = pricesList.length > 0 ? Math.max(...pricesList) : currentPrice;
    const avgPrice = pricesList.length > 0 ? Math.round(pricesList.reduce((a, b) => a + b, 0) / pricesList.length) : currentPrice;
    const firstRecordedAt = history.length > 0 ? history[0].timestamp : lastUpdatedAt;

    return res.status(200).json({
      itemId,
      history,
      minPrice,
      maxPrice,
      avgPrice,
      currentPrice,
      firstRecordedAt,
      lastUpdatedAt,
      totalChanges: history.length === 1 && history[0].id === 0 ? 0 : history.length,
    });
  } catch (error: any) {
    console.error("[Item Price History API Error]:", error);
    return res.status(500).json({
      error: error.message || "Error al obtener historial del objeto",
    });
  }
}
