const SERVER_MAP: Record<string, number> = {
  draconiros: 1,
  talok: 2,
  mikhal: 2,
  talkasha: 3,
  "tal-kasha": 3,
  dakart: 3,
  boune: 4,
  rafal: 4,
  crail: 5,
  dakal: 5,
  eratz: 6,
  brial: 6,
  galgarion: 7,
  kourial: 7,
  henual: 8,
  salar: 8,
  imagiro: 9,
  tylezia: 10,
  hellmina: 11,
  "hell-mina": 11,
  orukam: 12,
};

function getTursoClient() {
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

  const endpoint = dbUrl ? (dbUrl.endsWith("/v2/pipeline") ? dbUrl : `${dbUrl}/v2/pipeline`) : "";
  return { dbUrl, dbToken, endpoint };
}

async function queryTurso(endpoint: string, dbToken: string, requests: any[]) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${dbToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: [...requests, { type: "close" }],
    }),
  });
  if (!res.ok) {
    throw new Error(`Turso HTTP error ${res.status}`);
  }
  return await res.json();
}

function extractPathSegments(req: any, basePath: string): string[] {
  const candidates = [
    req.query?.["...path"],
    req.query?.path,
    req.query?.["[...path]"],
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length > 0) {
      const segs = candidate
        .map((s) => decodeURIComponent(String(s)).trim())
        .filter(Boolean);
      if (segs[0] === basePath) return segs.slice(1);
      return segs;
    }
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      const segs = decodeURIComponent(candidate)
        .split("/")
        .map((s) => s.trim())
        .filter(Boolean);
      if (segs[0] === basePath) return segs.slice(1);
      return segs;
    }
  }

  if (req.url && typeof req.url === "string") {
    const pathname = decodeURIComponent(req.url.split("?")[0] || "");
    const segments = pathname.split("/").filter(Boolean);
    const idx = segments.indexOf(basePath);
    if (idx !== -1) {
      return segments.slice(idx + 1);
    }
    if (segments[0] === "api") {
      return segments.slice(1);
    }
    return segments;
  }

  return [];
}


export default async function handler(req: any, res: any) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.status(200).end();
  }

  res.setHeader("Access-Control-Allow-Origin", "*");

  const { dbUrl, dbToken, endpoint } = getTursoClient();
  const pathSegments = extractPathSegments(req, "local-db");
  const route0 = pathSegments[0] || "";
  const route1 = pathSegments[1] || "";
  const route2 = pathSegments[2] || "";

  try {
    // -------------------------------------------------------------------------
    // 1. BOOTSTRAP: GET /api/local-db/bootstrap
    // -------------------------------------------------------------------------
    if (route0 === "bootstrap") {
      const profileId = Number(req.query?.profileId) || 1;
      if (!endpoint) {
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

      const data = await queryTurso(endpoint, dbToken, [
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
      ]);

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
    }

    // -------------------------------------------------------------------------
    // 2. ITEM PRICE HISTORY: GET /api/local-db/price-history/item/:id
    // -------------------------------------------------------------------------
    if (route0 === "price-history" && route1 === "item") {
      const itemId = Number(route2 || req.query?.id || req.query?.itemId);
      const profileId = Number(req.query?.profileId) || 1;

      if (!itemId || isNaN(itemId)) {
        return res.status(400).json({ error: "itemId inválido o requerido" });
      }

      if (!endpoint) {
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

      const data = await queryTurso(endpoint, dbToken, [
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
      ]);

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
    }

    // -------------------------------------------------------------------------
    // 3. REVERT PRICE HISTORY: POST /api/local-db/price-history/revert
    // -------------------------------------------------------------------------
    if (route0 === "price-history" && route1 === "revert") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
      const historyId = Number(body?.historyId);

      if (!historyId || isNaN(historyId)) {
        return res.status(400).json({ error: "historyId es requerido" });
      }

      const data = await queryTurso(endpoint, dbToken, [
        {
          type: "execute",
          stmt: {
            sql: `SELECT profile_id, item_id, old_price, price FROM price_history WHERE id = ?`,
            args: [{ type: "integer", value: String(historyId) }],
          },
        },
      ]);

      const rows = data?.results?.[0]?.response?.result?.rows || [];
      if (rows.length === 0) {
        return res.status(404).json({ error: "Entrada de historial no encontrada" });
      }

      const row = rows[0];
      const profileId = Number(row[0]?.value ?? row[0]);
      const itemId = Number(row[1]?.value ?? row[1]);
      const targetPrice = Number(row[2]?.value ?? row[2]);
      const now = Date.now();

      await queryTurso(endpoint, dbToken, [
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
      ]);

      return res.status(200).json({
        success: true,
        itemId,
        revertedPrice: targetPrice,
      });
    }

    // -------------------------------------------------------------------------
    // 4. GENERAL PRICE HISTORY: GET / DELETE /api/local-db/price-history
    // -------------------------------------------------------------------------
    if (route0 === "price-history" && !route1) {
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

        await queryTurso(endpoint, dbToken, [{ type: "execute", stmt: { sql, args } }]);
        return res.status(200).json({ success: true });
      }

      const profileId = Number(req.query?.profileId) || 1;
      const limit = Math.min(100, Math.max(1, Number(req.query?.limit) || 50));
      const offset = Math.max(0, Number(req.query?.offset) || 0);

      const data = await queryTurso(endpoint, dbToken, [
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
      ]);

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
    }

    // -------------------------------------------------------------------------
    // 5. SET ITEM PRICE: PUT / POST /api/local-db/prices/:itemId
    // -------------------------------------------------------------------------
    if (route0 === "prices" && route1) {
      const itemId = Number(route1);
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
      const price = Number(body?.price);
      const profileId = Number(body?.profileId) || 1;
      const now = Number(body?.updatedAt) || Date.now();

      if (!itemId || isNaN(itemId) || isNaN(price)) {
        return res.status(400).json({ error: "itemId y price válidos son requeridos" });
      }

      const cleanPrice = Math.max(0, Math.trunc(price));

      if (!endpoint) {
        return res.status(200).json({
          prices: { [itemId]: cleanPrice },
          priceUpdatedAt: { [itemId]: now },
          activePriceProfileId: profileId,
          applied: true,
        });
      }

      // Obtener precio previo
      const prevData = await queryTurso(endpoint, dbToken, [
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
      ]);

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

      await queryTurso(endpoint, dbToken, pipelineRequests);

      return res.status(200).json({
        prices: { [itemId]: cleanPrice },
        priceUpdatedAt: { [itemId]: now },
        activePriceProfileId: profileId,
        applied: true,
      });
    }

    // -------------------------------------------------------------------------
    // 6. BULK COEFFICIENTS: POST /api/local-db/coefficients/bulk
    // -------------------------------------------------------------------------
    if (route0 === "coefficients" && route1 === "bulk") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
      const entries = Array.isArray(body?.entries) ? body.entries : [];
      let profileId = Number(body?.profileId || 0);

      if (!profileId) {
        const serverParam = (body?.serverSlug || body?.server || "").trim().toLowerCase();
        profileId = SERVER_MAP[serverParam] || 1;
      }

      if (endpoint && entries.length > 0) {
        const requests: any[] = [];
        const now = Date.now();

        for (const entry of entries) {
          const itemId = Number(entry.itemId);
          const coefficient = Number(entry.coefficient);
          const updatedAt = Number(entry.updatedAt || now);

          if (itemId > 0 && !isNaN(coefficient)) {
            requests.push({
              type: "execute",
              stmt: {
                sql: `INSERT INTO profile_coefficients (profile_id, item_id, coefficient, updated_at)
                      VALUES (?, ?, ?, ?)
                      ON CONFLICT(profile_id, item_id) DO UPDATE SET
                        coefficient = excluded.coefficient,
                        updated_at = excluded.updated_at`,
                args: [
                  { type: "integer", value: String(profileId) },
                  { type: "integer", value: String(itemId) },
                  { type: "integer", value: String(coefficient) },
                  { type: "integer", value: String(updatedAt) },
                ],
              },
            });
          }
        }

        if (requests.length > 0) {
          const CHUNK_SIZE = 100;
          for (let i = 0; i < requests.length; i += CHUNK_SIZE) {
            const chunk = requests.slice(i, i + CHUNK_SIZE);
            await queryTurso(endpoint, dbToken, chunk).catch((err) =>
              console.warn("[Turso Bulk Coeff Error]:", err)
            );
          }
        }
      }

      return res.status(200).json({
        success: true,
        profileId,
        updatedCount: entries.length,
      });
    }

    // -------------------------------------------------------------------------
    // 7. ITEMS BY ID: GET /api/local-db/items/:id
    //    Fetches item data from DofusDB API (since Vercel has no local SQLite)
    // -------------------------------------------------------------------------
    if (route0 === "items" && route1) {
      const itemId = Number(route1);
      if (!itemId || isNaN(itemId)) {
        return res.status(400).json({ error: "Invalid item id" });
      }

      res.setHeader(
        "Cache-Control",
        "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      );

      // Try Turso items table first
      if (endpoint) {
        try {
          const data = await queryTurso(endpoint, dbToken, [
            {
              type: "execute",
              stmt: {
                sql: `SELECT id, name_es, name_fr, name_en, level, type_id, icon_id, super_type_id FROM items WHERE id = ?`,
                args: [{ type: "integer", value: String(itemId) }],
              },
            },
          ]);
          const rows = data?.results?.[0]?.response?.result?.rows || [];
          if (rows.length > 0) {
            const r = rows[0];
            return res.status(200).json({
              id: Number(r[0]?.value ?? r[0]),
              name: {
                es: String(r[1]?.value ?? r[1] ?? `Objeto #${itemId}`),
                fr: String(r[2]?.value ?? r[2] ?? ""),
                en: String(r[3]?.value ?? r[3] ?? ""),
              },
              level: Number(r[4]?.value ?? r[4]) || 1,
              type: {
                id: Number(r[5]?.value ?? r[5]) || 0,
                superCategoryId: Number(r[7]?.value ?? r[7]) || 0,
                name: { es: "", fr: "", en: "" },
              },
              iconId: Number(r[6]?.value ?? r[6]) || itemId,
            });
          }
        } catch {
          // fallback to DofusDB
        }
      }

      // Fallback to DofusDB external API
      try {
        const dofusRes = await fetch(
          `https://api.dofusdb.fr/items?id=${itemId}&lang=es`,
          { headers: { Accept: "application/json" } }
        );
        if (dofusRes.ok) {
          const dofusData = await dofusRes.json();
          const items = (dofusData as any)?.data || [];
          if (items.length > 0) {
            const raw = items[0];
            return res.status(200).json({
              id: raw.id || itemId,
              name: {
                es: raw.name?.es || raw.name || `Objeto #${itemId}`,
                fr: raw.name?.fr || "",
                en: raw.name?.en || "",
              },
              level: raw.level || 1,
              type: raw.type || { id: raw.typeId || 0, superCategoryId: 0, name: { es: "", fr: "", en: "" } },
              iconId: raw.iconId || raw.icon_id || itemId,
              img: raw.img || undefined,
            });
          }
        }
      } catch {
        // DofusDB unavailable
      }

      return res.status(200).json(null);
    }

    // -------------------------------------------------------------------------
    // 7b. RECIPES BY RESULT ID: GET /api/local-db/recipes/:resultId
    // -------------------------------------------------------------------------
    if (route0 === "recipes" && route1) {
      const resultId = Number(route1);
      if (!resultId || isNaN(resultId)) {
        return res.status(400).json({ error: "Invalid result id" });
      }

      res.setHeader(
        "Cache-Control",
        "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      );

      // Try Turso recipes table first
      if (endpoint) {
        try {
          const data = await queryTurso(endpoint, dbToken, [
            {
              type: "execute",
              stmt: {
                sql: `SELECT payload_json FROM recipes WHERE result_id = ?`,
                args: [{ type: "integer", value: String(resultId) }],
              },
            },
          ]);
          const rows = data?.results?.[0]?.response?.result?.rows || [];
          if (rows.length > 0) {
            const rawJson = rows[0][0]?.value ?? rows[0][0];
            if (rawJson) {
              const parsed = typeof rawJson === "string" ? JSON.parse(rawJson) : rawJson;
              return res.status(200).json(parsed);
            }
          }
        } catch {
          // fallback to DofusDB
        }
      }

      // Fallback to DofusDB external API
      try {
        const dofusRes = await fetch(
          `https://api.dofusdb.fr/recipes?resultId=${resultId}&lang=es`,
          { headers: { Accept: "application/json" } }
        );
        if (dofusRes.ok) {
          const dofusData = await dofusRes.json();
          const list = (dofusData as any)?.data || [];
          if (list.length > 0) {
            const raw = list[0];
            const ingredientIds: number[] = [];
            const quantities: number[] = [];

            if (Array.isArray(raw.ingredientIds) && Array.isArray(raw.quantities)) {
              for (let i = 0; i < raw.ingredientIds.length; i++) {
                const ingId = Number(raw.ingredientIds[i]);
                if (ingId) {
                  ingredientIds.push(ingId);
                  quantities.push(Number(raw.quantities[i]) || 1);
                }
              }
            } else if (Array.isArray(raw.ingredients)) {
              for (const ing of raw.ingredients) {
                if (ing && typeof ing === "object") {
                  const ingId = Number(ing.id ?? ing.item_id ?? ing.itemId ?? 0);
                  if (ingId) {
                    ingredientIds.push(ingId);
                    quantities.push(Number(ing.quantity ?? ing.qty ?? ing.amount ?? 1) || 1);
                  }
                }
              }
            }

            if (ingredientIds.length > 0) {
              const normalizedRecipe = {
                id: Number(raw.id) || resultId,
                resultId,
                ingredientIds,
                quantities,
                jobId: Number(raw.jobId ?? raw.job_id ?? raw.job?.id ?? 0) || undefined,
              };

              // Cache in Turso in background
              if (endpoint) {
                queryTurso(endpoint, dbToken, [
                  {
                    type: "execute",
                    stmt: {
                      sql: `INSERT INTO recipes (result_id, job_id, payload_json, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(result_id) DO UPDATE SET payload_json = excluded.payload_json, updated_at = excluded.updated_at`,
                      args: [
                        { type: "integer", value: String(resultId) },
                        { type: "integer", value: String(normalizedRecipe.jobId || 0) },
                        { type: "text", value: JSON.stringify(normalizedRecipe) },
                        { type: "integer", value: String(Date.now()) },
                      ],
                    },
                  },
                ]).catch(() => {});
              }

              return res.status(200).json(normalizedRecipe);
            }
          }
        }
      } catch {
        // DofusDB error
      }

      // Retornar 200 con null para recursos sin receta (trigo, lino, gelatina, carnes)
      // para evitar errores 404 en la consola del navegador
      return res.status(200).json(null);
    }

    // -------------------------------------------------------------------------
    // 7c. ITEMS BATCH RESOLVE: POST /api/local-db/items/batch-resolve
    // -------------------------------------------------------------------------
    if (route0 === "items" && (route1 === "resolve-names" || route1 === "batch-resolve")) {
      return res.status(200).json({ updatedItems: [], items: [] });
    }

    // -------------------------------------------------------------------------
    // 7d. SYNC STATUS & SETTINGS
    // -------------------------------------------------------------------------
    if (route0 === "sync-status" || route0 === "reset-sync-status") {
      return res.status(200).json({ status: "idle", lastSync: Date.now() });
    }
    if (route0 === "sync-settings") {
      return res.status(200).json({ enabled: true, intervalDays: 30 });
    }
    if (route0 === "item-stats" && route1) {
      return res.status(200).json({});
    }
    if (route0 === "search-items") {
      return res.status(200).json({ items: [] });
    }
    if (route0 === "category-items") {
      return res.status(200).json({ items: [] });
    }

    // -------------------------------------------------------------------------
    // 8. SALES VOLUME: GET /api/local-db/sales-volume
    // -------------------------------------------------------------------------
    if (route0 === "sales-volume" && !route1) {
      if (req.method === "GET") {
        const profileId = Number(req.query?.profileId) || 1;

        if (!endpoint) {
          return res.status(200).json({ salesVolume: {} });
        }

        const data = await queryTurso(endpoint, dbToken, [
          {
            type: "execute",
            stmt: {
              sql: `SELECT item_id, sales_24h, sales_7d, sales_30d, avg_daily_sales, suggested_price, price_strategy, updated_at FROM profile_sales_volume WHERE profile_id = ?`,
              args: [{ type: "integer", value: String(profileId) }],
            },
          },
        ]);

        const volumeRows = data?.results?.[0]?.response?.result?.rows || [];
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

        return res.status(200).json({ salesVolume });
      }
    }

    // -------------------------------------------------------------------------
    // 9. SALES VOLUME BULK: POST /api/local-db/sales-volume/bulk
    // -------------------------------------------------------------------------
    if (route0 === "sales-volume" && route1 === "bulk") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
      const volumes = body?.volumes;
      const profileId = Number(body?.profileId) || 1;

      if (!volumes || typeof volumes !== "object") {
        return res.status(400).json({ error: "volumes dictionary is required" });
      }

      if (endpoint) {
        const requests: any[] = [];
        const now = Date.now();

        for (const [itemIdStr, vol] of Object.entries(volumes)) {
          const itemId = Number(itemIdStr);
          if (itemId <= 0 || !vol || typeof vol !== "object") continue;
          const v = vol as any;
          const updatedAt = Number(v.updatedAt) || now;

          requests.push({
            type: "execute",
            stmt: {
              sql: `INSERT INTO profile_sales_volume (profile_id, item_id, sales_24h, sales_7d, sales_30d, avg_daily_sales, suggested_price, price_strategy, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(profile_id, item_id) DO UPDATE SET
                      sales_24h = CASE WHEN excluded.updated_at >= profile_sales_volume.updated_at THEN excluded.sales_24h ELSE profile_sales_volume.sales_24h END,
                      sales_7d = CASE WHEN excluded.updated_at >= profile_sales_volume.updated_at THEN excluded.sales_7d ELSE profile_sales_volume.sales_7d END,
                      sales_30d = CASE WHEN excluded.updated_at >= profile_sales_volume.updated_at THEN excluded.sales_30d ELSE profile_sales_volume.sales_30d END,
                      avg_daily_sales = CASE WHEN excluded.updated_at >= profile_sales_volume.updated_at THEN excluded.avg_daily_sales ELSE profile_sales_volume.avg_daily_sales END,
                      suggested_price = CASE WHEN excluded.updated_at >= profile_sales_volume.updated_at THEN excluded.suggested_price ELSE profile_sales_volume.suggested_price END,
                      price_strategy = CASE WHEN excluded.updated_at >= profile_sales_volume.updated_at THEN excluded.price_strategy ELSE profile_sales_volume.price_strategy END,
                      updated_at = CASE WHEN excluded.updated_at >= profile_sales_volume.updated_at THEN excluded.updated_at ELSE profile_sales_volume.updated_at END`,
              args: [
                { type: "integer", value: String(profileId) },
                { type: "integer", value: String(itemId) },
                { type: "integer", value: String(v.sales24h ?? 0) },
                { type: "integer", value: String(v.sales7d ?? 0) },
                { type: "integer", value: String(v.sales30d ?? 0) },
                { type: "float", value: Number(v.avgDailySales ?? 0) },
                { type: "integer", value: String(v.suggestedPrice ?? 0) },
                { type: "text", value: String(v.priceStrategy || "") },
                { type: "integer", value: String(updatedAt) },
              ],
            },
          });
        }

        if (requests.length > 0) {
          const CHUNK_SIZE = 80;
          for (let i = 0; i < requests.length; i += CHUNK_SIZE) {
            const chunk = requests.slice(i, i + CHUNK_SIZE);
            await queryTurso(endpoint, dbToken, chunk).catch((err: any) =>
              console.warn("[Turso Bulk Volume Error]:", err)
            );
          }
        }
      }

      return res.status(200).json({
        success: true,
        profileId,
        updatedCount: Object.keys(volumes).length,
      });
    }

    // -------------------------------------------------------------------------
    // 10. SALES VOLUME SINGLE: PUT /api/local-db/sales-volume/:itemId
    // -------------------------------------------------------------------------
    if (route0 === "sales-volume" && route1 && route1 !== "bulk") {
      const itemId = Number(route1);
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
      const volume = body?.volume;
      const profileId = Number(body?.profileId) || 1;
      const updatedAt = Number(body?.updatedAt) || Date.now();

      if (!itemId || !volume || typeof volume !== "object") {
        return res.status(400).json({ error: "Valid itemId and volume object are required" });
      }

      if (endpoint) {
        const v = volume as any;
        await queryTurso(endpoint, dbToken, [
          {
            type: "execute",
            stmt: {
              sql: `INSERT INTO profile_sales_volume (profile_id, item_id, sales_24h, sales_7d, sales_30d, avg_daily_sales, suggested_price, price_strategy, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(profile_id, item_id) DO UPDATE SET
                      sales_24h = excluded.sales_24h,
                      sales_7d = excluded.sales_7d,
                      sales_30d = excluded.sales_30d,
                      avg_daily_sales = excluded.avg_daily_sales,
                      suggested_price = excluded.suggested_price,
                      price_strategy = excluded.price_strategy,
                      updated_at = excluded.updated_at`,
              args: [
                { type: "integer", value: String(profileId) },
                { type: "integer", value: String(itemId) },
                { type: "integer", value: String(v.sales24h ?? 0) },
                { type: "integer", value: String(v.sales7d ?? 0) },
                { type: "integer", value: String(v.sales30d ?? 0) },
                { type: "float", value: Number(v.avgDailySales ?? 0) },
                { type: "integer", value: String(v.suggestedPrice ?? 0) },
                { type: "text", value: String(v.priceStrategy || "") },
                { type: "integer", value: String(updatedAt) },
              ],
            },
          },
        ]);
      }

      return res.status(200).json({
        success: true,
        itemId,
        profileId,
        updatedAt,
      });
    }

    return res.status(404).json({ error: `Ruta no encontrada: /api/local-db/${pathSegments.join("/")}` });
  } catch (error: any) {
    console.error("[Local DB Serverless Router Error]:", error);
    return res.status(500).json({
      error: error.message || "Error interno del servidor",
    });
  }
}
