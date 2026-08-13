import { createClient } from "@libsql/client";
import { isOmittedItem } from "../data/dofusJobs.js";
import {
  DofusItem,
  DofusRecipe,
  MarketPriceMap,
  PriceProfile,
  PriceUpdatedAtMap,
  SyncSettings,
  SyncStatus,
} from "../types";

const DOFUS_API_BASE = "https://api.dofusdb.fr";

const DEFAULT_SYNC_SETTINGS: SyncSettings = {
  enabled: true,
  intervalDays: 30,
};

// Lista estricta de servidores permitidos[cite: 3]
const UNITY_SERVER_PROFILES: Array<{
  slug: string;
  name: string;
  isDefault?: boolean;
}> = [
  { slug: "draconiros", name: "Draconiros", isDefault: true },
  { slug: "mikhal", name: "Mikhal" },
  { slug: "tal-kasha", name: "Tal Kasha" },
  { slug: "rafal", name: "Rafal" },
];

export const database = createClient({
  url: process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || "file:local.db",
  authToken: process.env.TURSO_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN || undefined,
});

export async function initDB() {
  try {
    await database.executeMultiple(`
      CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY,
        level INTEGER NOT NULL DEFAULT 1,
        type_id INTEGER NOT NULL DEFAULT 0,
        super_category_id INTEGER NOT NULL DEFAULT 0,
        icon_id INTEGER NOT NULL DEFAULT 0,
        name_es TEXT NOT NULL DEFAULT '',
        payload_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS recipes (
        result_id INTEGER PRIMARY KEY,
        job_id INTEGER,
        payload_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS prices (
        item_id INTEGER PRIMARY KEY,
        price INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS price_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        is_default INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS profile_prices (
        profile_id INTEGER NOT NULL,
        item_id INTEGER NOT NULL,
        price INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (profile_id, item_id)
      );

      CREATE INDEX IF NOT EXISTS idx_items_type_id ON items(type_id);
      CREATE INDEX IF NOT EXISTS idx_items_name_es ON items(name_es);
      CREATE INDEX IF NOT EXISTS idx_profile_prices_profile_id ON profile_prices(profile_id);
      CREATE INDEX IF NOT EXISTS idx_profile_prices_item_id ON profile_prices(item_id);
    `);
    console.log("[Database] Turso / LibSQL schemas initialized.");
  } catch (e) {
    console.warn("[Database] Database initialization error (fallback mode):", e);
  }
}

let runningImportPromise: Promise<BootstrapData> | null = null;

type BootstrapData = {
  items: DofusItem[];
  recipes: Record<number, DofusRecipe>;
  prices: MarketPriceMap;
  priceUpdatedAt: PriceUpdatedAtMap;
  syncStatus: SyncStatus;
  syncSettings: SyncSettings;
  priceProfiles: PriceProfile[];
  activePriceProfileId: number;
};

function getDefaultSyncStatus(): SyncStatus {
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
  };
}

function parseJsonValue<T>(rawValue: string): T {
  return JSON.parse(rawValue) as T;
}

function getLocalizedText(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim().length > 0) return value;
  if (value && typeof value === "object") {
    const localized = value as Record<string, unknown>;
    const es = typeof localized.es === "string" ? localized.es.trim() : "";
    const fr = typeof localized.fr === "string" ? localized.fr.trim() : "";
    const en = typeof localized.en === "string" ? localized.en.trim() : "";
    if (es.length > 0) return es;
    if (fr.length > 0) return fr;
    if (en.length > 0) return en;
  }
  return fallback;
}

function normalizeSpanishItem(rawInput: Record<string, unknown>): DofusItem {
  if (!rawInput) {
    return {
      id: 0,
      level: 1,
      typeId: 0,
      iconId: 0,
      name: { es: "Objeto Desconocido", fr: "", en: "" },
      type: { id: 0, superCategoryId: 0, name: { es: "", fr: "", en: "" } },
    };
  }

  let rawItem = rawInput;
  if (Array.isArray(rawInput.data) && rawInput.data.length > 0) {
    rawItem = rawInput.data[0] as Record<string, unknown>;
  } else if (rawInput.item && typeof rawInput.item === "object") {
    rawItem = rawInput.item as Record<string, unknown>;
  }

  const extractedId = Number(
    rawItem.ankama_id ??
      rawItem.ankamaId ??
      rawItem.id ??
      rawItem.m_id ??
      rawItem._id ??
      0,
  );
  const rawName = rawItem.name ?? rawItem.title;
  const spanishName = getLocalizedText(rawName, `Objeto #${extractedId}`);
  const rawType = (rawItem.type ?? {}) as Record<string, unknown>;
  const typeId = Number(
    rawItem.typeId ?? rawItem.type_id ?? rawType.id ?? rawType.ankamaId ?? 0,
  );
  const typeName = getLocalizedText(
    rawType.name ?? rawItem.typeName ?? rawItem.type_name ?? "",
    "",
  );
  const superCategoryId = Number(
    rawType.superCategoryId ?? rawType.super_category_id ?? 0,
  );

  return {
    ...(rawItem as unknown as DofusItem),
    id: extractedId,
    level: Number(rawItem.level ?? 1),
    typeId,
    iconId: Number(rawItem.iconId ?? rawItem.icon_id ?? 0),
    name: {
      es: spanishName,
      fr: getLocalizedText(
        rawName && typeof rawName === "object"
          ? (rawName as Record<string, unknown>).fr
          : "",
        spanishName,
      ),
      en: getLocalizedText(
        rawName && typeof rawName === "object"
          ? (rawName as Record<string, unknown>).en
          : "",
        spanishName,
      ),
    },
    type: {
      id: typeId,
      superCategoryId,
      name: { es: typeName, fr: typeName, en: typeName },
    },
  };
}

function normalizeRecipe(
  rawRecipe: Record<string, unknown>,
): DofusRecipe | null {
  const resultId = Number(
    rawRecipe.resultId ?? rawRecipe.result_id ?? rawRecipe.id ?? 0,
  );
  if (!resultId) return null;
  const ingredientIds: number[] = [];
  const quantities: number[] = [];

  if (
    Array.isArray(rawRecipe.ingredientIds) &&
    Array.isArray(rawRecipe.quantities)
  ) {
    for (let index = 0; index < rawRecipe.ingredientIds.length; index += 1) {
      const ingredientId = Number(rawRecipe.ingredientIds[index]);
      if (!ingredientId) continue;
      ingredientIds.push(ingredientId);
      quantities.push(Number(rawRecipe.quantities[index]) || 1);
    }
  } else if (Array.isArray(rawRecipe.ingredients)) {
    for (const ingredient of rawRecipe.ingredients) {
      if (!ingredient || typeof ingredient !== "object") continue;
      const normalizedIngredient = ingredient as Record<string, unknown>;
      const ingredientId = Number(
        normalizedIngredient.id ??
          normalizedIngredient.item_id ??
          normalizedIngredient.itemId ??
          normalizedIngredient.ankama_id ??
          0,
      );
      if (!ingredientId) continue;
      ingredientIds.push(ingredientId);
      quantities.push(
        Number(
          normalizedIngredient.quantity ??
            normalizedIngredient.qty ??
            normalizedIngredient.amount ??
            1,
        ) || 1,
      );
    }
  }

  if (ingredientIds.length === 0) return null;
  const extractedJobId = Number(
    rawRecipe.jobId ??
      rawRecipe.job_id ??
      (rawRecipe.job as Record<string, unknown> | undefined)?.id ??
      0,
  );
  return {
    id: Number(rawRecipe.id) || resultId,
    resultId,
    ingredientIds,
    quantities,
    jobId: extractedJobId > 0 ? extractedJobId : undefined,
  };
}

async function setMetaValue(key: string, value: unknown): Promise<void> {
  await database.execute({
    sql: `INSERT INTO meta (key, value_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
    args: [key, JSON.stringify(value), Date.now()],
  });
}

async function getMetaValue<T>(key: string): Promise<T | null> {
  const result = await database.execute({
    sql: "SELECT value_json FROM meta WHERE key = ?",
    args: [key],
  });
  const row = result.rows[0];
  return row ? parseJsonValue<T>(row.value_json as string) : null;
}

async function getPriceProfiles(): Promise<PriceProfile[]> {
  const result = await database.execute(
    `SELECT id, name, slug, is_default FROM price_profiles ORDER BY id ASC`,
  );
  const bySlug = new Map(
    result.rows.map((row) => [
      row.slug as string,
      {
        id: row.id as number,
        name: row.name as string,
        slug: row.slug as string,
        isDefault: (row.is_default as number) === 1,
      } as PriceProfile,
    ]),
  );
  return UNITY_SERVER_PROFILES.map((profile) =>
    bySlug.get(profile.slug),
  ).filter((profile): profile is PriceProfile => Boolean(profile));
}

let serverBootstrapCache: { data: BootstrapData; expiresAt: number } | null = null;
const SERVER_CACHE_TTL_MS = 60 * 1000; // 60s warm serverless context cache

export function invalidateServerBootstrapCache(): void {
  serverBootstrapCache = null;
}

async function ensureDefaultPriceProfile(): Promise<PriceProfile> {
  const existingResult = await database.execute(
    `SELECT id, name, slug, is_default FROM price_profiles ORDER BY id ASC`,
  );
  if (existingResult.rows.length >= UNITY_SERVER_PROFILES.length) {
    const defaultProfile =
      existingResult.rows.find((r) => r.slug === "private") ||
      existingResult.rows[0];
    return {
      id: defaultProfile.id as number,
      name: defaultProfile.name as string,
      slug: defaultProfile.slug as string,
      isDefault: (defaultProfile.is_default as number) === 1,
    };
  }

  const validSlugs = UNITY_SERVER_PROFILES.map((p) => p.slug);
  await database.execute({
    sql: `DELETE FROM price_profiles WHERE slug NOT IN (${validSlugs.map(() => "?").join(", ")})`,
    args: validSlugs,
  });

  const now = Date.now();
  const statements = [];
  for (const profile of UNITY_SERVER_PROFILES) {
    statements.push({
      sql: `INSERT OR IGNORE INTO price_profiles (name, slug, is_default, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
      args: [profile.name, profile.slug, profile.isDefault ? 1 : 0, now, now],
    });
  }

  if (statements.length > 0) await database.batch(statements, "write");
  const defaultSlug = UNITY_SERVER_PROFILES.find((p) => p.isDefault)?.slug || "draconiros";
  await database.execute({
    sql: "UPDATE price_profiles SET is_default = CASE WHEN slug = ? THEN 1 ELSE 0 END",
    args: [defaultSlug],
  });

  const insertedResult = await database.execute({
    sql: "SELECT id, name, slug, is_default FROM price_profiles WHERE slug = ? LIMIT 1",
    args: [defaultSlug],
  });
  const inserted = insertedResult.rows[0];
  return {
    id: inserted.id as number,
    name: inserted.name as string,
    slug: inserted.slug as string,
    isDefault: (inserted.is_default as number) === 1,
  };
}

async function ensureLegacyPriceMigration(
  defaultProfileId: number,
): Promise<void> {
  const legacyCountResult = await database.execute(
    "SELECT COUNT(*) AS count FROM prices",
  );
  const profilePriceCountResult = await database.execute(
    "SELECT COUNT(*) AS count FROM profile_prices",
  );
  if (
    (legacyCountResult.rows[0].count as number) === 0 ||
    (profilePriceCountResult.rows[0].count as number) > 0
  )
    return;

  const legacyRowsResult = await database.execute(
    "SELECT item_id, price, updated_at FROM prices",
  );
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
}

async function getSyncStatus(): Promise<SyncStatus> {
  const status = await getMetaValue<SyncStatus>("sync_status");
  return status ?? getDefaultSyncStatus();
}

async function setSyncStatus(status: SyncStatus): Promise<void> {
  await setMetaValue("sync_status", status);
}

async function getSyncSettings(): Promise<SyncSettings> {
  const stored = await getMetaValue<SyncSettings>("sync_settings");
  return stored ?? DEFAULT_SYNC_SETTINGS;
}

async function setSyncSettings(settings: SyncSettings): Promise<SyncSettings> {
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

async function getActivePriceProfileId(): Promise<number> {
  const defaultProfile = await ensureDefaultPriceProfile();
  await ensureLegacyPriceMigration(defaultProfile.id);
  const profiles = await getPriceProfiles();
  const visibleProfileIds = new Set(profiles.map((p) => p.id));
  const storedProfileId = await getMetaValue<number>("active_price_profile_id");
  if (storedProfileId && visibleProfileIds.has(storedProfileId))
    return storedProfileId;
  await setMetaValue("active_price_profile_id", defaultProfile.id);
  return defaultProfile.id;
}

async function setActivePriceProfileId(profileId: number): Promise<number> {
  const profiles = await getPriceProfiles();
  if (!profiles.some((p) => p.id === profileId))
    throw new Error("Perfil de precios no encontrado.");
  await setMetaValue("active_price_profile_id", profileId);
  return profileId;
}

async function getPricesMap(profileId: number): Promise<MarketPriceMap> {
  const result = await database.execute({
    sql: "SELECT item_id, price FROM profile_prices WHERE profile_id = ?",
    args: [profileId],
  });
  const prices: MarketPriceMap = {};
  for (const row of result.rows)
    prices[row.item_id as number] = row.price as number;
  return prices;
}

async function getPriceUpdatedAtMap(
  profileId: number,
): Promise<PriceUpdatedAtMap> {
  const result = await database.execute({
    sql: "SELECT item_id, updated_at FROM profile_prices WHERE profile_id = ?",
    args: [profileId],
  });
  const updatedAtMap: PriceUpdatedAtMap = {};
  for (const row of result.rows)
    updatedAtMap[row.item_id as number] = row.updated_at as number;
  return updatedAtMap;
}

async function upsertItems(items: DofusItem[]): Promise<void> {
  const now = Date.now();
  const statements = items.map((item) => ({
    sql: `INSERT INTO items (id, level, type_id, super_category_id, icon_id, name_es, payload_json, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET level = excluded.level, type_id = excluded.type_id, super_category_id = excluded.super_category_id, icon_id = excluded.icon_id, name_es = excluded.name_es, payload_json = excluded.payload_json, updated_at = excluded.updated_at`,
    args: [
      item.id,
      item.level || 1,
      item.typeId || item.type?.id || 0,
      item.type?.superCategoryId || 0,
      item.iconId || 0,
      item.name?.es || "",
      JSON.stringify(item),
      now,
    ],
  }));
  for (let i = 0; i < statements.length; i += 100)
    await database.batch(statements.slice(i, i + 100), "write");
}

async function replaceAllItems(items: DofusItem[]): Promise<void> {
  await database.execute("DELETE FROM items");
  await upsertItems(items);
}

async function upsertRecipes(recipes: DofusRecipe[]): Promise<void> {
  const now = Date.now();
  const statements = recipes.map((recipe) => ({
    sql: `INSERT INTO recipes (result_id, job_id, payload_json, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(result_id) DO UPDATE SET job_id = excluded.job_id, payload_json = excluded.payload_json, updated_at = excluded.updated_at`,
    args: [recipe.resultId, recipe.jobId ?? null, JSON.stringify(recipe), now],
  }));
  for (let i = 0; i < statements.length; i += 100)
    await database.batch(statements.slice(i, i + 100), "write");
}

async function replaceAllRecipes(recipes: DofusRecipe[]): Promise<void> {
  await database.execute("DELETE FROM recipes");
  await upsertRecipes(recipes);
}

async function upsertPrice(
  profileId: number,
  itemId: number,
  price: number,
): Promise<void> {
  await database.execute({
    sql: `INSERT INTO profile_prices (profile_id, item_id, price, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(profile_id, item_id) DO UPDATE SET price = excluded.price, updated_at = excluded.updated_at`,
    args: [profileId, itemId, Math.max(0, Math.trunc(price)), Date.now()],
  });
}

async function replaceAllPrices(
  profileId: number,
  prices: MarketPriceMap,
): Promise<void> {
  await database.execute({
    sql: "DELETE FROM profile_prices WHERE profile_id = ?",
    args: [profileId],
  });
  const now = Date.now();
  const statements = Object.entries(prices).map(([itemId, price]) => ({
    sql: `INSERT INTO profile_prices (profile_id, item_id, price, updated_at) VALUES (?, ?, ?, ?)`,
    args: [profileId, Number(itemId), Math.max(0, Math.trunc(price)), now],
  }));
  for (let i = 0; i < statements.length; i += 100)
    await database.batch(statements.slice(i, i + 100), "write");
}

async function clearAllPrices(profileId: number): Promise<void> {
  await database.execute({
    sql: "DELETE FROM profile_prices WHERE profile_id = ?",
    args: [profileId],
  });
}

async function getAllItems(): Promise<DofusItem[]> {
  const result = await database.execute(
    "SELECT payload_json FROM items ORDER BY name_es COLLATE NOCASE ASC, id ASC",
  );
  return result.rows.map((row) =>
    parseJsonValue<DofusItem>(row.payload_json as string),
  );
}

async function getAllRecipes(): Promise<Record<number, DofusRecipe>> {
  const result = await database.execute(
    "SELECT payload_json FROM recipes ORDER BY result_id ASC",
  );
  const recipes: Record<number, DofusRecipe> = {};
  for (const row of result.rows) {
    const recipe = parseJsonValue<DofusRecipe>(row.payload_json as string);
    recipes[recipe.resultId] = recipe;
  }
  return recipes;
}

function fetchJson<T>(url: string): Promise<T> {
  return fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "DofusDB-HD local importer/1.0",
    },
  }).then(async (r) => {
    if (!r.ok) throw new Error(`Request failed (${r.status})`);
    return r.json() as Promise<T>;
  });
}

async function maybeStartAutomaticSync(): Promise<void> {
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

async function buildBootstrapData(): Promise<BootstrapData> {
  if (serverBootstrapCache && Date.now() < serverBootstrapCache.expiresAt) {
    return serverBootstrapCache.data;
  }

  const activeProfileId = await getActivePriceProfileId();

  // Execute all bootstrap queries in 1 single HTTP round-trip to Turso
  const batchResults = await database.batch([
    { sql: "SELECT payload_json FROM items ORDER BY name_es COLLATE NOCASE ASC, id ASC", args: [] },
    { sql: "SELECT payload_json FROM recipes ORDER BY result_id ASC", args: [] },
    { sql: "SELECT item_id, price, updated_at FROM profile_prices WHERE profile_id = ?", args: [activeProfileId] },
    { sql: "SELECT value_json FROM meta WHERE key = 'sync_status'", args: [] },
    { sql: "SELECT value_json FROM meta WHERE key = 'sync_settings'", args: [] },
    { sql: "SELECT id, name, slug, is_default FROM price_profiles ORDER BY id ASC", args: [] },
  ], "read");

  const items: DofusItem[] = batchResults[0].rows.map((row) =>
    parseJsonValue<DofusItem>(row.payload_json as string),
  );

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
        isDefault: (row.is_default as number) === 1,
      } as PriceProfile,
    ]),
  );
  const priceProfiles = UNITY_SERVER_PROFILES.map((profile) =>
    bySlug.get(profile.slug),
  ).filter((profile): profile is PriceProfile => Boolean(profile));

  const resultData: BootstrapData = {
    items,
    recipes,
    prices,
    priceUpdatedAt,
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

async function importAllDofusDataInternal(): Promise<BootstrapData> {
  const previousStatus = await getSyncStatus();
  const status: SyncStatus = {
    ...getDefaultSyncStatus(),
    lastSyncTimestamp: previousStatus.lastSyncTimestamp,
    isLoading: true,
    progressMessage: "Iniciando importación desde DofusDB...",
  };
  await setSyncStatus(status);

  const itemsMap = new Map<number, DofusItem>();
  const recipesMap = new Map<number, DofusRecipe>();

  let itemTotal = 100;
  let itemSkip = 0;
  const itemLimit = 100;

  while (itemSkip < itemTotal) {
    const params = new URLSearchParams({
      $limit: String(itemLimit),
      $skip: String(itemSkip),
      lang: "es",
    });
    const body = await fetchJson<{
      total?: number;
      data?: Record<string, unknown>[];
    }>(`${DOFUS_API_BASE}/items?${params.toString()}`);

    const items = body.data ?? [];
    if (typeof body.total === "number") {
      itemTotal = body.total;
    }
    if (items.length === 0) {
      break;
    }

    for (const rawItem of items) {
      const normalizedItem = normalizeSpanishItem(rawItem);
      if (!normalizedItem.id) continue;

      if (isOmittedItem(normalizedItem)) {
        status.cosmeticsOmittedCount += 1;
        continue;
      }

      itemsMap.set(normalizedItem.id, normalizedItem);

      const rawRecipe =
        (rawItem.recipe as Record<string, unknown> | undefined) ??
        (rawItem.craft as Record<string, unknown> | undefined) ??
        (Array.isArray(rawItem.recipes)
          ? (rawItem.recipes[0] as Record<string, unknown> | undefined)
          : (rawItem.recipes as Record<string, unknown> | undefined));

      if (rawRecipe) {
        const normalizedRecipe = normalizeRecipe(rawRecipe);
        if (normalizedRecipe) {
          recipesMap.set(normalizedRecipe.resultId, normalizedRecipe);
        }
      }
    }

    itemSkip += items.length;
    status.totalImported = itemsMap.size;
    status.progressMessage = `Descargando ítems: ${itemSkip} de ${itemTotal}...`;
    await setSyncStatus(status);
  }

  let recipeTotal = 50;
  let recipeSkip = 0;
  const recipeLimit = 50;

  while (recipeSkip < recipeTotal) {
    const params = new URLSearchParams({
      $limit: String(recipeLimit),
      $skip: String(recipeSkip),
    });
    const body = await fetchJson<{
      total?: number;
      data?: Record<string, unknown>[];
    }>(`${DOFUS_API_BASE}/recipes?${params.toString()}`);

    const recipes = body.data ?? [];
    if (typeof body.total === "number") {
      recipeTotal = body.total;
    }
    if (recipes.length === 0) {
      break;
    }

    for (const rawRecipe of recipes) {
      const normalizedRecipe = normalizeRecipe(rawRecipe);
      if (normalizedRecipe) {
        recipesMap.set(normalizedRecipe.resultId, normalizedRecipe);
      }
    }

    recipeSkip += recipes.length;
    status.recipesCount = recipesMap.size;
    status.progressMessage = `Descargando recetas: ${recipeSkip} de ${recipeTotal}...`;
    await setSyncStatus(status);
  }

  status.progressMessage = "Guardando ítems y recetas en Turso...";
  await setSyncStatus(status);

  const importedItems = Array.from(itemsMap.values());
  const importedRecipes = Array.from(recipesMap.values());

  status.totalImported = importedItems.length;
  status.recipesCount = importedRecipes.length;

  for (const item of importedItems) {
    const superCategoryId = item.type?.superCategoryId ?? 0;
    const typeId = item.typeId || item.type?.id || 0;

    if (
      superCategoryId === 1 ||
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 16, 17, 81].includes(typeId)
    ) {
      status.equipablesCount += 1;
    } else if ([33, 37, 38, 42, 43, 68, 69, 104, 219].includes(typeId)) {
      status.consumablesCount += 1;
    } else {
      status.resourcesCount += 1;
    }
  }

  await replaceAllItems(importedItems);
  await replaceAllRecipes(importedRecipes);

  status.lastSyncTimestamp = Date.now();
  status.isLoading = false;
  status.progressMessage = `Importación completada: ${status.totalImported} ítems y ${status.recipesCount || 0} recetas.`;
  await setSyncStatus(status);

  return buildBootstrapData();
}

export function getDatabaseFilePath() {
  return process.env.DATABASE_URL || "turso-cloud-db";
}
export async function getBootstrapData() {
  await ensureDefaultPriceProfile();
  await maybeStartAutomaticSync();
  return {
    ...(await buildBootstrapData()),
    databasePath: getDatabaseFilePath(),
  };
}
export async function importAllDofusData() {
  if (!runningImportPromise)
    runningImportPromise = importAllDofusDataInternal().finally(() => {
      runningImportPromise = null;
    });
  return runningImportPromise;
}

export async function getStoredItemById(itemId: number) {
  const result = await database.execute({
    sql: "SELECT payload_json FROM items WHERE id = ?",
    args: [itemId],
  });
  return result.rows[0]
    ? parseJsonValue<DofusItem>(result.rows[0].payload_json as string)
    : null;
}

export async function getOrFetchItemById(itemId: number) {
  const stored = await getStoredItemById(itemId);
  if (stored && stored.name?.es && !stored.name.es.startsWith("Objeto #"))
    return stored;

  try {
    const queryRes = await fetchJson<{ data?: Record<string, unknown>[] }>(
      `${DOFUS_API_BASE}/items?id=${itemId}&lang=es`,
    );
    if (queryRes.data && queryRes.data.length > 0) {
      const normalized = normalizeSpanishItem(queryRes.data[0]);
      if (
        normalized.id &&
        normalized.name?.es &&
        !normalized.name.es.startsWith("Objeto #")
      ) {
        await upsertItems([normalized]);
        return normalized;
      }
    }

    const remote = await fetchJson<Record<string, unknown>>(
      `${DOFUS_API_BASE}/items/${itemId}?lang=es`,
    );
    const normalized = normalizeSpanishItem(remote);
    if (
      normalized.id &&
      normalized.name?.es &&
      !normalized.name.es.startsWith("Objeto #")
    ) {
      await upsertItems([normalized]);
      return normalized;
    }
  } catch (e) {
    console.warn(`Error al consultar item remoto ${itemId}:`, e);
  }

  return stored;
}

export async function getStoredRecipeByResultId(resultId: number) {
  const result = await database.execute({
    sql: "SELECT payload_json FROM recipes WHERE result_id = ?",
    args: [resultId],
  });
  return result.rows[0]
    ? parseJsonValue<DofusRecipe>(result.rows[0].payload_json as string)
    : null;
}

export async function getOrFetchRecipeByResultId(resultId: number) {
  const stored = await getStoredRecipeByResultId(resultId);
  if (stored) return stored;
  const res = await fetchJson<{ data?: Record<string, unknown>[] }>(
    `${DOFUS_API_BASE}/recipes?resultId=${resultId}`,
  );
  const remote = res.data?.[0];
  if (!remote) return null;
  const norm = normalizeRecipe(remote);
  if (norm) await upsertRecipes([norm]);
  return norm;
}

export async function resolveMissingNames(itemIds: number[]) {
  if (!itemIds || itemIds.length === 0) return [];
  const uniqueIds = Array.from(new Set(itemIds)).filter((id) => Number(id) > 0);
  const resolved: DofusItem[] = [];
  const chunkSize = 15;

  for (let i = 0; i < uniqueIds.length; i += chunkSize) {
    const chunk = uniqueIds.slice(i, i + chunkSize);
    const results = await Promise.allSettled(
      chunk.map((id) => getOrFetchItemById(id)),
    );
    for (const res of results) {
      if (res.status === "fulfilled" && res.value && res.value.name?.es && !res.value.name.es.startsWith("Objeto #")) {
        resolved.push(res.value);
      }
    }
  }

  if (resolved.length > 0) {
    invalidateServerBootstrapCache();
  }

  return resolved;
}

export async function setItemPrice(
  itemId: number,
  price: number,
  profileId?: number,
) {
  invalidateServerBootstrapCache();
  const pid = profileId || (await getActivePriceProfileId());
  await upsertPrice(pid, itemId, price);
  return {
    prices: await getPricesMap(pid),
    priceUpdatedAt: await getPriceUpdatedAtMap(pid),
    activePriceProfileId: pid,
  };
}

export async function overwritePrices(
  prices: MarketPriceMap,
  profileId?: number,
) {
  invalidateServerBootstrapCache();
  const pid = profileId || (await getActivePriceProfileId());
  await replaceAllPrices(pid, prices);
  return {
    prices: await getPricesMap(pid),
    priceUpdatedAt: await getPriceUpdatedAtMap(pid),
    activePriceProfileId: pid,
  };
}

export async function deleteAllStoredPrices(profileId?: number) {
  invalidateServerBootstrapCache();
  const pid = profileId || (await getActivePriceProfileId());
  await clearAllPrices(pid);
  return {
    prices: await getPricesMap(pid),
    priceUpdatedAt: await getPriceUpdatedAtMap(pid),
    activePriceProfileId: pid,
  };
}

export async function changeActivePriceProfile(profileId: number) {
  invalidateServerBootstrapCache();
  const pid = await setActivePriceProfileId(profileId);
  return {
    activePriceProfileId: pid,
    prices: await getPricesMap(pid),
    priceUpdatedAt: await getPriceUpdatedAtMap(pid),
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

export async function searchAndStoreItems(searchTerm: string) {
  const term = searchTerm.trim();
  if (!term || term.length < 2) return await getAllItems();
  const params = new URLSearchParams({ $limit: "40", lang: "es" });
  if (!Number.isNaN(Number(term))) params.append("id", term);
  else params.append("name[$like]", term);
  const res = await fetchJson<{ data?: Record<string, unknown>[] }>(
    `${DOFUS_API_BASE}/items?${params.toString()}`,
  );
  const items = (res.data ?? [])
    .map(normalizeSpanishItem)
    .filter((i) => i.id && !isOmittedItem(i));
  if (items.length > 0) await upsertItems(items);
  return await getAllItems();
}

export async function fetchAndStoreCategoryItems(typeIds: number[]) {
  if (typeIds.length === 0) return await getAllItems();
  const params = new URLSearchParams({ $limit: "100", lang: "es" });
  for (const tid of typeIds) params.append("typeId[$in]", String(tid));
  const res = await fetchJson<{ data?: Record<string, unknown>[] }>(
    `${DOFUS_API_BASE}/items?${params.toString()}`,
  );
  const items = (res.data ?? [])
    .map(normalizeSpanishItem)
    .filter((i) => i.id && !isOmittedItem(i));
  if (items.length > 0) await upsertItems(items);
  return await getAllItems();
}
