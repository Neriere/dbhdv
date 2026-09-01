import { createClient } from "@libsql/client";
import fs from "fs";
import path from "path";
import { isOmittedItem, isCosmeticItem } from "../data/dofusJobs.js";
import { DOFUS_BASE_RUNES, extractItemStats } from "../data/dofusRuneWeights.js";
import { CRAFTABLE_RUNES } from "../data/craftableRunesData.js";
import { PRESET_CRAFTABLE_ITEMS } from "../data/presetCraftableItems.js";
import { getDofusDbSeedData } from "../data/dofusDbSeedData.js";
import {
  DofusEffect,
  DofusItem,
  DofusRecipe,
  MarketPriceMap,
  PriceHistoryEntry,
  ItemPriceHistorySummary,
  PriceProfile,
  PriceUpdatedAtMap,
  ServerCategory,
  SyncSettings,
  SyncStatus,
} from "../types.js";

const DOFUS_API_BASE = "https://api.dofusdb.fr";

const DEFAULT_SYNC_SETTINGS: SyncSettings = {
  enabled: true,
  intervalDays: 30,
};

// Lista oficial de servidores de Dofus con categorización exacta
export const UNITY_SERVER_PROFILES: Array<{
  slug: string;
  name: string;
  category: ServerCategory;
  categoryLabel: string;
  isDefault?: boolean;
}> = [
  // Monocuenta Clásico
  { slug: "draconiros", name: "Draconiros", category: "monocuenta_clasico", categoryLabel: "Monocuenta Clásico", isDefault: true },

  // Monocuenta Pionero (Kourial, Mikhal, Dakal)
  { slug: "kourial", name: "Kourial", category: "monocuenta_pionero", categoryLabel: "Monocuenta Pionero" },
  { slug: "mikhal", name: "Mikhal", category: "monocuenta_pionero", categoryLabel: "Monocuenta Pionero" },
  { slug: "dakal", name: "Dakal", category: "monocuenta_pionero", categoryLabel: "Monocuenta Pionero" },

  // Multicuenta Pionero (Brial, Rafal, Salar)
  { slug: "brial", name: "Brial", category: "multicuenta_pionero", categoryLabel: "Multicuenta Pionero" },
  { slug: "rafal", name: "Rafal", category: "multicuenta_pionero", categoryLabel: "Multicuenta Pionero" },
  { slug: "salar", name: "Salar", category: "multicuenta_pionero", categoryLabel: "Multicuenta Pionero" },

  // Multicuenta Clásico (Tal Kasha, Hell Mina, Imagiro, Orukam, Tylezia)
  { slug: "tal-kasha", name: "Tal Kasha", category: "multicuenta_clasico", categoryLabel: "Multicuenta Clásico" },
  { slug: "hellmina", name: "Hell Mina", category: "multicuenta_clasico", categoryLabel: "Multicuenta Clásico" },
  { slug: "imagiro", name: "Imagiro", category: "multicuenta_clasico", categoryLabel: "Multicuenta Clásico" },
  { slug: "orukam", name: "Orukam", category: "multicuenta_clasico", categoryLabel: "Multicuenta Clásico" },
  { slug: "tylezia", name: "Tylezia", category: "multicuenta_clasico", categoryLabel: "Multicuenta Clásico" },
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
        category TEXT NOT NULL DEFAULT 'monocuenta_clasico',
        category_label TEXT NOT NULL DEFAULT 'Monocuenta Clásico',
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

      CREATE TABLE IF NOT EXISTS price_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        profile_id INTEGER NOT NULL,
        item_id INTEGER NOT NULL,
        price INTEGER NOT NULL,
        old_price INTEGER NOT NULL DEFAULT 0,
        difference INTEGER NOT NULL DEFAULT 0,
        percentage_change REAL NOT NULL DEFAULT 0,
        source TEXT NOT NULL DEFAULT 'manual',
        timestamp INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS profile_coefficients (
        profile_id INTEGER NOT NULL,
        item_id INTEGER NOT NULL,
        coefficient INTEGER NOT NULL DEFAULT 100,
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
      CREATE INDEX IF NOT EXISTS idx_profile_prices_profile_updated ON profile_prices(profile_id, updated_at DESC);

      CREATE INDEX IF NOT EXISTS idx_profile_coefficients_profile_id ON profile_coefficients(profile_id);
      CREATE INDEX IF NOT EXISTS idx_profile_coefficients_profile_item ON profile_coefficients(profile_id, item_id);

      CREATE INDEX IF NOT EXISTS idx_price_history_item ON price_history(profile_id, item_id, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_price_history_time ON price_history(profile_id, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_price_history_timestamp ON price_history(timestamp DESC);
    `);

    // Clean up obsolete table if present
    try {
      await database.execute("DROP TABLE IF EXISTS prices;");
    } catch {
      // Ignored
    }

    // Ensure category columns exist in price_profiles
    try {
      await database.execute("ALTER TABLE price_profiles ADD COLUMN category TEXT NOT NULL DEFAULT 'monocuenta_clasico';");
    } catch {
      // Column might already exist
    }
    try {
      await database.execute("ALTER TABLE price_profiles ADD COLUMN category_label TEXT NOT NULL DEFAULT 'Monocuenta Clásico';");
    } catch {
      // Column might already exist
    }

    try {
      await database.execute("ALTER TABLE items ADD COLUMN has_recipe INTEGER NOT NULL DEFAULT 0;");
    } catch {
      // Column might already exist
    }

    await database.execute(`
      UPDATE items SET has_recipe = 1 WHERE id IN (SELECT result_id FROM recipes);
    `);

    // Purge any quest items, test dummy items, or non-commercial tokens from SQLite
    try {
      await database.execute(`
        DELETE FROM items WHERE 
          super_category_id IN (4, 5, 14, 15, 23) OR 
          type_id IN (24, 80, 126, 127, 131, 132, 133, 136, 137, 141, 142, 143, 146, 147, 148, 149, 155, 156, 168, 171, 178, 186, 198, 312) OR
          name_es LIKE '[!]%' OR
          name_es LIKE '%insignias de expedición%' OR
          name_es LIKE '%insignia de expedición%' OR
          name_es LIKE '%abono desértico%' OR
          name_es LIKE '%abono desertico%' OR
          name_es LIKE '%selocalipsis%';
      `);
      await database.execute(`
        DELETE FROM item_stats WHERE item_id NOT IN (SELECT id FROM items);
      `);
    } catch {
      // Ignored
    }

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

    // Always ensure all official base and craftable runes are present in the items table
    await ensureRunesInDatabase();

    console.log("[Database] Turso / LibSQL schemas and indexes initialized successfully.");
  } catch (e) {
    console.warn("[Database] Database initialization error (fallback mode):", e);
  }
}

export async function seedStepInit(): Promise<{ totalItems: number; totalRecipes: number; itemChunks: number; recipeChunks: number }> {
  invalidateServerBootstrapCache();
  const seedData = getDofusDbSeedData();
  const totalItems = seedData.items?.length || 0;
  const totalRecipes = seedData.recipes?.length || 0;
  const chunkSize = 400;

  // Clear existing items and recipes tables cleanly
  await database.execute("DELETE FROM items");
  await database.execute("DELETE FROM item_stats");
  await database.execute("DELETE FROM recipes");
  await database.execute("DELETE FROM recipe_ingredients");

  const status: SyncStatus = {
    ...getDefaultSyncStatus(),
    isLoading: true,
    progressPercent: 5,
    currentStep: "Iniciando siembra de base de datos en Turso...",
    progressMessage: `Preparando carga de ${totalItems.toLocaleString()} objetos y ${totalRecipes.toLocaleString()} recetas...`,
    totalSteps: 4,
    currentStepIndex: 1,
  };
  await setSyncStatus(status);

  return {
    totalItems,
    totalRecipes,
    itemChunks: Math.ceil(totalItems / chunkSize),
    recipeChunks: Math.ceil(totalRecipes / chunkSize),
  };
}

export async function seedStepItems(chunkIndex: number, chunkSize = 400): Promise<{ chunkIndex: number; processed: number; totalItems: number }> {
  const seedData = getDofusDbSeedData();
  const allItems = (seedData.items || []).filter((i) => !isOmittedItem(i as any));
  const start = chunkIndex * chunkSize;
  const chunk = allItems.slice(start, start + chunkSize);

  if (chunk.length > 0) {
    await upsertItems(chunk);
  }

  return {
    chunkIndex,
    processed: Math.min(start + chunk.length, allItems.length),
    totalItems: allItems.length,
  };
}

export async function seedStepRecipes(chunkIndex: number, chunkSize = 400): Promise<{ chunkIndex: number; processed: number; totalRecipes: number }> {
  const seedData = getDofusDbSeedData();
  const allRecipes = seedData.recipes || [];
  const start = chunkIndex * chunkSize;
  const chunk = allRecipes.slice(start, start + chunkSize);

  if (chunk.length > 0) {
    await upsertRecipes(chunk);
  }

  return {
    chunkIndex,
    processed: Math.min(start + chunk.length, allRecipes.length),
    totalRecipes: allRecipes.length,
  };
}

export async function seedStepFinalize(): Promise<BootstrapData> {
  const seedData = getDofusDbSeedData();
  const items = seedData.items || [];
  const recipes = seedData.recipes || [];

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

  // Update has_recipe flag
  await database.execute("UPDATE items SET has_recipe = 1 WHERE id IN (SELECT result_id FROM recipes)");

  const status: SyncStatus = {
    lastSyncTimestamp: seedData.exportedAt || Date.now(),
    totalImported: items.length,
    recipesCount: recipes.length,
    equipablesCount,
    consumablesCount,
    resourcesCount,
    cosmeticsOmittedCount: 11986,
    isLoading: false,
    progressMessage: `Base de datos en Turso poblada con éxito (${items.length.toLocaleString()} objetos y ${recipes.length.toLocaleString()} recetas).`,
    progressPercent: 100,
    currentStep: "Completado",
    totalSteps: 4,
    currentStepIndex: 4,
  };

  await setSyncStatus(status);
  await ensureDefaultPriceProfile();
  invalidateServerBootstrapCache();

  return await buildBootstrapData();
}

export async function importChunkInit(): Promise<void> {
  invalidateServerBootstrapCache();
  await database.execute("DELETE FROM items");
  await database.execute("DELETE FROM item_stats");
  await database.execute("DELETE FROM recipes");
  await database.execute("DELETE FROM recipe_ingredients");
  const status: SyncStatus = {
    ...getDefaultSyncStatus(),
    isLoading: true,
    progressPercent: 5,
    currentStep: "Iniciando importación desde DofusDB...",
    progressMessage: "Limpiando base previa en Turso...",
  };
  await setSyncStatus(status);
}

export async function importChunkItems(items: DofusItem[]): Promise<{ count: number }> {
  if (items && items.length > 0) {
    const validItems = items
      .map((i) => normalizeSpanishItem(i as any))
      .filter((i) => i.id > 0 && !isOmittedItem(i as any));
    if (validItems.length > 0) {
      await upsertItems(validItems);
    }
    return { count: validItems.length };
  }
  return { count: 0 };
}

export async function importChunkRecipes(recipes: DofusRecipe[]): Promise<{ count: number }> {
  if (recipes && recipes.length > 0) {
    const validRecipes: DofusRecipe[] = [];
    for (const r of recipes) {
      const norm = normalizeRecipe(r as any);
      if (norm) validRecipes.push(norm);
    }
    if (validRecipes.length > 0) {
      await upsertRecipes(validRecipes);
    }
  }
  return { count: recipes?.length || 0 };
}

export async function importChunkFinalize(): Promise<BootstrapData> {
  await database.execute("UPDATE items SET has_recipe = 1 WHERE id IN (SELECT result_id FROM recipes)");
  
  const countItemsRes = await database.execute("SELECT COUNT(*) as cnt FROM items");
  const countRecipesRes = await database.execute("SELECT COUNT(*) as cnt FROM recipes");
  const totalItems = Number(countItemsRes.rows[0]?.cnt ?? 0);
  const totalRecipes = Number(countRecipesRes.rows[0]?.cnt ?? 0);

  const status: SyncStatus = {
    lastSyncTimestamp: Date.now(),
    totalImported: totalItems,
    recipesCount: totalRecipes,
    equipablesCount: 0,
    consumablesCount: 0,
    resourcesCount: 0,
    cosmeticsOmittedCount: 0,
    isLoading: false,
    progressMessage: `Importación en vivo finalizada con éxito (${totalItems.toLocaleString()} objetos y ${totalRecipes.toLocaleString()} recetas).`,
    progressPercent: 100,
    currentStep: "Completado",
  };
  await setSyncStatus(status);
  await ensureDefaultPriceProfile();
  invalidateServerBootstrapCache();
  return await buildBootstrapData();
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
  coefficients?: Record<number, number>;
  coefficientUpdatedAt?: Record<number, number>;
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

export function getStaticItemById(itemId: number): DofusItem | null {
  if (!itemId || itemId <= 0) return null;

  const baseRune = DOFUS_BASE_RUNES.find((r) => r.id === itemId);
  if (baseRune) {
    return {
      id: baseRune.id,
      level: 1,
      typeId: 78,
      iconId: baseRune.iconId || 78000,
      name: {
        es: baseRune.name,
        fr: baseRune.nameFr || baseRune.name,
        en: baseRune.nameEn || baseRune.name,
      },
      type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
      hasRecipe: false,
    };
  }

  const craftable = CRAFTABLE_RUNES.find((r) => r.id === itemId);
  if (craftable) {
    return {
      id: craftable.id,
      level: craftable.level || 1,
      typeId: 78,
      iconId: craftable.iconId || 78000,
      name: {
        es: craftable.name.es,
        fr: craftable.name.fr,
        en: craftable.name.en,
      },
      type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
      hasRecipe: true,
    };
  }

  const preset = PRESET_CRAFTABLE_ITEMS.find((p) => p.id === itemId);
  if (preset) {
    return preset as DofusItem;
  }

  const known = SERVER_KNOWN_ITEMS[itemId];
  if (known && known.name?.es) {
    return normalizeSpanishItem(known as any);
  }

  return null;
}

export async function ensureRunesInDatabase(): Promise<void> {
  try {
    const allRuneItems: DofusItem[] = [];
    const allRuneRecipes: DofusRecipe[] = [];

    for (const baseRune of DOFUS_BASE_RUNES) {
      allRuneItems.push({
        id: baseRune.id,
        level: 1,
        typeId: 78,
        iconId: baseRune.iconId || 78000,
        name: {
          es: baseRune.name,
          fr: baseRune.nameFr || baseRune.name,
          en: baseRune.nameEn || baseRune.name,
        },
        type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
        hasRecipe: false,
      });
    }

    for (const craftable of CRAFTABLE_RUNES) {
      allRuneItems.push({
        id: craftable.id,
        level: craftable.level || 1,
        typeId: 78,
        iconId: craftable.iconId || 78000,
        name: {
          es: craftable.name.es,
          fr: craftable.name.fr,
          en: craftable.name.en,
        },
        type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
        hasRecipe: true,
      });
      if (craftable.recipeData) {
        allRuneRecipes.push(craftable.recipeData);
      }
    }

    if (allRuneItems.length > 0) {
      await upsertItems(allRuneItems);
    }
    if (allRuneRecipes.length > 0) {
      await upsertRecipes(allRuneRecipes);
    }
  } catch (err) {
    console.warn("[Database] Error ensuring runes in database:", err);
  }
}

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

let cachedPriceProfiles: PriceProfile[] | null = null;
let cachedActivePriceProfileId: number | null = null;

export function invalidatePriceProfileCache(): void {
  cachedPriceProfiles = null;
  cachedActivePriceProfileId = null;
}

async function getPriceProfiles(): Promise<PriceProfile[]> {
  if (cachedPriceProfiles && cachedPriceProfiles.length > 0) {
    return cachedPriceProfiles;
  }

  const result = await database.execute(
    `SELECT id, name, slug, category, category_label, is_default FROM price_profiles ORDER BY id ASC`,
  );
  const bySlug = new Map(
    result.rows.map((row) => [
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
  const profilesList: PriceProfile[] = [];
  for (const profile of UNITY_SERVER_PROFILES) {
    const existing = bySlug.get(profile.slug);
    if (existing) {
      profilesList.push({
        ...existing,
        name: profile.name,
        category: profile.category,
        categoryLabel: profile.categoryLabel,
      });
    }
  }
  cachedPriceProfiles = profilesList;
  return profilesList;
}

let serverBootstrapCache: { data: BootstrapData; expiresAt: number } | null = null;
const SERVER_CACHE_TTL_MS = 60 * 1000; // 60s warm serverless context cache

export function invalidateServerBootstrapCache(): void {
  serverBootstrapCache = null;
}

async function ensureDefaultPriceProfile(): Promise<PriceProfile> {
  if (cachedPriceProfiles && cachedPriceProfiles.length > 0) {
    const def = cachedPriceProfiles.find((p) => p.isDefault) || cachedPriceProfiles[0];
    if (def) return def;
  }

  // Migrate slug oruka to orukam if present
  try {
    await database.execute(
      "UPDATE price_profiles SET slug = 'orukam', name = 'Orukam', category = 'multicuenta_clasico', category_label = 'Multicuenta Clásico' WHERE slug = 'oruka'"
    );
  } catch {}

  const validSlugs = UNITY_SERVER_PROFILES.map((p) => p.slug);
  const placeholders = validSlugs.map(() => "?").join(",");

  // Clean up any deleted/unwanted profiles (e.g. Ombre or old test profiles)
  try {
    await database.execute({
      sql: `DELETE FROM profile_prices WHERE profile_id IN (SELECT id FROM price_profiles WHERE slug NOT IN (${placeholders}))`,
      args: validSlugs,
    });
    await database.execute({
      sql: `DELETE FROM price_profiles WHERE slug NOT IN (${placeholders})`,
      args: validSlugs,
    });
  } catch {}

  const existingResult = await database.execute(
    `SELECT id, name, slug, category, category_label, is_default FROM price_profiles ORDER BY id ASC`,
  );
  const existingSlugs = new Set(existingResult.rows.map((r) => r.slug as string));

  const now = Date.now();
  const statements = [];
  for (const profile of UNITY_SERVER_PROFILES) {
    if (!existingSlugs.has(profile.slug)) {
      statements.push({
        sql: `INSERT OR IGNORE INTO price_profiles (name, slug, category, category_label, is_default, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [
          profile.name,
          profile.slug,
          profile.category,
          profile.categoryLabel,
          profile.isDefault ? 1 : 0,
          now,
          now,
        ],
      });
    } else {
      statements.push({
        sql: `UPDATE price_profiles SET name = ?, category = ?, category_label = ?, updated_at = ? WHERE slug = ?`,
        args: [profile.name, profile.category, profile.categoryLabel, now, profile.slug],
      });
    }
  }

  if (statements.length > 0) await database.batch(statements, "write");

  const defaultSlug = UNITY_SERVER_PROFILES.find((p) => p.isDefault)?.slug || "draconiros";
  const hasDefault = existingResult.rows.some((r) => (r.is_default as number) === 1);
  if (!hasDefault) {
    await database.execute({
      sql: "UPDATE price_profiles SET is_default = CASE WHEN slug = ? THEN 1 ELSE 0 END",
      args: [defaultSlug],
    });
  }

  const insertedResult = await database.execute({
    sql: "SELECT id, name, slug, category, category_label, is_default FROM price_profiles WHERE slug = ? LIMIT 1",
    args: [defaultSlug],
  });
  const inserted = insertedResult.rows[0];
  const defaultProfileObj: PriceProfile = {
    id: inserted.id as number,
    name: inserted.name as string,
    slug: inserted.slug as string,
    category: (inserted.category as ServerCategory) || "monocuenta_clasico",
    categoryLabel: (inserted.category_label as string) || "Monocuenta Clásico",
    isDefault: (inserted.is_default as number) === 1,
  };
  cachedPriceProfiles = null; // force fresh reload on next getPriceProfiles()
  return defaultProfileObj;
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
  if (cachedActivePriceProfileId !== null) {
    return cachedActivePriceProfileId;
  }

  const defaultProfile = await ensureDefaultPriceProfile();
  const profiles = await getPriceProfiles();
  const visibleProfileIds = new Set(profiles.map((p) => p.id));
  const storedProfileId = await getMetaValue<number>("active_price_profile_id");
  if (storedProfileId && visibleProfileIds.has(storedProfileId)) {
    cachedActivePriceProfileId = storedProfileId;
    return storedProfileId;
  }
  await setMetaValue("active_price_profile_id", defaultProfile.id);
  cachedActivePriceProfileId = defaultProfile.id;
  return defaultProfile.id;
}

async function setActivePriceProfileId(profileId: number): Promise<number> {
  const profiles = await getPriceProfiles();
  if (!profiles.some((p) => p.id === profileId))
    throw new Error("Perfil de precios no encontrado.");
  await setMetaValue("active_price_profile_id", profileId);
  cachedActivePriceProfileId = profileId;
  return profileId;
}

async function getPricesAndUpdatedAtMaps(profileId: number): Promise<{ prices: MarketPriceMap; priceUpdatedAt: PriceUpdatedAtMap }> {
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
  return { prices, priceUpdatedAt };
}

async function getPricesMap(profileId: number): Promise<MarketPriceMap> {
  const { prices } = await getPricesAndUpdatedAtMaps(profileId);
  return prices;
}

async function getPriceUpdatedAtMap(
  profileId: number,
): Promise<PriceUpdatedAtMap> {
  const { priceUpdatedAt } = await getPricesAndUpdatedAtMaps(profileId);
  return priceUpdatedAt;
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
  for (let i = 0; i < statements.length; i += 250) {
    await database.batch(statements.slice(i, i + 250), "write");
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

  for (let i = 0; i < statements.length; i += 250) {
    await database.batch(statements.slice(i, i + 250), "write");
  }
}

async function upsertItems(items: DofusItem[]): Promise<void> {
  const filtered = items.filter((item) => item && item.id > 0 && !isOmittedItem(item as any));
  if (filtered.length === 0) return;
  const now = Date.now();
  const statements = filtered.map((item) => ({
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
  for (let i = 0; i < statements.length; i += 250)
    await database.batch(statements.slice(i, i + 250), "write");

  // Also persist stats into item_stats table for fast querying
  await syncItemStats(filtered);
}

async function replaceAllItems(items: DofusItem[]): Promise<void> {
  const filtered = items.filter((item) => item && item.id > 0 && !isOmittedItem(item as any));
  await database.execute("DELETE FROM items");
  await database.execute("DELETE FROM item_stats");
  await upsertItems(filtered);
}

async function upsertRecipes(recipes: DofusRecipe[]): Promise<void> {
  const now = Date.now();
  const statements = recipes.map((recipe) => ({
    sql: `INSERT INTO recipes (result_id, job_id, payload_json, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(result_id) DO UPDATE SET job_id = excluded.job_id, payload_json = excluded.payload_json, updated_at = excluded.updated_at`,
    args: [recipe.resultId, recipe.jobId ?? null, JSON.stringify(recipe), now],
  }));
  for (let i = 0; i < statements.length; i += 250)
    await database.batch(statements.slice(i, i + 250), "write");

  await updateRecipeIngredients(recipes);

  const resultIds = recipes.map((r) => r.resultId).filter(Boolean);
  if (resultIds.length > 0) {
    for (let i = 0; i < resultIds.length; i += 250) {
      const chunk = resultIds.slice(i, i + 250);
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
  source: string = "manual",
): Promise<void> {
  const cleanPrice = Math.max(0, Math.trunc(price));
  const now = Date.now();

  let oldPrice = 0;
  try {
    const existing = await database.execute({
      sql: "SELECT price FROM profile_prices WHERE profile_id = ? AND item_id = ?",
      args: [profileId, itemId],
    });
    if (existing.rows.length > 0) {
      oldPrice = Number(existing.rows[0].price) || 0;
    }
  } catch {
    // Ignore
  }

  const statements: Array<{ sql: string; args: any[] }> = [
    {
      sql: `INSERT INTO profile_prices (profile_id, item_id, price, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(profile_id, item_id) DO UPDATE SET price = excluded.price, updated_at = excluded.updated_at`,
      args: [profileId, itemId, cleanPrice, now],
    },
  ];

  if (cleanPrice !== oldPrice) {
    const diff = cleanPrice - oldPrice;
    const pctChange =
      oldPrice > 0
        ? ((cleanPrice - oldPrice) / oldPrice) * 100
        : cleanPrice > 0
        ? 100
        : 0;
    statements.push({
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

  await database.batch(statements, "write");
}

async function replaceAllPrices(
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
    args: [profileId, Number(itemId), Math.max(0, Math.trunc(price)), now],
  }));
  for (let i = 0; i < statements.length; i += 250)
    await database.batch(statements.slice(i, i + 250), "write");

  const historyStatements: Array<{ sql: string; args: any[] }> = [];
  for (const [itemIdStr, price] of Object.entries(prices)) {
    const itemId = Number(itemIdStr);
    const cleanPrice = Math.max(0, Math.trunc(price));
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

async function clearAllPrices(profileId: number): Promise<void> {
  await database.execute({
    sql: "DELETE FROM profile_prices WHERE profile_id = ?",
    args: [profileId],
  });
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
    totalChanges: history.length,
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

async function getAllItems(): Promise<DofusItem[]> {
  const result = await database.execute(
    "SELECT payload_json FROM items ORDER BY name_es COLLATE NOCASE ASC, id ASC",
  );
  return result.rows
    .map((row) => parseJsonValue<DofusItem>(row.payload_json as string))
    .filter((item) => item && item.id > 0 && !isOmittedItem(item as any));
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
    { sql: "SELECT id, name, slug, category, category_label, is_default FROM price_profiles ORDER BY id ASC", args: [] },
    { sql: "SELECT item_id, coefficient, updated_at FROM profile_coefficients WHERE profile_id = ?", args: [activeProfileId] },
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
  if (batchResults[6]?.rows) {
    for (const row of batchResults[6].rows) {
      const id = row.item_id as number;
      coefficients[id] = row.coefficient as number;
      coefficientUpdatedAt[id] = row.updated_at as number;
    }
  }

  const resultData: BootstrapData = {
    items,
    recipes,
    prices,
    priceUpdatedAt,
    coefficients,
    coefficientUpdatedAt,
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

        if (isOmittedItem(normalizedItem as any)) {
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
  if (stored && stored.name?.es && !stored.name.es.startsWith("Objeto #") && !stored.name.es.startsWith("Item #"))
    return stored;

  const staticItem = getStaticItemById(itemId);
  if (staticItem && staticItem.name?.es && !staticItem.name.es.startsWith("Objeto #")) {
    await upsertItems([staticItem]);
    return staticItem;
  }

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
  const { prices, priceUpdatedAt } = await getPricesAndUpdatedAtMaps(pid);
  return {
    prices,
    priceUpdatedAt,
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
    profiles: await getPriceProfiles(),
  };
}

export async function getProfileCoefficients(profileId?: number): Promise<{
  coefficients: Record<number, number>;
  coefficientUpdatedAt: Record<number, number>;
  activePriceProfileId: number;
}> {
  const pid = profileId || (await getActivePriceProfileId());
  const result = await database.execute({
    sql: "SELECT item_id, coefficient, updated_at FROM profile_coefficients WHERE profile_id = ?",
    args: [pid],
  });
  const coefficients: Record<number, number> = {};
  const coefficientUpdatedAt: Record<number, number> = {};
  for (const row of result.rows) {
    const itemId = Number(row.item_id);
    coefficients[itemId] = Number(row.coefficient);
    coefficientUpdatedAt[itemId] = Number(row.updated_at);
  }
  return {
    coefficients,
    coefficientUpdatedAt,
    activePriceProfileId: pid,
  };
}

export async function setItemCoefficient(
  itemId: number,
  coefficient: number,
  profileId?: number,
  updatedAt?: number,
) {
  invalidateServerBootstrapCache();
  const pid = profileId || (await getActivePriceProfileId());
  const ts = updatedAt || Date.now();
  const validCoeff = Math.max(1, Math.min(10000, Number(coefficient) || 100));

  await database.execute({
    sql: `
      INSERT INTO profile_coefficients (profile_id, item_id, coefficient, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(profile_id, item_id) DO UPDATE SET
        coefficient = excluded.coefficient,
        updated_at = excluded.updated_at
    `,
    args: [pid, itemId, validCoeff, ts],
  });

  return await getProfileCoefficients(pid);
}

export async function bulkSaveProfileCoefficients(
  entries: Array<{ itemId: number; coefficient: number; updatedAt?: number }>,
  profileId?: number,
) {
  invalidateServerBootstrapCache();
  const pid = profileId || (await getActivePriceProfileId());
  if (!entries || entries.length === 0) {
    return await getProfileCoefficients(pid);
  }

  const now = Date.now();
  const chunkSize = 200;
  for (let i = 0; i < entries.length; i += chunkSize) {
    const chunk = entries.slice(i, i + chunkSize);
    const statements = chunk.map((entry) => ({
      sql: `
        INSERT INTO profile_coefficients (profile_id, item_id, coefficient, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(profile_id, item_id) DO UPDATE SET
          coefficient = excluded.coefficient,
          updated_at = excluded.updated_at
      `,
      args: [
        pid,
        Number(entry.itemId),
        Math.max(1, Math.min(10000, Number(entry.coefficient) || 100)),
        Number(entry.updatedAt) || now,
      ],
    }));
    await database.batch(statements, "write");
  }

  return await getProfileCoefficients(pid);
}

export interface IngestMarketPricePayload {
  item_id: number;
  item_name?: string;
  type?: 'recurso' | 'equipable' | string;
  precios: Record<string, number | string> | Array<number | string>;
  server?: string;
  source?: string;
}

export interface IngestMarketPriceResult {
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

  const cleanServer = typeof payload.server === "string" ? payload.server.slice(0, 60) : "";
  const { profileId, profileName } = await getProfileIdByServerNameOrSlug(cleanServer);
  const precios = payload.precios;
  let resolvedType = (payload.type || '').toLowerCase();

  // Detect type if not explicitly supplied
  if (!resolvedType) {
    if (Array.isArray(precios) && precios.length > 4) {
      resolvedType = 'equipable';
    } else if (precios && typeof precios === 'object' && !Array.isArray(precios)) {
      const keys = Object.keys(precios);
      if (keys.some(k => ['1', '10', '100', '1000'].includes(k))) {
        resolvedType = 'recurso';
      }
    }
  }

  let finalPrice = 0;
  let minPrice = 0;
  let maxPrice = 0;
  let rawAvg = 0;
  let offersCount = 0;

  // 1. RECURSOS / INGREDIENTES: Media de lotes (x1, x10, x100, x1000) con filtro de lotes inflados
  if (resolvedType === 'recurso' || (precios && typeof precios === 'object' && !Array.isArray(precios) && Object.keys(precios).some(k => ['1', '10', '100', '1000'].includes(k)))) {
    resolvedType = 'recurso';
    const rawObj = (precios && typeof precios === 'object' && !Array.isArray(precios))
      ? (precios as Record<string, number | string>)
      : {};

    const p1 = Number(rawObj['1'] ?? rawObj[1] ?? 0);
    const p10 = Number(rawObj['10'] ?? rawObj[10] ?? 0);
    const p100 = Number(rawObj['100'] ?? rawObj[100] ?? 0);
    const p1000 = Number(rawObj['1000'] ?? rawObj[1000] ?? 0);

    const unitPrices: number[] = [];
    if (p1 > 0) unitPrices.push(p1);
    if (p10 > 0) unitPrices.push(Math.round(p10 / 10));
    if (p100 > 0) unitPrices.push(Math.round(p100 / 100));
    if (p1000 > 0) unitPrices.push(Math.round(p1000 / 1000));

    if (unitPrices.length > 0) {
      offersCount = unitPrices.length;
      minPrice = Math.min(...unitPrices);
      maxPrice = Math.max(...unitPrices);
      const sum = unitPrices.reduce((acc, val) => acc + val, 0);
      rawAvg = Math.round(sum / unitPrices.length);

      // Filtro anti-inflación de lotes: descartar lotes que superen 2.5x el precio unitario mínimo
      // (a menos que sea el único lote)
      const validUnitPrices = unitPrices.filter(p => p <= minPrice * 2.5);
      const activePrices = validUnitPrices.length > 0 ? validUnitPrices : [minPrice];
      finalPrice = Math.round(activePrices.reduce((a, b) => a + b, 0) / activePrices.length);
    }
  }
  // 2. EQUIPABLES / OFERTAS INDIVIDUALES: Filtro Robusto de Outliers (Exos / Sobremagueos / Precios Troles)
  else {
    resolvedType = 'equipable';
    let numericPrices: number[] = [];
    if (Array.isArray(precios)) {
      numericPrices = precios.map(Number).filter(n => !Number.isNaN(n) && n > 0);
    } else if (precios && typeof precios === 'object') {
      numericPrices = Object.values(precios).map(Number).filter(n => !Number.isNaN(n) && n > 0);
    }

    if (numericPrices.length > 0) {
      const sorted = [...numericPrices].sort((a, b) => a - b);
      offersCount = sorted.length;
      minPrice = sorted[0];
      maxPrice = sorted[sorted.length - 1];

      const sum = sorted.reduce((acc, val) => acc + val, 0);
      rawAvg = Math.round(sum / sorted.length);

      // FÓRMULA INTELIGENTE ANTI-OUTLIERS:
      // En Dofus los equipables con exo-magias o precios troles pueden valer x10, x100 o x1000 más que el precio base.
      // Filtramos cualquier oferta que supere 2.2x el precio mínimo (o 2.0x de la mediana inferior).
      // Solo promediamos las ofertas dentro del cluster base realista.
      const outlierThreshold = Math.max(minPrice * 2.2, minPrice + 2000);
      const normalOffers = sorted.filter(p => p <= outlierThreshold);

      if (normalOffers.length === 1) {
        finalPrice = normalOffers[0];
      } else {
        const normalSum = normalOffers.reduce((a, b) => a + b, 0);
        const normalAvg = normalSum / normalOffers.length;
        // Ponderar 60% el precio mínimo y 40% la media normalizada del cluster base
        finalPrice = Math.round(minPrice * 0.6 + normalAvg * 0.4);
      }
    }
  }

  // 3. Resolución o inserción del nombre del objeto si no viene o falta en la base local
  let resolvedName = (payload.item_name || '').trim();
  if (!resolvedName || resolvedName.startsWith('Item #') || resolvedName.startsWith('Objeto #')) {
    try {
      const itemRecord = await getOrFetchItemById(itemId);
      if (itemRecord?.name?.es) {
        resolvedName = itemRecord.name.es;
      }
    } catch {
      // Ignored fallback
    }
    if (!resolvedName) {
      resolvedName = `Objeto #${itemId}`;
    }
  }

  const now = Date.now();
  // 4. Guardar en profile_prices y registrar en price_history con source='sniffer'
  if (finalPrice > 0) {
    await upsertPrice(profileId, itemId, finalPrice, payload.source || 'sniffer');
    invalidateServerBootstrapCache();
  }

  return {
    success: true,
    item_id: itemId,
    name: resolvedName,
    type: resolvedType,
    calculated_price: finalPrice,
    min_price: minPrice,
    max_price: maxPrice,
    raw_average: rawAvg,
    offers_count: offersCount,
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

  // 1. In-memory parsing and outlier calculation
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
    const precios = payload.precios;
    let resolvedType = (payload.type || '').toLowerCase();

    if (!resolvedType) {
      if (Array.isArray(precios) && precios.length > 4) {
        resolvedType = 'equipable';
      } else if (precios && typeof precios === 'object' && !Array.isArray(precios)) {
        const keys = Object.keys(precios);
        if (keys.some(k => ['1', '10', '100', '1000'].includes(k))) {
          resolvedType = 'recurso';
        }
      }
    }

    let finalPrice = 0;
    let minPrice = 0;
    let maxPrice = 0;
    let rawAvg = 0;
    let offersCount = 0;

    if (resolvedType === 'recurso' || (precios && typeof precios === 'object' && !Array.isArray(precios) && Object.keys(precios).some(k => ['1', '10', '100', '1000'].includes(k)))) {
      resolvedType = 'recurso';
      const rawObj = (precios && typeof precios === 'object' && !Array.isArray(precios))
        ? (precios as Record<string, number | string>)
        : {};

      const p1 = Number(rawObj['1'] ?? rawObj[1] ?? 0);
      const p10 = Number(rawObj['10'] ?? rawObj[10] ?? 0);
      const p100 = Number(rawObj['100'] ?? rawObj[100] ?? 0);
      const p1000 = Number(rawObj['1000'] ?? rawObj[1000] ?? 0);

      const unitPrices: number[] = [];
      if (p1 > 0) unitPrices.push(p1);
      if (p10 > 0) unitPrices.push(Math.round(p10 / 10));
      if (p100 > 0) unitPrices.push(Math.round(p100 / 100));
      if (p1000 > 0) unitPrices.push(Math.round(p1000 / 1000));

      if (unitPrices.length > 0) {
        offersCount = unitPrices.length;
        minPrice = Math.min(...unitPrices);
        maxPrice = Math.max(...unitPrices);
        const sum = unitPrices.reduce((acc, val) => acc + val, 0);
        rawAvg = Math.round(sum / unitPrices.length);

        const validUnitPrices = unitPrices.filter(p => p <= minPrice * 2.5);
        const activePrices = validUnitPrices.length > 0 ? validUnitPrices : [minPrice];
        finalPrice = Math.round(activePrices.reduce((a, b) => a + b, 0) / activePrices.length);
      }
    } else {
      resolvedType = 'equipable';
      let numericPrices: number[] = [];
      if (Array.isArray(precios)) {
        numericPrices = precios.map(Number).filter(n => !Number.isNaN(n) && n > 0);
      } else if (precios && typeof precios === 'object') {
        numericPrices = Object.values(precios).map(Number).filter(n => !Number.isNaN(n) && n > 0);
      }

      if (numericPrices.length > 0) {
        const sorted = [...numericPrices].sort((a, b) => a - b);
        offersCount = sorted.length;
        minPrice = sorted[0];
        maxPrice = sorted[sorted.length - 1];

        const sum = sorted.reduce((acc, val) => acc + val, 0);
        rawAvg = Math.round(sum / sorted.length);

        const outlierThreshold = Math.max(minPrice * 2.2, minPrice + 2000);
        const normalOffers = sorted.filter(p => p <= outlierThreshold);

        if (normalOffers.length === 1) {
          finalPrice = normalOffers[0];
        } else {
          const normalSum = normalOffers.reduce((a, b) => a + b, 0);
          const normalAvg = normalSum / normalOffers.length;
          finalPrice = Math.round(minPrice * 0.6 + normalAvg * 0.4);
        }
      }
    }

    let resolvedName = (payload.item_name || '').trim();
    if (!resolvedName || resolvedName.startsWith('Item #') || resolvedName.startsWith('Objeto #')) {
      const staticItem = getStaticItemById(itemId);
      if (staticItem?.name?.es) {
        resolvedName = staticItem.name.es;
      } else if (SERVER_KNOWN_ITEMS[itemId]?.name?.es) {
        resolvedName = SERVER_KNOWN_ITEMS[itemId].name.es;
      } else if (cachedItemsDictionary && cachedItemsDictionary[String(itemId)]) {
        resolvedName = cachedItemsDictionary[String(itemId)];
      } else {
        resolvedName = `Objeto #${itemId}`;
      }
    }

    parsedItems.push({
      payload,
      itemId,
      profileId,
      profileName,
      resolvedType,
      finalPrice,
      minPrice,
      maxPrice,
      rawAvg,
      offersCount,
      resolvedName,
    });
  }

  if (parsedItems.length === 0) {
    return { success: true, total_processed: 0, results: [] };
  }

  // 2. Fetch existing prices in a single query per profile
  const now = Date.now();
  const uniqueProfileIds = Array.from(new Set(parsedItems.map(p => p.profileId)));
  const oldPricesMap = new Map<string, number>();

  for (const pid of uniqueProfileIds) {
    const itemIdsForProfile = Array.from(new Set(parsedItems.filter(p => p.profileId === pid).map(p => p.itemId)));
    if (itemIdsForProfile.length > 0) {
      try {
        const placeholders = itemIdsForProfile.map(() => '?').join(',');
        const queryRes = await database.execute({
          sql: `SELECT item_id, price FROM profile_prices WHERE profile_id = ? AND item_id IN (${placeholders})`,
          args: [pid, ...itemIdsForProfile],
        });
        for (const row of queryRes.rows) {
          oldPricesMap.set(`${pid}:${row.item_id}`, Number(row.price) || 0);
        }
      } catch {}
    }
  }

  // 3. Build atomic write statements
  const statements: Array<{ sql: string; args: any[] }> = [];

  for (const item of parsedItems) {
    const { profileId, profileName, itemId, finalPrice, minPrice, maxPrice, rawAvg, offersCount, resolvedName, resolvedType, payload } = item;
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
      server: profileName,
      profile_id: profileId,
      updated_at: now,
    });
  }

  // 4. Batch write to Turso in parallel chunks of 250 statements
  if (statements.length > 0) {
    for (let i = 0; i < statements.length; i += 250) {
      await database.batch(statements.slice(i, i + 250), "write");
    }
  }

  invalidateServerBootstrapCache();

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
  serverTime: number;
  totalUpdated: number;
}> {
  const serverTime = Date.now();
  const safeSince = Number(sinceTimestamp) || 0;

  try {
    const result = await database.execute({
      sql: "SELECT item_id, price, updated_at FROM profile_prices WHERE profile_id = ? AND updated_at > ? ORDER BY updated_at ASC",
      args: [profileId, safeSince],
    });

    const prices: MarketPriceMap = {};
    const priceUpdatedAt: PriceUpdatedAtMap = {};

    for (const row of result.rows) {
      const itemId = Number(row.item_id);
      prices[itemId] = Number(row.price);
      priceUpdatedAt[itemId] = Number(row.updated_at);
    }

    return {
      prices,
      priceUpdatedAt,
      serverTime,
      totalUpdated: Object.keys(prices).length,
    };
  } catch (err) {
    console.error("[getLatestMarketPricesDelta Error]:", err);
    return {
      prices: {},
      priceUpdatedAt: {},
      serverTime,
      totalUpdated: 0,
    };
  }
}

let cachedItemsDictionary: Record<string, string> | null = null;
let lastItemsDictionaryFetch = 0;

export async function getItemsDictionary(): Promise<Record<string, string>> {
  const now = Date.now();
  // Cache for 10 minutes in RAM
  if (cachedItemsDictionary && Object.keys(cachedItemsDictionary).length > 0 && now - lastItemsDictionaryFetch < 10 * 60 * 1000) {
    return cachedItemsDictionary;
  }

  const dict: Record<string, string> = {};

  // 1. All base runes (all official Dofus runes)
  for (const rune of DOFUS_BASE_RUNES) {
    if (rune.id && rune.name) {
      dict[String(rune.id)] = rune.name;
    }
  }

  // 2. All craftable runes (Bu, Su, Pa, Ra variants)
  for (const rune of CRAFTABLE_RUNES) {
    if (rune.id && rune.name?.es) {
      dict[String(rune.id)] = rune.name.es;
    }
  }

  // 3. Preset items
  for (const preset of PRESET_CRAFTABLE_ITEMS) {
    if (preset.id && preset.name?.es) {
      dict[String(preset.id)] = preset.name.es;
    }
  }

  // 4. Seed with known server items
  for (const [idStr, item] of Object.entries(SERVER_KNOWN_ITEMS)) {
    if (item.name?.es) {
      dict[idStr] = item.name.es;
    }
  }

  // 5. Seed data from bundle
  const seedData = getDofusDbSeedData();
  if (seedData && Array.isArray(seedData.items)) {
    for (const item of seedData.items) {
      if (item.id && item.name?.es && !item.name.es.startsWith("Objeto #") && !item.name.es.startsWith("Item #")) {
        dict[String(item.id)] = item.name.es;
      }
    }
  }

  // 6. Query all items with names in database
  try {
    const result = await database.execute("SELECT id, name_es FROM items WHERE name_es != ''");
    for (const row of result.rows) {
      const id = String(row.id);
      const name = String(row.name_es || "").trim();
      if (name && !name.startsWith("Objeto #") && !name.startsWith("Item #")) {
        dict[id] = name;
      }
    }
  } catch (err) {
    console.warn("[getItemsDictionary] DB query warning:", err);
  }

  cachedItemsDictionary = dict;
  lastItemsDictionaryFetch = now;
  return dict;
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

// ----------------------------------------------------------------------------
// Dofusbook Link Parser & Set Cost Calculator
// ----------------------------------------------------------------------------

interface DofusbookRawItem {
  rawName: string;
}

const CATEGORY_NAMES_TO_IGNORE = new Set([
  "boucliers", "bouclier", "bottes", "botte", "prysmaradites", "prismaradites", "prysmaradite", "prismaradite",
  "anneaux", "anneau", "montiliers", "montilier", "chapeaux", "chapeau", "sombreros", "sombrero",
  "trophees", "trophee", "trophées", "trophée", "trofeos", "trofeo", "familiers", "familier", "mascotas", "mascota", "mascoturas",
  "ceintures", "ceinture", "cinturons", "cinturón", "cinturon",
  "volkornes", "volkorne", "vuelocerontes", "vueloceronte", 
  "dragodindes", "dragodinde", "dragopavos", "dragopavo",
  "muldos", "muldo", "mulaguas", "mulagua",
  "amulettes", "amulette", "amuletos", "amuleto",
  "dofus", "capes", "cape", "capas",
  "haches", "hache", "hachas", "hacha",
  "faux", "guadañas", "guadaña",
  "pioches", "pioche", "picos", "pico",
  "marteaux", "marteau", "martillos", "martillo",
  "pelles", "pelle", "palas", "pala",
  "dagues", "dague", "dagas", "daga",
  "arcs", "arc", "arcos", "arco",
  "epees", "epee", "épées", "épée", "espadas", "espada",
  "batons", "baton", "bâtons", "bâton", "bastones", "baston",
  "baguettes", "baguette", "varitas", "varita",
  "lances", "lance", "lanzas", "lanza",
  "armes", "arme", "armas", "arma",
  "dofusbook", "logo", "nobody", "banner", "icon", "icone", "avatar", "profil", "dofus-stuffer", "equipement",
  "air", "feu", "eau", "terre", "neutre", "pv", "pa", "pm", "po", "cc", "so", "pu", "vi", "sa", "fo", "in", "ch", "ag"
]);

function getSlotNameByTypeId(typeId: number, currentCounts: Record<string, number>): string {
  switch (typeId) {
    case 1:
      return "Amuleto";
    case 9: {
      const ringCount = (currentCounts["Anillo"] || 0) + 1;
      currentCounts["Anillo"] = ringCount;
      return `Anillo ${ringCount}`;
    }
    case 10:
      return "Cinturón";
    case 11:
      return "Botas";
    case 16:
      return "Sombrero";
    case 17:
      return "Capa";
    case 82:
      return "Escudo";
    case 2:
    case 3:
    case 4:
    case 5:
    case 6:
    case 7:
    case 8:
    case 19:
    case 21:
    case 22:
    case 114:
    case 183:
      return "Arma";
    case 18:
    case 121:
    case 122:
    case 123:
      return "Mascota / Montura";
    case 23: {
      const dofusCount = (currentCounts["Dofus"] || 0) + 1;
      currentCounts["Dofus"] = dofusCount;
      return `Dofus ${dofusCount}`;
    }
    case 151:
    case 271: {
      const trophyCount = (currentCounts["Trofeo"] || 0) + 1;
      currentCounts["Trofeo"] = trophyCount;
      return `Trofeo ${trophyCount}`;
    }
    case 217:
      return "Prismaradita";
    default:
      return "Equipamiento";
  }
}

async function findItemByNameOrId(nameOrId: string | number): Promise<DofusItem | null> {
  const isNumeric = typeof nameOrId === "number" || (/^\d+$/.test(String(nameOrId).trim()) && Number(nameOrId) < 1000000);
  if (typeof nameOrId === "number") {
    const item = await getOrFetchItemById(nameOrId);
    if (item) return item;
  }

  const queryName = String(nameOrId).replace(/^Image \d+:\s*/i, "").trim();
  if (!queryName || queryName.length < 2) return null;

  // Don't search if it is a generic placeholder or category word
  if (CATEGORY_NAMES_TO_IGNORE.has(queryName.toLowerCase()) || /^image \d+$/i.test(queryName)) {
    return null;
  }

  try {
    // 1. Exact match in local DB by name_es or JSON payload
    const localMatch = await database.execute({
      sql: `SELECT payload_json FROM items 
            WHERE LOWER(name_es) = LOWER(?) 
               OR payload_json LIKE ? 
               OR payload_json LIKE ?
            LIMIT 1`,
      args: [
        queryName,
        `%"fr":"${queryName}"%`,
        `%"es":"${queryName}"%`
      ]
    });

    if (localMatch.rows.length > 0 && localMatch.rows[0].payload_json) {
      return JSON.parse(localMatch.rows[0].payload_json as string) as DofusItem;
    }

    // 2. Online DofusDB API query by French name (exact first)
    const searchUrl = `${DOFUS_API_BASE}/items?name.fr=${encodeURIComponent(queryName)}&lang=es&$limit=5`;
    const res = await fetch(searchUrl);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.data) && data.data.length > 0) {
        const exact = data.data.find(
          (it: any) =>
            it.name?.fr?.toLowerCase() === queryName.toLowerCase() ||
            it.name?.es?.toLowerCase() === queryName.toLowerCase()
        ) || data.data[0];
        
        const remoteItem = exact as DofusItem;
        await upsertItems([remoteItem]);
        return remoteItem;
      }
    }

    // 3. Also try searching online DofusDB API by Spanish name
    const searchEsUrl = `${DOFUS_API_BASE}/items?name.es=${encodeURIComponent(queryName)}&lang=es&$limit=5`;
    const resEs = await fetch(searchEsUrl);
    if (resEs.ok) {
      const dataEs = await resEs.json();
      if (Array.isArray(dataEs.data) && dataEs.data.length > 0) {
        const exactEs = dataEs.data.find(
          (it: any) =>
            it.name?.es?.toLowerCase() === queryName.toLowerCase() ||
            it.name?.fr?.toLowerCase() === queryName.toLowerCase()
        ) || dataEs.data[0];
        
        const remoteItem = exactEs as DofusItem;
        await upsertItems([remoteItem]);
        return remoteItem;
      }
    }

    // 4. Fallback: Fuzzy search in local database
    const fuzzyMatch = await database.execute({
      sql: `SELECT payload_json FROM items 
            WHERE name_es LIKE ? 
               OR payload_json LIKE ?
            LIMIT 1`,
      args: [`%${queryName}%`, `%${queryName}%`]
    });

    if (fuzzyMatch.rows.length > 0 && fuzzyMatch.rows[0].payload_json) {
      return JSON.parse(fuzzyMatch.rows[0].payload_json as string) as DofusItem;
    }
  } catch (err) {
    console.warn(`[findItemByNameOrId] Error searching for "${nameOrId}":`, err);
  }

  return null;
}

export async function analyzeDofusbookBuild(
  rawInput: string,
  options: {
    excludeDofus?: boolean;
    excludeTrophies?: boolean;
    profileId?: number;
  } = {}
) {
  const { excludeDofus = true, excludeTrophies = false, profileId } = options;
  const targetProfileId = profileId || (await getActivePriceProfileId());

  let targetUrl = rawInput.trim();
  if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
    if (targetUrl.includes("dofusbook.net") || targetUrl.includes("d-bk.net")) {
      targetUrl = "https://" + targetUrl;
    } else if (/^[a-zA-Z0-9_-]+$/.test(targetUrl)) {
      targetUrl = `https://d-bk.net/fr/d/${targetUrl}`;
    } else {
      targetUrl = "https://" + targetUrl;
    }
  }

  // Follow any initial short-link redirects (e.g. d-bk.net -> dofusbook.net/desktop/...)
  let resolvedUrl = targetUrl;
  try {
    const headRes = await fetch(targetUrl, {
      method: "GET",
      redirect: "manual",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      },
    });
    const loc = headRes.headers.get("location");
    if (loc) {
      resolvedUrl = loc.startsWith("http")
        ? loc
        : new URL(loc, targetUrl).toString();
    }
  } catch (e: any) {
    console.warn("Redirect check failed, using targetUrl:", e.message);
  }

  // If URL is standard dofusbook but doesn't have /desktop/, convert to /desktop/ for full layout
  if (resolvedUrl.includes("dofusbook.net/fr/equipement/") && !resolvedUrl.includes("/desktop/")) {
    resolvedUrl = resolvedUrl.replace("dofusbook.net/fr/equipement/", "dofusbook.net/desktop/fr/equipement/");
  }

  // Fetch page content via Jina Reader markdown proxy
  const jinaUrl = `https://r.jina.ai/${resolvedUrl}`;
  let markdown = "";
  try {
    const jinaRes = await fetch(jinaUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; DofusDBApp/1.0)",
        Accept: "text/plain, text/markdown",
      },
    });
    if (jinaRes.ok) {
      markdown = await jinaRes.text();
    }
  } catch (err: any) {
    console.warn("Jina fetch error:", err.message);
  }

  // Fallback: If Jina failed or returned empty, try direct fetch
  if (!markdown || markdown.includes("Attention Required! | Cloudflare")) {
    try {
      const directRes = await fetch(resolvedUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        },
      });
      if (directRes.ok) {
        markdown = await directRes.text();
      }
    } catch (e: any) {
      console.warn("Direct fetch error:", e.message);
    }
  }

  if (!markdown) {
    throw new Error(
      "No se pudo cargar la información del enlace de Dofusbook. Verifica que el enlace sea público y correcto."
    );
  }

  // 1. Extract build metadata
  const titleMatch =
    markdown.match(/Stuff de ([^\n!]+)/i) ||
    markdown.match(/Title:\s*([^\n]+)/i);
  const buildName = titleMatch ? titleMatch[1].trim() : "Build Dofusbook";

  const lvlMatch =
    markdown.match(/Niveau\s+(\d+)/i) ||
    markdown.match(/Niv\.\s*Stuff.*?(\d+)/i) ||
    markdown.match(/Niv\.\s*(\d+)/i);
  const buildLevel = lvlMatch ? parseInt(lvlMatch[1], 10) : undefined;

  // 2. Extract ONLY equipped slot items (-70.webp in the equipment stuffer grid)
  // Exclude all category navigation items (-50.webp) and empty slot placeholders
  const slotMatches = [
    ...markdown.matchAll(
      /!\[(?:Image \d+:\s*)?([^\]]*)\]\(https:\/\/(?:www\.)?(?:dofusbook\.net|d-bk\.net)\/static\/dist\/items\/(\d+)-70\.webp\)/gi
    ),
  ];

  const rawItems: DofusbookRawItem[] = [];

  for (const match of slotMatches) {
    let rawName = (match[1] || "").replace(/^Image \d+:\s*/i, "").trim();
    if (!rawName) continue;
    if (/^Image \d+$/i.test(rawName)) continue;
    if (CATEGORY_NAMES_TO_IGNORE.has(rawName.toLowerCase())) continue;

    const lower = rawName.toLowerCase();
    // Allow up to 2 instances of any ring or unique item up to 16 total equipped slots
    const currentCount = rawItems.filter((i) => i.rawName.toLowerCase() === lower).length;
    if (currentCount < 2 && rawItems.length < 16) {
      rawItems.push({ rawName });
    }
  }

  // Fallback: If 0 items matched with -70.webp (e.g. different format), extract strictly from the equipment block
  if (rawItems.length === 0) {
    // Find the section between Niv. / Stuff and Do Neutre / Panoplie
    const stufferBlockMatch = markdown.match(
      /(?:Niv\.\s*Stuff|Niveau\s*\d+)[\s\S]*?(?:Do Neutre|Do Terre|Dommages|\* \* \*|$)/i
    );
    const block = stufferBlockMatch ? stufferBlockMatch[0] : markdown;

    const altMatches = [
      ...block.matchAll(
        /!\[(?:Image \d+:\s*)?([^\]]+)\]\(https:\/\/(?:www\.)?(?:dofusbook\.net|d-bk\.net)\/static\/dist\/items\/(\d+)[^\)]*\)/gi
      ),
    ];

    for (const m of altMatches) {
      const fullUrl = m[0];
      // Strictly skip navigation category icons (-50.webp)
      if (fullUrl.includes("-50.webp")) continue;

      let name = (m[1] || "").replace(/^Image \d+:\s*/i, "").trim();
      if (!name || /^Image \d+$/i.test(name)) continue;
      if (CATEGORY_NAMES_TO_IGNORE.has(name.toLowerCase())) continue;

      const lower = name.toLowerCase();
      const currentCount = rawItems.filter((i) => i.rawName.toLowerCase() === lower).length;
      if (currentCount < 2 && rawItems.length < 16) {
        rawItems.push({ rawName: name });
      }
    }
  }

  // 3. Get all profile prices for the active server profile
  const pricesResult = await database.execute({
    sql: "SELECT item_id, price FROM profile_prices WHERE profile_id = ?",
    args: [targetProfileId],
  });
  const pricesMap: Record<number, number> = {};
  for (const row of pricesResult.rows) {
    pricesMap[Number(row.item_id)] = Number(row.price) || 0;
  }

  // 4. Resolve items, recipes, ingredients, and costs
  const slotCounts: Record<string, number> = {};
  const analyzedItems: any[] = [];
  const consolidatedIngredientsMap = new Map<number, any>();

  let totalCraftCost = 0;
  let totalMarketPrice = 0;
  let totalOptimalCost = 0;
  let craftablePiecesCount = 0;
  let excludedDofusCount = 0;
  let excludedTrophiesCount = 0;

  for (const raw of rawItems) {
    const item = await findItemByNameOrId(raw.rawName);
    const itemId = item?.id || 0;
    const typeId = item?.typeId || item?.type?.id || 0;
    const typeName = (item?.type?.name?.es || "").toLowerCase();
    const itemNameEs = (item?.name?.es || "").toLowerCase();
    const itemNameFr = (item?.name?.fr || raw.rawName).toLowerCase();

    const isDofus =
      typeId === 23 ||
      typeName.includes("dofus") ||
      itemNameEs.includes("dofus") ||
      itemNameFr.includes("dofus");

    const isTrophy =
      typeId === 151 ||
      typeId === 271 ||
      typeName.includes("trofeo") ||
      itemNameEs.includes("trofeo") ||
      itemNameFr.includes("trophée");

    const isPrysmaradite = typeId === 217;

    const slotName = item
      ? getSlotNameByTypeId(typeId, slotCounts)
      : "Equipamiento";

    let recipe: DofusRecipe | null = null;
    if (itemId > 0) {
      recipe = await getOrFetchRecipeByResultId(itemId);
    }

    const isCraftable = !!(
      recipe &&
      recipe.ingredientIds &&
      recipe.ingredientIds.length > 0
    );

    const ingredientsBreakdown: any[] = [];
    let craftCost = 0;
    let missingIngredientsCount = 0;

    if (isCraftable && recipe) {
      for (let i = 0; i < recipe.ingredientIds.length; i++) {
        const ingId = recipe.ingredientIds[i];
        const ingQty = recipe.quantities[i] || 1;
        const ingItem = await getOrFetchItemById(ingId);
        const unitPrice = pricesMap[ingId] || 0;
        const ingTotalPrice = unitPrice * ingQty;

        if (unitPrice === 0) {
          missingIngredientsCount++;
        }

        craftCost += ingTotalPrice;

        ingredientsBreakdown.push({
          id: ingId,
          name: ingItem?.name?.es || ingItem?.name?.fr || `Ingrediente #${ingId}`,
          nameFr: ingItem?.name?.fr,
          quantity: ingQty,
          unitPrice,
          totalPrice: ingTotalPrice,
          iconId: ingItem?.iconId || ingId,
        });

        // Consolidate materials if item will be crafted (not excluded dofus/trophy)
        const isExcluded =
          (isDofus && excludeDofus) || (isTrophy && excludeTrophies);
        if (!isExcluded) {
          const existing = consolidatedIngredientsMap.get(ingId);
          if (existing) {
            existing.totalQuantityRequired += ingQty;
            existing.totalPrice = existing.totalQuantityRequired * existing.unitPrice;
          } else {
            consolidatedIngredientsMap.set(ingId, {
              itemId: ingId,
              item: ingItem || undefined,
              totalQuantityRequired: ingQty,
              unitPrice,
              totalPrice: ingTotalPrice,
              isChecked: false,
            });
          }
        }
      }
    }

    const marketPrice = itemId > 0 ? pricesMap[itemId] || 0 : 0;

    // Determine cheaper option & savings
    let cheaperOption:
      | "craft"
      | "buy"
      | "equal"
      | "no_recipe"
      | "dofus_excluded" = "no_recipe";
    let savings = 0;

    if (isDofus && excludeDofus) {
      cheaperOption = "dofus_excluded";
      excludedDofusCount++;
    } else if (isTrophy && excludeTrophies) {
      cheaperOption = "no_recipe";
      excludedTrophiesCount++;
    } else {
      if (isCraftable) craftablePiecesCount++;

      if (isCraftable && craftCost > 0 && marketPrice > 0) {
        if (craftCost < marketPrice) {
          cheaperOption = "craft";
          savings = marketPrice - craftCost;
        } else if (marketPrice < craftCost) {
          cheaperOption = "buy";
          savings = craftCost - marketPrice;
        } else {
          cheaperOption = "equal";
          savings = 0;
        }
      } else if (isCraftable && craftCost > 0) {
        cheaperOption = "craft";
      } else if (marketPrice > 0) {
        cheaperOption = "buy";
      } else {
        cheaperOption = isCraftable ? "craft" : "no_recipe";
      }

      // Add to totals
      if (craftCost > 0) {
        totalCraftCost += craftCost;
      } else if (marketPrice > 0) {
        totalCraftCost += marketPrice;
      }

      if (marketPrice > 0) {
        totalMarketPrice += marketPrice;
      } else if (craftCost > 0) {
        totalMarketPrice += craftCost;
      }

      const optimalPieceCost =
        craftCost > 0 && marketPrice > 0
          ? Math.min(craftCost, marketPrice)
          : craftCost > 0
          ? craftCost
          : marketPrice;

      totalOptimalCost += optimalPieceCost;
    }

    analyzedItems.push({
      id: itemId,
      slotName,
      rawName: raw.rawName,
      item,
      recipe,
      craftCost,
      marketPrice,
      isDofus,
      isTrophy,
      isPrysmaradite,
      isCraftable,
      cheaperOption,
      savings,
      missingIngredientsCount,
      ingredientsBreakdown,
      userChoice: cheaperOption === "buy" ? "buy" : "craft",
    });
  }

  const totalSavings = Math.max(
    0,
    Math.max(totalCraftCost, totalMarketPrice) - totalOptimalCost
  );

  const consolidatedIngredients = Array.from(
    consolidatedIngredientsMap.values()
  ).sort((a, b) => (b.totalPrice || 0) - (a.totalPrice || 0));

  return {
    url: targetUrl,
    resolvedUrl,
    buildName,
    buildLevel,
    items: analyzedItems,
    totals: {
      totalCraftCost,
      totalMarketPrice,
      totalOptimalCost,
      totalSavings,
      craftablePiecesCount,
      excludedDofusCount,
      excludedTrophiesCount,
      totalPieces: analyzedItems.length,
    },
    consolidatedIngredients,
  };
}


