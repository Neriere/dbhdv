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

function processItemPayload(payload: any, now: number) {
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

  if (directPrice > 0 && (!precios || (Array.isArray(precios) && precios.length === 0))) {
    finalPrice = Math.round(directPrice);
    minPrice = finalPrice;
    maxPrice = finalPrice;
    rawAvg = finalPrice;
    offersCount = 1;
  } else if (resolvedType === "recurso") {
    const unitPrices: number[] = [];
    if (Array.isArray(precios)) {
      const p1 = Number(precios[0]) || 0;
      const p10 = Number(precios[1]) || 0;
      const p100 = Number(precios[2]) || 0;
      const p1000 = Number(precios[3]) || 0;
      if (p1 > 0) unitPrices.push(p1);
      if (p10 > 0) unitPrices.push(Math.round(p10 / 10));
      if (p100 > 0) unitPrices.push(Math.round(p100 / 100));
      if (p1000 > 0) unitPrices.push(Math.round(p1000 / 1000));
    } else if (precios && typeof precios === "object") {
      const rawObj = precios as Record<string, number | string>;
      const p1 = Number(rawObj["1"] ?? rawObj[1] ?? 0);
      const p10 = Number(rawObj["10"] ?? rawObj[10] ?? 0);
      const p100 = Number(rawObj["100"] ?? rawObj[100] ?? 0);
      const p1000 = Number(rawObj["1000"] ?? rawObj[1000] ?? 0);
      if (p1 > 0) unitPrices.push(p1);
      if (p10 > 0) unitPrices.push(Math.round(p10 / 10));
      if (p100 > 0) unitPrices.push(Math.round(p100 / 100));
      if (p1000 > 0) unitPrices.push(Math.round(p1000 / 1000));
    }

    if (unitPrices.length > 0) {
      offersCount = unitPrices.length;
      minPrice = Math.min(...unitPrices);
      maxPrice = Math.max(...unitPrices);
      const sum = unitPrices.reduce((a, b) => a + b, 0);
      rawAvg = Math.round(sum / unitPrices.length);

      const valid = unitPrices.filter((p) => p <= minPrice * 2.5);
      const active = valid.length > 0 ? valid : [minPrice];
      finalPrice = Math.round(active.reduce((a, b) => a + b, 0) / active.length);
    }
  } else {
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

      const threshold = Math.max(minPrice * 2.2, minPrice + 2000);
      const normal = sorted.filter((p) => p <= threshold);
      if (normal.length === 1) {
        finalPrice = normal[0];
      } else {
        const normalAvg = normal.reduce((a, b) => a + b, 0) / normal.length;
        finalPrice = Math.round(minPrice * 0.6 + normalAvg * 0.4);
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

      const results: any[] = [];
      const requests: any[] = [];

      for (const payload of items) {
        const item = processItemPayload(payload, now);
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
    const item = processItemPayload(body, now);
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
