import {
  DofusItem,
  DofusRecipe,
  MarketPriceMap,
  PriceProfile,
  PriceUpdatedAtMap,
  RecipeTreeNode,
  SyncSettings,
  SyncStatus,
} from "../../types";
import { isClassItem, isOmittedItem } from "../../data/dofusJobs";
import {
  ALL_PRESET_ITEMS,
  DEFAULT_PRICE_PROFILES,
  DEFAULT_SYNC_SETTINGS,
  DEFAULT_SYNC_STATUS,
} from "./constants";
import { CACHE_KEY, setIdbVal } from "./cache";
import { CraftableItem } from "./types";

export const LOCAL_DB_API_BASE = "/api/local-db";

// Memory caches
let itemsMemoryCache: DofusItem[] = [];
let recipesMemoryCache: Record<number, DofusRecipe> = {};
let pricesMemoryCache: MarketPriceMap = {};
let priceUpdatedAtMemoryCache: PriceUpdatedAtMap = {};
let coefficientsMemoryCache: Record<number, number> = {};
let coefficientUpdatedAtMemoryCache: Record<number, number> = {};
let syncStatusMemoryCache: SyncStatus = { ...DEFAULT_SYNC_STATUS };
let syncSettingsMemoryCache: SyncSettings = { ...DEFAULT_SYNC_SETTINGS };
let priceProfilesMemoryCache: PriceProfile[] = [...DEFAULT_PRICE_PROFILES];
let activePriceProfileIdMemoryCache = 1;
let isDbInitialized = false;

// Pre-computed snapshot and index caches
let cachedCraftableSnapshot: CraftableItem[] | null = null;
let cachedCrushableSnapshot: CraftableItem[] | null = null;
let ingredientToRecipesIndex: Map<number, Set<number>> = new Map();
let recipeTreeMapCache: Map<string, RecipeTreeNode> = new Map();
let craftCostMemo: Map<number, number> = new Map();
let lowestDetectedPriceMemo: Map<number, number> = new Map();

let dbUpdateRafId: number | null = null;

export function emitDatabaseUpdated(): void {
  if (typeof window === "undefined") return;
  if (dbUpdateRafId) return;
  dbUpdateRafId = requestAnimationFrame(() => {
    dbUpdateRafId = null;
    window.dispatchEvent(new CustomEvent("dofus_database_updated"));
  });
}

export function rebuildIngredientReverseIndex(): void {
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

export function clearRecipeTreeCache(): void {
  recipeTreeMapCache.clear();
  cachedCraftableSnapshot = null;
  craftCostMemo.clear();
  lowestDetectedPriceMemo.clear();
}

export function invalidateDerivedCaches(): void {
  cachedCraftableSnapshot = null;
  cachedCrushableSnapshot = null;
  recipeTreeMapCache.clear();
  rebuildIngredientReverseIndex();
}

export function mergePresetData(
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

export function updateMemoryCache(payload: {
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
  manualEdits?: Record<number, number>;
  replacePrices?: boolean;
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
    itemsMemoryCache = merged.items.filter((item) => !isOmittedItem(item) && !isClassItem(item));
    recipesMemoryCache = merged.recipes;
    changedStructure = true;
  }

  if (payload.prices) {
    if (payload.replacePrices) {
      pricesMemoryCache = { ...payload.prices };
      priceUpdatedAtMemoryCache = { ...(payload.priceUpdatedAt || {}) };
    } else if (payload.priceUpdatedAt) {
      for (const [idStr, price] of Object.entries(payload.prices)) {
        const id = Number(idStr);
        const incomingTime = payload.priceUpdatedAt[id] || 0;
        const localTime = priceUpdatedAtMemoryCache[id] || 0;
        if (incomingTime >= localTime || pricesMemoryCache[id] === undefined) {
          pricesMemoryCache[id] = price;
          priceUpdatedAtMemoryCache[id] = incomingTime;
        }
      }
    } else {
      pricesMemoryCache = { ...pricesMemoryCache, ...payload.prices };
    }
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
      if (payload.manualEdits && Object.keys(payload.manualEdits).length > 0) {
        localStorage.setItem(
          `dofus_user_item_coeff_manual_edits_${activeProfile.slug}`,
          JSON.stringify(payload.manualEdits)
        );
      }
    }
  }

  if (changedStructure) {
    invalidateDerivedCaches();
  } else if (payload.prices) {
    recipeTreeMapCache.clear();
    cachedCraftableSnapshot = null;
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

export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
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

// Memory Cache Getters & Setters
export function getItemsCache(): DofusItem[] {
  return itemsMemoryCache;
}
export function setItemsCache(items: DofusItem[]): void {
  itemsMemoryCache = items;
}

export function getRecipesCache(): Record<number, DofusRecipe> {
  return recipesMemoryCache;
}
export function setRecipesCache(recipes: Record<number, DofusRecipe>): void {
  recipesMemoryCache = recipes;
}

export function getPricesCache(): MarketPriceMap {
  return pricesMemoryCache;
}
export function setPricesCache(prices: MarketPriceMap): void {
  pricesMemoryCache = prices;
}

export function getPriceUpdatedAtCache(): PriceUpdatedAtMap {
  return priceUpdatedAtMemoryCache;
}
export function setPriceUpdatedAtCache(times: PriceUpdatedAtMap): void {
  priceUpdatedAtMemoryCache = times;
}

export function getCoefficientsCache(): Record<number, number> {
  return coefficientsMemoryCache;
}

export function getCoefficientUpdatedAtCache(): Record<number, number> {
  return coefficientUpdatedAtMemoryCache;
}

export function getSyncStatusCache(): SyncStatus {
  return syncStatusMemoryCache;
}
export function setSyncStatusCache(status: SyncStatus): void {
  syncStatusMemoryCache = status;
}

export function getSyncSettingsCache(): SyncSettings {
  return syncSettingsMemoryCache;
}
export function setSyncSettingsCache(settings: SyncSettings): void {
  syncSettingsMemoryCache = settings;
}

export function getPriceProfilesCache(): PriceProfile[] {
  return priceProfilesMemoryCache;
}
export function setPriceProfilesCache(profiles: PriceProfile[]): void {
  priceProfilesMemoryCache = profiles;
}

export function getActivePriceProfileIdCache(): number {
  return activePriceProfileIdMemoryCache;
}
export function setActivePriceProfileIdCache(id: number): void {
  activePriceProfileIdMemoryCache = id;
}

export function getIsDbInitialized(): boolean {
  return isDbInitialized;
}
export function setIsDbInitialized(val: boolean): void {
  isDbInitialized = val;
}

// Snapshot & memo accessors
export function getCachedCraftableSnapshot(): CraftableItem[] | null {
  return cachedCraftableSnapshot;
}
export function setCachedCraftableSnapshot(s: CraftableItem[] | null): void {
  cachedCraftableSnapshot = s;
}

export function getCachedCrushableSnapshot(): CraftableItem[] | null {
  return cachedCrushableSnapshot;
}
export function setCachedCrushableSnapshot(s: CraftableItem[] | null): void {
  cachedCrushableSnapshot = s;
}

export function getIngredientToRecipesIndex(): Map<number, Set<number>> {
  return ingredientToRecipesIndex;
}

export function getRecipeTreeMapCache(): Map<string, RecipeTreeNode> {
  return recipeTreeMapCache;
}

export function getCraftCostMemo(): Map<number, number> {
  return craftCostMemo;
}

export function getLowestDetectedPriceMemo(): Map<number, number> {
  return lowestDetectedPriceMemo;
}
