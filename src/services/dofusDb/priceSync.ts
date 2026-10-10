import {
  MarketPriceMap,
  PriceUpdatedAtMap,
  SalesVolumeMap,
} from "../../types";
import {
  fetchAndSyncSalesVolume,
  handleRemoteVolumeUpdate,
  syncRemoteSalesVolume,
} from "../salesVolumeService";
import {
  clearRecipeTreeCache,
  emitDatabaseUpdated,
  getActivePriceProfileIdCache,
  getPriceUpdatedAtCache,
  getPricesCache,
  requestJson,
  setActivePriceProfileIdCache,
  updateMemoryCache,
} from "./store";

let livePriceSyncTimeout: any = null;
let lastPriceSyncTimestamp = 0;
let lastPriceUpdateTime = Date.now();
let isPollingPrices = false;
let visibilityListenerRegistered = false;
let liveStreamEventSource: EventSource | null = null;
let marketBroadcastChannel: BroadcastChannel | null = null;
let liveStreamDisabled = false;

export function touchLastPriceUpdateTime(): void {
  lastPriceUpdateTime = Date.now();
}

export function getMarketBroadcastChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return null;
  if (!marketBroadcastChannel) {
    try {
      marketBroadcastChannel = new BroadcastChannel("dofus_live_market_prices");
      marketBroadcastChannel.onmessage = (event) => {
        const msg = event.data;
        if (!msg) return;
        if (msg.type === "PRICE_SYNC") {
          const activePid = getActivePriceProfileIdCache() || 1;
          if (msg.profileId === activePid && msg.prices) {
            Object.assign(getPricesCache(), msg.prices);
            if (msg.priceUpdatedAt) Object.assign(getPriceUpdatedAtCache(), msg.priceUpdatedAt);
            if (msg.serverTime && msg.serverTime > lastPriceSyncTimestamp) {
              lastPriceSyncTimestamp = msg.serverTime;
            }
            lastPriceUpdateTime = Date.now();
            clearRecipeTreeCache();
            window.dispatchEvent(
              new CustomEvent("dofus_prices_updated", {
                detail: {
                  profileId: msg.profileId,
                  updatedPrices: msg.prices,
                  priceUpdatedAt: msg.priceUpdatedAt || {},
                  count: Object.keys(msg.prices).length,
                  timestamp: msg.serverTime || Date.now(),
                },
              })
            );
            emitDatabaseUpdated();
          }
        } else if (msg.type === "VOLUME_SYNC" && msg.salesVolume) {
          syncRemoteSalesVolume(msg.salesVolume);
        }
      };
    } catch {
      marketBroadcastChannel = null;
    }
  }
  return marketBroadcastChannel;
}

export function connectLivePriceStream(): void {
  if (typeof window === "undefined" || typeof EventSource === "undefined") return;
  if (liveStreamDisabled) return;

  if (window.location?.hostname?.includes("vercel.app")) {
    liveStreamDisabled = true;
    return;
  }

  if (liveStreamEventSource && liveStreamEventSource.readyState !== EventSource.CLOSED) {
    return;
  }

  try {
    const es = new EventSource("/api/market/live-stream");
    liveStreamEventSource = es;

    es.onmessage = (event) => {
      try {
        if (!event.data) return;
        const data = JSON.parse(event.data);
        const pricesCache = getPricesCache();
        const priceUpdatedCache = getPriceUpdatedAtCache();

        if (data.type === "price_update" && data.itemId && typeof data.price === "number") {
          const pid = Number(data.profileId);
          const activePid = getActivePriceProfileIdCache() || 1;
          if (pid === activePid) {
            const incomingTime = data.updatedAt || Date.now();
            const localTime = priceUpdatedCache[data.itemId] || 0;

            if (incomingTime >= localTime || pricesCache[data.itemId] === undefined) {
              pricesCache[data.itemId] = data.price;
              priceUpdatedCache[data.itemId] = incomingTime;
              lastPriceUpdateTime = Date.now();
              clearRecipeTreeCache();

              if (typeof window !== "undefined") {
                window.dispatchEvent(
                  new CustomEvent("dofus_prices_updated", {
                    detail: {
                      profileId: pid,
                      updatedPrices: { [data.itemId]: data.price },
                      priceUpdatedAt: { [data.itemId]: incomingTime },
                      count: 1,
                      timestamp: incomingTime,
                    },
                  })
                );
                emitDatabaseUpdated();
                getMarketBroadcastChannel()?.postMessage({
                  type: "PRICE_SYNC",
                  profileId: pid,
                  prices: { [data.itemId]: data.price },
                  priceUpdatedAt: { [data.itemId]: incomingTime },
                  serverTime: incomingTime,
                });
              }
            }
          }
        } else if (data.type === "batch_updated" && data.prices) {
          const pid = Number(data.profileId);
          const activePid = getActivePriceProfileIdCache() || 1;
          if (pid === activePid) {
            const updatedSubset: MarketPriceMap = {};
            const updatedTimesSubset: PriceUpdatedAtMap = {};
            const fallbackTime = data.timestamp || Date.now();

            for (const [idStr, price] of Object.entries(data.prices)) {
              const id = Number(idStr);
              const inTime = data.priceUpdatedAt?.[id] || fallbackTime;
              const curTime = priceUpdatedCache[id] || 0;
              if (inTime >= curTime || pricesCache[id] === undefined) {
                pricesCache[id] = price as number;
                priceUpdatedCache[id] = inTime;
                updatedSubset[id] = price as number;
                updatedTimesSubset[id] = inTime;
              }
            }

            if (Object.keys(updatedSubset).length > 0) {
              lastPriceUpdateTime = Date.now();
              clearRecipeTreeCache();

              if (typeof window !== "undefined") {
                window.dispatchEvent(
                  new CustomEvent("dofus_prices_updated", {
                    detail: {
                      profileId: pid,
                      updatedPrices: updatedSubset,
                      priceUpdatedAt: updatedTimesSubset,
                      count: Object.keys(updatedSubset).length,
                      timestamp: fallbackTime,
                    },
                  })
                );
                emitDatabaseUpdated();
                getMarketBroadcastChannel()?.postMessage({
                  type: "PRICE_SYNC",
                  profileId: pid,
                  prices: updatedSubset,
                  priceUpdatedAt: updatedTimesSubset,
                  serverTime: fallbackTime,
                });
              }
            }
          }
        } else if (data.type === "volume_update" && data.itemId && data.volume) {
          const pid = Number(data.profileId);
          lastPriceUpdateTime = Date.now();
          handleRemoteVolumeUpdate(Number(data.itemId), data.volume);
          getMarketBroadcastChannel()?.postMessage({
            type: "VOLUME_SYNC",
            profileId: pid,
            salesVolume: { [data.itemId]: data.volume },
            serverTime: data.updatedAt || Date.now(),
          });
        } else if (data.type === "batch_volume_updated") {
          const pid = Number(data.profileId);
          lastPriceUpdateTime = Date.now();
          void fetchAndSyncSalesVolume().then((vols) => {
            getMarketBroadcastChannel()?.postMessage({
              type: "VOLUME_SYNC",
              profileId: pid,
              salesVolume: vols,
              serverTime: Date.now(),
            });
          });
        }
      } catch (err) {
        console.warn("[Live Price Stream] Parse error:", err);
      }
    };

    es.onerror = () => {
      es.close();
      liveStreamEventSource = null;
      liveStreamDisabled = true;
    };
  } catch {
    liveStreamDisabled = true;
  }
}

function scheduleNextAdaptivePoll(): void {
  if (typeof window === "undefined") return;
  if (livePriceSyncTimeout) {
    clearTimeout(livePriceSyncTimeout);
    livePriceSyncTimeout = null;
  }

  if (typeof document !== "undefined" && document.hidden) {
    return;
  }

  const timeSinceLastUpdate = Date.now() - lastPriceUpdateTime;
  let delay = 15000;
  if (timeSinceLastUpdate < 45000) {
    delay = 2000;
  } else if (timeSinceLastUpdate < 120000) {
    delay = 6000;
  }

  livePriceSyncTimeout = setTimeout(() => {
    void executeLivePricePoll().finally(() => {
      scheduleNextAdaptivePoll();
    });
  }, delay);
}

export async function executeLivePricePoll(forceCatchup = false): Promise<number> {
  if (isPollingPrices) return 0;
  if (typeof navigator !== "undefined" && !navigator.onLine) return 0;

  if (forceCatchup) {
    lastPriceSyncTimestamp = 0;
    lastPriceUpdateTime = Date.now();
  }

  isPollingPrices = true;
  try {
    const pid = getActivePriceProfileIdCache() || 1;

    let since = 0;
    if (forceCatchup) {
      since = 0;
    } else if (lastPriceSyncTimestamp > 0) {
      since = Math.max(0, lastPriceSyncTimestamp - 3000);
    } else {
      since = Math.max(0, Date.now() - 30 * 60 * 1000);
    }

    const res = await requestJson<{
      success: boolean;
      profile_id: number;
      prices: MarketPriceMap;
      priceUpdatedAt: PriceUpdatedAtMap;
      salesVolume?: SalesVolumeMap;
      serverTime: number;
      totalUpdated: number;
    }>(`/api/market/latest-prices?profileId=${pid}&since=${since}`);

    if (res && res.success) {
      if (res.profile_id && !getActivePriceProfileIdCache()) {
        setActivePriceProfileIdCache(res.profile_id);
      }

      if (res.salesVolume && Object.keys(res.salesVolume).length > 0) {
        lastPriceUpdateTime = Date.now();
        syncRemoteSalesVolume(res.salesVolume);
        getMarketBroadcastChannel()?.postMessage({
          type: "VOLUME_SYNC",
          profileId: res.profile_id,
          salesVolume: res.salesVolume,
          serverTime: res.serverTime || Date.now(),
        });
      }

      const activePid = getActivePriceProfileIdCache();
      if (
        res.totalUpdated > 0 &&
        (res.profile_id === pid ||
          res.profile_id === activePid ||
          !activePid)
      ) {
        lastPriceUpdateTime = Date.now();
        const updatedPrices = {
          ...getPricesCache(),
          ...res.prices,
        };
        const updatedTimes = {
          ...getPriceUpdatedAtCache(),
          ...res.priceUpdatedAt,
        };

        lastPriceSyncTimestamp = res.serverTime || Date.now();
        clearRecipeTreeCache();

        updateMemoryCache({
          prices: updatedPrices,
          priceUpdatedAt: updatedTimes,
        });

        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("dofus_prices_updated", {
              detail: {
                profileId: res.profile_id,
                updatedPrices: res.prices,
                priceUpdatedAt: res.priceUpdatedAt,
                count: res.totalUpdated,
                timestamp: lastPriceSyncTimestamp,
              },
            })
          );

          emitDatabaseUpdated();

          getMarketBroadcastChannel()?.postMessage({
            type: "PRICE_SYNC",
            profileId: res.profile_id,
            prices: res.prices,
            priceUpdatedAt: res.priceUpdatedAt,
            serverTime: lastPriceSyncTimestamp,
          });
        }

        return res.totalUpdated;
      } else if (res.serverTime) {
        lastPriceSyncTimestamp = Math.max(lastPriceSyncTimestamp, res.serverTime - 1000);
      }
    }
  } catch (err) {
    console.warn("[executeLivePricePoll] Error checking latest prices:", err);
  } finally {
    isPollingPrices = false;
  }

  return 0;
}

export const triggerLivePriceSync = (forceCatchup: boolean = false): Promise<number> => {
  lastPriceUpdateTime = Date.now();
  scheduleNextAdaptivePoll();
  return executeLivePricePoll(forceCatchup);
};

export const executeLivePriceCatchup = async (forceCatchup = false): Promise<number> => {
  return executeLivePricePoll(forceCatchup);
};

export function startLivePriceAutoSync(): void {
  if (typeof window === "undefined") return;

  getMarketBroadcastChannel();
  connectLivePriceStream();
  void fetchAndSyncSalesVolume();

  if (!visibilityListenerRegistered && typeof document !== "undefined" && typeof window !== "undefined") {
    visibilityListenerRegistered = true;

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        lastPriceUpdateTime = Date.now();
        connectLivePriceStream();
        void fetchAndSyncSalesVolume();
        void executeLivePricePoll();
        scheduleNextAdaptivePoll();
      }
    });

    window.addEventListener("focus", () => {
      lastPriceUpdateTime = Date.now();
      connectLivePriceStream();
      void fetchAndSyncSalesVolume();
      void executeLivePricePoll();
      scheduleNextAdaptivePoll();
    });

    window.addEventListener("online", () => {
      lastPriceUpdateTime = Date.now();
      connectLivePriceStream();
      void fetchAndSyncSalesVolume();
      void executeLivePricePoll();
      scheduleNextAdaptivePoll();
    });
  }

  setTimeout(() => {
    void executeLivePricePoll().finally(() => {
      scheduleNextAdaptivePoll();
    });
  }, 200);
}

export function stopLivePriceAutoSync(): void {
  if (livePriceSyncTimeout) {
    clearTimeout(livePriceSyncTimeout);
    livePriceSyncTimeout = null;
  }
  if (liveStreamEventSource) {
    liveStreamEventSource.close();
    liveStreamEventSource = null;
  }
}

export function resetLivePriceSyncTimestamp(): void {
  lastPriceSyncTimestamp = 0;
}
