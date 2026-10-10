import { database, marketEvents } from "../connection";
import {
  getPriceProfiles,
  getActivePriceProfileId,
  setActivePriceProfileId,
} from "../serverProfiles";
import {
  calculateItemMarketPrice,
  DOFUS_EQUIPMENT_TYPE_IDS,
  isEquipmentTypeId,
  type IngestMarketPricePayload,
  type IngestMarketPriceResult,
} from "../priceCalculator";
import { ALL_DOFUS_RUNES_DICT } from "../../../data/dofusAllRunesDict";
import { SUPPLEMENTARY_ITEMS_DICT } from "../../../data/supplementaryItemsDict";
import { STATIC_ITEMS_DICT } from "../../../data/staticItemsDict";
import bycGeneratedDb from "../../../data/bycGeneratedDbData";
import type {
  DofusItem,
  ItemSalesVolume,
  MarketPriceMap,
  PriceChangeInfo,
  PriceHistoryEntry,
  ItemPriceHistorySummary,
  PriceUpdatedAtMap,
  SalesVolumeMap,
} from "../../../types";
import { getOrFetchItemById } from "./items";
import { invalidateServerBootstrapCache } from "./sync";

export type {
  IngestMarketPricePayload,
  IngestMarketPriceResult,
};
export {
  DOFUS_EQUIPMENT_TYPE_IDS,
  isEquipmentTypeId,
  calculateItemMarketPrice,
};

export async function getPrice(profileId: number, itemId: number): Promise<number> {
  try {
    const res = await database.execute({
      sql: "SELECT price FROM profile_prices WHERE profile_id = ? AND item_id = ?",
      args: [profileId, itemId],
    });
    if (res.rows.length > 0) {
      return Number(res.rows[0].price) || 0;
    }
  } catch (err) {
    console.warn(`[getPrice] Error:`, err);
  }
  return 0;
}

export async function upsertPrice(
  profileId: number,
  itemId: number,
  price: number,
  source: string = "manual",
  updatedAt?: number,
): Promise<boolean> {
  const cleanPrice = Math.max(0, Math.trunc(price));
  const now = updatedAt && updatedAt > 0 ? updatedAt : Date.now();

  let oldPrice = 0;
  let existingUpdatedAt = 0;
  try {
    const existing = await database.execute({
      sql: "SELECT price, updated_at FROM profile_prices WHERE profile_id = ? AND item_id = ?",
      args: [profileId, itemId],
    });
    if (existing.rows.length > 0) {
      oldPrice = Number(existing.rows[0].price) || 0;
      existingUpdatedAt = Number(existing.rows[0].updated_at) || 0;
      if (existingUpdatedAt > now) {
        return false;
      }
    }
  } catch {
    // Ignore
  }

  await database.execute({
    sql: `INSERT INTO profile_prices (profile_id, item_id, price, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(profile_id, item_id) DO UPDATE SET price = excluded.price, updated_at = excluded.updated_at WHERE excluded.updated_at >= profile_prices.updated_at`,
    args: [profileId, itemId, cleanPrice, now],
  });

  if (cleanPrice !== oldPrice) {
    const diff = cleanPrice - oldPrice;
    const pctChange =
      oldPrice > 0
        ? ((cleanPrice - oldPrice) / oldPrice) * 100
        : cleanPrice > 0
        ? 100
        : 0;
    try {
      await database.execute({
        sql: `INSERT INTO price_history (profile_id, item_id, price, old_price, difference, percentage_change, source, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          profileId,
          itemId,
          cleanPrice,
          oldPrice,
          diff,
          Number(pctChange.toFixed(2)),
          source,
          now,
        ],
      });
    } catch {
      // Ignore
    }
  }

  return true;
}

export async function replaceAllPrices(
  profileId: number,
  prices: MarketPriceMap,
  source: string = "batch",
): Promise<void> {
  const existingRes = await database.execute({
    sql: "SELECT item_id, price FROM profile_prices WHERE profile_id = ?",
    args: [profileId],
  });
  const oldPricesMap: Record<number, number> = {};
  for (const row of existingRes.rows) {
    oldPricesMap[Number(row.item_id)] = Number(row.price) || 0;
  }

  await database.execute({
    sql: "DELETE FROM profile_prices WHERE profile_id = ?",
    args: [profileId],
  });
  const now = Date.now();
  const statements = Object.entries(prices).map(([itemId, price]) => ({
    sql: `INSERT INTO profile_prices (profile_id, item_id, price, updated_at) VALUES (?, ?, ?, ?)`,
    args: [profileId, Number(itemId), Math.max(0, Math.trunc(Number(price) || 0)), now],
  }));
  for (let i = 0; i < statements.length; i += 250)
    await database.batch(statements.slice(i, i + 250), "write");

  const historyStatements: Array<{ sql: string; args: any[] }> = [];
  for (const [itemIdStr, price] of Object.entries(prices)) {
    const itemId = Number(itemIdStr);
    const cleanPrice = Math.max(0, Math.trunc(Number(price) || 0));
    const oldPrice = oldPricesMap[itemId] || 0;
    if (cleanPrice !== oldPrice) {
      const diff = cleanPrice - oldPrice;
      const pctChange =
        oldPrice > 0
          ? ((cleanPrice - oldPrice) / oldPrice) * 100
          : cleanPrice > 0
          ? 100
          : 0;
      historyStatements.push({
        sql: `INSERT INTO price_history (profile_id, item_id, price, old_price, difference, percentage_change, source, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          profileId,
          itemId,
          cleanPrice,
          oldPrice,
          diff,
          Number(pctChange.toFixed(2)),
          source,
          now,
        ],
      });
    }
  }
  for (let i = 0; i < historyStatements.length; i += 250) {
    await database.batch(historyStatements.slice(i, i + 250), "write");
  }
}

export async function clearAllPrices(profileId: number): Promise<void> {
  await database.execute({
    sql: "DELETE FROM profile_prices WHERE profile_id = ?",
    args: [profileId],
  });
}

export async function getPricesAndUpdatedAtMaps(profileId: number): Promise<{ prices: MarketPriceMap; priceUpdatedAt: PriceUpdatedAtMap }> {
  const result = await database.execute({
    sql: "SELECT item_id, price, updated_at FROM profile_prices WHERE profile_id = ?",
    args: [profileId],
  });
  const prices: MarketPriceMap = {};
  const priceUpdatedAt: PriceUpdatedAtMap = {};
  for (const row of result.rows) {
    const itemId = Number(row.item_id);
    prices[itemId] = Number(row.price);
    priceUpdatedAt[itemId] = Number(row.updated_at);
  }

  // Fallback para objetos sin stock / sin precio en mercadillo pero con cotización sugerida
  try {
    const volResult = await database.execute({
      sql: "SELECT item_id, suggested_price, updated_at FROM profile_sales_volume WHERE profile_id = ? AND suggested_price >= 1",
      args: [profileId],
    });
    for (const row of volResult.rows) {
      const itemId = Number(row.item_id);
      if ((prices[itemId] === undefined || prices[itemId] <= 0) && row.suggested_price) {
        prices[itemId] = Number(row.suggested_price);
        if (!priceUpdatedAt[itemId]) {
          priceUpdatedAt[itemId] = Number(row.updated_at) || Date.now();
        }
      }
    }
  } catch {
    // Si la consulta falla o no está disponible, continuar con los precios directos
  }

  return { prices, priceUpdatedAt };
}

export async function getPricesMap(profileId: number): Promise<MarketPriceMap> {
  const { prices } = await getPricesAndUpdatedAtMaps(profileId);
  return prices;
}

export async function getPriceUpdatedAtMap(
  profileId: number,
): Promise<PriceUpdatedAtMap> {
  const { priceUpdatedAt } = await getPricesAndUpdatedAtMaps(profileId);
  return priceUpdatedAt;
}

export async function setItemPrice(
  itemId: number,
  price: number,
  profileId?: number,
  source: string = "manual",
  updatedAt?: number,
): Promise<{
  prices: MarketPriceMap;
  priceUpdatedAt: PriceUpdatedAtMap;
  activePriceProfileId: number;
  applied: boolean;
}> {
  invalidateServerBootstrapCache();
  const pid = profileId || (await getActivePriceProfileId());
  const applied = await upsertPrice(pid, itemId, price, source, updatedAt);
  const { prices, priceUpdatedAt } = await getPricesAndUpdatedAtMaps(pid);
  return {
    prices,
    priceUpdatedAt,
    activePriceProfileId: pid,
    applied,
  };
}

export async function overwritePrices(
  prices: MarketPriceMap,
  profileId?: number,
) {
  invalidateServerBootstrapCache();
  const pid = profileId || (await getActivePriceProfileId());
  await replaceAllPrices(pid, prices);
  const { prices: updatedPrices, priceUpdatedAt } = await getPricesAndUpdatedAtMaps(pid);
  return {
    prices: updatedPrices,
    priceUpdatedAt,
    activePriceProfileId: pid,
  };
}

export async function deleteAllStoredPrices(profileId?: number) {
  invalidateServerBootstrapCache();
  const pid = profileId || (await getActivePriceProfileId());
  await clearAllPrices(pid);
  const { prices, priceUpdatedAt } = await getPricesAndUpdatedAtMaps(pid);
  return {
    prices,
    priceUpdatedAt,
    activePriceProfileId: pid,
  };
}

export async function changeActivePriceProfile(profileId: number) {
  invalidateServerBootstrapCache();
  const pid = await setActivePriceProfileId(profileId);
  const coeffData = await getProfileCoefficients(pid);
  const { prices, priceUpdatedAt } = await getPricesAndUpdatedAtMaps(pid);
  return {
    activePriceProfileId: pid,
    prices,
    priceUpdatedAt,
    coefficients: coeffData.coefficients,
    coefficientUpdatedAt: coeffData.coefficientUpdatedAt,
    manualEdits: coeffData.manualEdits,
    profiles: await getPriceProfiles(),
  };
}

export async function getPriceProfileState() {
  const pid = await getActivePriceProfileId();
  return {
    activePriceProfileId: pid,
    profiles: await getPriceProfiles(),
    prices: await getPricesMap(pid),
    priceUpdatedAt: await getPriceUpdatedAtMap(pid),
  };
}

export async function getPriceHistory(options: {
  profileId?: number;
  itemId?: number;
  limit?: number;
  offset?: number;
  search?: string;
  filter?: "all" | "increased" | "decreased";
}) {
  const profileId = options.profileId || (await getActivePriceProfileId());
  const limit = Math.min(200, Math.max(1, options.limit || 50));
  const offset = Math.max(0, options.offset || 0);

  const whereClauses: string[] = [`h.profile_id = ${profileId}`];
  const args: any[] = [];

  if (options.itemId) {
    whereClauses.push(`h.item_id = ?`);
    args.push(options.itemId);
  }

  if (options.filter === "increased") {
    whereClauses.push(`h.difference > 0`);
  } else if (options.filter === "decreased") {
    whereClauses.push(`h.difference < 0`);
  }

  if (options.search && options.search.trim().length > 0) {
    const term = `%${options.search.trim()}%`;
    whereClauses.push(`(i.name_es LIKE ? OR CAST(h.item_id AS TEXT) LIKE ?)`);
    args.push(term, term);
  }

  const whereSql = `WHERE ${whereClauses.join(" AND ")}`;

  const totalCountRes = await database.execute({
    sql: `SELECT COUNT(*) as count FROM price_history h LEFT JOIN items i ON h.item_id = i.id ${whereSql}`,
    args,
  });
  const total = Number(totalCountRes.rows[0]?.count || 0);

  const querySql = `
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
      i.type_id as item_type_id,
      i.payload_json
    FROM price_history h
    LEFT JOIN items i ON h.item_id = i.id
    ${whereSql}
    ORDER BY h.timestamp DESC, h.id DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const rowsRes = await database.execute({
    sql: querySql,
    args,
  });

  const entries: PriceHistoryEntry[] = rowsRes.rows.map((row) => {
    let typeName = "";
    if (row.payload_json) {
      try {
        const itemObj = JSON.parse(row.payload_json as string);
        typeName = itemObj.type?.name?.es || itemObj.type?.name?.fr || "";
      } catch {}
    }

    return {
      id: Number(row.id),
      profileId: Number(row.profile_id),
      itemId: Number(row.item_id),
      itemName: String(row.item_name || `Objeto #${row.item_id}`),
      itemIconId: Number(row.item_icon_id) || Number(row.item_id),
      itemLevel: Number(row.item_level) || 1,
      itemTypeId: Number(row.item_type_id) || 0,
      itemTypeName: typeName,
      price: Number(row.price),
      oldPrice: Number(row.old_price),
      difference: Number(row.difference),
      percentageChange: Number(row.percentage_change),
      source: String(row.source || "manual"),
      timestamp: Number(row.timestamp),
    };
  });

  return {
    total,
    limit,
    offset,
    entries,
  };
}

export async function getItemPriceHistory(
  itemId: number,
  profileId?: number,
): Promise<ItemPriceHistorySummary> {
  const pid = profileId || (await getActivePriceProfileId());
  const rowsRes = await database.execute({
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
    args: [pid, itemId],
  });

  const history: PriceHistoryEntry[] = rowsRes.rows.map((row) => ({
    id: Number(row.id),
    profileId: Number(row.profile_id),
    itemId: Number(row.item_id),
    itemName: String(row.item_name || `Objeto #${row.item_id}`),
    itemIconId: Number(row.item_icon_id) || Number(row.item_id),
    itemLevel: Number(row.item_level) || 1,
    itemTypeId: Number(row.item_type_id) || 0,
    price: Number(row.price),
    oldPrice: Number(row.old_price),
    difference: Number(row.difference),
    percentageChange: Number(row.percentage_change),
    source: String(row.source || "manual"),
    timestamp: Number(row.timestamp),
  }));

  const currentRes = await database.execute({
    sql: `SELECT price, updated_at FROM profile_prices WHERE profile_id = ? AND item_id = ?`,
    args: [pid, itemId],
  });
  const currentPrice =
    currentRes.rows.length > 0 ? Number(currentRes.rows[0].price) || 0 : 0;
  const lastUpdatedAt =
    currentRes.rows.length > 0
      ? Number(currentRes.rows[0].updated_at) || Date.now()
      : Date.now();

  const pricesList = history.map((h) => h.price).filter((p) => p > 0);
  if (currentPrice > 0 && !pricesList.includes(currentPrice)) {
    pricesList.push(currentPrice);
  }

  if (history.length === 0 && currentPrice > 0) {
    const itemRec = (STATIC_ITEMS_DICT as any)[itemId] || (bycGeneratedDb as any)?.[itemId];
    history.push({
      id: 0,
      profileId: pid,
      itemId,
      itemName: itemRec?.name?.es || `Objeto #${itemId}`,
      itemIconId: itemRec?.iconId || itemId,
      itemLevel: itemRec?.level || 1,
      itemTypeId: itemRec?.type?.id || 0,
      price: currentPrice,
      oldPrice: 0,
      difference: 0,
      percentageChange: 0,
      source: "actual",
      timestamp: lastUpdatedAt,
    });
  }

  const minPrice =
    pricesList.length > 0 ? Math.min(...pricesList) : currentPrice;
  const maxPrice =
    pricesList.length > 0 ? Math.max(...pricesList) : currentPrice;
  const avgPrice =
    pricesList.length > 0
      ? Math.round(pricesList.reduce((a, b) => a + b, 0) / pricesList.length)
      : currentPrice;
  const firstRecordedAt =
    history.length > 0 ? history[0].timestamp : lastUpdatedAt;

  return {
    itemId,
    history,
    minPrice,
    maxPrice,
    avgPrice,
    currentPrice,
    firstRecordedAt,
    lastUpdatedAt,
    totalChanges: history.length === 1 && history[0].id === 0 ? 0 : history.length,
  };
}

export async function revertPriceHistoryEntry(historyId: number) {
  invalidateServerBootstrapCache();
  const entryRes = await database.execute({
    sql: `SELECT profile_id, item_id, old_price, price FROM price_history WHERE id = ?`,
    args: [historyId],
  });
  if (entryRes.rows.length === 0) {
    throw new Error("Entrada de historial no encontrada.");
  }
  const row = entryRes.rows[0];
  const profileId = Number(row.profile_id);
  const itemId = Number(row.item_id);
  const targetPrice = Number(row.old_price);

  await upsertPrice(profileId, itemId, targetPrice, "revert");

  return {
    success: true,
    itemId,
    revertedPrice: targetPrice,
    prices: await getPricesMap(profileId),
    priceUpdatedAt: await getPriceUpdatedAtMap(profileId),
  };
}

export async function clearPriceHistory(profileId?: number, itemId?: number) {
  const pid = profileId || (await getActivePriceProfileId());
  if (itemId) {
    await database.execute({
      sql: "DELETE FROM price_history WHERE profile_id = ? AND item_id = ?",
      args: [pid, itemId],
    });
  } else {
    await database.execute({
      sql: "DELETE FROM price_history WHERE profile_id = ?",
      args: [pid],
    });
  }
  return { success: true };
}

export async function getLatestPriceChanges(
  profileId?: number
): Promise<Record<number, PriceChangeInfo>> {
  const pid = profileId || (await getActivePriceProfileId());
  try {
    const res = await database.execute({
      sql: `
        SELECT h.item_id, h.price, h.old_price, h.difference, h.percentage_change, h.timestamp
        FROM price_history h
        INNER JOIN (
          SELECT item_id, MAX(id) as max_id
          FROM price_history
          WHERE profile_id = ?
          GROUP BY item_id
        ) latest ON h.id = latest.max_id
      `,
      args: [pid],
    });
    const map: Record<number, PriceChangeInfo> = {};
    for (const row of res.rows) {
      map[Number(row.item_id)] = {
        itemId: Number(row.item_id),
        price: Number(row.price),
        oldPrice: Number(row.old_price),
        difference: Number(row.difference),
        percentageChange: Number(row.percentage_change),
        timestamp: Number(row.timestamp),
      };
    }
    return map;
  } catch (err) {
    console.warn("[getLatestPriceChanges] Error querying latest price changes:", err);
    return {};
  }
}

export async function getProfileCoefficients(profileId?: number): Promise<{
  coefficients: Record<number, number>;
  coefficientUpdatedAt: Record<number, number>;
  manualEdits: Record<number, number>;
  activePriceProfileId: number;
}> {
  const pid = profileId || (await getActivePriceProfileId());
  const result = await database.execute({
    sql: "SELECT item_id, coefficient, updated_at, is_manual, manual_updated_at FROM profile_coefficients WHERE profile_id = ?",
    args: [pid],
  });
  const coefficients: Record<number, number> = {};
  const coefficientUpdatedAt: Record<number, number> = {};
  const manualEdits: Record<number, number> = {};
  for (const row of result.rows) {
    const itemId = Number(row.item_id);
    coefficients[itemId] = Number(row.coefficient);
    coefficientUpdatedAt[itemId] = Number(row.updated_at);
    if (Number(row.is_manual) === 1) {
      manualEdits[itemId] = Number(row.manual_updated_at) || Number(row.updated_at);
    }
  }
  return {
    coefficients,
    coefficientUpdatedAt,
    manualEdits,
    activePriceProfileId: pid,
  };
}

export async function setItemCoefficient(
  itemId: number,
  coefficient: number,
  profileId?: number,
  updatedAt?: number,
  isManual = true,
) {
  invalidateServerBootstrapCache();
  const pid = profileId || (await getActivePriceProfileId());
  const ts = updatedAt || Date.now();
  const validCoeff = Math.max(1, Math.min(10000, Number(coefficient) || 100));
  const manualFlag = isManual ? 1 : 0;
  const manualTs = isManual ? ts : 0;

  await database.execute({
    sql: `
      INSERT INTO profile_coefficients (profile_id, item_id, coefficient, updated_at, is_manual, manual_updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(profile_id, item_id) DO UPDATE SET
        coefficient = excluded.coefficient,
        updated_at = excluded.updated_at,
        is_manual = excluded.is_manual,
        manual_updated_at = excluded.manual_updated_at
    `,
    args: [pid, itemId, validCoeff, ts, manualFlag, manualTs],
  });

  return await getProfileCoefficients(pid);
}

export async function bulkSaveProfileCoefficients(
  entries: Array<{ itemId: number; coefficient: number; updatedAt?: number; isManual?: boolean }>,
  profileId?: number,
  isManualBatch = false,
  forceOverwriteManual = false,
) {
  invalidateServerBootstrapCache();
  const pid = profileId || (await getActivePriceProfileId());
  if (!entries || entries.length === 0) {
    const existing = await getProfileCoefficients(pid);
    return {
      ...existing,
      updatedCount: 0,
      skippedCount: 0,
      totalProcessed: 0,
    };
  }

  const now = Date.now();

  const existingRows = await database.execute({
    sql: "SELECT item_id, updated_at, is_manual FROM profile_coefficients WHERE profile_id = ?",
    args: [pid],
  });
  const existingMap = new Map<number, { updatedAt: number; isManual: number }>();
  for (const r of existingRows.rows) {
    existingMap.set(Number(r.item_id), {
      updatedAt: Number(r.updated_at) || 0,
      isManual: Number(r.is_manual) || 0,
    });
  }

  let updatedCount = 0;
  let skippedCount = 0;

  for (const entry of entries) {
    const isManualEntry = isManualBatch || Boolean(entry.isManual);
    const entryTs = isManualEntry
      ? (Number(entry.updatedAt) || now)
      : (Number(entry.updatedAt) > 0 ? Number(entry.updatedAt) : 0);
    const existing = existingMap.get(Number(entry.itemId));

    if (forceOverwriteManual || !existing) {
      updatedCount++;
    } else if (isManualEntry) {
      updatedCount++;
    } else if (existing.isManual === 1 && existing.updatedAt > entryTs) {
      skippedCount++;
    } else {
      updatedCount++;
    }
  }

  const chunkSize = 200;
  for (let i = 0; i < entries.length; i += chunkSize) {
    const chunk = entries.slice(i, i + chunkSize);
    const statements = chunk.map((entry) => {
      const isManualEntry = isManualBatch || Boolean(entry.isManual);
      const validCoeff = Math.max(1, Math.min(10000, Number(entry.coefficient) || 100));
      const entryTs = isManualEntry
        ? (Number(entry.updatedAt) || now)
        : (Number(entry.updatedAt) > 0 ? Number(entry.updatedAt) : 0);
      const manualTs = isManualEntry ? entryTs : 0;

      if (isManualEntry || forceOverwriteManual) {
        return {
          sql: `
            INSERT INTO profile_coefficients (profile_id, item_id, coefficient, updated_at, is_manual, manual_updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(profile_id, item_id) DO UPDATE SET
              coefficient = excluded.coefficient,
              updated_at = excluded.updated_at,
              is_manual = excluded.is_manual,
              manual_updated_at = excluded.manual_updated_at
          `,
          args: [pid, entry.itemId, validCoeff, entryTs, 1, manualTs],
        };
      }

      return {
        sql: `
          INSERT INTO profile_coefficients (profile_id, item_id, coefficient, updated_at, is_manual, manual_updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(profile_id, item_id) DO UPDATE SET
            coefficient = excluded.coefficient,
            updated_at = excluded.updated_at
          WHERE profile_coefficients.is_manual = 0
        `,
        args: [pid, entry.itemId, validCoeff, entryTs, 0, 0],
      };
    });

    await database.batch(statements, "write");
  }

  const result = await getProfileCoefficients(pid);
  return {
    ...result,
    updatedCount,
    skippedCount,
    totalProcessed: entries.length,
  };
}

export async function getProfileSalesVolume(profileId?: number): Promise<SalesVolumeMap> {
  const pid = profileId || (await getActivePriceProfileId());
  try {
    const result = await database.execute({
      sql: "SELECT item_id, sales_24h, sales_7d, sales_30d, avg_daily_sales, suggested_price, price_strategy, updated_at FROM profile_sales_volume WHERE profile_id = ?",
      args: [pid],
    });
    const map: SalesVolumeMap = {};
    for (const row of result.rows) {
      const id = row.item_id as number;
      map[id] = {
        sales24h: row.sales_24h != null ? Number(row.sales_24h) : undefined,
        sales7d: row.sales_7d != null ? Number(row.sales_7d) : undefined,
        sales30d: row.sales_30d != null ? Number(row.sales_30d) : undefined,
        avgDailySales: row.avg_daily_sales != null ? Number(row.avg_daily_sales) : undefined,
        suggestedPrice: row.suggested_price != null ? Number(row.suggested_price) : undefined,
        priceStrategy: (row.price_strategy as any) || undefined,
        updatedAt: Number(row.updated_at) || Date.now(),
      };
    }
    return map;
  } catch (err) {
    console.warn("[getProfileSalesVolume] Error querying profile_sales_volume:", err);
    return {};
  }
}

export async function getProfileSalesVolumeForItem(profileId: number, itemId: number): Promise<ItemSalesVolume | null> {
  try {
    const res = await database.execute({
      sql: "SELECT updated_at, sales_24h, sales_7d, sales_30d, avg_daily_sales, suggested_price, price_strategy FROM profile_sales_volume WHERE profile_id = ? AND item_id = ?",
      args: [profileId, itemId],
    });
    if (res.rows.length > 0) {
      const row = res.rows[0];
      return {
        sales24h: row.sales_24h != null ? Number(row.sales_24h) : undefined,
        sales7d: row.sales_7d != null ? Number(row.sales_7d) : undefined,
        sales30d: row.sales_30d != null ? Number(row.sales_30d) : undefined,
        avgDailySales: row.avg_daily_sales != null ? Number(row.avg_daily_sales) : undefined,
        suggestedPrice: row.suggested_price != null ? Number(row.suggested_price) : undefined,
        priceStrategy: (row.price_strategy as any) || undefined,
        updatedAt: Number(row.updated_at) || 0,
      };
    }
  } catch (err) {
    console.warn(`[getProfileSalesVolumeForItem] Error:`, err);
  }
  return null;
}

export async function setItemSalesVolume(
  itemId: number,
  volume: Partial<ItemSalesVolume>,
  profileId?: number,
  updatedAt?: number,
): Promise<{ success: boolean; volume: ItemSalesVolume; updatedAt: number }> {
  invalidateServerBootstrapCache();
  const pid = profileId || (await getActivePriceProfileId());
  const now = updatedAt && updatedAt > 0 ? updatedAt : Date.now();

  try {
    const existing = await database.execute({
      sql: "SELECT updated_at, sales_24h, sales_7d, sales_30d, avg_daily_sales, suggested_price, price_strategy FROM profile_sales_volume WHERE profile_id = ? AND item_id = ?",
      args: [pid, itemId],
    });
    if (existing.rows.length > 0) {
      const existingTime = Number(existing.rows[0].updated_at) || 0;
      if (existingTime > now) {
        const row = existing.rows[0];
        return {
          success: false,
          updatedAt: existingTime,
          volume: {
            sales24h: row.sales_24h != null ? Number(row.sales_24h) : undefined,
            sales7d: row.sales_7d != null ? Number(row.sales_7d) : undefined,
            sales30d: row.sales_30d != null ? Number(row.sales_30d) : undefined,
            avgDailySales: row.avg_daily_sales != null ? Number(row.avg_daily_sales) : undefined,
            suggestedPrice: row.suggested_price != null ? Number(row.suggested_price) : undefined,
            priceStrategy: (row.price_strategy as any) || undefined,
            updatedAt: existingTime,
          },
        };
      }
    }
  } catch {
    // Ignore
  }

  const isQuotation =
    volume.sales7d != null ||
    volume.sales30d != null ||
    volume.sales24h != null ||
    volume.suggestedPrice != null;
  let s24 = volume.sales24h != null ? Math.max(0, Math.trunc(volume.sales24h)) : (isQuotation ? 0 : null);
  let s7 = volume.sales7d != null ? Math.max(0, Math.trunc(volume.sales7d)) : (isQuotation ? 0 : null);
  let s30 = volume.sales30d != null ? Math.max(0, Math.trunc(volume.sales30d)) : null;

  if (s24 != null && s7 != null && s24 > s7) {
    s7 = s24;
  }
  if (s7 != null && s30 != null && s7 > s30) {
    s30 = s7;
  }

  const avg = (s24 === 0 && s7 === 0)
    ? 0
    : (volume.avgDailySales != null ? Math.max(0, Number(volume.avgDailySales)) : null);
  const sug = volume.suggestedPrice != null ? Math.max(0, Math.trunc(volume.suggestedPrice)) : null;
  const strat = volume.priceStrategy || null;

  await database.execute({
    sql: `INSERT INTO profile_sales_volume (
      profile_id, item_id, sales_24h, sales_7d, sales_30d,
      avg_daily_sales, suggested_price, price_strategy, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(profile_id, item_id) DO UPDATE SET
      sales_24h = excluded.sales_24h,
      sales_7d = excluded.sales_7d,
      sales_30d = excluded.sales_30d,
      avg_daily_sales = excluded.avg_daily_sales,
      suggested_price = excluded.suggested_price,
      price_strategy = excluded.price_strategy,
      updated_at = excluded.updated_at
    WHERE excluded.updated_at >= profile_sales_volume.updated_at`,
    args: [pid, itemId, s24, s7, s30, avg, sug, strat, now],
  });

  const fullVol: ItemSalesVolume = {
    sales24h: s24 ?? undefined,
    sales7d: s7 ?? undefined,
    sales30d: s30 ?? undefined,
    avgDailySales: avg ?? undefined,
    suggestedPrice: sug ?? undefined,
    priceStrategy: strat as any,
    updatedAt: now,
  };

  marketEvents.emit("volume_update", {
    profileId: pid,
    itemId,
    volume: fullVol,
    updatedAt: now,
  });

  await correctPricesAgainstSalesVolume(pid, { [itemId]: fullVol });

  return { success: true, volume: fullVol, updatedAt: now };
}

export async function bulkSetItemSalesVolume(
  volumes: Record<number, Partial<ItemSalesVolume>>,
  profileId?: number,
): Promise<{ success: boolean; count: number }> {
  invalidateServerBootstrapCache();
  const pid = profileId || (await getActivePriceProfileId());
  const statements: Array<{ sql: string; args: any[] }> = [];

  for (const [idStr, vol] of Object.entries(volumes)) {
    const itemId = Number(idStr);
    if (!itemId || !vol) continue;
    const now = vol.updatedAt && vol.updatedAt > 0 ? vol.updatedAt : Date.now();
    const isQuotation =
      vol.sales7d != null ||
      vol.sales30d != null ||
      vol.sales24h != null ||
      vol.suggestedPrice != null;
    let s24 = vol.sales24h != null ? Math.max(0, Math.trunc(vol.sales24h)) : (isQuotation ? 0 : null);
    let s7 = vol.sales7d != null ? Math.max(0, Math.trunc(vol.sales7d)) : (isQuotation ? 0 : null);
    let s30 = vol.sales30d != null ? Math.max(0, Math.trunc(vol.sales30d)) : null;

    if (s24 != null && s7 != null && s24 > s7) {
      s7 = s24;
    }
    if (s7 != null && s30 != null && s7 > s30) {
      s30 = s7;
    }

    const avg = (s24 === 0 && s7 === 0)
      ? 0
      : (vol.avgDailySales != null ? Math.max(0, Number(vol.avgDailySales)) : null);
    const sug = vol.suggestedPrice != null ? Math.max(0, Math.trunc(vol.suggestedPrice)) : null;
    const strat = vol.priceStrategy || null;

    statements.push({
      sql: `INSERT INTO profile_sales_volume (
        profile_id, item_id, sales_24h, sales_7d, sales_30d,
        avg_daily_sales, suggested_price, price_strategy, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(profile_id, item_id) DO UPDATE SET
        sales_24h = excluded.sales_24h,
        sales_7d = excluded.sales_7d,
        sales_30d = excluded.sales_30d,
        avg_daily_sales = excluded.avg_daily_sales,
        suggested_price = excluded.suggested_price,
        price_strategy = excluded.price_strategy,
        updated_at = excluded.updated_at
      WHERE excluded.updated_at >= profile_sales_volume.updated_at`,
      args: [pid, itemId, s24, s7, s30, avg, sug, strat, now],
    });
  }

  if (statements.length > 0) {
    await database.batch(statements, "write");
    marketEvents.emit("batch_volume_updated", {
      profileId: pid,
      count: statements.length,
      timestamp: Date.now(),
    });
  }

  return { success: true, count: statements.length };
}

export async function correctPricesAgainstSalesVolume(
  profileId: number,
  volumes: Record<number, any>
): Promise<Array<{ item_id: number; item_name: string; old_price: number; new_price: number }>> {
  const corrected: Array<{ item_id: number; item_name: string; old_price: number; new_price: number }> = [];
  const entries = Object.entries(volumes);

  for (const [idStr, svRaw] of entries) {
    const sItemId = Number(idStr);
    const sv = svRaw as any;
    const sug = Number(sv?.suggestedPrice || sv?.suggested_price || 0);
    if (sItemId > 0 && sug >= 1) {
      const currentPrice = await getPrice(profileId, sItemId);
      if (currentPrice > 0) {
        const isExaggerated = currentPrice >= sug * 3.0;
        if (isExaggerated) {
          await upsertPrice(profileId, sItemId, sug, "cotizacion_safeguard");
          invalidateServerBootstrapCache();

          let itemName = "";
          try {
            const it = await getOrFetchItemById(sItemId);
            itemName = it?.name?.es || `Objeto #${sItemId}`;
          } catch {
            itemName = `Objeto #${sItemId}`;
          }

          marketEvents.emit("price_update", {
            profileId,
            itemId: sItemId,
            price: sug,
            updatedAt: Date.now(),
            name: itemName,
            source: "cotizacion_safeguard",
          });

          corrected.push({
            item_id: sItemId,
            item_name: itemName,
            old_price: currentPrice,
            new_price: sug,
          });
        }
      } else {
        await upsertPrice(profileId, sItemId, sug, "cotizacion_sin_stock");
        invalidateServerBootstrapCache();

        let itemName = "";
        try {
          const it = await getOrFetchItemById(sItemId);
          itemName = it?.name?.es || `Objeto #${sItemId}`;
        } catch {
          itemName = `Objeto #${sItemId}`;
        }

        marketEvents.emit("price_update", {
          profileId,
          itemId: sItemId,
          price: sug,
          updatedAt: Date.now(),
          name: itemName,
          source: "cotizacion_sin_stock",
        });

        corrected.push({
          item_id: sItemId,
          item_name: itemName,
          old_price: 0,
          new_price: sug,
        });
      }
    }
  }

  return corrected;
}

export async function getProfileIdByServerNameOrSlug(serverNameOrSlug?: string): Promise<{ profileId: number; profileName: string }> {
  const profiles = await getPriceProfiles();
  const activePid = await getActivePriceProfileId();
  const activeProfile = profiles.find((p) => p.id === activePid) || profiles[0];

  if (!serverNameOrSlug || typeof serverNameOrSlug !== "string" || !serverNameOrSlug.trim()) {
    return { profileId: activeProfile?.id || 1, profileName: activeProfile?.name || "Draconiros" };
  }

  const clean = serverNameOrSlug.trim().toLowerCase().replace(/[\s\-_]/g, "");
  const match = profiles.find((p) => {
    const pSlug = p.slug.toLowerCase().replace(/[\s\-_]/g, "");
    const pName = p.name.toLowerCase().replace(/[\s\-_]/g, "");
    return pSlug === clean || pName === clean || pSlug.includes(clean) || clean.includes(pSlug);
  });

  if (match) {
    return { profileId: match.id, profileName: match.name };
  }

  return { profileId: activeProfile?.id || 1, profileName: activeProfile?.name || "Draconiros" };
}

export async function processAndIngestMarketPrice(
  payload: IngestMarketPricePayload,
): Promise<IngestMarketPriceResult> {
  const itemId = Number(payload.item_id);
  if (!itemId || Number.isNaN(itemId) || itemId <= 0 || itemId > 1_000_000_000) {
    throw new Error("El campo 'item_id' es obligatorio y debe ser un número entero positivo válido.");
  }

  let itemRecord: DofusItem | null = null;
  try {
    itemRecord = await getOrFetchItemById(itemId);
  } catch {
    // ignore
  }

  let resolvedName = (payload.item_name || '').trim();
  if (itemRecord?.name?.es && !itemRecord.name.es.startsWith("Objeto #") && !itemRecord.name.es.startsWith("Item #")) {
    resolvedName = itemRecord.name.es;
  } else if (ALL_DOFUS_RUNES_DICT[String(itemId)]) {
    resolvedName = ALL_DOFUS_RUNES_DICT[String(itemId)];
  } else if (SUPPLEMENTARY_ITEMS_DICT[String(itemId)]) {
    resolvedName = SUPPLEMENTARY_ITEMS_DICT[String(itemId)];
  }

  const isKnownValidItem = !!(
    (itemRecord && itemRecord.name?.es && !itemRecord.name.es.startsWith("Objeto #") && !itemRecord.name.es.startsWith("Item #")) ||
    ALL_DOFUS_RUNES_DICT[String(itemId)] ||
    SUPPLEMENTARY_ITEMS_DICT[String(itemId)] ||
    STATIC_ITEMS_DICT[String(itemId)]
  );

  if (!isKnownValidItem || !resolvedName || resolvedName.startsWith("Objeto #") || resolvedName.startsWith("Item #") || (resolvedName.toLowerCase() === "puré pic-feil" && itemId !== 35089)) {
    console.warn(`[Market Ingest] ID descartado por no existir en Dofus o colisión inválida: #${itemId} (${resolvedName})`);
    return {
      success: false,
      item_id: itemId,
      name: `Objeto Inválido #${itemId}`,
      type: "desconocido",
      calculated_price: 0,
      min_price: 0,
      max_price: 0,
      raw_average: 0,
      offers_count: 0,
      filtered_outliers: 0,
      anti_troll_triggered: false,
      server: payload.server || "Draconiros",
      profile_id: 1,
      updated_at: Date.now(),
    };
  }

  const cleanServer = typeof payload.server === "string" ? payload.server.slice(0, 60) : "";
  const { profileId, profileName } = await getProfileIdByServerNameOrSlug(cleanServer);

  let refSuggestedPrice = Number(payload.suggested_price || payload.suggestedPrice || 0);
  if (!refSuggestedPrice) {
    const vol = await getProfileSalesVolumeForItem(profileId, itemId);
    refSuggestedPrice = vol?.suggestedPrice || 0;
  }

  const calc = calculateItemMarketPrice(itemRecord, payload.precios, (payload.type || '').toLowerCase(), refSuggestedPrice);

  const now = Date.now();
  if (calc.finalPrice > 0) {
    await upsertPrice(profileId, itemId, calc.finalPrice, payload.source || 'sniffer');
    invalidateServerBootstrapCache();
    marketEvents.emit("price_update", {
      profileId,
      itemId,
      price: calc.finalPrice,
      updatedAt: now,
      name: resolvedName,
      source: payload.source || "sniffer",
    });
  }

  return {
    success: true,
    item_id: itemId,
    name: resolvedName,
    type: calc.resolvedType,
    calculated_price: calc.finalPrice,
    min_price: calc.minPrice,
    max_price: calc.maxPrice,
    raw_average: calc.rawAvg,
    offers_count: calc.offersCount,
    filtered_outliers: calc.filteredOutliers,
    anti_troll_triggered: calc.antiTrollTriggered,
    server: profileName,
    profile_id: profileId,
    updated_at: now,
  };
}

export async function processAndIngestMarketPricesBatch(
  items: IngestMarketPricePayload[],
): Promise<{ success: boolean; total_processed: number; results: IngestMarketPriceResult[] }> {
  if (!Array.isArray(items) || items.length === 0) {
    return { success: true, total_processed: 0, results: [] };
  }

  const results: IngestMarketPriceResult[] = [];
  const profileMap = new Map<string, { profileId: number; profileName: string }>();

  const suggestedPriceMap = new Map<string, number>();
  const idsNeedingSuggested = items
    .filter(p => !p.suggested_price && !p.suggestedPrice)
    .map(p => Number(p.item_id))
    .filter(id => id > 0);

  if (idsNeedingSuggested.length > 0) {
    const CHUNK_SIZE = 50;
    for (let i = 0; i < idsNeedingSuggested.length; i += CHUNK_SIZE) {
      const chunk = idsNeedingSuggested.slice(i, i + CHUNK_SIZE);
      const placeholders = chunk.map(() => '?').join(',');
      try {
        const queryRes = await database.execute({
          sql: `SELECT profile_id, item_id, suggested_price FROM profile_sales_volume WHERE item_id IN (${placeholders})`,
          args: chunk,
        });
        for (const row of queryRes.rows) {
          const pid = Number(row.profile_id);
          const iid = Number(row.item_id);
          const sug = Number(row.suggested_price) || 0;
          if (sug > 0) {
            suggestedPriceMap.set(`${pid}:${iid}`, sug);
          }
        }
      } catch (err) {
        console.warn("[processAndIngestMarketPricesBatch] Error querying suggested prices:", err);
      }
    }
  }

  const parsedItems: Array<{
    payload: IngestMarketPricePayload;
    itemId: number;
    profileId: number;
    profileName: string;
    resolvedType: string;
    finalPrice: number;
    minPrice: number;
    maxPrice: number;
    rawAvg: number;
    offersCount: number;
    filteredOutliers: number;
    antiTrollTriggered: boolean;
    resolvedName: string;
  }> = [];

  for (const payload of items) {
    const itemId = Number(payload.item_id);
    if (!itemId || Number.isNaN(itemId) || itemId <= 0) continue;

    const serverKey = (payload.server || '').trim().toLowerCase();
    let profileInfo = profileMap.get(serverKey);
    if (!profileInfo) {
      profileInfo = await getProfileIdByServerNameOrSlug(payload.server);
      profileMap.set(serverKey, profileInfo);
    }

    const { profileId, profileName } = profileInfo;

    let itemRecord: DofusItem | null = null;
    try {
      itemRecord = await getOrFetchItemById(itemId);
    } catch {}

    let resolvedName = (payload.item_name || '').trim();
    if (itemRecord?.name?.es && !itemRecord.name.es.startsWith("Objeto #") && !itemRecord.name.es.startsWith("Item #")) {
      resolvedName = itemRecord.name.es;
    } else if (ALL_DOFUS_RUNES_DICT[String(itemId)]) {
      resolvedName = ALL_DOFUS_RUNES_DICT[String(itemId)];
    } else if (SUPPLEMENTARY_ITEMS_DICT[String(itemId)]) {
      resolvedName = SUPPLEMENTARY_ITEMS_DICT[String(itemId)];
    }

    const isKnownValidItem = !!(
      (itemRecord && itemRecord.name?.es && !itemRecord.name.es.startsWith("Objeto #") && !itemRecord.name.es.startsWith("Item #")) ||
      ALL_DOFUS_RUNES_DICT[String(itemId)] ||
      SUPPLEMENTARY_ITEMS_DICT[String(itemId)] ||
      STATIC_ITEMS_DICT[String(itemId)]
    );

    if (!isKnownValidItem || !resolvedName || resolvedName.startsWith("Objeto #") || resolvedName.startsWith("Item #") || (resolvedName.toLowerCase() === "puré pic-feil" && itemId !== 35089)) {
      continue;
    }

    const refSuggestedPrice = Number(payload.suggested_price || payload.suggestedPrice || suggestedPriceMap.get(`${profileId}:${itemId}`) || 0);
    const calc = calculateItemMarketPrice(itemRecord, payload.precios, (payload.type || '').toLowerCase(), refSuggestedPrice);

    parsedItems.push({
      payload,
      itemId,
      profileId,
      profileName,
      resolvedType: calc.resolvedType,
      finalPrice: calc.finalPrice,
      minPrice: calc.minPrice,
      maxPrice: calc.maxPrice,
      rawAvg: calc.rawAvg,
      offersCount: calc.offersCount,
      filteredOutliers: calc.filteredOutliers,
      antiTrollTriggered: calc.antiTrollTriggered,
      resolvedName,
    });
  }

  if (parsedItems.length === 0) {
    return { success: true, total_processed: 0, results: [] };
  }

  const now = Date.now();
  const uniqueProfileIds = Array.from(new Set(parsedItems.map(p => p.profileId)));
  const oldPricesMap = new Map<string, number>();

  for (const pid of uniqueProfileIds) {
    const itemIdsForProfile = Array.from(new Set(parsedItems.filter(p => p.profileId === pid).map(p => p.itemId)));
    if (itemIdsForProfile.length > 0) {
      const CHUNK_SIZE = 50;
      for (let i = 0; i < itemIdsForProfile.length; i += CHUNK_SIZE) {
        const chunk = itemIdsForProfile.slice(i, i + CHUNK_SIZE);
        try {
          const placeholders = chunk.map(() => '?').join(',');
          const queryRes = await database.execute({
            sql: `SELECT item_id, price FROM profile_prices WHERE profile_id = ? AND item_id IN (${placeholders})`,
            args: [pid, ...chunk],
          });
          for (const row of queryRes.rows) {
            oldPricesMap.set(`${pid}:${row.item_id}`, Number(row.price) || 0);
          }
        } catch (err) {
          console.warn(`[processAndIngestMarketPricesBatch] Error querying old prices chunk for profile ${pid}:`, err);
        }
      }
    }
  }

  const statements: Array<{ sql: string; args: any[] }> = [];

  for (const item of parsedItems) {
    const { profileId, profileName, itemId, finalPrice, minPrice, maxPrice, rawAvg, offersCount, filteredOutliers, antiTrollTriggered, resolvedName, resolvedType, payload } = item;
    const key = `${profileId}:${itemId}`;
    const oldPrice = oldPricesMap.get(key) || 0;

    if (finalPrice > 0) {
      statements.push({
        sql: `INSERT INTO profile_prices (profile_id, item_id, price, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(profile_id, item_id) DO UPDATE SET price = excluded.price, updated_at = excluded.updated_at`,
        args: [profileId, itemId, finalPrice, now],
      });

      if (finalPrice !== oldPrice) {
        const diff = finalPrice - oldPrice;
        const pctChange =
          oldPrice > 0
            ? ((finalPrice - oldPrice) / oldPrice) * 100
            : finalPrice > 0
            ? 100
            : 0;
        statements.push({
          sql: `INSERT INTO price_history (profile_id, item_id, price, old_price, difference, percentage_change, source, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            profileId,
            itemId,
            finalPrice,
            oldPrice,
            diff,
            Number(pctChange.toFixed(2)),
            payload.source || 'sniffer',
            now,
          ],
        });
      }
    }

    results.push({
      success: true,
      item_id: itemId,
      name: resolvedName,
      type: resolvedType,
      calculated_price: finalPrice,
      min_price: minPrice,
      max_price: maxPrice,
      raw_average: rawAvg,
      offers_count: offersCount,
      filtered_outliers: filteredOutliers,
      anti_troll_triggered: antiTrollTriggered,
      server: profileName,
      profile_id: profileId,
      updated_at: now,
    });
  }

  if (statements.length > 0) {
    for (let i = 0; i < statements.length; i += 250) {
      await database.batch(statements.slice(i, i + 250), "write");
    }
  }

  invalidateServerBootstrapCache();

  if (results.length > 0) {
    const batchPrices: MarketPriceMap = {};
    const batchUpdatedAt: PriceUpdatedAtMap = {};
    for (const r of results) {
      if (r.calculated_price > 0) {
        batchPrices[r.item_id] = r.calculated_price;
        batchUpdatedAt[r.item_id] = r.updated_at;
      }
    }
    marketEvents.emit("batch_updated", {
      profileId: results[0]?.profile_id || 1,
      prices: batchPrices,
      priceUpdatedAt: batchUpdatedAt,
      count: Object.keys(batchPrices).length,
      timestamp: Date.now(),
    });
  }

  return {
    success: true,
    total_processed: results.length,
    results,
  };
}

export async function getLatestMarketPricesDelta(
  profileId: number,
  sinceTimestamp: number = 0,
): Promise<{
  prices: MarketPriceMap;
  priceUpdatedAt: PriceUpdatedAtMap;
  salesVolume: SalesVolumeMap;
  serverTime: number;
  totalUpdated: number;
}> {
  const serverTime = Date.now();
  const safeSince = Number(sinceTimestamp) || 0;

  try {
    const [priceResult, volumeResult] = await Promise.all([
      database.execute({
        sql: "SELECT item_id, price, updated_at FROM profile_prices WHERE profile_id = ? AND updated_at >= ? ORDER BY updated_at ASC",
        args: [profileId, safeSince],
      }),
      database.execute({
        sql: "SELECT item_id, sales_24h, sales_7d, sales_30d, avg_daily_sales, suggested_price, price_strategy, updated_at FROM profile_sales_volume WHERE profile_id = ? AND updated_at >= ? ORDER BY updated_at ASC",
        args: [profileId, safeSince],
      }).catch(() => ({ rows: [] as any[] })),
    ]);

    const prices: MarketPriceMap = {};
    const priceUpdatedAt: PriceUpdatedAtMap = {};
    const salesVolume: SalesVolumeMap = {};

    for (const row of priceResult.rows) {
      const itemId = Number(row.item_id);
      prices[itemId] = Number(row.price);
      priceUpdatedAt[itemId] = Number(row.updated_at);
    }

    for (const row of volumeResult.rows) {
      const itemId = Number(row.item_id);
      if (itemId > 0) {
        salesVolume[itemId] = {
          sales24h: row.sales_24h != null ? Number(row.sales_24h) : undefined,
          sales7d: row.sales_7d != null ? Number(row.sales_7d) : undefined,
          sales30d: row.sales_30d != null ? Number(row.sales_30d) : undefined,
          avgDailySales: row.avg_daily_sales != null ? Number(row.avg_daily_sales) : undefined,
          suggestedPrice: row.suggested_price != null ? Number(row.suggested_price) : undefined,
          priceStrategy: (row.price_strategy as any) || undefined,
          updatedAt: Number(row.updated_at) || Date.now(),
        };
      }
    }

    return {
      prices,
      priceUpdatedAt,
      salesVolume,
      serverTime,
      totalUpdated: Object.keys(prices).length + Object.keys(salesVolume).length,
    };
  } catch (err) {
    console.error("[getLatestMarketPricesDelta Error]:", err);
    return {
      prices: {},
      priceUpdatedAt: {},
      salesVolume: {},
      serverTime,
      totalUpdated: 0,
    };
  }
}
