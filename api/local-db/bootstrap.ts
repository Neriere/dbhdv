export default async function handler(req: any, res: any) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.status(200).end();
  }

  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    const profileId = Number(req.query?.profileId) || 1;

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
        items: [],
        recipes: [],
        prices: {},
        priceUpdatedAt: {},
        salesVolume: {},
        activePriceProfileId: profileId,
        priceProfiles: [
          { id: 1, name: "Draconiros", slug: "draconiros", isDefault: true, category: "monocuenta_clasico", categoryLabel: "Monocuenta Clásico" }
        ],
        syncStatus: { status: "idle", lastSync: Date.now() },
        syncSettings: { enabled: true, intervalDays: 30 },
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
              sql: `SELECT item_id, price, updated_at FROM profile_prices WHERE profile_id = ?`,
              args: [{ type: "integer", value: String(profileId) }],
            },
          },
          {
            type: "execute",
            stmt: {
              sql: `SELECT item_id, sales_24h, sales_7d, sales_30d, avg_daily_sales, suggested_price, price_strategy, updated_at FROM profile_sales_volume WHERE profile_id = ?`,
              args: [{ type: "integer", value: String(profileId) }],
            },
          },
          {
            type: "execute",
            stmt: {
              sql: `SELECT id, name, slug, is_default, category, category_label FROM price_profiles ORDER BY id ASC`,
              args: [],
            },
          },
          { type: "close" },
        ],
      }),
    });

    const data = await tursoRes.json();
    const priceRows = data?.results?.[0]?.response?.result?.rows || [];
    const volumeRows = data?.results?.[1]?.response?.result?.rows || [];
    const profileRows = data?.results?.[2]?.response?.result?.rows || [];

    const prices: Record<number, number> = {};
    const priceUpdatedAt: Record<number, number> = {};
    for (const r of priceRows) {
      const id = Number(r[0]?.value ?? r[0]);
      const p = Number(r[1]?.value ?? r[1]);
      const t = Number(r[2]?.value ?? r[2]);
      if (id > 0 && p > 0) {
        prices[id] = p;
        priceUpdatedAt[id] = t;
      }
    }

    const salesVolume: Record<number, any> = {};
    for (const r of volumeRows) {
      const id = Number(r[0]?.value ?? r[0]);
      if (id > 0) {
        salesVolume[id] = {
          sales24h: r[1]?.value != null ? Number(r[1]?.value ?? r[1]) : undefined,
          sales7d: r[2]?.value != null ? Number(r[2]?.value ?? r[2]) : undefined,
          sales30d: r[3]?.value != null ? Number(r[3]?.value ?? r[3]) : undefined,
          avgDailySales: r[4]?.value != null ? Number(r[4]?.value ?? r[4]) : undefined,
          suggestedPrice: r[5]?.value != null ? Number(r[5]?.value ?? r[5]) : undefined,
          priceStrategy: r[6]?.value ?? r[6] ?? undefined,
          updatedAt: Number(r[7]?.value ?? r[7]) || Date.now(),
        };
      }
    }

    const priceProfiles = profileRows.map((r: any) => ({
      id: Number(r[0]?.value ?? r[0]),
      name: String(r[1]?.value ?? r[1]),
      slug: String(r[2]?.value ?? r[2]),
      isDefault: Boolean(Number(r[3]?.value ?? r[3])),
      category: String((r[4]?.value ?? r[4]) || "monocuenta_clasico"),
      categoryLabel: String((r[5]?.value ?? r[5]) || "Monocuenta Clásico"),
    }));

    return res.status(200).json({
      items: [],
      recipes: [],
      prices,
      priceUpdatedAt,
      salesVolume,
      activePriceProfileId: profileId,
      priceProfiles: priceProfiles.length > 0 ? priceProfiles : [
        { id: 1, name: "Draconiros", slug: "draconiros", isDefault: true, category: "monocuenta_clasico", categoryLabel: "Monocuenta Clásico" }
      ],
      syncStatus: { status: "idle", lastSync: Date.now() },
      syncSettings: { enabled: true, intervalDays: 30 },
    });
  } catch (error: any) {
    console.error("[Bootstrap API Error]:", error);
    return res.status(500).json({
      error: error.message || "Error al cargar bootstrap",
    });
  }
}
