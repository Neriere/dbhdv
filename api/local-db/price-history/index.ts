export default async function handler(req: any, res: any) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.status(200).end();
  }

  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
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
        entries: [],
        total: 0,
        page: 1,
        limit: 50,
        totalPages: 1,
      });
    }

    const endpoint = dbUrl.endsWith("/v2/pipeline") ? dbUrl : `${dbUrl}/v2/pipeline`;

    if (req.method === "DELETE") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
      const profileId = Number(body?.profileId || req.query?.profileId) || 1;
      const itemId = Number(body?.itemId || req.query?.itemId);

      const sql = itemId
        ? "DELETE FROM price_history WHERE profile_id = ? AND item_id = ?"
        : "DELETE FROM price_history WHERE profile_id = ?";
      const args = itemId
        ? [{ type: "integer", value: String(profileId) }, { type: "integer", value: String(itemId) }]
        : [{ type: "integer", value: String(profileId) }];

      await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${dbToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requests: [{ type: "execute", stmt: { sql, args } }, { type: "close" }],
        }),
      });

      return res.status(200).json({ success: true });
    }

    // GET general price history
    const profileId = Number(req.query?.profileId) || 1;
    const limit = Math.min(100, Math.max(1, Number(req.query?.limit) || 50));
    const offset = Math.max(0, Number(req.query?.offset) || 0);

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
                WHERE h.profile_id = ?
                ORDER BY h.timestamp DESC, h.id DESC
                LIMIT ? OFFSET ?
              `,
              args: [
                { type: "integer", value: String(profileId) },
                { type: "integer", value: String(limit) },
                { type: "integer", value: String(offset) },
              ],
            },
          },
          {
            type: "execute",
            stmt: {
              sql: `SELECT COUNT(*) as count FROM price_history WHERE profile_id = ?`,
              args: [{ type: "integer", value: String(profileId) }],
            },
          },
          { type: "close" },
        ],
      }),
    });

    const data = await tursoRes.json();
    const rows = data?.results?.[0]?.response?.result?.rows || [];
    const countRows = data?.results?.[1]?.response?.result?.rows || [];
    const total = Number(countRows[0]?.[0]?.value ?? countRows[0]?.[0]) || 0;

    const entries = rows.map((row: any) => ({
      id: Number(row[0]?.value ?? row[0]),
      profileId: Number(row[1]?.value ?? row[1]),
      itemId: Number(row[2]?.value ?? row[2]),
      price: Number(row[3]?.value ?? row[3]),
      oldPrice: Number(row[4]?.value ?? row[4]),
      difference: Number(row[5]?.value ?? row[5]),
      percentageChange: Number(row[6]?.value ?? row[6]),
      source: String(row[7]?.value ?? row[7] ?? "manual"),
      timestamp: Number(row[8]?.value ?? row[8]),
      itemName: String(row[9]?.value ?? row[9] ?? `Objeto #${row[2]?.value ?? row[2]}`),
      itemIconId: Number(row[10]?.value ?? row[10]) || Number(row[2]?.value ?? row[2]),
      itemLevel: Number(row[11]?.value ?? row[11]) || 1,
      itemTypeId: Number(row[12]?.value ?? row[12]) || 0,
    }));

    return res.status(200).json({
      entries,
      total,
      page: Math.floor(offset / limit) + 1,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (error: any) {
    console.error("[Price History API Error]:", error);
    return res.status(500).json({
      error: error.message || "Error al obtener historial",
    });
  }
}
