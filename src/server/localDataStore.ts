import { createClient } from "@libsql/client";
import "dotenv/config";
import { isOmittedItem } from "../data/dofusJobs";
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
const UNITY_SERVER_PROFILES: Array<{
  slug: string;
  name: string;
  isDefault?: boolean;
}> = [
  { slug: "private", name: "Privado", isDefault: true },
  { slug: "draconiros", name: "Draconiros" },
  { slug: "hellmina", name: "Hellmina" },
  { slug: "rafal", name: "Rafal" },
  { slug: "mikhal", name: "Mikhal" },
  { slug: "tal-kasha", name: "Tal Kasha" },
];

export const database = createClient({
  url: process.env.DATABASE_URL as string,
  authToken: process.env.DATABASE_AUTH_TOKEN as string,
});

export async function initDB() {
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
  if (typeof value === "string") {
    return value;
  }

  if (value && typeof value === "object") {
    const localized = value as Record<string, unknown>;
    return (
      (typeof localized.es === "string" && localized.es) ||
      (typeof localized.fr === "string" && localized.fr) ||
      (typeof localized.en === "string" && localized.en) ||
      fallback
    );
  }

  return fallback;
}

function normalizeSpanishItem(rawItem: Record<string, unknown>): DofusItem {
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
      name: {
        es: typeName,
        fr: typeName,
        en: typeName,
      },
    },
  };
}

function normalizeRecipe(
  rawRecipe: Record<string, unknown>,
): DofusRecipe | null {
  const resultId = Number(
    rawRecipe.resultId ?? rawRecipe.result_id ?? rawRecipe.id ?? 0,
  );
  if (!resultId) {
    return null;
  }

  const ingredientIds: number[] = [];
  const quantities: number[] = [];

  if (
    Array.isArray(rawRecipe.ingredientIds) &&
    Array.isArray(rawRecipe.quantities)
  ) {
    for (let index = 0; index < rawRecipe.ingredientIds.length; index += 1) {
      const ingredientId = Number(rawRecipe.ingredientIds[index]);
      if (!ingredientId) {
        continue;
      }

      ingredientIds.push(ingredientId);
      quantities.push(Number(rawRecipe.quantities[index]) || 1);
    }
  } else if (Array.isArray(rawRecipe.ingredients)) {
    for (const ingredient of rawRecipe.ingredients) {
      if (!ingredient || typeof ingredient !== "object") {
        continue;
      }

      const normalizedIngredient = ingredient as Record<string, unknown>;
      const ingredientId = Number(
        normalizedIngredient.id ??
          normalizedIngredient.item_id ??
          normalizedIngredient.itemId ??
          normalizedIngredient.ankama_id ??
          0,
      );

      if (!ingredientId) {
        continue;
      }

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

  if (ingredientIds.length === 0) {
    return null;
  }

  return {
    id: Number(rawRecipe.id) || resultId,
    resultId,
    ingredientIds,
    quantities,
    jobId: Number(rawRecipe.jobId ?? 0) || undefined,
  };
}

async function setMetaValue(key: string, value: unknown): Promise<void> {
  await database.execute({
    sql: `
      INSERT INTO meta (key, value_json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value_json = excluded.value_json,
        updated_at = excluded.updated_at
    `,
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
  const result = await database.execute(`
    SELECT id, name, slug, is_default
    FROM price_profiles
    ORDER BY id ASC
  `);

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

async function ensureDefaultPriceProfile(): Promise<PriceProfile> {
  const legacyGeneralResult = await database.execute(
    "SELECT id FROM price_profiles WHERE slug = 'general' LIMIT 1",
  );
  const legacyGeneral = legacyGeneralResult.rows[0];

  if (legacyGeneral) {
    await database.execute({
      sql: `
        UPDATE price_profiles
        SET name = ?, slug = ?, is_default = 1, updated_at = ?
        WHERE id = ?
      `,
      args: ["Privado", "private", Date.now(), legacyGeneral.id as number],
    });
  }

  const now = Date.now();

  // Turso usa batching en lugar de transacciones interactivas simples
  const statements = [];

  for (const profile of UNITY_SERVER_PROFILES) {
    const existingResult = await database.execute({
      sql: "SELECT id FROM price_profiles WHERE slug = ? LIMIT 1",
      args: [profile.slug],
    });

    if (!existingResult.rows.length) {
      statements.push({
        sql: `INSERT INTO price_profiles (name, slug, is_default, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
        args: [profile.name, profile.slug, profile.isDefault ? 1 : 0, now, now],
      });
    }
  }

  if (statements.length > 0) {
    await database.batch(statements);
  }

  await database.execute(
    "UPDATE price_profiles SET is_default = CASE WHEN slug = 'private' THEN 1 ELSE 0 END",
  );

  const insertedResult = await database.execute(`
    SELECT id, name, slug, is_default
    FROM price_profiles
    WHERE slug = 'private'
    LIMIT 1
  `);

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

  const legacyCount = legacyCountResult.rows[0].count as number;
  const profilePriceCount = profilePriceCountResult.rows[0].count as number;

  if (legacyCount === 0 || profilePriceCount > 0) {
    return;
  }

  const legacyRowsResult = await database.execute(
    "SELECT item_id, price, updated_at FROM prices",
  );
  const statements = legacyRowsResult.rows.map((row) => ({
    sql: `
      INSERT INTO profile_prices (profile_id, item_id, price, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(profile_id, item_id) DO UPDATE SET
        price = excluded.price,
        updated_at = excluded.updated_at
    `,
    args: [
      defaultProfileId,
      row.item_id as number,
      row.price as number,
      (row.updated_at as number) || Date.now(),
    ],
  }));

  if (statements.length > 0) {
    await database.batch(statements, "write");
  }
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
  if (!stored) {
    return DEFAULT_SYNC_SETTINGS;
  }

  return {
    enabled: stored.enabled !== false,
    intervalDays: Math.min(30, Math.max(1, Number(stored.intervalDays) || 30)),
  };
}

async function setSyncSettings(settings: SyncSettings): Promise<SyncSettings> {
  const normalizedSettings: SyncSettings = {
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
  let existingProfile = null;
  if (storedProfileId) {
    const result = await database.execute({
      sql: "SELECT id FROM price_profiles WHERE id = ? LIMIT 1",
      args: [storedProfileId],
    });
    existingProfile = result.rows[0];
  }

  if (existingProfile && visibleProfileIds.has(storedProfileId as number)) {
    return storedProfileId as number;
  }

  await setMetaValue("active_price_profile_id", defaultProfile.id);
  return defaultProfile.id;
}

async function setActivePriceProfileId(profileId: number): Promise<number> {
  const profiles = await getPriceProfiles();
  const visibleProfileIds = new Set(profiles.map((p) => p.id));

  if (!visibleProfileIds.has(profileId)) {
    throw new Error("Perfil de precios no encontrado.");
  }

  await setMetaValue("active_price_profile_id", profileId);
  return profileId;
}

async function getPricesMap(profileId: number): Promise<MarketPriceMap> {
  const result = await database.execute({
    sql: `
      SELECT item_id, price
      FROM profile_prices
      WHERE profile_id = ?
      ORDER BY item_id ASC
    `,
    args: [profileId],
  });

  const prices: MarketPriceMap = {};
  for (const row of result.rows) {
    prices[row.item_id as number] = row.price as number;
  }

  return prices;
}

async function getPriceUpdatedAtMap(
  profileId: number,
): Promise<PriceUpdatedAtMap> {
  const result = await database.execute({
    sql: `
      SELECT item_id, updated_at
      FROM profile_prices
      WHERE profile_id = ?
      ORDER BY item_id ASC
    `,
    args: [profileId],
  });

  const updatedAtMap: PriceUpdatedAtMap = {};
  for (const row of result.rows) {
    updatedAtMap[row.item_id as number] = row.updated_at as number;
  }

  return updatedAtMap;
}

async function upsertItems(items: DofusItem[]): Promise<void> {
  const now = Date.now();
  const statements = items.map((item) => ({
    sql: `
      INSERT INTO items (id, level, type_id, super_category_id, icon_id, name_es, payload_json, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        level = excluded.level,
        type_id = excluded.type_id,
        super_category_id = excluded.super_category_id,
        icon_id = excluded.icon_id,
        name_es = excluded.name_es,
        payload_json = excluded.payload_json,
        updated_at = excluded.updated_at
    `,
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

  if (statements.length > 0) {
    // Procesar en chunks más pequeños para evitar límites del payload
    const chunkSize = 100;
    for (let i = 0; i < statements.length; i += chunkSize) {
      await database.batch(statements.slice(i, i + chunkSize), "write");
    }
  }
}

async function replaceAllItems(items: DofusItem[]): Promise<void> {
  await database.execute("DELETE FROM items");
  await upsertItems(items);
}

async function upsertRecipes(recipes: DofusRecipe[]): Promise<void> {
  const now = Date.now();
  const statements = recipes.map((recipe) => ({
    sql: `
      INSERT INTO recipes (result_id, job_id, payload_json, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(result_id) DO UPDATE SET
        job_id = excluded.job_id,
        payload_json = excluded.payload_json,
        updated_at = excluded.updated_at
    `,
    args: [recipe.resultId, recipe.jobId ?? null, JSON.stringify(recipe), now],
  }));

  if (statements.length > 0) {
    const chunkSize = 100;
    for (let i = 0; i < statements.length; i += chunkSize) {
      await database.batch(statements.slice(i, i + chunkSize), "write");
    }
  }
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
    sql: `
      INSERT INTO profile_prices (profile_id, item_id, price, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(profile_id, item_id) DO UPDATE SET
        price = excluded.price,
        updated_at = excluded.updated_at
    `,
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
    sql: `
        INSERT INTO profile_prices (profile_id, item_id, price, updated_at)
        VALUES (?, ?, ?, ?)
      `,
    args: [profileId, Number(itemId), Math.max(0, Math.trunc(price)), now],
  }));

  if (statements.length > 0) {
    const chunkSize = 100;
    for (let i = 0; i < statements.length; i += chunkSize) {
      await database.batch(statements.slice(i, i + chunkSize), "write");
    }
  }
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
  }).then(async (response) => {
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Request failed (${response.status}): ${errorText}`);
    }

    return response.json() as Promise<T>;
  });
}

function shouldRunAutomaticSync(
  syncStatus: SyncStatus,
  syncSettings: SyncSettings,
): boolean {
  if (!syncSettings.enabled) {
    return false;
  }

  if (!syncStatus.lastSyncTimestamp) {
    return true;
  }

  const intervalMs = syncSettings.intervalDays * 24 * 60 * 60 * 1000;
  return Date.now() - syncStatus.lastSyncTimestamp >= intervalMs;
}

async function maybeStartAutomaticSync(): Promise<void> {
  if (runningImportPromise) {
    return;
  }

  const syncStatus = await getSyncStatus();
  const syncSettings = await getSyncSettings();
  if (!shouldRunAutomaticSync(syncStatus, syncSettings)) {
    return;
  }

  void importAllDofusData().catch((error) => {
    console.error("[Local DB Auto Sync Error]", error);
  });
}

async function buildBootstrapData(): Promise<BootstrapData> {
  const activePriceProfileId = await getActivePriceProfileId();
  return {
    items: await getAllItems(),
    recipes: await getAllRecipes(),
    prices: await getPricesMap(activePriceProfileId),
    priceUpdatedAt: await getPriceUpdatedAtMap(activePriceProfileId),
    syncStatus: await getSyncStatus(),
    syncSettings: await getSyncSettings(),
    priceProfiles: await getPriceProfiles(),
    activePriceProfileId,
  };
}

async function importAllDofusDataInternal(): Promise<BootstrapData> {
  const previousStatus = await getSyncStatus();
  const status: SyncStatus = {
    ...getDefaultSyncStatus(),
    lastSyncTimestamp: previousStatus.lastSyncTimestamp,
    isLoading: true,
    progressMessage: "Importando datos desde DofusDB...",
  };
  await setSyncStatus(status);

  const importedItemsMap = new Map<number, DofusItem>();
  const importedRecipesMap = new Map<number, DofusRecipe>();

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
      if (!normalizedItem.id) {
        continue;
      }

      if (isOmittedItem(normalizedItem)) {
        status.cosmeticsOmittedCount += 1;
        continue;
      }

      importedItemsMap.set(normalizedItem.id, normalizedItem);

      const rawRecipe =
        (rawItem.recipe as Record<string, unknown> | undefined) ??
        (rawItem.craft as Record<string, unknown> | undefined) ??
        (Array.isArray(rawItem.recipes)
          ? (rawItem.recipes[0] as Record<string, unknown> | undefined)
          : (rawItem.recipes as Record<string, unknown> | undefined));

      if (!rawRecipe) {
        continue;
      }

      const normalizedRecipe = normalizeRecipe(rawRecipe);
      if (normalizedRecipe) {
        importedRecipesMap.set(normalizedRecipe.resultId, normalizedRecipe);
      }
    }

    itemSkip += items.length;
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
        importedRecipesMap.set(normalizedRecipe.resultId, normalizedRecipe);
      }
    }

    recipeSkip += recipes.length;
  }

  const importedItems = Array.from(importedItemsMap.values());
  const importedRecipes = Array.from(importedRecipesMap.values());

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
  status.progressMessage = `Importacion completada: ${status.totalImported} items y ${status.recipesCount || 0} recetas.`;
  await setSyncStatus(status);

  return buildBootstrapData();
}

export function getDatabaseFilePath(): string {
  // Con Turso ya no hay archivo local, puedes devolver la URL o un string indicativo
  return process.env.DATABASE_URL || "turso-cloud-db";
}

export async function getBootstrapData(): Promise<
  BootstrapData & { databasePath: string }
> {
  await ensureDefaultPriceProfile();
  await maybeStartAutomaticSync();

  const bootstrapData = await buildBootstrapData();
  return {
    ...bootstrapData,
    databasePath: getDatabaseFilePath(),
  };
}

export async function importAllDofusData(): Promise<BootstrapData> {
  if (!runningImportPromise) {
    runningImportPromise = importAllDofusDataInternal().finally(() => {
      runningImportPromise = null;
    });
  }

  return runningImportPromise;
}

export async function getStoredItemById(
  itemId: number,
): Promise<DofusItem | null> {
  const result = await database.execute({
    sql: "SELECT payload_json FROM items WHERE id = ?",
    args: [itemId],
  });
  const row = result.rows[0];
  return row ? parseJsonValue<DofusItem>(row.payload_json as string) : null;
}

export async function getOrFetchItemById(
  itemId: number,
): Promise<DofusItem | null> {
  const storedItem = await getStoredItemById(itemId);
  if (
    storedItem &&
    storedItem.name?.es &&
    !storedItem.name.es.startsWith("Objeto #")
  ) {
    return storedItem;
  }

  const remoteItem = await fetchJson<Record<string, unknown>>(
    `${DOFUS_API_BASE}/items/${itemId}?lang=es`,
  );
  const normalizedItem = normalizeSpanishItem(remoteItem);
  await upsertItems([normalizedItem]);
  return normalizedItem;
}

export async function getStoredRecipeByResultId(
  resultId: number,
): Promise<DofusRecipe | null> {
  const result = await database.execute({
    sql: "SELECT payload_json FROM recipes WHERE result_id = ?",
    args: [resultId],
  });
  const row = result.rows[0];
  return row ? parseJsonValue<DofusRecipe>(row.payload_json as string) : null;
}

export async function getOrFetchRecipeByResultId(
  resultId: number,
): Promise<DofusRecipe | null> {
  const storedRecipe = await getStoredRecipeByResultId(resultId);
  if (storedRecipe) {
    return storedRecipe;
  }

  const response = await fetchJson<{ data?: Record<string, unknown>[] }>(
    `${DOFUS_API_BASE}/recipes?resultId=${resultId}`,
  );
  const remoteRecipe = response.data?.[0];
  if (!remoteRecipe) {
    return null;
  }

  const normalizedRecipe = normalizeRecipe(remoteRecipe);
  if (!normalizedRecipe) {
    return null;
  }

  await upsertRecipes([normalizedRecipe]);
  return normalizedRecipe;
}

export async function resolveMissingNames(
  itemIds: number[],
): Promise<DofusItem[]> {
  const idsToResolve = [];

  // Como getStoredItemById ahora es asíncrono, usamos un for loop
  for (const itemId of itemIds) {
    const storedItem = await getStoredItemById(itemId);
    if (
      !storedItem ||
      !storedItem.name?.es ||
      storedItem.name.es.startsWith("Objeto #")
    ) {
      idsToResolve.push(itemId);
    }
  }

  if (idsToResolve.length === 0) {
    return [];
  }

  const resolvedItems: DofusItem[] = [];
  for (const itemId of idsToResolve) {
    try {
      const resolvedItem = await getOrFetchItemById(itemId);
      if (resolvedItem) {
        resolvedItems.push(resolvedItem);
      }
    } catch (error) {
      console.warn(`No se pudo resolver el item ${itemId}:`, error);
    }
  }

  return resolvedItems;
}

export async function setItemPrice(
  itemId: number,
  price: number,
  profileId?: number,
): Promise<{
  prices: MarketPriceMap;
  priceUpdatedAt: PriceUpdatedAtMap;
  activePriceProfileId: number;
}> {
  const activePriceProfileId = profileId || (await getActivePriceProfileId());
  await upsertPrice(activePriceProfileId, itemId, price);
  return {
    prices: await getPricesMap(activePriceProfileId),
    priceUpdatedAt: await getPriceUpdatedAtMap(activePriceProfileId),
    activePriceProfileId,
  };
}

export async function overwritePrices(
  prices: MarketPriceMap,
  profileId?: number,
): Promise<{
  prices: MarketPriceMap;
  priceUpdatedAt: PriceUpdatedAtMap;
  activePriceProfileId: number;
}> {
  const activePriceProfileId = profileId || (await getActivePriceProfileId());
  await replaceAllPrices(activePriceProfileId, prices);
  return {
    prices: await getPricesMap(activePriceProfileId),
    priceUpdatedAt: await getPriceUpdatedAtMap(activePriceProfileId),
    activePriceProfileId,
  };
}

export async function deleteAllStoredPrices(profileId?: number): Promise<{
  prices: MarketPriceMap;
  priceUpdatedAt: PriceUpdatedAtMap;
  activePriceProfileId: number;
}> {
  const activePriceProfileId = profileId || (await getActivePriceProfileId());
  await clearAllPrices(activePriceProfileId);
  return {
    prices: await getPricesMap(activePriceProfileId),
    priceUpdatedAt: await getPriceUpdatedAtMap(activePriceProfileId),
    activePriceProfileId,
  };
}

export async function changeActivePriceProfile(profileId: number): Promise<{
  activePriceProfileId: number;
  prices: MarketPriceMap;
  priceUpdatedAt: PriceUpdatedAtMap;
  profiles: PriceProfile[];
}> {
  const activePriceProfileId = await setActivePriceProfileId(profileId);
  return {
    activePriceProfileId,
    prices: await getPricesMap(activePriceProfileId),
    priceUpdatedAt: await getPriceUpdatedAtMap(activePriceProfileId),
    profiles: await getPriceProfiles(),
  };
}

export async function getPriceProfileState(): Promise<{
  activePriceProfileId: number;
  profiles: PriceProfile[];
  prices: MarketPriceMap;
  priceUpdatedAt: PriceUpdatedAtMap;
}> {
  const activePriceProfileId = await getActivePriceProfileId();
  return {
    activePriceProfileId,
    profiles: await getPriceProfiles(),
    prices: await getPricesMap(activePriceProfileId),
    priceUpdatedAt: await getPriceUpdatedAtMap(activePriceProfileId),
  };
}

export async function getAutomaticSyncState(): Promise<{
  syncSettings: SyncSettings;
  syncStatus: SyncStatus;
}> {
  return {
    syncSettings: await getSyncSettings(),
    syncStatus: await getSyncStatus(),
  };
}

export async function updateAutomaticSyncSettings(
  settings: SyncSettings,
): Promise<{
  syncSettings: SyncSettings;
  syncStatus: SyncStatus;
}> {
  const syncSettings = await setSyncSettings(settings);
  if (syncSettings.enabled) {
    await maybeStartAutomaticSync();
  }
  return {
    syncSettings,
    syncStatus: await getSyncStatus(),
  };
}

export async function searchAndStoreItems(
  searchTerm: string,
): Promise<DofusItem[]> {
  const trimmedTerm = searchTerm.trim();
  if (!trimmedTerm || trimmedTerm.length < 2) {
    return await getAllItems();
  }

  const params = new URLSearchParams({
    $limit: "40",
    lang: "es",
  });
  if (!Number.isNaN(Number(trimmedTerm))) {
    params.append("id", trimmedTerm);
  } else {
    params.append("name[$like]", trimmedTerm);
  }

  const response = await fetchJson<{ data?: Record<string, unknown>[] }>(
    `${DOFUS_API_BASE}/items?${params.toString()}`,
  );

  const normalizedItems = (response.data ?? [])
    .map((item) => normalizeSpanishItem(item))
    .filter((item) => item.id && !isOmittedItem(item));

  if (normalizedItems.length > 0) {
    await upsertItems(normalizedItems);
  }

  return await getAllItems();
}

export async function fetchAndStoreCategoryItems(
  typeIds: number[],
): Promise<DofusItem[]> {
  if (typeIds.length === 0) {
    return await getAllItems();
  }

  const params = new URLSearchParams({
    $limit: "100",
    lang: "es",
  });
  for (const typeId of typeIds) {
    params.append("typeId[$in]", String(typeId));
  }

  const response = await fetchJson<{ data?: Record<string, unknown>[] }>(
    `${DOFUS_API_BASE}/items?${params.toString()}`,
  );

  const normalizedItems = (response.data ?? [])
    .map((item) => normalizeSpanishItem(item))
    .filter((item) => item.id && !isOmittedItem(item));

  if (normalizedItems.length > 0) {
    await upsertItems(normalizedItems);
  }

  return await getAllItems();
}
