import {
  CraftStrategyMode,
  DofusItem,
  DofusRecipe,
  MarketPriceMap,
  PriceProfile,
  PriceUpdatedAtMap,
  RecipeTreeNode,
  SyncSettings,
  SyncStatus,
} from "../types";
import { getJobForItem, isOmittedItem } from "../data/dofusJobs";
import { PRESET_CRAFTABLE_ITEMS } from "../data/presetCraftableItems";

const LOCAL_DB_API_BASE = "/api/local-db";

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
  monsters: [47, 48, 53, 54, 55, 56, 57, 59, 103, 104, 105, 106, 107, 108, 109, 110, 111, 119, 15, 74, 96, 98, 152, 219, 229, 278],
  equipment: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 16, 17, 19, 82, 112, 151, 217, 271],
  craft_ingredients: [
    12, 15, 26, 28, 33, 34, 35, 36, 37, 38, 39, 40, 41, 46, 47, 48, 49, 50,
    51, 53, 54, 55, 56, 57, 58, 59, 60, 62, 63, 64, 66, 68, 69, 70, 71, 79,
    83, 85, 91, 95, 96, 98, 103, 104, 105, 106, 107, 108, 109, 110, 111, 119,
    128, 129, 134, 135, 150, 152, 153, 167, 170, 179, 183, 185, 187, 206, 219,
    228, 229, 242, 278, 307, 308,
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
    if (!itemMap.has(preset.id)) {
      itemMap.set(preset.id, preset);
    }
    if (preset.recipeData && !mergedRecipes[preset.recipeData.resultId]) {
      mergedRecipes[preset.recipeData.resultId] = preset.recipeData;
    }
  }

  return { items: Array.from(itemMap.values()), recipes: mergedRecipes };
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
  if (payload.items || payload.recipes) {
    const merged = mergePresetData(
      payload.items ?? itemsMemoryCache,
      payload.recipes ?? recipesMemoryCache,
    );
    itemsMemoryCache = merged.items;
    recipesMemoryCache = merged.recipes;
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

  isDbInitialized = true;
  emitDatabaseUpdated();
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
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

export async function initializeDatabase(): Promise<{
  items: DofusItem[];
  recipes: Record<number, DofusRecipe>;
}> {
  if (bootstrapPromise) {
    const existingBootstrap = await bootstrapPromise;
    return {
      items: existingBootstrap.items,
      recipes: existingBootstrap.recipes,
    };
  }

  bootstrapPromise = requestJson<BootstrapResponse>(`${LOCAL_DB_API_BASE}/bootstrap`);

  try {
    const bootstrap = await bootstrapPromise;
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

    return {
      items: itemsMemoryCache,
      recipes: recipesMemoryCache,
    };
  } finally {
    bootstrapPromise = null;
  }
}

export function getStoredRecipes(): Record<number, DofusRecipe> {
  if (!isDbInitialized) {
    void initializeDatabase();
  }
  return recipesMemoryCache;
}

export function getItemName(item: unknown): string {
  if (!item || typeof item !== "object") {
    return "Objeto sin nombre";
  }

  const typedItem = item as {
    id?: number;
    title?: string;
    name?: string | { es?: string; fr?: string; en?: string };
  };

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
    type?: { id?: number; name?: string | { es?: string; fr?: string; en?: string } };
  };

  if (typeof typedItem.type?.name === "string") {
    return typedItem.type.name;
  }

  if (typedItem.type?.name && typeof typedItem.type.name === "object") {
    return (
      typedItem.type.name.es ||
      typedItem.type.name.fr ||
      typedItem.type.name.en ||
      ""
    );
  }

  const typeId = typedItem.typeId || typedItem.type?.id || 0;
  return TYPE_NAME_MAP[typeId] || "";
}

export function getItemIconUrl(item: { iconId?: number } | null | undefined): string {
  const iconId = Number(item?.iconId || 0);
  if (!iconId) {
    return getItemFallbackIconUrl(item);
  }
  return `https://api.dofusdb.fr/img/items/${iconId}.png`;
}

export function getItemFallbackIconUrl(
  item: { iconId?: number } | null | undefined,
): string {
  const iconId = Number(item?.iconId || 0);
  if (!iconId) {
    return "https://placehold.co/64x64/111111/f59e0b?text=%3F";
  }
  return `https://s.dofusdu.de/articles/dofus/es/100/${iconId}.png`;
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

export function getSyncStatus(): SyncStatus {
  return syncStatusMemoryCache;
}

export function getSyncSettings(): SyncSettings {
  return syncSettingsMemoryCache;
}

export function getPriceProfiles(): PriceProfile[] {
  return priceProfilesMemoryCache;
}

export function getActivePriceProfileId(): number {
  return activePriceProfileIdMemoryCache;
}

export function getImportedItems(): DofusItem[] {
  if (!isDbInitialized) {
    void initializeDatabase();
  }
  return itemsMemoryCache.filter((item) => {
    if (isOmittedItem(item)) {
      return false;
    }

    const spanishName = item.name?.es || item.name?.fr || item.name?.en || '';
    if ((item.typeId || item.type?.id || 0) === 0 && spanishName.startsWith('Objeto #')) {
      return false;
    }

    return true;
  });
}

export function getCraftableItemsSnapshot(): CraftableItem[] {
  const importedItems = getImportedItems();
  const storedRecipes = getStoredRecipes();
  const importedMap = new Map<number, DofusItem>();
  importedItems.forEach((item) => importedMap.set(item.id, item));

  const resultList: CraftableItem[] = [];
  const processedResultIds = new Set<number>();

  for (const [resultIdStr, recipe] of Object.entries(storedRecipes)) {
    const resultId = Number(resultIdStr);
    if (!resultId) {
      continue;
    }

    processedResultIds.add(resultId);
    const existingItem = importedMap.get(resultId);
    const presetItem = PRESET_CRAFTABLE_ITEMS.find((item) => item.id === resultId);
    const itemToUse = existingItem || presetItem;

    if (itemToUse && isOmittedItem(itemToUse)) {
      continue;
    }

    const job = getJobForItem(itemToUse || { id: resultId, typeId: 0 }, recipe);
    if (job.jobId === 0) {
      continue;
    }

    if (itemToUse) {
      resultList.push({
        ...itemToUse,
        jobId: job.jobId,
        jobNameEs: job.jobNameEs,
        defaultMarketSalePrice: itemToUse.price || 0,
        recipeData: recipe,
      });
      continue;
    }

    resultList.push({
      id: resultId,
      level: 1,
      name: { es: `Objeto #${resultId}`, fr: `Objet #${resultId}`, en: `Item #${resultId}` },
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
      (item as DofusItem & { recipe?: DofusRecipe; craft?: DofusRecipe; recipes?: DofusRecipe[] | DofusRecipe }).recipe ??
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

    resultList.push({
      ...item,
      jobId: job.jobId,
      jobNameEs: job.jobNameEs,
      defaultMarketSalePrice: 0,
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

  return resultList;
}

export async function performFullItemImport(
  onProgress?: (status: SyncStatus) => void,
): Promise<{ items: DofusItem[]; status: SyncStatus }> {
  const loadingStatus: SyncStatus = {
    ...syncStatusMemoryCache,
    isLoading: true,
    progressMessage: "Importando a la base local...",
  };
  syncStatusMemoryCache = loadingStatus;
  if (onProgress) {
    onProgress(loadingStatus);
  }
  emitDatabaseUpdated();

  const response = await requestJson<BootstrapResponse>(`${LOCAL_DB_API_BASE}/import`, {
    method: "POST",
  });

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

export async function setActiveLocalPriceProfile(profileId: number): Promise<void> {
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

export async function fetchRecipeByResultId(resultId: number): Promise<DofusRecipe | null> {
  if (recipesMemoryCache[resultId]) {
    return recipesMemoryCache[resultId];
  }

  try {
    const recipe = await requestJson<DofusRecipe>(`${LOCAL_DB_API_BASE}/recipes/${resultId}`);
    updateMemoryCache({
      recipes: { ...recipesMemoryCache, [resultId]: recipe },
    });
    return recipe;
  } catch (error) {
    console.warn(`No se pudo obtener la receta ${resultId}:`, error);
    return null;
  }
}

export async function fetchItemDetailsById(itemId: number): Promise<DofusItem | null> {
  const localItem = itemsMemoryCache.find((item) => item.id === itemId);
  if (localItem && localItem.name?.es && !localItem.name.es.startsWith("Objeto #")) {
    return localItem;
  }

  try {
    const item = await requestJson<DofusItem>(`${LOCAL_DB_API_BASE}/items/${itemId}`);
    const nextItems = [...itemsMemoryCache];
    const currentIndex = nextItems.findIndex((entry) => entry.id === item.id);
    if (currentIndex >= 0) {
      nextItems[currentIndex] = item;
    } else {
      nextItems.push(item);
    }
    updateMemoryCache({ items: nextItems });
    return item;
  } catch (error) {
    console.warn(`No se pudo obtener el item ${itemId}:`, error);
    return localItem || null;
  }
}

export async function resolveMissingItemNamesInBatch(
  itemIds: number[],
  onUpdated?: () => void,
): Promise<void> {
  const idsToResolve = itemIds.filter((itemId) => {
    const cachedItem = itemsMemoryCache.find((item) => item.id === itemId);
    return !cachedItem || !cachedItem.name?.es || cachedItem.name.es.startsWith("Objeto #");
  });

  if (idsToResolve.length === 0) {
    return;
  }

  const response = await requestJson<{ updatedItems: DofusItem[] }>(
    `${LOCAL_DB_API_BASE}/items/resolve-names`,
    {
      method: "POST",
      body: JSON.stringify({ itemIds: idsToResolve }),
    },
  );

  if (response.updatedItems.length === 0) {
    return;
  }

  const itemsMap = new Map<number, DofusItem>();
  itemsMemoryCache.forEach((item) => itemsMap.set(item.id, item));
  response.updatedItems.forEach((item) => itemsMap.set(item.id, item));
  updateMemoryCache({ items: Array.from(itemsMap.values()) });

  if (onUpdated) {
    onUpdated();
  }
}

export async function fetchCategoryItemsFromApi(categoryKey: string): Promise<DofusItem[]> {
  const typeIds = CATEGORY_TYPE_IDS_MAP[categoryKey];
  if (!typeIds || typeIds.length === 0) {
    return getImportedItems();
  }

  const response = await requestJson<{ items: DofusItem[] }>(
    `${LOCAL_DB_API_BASE}/category-items`,
    {
      method: "POST",
      body: JSON.stringify({ typeIds }),
    },
  );

  updateMemoryCache({ items: response.items });
  return getImportedItems();
}

export async function seedCoreResourcesAndRecipes(): Promise<void> {
  await initializeDatabase();
  const categoriesToSeed = [
    "campesino",
    "lenador",
    "alquimista",
    "minero",
    "pescador",
    "cazador",
    "monsters",
    "craft_ingredients",
  ];

  for (const category of categoriesToSeed) {
    await fetchCategoryItemsFromApi(category);
  }
}

export async function searchItemsFromApi(searchTerm: string): Promise<DofusItem[]> {
  const trimmedTerm = searchTerm.trim();
  if (!trimmedTerm || trimmedTerm.length < 2) {
    return getImportedItems();
  }

  const response = await requestJson<{ items: DofusItem[] }>(
    `${LOCAL_DB_API_BASE}/search-items?term=${encodeURIComponent(trimmedTerm)}`,
  );

  updateMemoryCache({ items: response.items });
  return getImportedItems();
}

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

  const recipe = await fetchRecipeByResultId(itemId);
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
    subIngredients.push({
      itemId: ingredientId,
      quantity: ingredientQuantity,
      item:
        fallbackItem || {
          id: ingredientId,
          name: { es: `Ingrediente #${ingredientId}` },
          level: 1,
          typeId: 0,
          iconId: 0,
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
  if (!node.subIngredients || node.subIngredients.length === 0 || !node.isCraftable) {
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
      return total + calculateTreeCraftCost(child, "full_subcraft", marketPrices);
    }, 0);
  }

  if (strategy === "auto_optimal") {
    return node.subIngredients.reduce((total, child) => {
      const childBuyPrice =
        (marketPrices[child.itemId] || child.marketPrice || 0) * child.quantity;

      if (!child.isCraftable || !child.subIngredients || child.subIngredients.length === 0) {
        return total + childBuyPrice;
      }

      const childCraftCost = calculateTreeCraftCost(child, "auto_optimal", marketPrices);
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

export function autoOptimizeTreeDecisions(
  node: RecipeTreeNode,
  marketPrices: MarketPriceMap,
): RecipeTreeNode {
  if (!node.subIngredients || node.subIngredients.length === 0 || !node.isCraftable) {
    return { ...node, decision: "buy" };
  }

  const updatedSubIngredients = node.subIngredients.map((child) =>
    autoOptimizeTreeDecisions(child, marketPrices),
  );

  const buyCost = (marketPrices[node.itemId] || node.marketPrice || 0) * node.quantity;
  const craftCost = updatedSubIngredients.reduce((total, child) => {
    if (child.decision === "buy" || !child.isCraftable) {
      return total + (marketPrices[child.itemId] || child.marketPrice || 0) * child.quantity;
    }

    return total + calculateTreeCraftCost(child, "custom_hybrid", marketPrices);
  }, 0);

  return {
    ...node,
    decision: craftCost < buyCost ? "craft" : "buy",
    subIngredients: updatedSubIngredients,
  };
}
