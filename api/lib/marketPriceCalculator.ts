import { getDbClient, resolveServerProfileId } from "./db";

export interface IngestPayload {
  item_id: number;
  item_name?: string;
  type?: string;
  prices?: Record<string, number | string> | Array<number | string>;
  precios?: Record<string, number | string> | Array<number | string>;
  server?: string;
  source?: string;
  timestamp?: number;
}

export interface IngestResult {
  success: boolean;
  item_id: number;
  name: string;
  type: string;
  calculated_price: number;
  min_price: number;
  max_price: number;
  raw_average: number;
  offers_count: number;
  server: string;
  profile_id: number;
  updated_at: number;
}

export function calculateMarketPrice(payload: IngestPayload): {
  finalPrice: number;
  minPrice: number;
  maxPrice: number;
  rawAvg: number;
  offersCount: number;
  resolvedType: string;
} {
  const precios = payload.precios || payload.prices;
  let resolvedType = (payload.type || "").toLowerCase();

  // Detect type if not given
  if (!resolvedType) {
    if (Array.isArray(precios) && precios.length > 4) {
      resolvedType = "equipable";
    } else {
      resolvedType = "recurso";
    }
  }

  let finalPrice = 0;
  let minPrice = 0;
  let maxPrice = 0;
  let rawAvg = 0;
  let offersCount = 0;

  if (resolvedType === "recurso") {
    let unitPrices: number[] = [];

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
      const sum = unitPrices.reduce((acc, val) => acc + val, 0);
      rawAvg = Math.round(sum / unitPrices.length);

      const validUnitPrices = unitPrices.filter((p) => p <= minPrice * 2.5);
      const activePrices = validUnitPrices.length > 0 ? validUnitPrices : [minPrice];
      finalPrice = Math.round(activePrices.reduce((a, b) => a + b, 0) / activePrices.length);
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
      const sum = sorted.reduce((acc, val) => acc + val, 0);
      rawAvg = Math.round(sum / sorted.length);

      const outlierThreshold = Math.max(minPrice * 2.2, minPrice + 2000);
      const normalOffers = sorted.filter((p) => p <= outlierThreshold);

      if (normalOffers.length === 1) {
        finalPrice = normalOffers[0];
      } else {
        const normalSum = normalOffers.reduce((a, b) => a + b, 0);
        const normalAvg = normalSum / normalOffers.length;
        finalPrice = Math.round(minPrice * 0.6 + normalAvg * 0.4);
      }
    }
  }

  return {
    finalPrice,
    minPrice,
    maxPrice,
    rawAvg,
    offersCount,
    resolvedType,
  };
}

export async function ingestSinglePrice(payload: IngestPayload): Promise<IngestResult> {
  const itemId = Number(payload.item_id);
  if (!itemId || Number.isNaN(itemId) || itemId <= 0) {
    throw new Error("El campo 'item_id' es obligatorio y debe ser un número entero positivo.");
  }

  const { profileId, profileName } = resolveServerProfileId(payload.server);
  const calc = calculateMarketPrice(payload);
  const now = Date.now();

  const db = getDbClient();

  if (calc.finalPrice > 0) {
    try {
      await db.batch(
        [
          {
            sql: `INSERT INTO profile_prices (profile_id, item_id, price, updated_at)
                  VALUES (?, ?, ?, ?)
                  ON CONFLICT(profile_id, item_id) DO UPDATE SET price = excluded.price, updated_at = excluded.updated_at`,
            args: [profileId, itemId, calc.finalPrice, now],
          },
          {
            sql: `INSERT INTO price_history (profile_id, item_id, price, old_price, difference, percentage_change, source, timestamp)
                  VALUES (?, ?, ?, 0, 0, 0, ?, ?)`,
            args: [profileId, itemId, calc.finalPrice, payload.source || "sniffer", now],
          },
        ],
        "write",
      );
    } catch (err) {
      console.warn("[Database] Price save error:", err);
    }
  }

  return {
    success: true,
    item_id: itemId,
    name: payload.item_name || `Objeto #${itemId}`,
    type: calc.resolvedType,
    calculated_price: calc.finalPrice,
    min_price: calc.minPrice,
    max_price: calc.maxPrice,
    raw_average: calc.rawAvg,
    offers_count: calc.offersCount,
    server: profileName,
    profile_id: profileId,
    updated_at: now,
  };
}

export async function ingestBatchPrices(items: IngestPayload[]): Promise<{
  success: boolean;
  total_processed: number;
  results: IngestResult[];
}> {
  if (!Array.isArray(items) || items.length === 0) {
    return { success: true, total_processed: 0, results: [] };
  }

  const results: IngestResult[] = [];
  const db = getDbClient();
  const now = Date.now();
  const statements: Array<{ sql: string; args: any[] }> = [];

  for (const item of items) {
    const itemId = Number(item.item_id);
    if (!itemId || Number.isNaN(itemId) || itemId <= 0) continue;

    const { profileId, profileName } = resolveServerProfileId(item.server);
    const calc = calculateMarketPrice(item);

    if (calc.finalPrice > 0) {
      statements.push({
        sql: `INSERT INTO profile_prices (profile_id, item_id, price, updated_at)
              VALUES (?, ?, ?, ?)
              ON CONFLICT(profile_id, item_id) DO UPDATE SET price = excluded.price, updated_at = excluded.updated_at`,
        args: [profileId, itemId, calc.finalPrice, now],
      });
      statements.push({
        sql: `INSERT INTO price_history (profile_id, item_id, price, old_price, difference, percentage_change, source, timestamp)
              VALUES (?, ?, ?, 0, 0, 0, ?, ?)`,
        args: [profileId, itemId, calc.finalPrice, item.source || "sniffer", now],
      });
    }

    results.push({
      success: true,
      item_id: itemId,
      name: item.item_name || `Objeto #${itemId}`,
      type: calc.resolvedType,
      calculated_price: calc.finalPrice,
      min_price: calc.minPrice,
      max_price: calc.maxPrice,
      raw_average: calc.rawAvg,
      offers_count: calc.offersCount,
      server: profileName,
      profile_id: profileId,
      updated_at: now,
    });
  }

  if (statements.length > 0) {
    try {
      await db.batch(statements, "write");
    } catch (err) {
      console.warn("[Database] Batch price save error:", err);
    }
  }

  return {
    success: true,
    total_processed: results.length,
    results,
  };
}
