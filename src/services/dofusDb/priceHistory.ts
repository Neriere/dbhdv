import {
  ItemPriceHistorySummary,
  MarketPriceMap,
  PriceChangeInfo,
  PriceUpdatedAtMap,
} from "../../types";
import {
  getActivePriceProfileIdCache,
  LOCAL_DB_API_BASE,
  requestJson,
  updateMemoryCache,
} from "./store";
import { FetchPriceHistoryParams, FetchPriceHistoryResponse } from "./types";

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
  const pid = profileId || getActivePriceProfileIdCache() || 1;
  const query = `?profileId=${pid}`;
  return await requestJson<ItemPriceHistorySummary>(
    `${LOCAL_DB_API_BASE}/price-history/item/${itemId}${query}`
  );
}

export async function fetchLatestPriceChanges(
  profileId?: number
): Promise<Record<number, PriceChangeInfo>> {
  const pid = profileId || getActivePriceProfileIdCache() || 1;
  const query = `?profileId=${pid}`;
  try {
    return await requestJson<Record<number, PriceChangeInfo>>(
      `${LOCAL_DB_API_BASE}/price-history/latest-changes${query}`
    );
  } catch (err) {
    console.warn("fetchLatestPriceChanges warning:", err);
    return {};
  }
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
