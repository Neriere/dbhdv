import { database } from "../connection";
import { parseJsonValue, fetchJson } from "../helpers";
import { isOmittedItem } from "../../../data/dofusJobs";
import {
  UNITY_SERVER_PROFILES,
  ensureDefaultPriceProfile,
  getActivePriceProfileId,
} from "../serverProfiles";
import type {
  DofusItem,
  DofusRecipe,
  MarketPriceMap,
  PriceProfile,
  PriceUpdatedAtMap,
  SalesVolumeMap,
  ServerCategory,
  SyncSettings,
  SyncStatus,
  ItemSalesVolume,
} from "../../../types";
import type { BootstrapData } from "../types";
import {
  upsertItems,
  upsertRecipes,
  normalizeSpanishItem,
  normalizeRecipe,
  seedDatabaseFromBundle,
} from "./items";
import {
  getPricesAndUpdatedAtMaps,
  overwritePrices,
} from "./market";

const DOFUS_API_BASE = "https://api.dofusdb.fr";

const DEFAULT_SYNC_SETTINGS: SyncSettings = {
  enabled: true,
  intervalDays: 30,
};

export function getDefaultSyncStatus(): SyncStatus {
  return {
    lastSyncTimestamp: null,
    totalImported: 0,
    recipesCount: 0,
    equipablesCount: 0,
    consumablesCount: 0,
    resourcesCount: 0,
    cosmeticsOmittedCount: 0,
    isLoading: false,
    progressMessage: "",
    progressPercent: 0,
    currentStep: "",
    totalSteps: 3,
    currentStepIndex: 0,
  };
}

export async function setMetaValue(key: string, value: unknown): Promise<void> {
  await database.execute({
    sql: `INSERT INTO meta (key, value_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
    args: [key, JSON.stringify(value), Date.now()],
  });
}

export async function getMetaValue<T>(key: string): Promise<T | null> {
  const result = await database.execute({
    sql: "SELECT value_json FROM meta WHERE key = ?",
    args: [key],
  });
  const row = result.rows[0];
  return row ? parseJsonValue<T>(row.value_json as string) : null;
}

let serverBootstrapCache: { data: BootstrapData; expiresAt: number } | null = null;
const SERVER_CACHE_TTL_MS = 60 * 1000;

export function invalidateServerBootstrapCache(): void {
  serverBootstrapCache = null;
}

let runningImportPromise: Promise<BootstrapData> | null = null;

export async function getSyncStatus(): Promise<SyncStatus> {
  const status = await getMetaValue<SyncStatus>("sync_status");
  const current = status ?? getDefaultSyncStatus();
  if (current.isLoading && !runningImportPromise) {
    current.isLoading = false;
    current.progressPercent = 100;
  }
  return current;
}

export async function setSyncStatus(status: SyncStatus): Promise<void> {
  await setMetaValue("sync_status", status);
}

export async function resetSyncStatus(): Promise<SyncStatus> {
  runningImportPromise = null;
  const current = await getSyncStatus();
  const reset: SyncStatus = {
    ...current,
    isLoading: false,
    progressMessage: "Listo.",
    progressPercent: 100,
    currentStep: "Listo",
  };
  await setMetaValue("sync_status", reset);
  return reset;
}

export async function getSyncSettings(): Promise<SyncSettings> {
  const stored = await getMetaValue<SyncSettings>("sync_settings");
  return stored ?? DEFAULT_SYNC_SETTINGS;
}

export async function setSyncSettings(settings: SyncSettings): Promise<SyncSettings> {
  const normalizedSettings = {
    enabled: settings.enabled !== false,
    intervalDays: Math.min(
      30,
      Math.max(1, Number(settings.intervalDays) || 30),
    ),
  };
  await setMetaValue("sync_settings", normalizedSettings);
  return normalizedSettings;
}

export async function buildBootstrapData(): Promise<BootstrapData> {
  if (serverBootstrapCache && Date.now() < serverBootstrapCache.expiresAt) {
    return serverBootstrapCache.data;
  }

  const activeProfileId = await getActivePriceProfileId();

  const batchResults = await database.batch([
    { sql: "SELECT payload_json FROM items ORDER BY name_es COLLATE NOCASE ASC, id ASC", args: [] },
    { sql: "SELECT payload_json FROM recipes ORDER BY result_id ASC", args: [] },
    { sql: "SELECT item_id, price, updated_at FROM profile_prices WHERE profile_id = ?", args: [activeProfileId] },
    { sql: "SELECT value_json FROM meta WHERE key = 'sync_status'", args: [] },
    { sql: "SELECT value_json FROM meta WHERE key = 'sync_settings'", args: [] },
    { sql: "SELECT id, name, slug, category, category_label, is_default FROM price_profiles ORDER BY id ASC", args: [] },
    { sql: "SELECT item_id, coefficient, updated_at, is_manual, manual_updated_at FROM profile_coefficients WHERE profile_id = ?", args: [activeProfileId] },
    { sql: "SELECT item_id, sales_24h, sales_7d, sales_30d, avg_daily_sales, suggested_price, price_strategy, updated_at FROM profile_sales_volume WHERE profile_id = ?", args: [activeProfileId] },
  ], "read");

  const items: DofusItem[] = batchResults[0].rows
    .map((row) => parseJsonValue<DofusItem>(row.payload_json as string))
    .filter((item) => item && item.id > 0 && !isOmittedItem(item as any));

  const recipes: Record<number, DofusRecipe> = {};
  for (const row of batchResults[1].rows) {
    const recipe = parseJsonValue<DofusRecipe>(row.payload_json as string);
    recipes[recipe.resultId] = recipe;
  }

  const prices: MarketPriceMap = {};
  const priceUpdatedAt: PriceUpdatedAtMap = {};
  for (const row of batchResults[2].rows) {
    const id = row.item_id as number;
    prices[id] = row.price as number;
    priceUpdatedAt[id] = row.updated_at as number;
  }

  const syncStatusRow = batchResults[3].rows[0];
  const syncStatus: SyncStatus = syncStatusRow
    ? parseJsonValue<SyncStatus>(syncStatusRow.value_json as string)
    : getDefaultSyncStatus();

  const syncSettingsRow = batchResults[4].rows[0];
  const syncSettings: SyncSettings = syncSettingsRow
    ? parseJsonValue<SyncSettings>(syncSettingsRow.value_json as string)
    : DEFAULT_SYNC_SETTINGS;

  const bySlug = new Map(
    batchResults[5].rows.map((row) => [
      row.slug as string,
      {
        id: row.id as number,
        name: row.name as string,
        slug: row.slug as string,
        category:
          (row.category as ServerCategory) ||
          UNITY_SERVER_PROFILES.find((p) => p.slug === row.slug)?.category ||
          "monocuenta_clasico",
        categoryLabel:
          (row.category_label as string) ||
          UNITY_SERVER_PROFILES.find((p) => p.slug === row.slug)?.categoryLabel ||
          "Monocuenta Clásico",
        isDefault: (row.is_default as number) === 1,
      } as PriceProfile,
    ]),
  );
  const priceProfiles: PriceProfile[] = [];
  for (const profile of UNITY_SERVER_PROFILES) {
    const existing = bySlug.get(profile.slug);
    if (existing) {
      priceProfiles.push({
        ...existing,
        name: profile.name,
        category: profile.category,
        categoryLabel: profile.categoryLabel,
      });
    }
  }

  const coefficients: Record<number, number> = {};
  const coefficientUpdatedAt: Record<number, number> = {};
  const manualEdits: Record<number, number> = {};
  if (batchResults[6]?.rows) {
    for (const row of batchResults[6].rows) {
      const id = row.item_id as number;
      coefficients[id] = row.coefficient as number;
      coefficientUpdatedAt[id] = row.updated_at as number;
      if (Number(row.is_manual) === 1 && row.manual_updated_at) {
        manualEdits[id] = Number(row.manual_updated_at);
      }
    }
  }

  const salesVolume: SalesVolumeMap = {};
  if (batchResults[7]?.rows) {
    for (const row of batchResults[7].rows) {
      const id = row.item_id as number;
      salesVolume[id] = {
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

  for (const [idStr, vol] of Object.entries(salesVolume)) {
    const id = Number(idStr);
    const itemVol = vol as ItemSalesVolume | undefined;
    if (id > 0 && (prices[id] === undefined || prices[id] <= 0) && itemVol?.suggestedPrice && itemVol.suggestedPrice >= 1) {
      prices[id] = Math.round(itemVol.suggestedPrice);
      if (!priceUpdatedAt[id]) {
        priceUpdatedAt[id] = itemVol.updatedAt || Date.now();
      }
    }
  }

  const resultData: BootstrapData = {
    items,
    recipes,
    prices,
    priceUpdatedAt,
    salesVolume,
    coefficients,
    coefficientUpdatedAt,
    manualEdits,
    syncStatus,
    syncSettings,
    priceProfiles,
    activePriceProfileId: activeProfileId,
  };

  serverBootstrapCache = {
    data: resultData,
    expiresAt: Date.now() + SERVER_CACHE_TTL_MS,
  };

  return resultData;
}

export function getDatabaseFilePath(): string {
  return process.env.DATABASE_URL || "turso-cloud-db";
}

export async function getBootstrapData() {
  await ensureDefaultPriceProfile();
  let data = await buildBootstrapData();
  if (data.items.length === 0) {
    console.log("[Database] Empty database detected, auto-seeding bundled dataset...");
    data = await seedDatabaseFromBundle(false);
  }
  return {
    ...data,
    databasePath: getDatabaseFilePath(),
  };
}

export async function getAutomaticSyncState() {
  return {
    syncSettings: await getSyncSettings(),
    syncStatus: await getSyncStatus(),
  };
}

export async function updateAutomaticSyncSettings(settings: SyncSettings) {
  const s = await setSyncSettings(settings);
  if (s.enabled) await maybeStartAutomaticSync();
  return { syncSettings: s, syncStatus: await getSyncStatus() };
}

export async function maybeStartAutomaticSync(): Promise<void> {
  if (runningImportPromise) return;
  const syncStatus = await getSyncStatus();
  const syncSettings = await getSyncSettings();
  const intervalMs = syncSettings.intervalDays * 24 * 60 * 60 * 1000;
  if (
    !syncSettings.enabled ||
    (syncStatus.lastSyncTimestamp &&
      Date.now() - syncStatus.lastSyncTimestamp < intervalMs)
  )
    return;
  void importAllDofusData().catch(console.error);
}

export async function importAllDofusData() {
  if (!runningImportPromise)
    runningImportPromise = importAllDofusDataInternal().finally(() => {
      runningImportPromise = null;
    });
  return runningImportPromise;
}

async function importAllDofusDataInternal(): Promise<BootstrapData> {
  const previousStatus = await getSyncStatus();
  const status: SyncStatus = {
    ...getDefaultSyncStatus(),
    lastSyncTimestamp: previousStatus.lastSyncTimestamp,
    isLoading: true,
    progressMessage: "Conectando con DofusDB...",
    progressPercent: 2,
    currentStep: "Iniciando importación",
    totalSteps: 3,
    currentStepIndex: 1,
  };
  await setSyncStatus(status);

  try {
    const itemsMap = new Map<number, DofusItem>();
    const recipesMap = new Map<number, DofusRecipe>();

    const itemLimit = 50;
    const itemConcurrency = 12;
    let itemTotal = 50;
    let itemSkip = 0;

    try {
      const probe = await fetchJson<{ total?: number; data?: Record<string, unknown>[] }>(
        `${DOFUS_API_BASE}/items?$limit=1&lang=es`
      );
      if (typeof probe.total === "number" && probe.total > 0) {
        itemTotal = probe.total;
      }
    } catch {}

    while (itemSkip < itemTotal) {
      const fetchPromises = [];
      for (let c = 0; c < itemConcurrency && itemSkip + c * itemLimit < itemTotal; c++) {
        const currentSkip = itemSkip + c * itemLimit;
        const params = new URLSearchParams({
          $limit: String(itemLimit),
          $skip: String(currentSkip),
          lang: "es",
        });
        fetchPromises.push(
          fetchJson<{ total?: number; data?: Record<string, unknown>[] }>(
            `${DOFUS_API_BASE}/items?${params.toString()}`
          ).catch(() => ({ total: itemTotal, data: [] }))
        );
      }

      const chunkResults = await Promise.all(fetchPromises);
      let itemsInBatch = 0;

      for (const body of chunkResults) {
        const items = body.data ?? [];
        if (typeof body.total === "number" && body.total > itemTotal) {
          itemTotal = body.total;
        }
        itemsInBatch += items.length;

        for (const rawItem of items) {
          const normalizedItem = normalizeSpanishItem(rawItem);
          if (!normalizedItem.id) continue;

          if (isOmittedItem(normalizedItem as any)) {
            status.cosmeticsOmittedCount += 1;
            continue;
          }

          itemsMap.set(normalizedItem.id, normalizedItem);

          const rawRecipe =
            (rawItem.recipe as Record<string, unknown> | undefined) ??
            (rawItem.craft as Record<string, unknown> | undefined);
          if (rawRecipe) {
            const normalizedRecipe = normalizeRecipe({
              ...rawRecipe,
              resultId: normalizedItem.id,
            });
            if (normalizedRecipe) {
              recipesMap.set(normalizedItem.id, normalizedRecipe);
            }
          }
        }
      }

      itemSkip += itemConcurrency * itemLimit;
      const progressPercent = Math.min(
        75,
        Math.round((itemSkip / Math.max(1, itemTotal)) * 75),
      );
      status.totalImported = itemsMap.size;
      status.progressPercent = progressPercent;
      status.progressMessage = `Descargados ${itemsMap.size.toLocaleString()} objetos (${progressPercent}%)...`;
      await setSyncStatus(status);

      if (itemsInBatch === 0) break;
    }

    const recipeLimit = 50;
    const recipeConcurrency = 8;
    let recipeTotal = 50;
    let recipeSkip = 0;

    try {
      const probeRecipe = await fetchJson<{ total?: number }>(
        `${DOFUS_API_BASE}/recipes?$limit=1`
      );
      if (typeof probeRecipe.total === "number" && probeRecipe.total > 0) {
        recipeTotal = probeRecipe.total;
      }
    } catch {}

    while (recipeSkip < recipeTotal) {
      const fetchPromises = [];
      for (let c = 0; c < recipeConcurrency && recipeSkip + c * recipeLimit < recipeTotal; c++) {
        const currentSkip = recipeSkip + c * recipeLimit;
        const params = new URLSearchParams({
          $limit: String(recipeLimit),
          $skip: String(currentSkip),
        });
        fetchPromises.push(
          fetchJson<{ total?: number; data?: Record<string, unknown>[] }>(
            `${DOFUS_API_BASE}/recipes?${params.toString()}`
          ).catch(() => ({ total: recipeTotal, data: [] }))
        );
      }

      const chunkResults = await Promise.all(fetchPromises);
      let recipesInBatch = 0;

      for (const body of chunkResults) {
        const recipes = body.data ?? [];
        if (typeof body.total === "number" && body.total > recipeTotal) {
          recipeTotal = body.total;
        }
        recipesInBatch += recipes.length;

        for (const rawRecipe of recipes) {
          const normalized = normalizeRecipe(rawRecipe);
          if (normalized) {
            recipesMap.set(normalized.resultId, normalized);
          }
        }
      }

      recipeSkip += recipeConcurrency * recipeLimit;
      const recipeProgress = Math.min(
        15,
        Math.round((recipeSkip / Math.max(1, recipeTotal)) * 15),
      );
      status.recipesCount = recipesMap.size;
      status.progressPercent = 75 + recipeProgress;
      status.progressMessage = `Descargadas ${recipesMap.size.toLocaleString()} recetas (${status.progressPercent}%)...`;
      await setSyncStatus(status);

      if (recipesInBatch === 0) break;
    }

    status.currentStep = "Guardando en Turso DB";
    status.currentStepIndex = 3;
    status.progressPercent = 90;
    status.progressMessage = "Guardando dataset completo en Turso...";
    await setSyncStatus(status);

    const allItems = Array.from(itemsMap.values());
    const allRecipes = Array.from(recipesMap.values());

    await database.execute("DELETE FROM items");
    await database.execute("DELETE FROM item_stats");
    await database.execute("DELETE FROM recipes");
    await database.execute("DELETE FROM recipe_ingredients");

    await upsertItems(allItems);
    await upsertRecipes(allRecipes);

    let equipablesCount = 0;
    let consumablesCount = 0;
    let resourcesCount = 0;

    for (const item of allItems) {
      const superCategoryId = item.type?.superCategoryId ?? 0;
      const typeId = item.typeId || item.type?.id || 0;
      if (
        superCategoryId === 1 ||
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 16, 17, 81].includes(typeId)
      ) {
        equipablesCount += 1;
      } else if ([33, 37, 38, 42, 43, 68, 69, 104, 219].includes(typeId)) {
        consumablesCount += 1;
      } else {
        resourcesCount += 1;
      }
    }

    status.lastSyncTimestamp = Date.now();
    status.totalImported = allItems.length;
    status.recipesCount = allRecipes.length;
    status.equipablesCount = equipablesCount;
    status.consumablesCount = consumablesCount;
    status.resourcesCount = resourcesCount;
    status.isLoading = false;
    status.progressMessage = `Importación completa: ${allItems.length.toLocaleString()} objetos y ${allRecipes.length.toLocaleString()} recetas sincronizadas.`;
    status.progressPercent = 100;
    status.currentStep = "Completado";
    status.currentStepIndex = 3;
    await setSyncStatus(status);

    invalidateServerBootstrapCache();
    return await buildBootstrapData();
  } catch (err) {
    status.isLoading = false;
    status.progressMessage = `Error en importación: ${err instanceof Error ? err.message : String(err)}`;
    await setSyncStatus(status);
    throw err;
  }
}

export async function exportFullDatabaseJSON() {
  const bootstrap = await getBootstrapData();
  return {
    version: 2,
    exportedAt: Date.now(),
    itemsCount: bootstrap.items.length,
    recipesCount: Object.keys(bootstrap.recipes).length,
    pricesCount: Object.keys(bootstrap.prices).length,
    items: bootstrap.items,
    recipes: bootstrap.recipes,
    prices: bootstrap.prices,
    priceUpdatedAt: bootstrap.priceUpdatedAt,
    priceProfiles: bootstrap.priceProfiles,
    activePriceProfileId: bootstrap.activePriceProfileId,
  };
}

export async function importFullDatabaseJSON(data: any) {
  invalidateServerBootstrapCache();
  if (!data || typeof data !== "object") {
    throw new Error("Datos de importación inválidos");
  }

  if (Array.isArray(data.items) && data.items.length > 0) {
    const validItems = data.items.map((i: any) => normalizeSpanishItem(i)).filter((i: any) => i.id > 0);
    if (validItems.length > 0) {
      await upsertItems(validItems);
    }
  }

  if (data.recipes) {
    const recipesToUpsert: DofusRecipe[] = [];
    if (Array.isArray(data.recipes)) {
      for (const r of data.recipes) {
        const norm = normalizeRecipe(r);
        if (norm) recipesToUpsert.push(norm);
      }
    } else if (typeof data.recipes === "object") {
      for (const r of Object.values(data.recipes)) {
        const norm = normalizeRecipe(r as Record<string, unknown>);
        if (norm) recipesToUpsert.push(norm);
      }
    }
    if (recipesToUpsert.length > 0) {
      await upsertRecipes(recipesToUpsert);
    }
  }

  const pricesMap = data.prices && typeof data.prices === "object" && !Array.isArray(data.prices)
    ? data.prices
    : typeof data === "object" && !Array.isArray(data) && !data.version && !data.items
    ? data
    : null;

  if (pricesMap) {
    const activeProfileId = await getActivePriceProfileId();
    const cleanPrices: MarketPriceMap = {};
    for (const [key, val] of Object.entries(pricesMap)) {
      const numericId = Number(key);
      const numericPrice = Number(val);
      if (numericId > 0 && !Number.isNaN(numericPrice)) {
        cleanPrices[numericId] = Math.max(0, numericPrice);
      }
    }
    if (Object.keys(cleanPrices).length > 0) {
      await overwritePrices(cleanPrices, activeProfileId);
    }
  }

  return await getBootstrapData();
}

export async function ensureLegacyPriceMigration(
  defaultProfileId: number,
): Promise<void> {
  try {
    const legacyCountResult = await database.execute(
      "SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table' AND name='prices'",
    );
    if ((legacyCountResult.rows[0]?.count as number) === 0) return;

    const legacyRowsResult = await database.execute(
      "SELECT item_id, price, updated_at FROM prices",
    );
    if (legacyRowsResult.rows.length === 0) {
      await database.execute("DROP TABLE IF EXISTS prices");
      return;
    }

    const statements = legacyRowsResult.rows.map((row) => ({
      sql: `INSERT INTO profile_prices (profile_id, item_id, price, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(profile_id, item_id) DO UPDATE SET price = excluded.price, updated_at = excluded.updated_at`,
      args: [
        defaultProfileId,
        row.item_id as number,
        row.price as number,
        (row.updated_at as number) || Date.now(),
      ],
    }));
    if (statements.length > 0) await database.batch(statements, "write");
    await database.execute("DROP TABLE IF EXISTS prices");
  } catch {
    // Migration already completed or prices table already dropped
  }
}
