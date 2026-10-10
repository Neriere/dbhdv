import {
  DofusItem,
  DofusRecipe,
  SyncSettings,
  SyncStatus,
} from "../../types";
import { getDofusDbSeedDataAsync } from "../../data/dofusDbSeedData";
import { syncRemoteSalesVolume } from "../salesVolumeService";
import { CACHE_KEY, getIdbVal, setIdbVal } from "./cache";
import { DEFAULT_PRICE_PROFILES } from "./constants";
import {
  emitDatabaseUpdated,
  getItemsCache,
  getIsDbInitialized,
  getRecipesCache,
  getSyncSettingsCache,
  getSyncStatusCache,
  LOCAL_DB_API_BASE,
  requestJson,
  setSyncStatusCache,
  updateMemoryCache,
} from "./store";
import { BootstrapResponse } from "./types";
import { setPricesInitDbTrigger, startLivePriceAutoSync } from "./prices";
import { setInitDbTrigger } from "./items";
import { setRecipesInitDbTrigger } from "./recipes";
import { setCraftSnapshotsInitDbTrigger } from "./craftSnapshots";

export * from "./importer";

let bootstrapPromise: Promise<BootstrapResponse> | null = null;

// Connect lazy initialization triggers
setInitDbTrigger(initializeDatabase);
setPricesInitDbTrigger(initializeDatabase);
setRecipesInitDbTrigger(initializeDatabase);
setCraftSnapshotsInitDbTrigger(initializeDatabase);

export async function executeBootstrapFetch(): Promise<BootstrapResponse> {
  const isRealBrowser =
    typeof window !== "undefined" &&
    typeof window.location?.origin === "string" &&
    window.location.origin.startsWith("http");

  if (!isRealBrowser) {
    try {
      const seed = await getDofusDbSeedDataAsync();
      const finalRecipes: Record<number, any> = {};
      for (const r of seed.recipes || []) {
        if (r.resultId) finalRecipes[r.resultId] = r;
      }
      return {
        items: seed.items || [],
        recipes: finalRecipes,
        prices: {},
        priceUpdatedAt: {},
        syncStatus: getSyncStatusCache(),
        syncSettings: { enabled: true, intervalDays: 30 },
        priceProfiles: DEFAULT_PRICE_PROFILES,
        activePriceProfileId: 1,
        databasePath: "local.db",
      };
    } catch {
      return {
        items: [],
        recipes: {},
        prices: {},
        priceUpdatedAt: {},
        syncStatus: getSyncStatusCache(),
        syncSettings: { enabled: true, intervalDays: 30 },
        priceProfiles: DEFAULT_PRICE_PROFILES,
        activePriceProfileId: 1,
        databasePath: "local.db",
      };
    }
  }

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

  let finalItems = bootstrap.items;
  let finalRecipes = bootstrap.recipes;

  if (!finalItems || finalItems.length < 100) {
    try {
      const seed = await getDofusDbSeedDataAsync();
      if (seed.items && seed.items.length > 0) {
        finalItems = seed.items;
        finalRecipes = {};
        for (const r of seed.recipes) {
          finalRecipes[r.resultId] = r;
        }
      }
    } catch (err) {
      console.warn("No se pudo cargar el dataset empaquetado de Dofus:", err);
    }
  }

  const hydratedBootstrap: BootstrapResponse = {
    ...bootstrap,
    items: finalItems || [],
    recipes: finalRecipes || {},
  };

  updateMemoryCache({
    items: hydratedBootstrap.items,
    recipes: hydratedBootstrap.recipes,
    prices: hydratedBootstrap.prices,
    priceUpdatedAt: hydratedBootstrap.priceUpdatedAt,
    coefficients: hydratedBootstrap.coefficients,
    coefficientUpdatedAt: hydratedBootstrap.coefficientUpdatedAt,
    manualEdits: hydratedBootstrap.manualEdits,
    syncStatus: hydratedBootstrap.syncStatus,
    syncSettings: hydratedBootstrap.syncSettings,
    priceProfiles: hydratedBootstrap.priceProfiles,
    activePriceProfileId: hydratedBootstrap.activePriceProfileId,
  });

  if (hydratedBootstrap.salesVolume) {
    syncRemoteSalesVolume(hydratedBootstrap.salesVolume);
  }

  if (typeof window !== "undefined") {
    void setIdbVal(CACHE_KEY, hydratedBootstrap);
    window.dispatchEvent(
      new CustomEvent("dofus_prices_updated", {
        detail: {
          profileId: hydratedBootstrap.activePriceProfileId,
          updatedPrices: hydratedBootstrap.prices,
          priceUpdatedAt: hydratedBootstrap.priceUpdatedAt,
          count: Object.keys(hydratedBootstrap.prices || {}).length,
          timestamp: Date.now(),
        },
      })
    );
    emitDatabaseUpdated();
  }

  return hydratedBootstrap;
}

export async function fetchBootstrapInBackground(): Promise<{
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
    items: getItemsCache(),
    recipes: getRecipesCache(),
  };
}

export async function initializeDatabase(): Promise<{
  items: DofusItem[];
  recipes: Record<number, DofusRecipe>;
}> {
  startLivePriceAutoSync();

  const currentItems = getItemsCache();
  if (getIsDbInitialized() && currentItems.length > 50) {
    return {
      items: currentItems,
      recipes: getRecipesCache(),
    };
  }

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

        void fetchBootstrapInBackground();

        return {
          items: getItemsCache(),
          recipes: getRecipesCache(),
        };
      }
    } catch (e) {
      console.warn("Error al leer la caché IndexedDB:", e);
    }
  }

  return await fetchBootstrapInBackground();
}

export function getStoredSyncStatus(): SyncStatus {
  return getSyncStatusCache();
}

export const getSyncStatus = getStoredSyncStatus;

export function getStoredSyncSettings(): SyncSettings {
  return getSyncSettingsCache();
}

export const getSyncSettings = getStoredSyncSettings;

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
  return getSyncSettingsCache();
}

export async function fetchLiveSyncStatus(): Promise<SyncStatus> {
  try {
    const status = await requestJson<SyncStatus>(`${LOCAL_DB_API_BASE}/sync-status`);
    if (status) {
      setSyncStatusCache(status);
      emitDatabaseUpdated();
    }
    return status;
  } catch {
    return getSyncStatusCache();
  }
}

export async function resetLocalSyncStatus(): Promise<SyncStatus> {
  try {
    const status = await requestJson<SyncStatus>(`${LOCAL_DB_API_BASE}/reset-sync-status`, {
      method: "POST",
    });
    if (status) {
      setSyncStatusCache(status);
      emitDatabaseUpdated();
    }
    return status;
  } catch {
    const currentStatus = getSyncStatusCache();
    const updatedStatus: SyncStatus = {
      ...currentStatus,
      isLoading: false,
      progressPercent: 100,
      progressMessage: "Listo.",
    };
    setSyncStatusCache(updatedStatus);
    emitDatabaseUpdated();
    return updatedStatus;
  }
}
