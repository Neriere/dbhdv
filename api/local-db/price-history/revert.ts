export default async function handler(req: any, res: any) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.status(200).end();
  }

  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const historyId = Number(body?.historyId);

    if (!historyId || isNaN(historyId)) {
      return res.status(400).json({ error: "historyId es requerido" });
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
      return res.status(500).json({ error: "Base de datos no configurada" });
    }

    const endpoint = dbUrl.endsWith("/v2/pipeline") ? dbUrl : `${dbUrl}/v2/pipeline`;

    // 1. Obtener datos de la entrada del historial
    const entryRes = await fetch(endpoint, {
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
              sql: `SELECT profile_id, item_id, old_price, price FROM price_history WHERE id = ?`,
              args: [{ type: "integer", value: String(historyId) }],
            },
          },
          { type: "close" },
        ],
      }),
    });

    const data = await entryRes.json();
    const rows = data?.results?.[0]?.response?.result?.rows || [];

    if (rows.length === 0) {
      return res.status(404).json({ error: "Entrada de historial no encontrada" });
    }

    const row = rows[0];
    const profileId = Number(row[0]?.value ?? row[0]);
    const itemId = Number(row[1]?.value ?? row[1]);
    const targetPrice = Number(row[2]?.value ?? row[2]);
    const now = Date.now();

    // 2. Revertir el precio en profile_prices y registrar en price_history
    await fetch(endpoint, {
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
              sql: `INSERT INTO profile_prices (profile_id, item_id, price, updated_at)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(profile_id, item_id) DO UPDATE SET price = excluded.price, updated_at = excluded.updated_at`,
              args: [
                { type: "integer", value: String(profileId) },
                { type: "integer", value: String(itemId) },
                { type: "integer", value: String(targetPrice) },
                { type: "integer", value: String(now) },
              ],
            },
          },
          {
            type: "execute",
            stmt: {
              sql: `INSERT INTO price_history (profile_id, item_id, price, old_price, difference, percentage_change, source, timestamp)
                    VALUES (?, ?, ?, ?, ?, ?, 'revert', ?)`,
              args: [
                { type: "integer", value: String(profileId) },
                { type: "integer", value: String(itemId) },
                { type: "integer", value: String(targetPrice) },
                { type: "integer", value: String(row[3]?.value ?? row[3] ?? 0) },
                { type: "integer", value: String(targetPrice - Number(row[3]?.value ?? row[3] ?? 0)) },
                { type: "float", value: 0 },
                { type: "integer", value: String(now) },
              ],
            },
          },
          { type: "close" },
        ],
      }),
    });

    return res.status(200).json({
      success: true,
      itemId,
      revertedPrice: targetPrice,
    });
  } catch (error: any) {
    console.error("[Revert Price History API Error]:", error);
    return res.status(500).json({
      error: error.message || "Error al revertir precio",
    });
  }
}
