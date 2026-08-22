import {
  DofusEffect,
  DofusItem,
  DofusRecipe,
  MarketPriceMap,
  PriceProfile,
  PriceUpdatedAtMap,
  RecipeTreeNode,
  SyncSettings,
  SyncStatus,
} from "../types";
import {
  isClassItem,
  isCrushableJob,
  isOmittedItem,
  isCosmeticItem,
  isPetItem,
  getJobForItem,
  DOFUS_JOBS,
} from "../data/dofusJobs";
import {
  PRESET_CRAFTABLE_ITEMS,
  DEFAULT_INGREDIENT_PRICES,
  PresetCraftableItem,
} from "../data/presetCraftableItems";
import {
  BASE_RUNES_BY_ID,
  DOFUS_BASE_RUNES,
  extractItemStats,
} from "../data/dofusRuneWeights";

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
let syncStatusMemoryCache: SyncStatus = { ...DEFAULT_SYNC_STATUS };
let syncSettingsMemoryCache: SyncSettings = { ...DEFAULT_SYNC_SETTINGS };
let priceProfilesMemoryCache: PriceProfile[] = [];
let activePriceProfileIdMemoryCache = 0;
let isDbInitialized = false;
let bootstrapPromise: Promise<BootstrapResponse> | null = null;

// Pre-computed and cached snapshots for ultra-fast UI rendering
let cachedCraftableSnapshot: CraftableItem[] | null = null;
let cachedCrushableSnapshot: CraftableItem[] | null = null;

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
  for (const preset of PRESET_CRAFTABLE_ITEMS) {
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

function invalidateDerivedCaches(): void {
  cachedCraftableSnapshot = null;
  cachedCrushableSnapshot = null;
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
    itemsMemoryCache = merged.items;
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
    throw new Error(errorText || `HTTP ${response.status}`);
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
  if (!item || typeof item !== "object") {
    return "https://api.dofusdb.fr/img/items/0.png";
  }

  const typed = item as {
    iconId?: number;
    icon_id?: number;
    id?: number;
    img?: string;
  };

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

  const typed = item as { id?: number; iconId?: number; icon_id?: number };
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

const presetItemMap = new Map<number, PresetCraftableItem>(
  PRESET_CRAFTABLE_ITEMS.map((item) => [item.id, item]),
);

export function getCraftableItemsSnapshot(): CraftableItem[] {
  if (
    cachedCraftableSnapshot &&
    cachedCraftableSnapshot.length > PRESET_CRAFTABLE_ITEMS.length
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

    if (itemToUse && isCosmeticItem(itemToUse as any)) {
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
    if (processedResultIds.has(item.id) || isOmittedItem(item)) {
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

  for (const preset of PRESET_CRAFTABLE_ITEMS) {
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
  }>(`${LOCAL_DB_API_BASE}/price-profiles/active`, {
    method: "PUT",
    body: JSON.stringify({ profileId }),
  });

  updateMemoryCache({
    priceProfiles: response.profiles,
    activePriceProfileId: response.activePriceProfileId,
    prices: response.prices,
    priceUpdatedAt: response.priceUpdatedAt,
  });
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

  const loadingStatus: SyncStatus = {
    ...syncStatusMemoryCache,
    isLoading: true,
    progressPercent: 2,
    currentStep: "Iniciando importación",
    progressMessage: "Conectando con DofusDB y preparando descarga...",
  };
  syncStatusMemoryCache = loadingStatus;
  if (onProgress) {
    onProgress(loadingStatus);
  }
  emitDatabaseUpdated();

  // Setup periodic polling to track real-time server download/save progress
  let isDone = false;
  const pollInterval = setInterval(async () => {
    if (isDone) return;
    try {
      const liveStatus = await requestJson<SyncStatus>(`${LOCAL_DB_API_BASE}/sync-status`);
      if (liveStatus && !isDone) {
        syncStatusMemoryCache = liveStatus;
        if (onProgress) {
          onProgress(liveStatus);
        }
        emitDatabaseUpdated();
      }
    } catch {
      // Ignore polling errors
    }
  }, 1000);

  try {
    const response = await requestJson<BootstrapResponse>(
      `${LOCAL_DB_API_BASE}/import`,
      {
        method: "POST",
      },
    );

    isDone = true;
    clearInterval(pollInterval);

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

    if (onProgress) {
      onProgress(syncStatusMemoryCache);
    }

    return { items: getImportedItems(), status: syncStatusMemoryCache };
  } catch (error) {
    isDone = true;
    clearInterval(pollInterval);
    syncStatusMemoryCache = {
      ...syncStatusMemoryCache,
      isLoading: false,
      progressMessage: "Error durante la importación. Intenta de nuevo.",
    };
    if (onProgress) {
      onProgress(syncStatusMemoryCache);
    }
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

  const loadingStatus: SyncStatus = {
    ...syncStatusMemoryCache,
    isLoading: true,
    progressPercent: 25,
    currentStep: "Sembrando base de datos",
    progressMessage: "Insertando 9,762 objetos y 4,858 recetas directamente en Turso...",
  };
  syncStatusMemoryCache = loadingStatus;
  if (onProgress) onProgress(loadingStatus);
  emitDatabaseUpdated();

  try {
    const response = await requestJson<BootstrapResponse>(
      `${LOCAL_DB_API_BASE}/fast-seed`,
      {
        method: "POST",
        body: JSON.stringify({ force }),
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

    if (onProgress) onProgress(syncStatusMemoryCache);
    emitDatabaseUpdated();
    return { items: getImportedItems(), status: syncStatusMemoryCache };
  } catch (err) {
    syncStatusMemoryCache = {
      ...syncStatusMemoryCache,
      isLoading: false,
      progressMessage: "Error al sembrar base de datos.",
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
  return node;
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
