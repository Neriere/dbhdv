import { createClient } from "@libsql/client";
import fs from "fs";
import path from "path";
import { isOmittedItem, isCosmeticItem } from "../data/dofusJobs";
import { extractItemStats } from "../data/dofusRuneWeights";
import { getDofusDbSeedData } from "../data/dofusDbSeedData";
import {
  DofusEffect,
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

const dbUrl =
  process.env.TURSO_DATABASE_URL ||
  process.env.LIBSQL_URL ||
  process.env.DATABASE_URL ||
  process.env.TURSO_URL ||
  "file:local.db";

const dbAuthToken =
  process.env.TURSO_AUTH_TOKEN ||
  process.env.LIBSQL_AUTH_TOKEN ||
  process.env.DATABASE_AUTH_TOKEN ||
  process.env.TURSO_TOKEN ||
  undefined;

export const database = createClient({
  url: dbUrl,
  authToken: dbAuthToken,
});

export async function initDB() {
  try {
    // High-performance SQLite pragmas for fast concurrent reads and responsive queries
    try {
      await database.execute("PRAGMA journal_mode = WAL;");
      await database.execute("PRAGMA synchronous = NORMAL;");
      await database.execute("PRAGMA temp_store = MEMORY;");
      await database.execute("PRAGMA cache_size = -64000;");
    } catch {
      // Ignore if running against a remote Turso HTTP connection that restricts PRAGMAs
    }

    await database.executeMultiple(`
      CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY,
        level INTEGER NOT NULL DEFAULT 1,
        type_id INTEGER NOT NULL DEFAULT 0,
        super_category_id INTEGER NOT NULL DEFAULT 0,
        icon_id INTEGER NOT NULL DEFAULT 0,
        name_es TEXT NOT NULL DEFAULT '',
        has_recipe INTEGER NOT NULL DEFAULT 0,
        payload_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS item_stats (
        item_id INTEGER NOT NULL,
        rune_id INTEGER NOT NULL,
        stat_order INTEGER NOT NULL DEFAULT 0,
        characteristic_id INTEGER NOT NULL DEFAULT 0,
        effect_id INTEGER NOT NULL DEFAULT 0,
        rune_name TEXT NOT NULL,
        rune_weight REAL NOT NULL,
        stat_min REAL NOT NULL,
        stat_max REAL NOT NULL,
        stat_avg REAL NOT NULL,
        formatted_text TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (item_id, rune_id)
      );

      CREATE TABLE IF NOT EXISTS recipes (
        result_id INTEGER PRIMARY KEY,
        job_id INTEGER,
        payload_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS recipe_ingredients (
        recipe_id INTEGER NOT NULL,
        ingredient_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        PRIMARY KEY (recipe_id, ingredient_id)
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

      /* Optimized indexes for lightning-fast lookups */
      CREATE INDEX IF NOT EXISTS idx_items_type_id ON items(type_id);
      CREATE INDEX IF NOT EXISTS idx_items_name_es ON items(name_es);
      CREATE INDEX IF NOT EXISTS idx_items_has_recipe ON items(has_recipe);
      CREATE INDEX IF NOT EXISTS idx_items_level ON items(level DESC);
      CREATE INDEX IF NOT EXISTS idx_items_recipe_level ON items(has_recipe, level DESC);

      CREATE INDEX IF NOT EXISTS idx_item_stats_item ON item_stats(item_id);
      CREATE INDEX IF NOT EXISTS idx_item_stats_rune ON item_stats(rune_id);
      CREATE INDEX IF NOT EXISTS idx_item_stats_rune_item ON item_stats(rune_id, item_id);

      CREATE INDEX IF NOT EXISTS idx_recipes_job ON recipes(job_id);
      CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id);
      CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_ingredient ON recipe_ingredients(ingredient_id);

      CREATE INDEX IF NOT EXISTS idx_profile_prices_profile_id ON profile_prices(profile_id);
      CREATE INDEX IF NOT EXISTS idx_profile_prices_item_id ON profile_prices(item_id);
    `);

    // Clean up obsolete table if present
    try {
      await database.execute("DROP TABLE IF EXISTS prices;");
    } catch {
      // Ignored
    }

    try {
      await database.execute("ALTER TABLE items ADD COLUMN has_recipe INTEGER NOT NULL DEFAULT 0;");
    } catch {
      // Column might already exist
    }

    await database.execute(`
      UPDATE items SET has_recipe = 1 WHERE id IN (SELECT result_id FROM recipes);
    `);

    // Check if database is empty - if so, auto-populate from bundled dataset
    const countItemsRes = await database.execute("SELECT COUNT(*) as cnt FROM items");
    const totalItemsInDb = Number(countItemsRes.rows[0]?.cnt ?? 0);
    if (totalItemsInDb === 0) {
      console.log("[Database] Empty database detected. Auto-seeding full Dofus dataset into Turso/SQLite...");
      await seedDatabaseFromBundle();
    } else {
      // Sync stats for items already in DB if item_stats is empty
      const statsCountRes = await database.execute("SELECT COUNT(*) as cnt FROM item_stats");
      const count = Number(statsCountRes.rows[0]?.cnt ?? 0);
      if (count === 0) {
        const itemsRes = await database.execute("SELECT payload_json FROM items");
        const currentItems = itemsRes.rows.map(r => JSON.parse(r.payload_json as string) as DofusItem);
        if (currentItems.length > 0) {
          await syncItemStats(currentItems);
        }
      }
    }

    console.log("[Database] Turso / LibSQL schemas and indexes initialized successfully.");
  } catch (e) {
    console.warn("[Database] Database initialization error (fallback mode):", e);
  }
}

export async function seedDatabaseFromBundle(force = false): Promise<BootstrapData> {
  const countRes = await database.execute("SELECT COUNT(*) as cnt FROM items");
  const itemsCount = Number(countRes.rows[0]?.cnt ?? 0);
  if (itemsCount > 100 && !force) {
    return buildBootstrapData();
  }

  console.log("[Database] Seeding database from bundled Dofus dataset...");
  const seedData = getDofusDbSeedData();

  if (seedData && Array.isArray(seedData.items) && seedData.items.length > 0) {
    const items = seedData.items;
    const recipes = Array.isArray(seedData.recipes) ? seedData.recipes : [];

    await replaceAllItems(items);
    await replaceAllRecipes(recipes);

    let equipablesCount = 0;
    let consumablesCount = 0;
    let resourcesCount = 0;

    for (const item of items) {
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

    const status: SyncStatus = {
      lastSyncTimestamp: seedData.exportedAt || Date.now(),
      totalImported: items.length,
      recipesCount: recipes.length,
      equipablesCount,
      consumablesCount,
      resourcesCount,
      cosmeticsOmittedCount: 11986,
      isLoading: false,
      progressMessage: `Base de datos sincronizada con éxito (${items.length.toLocaleString()} objetos y ${recipes.length.toLocaleString()} recetas).`,
      progressPercent: 100,
      currentStep: "Completado",
      totalSteps: 3,
      currentStepIndex: 3,
    };
    await setSyncStatus(status);
    await ensureDefaultPriceProfile();
    invalidateServerBootstrapCache();
    console.log(`[Database] Seeding complete: ${items.length} items, ${recipes.length} recipes persisted.`);
  }

  return buildBootstrapData();
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
    progressPercent: 0,
    currentStep: "",
    totalSteps: 3,
    currentStepIndex: 0,
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

const SERVER_KNOWN_ITEMS: Record<number, Partial<DofusItem>> = {
  17994: {
    id: 17994,
    level: 200,
    typeId: 41,
    iconId: 179940,
    name: { es: "Lapa", fr: "Bernique", en: "Limpet" },
    type: { id: 41, superCategoryId: 9, name: { es: "Pescado", fr: "Poisson", en: "Fish" } },
  },
};

function cleanEffects(effectsList: unknown): DofusEffect[] | undefined {
  if (!Array.isArray(effectsList) || effectsList.length === 0) return undefined;
  const cleaned: DofusEffect[] = [];
  for (const eff of effectsList) {
    if (!eff || typeof eff !== "object") continue;
    const o = eff as Record<string, unknown>;
    const charId = Number(o.characteristic ?? o.characteristicId ?? 0);
    const effId = Number(o.effectId ?? o.id ?? 0);
    const fromVal = typeof o.from === "number" ? o.from : typeof o.min === "number" ? o.min : undefined;
    const toVal = typeof o.to === "number" ? o.to : typeof o.max === "number" ? o.max : undefined;
    const fmt = typeof o.formatted === "string" ? o.formatted : typeof o.formatted_text === "string" ? o.formatted_text : undefined;
    if (charId || effId || fromVal !== undefined || toVal !== undefined || fmt) {
      cleaned.push({
        ...(charId ? { characteristic: charId } : {}),
        ...(effId ? { effectId: effId } : {}),
        ...(fromVal !== undefined ? { from: fromVal } : {}),
        ...(toVal !== undefined ? { to: toVal } : {}),
        ...(fmt ? { formatted: fmt } : {}),
      });
    }
  }
  return cleaned.length > 0 ? cleaned : undefined;
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

  const known = SERVER_KNOWN_ITEMS[extractedId];

  const rawName = rawItem.name ?? rawItem.title;
  let spanishName = getLocalizedText(rawName, "");
  if (!spanishName || spanishName.startsWith("Objeto #")) {
    if (known && typeof known.name === "object" && known.name?.es) {
      spanishName = known.name.es;
    } else {
      spanishName = `Objeto #${extractedId}`;
    }
  }

  const rawType = (rawItem.type ?? {}) as Record<string, unknown>;
  const typeId = Number(
    rawItem.typeId ?? rawItem.type_id ?? rawType.id ?? rawType.ankamaId ?? known?.typeId ?? 0,
  );
  let typeName = getLocalizedText(
    rawType.name ?? rawItem.typeName ?? rawItem.type_name ?? "",
    "",
  );
  if (!typeName && known?.type?.name && typeof known.type.name === "object" && known.type.name.es) {
    typeName = known.type.name.es;
  }
  const superCategoryId = Number(
    rawType.superCategoryId ?? rawType.super_category_id ?? known?.type?.superCategoryId ?? 0,
  );

  const iconId = Number(rawItem.iconId ?? rawItem.icon_id ?? known?.iconId ?? 0);

  const possibleEffects = cleanEffects(rawItem.possibleEffects);
  const effects = cleanEffects(rawItem.effects);

  const cleanItem: DofusItem = {
    id: extractedId,
    level: Number(rawItem.level ?? known?.level ?? 1),
    typeId,
    iconId,
    name: {
      es: spanishName,
      fr: getLocalizedText(
        rawName && typeof rawName === "object"
          ? (rawName as Record<string, unknown>).fr
          : known?.name && typeof known.name === "object" ? known.name.fr : "",
        spanishName,
      ),
      en: getLocalizedText(
        rawName && typeof rawName === "object"
          ? (rawName as Record<string, unknown>).en
          : known?.name && typeof known.name === "object" ? known.name.en : "",
        spanishName,
      ),
    },
    type: {
      id: typeId,
      superCategoryId,
      name: { es: typeName, fr: typeName, en: typeName },
    },
    hasRecipe: Boolean(rawItem.hasRecipe || (rawItem as any).recipe || (rawItem as any).craft),
    price: typeof rawItem.price === "number" ? rawItem.price : undefined,
    ...(possibleEffects ? { possibleEffects } : {}),
    ...(effects ? { effects } : {}),
  };

  return cleanItem;
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

async function getSyncStatus(): Promise<SyncStatus> {
  const status = await getMetaValue<SyncStatus>("sync_status");
  const current = status ?? getDefaultSyncStatus();
  if (current.isLoading && !runningImportPromise) {
    current.isLoading = false;
    current.progressPercent = 100;
  }
  return current;
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

async function updateRecipeIngredients(recipes: DofusRecipe[]): Promise<void> {
  const statements = [];
  for (const recipe of recipes) {
    if (!recipe.ingredientIds || !recipe.quantities) continue;
    for (let i = 0; i < recipe.ingredientIds.length; i += 1) {
      const ingId = recipe.ingredientIds[i];
      const qty = recipe.quantities[i] || 1;
      if (!ingId) continue;
      statements.push({
        sql: `INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity) VALUES (?, ?, ?) ON CONFLICT(recipe_id, ingredient_id) DO UPDATE SET quantity = excluded.quantity`,
        args: [recipe.resultId, ingId, qty],
      });
    }
  }
  for (let i = 0; i < statements.length; i += 2000) {
    await database.batch(statements.slice(i, i + 2000), "write");
  }
}

export async function syncItemStats(items: DofusItem[]): Promise<void> {
  const statements: Array<{ sql: string; args: any[] }> = [];
  const now = Date.now();
  const crushableItems = items.filter(
    (item) =>
      item &&
      item.id &&
      (item.type?.superCategoryId === 1 ||
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 16, 17, 81].includes(
          item.typeId || item.type?.id || 0,
        )),
  );
  if (crushableItems.length === 0) return;

  for (const item of crushableItems) {
    const stats = extractItemStats(item);
    if (!stats || stats.length === 0) continue;

    stats.forEach((st, idx) => {
      statements.push({
        sql: `INSERT OR REPLACE INTO item_stats (item_id, rune_id, stat_order, characteristic_id, effect_id, rune_name, rune_weight, stat_min, stat_max, stat_avg, formatted_text, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          item.id,
          st.rune.id,
          idx,
          Number((st.effect as any)?.characteristic ?? st.rune.characteristicId ?? 0),
          Number((st.effect as any)?.effectId ?? st.rune.effectIds[0] ?? 0),
          st.rune.name,
          st.rune.unitWeight,
          st.statMin,
          st.statMax,
          st.statAvg,
          st.formattedText,
          now,
        ],
      });
    });
  }

  for (let i = 0; i < statements.length; i += 2000) {
    await database.batch(statements.slice(i, i + 2000), "write");
  }
}

async function upsertItems(items: DofusItem[]): Promise<void> {
  const now = Date.now();
  const statements = items.map((item) => ({
    sql: `INSERT INTO items (id, level, type_id, super_category_id, icon_id, name_es, has_recipe, payload_json, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET level = excluded.level, type_id = excluded.type_id, super_category_id = excluded.super_category_id, icon_id = excluded.icon_id, name_es = excluded.name_es, has_recipe = excluded.has_recipe, payload_json = excluded.payload_json, updated_at = excluded.updated_at`,
    args: [
      item.id,
      item.level || 1,
      item.typeId || item.type?.id || 0,
      item.type?.superCategoryId || 0,
      item.iconId || 0,
      item.name?.es || "",
      item.hasRecipe ? 1 : 0,
      JSON.stringify(item),
      now,
    ],
  }));
  for (let i = 0; i < statements.length; i += 2000)
    await database.batch(statements.slice(i, i + 2000), "write");

  // Also persist stats into item_stats table for fast querying
  await syncItemStats(items);
}

async function replaceAllItems(items: DofusItem[]): Promise<void> {
  await database.execute("DELETE FROM items");
  await database.execute("DELETE FROM item_stats");
  await upsertItems(items);
}

async function upsertRecipes(recipes: DofusRecipe[]): Promise<void> {
  const now = Date.now();
  const statements = recipes.map((recipe) => ({
    sql: `INSERT INTO recipes (result_id, job_id, payload_json, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(result_id) DO UPDATE SET job_id = excluded.job_id, payload_json = excluded.payload_json, updated_at = excluded.updated_at`,
    args: [recipe.resultId, recipe.jobId ?? null, JSON.stringify(recipe), now],
  }));
  for (let i = 0; i < statements.length; i += 2000)
    await database.batch(statements.slice(i, i + 2000), "write");

  await updateRecipeIngredients(recipes);

  const resultIds = recipes.map((r) => r.resultId).filter(Boolean);
  if (resultIds.length > 0) {
    for (let i = 0; i < resultIds.length; i += 500) {
      const chunk = resultIds.slice(i, i + 500);
      const placeholders = chunk.map(() => "?").join(",");
      await database.execute({
        sql: `UPDATE items SET has_recipe = 1 WHERE id IN (${placeholders})`,
        args: chunk,
      });
    }
  }
}

async function replaceAllRecipes(recipes: DofusRecipe[]): Promise<void> {
  await database.execute("DELETE FROM recipes");
  await database.execute("DELETE FROM recipe_ingredients");
  await upsertRecipes(recipes);
  await database.execute("UPDATE items SET has_recipe = 0 WHERE id NOT IN (SELECT result_id FROM recipes)");
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
  for (let i = 0; i < statements.length; i += 2000)
    await database.batch(statements.slice(i, i + 2000), "write");
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

async function fetchJson<T>(url: string, retries = 3, backoffMs = 500): Promise<T> {
  let lastError: any = null;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const r = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "DofusDB-HD local importer/1.0",
        },
      });
      if (r.ok) {
        return (await r.json()) as Promise<T>;
      }
      if (r.status === 429) {
        // Rate limited - wait longer before retrying
        await new Promise((res) => setTimeout(res, (attempt + 1) * 1200));
        continue;
      }
      throw new Error(`Request failed (${r.status})`);
    } catch (err) {
      lastError = err;
      if (attempt < retries - 1) {
        await new Promise((res) => setTimeout(res, backoffMs * (attempt + 1)));
      }
    }
  }
  throw lastError || new Error(`Failed to fetch ${url}`);
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

  // 1. Initial probe to know exact total
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

        if (normalizedItem.type?.superCategoryId === 23 || isCosmeticItem(normalizedItem as any)) {
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
    }

    itemSkip += itemConcurrency * itemLimit;
    status.totalImported = itemsMap.size;
    const itemPct = itemTotal > 0 ? Math.min(100, Math.round((itemSkip / itemTotal) * 100)) : 0;
    // Step 1 accounts for 0% - 50% of total progress
    status.progressPercent = Math.min(50, Math.round(itemPct * 0.5));
    status.currentStep = "Paso 1 de 3: Descargando objetos de DofusDB";
    status.currentStepIndex = 1;
    status.progressMessage = `Objetos: ${Math.min(itemSkip, itemTotal).toLocaleString()} de ${itemTotal.toLocaleString()} (${itemPct}%)`;
    await setSyncStatus(status);

    if (itemsInBatch === 0 && itemSkip >= itemTotal) {
      break;
    }
  }

  // 2. Fetch recipes concurrently
  let recipeTotal = 50;
  let recipeSkip = 0;
  const recipeLimit = 50;
  const recipeConcurrency = 12;

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
        const normalizedRecipe = normalizeRecipe(rawRecipe);
        if (normalizedRecipe) {
          recipesMap.set(normalizedRecipe.resultId, normalizedRecipe);
        }
      }
    }

    recipeSkip += recipeConcurrency * recipeLimit;
    status.recipesCount = recipesMap.size;
    const recipePct = recipeTotal > 0 ? Math.min(100, Math.round((recipeSkip / recipeTotal) * 100)) : 0;
    // Step 2 accounts for 50% - 85% of total progress
    status.progressPercent = 50 + Math.min(35, Math.round(recipePct * 0.35));
    status.currentStep = "Paso 2 de 3: Descargando recetas de crafteo";
    status.currentStepIndex = 2;
    status.progressMessage = `Recetas: ${Math.min(recipeSkip, recipeTotal).toLocaleString()} de ${recipeTotal.toLocaleString()} (${recipePct}%)`;
    await setSyncStatus(status);

    if (recipesInBatch === 0 && recipeSkip >= recipeTotal) {
      break;
    }
  }

  // Step 3: Saving to DB and building stats
  status.progressPercent = 88;
  status.currentStep = "Paso 3 de 3: Guardando objetos en base local";
  status.currentStepIndex = 3;
  status.progressMessage = "Guardando objetos y estadísticas en SQLite...";
  await setSyncStatus(status);

  const importedItems = Array.from(itemsMap.values());
  const importedRecipes = Array.from(recipesMap.values());

  for (const item of importedItems) {
    item.hasRecipe = recipesMap.has(item.id);
  }

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

  status.progressPercent = 95;
  status.currentStep = "Paso 3 de 3: Guardando recetas de crafteo";
  status.progressMessage = `Guardando ${importedRecipes.length.toLocaleString()} recetas en SQLite...`;
  await setSyncStatus(status);

  await replaceAllRecipes(importedRecipes);

  status.lastSyncTimestamp = Date.now();
  status.isLoading = false;
  status.progressPercent = 100;
  status.currentStep = "Completado";
  status.currentStepIndex = 3;
  status.progressMessage = `Sincronización finalizada con éxito (${status.totalImported.toLocaleString()} objetos y ${status.recipesCount?.toLocaleString()} recetas).`;
  await setSyncStatus(status);

  invalidateServerBootstrapCache();
  return buildBootstrapData();
} catch (err) {
  status.isLoading = false;
  status.progressPercent = 0;
  status.currentStep = "Error";
  status.progressMessage = `Error en importación: ${err instanceof Error ? err.message : String(err)}`;
  await setSyncStatus(status);
  throw err;
}
}

export function getDatabaseFilePath() {
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
export async function importAllDofusData() {
  if (!runningImportPromise)
    runningImportPromise = importAllDofusDataInternal().finally(() => {
      runningImportPromise = null;
    });
  return runningImportPromise;
}

export async function getItemStatsFromDb(itemId: number) {
  const result = await database.execute({
    sql: "SELECT rune_id, stat_order, characteristic_id, effect_id, rune_name, rune_weight, stat_min, stat_max, stat_avg, formatted_text FROM item_stats WHERE item_id = ? ORDER BY stat_order ASC",
    args: [itemId],
  });
  return result.rows.map((row) => ({
    runeId: Number(row.rune_id),
    statOrder: Number(row.stat_order),
    characteristicId: Number(row.characteristic_id),
    effectId: Number(row.effect_id),
    runeName: String(row.rune_name),
    runeWeight: Number(row.rune_weight),
    statMin: Number(row.stat_min),
    statMax: Number(row.stat_max),
    statAvg: Number(row.stat_avg),
    formattedText: String(row.formatted_text),
  }));
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

  if (SERVER_KNOWN_ITEMS[itemId]) {
    const known = normalizeSpanishItem(SERVER_KNOWN_ITEMS[itemId] as any);
    await upsertItems([known]);
    return known;
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

  try {
    const itemCheck = await database.execute({
      sql: "SELECT has_recipe FROM items WHERE id = ?",
      args: [resultId],
    });
    if (itemCheck.rows.length > 0 && Number(itemCheck.rows[0].has_recipe) === 0) {
      return null;
    }
  } catch {
    // Ignore if table or column missing
  }

  try {
    const res = await fetchJson<{ data?: Record<string, unknown>[] }>(
      `${DOFUS_API_BASE}/recipes?resultId=${resultId}`,
    );
    const remote = res.data?.[0];
    if (!remote) {
      try {
        await database.execute({
          sql: "UPDATE items SET has_recipe = 0 WHERE id = ?",
          args: [resultId],
        });
      } catch {}
      return null;
    }
    const norm = normalizeRecipe(remote);
    if (norm) {
      await upsertRecipes([norm]);
      try {
        await database.execute({
          sql: "UPDATE items SET has_recipe = 1 WHERE id = ?",
          args: [resultId],
        });
      } catch {}
    }
    return norm;
  } catch {
    return null;
  }
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

export { getSyncStatus };
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

  // 1. If payload contains items array
  if (Array.isArray(data.items) && data.items.length > 0) {
    const validItems = data.items.map((i: any) => normalizeSpanishItem(i)).filter((i: any) => i.id > 0);
    if (validItems.length > 0) {
      await upsertItems(validItems);
    }
  }

  // 2. If payload contains recipes map or array
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

  // 3. If payload contains prices (either version 2 or flat price map)
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

