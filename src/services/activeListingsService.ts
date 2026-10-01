import { useEffect, useState } from "react";

export interface ActiveListingLot {
  itemId: number;
  name: string;
  price: number;
  unitPrice: number;
  quantity: number;
  market?: "recursos" | "equipamiento" | "consumibles";
  secondsRemaining?: number;
  expiresAt?: string | null;
  timeLabel?: string;
}

export interface ActiveListingsData {
  metadata?: {
    capturedAt?: string;
    totalLots?: number;
    totalValue?: number;
  };
  mercadillos?: {
    recursos?: { listings?: ActiveListingLot[] } | ActiveListingLot[];
    equipamiento?: { listings?: ActiveListingLot[] } | ActiveListingLot[];
    consumibles?: { listings?: ActiveListingLot[] } | ActiveListingLot[];
  };
  listings?: ActiveListingLot[];
}

const STORAGE_KEY = "dbhdv_active_listings_v1";

export function getStoredActiveListings(): ActiveListingsData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ActiveListingsData;
  } catch (err) {
    console.warn("[activeListingsService] Error leyendo listings activos:", err);
    return null;
  }
}

export function saveActiveListings(data: ActiveListingsData): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    window.dispatchEvent(new Event("active_listings_updated"));
  } catch (err) {
    console.warn("[activeListingsService] Error guardando listings activos:", err);
  }
}

export function extractAllActiveLots(data: ActiveListingsData | null): ActiveListingLot[] {
  if (!data) return [];
  const results: ActiveListingLot[] = [];

  if (data.mercadillos) {
    const m = data.mercadillos;
    const processSec = (sec: any, marketKey: "recursos" | "equipamiento" | "consumibles") => {
      if (Array.isArray(sec)) {
        sec.forEach((l) => results.push({ ...l, market: marketKey }));
      } else if (sec && typeof sec === "object" && Array.isArray(sec.listings)) {
        sec.listings.forEach((l: any) => results.push({ ...l, market: marketKey }));
      }
    };
    processSec(m.recursos, "recursos");
    processSec(m.equipamiento, "equipamiento");
    processSec(m.consumibles, "consumibles");
  } else if (Array.isArray(data.listings)) {
    data.listings.forEach((l) => results.push(l));
  }

  return results;
}

export function getActiveListingsItemMap(data: ActiveListingsData | null): Record<number, { totalQuantity: number; lotsCount: number; minPrice: number; market?: string }> {
  const lots = extractAllActiveLots(data);
  const map: Record<number, { totalQuantity: number; lotsCount: number; minPrice: number; market?: string }> = {};

  lots.forEach((lot) => {
    const id = lot.itemId;
    if (!id) return;
    const qty = lot.quantity || 1;
    const price = lot.price || 0;
    if (!map[id]) {
      map[id] = { totalQuantity: qty, lotsCount: 1, minPrice: price, market: lot.market };
    } else {
      map[id].totalQuantity += qty;
      map[id].lotsCount += 1;
      if (price > 0 && (map[id].minPrice === 0 || price < map[id].minPrice)) {
        map[id].minPrice = price;
      }
    }
  });

  return map;
}
