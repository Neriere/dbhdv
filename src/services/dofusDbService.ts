import {
  BankInventoryItem,
  ConsolidatedIngredient,
  DofusbookBuildAnalysis,
  DofusEffect,
  DofusItem,
  DofusRecipe,
  DofusTheme,
  MarketPriceMap,
  PriceHistoryEntry,
  ItemPriceHistorySummary,
  PriceProfile,
  PriceUpdatedAtMap,
  RecipeTreeNode,
  ReverseCraftAnalysis,
  ReverseCraftIngredientStatus,
  ShoppingListItem,
  SyncSettings,
  SyncStatus,
} from "../types";
import {
  isClassItem,
  isCrushableJob,
  isOmittedItem,
  isCosmeticItem,
  isPetItem,
  isDofusItem,
  getJobForItem,
  DOFUS_JOBS,
} from "../data/dofusJobs";
import {
  PRESET_CRAFTABLE_ITEMS,
  DEFAULT_INGREDIENT_PRICES,
  PresetCraftableItem,
} from "../data/presetCraftableItems";
import { CRAFTABLE_RUNES } from "../data/craftableRunesData";
import {
  BASE_RUNES_BY_ID,
  DOFUS_BASE_RUNES,
  extractItemStats,
  calculateItemCrushing,
  saveItemCoefficient,
  bulkSaveItemCoefficients,
  getAllSavedItemCoefficients,
  getAllSavedItemCoefficientTimestamps,
  resolveServerSlug,
} from "../data/dofusRuneWeights";

const ALL_PRESET_ITEMS: PresetCraftableItem[] = [
  ...PRESET_CRAFTABLE_ITEMS,
  ...CRAFTABLE_RUNES,
];

const LOCAL_DB_API_BASE = "/api/local-db";
const CACHE_KEY = "dofus_database_cache_v5";
const CACHE_TIMESTAMP_KEY = "dofus_database_cache_timestamp_v5";

// IndexedDB lightweight storage for instant startup
const IDB_NAME = "DofusDB_ClientCache";
const IDB_STORE = "keyval";

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB not supported"));
      return;
    }
    const request = window.indexedDB.open(IDB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getIdbVal<T>(key: string): Promise<T | null> {
  try {
    const db = await openIdb();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function setIdbVal(key: string, value: unknown): Promise<void> {
  try {
    const db = await openIdb();
    new Promise<void>((resolve) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      const store = tx.objectStore(IDB_STORE);
      store.put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Ignore IDB write errors
  }
}

const DEFAULT_SYNC_STATUS: SyncStatus = {
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

const DEFAULT_SYNC_SETTINGS: SyncSettings = {
  enabled: true,
  intervalDays: 30,
};

const TYPE_NAME_MAP: Record<number, string> = {
  1: "Amuleto",
  2: "Arco",
  3: "Varita",
  4: "Baston",
  5: "Daga",
  6: "Espada",
  7: "Martillo",
  8: "Pala",
  9: "Anillo",
  10: "Cinturon",
  11: "Bota",
  12: "Pocima",
  16: "Sombrero",
  17: "Capa",
  18: "Mascota",
  19: "Hacha",
  23: "Dofus",
  33: "Pan",
  34: "Cereal",
  35: "Flor",
  36: "Planta",
  38: "Madera",
  39: "Mineral",
  40: "Aleacion",
  41: "Pescado",
  47: "Hueso",
  48: "Polvo",
  49: "Pescado comestible",
  50: "Piedra preciosa",
  51: "Piedra bruta",
  53: "Pluma",
  54: "Pelo",
  55: "Tejido",
  56: "Cuero",
  57: "Lana",
  58: "Semilla",
  59: "Piel",
  60: "Aceite",
  63: "Carne",
  66: "Metaria",
  68: "Legumbre",
  69: "Carne comestible",
  70: "Tinte",
  71: "Material de alquimia",
  78: "Runa",
  79: "Bebida",
  82: "Escudo",
  83: "Piedra de alma",
  84: "Llave",
  95: "Tabla",
  96: "Corteza",
  98: "Raiz",
  103: "Pata",
  104: "Ala",
  105: "Huevo",
  106: "Oreja",
  107: "Caparazon",
  108: "Brote",
  109: "Ojo",
  110: "Gelatina",
  111: "Cascara",
  150: "Carne preparada",
  167: "Esencia",
  183: "Concentrado",
  185: "Sustrato",
  219: "Consumible",
  271: "Trofeo",
  307: "Piedra de alma",
  308: "Piedra de alma",
};

export const CATEGORY_TYPE_IDS_MAP: Record<string, number[]> = {
  campesino: [34, 33, 37, 58, 60, 68, 46, 28, 128, 129],
  lenador: [38, 95, 96, 98, 183, 185, 242, 12, 170],
  alquimista: [12, 26, 35, 36, 70, 71, 79, 179, 183, 206, 228, 167, 62],
  minero: [39, 40, 50, 51, 83, 85, 307, 308, 167, 153, 66, 91],
  pescador: [41, 49, 134, 135, 64],
  cazador: [63, 69, 187, 56, 59, 150],
  ganadero: [99, 323, 326, 327],
  fabricante: [82, 188, 271, 112, 217],
  monsters: [
    47, 48, 53, 54, 55, 56, 57, 59, 103, 104, 105, 106, 107, 108, 109, 110, 111,
    119, 15, 74, 96, 98, 152, 219, 229, 278,
  ],
  equipment: [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 16, 17, 19, 82, 112, 151, 217, 271,
  ],
  craft_ingredients: [
    12, 15, 26, 28, 33, 34, 35, 36, 37, 38, 39, 40, 41, 46, 47, 48, 49, 50, 51,
    53, 54, 55, 56, 57, 58, 59, 60, 62, 63, 64, 66, 68, 69, 70, 71, 79, 83, 85,
    91, 95, 96, 98, 103, 104, 105, 106, 107, 108, 109, 110, 111, 119, 128, 129,
    134, 135, 150, 152, 153, 167, 170, 179, 183, 185, 187, 206, 219, 228, 229,
    242, 278, 307, 308,
  ],
};

type BootstrapResponse = {
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
  databasePath: string;
};

export interface CraftableItem extends DofusItem {
  jobId: number;
  jobNameEs: string;
  defaultMarketSalePrice?: number;
  recipeData?: DofusRecipe;
}

let itemsMemoryCache: DofusItem[] = [];
let recipesMemoryCache: Record<number, DofusRecipe> = {};
let pricesMemoryCache: MarketPriceMap = {};
let priceUpdatedAtMemoryCache: PriceUpdatedAtMap = {};
let coefficientsMemoryCache: Record<number, number> = {};
let coefficientUpdatedAtMemoryCache: Record<number, number> = {};
let syncStatusMemoryCache: SyncStatus = { ...DEFAULT_SYNC_STATUS };
let syncSettingsMemoryCache: SyncSettings = { ...DEFAULT_SYNC_SETTINGS };
let priceProfilesMemoryCache: PriceProfile[] = [];
let activePriceProfileIdMemoryCache = 0;
let isDbInitialized = false;
let bootstrapPromise: Promise<BootstrapResponse> | null = null;

// Pre-computed and cached snapshots for ultra-fast UI rendering
let cachedCraftableSnapshot: CraftableItem[] | null = null;
let cachedCrushableSnapshot: CraftableItem[] | null = null;
let ingredientToRecipesIndex: Map<number, Set<number>> = new Map();
let recipeTreeMapCache: Map<string, RecipeTreeNode> = new Map();

function emitDatabaseUpdated(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("dofus_database_updated"));
  }
}

function mergePresetData(
  items: DofusItem[],
  recipes: Record<number, DofusRecipe>,
): { items: DofusItem[]; recipes: Record<number, DofusRecipe> } {
  const itemMap = new Map<number, DofusItem>();
  items.forEach((item) => itemMap.set(item.id, item));

  const mergedRecipes: Record<number, DofusRecipe> = { ...recipes };
  for (const preset of ALL_PRESET_ITEMS) {
    const itemWithFlag = {
      ...preset,
      hasRecipe: true,
    };
    if (!itemMap.has(preset.id)) {
      itemMap.set(preset.id, itemWithFlag);
    }
    if (preset.recipeData && !mergedRecipes[preset.recipeData.resultId]) {
      mergedRecipes[preset.recipeData.resultId] = preset.recipeData;
    }
  }

  const allItems = Array.from(itemMap.values()).map((item) => {
    if (item.hasRecipe === undefined) {
      return {
        ...item,
        hasRecipe: Boolean(mergedRecipes[item.id]),
      };
    }
    return item;
  });

  return { items: allItems, recipes: mergedRecipes };
}

function rebuildIngredientReverseIndex(): void {
  const newIndex = new Map<number, Set<number>>();
  for (const [resultIdStr, recipe] of Object.entries(recipesMemoryCache)) {
    const resultId = Number(resultIdStr);
    if (!resultId || !recipe?.ingredientIds) continue;
    for (const ingId of recipe.ingredientIds) {
      if (!ingId) continue;
      let set = newIndex.get(ingId);
      if (!set) {
        set = new Set<number>();
        newIndex.set(ingId, set);
      }
      set.add(resultId);
    }
  }
  ingredientToRecipesIndex = newIndex;
}

function invalidateDerivedCaches(): void {
  cachedCraftableSnapshot = null;
  cachedCrushableSnapshot = null;
  recipeTreeMapCache.clear();
  rebuildIngredientReverseIndex();
}

function updateMemoryCache(payload: {
  items?: DofusItem[];
  recipes?: Record<number, DofusRecipe>;
  prices?: MarketPriceMap;
  priceUpdatedAt?: PriceUpdatedAtMap;
  syncStatus?: SyncStatus;
  syncSettings?: SyncSettings;
  priceProfiles?: PriceProfile[];
  activePriceProfileId?: number;
  coefficients?: Record<number, number>;
  coefficientUpdatedAt?: Record<number, number>;
}): void {
  let changedStructure = false;
  if (payload.items || payload.recipes) {
    const existingItemsMap = new Map<number, DofusItem>();
    if (payload.items && payload.items.length > 100) {
      payload.items.forEach((item) => existingItemsMap.set(item.id, item));
    } else {
      itemsMemoryCache.forEach((item) => existingItemsMap.set(item.id, item));
      if (payload.items) {
        payload.items.forEach((item) => existingItemsMap.set(item.id, item));
      }
    }
    const combinedItems = Array.from(existingItemsMap.values());
    const combinedRecipes =
      payload.recipes && Object.keys(payload.recipes).length > 100
        ? payload.recipes
        : {
            ...recipesMemoryCache,
            ...(payload.recipes || {}),
          };

    const merged = mergePresetData(combinedItems, combinedRecipes);
    itemsMemoryCache = merged.items.filter((item) => !isOmittedItem(item));
    recipesMemoryCache = merged.recipes;
    changedStructure = true;
  }

  if (payload.prices) {
    pricesMemoryCache = payload.prices;
  }

  if (payload.priceUpdatedAt) {
    priceUpdatedAtMemoryCache = payload.priceUpdatedAt;
  }

  if (payload.syncStatus) {
    syncStatusMemoryCache = payload.syncStatus;
  }

  if (payload.syncSettings) {
    syncSettingsMemoryCache = payload.syncSettings;
  }

  if (payload.priceProfiles) {
    priceProfilesMemoryCache = payload.priceProfiles;
  }

  if (typeof payload.activePriceProfileId === "number") {
    activePriceProfileIdMemoryCache = payload.activePriceProfileId;
  }

  if (payload.coefficients) {
    coefficientsMemoryCache = payload.coefficients;
  }

  if (payload.coefficientUpdatedAt) {
    coefficientUpdatedAtMemoryCache = payload.coefficientUpdatedAt;
  }

  if (typeof window !== "undefined") {
    const activeProfile =
      priceProfilesMemoryCache.find((p) => p.id === activePriceProfileIdMemoryCache) ||
      priceProfilesMemoryCache[0];
    if (activeProfile?.slug) {
      localStorage.setItem("selected_dofus_price_profile_slug", activeProfile.slug);
      localStorage.setItem("selected_dofus_price_profile_id", String(activeProfile.id));

      if (payload.coefficients && Object.keys(payload.coefficients).length > 0) {
        localStorage.setItem(
          `dofus_user_item_coefficients_${activeProfile.slug}`,
          JSON.stringify(payload.coefficients)
        );
      }
      if (payload.coefficientUpdatedAt && Object.keys(payload.coefficientUpdatedAt).length > 0) {
        localStorage.setItem(
          `dofus_user_item_coeff_timestamps_${activeProfile.slug}`,
          JSON.stringify(payload.coefficientUpdatedAt)
        );
      }
    }
  }

  if (changedStructure) {
    invalidateDerivedCaches();
  }

  isDbInitialized = true;

  if (typeof window !== "undefined") {
    void setIdbVal(CACHE_KEY, {
      items: itemsMemoryCache,
      recipes: recipesMemoryCache,
      prices: pricesMemoryCache,
      priceUpdatedAt: priceUpdatedAtMemoryCache,
      syncStatus: syncStatusMemoryCache,
      syncSettings: syncSettingsMemoryCache,
      priceProfiles: priceProfilesMemoryCache,
      activePriceProfileId: activePriceProfileIdMemoryCache,
    });
  }

  emitDatabaseUpdated();
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const isPostOrPut = init?.method === "POST" || init?.method === "PUT";
  const response = await fetch(url, {
    headers: {
      ...(isPostOrPut ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const errorText = await response.text();
    let message = errorText || `HTTP ${response.status}`;
    try {
      const parsed = JSON.parse(errorText);
      if (parsed.error) message = parsed.error;
    } catch {
      // not JSON
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

async function executeBootstrapFetch(): Promise<BootstrapResponse> {
  let profileQuery = "";
  if (typeof window !== "undefined") {
    const savedProfileId = localStorage.getItem("selected_dofus_price_profile_id");
    if (savedProfileId && Number(savedProfileId) > 0) {
      profileQuery = `?profileId=${savedProfileId}`;
    }
  }

  const bootstrap = await requestJson<BootstrapResponse>(
    `${LOCAL_DB_API_BASE}/bootstrap${profileQuery}`,
  );

  updateMemoryCache({
    items: bootstrap.items,
    recipes: bootstrap.recipes,
    prices: bootstrap.prices,
    priceUpdatedAt: bootstrap.priceUpdatedAt,
    syncStatus: bootstrap.syncStatus,
    syncSettings: bootstrap.syncSettings,
    priceProfiles: bootstrap.priceProfiles,
    activePriceProfileId: bootstrap.activePriceProfileId,
  });

  if (typeof window !== "undefined") {
    void setIdbVal(CACHE_KEY, bootstrap);
  }

  return bootstrap;
}

export async function initializeDatabase(): Promise<{
  items: DofusItem[];
  recipes: Record<number, DofusRecipe>;
}> {
  if (isDbInitialized && itemsMemoryCache.length > 50) {
    return {
      items: itemsMemoryCache,
      recipes: recipesMemoryCache,
    };
  }

  // Stale-While-Revalidate: Try loading instantly from IndexedDB cache first
  if (typeof window !== "undefined") {
    try {
      const cachedBootstrap = await getIdbVal<BootstrapResponse>(CACHE_KEY);
      if (
        cachedBootstrap &&
        cachedBootstrap.items &&
        cachedBootstrap.items.length > 50 &&
        cachedBootstrap.recipes
      ) {
        updateMemoryCache({
          items: cachedBootstrap.items,
          recipes: cachedBootstrap.recipes,
          prices: cachedBootstrap.prices,
          priceUpdatedAt: cachedBootstrap.priceUpdatedAt,
          syncStatus: cachedBootstrap.syncStatus,
          syncSettings: cachedBootstrap.syncSettings,
          priceProfiles: cachedBootstrap.priceProfiles,
          activePriceProfileId: cachedBootstrap.activePriceProfileId,
        });

        // Background update check
        void fetchBootstrapInBackground();

        return {
          items: itemsMemoryCache,
          recipes: recipesMemoryCache,
        };
      }
    } catch (e) {
      console.warn("Error al leer la caché IndexedDB:", e);
    }
  }

  return await fetchBootstrapInBackground();
}

async function fetchBootstrapInBackground(): Promise<{
  items: DofusItem[];
  recipes: Record<number, DofusRecipe>;
}> {
  if (!bootstrapPromise) {
    bootstrapPromise = executeBootstrapFetch().finally(() => {
      bootstrapPromise = null;
    });
  }

  try {
    await bootstrapPromise;
  } catch (err) {
    console.warn("Falló la carga de bootstrap en segundo plano:", err);
  }

  return {
    items: itemsMemoryCache,
    recipes: recipesMemoryCache,
  };
}

export function getStoredRecipes(): Record<number, DofusRecipe> {
  if (!isDbInitialized) {
    void initializeDatabase();
  }
  return recipesMemoryCache;
}

export const KNOWN_SPECIAL_INGREDIENTS: Record<number, Partial<DofusItem>> = {
  17994: {
    id: 17994,
    name: { es: "Lapa", fr: "Bernique", en: "Limpet" },
    iconId: 179940,
    level: 200,
    typeId: 41,
    type: {
      id: 41,
      superCategoryId: 9,
      name: { es: "Pescado", fr: "Poisson", en: "Fish" },
    },
  },
  10057: {
    id: 10057,
    name: { es: "Runa de caza", fr: "Rune de chasse", en: "Hunting Rune" },
    iconId: 78059,
    level: 10,
    typeId: 78,
    type: {
      id: 78,
      superCategoryId: 0,
      name: { es: "Runa", fr: "Rune", en: "Rune" },
    },
  },
  // Runas oficiales de Trampa (Dofus Unity)
  7447: {
    id: 7447,
    name: { es: "Runa Por Tram", fr: "Rune Per Pi", en: "Trp Per Rune" },
    iconId: 78024,
    level: 15,
    typeId: 78,
    type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
  },
  10615: {
    id: 10615,
    name: { es: "Runa Bu Por Tram", fr: "Rune Pa Per Pi", en: "Pa Trp Per Rune" },
    iconId: 78266,
    level: 20,
    typeId: 78,
    type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
  },
  10616: {
    id: 10616,
    name: { es: "Runa Su Por Tram", fr: "Rune Ra Per Pi", en: "Ra Trp Per Rune" },
    iconId: 78267,
    level: 25,
    typeId: 78,
    type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
  },
  7446: {
    id: 7446,
    name: { es: "Runa Da Tram", fr: "Rune Do Pi", en: "Trp Dam Rune" },
    iconId: 78268,
    level: 40,
    typeId: 78,
    type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
  },
  10613: {
    id: 10613,
    name: { es: "Runa Bu Da Tram", fr: "Rune Pa Do Pi", en: "Pa Trp Dam Rune" },
    iconId: 78023,
    level: 45,
    typeId: 78,
    type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
  },
  // Runas de Pods
  7443: {
    id: 7443,
    name: { es: "Runa Pod", fr: "Rune Pod", en: "Pod Rune" },
    iconId: 78020,
    level: 1,
    typeId: 78,
    type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
  },
  7444: {
    id: 7444,
    name: { es: "Runa Bu Pod", fr: "Rune Pa Pod", en: "Pa Pod Rune" },
    iconId: 78021,
    level: 5,
    typeId: 78,
    type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
  },
  7445: {
    id: 7445,
    name: { es: "Runa Su Pod", fr: "Rune Ra Pod", en: "Ra Pod Rune" },
    iconId: 78022,
    level: 10,
    typeId: 78,
    type: { id: 78, superCategoryId: 0, name: { es: "Runa", fr: "Rune", en: "Rune" } },
  },
  18001: {
    id: 18001,
    name: { es: "Esquíritu inferior", fr: "Éklâme inférieure", en: "Lesser Soul Shard" },
    iconId: 18001,
    level: 50,
    typeId: 51,
    type: { id: 51, superCategoryId: 0, name: { es: "Piedra bruta", fr: "Pierre brute", en: "Raw Stone" } },
  },
  18003: {
    id: 18003,
    name: { es: "Esquíritu común", fr: "Éklâme commune", en: "Common Soul Shard" },
    iconId: 18003,
    level: 100,
    typeId: 51,
    type: { id: 51, superCategoryId: 0, name: { es: "Piedra bruta", fr: "Pierre brute", en: "Raw Stone" } },
  },
  18005: {
    id: 18005,
    name: { es: "Esquíritu superior", fr: "Éklâme supérieure", en: "Greater Soul Shard" },
    iconId: 18005,
    level: 150,
    typeId: 51,
    type: { id: 51, superCategoryId: 0, name: { es: "Piedra bruta", fr: "Pierre brute", en: "Raw Stone" } },
  },
  18007: {
    id: 18007,
    name: { es: "Esquíritu majestuoso", fr: "Éklâme majestueuse", en: "Majestic Soul Shard" },
    iconId: 18007,
    level: 190,
    typeId: 51,
    type: { id: 51, superCategoryId: 0, name: { es: "Piedra bruta", fr: "Pierre brute", en: "Raw Stone" } },
  },
  18009: {
    id: 18009,
    name: { es: "Esquíritu supremo", fr: "Éklâme suprême", en: "Supreme Soul Shard" },
    iconId: 18009,
    level: 200,
    typeId: 51,
    type: { id: 51, superCategoryId: 0, name: { es: "Piedra bruta", fr: "Pierre brute", en: "Raw Stone" } },
  },
  12739: {
    id: 12739,
    name: { es: "Guijarro carmesí", fr: "Galet cramoisi", en: "Crimson Pebble" },
    iconId: 12739,
    level: 100,
    typeId: 51,
    type: { id: 51, superCategoryId: 0, name: { es: "Guijarro", fr: "Galet", en: "Pebble" } },
  },
  757: {
    id: 757,
    name: { es: "Poción mineral", fr: "Potion minérale", en: "Mineral Potion" },
    iconId: 757,
    level: 20,
    typeId: 12,
    type: { id: 12, superCategoryId: 0, name: { es: "Poción", fr: "Potion", en: "Potion" } },
  },
  7035: {
    id: 7035,
    name: { es: "Fragmento de piedra pulida", fr: "Fragment de pierre polie", en: "Polished Stone Fragment" },
    iconId: 7035,
    level: 50,
    typeId: 51,
    type: { id: 51, superCategoryId: 0, name: { es: "Piedra bruta", fr: "Pierre brute", en: "Raw Stone" } },
  },
  14659: {
    id: 14659,
    name: { es: "Poción de alteración", fr: "Potion d'altération", en: "Alteration Potion" },
    iconId: 14659,
    level: 150,
    typeId: 12,
    type: { id: 12, superCategoryId: 0, name: { es: "Poción", fr: "Potion", en: "Potion" } },
  },
  14660: {
    id: 14660,
    name: { es: "Poción de metal precioso líquido", fr: "Potion de métal précieux liquide", en: "Liquid Precious Metal Potion" },
    iconId: 14660,
    level: 180,
    typeId: 12,
    type: { id: 12, superCategoryId: 0, name: { es: "Poción", fr: "Potion", en: "Potion" } },
  },
  // Map fragments lookup
  ...(() => {
    const mapsData = [
      { baseId: 15264, name: "Vil Sombra", fr: "d'Ombre", en: "Shadow", lvl: 200 },
      { baseId: 15273, name: "Gein", fr: "de Gein", en: "Gein", lvl: 200 },
      { baseId: 15282, name: "Kanígrula", fr: "de Canigroula", en: "Canigroula", lvl: 160 },
      { baseId: 15291, name: "Brumen Tinctorias", fr: "de Brumen Tinctorias", en: "Brumen Tinctorias", lvl: 70 },
      { baseId: 15300, name: "Dremoan", fr: "de Dremoan", en: "Dremoan", lvl: 120 },
      { baseId: 15309, name: "Ali Grofa", fr: "d'Ali Grofa", en: "Ali Grofa", lvl: 140 },
      { baseId: 15318, name: "Panterrosa", fr: "de Panterrose", en: "Panterrose", lvl: 100 },
      { baseId: 15327, name: "Hiperescampo", fr: "de l'Hyperscampe", en: "Hyperscampe", lvl: 130 },
      { baseId: 15336, name: "Musha el Maldito", fr: "de Musha le Maudit", en: "Musha the Cursed", lvl: 160 },
      { baseId: 15345, name: "Marranárgico", fr: "de Porsalu", en: "Porsalu", lvl: 110 },
      { baseId: 15354, name: "Rok Gintok", fr: "de Rok Gintok", en: "Rok Gintok", lvl: 180 },
      { baseId: 15363, name: "Zatoïshwan", fr: "de Zatoïshwan", en: "Zatoïshwan", lvl: 150 },
    ];
    const res: Record<number, DofusItem> = {};
    for (const m of mapsData) {
      for (let i = 0; i < 8; i++) {
        const fragId = m.baseId + i;
        res[fragId] = {
          id: fragId,
          name: {
            es: `Fragmento de mapa de ${m.name} [${i + 1}/8]`,
            fr: `Fragment de carte ${m.fr} [${i + 1}/8]`,
            en: `${m.en} Map Fragment [${i + 1}/8]`,
          },
          iconId: 77042,
          level: m.lvl,
          typeId: 175,
          type: { id: 175, superCategoryId: 0, name: { es: "Fragmento de mapa", fr: "Fragment de carte", en: "Map fragment" } },
        };
      }
    }
    // Tablette de Totankama & pieces
    res[15391] = {
      id: 15391,
      name: { es: "Tabla de Totankama", fr: "Tablette de Totankama", en: "Totankama Tablet" },
      iconId: 126026,
      level: 130,
      typeId: 174,
      type: { id: 174, superCategoryId: 0, name: { es: "Tabla", fr: "Tablette", en: "Tablet" } },
    };
    for (let i = 1; i <= 5; i++) {
      const pieceId = 15393 + i;
      res[pieceId] = {
        id: pieceId,
        name: {
          es: `Trozo de la tabla de Totankama ${i}/5`,
          fr: `Morceau de tablette de Totankama ${i}/5`,
          en: `Piece of Totankama Tablet ${i}/5`,
        },
        iconId: 126027,
        level: 130,
        typeId: 175,
        type: { id: 175, superCategoryId: 0, name: { es: "Trozo de tabla", fr: "Morceau de tablette", en: "Tablet piece" } },
      };
    }
    return res;
  })(),
};

export function getItemName(item: unknown): string {
  if (!item || typeof item !== "object") {
    return "Objeto sin nombre";
  }

  const typedItem = item as {
    id?: number;
    title?: string;
    name?: string | { es?: string; fr?: string; en?: string };
  };

  if (typedItem.id && KNOWN_SPECIAL_INGREDIENTS[typedItem.id]) {
    const known = KNOWN_SPECIAL_INGREDIENTS[typedItem.id];
    if (
      !typedItem.name ||
      (typeof typedItem.name === "object" &&
        (!typedItem.name.es || typedItem.name.es.startsWith("Objeto #") || typedItem.name.es.startsWith("Ingrediente #"))) ||
      (typeof typedItem.name === "string" &&
        (typedItem.name.startsWith("Objeto #") || typedItem.name.startsWith("Ingrediente #")))
    ) {
      return (
        (typeof known.name === "object" ? known.name?.es : (known.name as string)) ||
        `Objeto #${typedItem.id}`
      );
    }
  }

  if (typeof typedItem.name === "string") {
    return typedItem.name;
  }

  if (typedItem.name && typeof typedItem.name === "object") {
    return (
      typedItem.name.es ||
      typedItem.name.fr ||
      typedItem.name.en ||
      `Objeto #${typedItem.id || ""}`
    );
  }

  if (typeof typedItem.title === "string") {
    return typedItem.title;
  }

  return `Objeto #${typedItem.id || ""}`;
}

export function getItemTypeName(item: unknown): string {
  if (!item || typeof item !== "object") {
    return "";
  }

  const typedItem = item as {
    typeId?: number;
    type?: {
      id?: number;
      name?: string | { es?: string; fr?: string; en?: string };
    };
  };

  if (typedItem.type?.name) {
    if (typeof typedItem.type.name === "string") {
      return typedItem.type.name;
    }
    return (
      typedItem.type.name.es ||
      typedItem.type.name.fr ||
      typedItem.type.name.en ||
      ""
    );
  }

  const typeId = typedItem.typeId || typedItem.type?.id;
  if (typeId && TYPE_NAME_MAP[typeId]) {
    return TYPE_NAME_MAP[typeId];
  }

  return "";
}

export function getItemIconUrl(item: unknown): string {
  if (typeof item === "number") {
    if (KNOWN_SPECIAL_INGREDIENTS[item]?.iconId) {
      const known = KNOWN_SPECIAL_INGREDIENTS[item]!;
      const name = (typeof known.name === "string" ? known.name : known.name?.es || "").toLowerCase();
      if (
        name.includes("fragmento de mapa") ||
        name.includes("fragment de carte") ||
        name.includes("map fragment") ||
        known.typeId === 175
      ) {
        return "https://api.dofusdb.fr/img/items/77042.png";
      }
      if (name.startsWith("mapa de") || name.startsWith("mapa del") || known.typeId === 174) {
        return "https://api.dofusdb.fr/img/items/77041.png";
      }
      return `https://api.dofusdb.fr/img/items/${known.iconId}.png`;
    }

    const found = itemsMemoryCache.find((i) => i.id === item);
    if (found) {
      const name = (typeof found.name === "string" ? found.name : found.name?.es || "").toLowerCase();
      const typeId = found.typeId || found.type?.id;
      if (
        name.includes("fragmento de mapa") ||
        name.includes("fragment de carte") ||
        name.includes("map fragment") ||
        typeId === 175
      ) {
        return "https://api.dofusdb.fr/img/items/77042.png";
      }
      if (name.startsWith("mapa de") || name.startsWith("mapa del") || name.startsWith("tarjeta de") || (typeId === 174 && !name.includes("tabla"))) {
        return "https://api.dofusdb.fr/img/items/77041.png";
      }
      const iconId = found.iconId || (found as any).icon_id || item;
      return `https://api.dofusdb.fr/img/items/${iconId}.png`;
    }

    return `https://api.dofusdb.fr/img/items/${item}.png`;
  }

  if (!item || typeof item !== "object") {
    return "https://api.dofusdb.fr/img/items/0.png";
  }

  const typed = item as {
    iconId?: number;
    icon_id?: number;
    id?: number;
    typeId?: number;
    type?: { id?: number };
    name?: string | { es?: string; fr?: string; en?: string };
    img?: string;
  };

  const nameStr = (
    typeof typed.name === "string" ? typed.name : typed.name?.es || ""
  ).toLowerCase();
  const itemTypeId = typed.typeId || typed.type?.id;

  if (
    nameStr.includes("fragmento de mapa") ||
    nameStr.includes("fragment de carte") ||
    nameStr.includes("map fragment") ||
    (itemTypeId === 175 && !nameStr.includes("tabla"))
  ) {
    return "https://api.dofusdb.fr/img/items/77042.png";
  }
  if (
    nameStr.startsWith("mapa de") ||
    nameStr.startsWith("mapa del") ||
    nameStr.startsWith("tarjeta de") ||
    nameStr.startsWith("carte du") ||
    nameStr.startsWith("carte d'") ||
    (itemTypeId === 174 && !nameStr.includes("tabla"))
  ) {
    return "https://api.dofusdb.fr/img/items/77041.png";
  }

  if (typeof typed.img === "string" && typed.img.startsWith("http")) {
    return typed.img;
  }

  let iconId = typed.iconId || typed.icon_id;
  if (!iconId && typed.id && KNOWN_SPECIAL_INGREDIENTS[typed.id]?.iconId) {
    iconId = KNOWN_SPECIAL_INGREDIENTS[typed.id]!.iconId;
  }

  if (!iconId && typed.id && itemsMemoryCache.length > 0) {
    const found = itemsMemoryCache.find((i) => i.id === typed.id);
    if (found) {
      iconId = found.iconId || (found as any).icon_id;
    }
  }

  if (!iconId) {
    iconId = typed.id || 0;
  }

  return `https://api.dofusdb.fr/img/items/${iconId}.png`;
}

export function getItemFallbackIconUrl(item: unknown): string {
  if (!item || typeof item !== "object") {
    return "https://api.dofusdb.fr/img/items/0.png";
  }

  const typed = item as {
    id?: number;
    iconId?: number;
    icon_id?: number;
    name?: string | { es?: string; fr?: string; en?: string };
  };
  const nameStr =
    typeof typed.name === "string" ? typed.name : typed.name?.es || "";
  if (nameStr.toLowerCase().startsWith("fragmento de mapa")) {
    return `https://api.dofusdb.fr/img/items/15309.png`;
  }
  if (
    nameStr.toLowerCase().startsWith("mapa de ") ||
    nameStr.toLowerCase().startsWith("mapa del ")
  ) {
    return `https://api.dofusdb.fr/img/items/15308.png`;
  }

  let iconId = typed.iconId || typed.icon_id;
  if (!iconId && typed.id && KNOWN_SPECIAL_INGREDIENTS[typed.id]?.iconId) {
    iconId = KNOWN_SPECIAL_INGREDIENTS[typed.id]!.iconId;
  }

  if (!iconId && typed.id && itemsMemoryCache.length > 0) {
    const found = itemsMemoryCache.find((i) => i.id === typed.id);
    if (found) {
      iconId = found.iconId || (found as any).icon_id;
    }
  }

  const finalId = typed.id || iconId || 0;
  return `https://api.dofusdb.fr/img/items/${finalId}.png`;
}

/**
 * Computes the lowest detected unit price for an ingredient/item (either direct buy price
 * or subcraft cost if craftable). Does not output sub-trees or UI labels, only pure lowest price.
 */
export function calculateSubCraftCost(
  itemId: number,
  marketPrices: MarketPriceMap = getStoredMarketPrices(),
  recipes: Record<number, DofusRecipe> = getStoredRecipes(),
  visited: Set<number> = new Set(),
): number {
  if (visited.has(itemId)) {
    return marketPrices[itemId] || 0;
  }

  const recipe = recipes[itemId];
  if (!recipe || !recipe.ingredientIds || recipe.ingredientIds.length === 0) {
    return 0;
  }

  visited.add(itemId);
  let subCraftCost = 0;
  let hasCalculableCost = false;

  for (let i = 0; i < recipe.ingredientIds.length; i++) {
    const ingId = recipe.ingredientIds[i];
    const qty = recipe.quantities?.[i] || 1;
    const directPrice = marketPrices[ingId] || 0;
    const childCraftCost = calculateSubCraftCost(
      ingId,
      marketPrices,
      recipes,
      new Set(visited),
    );

    let bestPrice = directPrice;
    if (childCraftCost > 0 && directPrice > 0) {
      bestPrice = Math.min(directPrice, childCraftCost);
    } else if (childCraftCost > 0) {
      bestPrice = childCraftCost;
    }

    if (bestPrice > 0) {
      hasCalculableCost = true;
      subCraftCost += bestPrice * qty;
    }
  }

  return hasCalculableCost && subCraftCost > 0 ? subCraftCost : 0;
}

export function getLowestDetectedPrice(
  itemId: number,
  marketPrices: MarketPriceMap = getStoredMarketPrices(),
  recipes: Record<number, DofusRecipe> = getStoredRecipes(),
  visited: Set<number> = new Set()
): number {
  const directBuyPrice = marketPrices[itemId] || 0;
  if (visited.has(itemId)) {
    return directBuyPrice;
  }

  const recipe = recipes[itemId];
  if (!recipe || !recipe.ingredientIds || recipe.ingredientIds.length === 0) {
    return directBuyPrice;
  }

  visited.add(itemId);
  const subCraftCost = calculateSubCraftCost(
    itemId,
    marketPrices,
    recipes,
    new Set(visited),
  );

  if (directBuyPrice > 0 && subCraftCost > 0) {
    return Math.min(directBuyPrice, subCraftCost);
  }
  if (subCraftCost > 0) {
    return subCraftCost;
  }
  return directBuyPrice;
}

export function getImportedItems(): DofusItem[] {
  if (!isDbInitialized) {
    void initializeDatabase();
  }
  return itemsMemoryCache;
}

export function getStoredMarketPrices(): MarketPriceMap {
  if (!isDbInitialized) {
    void initializeDatabase();
  }
  return pricesMemoryCache;
}

export function getStoredPriceUpdatedAt(): PriceUpdatedAtMap {
  if (!isDbInitialized) {
    void initializeDatabase();
  }
  return priceUpdatedAtMemoryCache;
}

export function getStoredSyncStatus(): SyncStatus {
  return syncStatusMemoryCache;
}

export const getSyncStatus = getStoredSyncStatus;

export function getStoredSyncSettings(): SyncSettings {
  return syncSettingsMemoryCache;
}

export const getSyncSettings = getStoredSyncSettings;

export function getPriceProfiles(): PriceProfile[] {
  return priceProfilesMemoryCache;
}

export function getActivePriceProfileId(): number {
  return activePriceProfileIdMemoryCache;
}

export function getActivePriceProfile(): PriceProfile | undefined {
  return priceProfilesMemoryCache.find((p) => p.id === activePriceProfileIdMemoryCache) || priceProfilesMemoryCache[0];
}

const presetItemMap = new Map<number, PresetCraftableItem>(
  ALL_PRESET_ITEMS.map((item) => [item.id, item]),
);

export function getCraftableItemsSnapshot(): CraftableItem[] {
  if (
    cachedCraftableSnapshot &&
    cachedCraftableSnapshot.length > ALL_PRESET_ITEMS.length
  ) {
    return cachedCraftableSnapshot;
  }

  const importedItems = getImportedItems();
  const storedRecipes = getStoredRecipes();
  const importedMap = new Map<number, DofusItem>();
  importedItems.forEach((item) => importedMap.set(item.id, item));

  const resultList: CraftableItem[] = [];
  const processedResultIds = new Set<number>();

  for (const [resultIdStr, recipe] of Object.entries(storedRecipes)) {
    const resultId = Number(resultIdStr);
    if (!resultId || !recipe || !recipe.ingredientIds || recipe.ingredientIds.length === 0) {
      continue;
    }

    processedResultIds.add(resultId);
    const existingItem = importedMap.get(resultId);
    const presetItem = presetItemMap.get(resultId);
    const itemToUse = existingItem || presetItem;

    if (itemToUse && (isCosmeticItem(itemToUse as any) || isDofusItem(itemToUse as any))) {
      continue;
    }

    const job = getJobForItem(itemToUse || { id: resultId, typeId: 0 }, recipe);
    if (job.jobId === 0) {
      continue;
    }

    if (itemToUse) {
      const mergedEffects = [
        ...(itemToUse.effects && itemToUse.effects.length > 0 ? itemToUse.effects : []),
        ...(itemToUse.possibleEffects && itemToUse.possibleEffects.length > 0 ? itemToUse.possibleEffects : []),
        ...(presetItem?.effects || []),
        ...(presetItem?.possibleEffects || []),
      ];

      resultList.push({
        ...itemToUse,
        possibleEffects: mergedEffects.length > 0 ? mergedEffects : (presetItem?.possibleEffects || presetItem?.effects || []),
        effects: mergedEffects.length > 0 ? mergedEffects : (presetItem?.effects || presetItem?.possibleEffects || []),
        jobId: job.jobId,
        jobNameEs: job.jobNameEs,
        defaultMarketSalePrice: itemToUse.price || presetItem?.defaultMarketSalePrice || 0,
        recipeData: recipe,
      });
      continue;
    }

    resultList.push({
      id: resultId,
      level: 1,
      name: {
        es: `Objeto #${resultId}`,
        fr: `Objet #${resultId}`,
        en: `Item #${resultId}`,
      },
      typeId: 0,
      iconId: 0,
      jobId: job.jobId,
      jobNameEs: job.jobNameEs,
      defaultMarketSalePrice: 0,
      recipeData: recipe,
    });
  }

  for (const item of importedItems) {
    if (processedResultIds.has(item.id) || isOmittedItem(item) || isDofusItem(item)) {
      continue;
    }

    const rawRecipe =
      (
        item as DofusItem & {
          recipe?: DofusRecipe;
          craft?: DofusRecipe;
          recipes?: DofusRecipe[] | DofusRecipe;
        }
      ).recipe ??
      (item as DofusItem & { craft?: DofusRecipe }).craft ??
      (Array.isArray((item as DofusItem & { recipes?: DofusRecipe[] }).recipes)
        ? (item as DofusItem & { recipes?: DofusRecipe[] }).recipes?.[0]
        : (item as DofusItem & { recipes?: DofusRecipe }).recipes);

    if (!rawRecipe) {
      continue;
    }

    processedResultIds.add(item.id);
    const job = getJobForItem(item, rawRecipe);
    if (job.jobId === 0) {
      continue;
    }

    const presetItem = presetItemMap.get(item.id);
    const mergedEffects = [
      ...(item.effects && item.effects.length > 0 ? item.effects : []),
      ...(item.possibleEffects && item.possibleEffects.length > 0 ? item.possibleEffects : []),
      ...(presetItem?.effects || []),
      ...(presetItem?.possibleEffects || []),
    ];

    resultList.push({
      ...item,
      possibleEffects: mergedEffects.length > 0 ? mergedEffects : (presetItem?.possibleEffects || presetItem?.effects || []),
      effects: mergedEffects.length > 0 ? mergedEffects : (presetItem?.effects || presetItem?.possibleEffects || []),
      jobId: job.jobId,
      jobNameEs: job.jobNameEs,
      defaultMarketSalePrice: item.price || presetItem?.defaultMarketSalePrice || 0,
      recipeData: rawRecipe,
    });
  }

  for (const preset of ALL_PRESET_ITEMS) {
    if (processedResultIds.has(preset.id)) {
      continue;
    }

    const job = getJobForItem(preset, preset.recipeData);
    resultList.push({
      ...preset,
      jobId: job.jobId,
      jobNameEs: job.jobNameEs,
    });
  }

  cachedCraftableSnapshot = resultList;
  return resultList;
}

/**
 * Obtiene el listado exclusivo de objetos válidos para machacado y generación de runas.
 * Filtra estrictamente por los 6 oficios requeridos:
 * Sastre (27), Joyero (16), Zapatero (15), Fabricante (60), Herrero (11), Escultor (13).
 * Omite objetos cosméticos, mascotas, consumibles y objetos de clase.
 * Solo incluye objetos que tengan estadísticas positivas extraíbles que generen runas.
 */
export function getCrushableItemsSnapshot(): CraftableItem[] {
  if (cachedCrushableSnapshot) {
    return cachedCrushableSnapshot;
  }

  const allCraftable = getCraftableItemsSnapshot();
  const crushables = allCraftable.filter((item) => {
    if (isOmittedItem(item) || isClassItem(item) || isPetItem(item)) return false;
    if (!isCrushableJob(item.jobId)) return false;
    const stats = extractItemStats(item);
    return stats.length > 0;
  });

  cachedCrushableSnapshot = crushables;
  return crushables;
}

let isResolvingMissingNames = false;

export async function resolveMissingItemNamesInBatch(
  itemIds: number[],
): Promise<DofusItem[]> {
  if (!itemIds || itemIds.length === 0 || isResolvingMissingNames) return [];

  const idsToResolve = itemIds.filter((itemId) => {
    const cachedItem = itemsMemoryCache.find((item) => item.id === itemId);
    if (!cachedItem) return true;
    const name = getItemName(cachedItem);
    return !name || name.startsWith("Objeto #");
  });

  if (idsToResolve.length === 0) return [];

  isResolvingMissingNames = true;
  try {
    const response = await requestJson<{ items?: DofusItem[]; updatedItems?: DofusItem[] }>(
      `${LOCAL_DB_API_BASE}/items/batch-resolve`,
      {
        method: "POST",
        body: JSON.stringify({ itemIds: idsToResolve }),
      },
    );
    const resolvedItems = response.updatedItems || response.items || [];
    if (resolvedItems.length > 0) {
      updateMemoryCache({ items: resolvedItems });
    }
    return resolvedItems;
  } catch (error) {
    console.warn("Error resolviendo nombres de ítems en lote:", error);
    return [];
  } finally {
    isResolvingMissingNames = false;
  }
}

export async function saveMarketPrice(
  itemId: number,
  price: number,
): Promise<MarketPriceMap> {
  const response = await requestJson<{
    prices: MarketPriceMap;
    priceUpdatedAt: PriceUpdatedAtMap;
    activePriceProfileId: number;
  }>(`${LOCAL_DB_API_BASE}/prices/${itemId}`, {
    method: "PUT",
    body: JSON.stringify({
      price,
      profileId: activePriceProfileIdMemoryCache,
    }),
  });

  updateMemoryCache({
    prices: response.prices,
    priceUpdatedAt: response.priceUpdatedAt,
    activePriceProfileId: response.activePriceProfileId,
  });
  return pricesMemoryCache;
}

export async function saveAllMarketPrices(
  newPricesMap: MarketPriceMap,
): Promise<MarketPriceMap> {
  const response = await requestJson<{
    prices: MarketPriceMap;
    priceUpdatedAt: PriceUpdatedAtMap;
    activePriceProfileId: number;
  }>(`${LOCAL_DB_API_BASE}/prices`, {
    method: "PUT",
    body: JSON.stringify({
      prices: newPricesMap,
      profileId: activePriceProfileIdMemoryCache,
    }),
  });

  updateMemoryCache({
    prices: response.prices,
    priceUpdatedAt: response.priceUpdatedAt,
    activePriceProfileId: response.activePriceProfileId,
  });
  return pricesMemoryCache;
}

export async function importFullDatabaseJSON(data: unknown): Promise<void> {
  const response = await requestJson<BootstrapResponse>(
    `${LOCAL_DB_API_BASE}/import-json`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
  );

  updateMemoryCache({
    items: response.items,
    recipes: response.recipes,
    prices: response.prices,
    priceUpdatedAt: response.priceUpdatedAt,
    syncStatus: response.syncStatus,
    syncSettings: response.syncSettings,
    priceProfiles: response.priceProfiles,
    activePriceProfileId: response.activePriceProfileId,
  });
}

export async function setActiveLocalPriceProfile(
  profileId: number,
): Promise<void> {
  if (typeof window !== "undefined") {
    localStorage.setItem("selected_dofus_price_profile_id", String(profileId));
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_TIMESTAMP_KEY);
  }

  const response = await requestJson<{
    profiles: PriceProfile[];
    activePriceProfileId: number;
    prices: MarketPriceMap;
    priceUpdatedAt: PriceUpdatedAtMap;
    coefficients?: Record<number, number>;
    coefficientUpdatedAt?: Record<number, number>;
  }>(`${LOCAL_DB_API_BASE}/price-profiles/active`, {
    method: "PUT",
    body: JSON.stringify({ profileId }),
  });

  const activeProfile =
    response.profiles.find((p) => p.id === response.activePriceProfileId) ||
    response.profiles[0];

  if (typeof window !== "undefined" && activeProfile) {
    localStorage.setItem("selected_dofus_price_profile_slug", activeProfile.slug);
    localStorage.setItem("selected_dofus_price_profile_id", String(activeProfile.id));
  }

  updateMemoryCache({
    priceProfiles: response.profiles,
    activePriceProfileId: response.activePriceProfileId,
    prices: response.prices,
    priceUpdatedAt: response.priceUpdatedAt,
    coefficients: response.coefficients,
    coefficientUpdatedAt: response.coefficientUpdatedAt,
  });

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("dofus_profile_changed", {
        detail: {
          profileId: response.activePriceProfileId,
          profile: activeProfile,
        },
      })
    );
    window.dispatchEvent(
      new CustomEvent("dofus_coefficients_updated", {
        detail: {
          profileId: response.activePriceProfileId,
          server: activeProfile?.slug,
        },
      })
    );
  }
}

export async function saveProfileCoefficient(
  itemId: number,
  coefficient: number,
  profileId?: number
): Promise<void> {
  const pid = profileId || activePriceProfileIdMemoryCache;
  const profile =
    priceProfilesMemoryCache.find((p) => p.id === pid) ||
    priceProfilesMemoryCache[0];
  const slug = profile?.slug || "draconiros";

  saveItemCoefficient(itemId, coefficient, slug);

  try {
    await requestJson(`${LOCAL_DB_API_BASE}/coefficients/${itemId}`, {
      method: "PUT",
      body: JSON.stringify({
        coefficient,
        profileId: pid,
        updatedAt: Date.now(),
      }),
    });
  } catch (err) {
    console.warn("Failed to persist coefficient to SQLite backend:", err);
  }
}

export async function bulkSaveProfileCoefficients(
  entries: Array<{ itemId: number; coefficient: number; dateUpdated?: string | number }>,
  profileId?: number
): Promise<{ updatedCount: number; server: string }> {
  const pid = profileId || activePriceProfileIdMemoryCache;
  const profile =
    priceProfilesMemoryCache.find((p) => p.id === pid) ||
    priceProfilesMemoryCache[0];
  const slug = profile?.slug || "draconiros";

  const result = bulkSaveItemCoefficients(entries, {}, slug);

  try {
    await requestJson(`${LOCAL_DB_API_BASE}/coefficients/bulk`, {
      method: "POST",
      body: JSON.stringify({
        entries: entries.map((e) => ({
          itemId: e.itemId,
          coefficient: e.coefficient,
          updatedAt: e.dateUpdated ? new Date(e.dateUpdated).getTime() : Date.now(),
        })),
        profileId: pid,
      }),
    });
  } catch (err) {
    console.warn("Failed to bulk persist coefficients to SQLite backend:", err);
  }

  return { updatedCount: result.updatedCount, server: slug };
}

export async function saveAutomaticSyncSettings(
  settings: SyncSettings,
): Promise<SyncSettings> {
  const response = await requestJson<{
    syncSettings: SyncSettings;
    syncStatus: SyncStatus;
  }>(`${LOCAL_DB_API_BASE}/sync-settings`, {
    method: "PUT",
    body: JSON.stringify(settings),
  });

  updateMemoryCache({
    syncSettings: response.syncSettings,
    syncStatus: response.syncStatus,
  });
  return syncSettingsMemoryCache;
}

export async function fetchRecipeByResultId(
  resultId: number,
): Promise<DofusRecipe | null> {
  if (recipesMemoryCache[resultId]) {
    return recipesMemoryCache[resultId];
  }

  try {
    const recipe = await requestJson<DofusRecipe>(
      `${LOCAL_DB_API_BASE}/recipes/${resultId}`,
    );
    if (recipe) {
      updateMemoryCache({
        recipes: { ...recipesMemoryCache, [resultId]: recipe },
      });
      return recipe;
    }
    return null;
  } catch (error) {
    return null;
  }
}

export async function fetchItemDetailsById(
  itemId: number,
): Promise<DofusItem | null> {
  const known = KNOWN_SPECIAL_INGREDIENTS[itemId];
  const localItem = itemsMemoryCache.find((item) => item.id === itemId);
  if (
    localItem &&
    localItem.name?.es &&
    !localItem.name.es.startsWith("Objeto #") &&
    !localItem.name.es.startsWith("Ingrediente #")
  ) {
    return localItem;
  }

  if (known) {
    const knownItem: DofusItem = {
      id: itemId,
      level: known.level || 1,
      typeId: known.typeId || 0,
      iconId: known.iconId || itemId,
      name: {
        es: typeof known.name === "object" ? known.name?.es || "" : known.name || "",
        fr: typeof known.name === "object" ? known.name?.fr || "" : "",
        en: typeof known.name === "object" ? known.name?.en || "" : "",
      },
      type: (known.type as any) || { id: known.typeId || 0, superCategoryId: 0, name: { es: "", fr: "", en: "" } },
    };

    if (!localItem) {
      updateMemoryCache({ items: [...itemsMemoryCache, knownItem] });
    }
  }

  try {
    const item = await requestJson<DofusItem>(
      `${LOCAL_DB_API_BASE}/items/${itemId}`,
    );
    if (item && item.id) {
      const nextItems = [...itemsMemoryCache];
      const currentIndex = nextItems.findIndex((entry) => entry.id === item.id);
      if (currentIndex >= 0) {
        nextItems[currentIndex] = item;
      } else {
        nextItems.push(item);
      }
      updateMemoryCache({ items: nextItems });
      return item;
    }
  } catch (error) {
    // Fallback to memory / known item
  }

  if (known) {
    return {
      id: itemId,
      level: known.level || 1,
      typeId: known.typeId || 0,
      iconId: known.iconId || itemId,
      name: {
        es: typeof known.name === "object" ? known.name?.es || "" : known.name || "",
        fr: typeof known.name === "object" ? known.name?.fr || "" : "",
        en: typeof known.name === "object" ? known.name?.en || "" : "",
      },
      type: (known.type as any) || { id: known.typeId || 0, superCategoryId: 0, name: { es: "", fr: "", en: "" } },
    };
  }

  return localItem || null;
}

export async function fetchLiveSyncStatus(): Promise<SyncStatus> {
  try {
    const status = await requestJson<SyncStatus>(`${LOCAL_DB_API_BASE}/sync-status`);
    if (status) {
      syncStatusMemoryCache = status;
      emitDatabaseUpdated();
    }
    return status;
  } catch {
    return syncStatusMemoryCache;
  }
}

export async function resetLocalSyncStatus(): Promise<SyncStatus> {
  try {
    const status = await requestJson<SyncStatus>(`${LOCAL_DB_API_BASE}/reset-sync-status`, {
      method: "POST",
    });
    if (status) {
      syncStatusMemoryCache = status;
      emitDatabaseUpdated();
    }
    return status;
  } catch {
    syncStatusMemoryCache = {
      ...syncStatusMemoryCache,
      isLoading: false,
      progressPercent: 100,
      progressMessage: "Listo.",
    };
    emitDatabaseUpdated();
    return syncStatusMemoryCache;
  }
}

export async function performFullItemImport(
  onProgress?: (status: SyncStatus) => void,
): Promise<{ items: DofusItem[]; status: SyncStatus }> {
  if (typeof window !== "undefined") {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_TIMESTAMP_KEY);
  }

  const updateProgress = (pct: number, step: string, msg: string) => {
    syncStatusMemoryCache = {
      ...syncStatusMemoryCache,
      isLoading: true,
      progressPercent: pct,
      currentStep: step,
      progressMessage: msg,
    };
    if (onProgress) onProgress(syncStatusMemoryCache);
    emitDatabaseUpdated();
  };

  try {
    updateProgress(5, "Iniciando importación", "Conectando con DofusDB y preparando base de datos en Turso...");
    await requestJson(`${LOCAL_DB_API_BASE}/import-chunk/init`, { method: "POST" });

    // Step 1: Fetch recipes from DofusDB
    updateProgress(10, "Paso 1/3: Descargando recetas de DofusDB", "Consultando recetas en api.dofusdb.fr...");
    const recipesLimit = 50;
    let recipesSkip = 0;
    let totalRecipes = 5000;
    const allRecipes: DofusRecipe[] = [];
    const neededItemIds = new Set<number>();

    while (recipesSkip < totalRecipes) {
      try {
        const res = await fetch(`https://api.dofusdb.fr/recipes?$limit=${recipesLimit}&$skip=${recipesSkip}&$sort=id`);
        if (!res.ok) break;
        const json = await res.json();
        totalRecipes = json.total || totalRecipes;
        const pageRecipes = json.data || [];
        if (pageRecipes.length === 0) break;

        for (const r of pageRecipes) {
          const resultId = Number(r.resultId || r.result_id || r.id);
          if (resultId) {
            neededItemIds.add(resultId);
            const ingredientIds: number[] = [];
            const quantities: number[] = [];
            if (Array.isArray(r.ingredientIds) && Array.isArray(r.quantities)) {
              for (let idx = 0; idx < r.ingredientIds.length; idx++) {
                const iId = Number(r.ingredientIds[idx]);
                if (iId) {
                  ingredientIds.push(iId);
                  quantities.push(Number(r.quantities[idx]) || 1);
                  neededItemIds.add(iId);
                }
              }
            }
            if (ingredientIds.length > 0) {
              allRecipes.push({
                id: Number(r.id) || resultId,
                resultId,
                ingredientIds,
                quantities,
                jobId: Number(r.jobId || r.job_id) || undefined,
              });
            }
          }
        }

        recipesSkip += recipesLimit;
        const pct = Math.round(10 + (recipesSkip / totalRecipes) * 25);
        updateProgress(
          Math.min(35, pct),
          "Paso 1/3: Descargando recetas de DofusDB",
          `Descargadas ${Math.min(recipesSkip, totalRecipes).toLocaleString()} de ${totalRecipes.toLocaleString()} recetas...`
        );
      } catch (err) {
        console.warn("Recipe fetch page error, continuing...", err);
        break;
      }
    }

    // Save recipes to Turso in batches of 250
    for (let i = 0; i < allRecipes.length; i += 250) {
      const chunk = allRecipes.slice(i, i + 250);
      await requestJson(`${LOCAL_DB_API_BASE}/import-chunk/recipes`, {
        method: "POST",
        body: JSON.stringify({ recipes: chunk }),
      });
    }

    // Step 2: Fetch items from DofusDB
    updateProgress(40, "Paso 2/3: Descargando objetos", "Descargando catálogo de objetos de DofusDB en español...");
    const itemsLimit = 50;
    let itemsSkip = 0;
    let totalItems = 22000;
    let savedItemsCount = 0;
    let currentBatch: any[] = [];

    while (itemsSkip < totalItems) {
      try {
        const res = await fetch(`https://api.dofusdb.fr/items?$limit=${itemsLimit}&$skip=${itemsSkip}&lang=es&$sort=id`);
        if (!res.ok) break;
        const json = await res.json();
        totalItems = json.total || totalItems;
        const pageItems = json.data || [];
        if (pageItems.length === 0) break;

        for (const item of pageItems) {
          const id = Number(item.id || item.ankama_id || 0);
          if (!id) continue;
          // Filter: only keep items that are needed (have recipe, are ingredient, or valid equipment/resource/consumable)
          const isNeeded = neededItemIds.has(id) || !isOmittedItem(item);
          if (isNeeded) {
            currentBatch.push(item);
          }
        }

        if (currentBatch.length >= 250) {
          await requestJson(`${LOCAL_DB_API_BASE}/import-chunk/items`, {
            method: "POST",
            body: JSON.stringify({ items: currentBatch }),
          });
          savedItemsCount += currentBatch.length;
          currentBatch = [];
        }

        itemsSkip += itemsLimit;
        const pct = Math.round(40 + (itemsSkip / totalItems) * 50);
        updateProgress(
          Math.min(90, pct),
          "Paso 2/3: Descargando y guardando objetos útiles",
          `Procesados ${Math.min(itemsSkip, totalItems).toLocaleString()} de ${totalItems.toLocaleString()} (Guardados: ${savedItemsCount.toLocaleString()})...`
        );
      } catch (err) {
        console.warn("Item fetch page error, continuing...", err);
        break;
      }
    }

    if (currentBatch.length > 0) {
      await requestJson(`${LOCAL_DB_API_BASE}/import-chunk/items`, {
        method: "POST",
        body: JSON.stringify({ items: currentBatch }),
      });
      savedItemsCount += currentBatch.length;
    }

    // Step 3: Finalize
    updateProgress(95, "Paso 3/3: Finalizando en Turso", "Calculando estadísticas y verificando base de datos...");
    const response = await requestJson<BootstrapResponse>(
      `${LOCAL_DB_API_BASE}/import-chunk/finalize`,
      { method: "POST" }
    );

    updateMemoryCache({
      items: response.items,
      recipes: response.recipes,
      prices: response.prices,
      priceUpdatedAt: response.priceUpdatedAt,
      syncStatus: response.syncStatus,
      syncSettings: response.syncSettings,
      priceProfiles: response.priceProfiles,
      activePriceProfileId: response.activePriceProfileId,
    });

    updateProgress(100, "Completado", `¡Importación en vivo finalizada con éxito (${response.items.length.toLocaleString()} objetos y ${Object.keys(response.recipes).length.toLocaleString()} recetas guardadas en Turso)!`);
    return { items: getImportedItems(), status: syncStatusMemoryCache };
  } catch (error) {
    syncStatusMemoryCache = {
      ...syncStatusMemoryCache,
      isLoading: false,
      progressMessage: `Error durante la importación: ${error instanceof Error ? error.message : String(error)}`,
    };
    if (onProgress) onProgress(syncStatusMemoryCache);
    emitDatabaseUpdated();
    throw error;
  }
}

export async function triggerFastSeedDatabase(
  force = true,
  onProgress?: (status: SyncStatus) => void,
): Promise<{ items: DofusItem[]; status: SyncStatus }> {
  if (typeof window !== "undefined") {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_TIMESTAMP_KEY);
  }

  const updateProgress = (pct: number, step: string, msg: string) => {
    syncStatusMemoryCache = {
      ...syncStatusMemoryCache,
      isLoading: true,
      progressPercent: pct,
      currentStep: step,
      progressMessage: msg,
    };
    if (onProgress) onProgress(syncStatusMemoryCache);
    emitDatabaseUpdated();
  };

  try {
    updateProgress(5, "Iniciando Turso", "Preparando y limpiando tablas en Turso Cloud...");

    // 1. Init
    const initRes = await requestJson<{
      totalItems: number;
      totalRecipes: number;
      itemChunks: number;
      recipeChunks: number;
    }>(`${LOCAL_DB_API_BASE}/seed-step/init`, { method: "POST" });

    const { totalItems, totalRecipes, itemChunks, recipeChunks } = initRes;

    // 2. Stream item chunks
    for (let i = 0; i < itemChunks; i++) {
      const chunkPct = Math.round(5 + ((i + 1) / itemChunks) * 50);
      const count = Math.min((i + 1) * 400, totalItems);
      updateProgress(
        chunkPct,
        `Paso 1/2: Guardando objetos en Turso (${i + 1}/${itemChunks})`,
        `Guardando objetos y estadísticas: ${count.toLocaleString()} / ${totalItems.toLocaleString()}...`
      );
      await requestJson(`${LOCAL_DB_API_BASE}/seed-step/items`, {
        method: "POST",
        body: JSON.stringify({ chunkIndex: i, chunkSize: 400 }),
      });
    }

    // 3. Stream recipe chunks
    for (let i = 0; i < recipeChunks; i++) {
      const chunkPct = Math.round(55 + ((i + 1) / recipeChunks) * 40);
      const count = Math.min((i + 1) * 400, totalRecipes);
      updateProgress(
        chunkPct,
        `Paso 2/2: Guardando recetas en Turso (${i + 1}/${recipeChunks})`,
        `Guardando recetas de crafteo: ${count.toLocaleString()} / ${totalRecipes.toLocaleString()}...`
      );
      await requestJson(`${LOCAL_DB_API_BASE}/seed-step/recipes`, {
        method: "POST",
        body: JSON.stringify({ chunkIndex: i, chunkSize: 400 }),
      });
    }

    // 4. Finalize
    updateProgress(98, "Finalizando", "Actualizando índices y verificando base de datos...");
    const response = await requestJson<BootstrapResponse>(
      `${LOCAL_DB_API_BASE}/seed-step/finalize`,
      { method: "POST" }
    );

    updateMemoryCache({
      items: response.items,
      recipes: response.recipes,
      prices: response.prices,
      priceUpdatedAt: response.priceUpdatedAt,
      syncStatus: response.syncStatus,
      syncSettings: response.syncSettings,
      priceProfiles: response.priceProfiles,
      activePriceProfileId: response.activePriceProfileId,
    });

    updateProgress(100, "Completado", `¡Base de datos sincronizada con éxito (${response.items.length.toLocaleString()} objetos y ${Object.keys(response.recipes).length.toLocaleString()} recetas)!`);
    return { items: getImportedItems(), status: syncStatusMemoryCache };
  } catch (err) {
    syncStatusMemoryCache = {
      ...syncStatusMemoryCache,
      isLoading: false,
      progressMessage: `Error al sembrar base de datos: ${err instanceof Error ? err.message : String(err)}`,
    };
    if (onProgress) onProgress(syncStatusMemoryCache);
    emitDatabaseUpdated();
    throw err;
  }
}

export type CraftStrategyMode =
  | "direct_buy"
  | "full_subcraft"
  | "auto_optimal"
  | "custom_hybrid";

export async function buildRecipeTree(
  itemId: number,
  quantityNeeded: number = 1,
  currentDepth: number = 0,
  maxDepth: number = 3,
  visitedIds: Set<number> = new Set(),
  marketPrices: MarketPriceMap = getStoredMarketPrices(),
): Promise<RecipeTreeNode | null> {
  if (visitedIds.has(itemId) || currentDepth > maxDepth) {
    return null;
  }

  // Fast cache lookup for root requests with default depth
  const cacheKey = currentDepth === 0 ? `${itemId}_${quantityNeeded}_${maxDepth}_${activePriceProfileIdMemoryCache}` : null;
  if (cacheKey && recipeTreeMapCache.has(cacheKey)) {
    return JSON.parse(JSON.stringify(recipeTreeMapCache.get(cacheKey)!));
  }

  const item = await fetchItemDetailsById(itemId);
  if (!item) {
    return null;
  }

  const isCraftableByFlag = item.hasRecipe;
  let recipe: DofusRecipe | null = null;
  if (isCraftableByFlag !== false) {
    recipe = await fetchRecipeByResultId(itemId);
  }

  const isCraftable = !!recipe && recipe.ingredientIds.length > 0;
  const currentPrice = marketPrices[itemId] || item.price || 0;

  const node: RecipeTreeNode = {
    itemId,
    quantity: quantityNeeded,
    item,
    recipe: recipe || undefined,
    subIngredients: undefined,
    isCraftable,
    marketPrice: currentPrice,
    decision: isCraftable ? "craft" : "buy",
  };

  if (!isCraftable || !recipe) {
    if (cacheKey) {
      recipeTreeMapCache.set(cacheKey, JSON.parse(JSON.stringify(node)));
    }
    return node;
  }

  visitedIds.add(itemId);
  const subIngredients: RecipeTreeNode[] = [];

  for (let index = 0; index < recipe.ingredientIds.length; index += 1) {
    const ingredientId = recipe.ingredientIds[index];
    const ingredientQuantity = (recipe.quantities[index] || 1) * quantityNeeded;

    const childNode = await buildRecipeTree(
      ingredientId,
      ingredientQuantity,
      currentDepth + 1,
      maxDepth,
      new Set(visitedIds),
      marketPrices,
    );

    if (childNode) {
      subIngredients.push(childNode);
      continue;
    }

    const fallbackItem = await fetchItemDetailsById(ingredientId);
    const knownFallback = KNOWN_SPECIAL_INGREDIENTS[ingredientId];
    subIngredients.push({
      itemId: ingredientId,
      quantity: ingredientQuantity,
      item: fallbackItem || {
        id: ingredientId,
        name: {
          es:
            (typeof knownFallback?.name === "object"
              ? knownFallback?.name?.es
              : (knownFallback?.name as string)) ||
            `Ingrediente #${ingredientId}`,
        },
        level: knownFallback?.level || 1,
        typeId: knownFallback?.typeId || 0,
        iconId: knownFallback?.iconId || ingredientId,
      },
      isCraftable: false,
      marketPrice: marketPrices[ingredientId] || 0,
      decision: "buy",
    });
  }

  node.subIngredients = subIngredients;
  if (cacheKey) {
    recipeTreeMapCache.set(cacheKey, JSON.parse(JSON.stringify(node)));
  }
  return node;
}

/**
 * Returns all craftable items that use the specified ingredient ID in their recipes (O(1) indexed lookup)
 */
export function getRecipesUsingIngredient(ingredientId: number): CraftableItem[] {
  if (ingredientToRecipesIndex.size === 0) {
    rebuildIngredientReverseIndex();
  }
  const resultIds = ingredientToRecipesIndex.get(ingredientId);
  if (!resultIds || resultIds.size === 0) return [];

  const allCraftable = getCraftableItemsSnapshot();
  const resultMap = new Map<number, CraftableItem>();
  for (const item of allCraftable) {
    if (resultIds.has(item.id)) {
      resultMap.set(item.id, item);
    }
  }
  return Array.from(resultMap.values());
}

export function calculateTreeCraftCost(
  node: RecipeTreeNode,
  strategy: CraftStrategyMode,
  marketPrices: MarketPriceMap,
): number {
  if (
    !node.subIngredients ||
    node.subIngredients.length === 0 ||
    !node.isCraftable
  ) {
    const singlePrice = marketPrices[node.itemId] || node.marketPrice || 0;
    return singlePrice * node.quantity;
  }

  if (strategy === "direct_buy") {
    return node.subIngredients.reduce((total, child) => {
      const childPrice = marketPrices[child.itemId] || child.marketPrice || 0;
      return total + childPrice * child.quantity;
    }, 0);
  }

  if (strategy === "full_subcraft") {
    return node.subIngredients.reduce((total, child) => {
      return (
        total + calculateTreeCraftCost(child, "full_subcraft", marketPrices)
      );
    }, 0);
  }

  if (strategy === "auto_optimal") {
    return node.subIngredients.reduce((total, child) => {
      const childBuyPrice =
        (marketPrices[child.itemId] || child.marketPrice || 0) * child.quantity;

      if (
        !child.isCraftable ||
        !child.subIngredients ||
        child.subIngredients.length === 0
      ) {
        return total + childBuyPrice;
      }

      const childCraftCost = calculateTreeCraftCost(
        child,
        "auto_optimal",
        marketPrices,
      );
      return total + Math.min(childBuyPrice, childCraftCost);
    }, 0);
  }

  return node.subIngredients.reduce((total, child) => {
    if (child.decision === "buy" || !child.isCraftable) {
      const childPrice = marketPrices[child.itemId] || child.marketPrice || 0;
      return total + childPrice * child.quantity;
    }

    return total + calculateTreeCraftCost(child, "custom_hybrid", marketPrices);
  }, 0);
}

// ----------------------------------------------------
// Synchronous Fast Query & Arbitrage Helpers
// ----------------------------------------------------

export function getAllLocalItems(): DofusItem[] {
  if (!isDbInitialized) {
    void initializeDatabase();
  }
  if (itemsMemoryCache.length > 0) {
    return itemsMemoryCache.filter((item) => !isOmittedItem(item));
  }
  return PRESET_CRAFTABLE_ITEMS.filter((item) => !isOmittedItem(item));
}

export function getItemById(id: number): DofusItem | undefined {
  if (itemsMemoryCache.length > 0) {
    const found = itemsMemoryCache.find((i) => i.id === id);
    if (found) return found;
  }
  return presetItemMap.get(id);
}

export function getRecipeByResultId(resultId: number): DofusRecipe | undefined {
  return recipesMemoryCache[resultId];
}

export function getStoredItemPrice(itemId: number): number {
  return pricesMemoryCache[itemId] || 0;
}

export function getAllStoredPrices(): MarketPriceMap {
  return getStoredMarketPrices();
}

export async function setLocalItemPrice(itemId: number, price: number): Promise<void> {
  await saveMarketPrice(itemId, price);
}

export function calculateItemCraftCost(itemId: number): number {
  const recipe = recipesMemoryCache[itemId];
  if (!recipe || !recipe.ingredientIds || recipe.ingredientIds.length === 0) {
    return 0;
  }

  let total = 0;
  for (let i = 0; i < recipe.ingredientIds.length; i++) {
    const ingId = recipe.ingredientIds[i];
    const qty = recipe.quantities?.[i] || 1;
    const ingPrice = getLowestDetectedPrice(ingId, pricesMemoryCache, recipesMemoryCache);
    total += ingPrice * qty;
  }

  return total;
}

export function calculateEstimatedRunesValue(item: DofusItem): number {
  try {
    const crushing = calculateItemCrushing(item, 100, null, pricesMemoryCache, 0);
    return crushing.bestFocusOption?.totalKamasValue || crushing.totalKamasValue || 0;
  } catch {
    return 0;
  }
}

// ----------------------------------------------------
// Shopping List & Batch Craft Planner Services
// ----------------------------------------------------

const SHOPPING_LIST_KEY = "dofus_shopping_list_items_v1";
const THEME_STORAGE_KEY = "dofus_active_theme_v1";

export function getShoppingList(): ShoppingListItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SHOPPING_LIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveShoppingList(items: ShoppingListItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SHOPPING_LIST_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("dofus_shopping_list_updated"));
  } catch {
    // Ignore storage write errors
  }
}

export function addToShoppingList(
  item: DofusItem,
  quantity = 1,
  recipe?: DofusRecipe
): ShoppingListItem[] {
  const current = getShoppingList();
  const existingIndex = current.findIndex((i) => i.itemId === item.id);
  const resolvedRecipe = recipe || getRecipeByResultId(item.id) || undefined;

  if (existingIndex >= 0) {
    current[existingIndex].targetQuantity += quantity;
    if (!current[existingIndex].recipe && resolvedRecipe) {
      current[existingIndex].recipe = resolvedRecipe;
    }
  } else {
    current.push({
      itemId: item.id,
      item,
      recipe: resolvedRecipe,
      targetQuantity: Math.max(1, quantity),
      addedAt: Date.now(),
    });
  }

  saveShoppingList(current);
  return current;
}

export function addToShoppingListById(
  itemId: number,
  quantity = 1,
  parentResultId?: number
): ShoppingListItem[] {
  const existing = getItemById(itemId);
  const resolvedItem: DofusItem = existing || {
    id: itemId,
    name: { es: `Objeto #${itemId}` },
    level: 1,
    typeId: 0,
    iconId: itemId,
    type: { id: 0, superCategoryId: 0, name: { es: "Recurso" } },
  };
  const parentRecipe = parentResultId ? getRecipeByResultId(parentResultId) : undefined;
  return addToShoppingList(resolvedItem, quantity, parentRecipe);
}

export function searchAllItems(query: string, limit = 20): DofusItem[] {
  if (!query || !query.trim()) return [];
  const normalizedQuery = query.toLowerCase().trim();
  const numericId = parseInt(normalizedQuery, 10);
  const results: DofusItem[] = [];
  const seenIds = new Set<number>();

  // 1. Exact ID match if numeric
  if (!isNaN(numericId) && numericId > 0) {
    const itemById = getItemById(numericId);
    if (itemById) {
      results.push(itemById);
      seenIds.add(itemById.id);
    }
  }

  // 2. Search in PRESET_CRAFTABLE_ITEMS
  for (const item of ALL_PRESET_ITEMS) {
    if (results.length >= limit) break;
    if (seenIds.has(item.id)) continue;
    const name = getItemName(item).toLowerCase();
    if (name.includes(normalizedQuery)) {
      results.push(item);
      seenIds.add(item.id);
    }
  }

  // 3. Search in KNOWN_SPECIAL_INGREDIENTS
  for (const [idStr, raw] of Object.entries(KNOWN_SPECIAL_INGREDIENTS)) {
    if (results.length >= limit) break;
    const id = Number(idStr);
    if (seenIds.has(id)) continue;
    const name = (typeof raw.name === "object" ? raw.name?.es || "" : (raw.name as string) || "").toLowerCase();
    if (name.includes(normalizedQuery)) {
      const resolved = getItemById(id);
      if (resolved) {
        results.push(resolved);
        seenIds.add(id);
      }
    }
  }

  // 4. Search in itemsMemoryCache
  for (const item of itemsMemoryCache) {
    if (results.length >= limit) break;
    if (seenIds.has(item.id)) continue;
    const name = getItemName(item).toLowerCase();
    if (name.includes(normalizedQuery)) {
      results.push(item);
      seenIds.add(item.id);
    }
  }

  return results;
}


export function updateShoppingListItemQuantity(
  itemId: number,
  quantity: number
): ShoppingListItem[] {
  const current = getShoppingList();
  const index = current.findIndex((i) => i.itemId === itemId);
  if (index >= 0) {
    if (quantity <= 0) {
      current.splice(index, 1);
    } else {
      current[index].targetQuantity = Math.floor(quantity);
    }
    saveShoppingList(current);
  }
  return current;
}

export function removeFromShoppingList(itemId: number): ShoppingListItem[] {
  const current = getShoppingList().filter((i) => i.itemId !== itemId);
  saveShoppingList(current);
  return current;
}

export function clearShoppingList(): void {
  saveShoppingList([]);
}

export function getConsolidatedShoppingIngredients(
  shoppingList: ShoppingListItem[],
  marketPrices: MarketPriceMap = {}
): ConsolidatedIngredient[] {
  const map = new Map<number, ConsolidatedIngredient>();

  for (const entry of shoppingList) {
    const recipe = entry.recipe || getRecipeByResultId(entry.itemId);
    const batchQty = Math.max(1, entry.targetQuantity);

    if (!recipe || !recipe.ingredientIds || recipe.ingredientIds.length === 0) {
      // Direct raw resource / uncraftable item added to shopping list
      const directId = entry.itemId;
      const directItem = entry.item || getItemById(directId) || undefined;
      const unitPrice = marketPrices[directId] || getStoredItemPrice(directId) || 0;

      const existing = map.get(directId);
      if (existing) {
        existing.totalQuantityRequired += batchQty;
        existing.totalPrice = existing.totalQuantityRequired * existing.unitPrice;
      } else {
        map.set(directId, {
          itemId: directId,
          item: directItem,
          totalQuantityRequired: batchQty,
          unitPrice,
          totalPrice: batchQty * unitPrice,
          isChecked: false,
        });
      }
      continue;
    }

    for (let i = 0; i < recipe.ingredientIds.length; i++) {
      const ingId = recipe.ingredientIds[i];
      const ingQty = (recipe.quantities[i] || 1) * batchQty;
      const ingItem = getItemById(ingId) || undefined;
      const unitPrice = marketPrices[ingId] || getStoredItemPrice(ingId) || 0;

      const existing = map.get(ingId);
      if (existing) {
        existing.totalQuantityRequired += ingQty;
        existing.totalPrice = existing.totalQuantityRequired * existing.unitPrice;
      } else {
        map.set(ingId, {
          itemId: ingId,
          item: ingItem,
          totalQuantityRequired: ingQty,
          unitPrice,
          totalPrice: ingQty * unitPrice,
          isChecked: false,
        });
      }
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => (b.totalPrice || 0) - (a.totalPrice || 0)
  );
}

// ----------------------------------------------------
// Theme Management Service
// ----------------------------------------------------

export function getStoredTheme(): DofusTheme {
  if (typeof window === "undefined") return "bonta";
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY) as DofusTheme;
    if (saved === "brakmar" || saved === "pandala" || saved === "bonta" || saved === "calm") {
      return saved;
    }
    if (saved === "amakna" as any) {
      return "pandala";
    }
    return "bonta";
  } catch {
    return "bonta";
  }
}

export function setStoredTheme(theme: DofusTheme): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    document.documentElement.setAttribute("data-theme", theme);
    window.dispatchEvent(new CustomEvent("dofus_theme_updated", { detail: theme }));
  } catch {
    // Ignore storage write error
  }
}

// ----------------------------------------------------
// Dofusbook Build Service
// ----------------------------------------------------

export async function fetchDofusbookAnalysis(
  urlOrCode: string,
  options: {
    excludeDofus?: boolean;
    excludeTrophies?: boolean;
    profileId?: number;
  } = {}
): Promise<DofusbookBuildAnalysis> {
  const profileId = options.profileId || getActivePriceProfileId();
  const excludeDofus = options.excludeDofus !== false;
  const excludeTrophies = options.excludeTrophies === true;

  const response = await requestJson<DofusbookBuildAnalysis>("/api/dofusbook/analyze", {
    method: "POST",
    body: JSON.stringify({
      url: urlOrCode.trim(),
      excludeDofus,
      excludeTrophies,
      profileId,
    }),
  });

  return response;
}

export function addDofusbookItemsToShoppingList(
  items: Array<{ item: DofusItem; recipe?: DofusRecipe | null; quantity?: number }>
): ShoppingListItem[] {
  const current = getShoppingList();
  
  for (const entry of items) {
    if (!entry.item || entry.item.id <= 0) continue;
    const qty = entry.quantity || 1;
    const existingIndex = current.findIndex((i) => i.itemId === entry.item.id);
    const resolvedRecipe = entry.recipe || getRecipeByResultId(entry.item.id) || undefined;

    if (existingIndex >= 0) {
      current[existingIndex].targetQuantity += qty;
      if (!current[existingIndex].recipe && resolvedRecipe) {
        current[existingIndex].recipe = resolvedRecipe;
      }
    } else {
      current.push({
        itemId: entry.item.id,
        item: entry.item,
        recipe: resolvedRecipe,
        targetQuantity: Math.max(1, qty),
        addedAt: Date.now(),
      });
    }
  }

  saveShoppingList(current);
  return current;
}

// ----------------------------------------------------
// Price History Services & Relative Time Helpers
// ----------------------------------------------------

export interface FetchPriceHistoryParams {
  profileId?: number;
  itemId?: number;
  limit?: number;
  offset?: number;
  search?: string;
  filter?: "all" | "increased" | "decreased";
}

export interface FetchPriceHistoryResponse {
  total: number;
  limit: number;
  offset: number;
  entries: PriceHistoryEntry[];
}

export async function fetchPriceHistory(
  params: FetchPriceHistoryParams = {}
): Promise<FetchPriceHistoryResponse> {
  const query = new URLSearchParams();
  if (params.profileId) query.set("profileId", String(params.profileId));
  if (params.itemId) query.set("itemId", String(params.itemId));
  if (params.limit) query.set("limit", String(params.limit));
  if (params.offset) query.set("offset", String(params.offset));
  if (params.search) query.set("search", params.search);
  if (params.filter) query.set("filter", params.filter);

  const queryString = query.toString() ? `?${query.toString()}` : "";
  return await requestJson<FetchPriceHistoryResponse>(
    `${LOCAL_DB_API_BASE}/price-history${queryString}`
  );
}

export async function fetchItemPriceHistory(
  itemId: number,
  profileId?: number
): Promise<ItemPriceHistorySummary> {
  const query = profileId ? `?profileId=${profileId}` : "";
  return await requestJson<ItemPriceHistorySummary>(
    `${LOCAL_DB_API_BASE}/price-history/item/${itemId}${query}`
  );
}

export async function revertPriceHistory(
  historyId: number
): Promise<{
  success: boolean;
  itemId: number;
  revertedPrice: number;
  prices: MarketPriceMap;
  priceUpdatedAt: PriceUpdatedAtMap;
}> {
  const res = await requestJson<{
    success: boolean;
    itemId: number;
    revertedPrice: number;
    prices: MarketPriceMap;
    priceUpdatedAt: PriceUpdatedAtMap;
  }>(`${LOCAL_DB_API_BASE}/price-history/revert`, {
    method: "POST",
    body: JSON.stringify({ historyId }),
  });

  updateMemoryCache({
    prices: res.prices,
    priceUpdatedAt: res.priceUpdatedAt,
  });

  return res;
}

export async function clearPriceHistoryApi(
  profileId?: number,
  itemId?: number
): Promise<{ success: boolean }> {
  return await requestJson<{ success: boolean }>(
    `${LOCAL_DB_API_BASE}/price-history`,
    {
      method: "DELETE",
      body: JSON.stringify({ profileId, itemId }),
    }
  );
}

export function formatRelativeTime(timestamp?: number | null): string {
  if (!timestamp || timestamp <= 0) return "Sin registro";
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 45) return "Ahora mismo";
  if (diffMin < 60) return `Hace ${diffMin} min`;
  if (diffHours < 24) return `Hace ${diffHours} h`;
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7) return `Hace ${diffDays} días`;
  if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} sem`;
  return new Date(timestamp).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
  });
}

export type { BankInventoryItem };


const BANK_INVENTORY_STORAGE_KEY = "dofus_bank_inventory_v1";

export function getStoredBankInventory(): BankInventoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(BANK_INVENTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((entry) => {
      const id = Number(entry.itemId);
      return {
        itemId: id,
        quantity: Math.max(1, Number(entry.quantity) || 1),
        item: getItemById(id) || entry.item,
        addedAt: Number(entry.addedAt) || Date.now(),
      };
    });
  } catch {
    return [];
  }
}

export function saveBankInventory(items: BankInventoryItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(BANK_INVENTORY_STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("dofus_bank_inventory_updated"));
  } catch (err) {
    console.warn("Error guardando inventario de banco en localStorage:", err);
  }
}

export function addOrUpdateBankItem(itemId: number, quantity: number): BankInventoryItem[] {
  const current = getStoredBankInventory();
  const index = current.findIndex((i) => i.itemId === itemId);
  const resolvedItem = getItemById(itemId) || undefined;

  if (index >= 0) {
    current[index].quantity += quantity;
    if (!current[index].item && resolvedItem) {
      current[index].item = resolvedItem;
    }
  } else {
    current.push({
      itemId,
      quantity: Math.max(1, quantity),
      item: resolvedItem,
      addedAt: Date.now(),
    });
  }

  saveBankInventory(current);
  return current;
}

export function setBankItemQuantity(itemId: number, quantity: number): BankInventoryItem[] {
  let current = getStoredBankInventory();
  if (quantity <= 0) {
    current = current.filter((i) => i.itemId !== itemId);
  } else {
    const index = current.findIndex((i) => i.itemId === itemId);
    if (index >= 0) {
      current[index].quantity = Math.floor(quantity);
    } else {
      const resolvedItem = getItemById(itemId) || undefined;
      current.push({
        itemId,
        quantity: Math.floor(quantity),
        item: resolvedItem,
        addedAt: Date.now(),
      });
    }
  }

  saveBankInventory(current);
  return current;
}

export function removeBankItem(itemId: number): BankInventoryItem[] {
  const current = getStoredBankInventory().filter((i) => i.itemId !== itemId);
  saveBankInventory(current);
  return current;
}

export function clearBankInventory(): void {
  saveBankInventory([]);
}

export function calculateReverseCraftsFromBank(
  bankInventory: BankInventoryItem[],
  marketPrices: MarketPriceMap = {},
  options: {
    minLevel?: number;
    maxLevel?: number;
    jobId?: number | "all";
    onlyFullyCraftable?: boolean;
    searchTerm?: string;
  } = {}
): ReverseCraftAnalysis[] {
  // If bank is empty, return empty results immediately
  if (!bankInventory || bankInventory.length === 0) {
    return [];
  }

  // 1. Build lookup map of itemId -> available bank quantity
  const bankMap = new Map<number, number>();
  for (const b of bankInventory) {
    if (b.quantity > 0) {
      bankMap.set(b.itemId, (bankMap.get(b.itemId) || 0) + b.quantity);
    }
  }

  if (bankMap.size === 0) {
    return [];
  }

  // 2. Fetch all known craftable items
  const allRecipesSnapshot = getCraftableItemsSnapshot();
  const results: ReverseCraftAnalysis[] = [];

  const minLvl = typeof options.minLevel === "number" ? options.minLevel : 1;
  const maxLvl = typeof options.maxLevel === "number" ? options.maxLevel : 200;
  const filterJob = options.jobId && options.jobId !== "all" ? options.jobId : null;
  const searchFilter = (options.searchTerm || "").toLowerCase().trim();

  for (const item of allRecipesSnapshot) {
    if (item.level < minLvl || item.level > maxLvl) continue;
    if (filterJob && item.jobId !== filterJob) continue;

    const recipe = item.recipeData || getRecipeByResultId(item.id);
    if (!recipe || !recipe.ingredientIds || recipe.ingredientIds.length === 0) continue;

    // Fast check: Skip recipes that don't use ANY of the bank ingredients
    let hasMatchingBankIngredient = false;
    for (let i = 0; i < recipe.ingredientIds.length; i++) {
      if (bankMap.has(recipe.ingredientIds[i])) {
        hasMatchingBankIngredient = true;
        break;
      }
    }
    if (!hasMatchingBankIngredient) {
      continue;
    }

    if (searchFilter) {
      const name = getItemName(item).toLowerCase();
      if (!name.includes(searchFilter)) continue;
    }

    let hasAtLeastOneBankIngredient = false;
    let availableIngredientsCount = 0;
    const totalIngredientsCount = recipe.ingredientIds.length;
    let bankMaterialsValue = 0;
    let missingMaterialsCost = 0;
    let totalCraftCost = 0;
    let isFullyCraftable = true;
    let possibleCraftBatches = Infinity;

    const ingredientsStatus: ReverseCraftIngredientStatus[] = [];

    for (let i = 0; i < recipe.ingredientIds.length; i++) {
      const ingId = recipe.ingredientIds[i];
      const required = recipe.quantities[i] || 1;
      const inBank = bankMap.get(ingId) || 0;
      const unitPrice = marketPrices[ingId] || getStoredItemPrice(ingId) || 0;
      const ingItem = getItemById(ingId);
      const ingName = getItemName(ingItem || { id: ingId });
      const ingIcon = ingItem?.iconId || ingId;

      const missing = Math.max(0, required - inBank);
      const isFullyAvailable = inBank >= required;
      const ingMissingCost = missing * unitPrice;
      const ingBankCost = Math.min(required, inBank) * unitPrice;

      if (inBank > 0) {
        hasAtLeastOneBankIngredient = true;
        availableIngredientsCount++;
      }
      if (!isFullyAvailable) {
        isFullyCraftable = false;
      }

      const batchesWithThisIng = Math.floor(inBank / required);
      if (batchesWithThisIng < possibleCraftBatches) {
        possibleCraftBatches = batchesWithThisIng;
      }

      bankMaterialsValue += ingBankCost;
      missingMaterialsCost += ingMissingCost;
      totalCraftCost += required * unitPrice;

      ingredientsStatus.push({
        itemId: ingId,
        itemName: ingName,
        itemIconId: ingIcon,
        required,
        inBank,
        missing,
        unitPrice,
        missingCost: ingMissingCost,
        isFullyAvailable,
      });
    }

    if (options.onlyFullyCraftable && !isFullyCraftable) {
      continue;
    }

    if (!hasAtLeastOneBankIngredient) {
      continue;
    }

    const maxCraftableWithBank = isFullyCraftable && isFinite(possibleCraftBatches) ? possibleCraftBatches : 0;
    const materialsCoveragePercent = totalIngredientsCount > 0
      ? Math.round((availableIngredientsCount / totalIngredientsCount) * 100)
      : 0;

    const marketSalePrice = marketPrices[item.id] || getStoredItemPrice(item.id) || item.defaultMarketSalePrice || (totalCraftCost * 1.3);
    const netProfit = marketSalePrice - totalCraftCost;
    const roi = totalCraftCost > 0 ? ((netProfit / totalCraftCost) * 100) : 0;

    results.push({
      item,
      recipe,
      jobId: item.jobId,
      jobNameEs: item.jobNameEs,
      totalCraftCost,
      marketSalePrice,
      netProfit,
      roi,
      maxCraftableWithBank,
      materialsCoveragePercent,
      availableIngredientsCount,
      totalIngredientsCount,
      bankMaterialsValue,
      missingMaterialsCost,
      ingredientsStatus,
      isFullyCraftable,
    });
  }

  return results;
}



