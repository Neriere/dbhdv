import { mkdirSync } from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";
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
const DATABASE_DIRECTORY = path.join(process.cwd(), "data");
const DATABASE_FILE_PATH = path.join(DATABASE_DIRECTORY, "dofus-local.db");
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
  { slug: "imagiro", name: "Imagiro" },
  { slug: "mikhal", name: "Mikhal" },
  { slug: "orukam", name: "Orukam" },
  { slug: "tal-kasha", name: "Tal Kasha" },
  { slug: "tylezia", name: "Tylezia" },
  { slug: "kourial", name: "Kourial" },
  { slug: "dakal", name: "Dakal" },
];

mkdirSync(DATABASE_DIRECTORY, { recursive: true });

const database = new DatabaseSync(DATABASE_FILE_PATH);

database.exec(`
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

function setMetaValue(key: string, value: unknown): void {
  const statement = database.prepare(`
    INSERT INTO meta (key, value_json, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value_json = excluded.value_json,
      updated_at = excluded.updated_at
  `);

  statement.run(key, JSON.stringify(value), Date.now());
}

function getMetaValue<T>(key: string): T | null {
  const statement = database.prepare(
    "SELECT value_json FROM meta WHERE key = ?",
  );
  const row = statement.get(key) as { value_json: string } | undefined;
  return row ? parseJsonValue<T>(row.value_json) : null;
}

function getPriceProfiles(): PriceProfile[] {
  const statement = database.prepare(`
    SELECT id, name, slug, is_default
    FROM price_profiles
    ORDER BY id ASC
  `);

  const rows = statement.all() as Array<{
    id: number;
    name: string;
    slug: string;
    is_default: number;
  }>;

  const bySlug = new Map(
    rows.map((row) => [
      row.slug,
      {
        id: row.id,
        name: row.name,
        slug: row.slug,
        isDefault: row.is_default === 1,
      } as PriceProfile,
    ]),
  );

  return UNITY_SERVER_PROFILES.map((profile) =>
    bySlug.get(profile.slug),
  ).filter((profile): profile is PriceProfile => Boolean(profile));
}

function ensureDefaultPriceProfile(): PriceProfile {
  const legacyGeneral = database
    .prepare("SELECT id FROM price_profiles WHERE slug = 'general' LIMIT 1")
    .get() as { id: number } | undefined;

  if (legacyGeneral) {
    database
      .prepare(
        `
        UPDATE price_profiles
        SET name = ?, slug = ?, is_default = 1, updated_at = ?
        WHERE id = ?
      `,
      )
      .run("Privado", "private", Date.now(), legacyGeneral.id);
  }

  const now = Date.now();
  const insertStatement = database.prepare(`
    INSERT INTO price_profiles (name, slug, is_default, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  database.exec("BEGIN");
  try {
    for (const profile of UNITY_SERVER_PROFILES) {
      const existing = database
        .prepare("SELECT id FROM price_profiles WHERE slug = ? LIMIT 1")
        .get(profile.slug) as { id: number } | undefined;

      if (!existing) {
        insertStatement.run(
          profile.name,
          profile.slug,
          profile.isDefault ? 1 : 0,
          now,
          now,
        );
      }
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }

  database
    .prepare(
      "UPDATE price_profiles SET is_default = CASE WHEN slug = 'private' THEN 1 ELSE 0 END",
    )
    .run();

  const inserted = database
    .prepare(
      `
      SELECT id, name, slug, is_default
      FROM price_profiles
      WHERE slug = 'private'
      LIMIT 1
    `,
    )
    .get() as { id: number; name: string; slug: string; is_default: number };

  return {
    id: inserted.id,
    name: inserted.name,
    slug: inserted.slug,
    isDefault: inserted.is_default === 1,
  };
}

function ensureLegacyPriceMigration(defaultProfileId: number): void {
  const legacyCountRow = database
    .prepare("SELECT COUNT(*) AS count FROM prices")
    .get() as { count: number };
  const profilePriceCountRow = database
    .prepare("SELECT COUNT(*) AS count FROM profile_prices")
    .get() as { count: number };

  if (legacyCountRow.count === 0 || profilePriceCountRow.count > 0) {
    return;
  }

  const insertStatement = database.prepare(`
    INSERT INTO profile_prices (profile_id, item_id, price, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(profile_id, item_id) DO UPDATE SET
      price = excluded.price,
      updated_at = excluded.updated_at
  `);

  const legacyRows = database
    .prepare("SELECT item_id, price, updated_at FROM prices")
    .all() as Array<{ item_id: number; price: number; updated_at: number }>;

  database.exec("BEGIN");
  try {
    for (const row of legacyRows) {
      insertStatement.run(
        defaultProfileId,
        row.item_id,
        row.price,
        row.updated_at || Date.now(),
      );
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function getSyncStatus(): SyncStatus {
  return getMetaValue<SyncStatus>("sync_status") ?? getDefaultSyncStatus();
}

function setSyncStatus(status: SyncStatus): void {
  setMetaValue("sync_status", status);
}

function getSyncSettings(): SyncSettings {
  const stored = getMetaValue<SyncSettings>("sync_settings");
  if (!stored) {
    return DEFAULT_SYNC_SETTINGS;
  }

  return {
    enabled: stored.enabled !== false,
    intervalDays: Math.min(30, Math.max(1, Number(stored.intervalDays) || 30)),
  };
}

function setSyncSettings(settings: SyncSettings): SyncSettings {
  const normalizedSettings: SyncSettings = {
    enabled: settings.enabled !== false,
    intervalDays: Math.min(
      30,
      Math.max(1, Number(settings.intervalDays) || 30),
    ),
  };
  setMetaValue("sync_settings", normalizedSettings);
  return normalizedSettings;
}

function getActivePriceProfileId(): number {
  const defaultProfile = ensureDefaultPriceProfile();
  ensureLegacyPriceMigration(defaultProfile.id);
  const visibleProfileIds = new Set(
    getPriceProfiles().map((profile) => profile.id),
  );

  const storedProfileId = getMetaValue<number>("active_price_profile_id");
  const existingProfile = storedProfileId
    ? database
        .prepare("SELECT id FROM price_profiles WHERE id = ? LIMIT 1")
        .get(storedProfileId)
    : null;

  if (existingProfile && visibleProfileIds.has(storedProfileId as number)) {
    return storedProfileId as number;
  }

  setMetaValue("active_price_profile_id", defaultProfile.id);
  return defaultProfile.id;
}

function setActivePriceProfileId(profileId: number): number {
  const visibleProfileIds = new Set(
    getPriceProfiles().map((profile) => profile.id),
  );
  if (!visibleProfileIds.has(profileId)) {
    throw new Error("Perfil de precios no encontrado.");
  }

  setMetaValue("active_price_profile_id", profileId);
  return profileId;
}

function getPricesMap(profileId: number): MarketPriceMap {
  const statement = database.prepare(`
    SELECT item_id, price
    FROM profile_prices
    WHERE profile_id = ?
    ORDER BY item_id ASC
  `);

  const rows = statement.all(profileId) as Array<{
    item_id: number;
    price: number;
  }>;
  const prices: MarketPriceMap = {};

  for (const row of rows) {
    prices[row.item_id] = row.price;
  }

  return prices;
}

function getPriceUpdatedAtMap(profileId: number): PriceUpdatedAtMap {
  const statement = database.prepare(`
    SELECT item_id, updated_at
    FROM profile_prices
    WHERE profile_id = ?
    ORDER BY item_id ASC
  `);

  const rows = statement.all(profileId) as Array<{
    item_id: number;
    updated_at: number;
  }>;
  const updatedAtMap: PriceUpdatedAtMap = {};

  for (const row of rows) {
    updatedAtMap[row.item_id] = row.updated_at;
  }

  return updatedAtMap;
}

function upsertItems(items: DofusItem[]): void {
  const statement = database.prepare(`
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
  `);

  const now = Date.now();
  database.exec("BEGIN");
  try {
    for (const item of items) {
      statement.run(
        item.id,
        item.level || 1,
        item.typeId || item.type?.id || 0,
        item.type?.superCategoryId || 0,
        item.iconId || 0,
        item.name?.es || "",
        JSON.stringify(item),
        now,
      );
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function replaceAllItems(items: DofusItem[]): void {
  database.exec("BEGIN");
  try {
    database.exec("DELETE FROM items");
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }

  upsertItems(items);
}

function upsertRecipes(recipes: DofusRecipe[]): void {
  const statement = database.prepare(`
    INSERT INTO recipes (result_id, job_id, payload_json, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(result_id) DO UPDATE SET
      job_id = excluded.job_id,
      payload_json = excluded.payload_json,
      updated_at = excluded.updated_at
  `);

  const now = Date.now();
  database.exec("BEGIN");
  try {
    for (const recipe of recipes) {
      statement.run(
        recipe.resultId,
        recipe.jobId ?? null,
        JSON.stringify(recipe),
        now,
      );
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function replaceAllRecipes(recipes: DofusRecipe[]): void {
  database.exec("BEGIN");
  try {
    database.exec("DELETE FROM recipes");
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }

  upsertRecipes(recipes);
}

function upsertPrice(profileId: number, itemId: number, price: number): void {
  database
    .prepare(
      `
      INSERT INTO profile_prices (profile_id, item_id, price, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(profile_id, item_id) DO UPDATE SET
        price = excluded.price,
        updated_at = excluded.updated_at
    `,
    )
    .run(profileId, itemId, Math.max(0, Math.trunc(price)), Date.now());
}

function replaceAllPrices(profileId: number, prices: MarketPriceMap): void {
  const statement = database.prepare(`
    INSERT INTO profile_prices (profile_id, item_id, price, updated_at)
    VALUES (?, ?, ?, ?)
  `);

  const now = Date.now();
  database.exec("BEGIN");
  try {
    database
      .prepare("DELETE FROM profile_prices WHERE profile_id = ?")
      .run(profileId);
    for (const [itemId, price] of Object.entries(prices)) {
      statement.run(
        profileId,
        Number(itemId),
        Math.max(0, Math.trunc(price)),
        now,
      );
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function clearAllPrices(profileId: number): void {
  database
    .prepare("DELETE FROM profile_prices WHERE profile_id = ?")
    .run(profileId);
}

function getAllItems(): DofusItem[] {
  const rows = database
    .prepare(
      "SELECT payload_json FROM items ORDER BY name_es COLLATE NOCASE ASC, id ASC",
    )
    .all() as Array<{ payload_json: string }>;

  return rows.map((row) => parseJsonValue<DofusItem>(row.payload_json));
}

function getAllRecipes(): Record<number, DofusRecipe> {
  const rows = database
    .prepare("SELECT payload_json FROM recipes ORDER BY result_id ASC")
    .all() as Array<{ payload_json: string }>;

  const recipes: Record<number, DofusRecipe> = {};
  for (const row of rows) {
    const recipe = parseJsonValue<DofusRecipe>(row.payload_json);
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

function maybeStartAutomaticSync(): void {
  if (runningImportPromise) {
    return;
  }

  const syncStatus = getSyncStatus();
  const syncSettings = getSyncSettings();
  if (!shouldRunAutomaticSync(syncStatus, syncSettings)) {
    return;
  }

  void importAllDofusData().catch((error) => {
    console.error("[Local DB Auto Sync Error]", error);
  });
}

function buildBootstrapData(): BootstrapData {
  const activePriceProfileId = getActivePriceProfileId();
  return {
    items: getAllItems(),
    recipes: getAllRecipes(),
    prices: getPricesMap(activePriceProfileId),
    priceUpdatedAt: getPriceUpdatedAtMap(activePriceProfileId),
    syncStatus: getSyncStatus(),
    syncSettings: getSyncSettings(),
    priceProfiles: getPriceProfiles(),
    activePriceProfileId,
  };
}

async function importAllDofusDataInternal(): Promise<BootstrapData> {
  const previousStatus = getSyncStatus();
  const status: SyncStatus = {
    ...getDefaultSyncStatus(),
    lastSyncTimestamp: previousStatus.lastSyncTimestamp,
    isLoading: true,
    progressMessage: "Importando datos desde DofusDB...",
  };
  setSyncStatus(status);

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

  replaceAllItems(importedItems);
  replaceAllRecipes(importedRecipes);

  status.lastSyncTimestamp = Date.now();
  status.isLoading = false;
  status.progressMessage = `Importacion completada: ${status.totalImported} items y ${status.recipesCount || 0} recetas.`;
  setSyncStatus(status);

  return buildBootstrapData();
}

export function getDatabaseFilePath(): string {
  return DATABASE_FILE_PATH;
}

export function getBootstrapData(): BootstrapData & { databasePath: string } {
  ensureDefaultPriceProfile();
  maybeStartAutomaticSync();

  return {
    ...buildBootstrapData(),
    databasePath: DATABASE_FILE_PATH,
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

export function getStoredItemById(itemId: number): DofusItem | null {
  const row = database
    .prepare("SELECT payload_json FROM items WHERE id = ?")
    .get(itemId) as { payload_json: string } | undefined;

  return row ? parseJsonValue<DofusItem>(row.payload_json) : null;
}

export async function getOrFetchItemById(
  itemId: number,
): Promise<DofusItem | null> {
  const storedItem = getStoredItemById(itemId);
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
  upsertItems([normalizedItem]);
  return normalizedItem;
}

export function getStoredRecipeByResultId(
  resultId: number,
): DofusRecipe | null {
  const row = database
    .prepare("SELECT payload_json FROM recipes WHERE result_id = ?")
    .get(resultId) as { payload_json: string } | undefined;

  return row ? parseJsonValue<DofusRecipe>(row.payload_json) : null;
}

export async function getOrFetchRecipeByResultId(
  resultId: number,
): Promise<DofusRecipe | null> {
  const storedRecipe = getStoredRecipeByResultId(resultId);
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

  upsertRecipes([normalizedRecipe]);
  return normalizedRecipe;
}

export async function resolveMissingNames(
  itemIds: number[],
): Promise<DofusItem[]> {
  const idsToResolve = itemIds.filter((itemId) => {
    const storedItem = getStoredItemById(itemId);
    return (
      !storedItem ||
      !storedItem.name?.es ||
      storedItem.name.es.startsWith("Objeto #")
    );
  });

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

export function setItemPrice(
  itemId: number,
  price: number,
  profileId?: number,
): {
  prices: MarketPriceMap;
  priceUpdatedAt: PriceUpdatedAtMap;
  activePriceProfileId: number;
} {
  const activePriceProfileId = profileId || getActivePriceProfileId();
  upsertPrice(activePriceProfileId, itemId, price);
  return {
    prices: getPricesMap(activePriceProfileId),
    priceUpdatedAt: getPriceUpdatedAtMap(activePriceProfileId),
    activePriceProfileId,
  };
}

export function overwritePrices(
  prices: MarketPriceMap,
  profileId?: number,
): {
  prices: MarketPriceMap;
  priceUpdatedAt: PriceUpdatedAtMap;
  activePriceProfileId: number;
} {
  const activePriceProfileId = profileId || getActivePriceProfileId();
  replaceAllPrices(activePriceProfileId, prices);
  return {
    prices: getPricesMap(activePriceProfileId),
    priceUpdatedAt: getPriceUpdatedAtMap(activePriceProfileId),
    activePriceProfileId,
  };
}

export function deleteAllStoredPrices(profileId?: number): {
  prices: MarketPriceMap;
  priceUpdatedAt: PriceUpdatedAtMap;
  activePriceProfileId: number;
} {
  const activePriceProfileId = profileId || getActivePriceProfileId();
  clearAllPrices(activePriceProfileId);
  return {
    prices: getPricesMap(activePriceProfileId),
    priceUpdatedAt: getPriceUpdatedAtMap(activePriceProfileId),
    activePriceProfileId,
  };
}

export function changeActivePriceProfile(profileId: number): {
  activePriceProfileId: number;
  prices: MarketPriceMap;
  priceUpdatedAt: PriceUpdatedAtMap;
  profiles: PriceProfile[];
} {
  const activePriceProfileId = setActivePriceProfileId(profileId);
  return {
    activePriceProfileId,
    prices: getPricesMap(activePriceProfileId),
    priceUpdatedAt: getPriceUpdatedAtMap(activePriceProfileId),
    profiles: getPriceProfiles(),
  };
}

export function getPriceProfileState(): {
  activePriceProfileId: number;
  profiles: PriceProfile[];
  prices: MarketPriceMap;
  priceUpdatedAt: PriceUpdatedAtMap;
} {
  const activePriceProfileId = getActivePriceProfileId();
  return {
    activePriceProfileId,
    profiles: getPriceProfiles(),
    prices: getPricesMap(activePriceProfileId),
    priceUpdatedAt: getPriceUpdatedAtMap(activePriceProfileId),
  };
}

export function getAutomaticSyncState(): {
  syncSettings: SyncSettings;
  syncStatus: SyncStatus;
} {
  return {
    syncSettings: getSyncSettings(),
    syncStatus: getSyncStatus(),
  };
}

export function updateAutomaticSyncSettings(settings: SyncSettings): {
  syncSettings: SyncSettings;
  syncStatus: SyncStatus;
} {
  const syncSettings = setSyncSettings(settings);
  if (syncSettings.enabled) {
    maybeStartAutomaticSync();
  }
  return {
    syncSettings,
    syncStatus: getSyncStatus(),
  };
}

export async function searchAndStoreItems(
  searchTerm: string,
): Promise<DofusItem[]> {
  const trimmedTerm = searchTerm.trim();
  if (!trimmedTerm || trimmedTerm.length < 2) {
    return getAllItems();
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
    upsertItems(normalizedItems);
  }

  return getAllItems();
}

export async function fetchAndStoreCategoryItems(
  typeIds: number[],
): Promise<DofusItem[]> {
  if (typeIds.length === 0) {
    return getAllItems();
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
    upsertItems(normalizedItems);
  }

  return getAllItems();
}
