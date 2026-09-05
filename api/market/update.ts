const serverMap: Record<string, number> = {
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

async function getPreviousPrices(
  dbUrl: string,
  dbToken: string,
  profileId: number,
  itemIds: number[]
): Promise<Map<number, number>> {
  const priceMap = new Map<number, number>();
  const validIds = Array.from(new Set(itemIds.filter((id) => typeof id === "number" && id > 0)));
  if (!dbUrl || validIds.length === 0) return priceMap;

  try {
    const endpoint = dbUrl.endsWith("/v2/pipeline") ? dbUrl : `${dbUrl}/v2/pipeline`;
    const CHUNK_SIZE = 50;
    for (let i = 0; i < validIds.length; i += CHUNK_SIZE) {
      const chunk = validIds.slice(i, i + CHUNK_SIZE);
      const placeholders = chunk.map(() => "?").join(", ");
      const args = [
        { type: "integer", value: String(profileId) },
        ...chunk.map((id) => ({ type: "integer", value: String(id) })),
      ];

      const res = await fetch(endpoint, {
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
                sql: `SELECT item_id, price FROM profile_prices WHERE profile_id = ? AND item_id IN (${placeholders})`,
                args,
              },
            },
            { type: "close" },
          ],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const rows = data?.results?.[0]?.response?.result?.rows || [];
        for (const row of rows) {
          const id = Number(row[0]?.value ?? row[0]);
          const price = Number(row[1]?.value ?? row[1]);
          if (id && price > 0) {
            priceMap.set(id, price);
          }
        }
      }
    }
  } catch (err) {
    console.warn("[getPreviousPrices error]:", err);
  }

  return priceMap;
}

function processItemPayload(payload: any, now: number, previousPrice: number = 0) {
  const itemId = Number(payload?.item_id ?? payload?.itemId ?? payload?.id);
  if (!itemId || Number.isNaN(itemId) || itemId <= 0) return null;

  const directPrice = Number(payload?.price ?? payload?.precio ?? payload?.calculated_price);
  const precios = payload.precios || payload.prices;
  let resolvedType = (payload.type || "").toLowerCase();
  if (!resolvedType) {
    resolvedType = Array.isArray(precios) && precios.length > 4 ? "equipable" : "recurso";
  }

  let finalPrice = 0;
  let minPrice = 0;
  let maxPrice = 0;
  let rawAvg = 0;
  let offersCount = 0;
  let filteredOutliersCount = 0;
  let antiTrollTriggered = false;

  if (directPrice > 0 && (!precios || (Array.isArray(precios) && precios.length === 0))) {
    finalPrice = Math.round(directPrice);
    minPrice = finalPrice;
    maxPrice = finalPrice;
    rawAvg = finalPrice;
    offersCount = 1;

    // Protección anti-troll cuando solo hay 1 precio y sube desmesuradamente
    if (previousPrice > 0) {
      if (finalPrice > previousPrice * 6 && finalPrice >= 10000) {
        antiTrollTriggered = true;
        finalPrice = previousPrice;
      } else if (finalPrice < previousPrice * 0.15 && previousPrice >= 1000) {
        antiTrollTriggered = true;
        finalPrice = previousPrice;
      }
    }
  } else if (resolvedType === "recurso") {
    let p1 = 0, p10 = 0, p100 = 0, p1000 = 0;
    if (Array.isArray(precios)) {
      p1 = Number(precios[0]) || 0;
      p10 = Number(precios[1]) || 0;
      p100 = Number(precios[2]) || 0;
      p1000 = Number(precios[3]) || 0;
    } else if (precios && typeof precios === "object") {
      const rawObj = precios as Record<string, number | string>;
      p1 = Number(rawObj["1"] ?? rawObj[1] ?? 0);
      p10 = Number(rawObj["10"] ?? rawObj[10] ?? 0);
      p100 = Number(rawObj["100"] ?? rawObj[100] ?? 0);
      p1000 = Number(rawObj["1000"] ?? rawObj[1000] ?? 0);
    }

    const rawLots = [
      { size: 1, total: p1, unit: p1, baseWeight: 0.10 },
      { size: 10, total: p10, unit: p10 > 0 ? p10 / 10 : 0, baseWeight: 0.35 },
      { size: 100, total: p100, unit: p100 > 0 ? p100 / 100 : 0, baseWeight: 0.40 },
      { size: 1000, total: p1000, unit: p1000 > 0 ? p1000 / 1000 : 0, baseWeight: 0.15 },
    ].filter((l) => l.total > 0 && l.unit > 0);

    if (rawLots.length > 0) {
      offersCount = rawLots.length;
      const allUnits = rawLots.map((l) => l.unit);
      minPrice = Math.round(Math.min(...allUnits));
      maxPrice = Math.round(Math.max(...allUnits));
      rawAvg = Math.round(allUnits.reduce((a, b) => a + b, 0) / allUnits.length);

      if (rawLots.length === 1) {
        // Solo 1 lote disponible en todo el mercadillo (desabastecimiento / escasez)
        finalPrice = Math.round(rawLots[0].unit);
        if (previousPrice > 0) {
          if (finalPrice > previousPrice * 6 && finalPrice >= 10000) {
            antiTrollTriggered = true;
            finalPrice = previousPrice;
          } else if (finalPrice < previousPrice * 0.15 && previousPrice >= 1000) {
            antiTrollTriggered = true;
            finalPrice = previousPrice;
          }
        }
      } else {
        // Varios lotes disponibles: filtrar valores atípicos (cebos bajos y trolls inflados)
        const sortedUnits = [...allUnits].sort((a, b) => a - b);
        const mid = Math.floor(sortedUnits.length / 2);
        const median = sortedUnits.length % 2 === 0
          ? (sortedUnits[mid - 1] + sortedUnits[mid]) / 2
          : sortedUnits[mid];

        const validLots = rawLots.filter((l) => {
          // Descartar lote inflado artificialmente (> 2.8x de la mediana del mercadillo)
          if (l.unit > median * 2.8 && (l.unit - median) > 100) {
            return false;
          }
          // Descartar lote cebo/dumping exageradamente bajo (< 45% de la mediana)
          if (l.unit < median * 0.45 && (median - l.unit) > 15) {
            return false;
          }
          // Específico lote de 1: si existe lote de 10 y el de 1 cuesta menos del 55% de la unidad del lote de 10
          if (l.size === 1) {
            const lot10 = rawLots.find((x) => x.size === 10);
            if (lot10 && l.unit < lot10.unit * 0.55 && (lot10.unit - l.unit) > 10) {
              return false;
            }
          }
          return true;
        });

        filteredOutliersCount = rawLots.length - validLots.length;
        const finalLots = validLots.length > 0 ? validLots : rawLots;
        const totalWeight = finalLots.reduce((sum, l) => sum + l.baseWeight, 0);
        const weightedSum = finalLots.reduce((sum, l) => sum + (l.unit * l.baseWeight), 0);
        finalPrice = Math.round(weightedSum / totalWeight);
      }
    }
  } else {
    // Equipables
    resolvedType = "equipable";
    let numericPrices: number[] = [];
    if (Array.isArray(precios)) {
      numericPrices = precios.map(Number).filter((n) => !Number.isNaN(n) && n > 0);
    } else if (precios && typeof precios === "object") {
      numericPrices = Object.values(precios).map(Number).filter((n) => !Number.isNaN(n) && n > 0);
    }

    if (numericPrices.length > 0) {
      const sorted = [...numericPrices].sort((a, b) => a - b);
      offersCount = sorted.length;
      minPrice = sorted[0];
      maxPrice = sorted[sorted.length - 1];
      const sum = sorted.reduce((a, b) => a + b, 0);
      rawAvg = Math.round(sum / sorted.length);

      if (sorted.length === 1) {
        finalPrice = sorted[0];
        if (previousPrice > 0) {
          if (finalPrice > previousPrice * 6 && finalPrice >= 50000) {
            antiTrollTriggered = true;
            finalPrice = previousPrice;
          } else if (finalPrice < previousPrice * 0.15 && previousPrice >= 50000) {
            antiTrollTriggered = true;
            finalPrice = previousPrice;
          }
        }
      } else {
        const threshold = Math.max(minPrice * 2.2, minPrice + 2000);
        const normal = sorted.filter((p) => p <= threshold);
        filteredOutliersCount = sorted.length - normal.length;
        if (normal.length === 1) {
          finalPrice = normal[0];
        } else {
          const normalAvg = normal.reduce((a, b) => a + b, 0) / normal.length;
          finalPrice = Math.round(minPrice * 0.6 + normalAvg * 0.4);
        }
      }
    }
  }

  const serverSlug = (payload.server || "draconiros").toLowerCase().replace(/[\s\-_]/g, "");
  const profileId = Number(payload.profileId || payload.profile_id) || serverMap[serverSlug] || 1;
  const profileName = payload.server || "Draconiros";

  return {
    itemId,
    resolvedType,
    finalPrice,
    minPrice,
    maxPrice,
    rawAvg,
    offersCount,
    filteredOutliersCount,
    antiTrollTriggered,
    profileId,
    profileName,
    itemName: payload.item_name || `Objeto #${itemId}`,
    source: payload.source || "sniffer",
    now,
  };
}

export default async function handler(req: any, res: any) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-api-key, Authorization");
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    if (!body || typeof body !== "object") {
      return res.status(400).json({ error: "Cuerpo de solicitud JSON requerido" });
    }

    const isBatch = Array.isArray(body) || Array.isArray(body?.items);
    const dbUrl = (process.env.TURSO_DATABASE_URL || process.env.LIBSQL_URL || process.env.DATABASE_URL || "").trim().replace(/^libsql:\/\//, "https://");
    const dbToken = (process.env.TURSO_AUTH_TOKEN || process.env.LIBSQL_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN || "").trim();
    const now = Date.now();

    if (isBatch) {
      const items = Array.isArray(body?.items) ? body.items : Array.isArray(body) ? body : [];
      if (items.length === 0) {
        return res.status(400).json({ error: "Se requiere un array de items" });
      }

      const serverSlug = (body?.server || items[0]?.server || "draconiros").toLowerCase().replace(/[\s\-_]/g, "");
      const profileId = Number(body?.profileId || body?.profile_id || (items[0] && (items[0].profileId || items[0].profile_id))) || serverMap[serverSlug] || 1;
      const itemIds = items.map((p: any) => Number(p?.item_id ?? p?.itemId ?? p?.id)).filter((id: number) => id > 0);
      const previousPriceMap = await getPreviousPrices(dbUrl, dbToken, profileId, itemIds);

      const results: any[] = [];
      const requests: any[] = [];

      for (const payload of items) {
        const id = Number(payload?.item_id ?? payload?.itemId ?? payload?.id);
        const prevPrice = previousPriceMap.get(id) || 0;
        const item = processItemPayload(payload, now, prevPrice);
        if (!item) continue;

        if (item.finalPrice > 0 && dbUrl) {
          requests.push({
            type: "execute",
            stmt: {
              sql: `INSERT INTO profile_prices (profile_id, item_id, price, updated_at)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(profile_id, item_id) DO UPDATE SET price = excluded.price, updated_at = excluded.updated_at`,
              args: [
                { type: "integer", value: String(item.profileId) },
                { type: "integer", value: String(item.itemId) },
                { type: "integer", value: String(item.finalPrice) },
                { type: "integer", value: String(now) },
              ],
            },
          });
        }

        results.push({
          success: true,
          item_id: item.itemId,
          name: item.itemName,
          type: item.resolvedType,
          calculated_price: item.finalPrice,
          min_price: item.minPrice,
          max_price: item.maxPrice,
          raw_average: item.rawAvg,
          offers_count: item.offersCount,
          filtered_outliers: item.filteredOutliersCount,
          anti_troll_triggered: item.antiTrollTriggered,
          server: item.profileName,
          profile_id: item.profileId,
          updated_at: now,
        });
      }

      if (requests.length > 0 && dbUrl) {
        try {
          const endpoint = dbUrl.endsWith("/v2/pipeline") ? dbUrl : `${dbUrl}/v2/pipeline`;
          const CHUNK_SIZE = 50;
          for (let i = 0; i < requests.length; i += CHUNK_SIZE) {
            const chunk = requests.slice(i, i + CHUNK_SIZE);
            await fetch(endpoint, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${dbToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ requests: [...chunk, { type: "close" }] }),
            });
          }
          (globalThis as any).__lastMarketWriteTimestamp = now;
        } catch (dbErr) {
          console.warn("[Turso Batch Ingest Warning]:", dbErr);
        }
      }

      res.setHeader("Access-Control-Allow-Origin", "*");
      return res.status(200).json({
        success: true,
        total_processed: results.length,
        results,
      });
    }

    // Single item update
    const rawItemId = Number(body?.item_id ?? body?.itemId ?? body?.id);
    const serverSlug = (body?.server || "draconiros").toLowerCase().replace(/[\s\-_]/g, "");
    const profileId = Number(body?.profileId || body?.profile_id) || serverMap[serverSlug] || 1;
    const previousPriceMap = rawItemId ? await getPreviousPrices(dbUrl, dbToken, profileId, [rawItemId]) : new Map<number, number>();
    const previousPrice = previousPriceMap.get(rawItemId) || 0;

    const item = processItemPayload(body, now, previousPrice);
    if (!item) {
      return res.status(400).json({ error: "item_id inválido o requerido" });
    }

    if (item.finalPrice > 0 && dbUrl) {
      try {
        const endpoint = dbUrl.endsWith("/v2/pipeline") ? dbUrl : `${dbUrl}/v2/pipeline`;
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
                    { type: "integer", value: String(item.profileId) },
                    { type: "integer", value: String(item.itemId) },
                    { type: "integer", value: String(item.finalPrice) },
                    { type: "integer", value: String(now) },
                  ],
                },
              },
              {
                type: "execute",
                stmt: {
                  sql: `INSERT INTO price_history (profile_id, item_id, price, old_price, difference, percentage_change, source, timestamp)
                        VALUES (?, ?, ?, 0, 0, 0, ?, ?)`,
                  args: [
                    { type: "integer", value: String(item.profileId) },
                    { type: "integer", value: String(item.itemId) },
                    { type: "integer", value: String(item.finalPrice) },
                    { type: "text", value: String(item.source) },
                    { type: "integer", value: String(now) },
                  ],
                },
              },
              { type: "close" },
            ],
          }),
        });
        (globalThis as any).__lastMarketWriteTimestamp = now;
      } catch (dbErr) {
        console.warn("[Turso Cloud Ingest Warning]:", dbErr);
      }
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).json({
      success: true,
      item_id: item.itemId,
      name: item.itemName,
      type: item.resolvedType,
      calculated_price: item.finalPrice,
      min_price: item.minPrice,
      max_price: item.maxPrice,
      raw_average: item.rawAvg,
      offers_count: item.offersCount,
      filtered_outliers: item.filteredOutliersCount,
      anti_troll_triggered: item.antiTrollTriggered,
      server: item.profileName,
      profile_id: item.profileId,
      updated_at: now,
    });
  } catch (error: any) {
    console.error("[Market Update Error]:", error);
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(500).json({ error: error.message || "Error al procesar precio" });
  }
}
