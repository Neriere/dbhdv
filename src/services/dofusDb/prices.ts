import {
  MarketPriceMap,
  PriceProfile,
  PriceUpdatedAtMap,
} from "../../types";
import {
  bulkSaveItemCoefficients,
  resolveServerSlug,
  saveItemCoefficient,
} from "../../data/dofusRuneWeights";
import { CACHE_KEY, CACHE_TIMESTAMP_KEY, setIdbVal } from "./cache";
import { DEFAULT_PRICE_PROFILES } from "./constants";
import {
  clearRecipeTreeCache,
  emitDatabaseUpdated,
  getActivePriceProfileIdCache,
  getItemsCache,
  getIsDbInitialized,
  getPriceProfilesCache,
  getPriceUpdatedAtCache,
  getPricesCache,
  getRecipesCache,
  getSyncSettingsCache,
  getSyncStatusCache,
  LOCAL_DB_API_BASE,
  requestJson,
  updateMemoryCache,
} from "./store";
import {
  getMarketBroadcastChannel,
  resetLivePriceSyncTimestamp,
  touchLastPriceUpdateTime,
} from "./priceSync";

export * from "./priceSync";
export * from "./priceHistory";

let initDbTrigger: (() => Promise<unknown>) | null = null;
export function setPricesInitDbTrigger(fn: () => Promise<unknown>): void {
  initDbTrigger = fn;
}

function ensureInitialized(): void {
  if (!getIsDbInitialized() && initDbTrigger) {
    void initDbTrigger();
  }
}

export function getLocalServerPrices(serverSlug: string): {
  prices: MarketPriceMap;
  priceUpdatedAt: PriceUpdatedAtMap;
} {
  if (typeof window === "undefined") {
    return { prices: {}, priceUpdatedAt: {} };
  }
  const cleanSlug = resolveServerSlug(serverSlug);
  try {
    const rawPrices = localStorage.getItem(`dofus_server_prices_${cleanSlug}`);
    const rawTimes = localStorage.getItem(`dofus_server_price_times_${cleanSlug}`);
    const prices: MarketPriceMap = rawPrices ? JSON.parse(rawPrices) : {};
    const priceUpdatedAt: PriceUpdatedAtMap = rawTimes ? JSON.parse(rawTimes) : {};
    return { prices, priceUpdatedAt };
  } catch {
    return { prices: {}, priceUpdatedAt: {} };
  }
}

export function saveLocalServerPrices(
  serverSlug: string,
  prices: MarketPriceMap,
  priceUpdatedAt: PriceUpdatedAtMap,
): void {
  if (typeof window === "undefined") return;
  const cleanSlug = resolveServerSlug(serverSlug);
  try {
    localStorage.setItem(`dofus_server_prices_${cleanSlug}`, JSON.stringify(prices));
    localStorage.setItem(`dofus_server_price_times_${cleanSlug}`, JSON.stringify(priceUpdatedAt));
  } catch {
    // Ignore storage quota errors
  }
}

export function getStoredMarketPrices(): MarketPriceMap {
  ensureInitialized();
  return getPricesCache();
}

export function getStoredPriceUpdatedAt(): PriceUpdatedAtMap {
  ensureInitialized();
  return getPriceUpdatedAtCache();
}

export function getStoredItemPrice(itemId: number): number {
  return getPricesCache()[itemId] || 0;
}

export function getAllStoredPrices(): MarketPriceMap {
  return getStoredMarketPrices();
}

export function getPriceProfiles(): PriceProfile[] {
  return getPriceProfilesCache();
}

export function getActivePriceProfileId(): number {
  return getActivePriceProfileIdCache();
}

export function getActivePriceProfile(): PriceProfile | undefined {
  const profiles = getPriceProfilesCache();
  const activeId = getActivePriceProfileIdCache();
  return profiles.find((p) => p.id === activeId) || profiles[0];
}

export async function saveMarketPrice(
  itemId: number,
  price: number,
): Promise<MarketPriceMap> {
  const now = Date.now();
  const pid = getActivePriceProfileIdCache() || getActivePriceProfileId() || 1;
  const profiles = getPriceProfilesCache();
  const currentProfile = profiles.find((p) => p.id === pid) || profiles[0];
  const currentSlug = currentProfile?.slug || "draconiros";

  const pricesCache = getPricesCache();
  const priceUpdatedAtCache = getPriceUpdatedAtCache();

  pricesCache[itemId] = price;
  priceUpdatedAtCache[itemId] = now;
  touchLastPriceUpdateTime();
  clearRecipeTreeCache();

  if (typeof window !== "undefined") {
    saveLocalServerPrices(currentSlug, pricesCache, priceUpdatedAtCache);

    void setIdbVal(CACHE_KEY, {
      items: getItemsCache(),
      recipes: getRecipesCache(),
      prices: pricesCache,
      priceUpdatedAt: priceUpdatedAtCache,
      syncStatus: getSyncStatusCache(),
      syncSettings: getSyncSettingsCache(),
      priceProfiles: profiles,
      activePriceProfileId: pid,
    });

    window.dispatchEvent(
      new CustomEvent("dofus_prices_updated", {
        detail: {
          profileId: pid,
          updatedPrices: { [itemId]: price },
          priceUpdatedAt: { [itemId]: now },
          count: 1,
          timestamp: now,
        },
      })
    );

    emitDatabaseUpdated();

    getMarketBroadcastChannel()?.postMessage({
      type: "PRICE_SYNC",
      profileId: pid,
      prices: { [itemId]: price },
      priceUpdatedAt: { [itemId]: now },
      serverTime: now,
    });
  }

  try {
    const response = await requestJson<{
      prices: MarketPriceMap;
      priceUpdatedAt: PriceUpdatedAtMap;
      activePriceProfileId: number;
    }>(`${LOCAL_DB_API_BASE}/prices/${itemId}`, {
      method: "PUT",
      body: JSON.stringify({
        price,
        profileId: pid,
        updatedAt: now,
      }),
    });

    if (response?.prices) {
      updateMemoryCache({
        prices: response.prices,
        priceUpdatedAt: response.priceUpdatedAt,
        activePriceProfileId: response.activePriceProfileId,
      });
      saveLocalServerPrices(currentSlug, response.prices, response.priceUpdatedAt || {});
    }
  } catch (err) {
    console.warn("[saveMarketPrice] Backend sync warning (local cache retained):", err);
  }

  return getPricesCache();
}

export async function setLocalItemPrice(itemId: number, price: number): Promise<void> {
  await saveMarketPrice(itemId, price);
}

export async function saveAllMarketPrices(
  newPricesMap: MarketPriceMap,
): Promise<MarketPriceMap> {
  const now = Date.now();
  const pid = getActivePriceProfileIdCache() || getActivePriceProfileId() || 1;
  const profiles = getPriceProfilesCache();
  const currentProfile = profiles.find((p) => p.id === pid) || profiles[0];
  const currentSlug = currentProfile?.slug || "draconiros";

  const pricesCache = getPricesCache();
  const priceUpdatedAtCache = getPriceUpdatedAtCache();

  Object.assign(pricesCache, newPricesMap);
  const nowTimestamps: PriceUpdatedAtMap = {};
  for (const k of Object.keys(newPricesMap)) {
    priceUpdatedAtCache[Number(k)] = now;
    nowTimestamps[Number(k)] = now;
  }
  touchLastPriceUpdateTime();
  clearRecipeTreeCache();

  if (typeof window !== "undefined") {
    saveLocalServerPrices(currentSlug, pricesCache, priceUpdatedAtCache);

    void setIdbVal(CACHE_KEY, {
      items: getItemsCache(),
      recipes: getRecipesCache(),
      prices: pricesCache,
      priceUpdatedAt: priceUpdatedAtCache,
      syncStatus: getSyncStatusCache(),
      syncSettings: getSyncSettingsCache(),
      priceProfiles: profiles,
      activePriceProfileId: pid,
    });

    window.dispatchEvent(
      new CustomEvent("dofus_prices_updated", {
        detail: {
          profileId: pid,
          updatedPrices: newPricesMap,
          priceUpdatedAt: nowTimestamps,
          count: Object.keys(newPricesMap).length,
          timestamp: now,
        },
      })
    );

    emitDatabaseUpdated();

    getMarketBroadcastChannel()?.postMessage({
      type: "PRICE_SYNC",
      profileId: pid,
      prices: newPricesMap,
      priceUpdatedAt: nowTimestamps,
      serverTime: now,
    });
  }

  try {
    const response = await requestJson<{
      prices: MarketPriceMap;
      priceUpdatedAt: PriceUpdatedAtMap;
      activePriceProfileId: number;
    }>(`${LOCAL_DB_API_BASE}/prices`, {
      method: "PUT",
      body: JSON.stringify({
        prices: newPricesMap,
        profileId: pid,
      }),
    });

    if (response?.prices) {
      updateMemoryCache({
        prices: response.prices,
        priceUpdatedAt: response.priceUpdatedAt,
        activePriceProfileId: response.activePriceProfileId,
      });
      saveLocalServerPrices(currentSlug, response.prices, response.priceUpdatedAt || {});
    }
  } catch (err) {
    console.warn("[saveAllMarketPrices] Backend sync warning (local cache retained):", err);
  }

  return getPricesCache();
}

export async function setActiveLocalPriceProfile(
  profileId: number,
): Promise<void> {
  const profiles = getPriceProfilesCache();
  const activeId = getActivePriceProfileIdCache();
  const previousProfile = profiles.find((p) => p.id === activeId) || profiles[0];
  const previousSlug = previousProfile?.slug || "draconiros";

  if (typeof window !== "undefined") {
    saveLocalServerPrices(previousSlug, getPricesCache(), getPriceUpdatedAtCache());
    localStorage.setItem("selected_dofus_price_profile_id", String(profileId));
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_TIMESTAMP_KEY);
  }

  const targetProfile =
    profiles.find((p) => p.id === profileId) ||
    DEFAULT_PRICE_PROFILES.find((p) => p.id === profileId) ||
    profiles[0];
  const targetSlug = targetProfile?.slug || "draconiros";

  const localTarget = getLocalServerPrices(targetSlug);
  let newProfiles = profiles;
  let newActiveProfileId = profileId;
  let newPrices = localTarget.prices;
  let newPriceUpdatedAt = localTarget.priceUpdatedAt;
  let newCoeffs: Record<number, number> | undefined = undefined;
  let newCoeffTimes: Record<number, number> | undefined = undefined;
  let newManualEdits: Record<number, number> | undefined = undefined;

  try {
    const response = await requestJson<{
      profiles: PriceProfile[];
      activePriceProfileId: number;
      prices: MarketPriceMap;
      priceUpdatedAt: PriceUpdatedAtMap;
      coefficients?: Record<number, number>;
      coefficientUpdatedAt?: Record<number, number>;
      manualEdits?: Record<number, number>;
    }>(`${LOCAL_DB_API_BASE}/price-profiles/active`, {
      method: "PUT",
      body: JSON.stringify({ profileId }),
    });

    if (response) {
      if (response.profiles && response.profiles.length > 0) {
        newProfiles = response.profiles;
      }
      newActiveProfileId = response.activePriceProfileId || profileId;
      newPrices = response.prices || {};
      newPriceUpdatedAt = response.priceUpdatedAt || {};
      newCoeffs = response.coefficients;
      newCoeffTimes = response.coefficientUpdatedAt;
      newManualEdits = response.manualEdits;

      saveLocalServerPrices(targetSlug, newPrices, newPriceUpdatedAt);
    }
  } catch (err) {
    console.warn("[setActiveLocalPriceProfile] Backend API sync unreachable, using client offline partition:", err);
  }

  const activeProfile =
    newProfiles.find((p) => p.id === newActiveProfileId) ||
    targetProfile ||
    newProfiles[0];

  if (typeof window !== "undefined" && activeProfile) {
    localStorage.setItem("selected_dofus_price_profile_slug", activeProfile.slug);
    localStorage.setItem("selected_dofus_price_profile_id", String(activeProfile.id));
  }

  updateMemoryCache({
    priceProfiles: newProfiles,
    activePriceProfileId: newActiveProfileId,
    prices: newPrices,
    priceUpdatedAt: newPriceUpdatedAt,
    coefficients: newCoeffs,
    coefficientUpdatedAt: newCoeffTimes,
    manualEdits: newManualEdits,
    replacePrices: true,
  });

  clearRecipeTreeCache();
  resetLivePriceSyncTimestamp();

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("dofus_profile_changed", {
        detail: {
          profileId: newActiveProfileId,
          profile: activeProfile,
        },
      })
    );
    window.dispatchEvent(
      new CustomEvent("dofus_coefficients_updated", {
        detail: {
          profileId: newActiveProfileId,
          server: activeProfile?.slug,
        },
      })
    );
    window.dispatchEvent(
      new CustomEvent("dofus_prices_updated", {
        detail: {
          profileId: newActiveProfileId,
          updatedPrices: newPrices,
          priceUpdatedAt: newPriceUpdatedAt,
          count: Object.keys(newPrices).length,
          timestamp: Date.now(),
          replacePrices: true,
        },
      })
    );
    emitDatabaseUpdated();
  }
}

export async function saveProfileCoefficient(
  itemId: number,
  coefficient: number,
  profileId?: number,
  options?: { timestamp?: number; isManual?: boolean }
): Promise<void> {
  const pid = profileId || getActivePriceProfileIdCache();
  const profiles = getPriceProfilesCache();
  const profile = profiles.find((p) => p.id === pid) || profiles[0];
  const slug = profile?.slug || "draconiros";

  saveItemCoefficient(itemId, coefficient, slug, options);

  const effectiveTs = options?.timestamp && options.timestamp > 0 ? options.timestamp : Date.now();
  const isManual = options?.isManual !== false;

  try {
    await requestJson(`${LOCAL_DB_API_BASE}/coefficients/${itemId}`, {
      method: "PUT",
      body: JSON.stringify({
        coefficient,
        profileId: pid,
        updatedAt: effectiveTs,
        isManual,
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
  const pid = profileId || getActivePriceProfileIdCache();
  const profiles = getPriceProfilesCache();
  const profile = profiles.find((p) => p.id === pid) || profiles[0];
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
