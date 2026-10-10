/**
 * salesHistoryService.ts
 * Manages personal sales data imported from dofus_suite.py sniffer:
 *   1. historial_ventas_capturado.json  -> sold + expired (Sin vender = caducado, returned to bank)
 *   2. listings_en_venta_capturado.json -> active market listings with time remaining
 */

// ============================================================
// Storage keys
// ============================================================
const SALES_HISTORY_KEY = "dofus_sales_history_v1";
const ACTIVE_LISTINGS_KEY = "dofus_active_listings_v1";
const MAX_HISTORY_SNAPSHOTS = 15;
const MAX_LISTINGS_SNAPSHOTS = 15;

// ============================================================
// Types - Sales History (historial_ventas_capturado.json)
// ============================================================

export interface SaleEntry {
  itemId: number;
  name: string;
  /** Price per unit */
  price: number;
  quantity: number;
  /** Formatted date "dd-MM-yyyy • HH:mm" */
  date: string;
  /** ISO timestamp */
  rawDate: string;
  timestamp: number;
  /**
   * "Vendido"    = sold successfully
   * "Sin vender" = expired after 28 days without price update -> returned to bank
   */
  status: "Vendido" | "Sin vender";
}

export interface SalesHistorySnapshot {
  id: string;
  importedAt: number;
  capturedAt: string;
  totalSales: number;
  soldKamas: number;
  /** Kamas value of items that EXPIRED (caducados), NOT currently for sale */
  expiredKamas: number;
  soldCount: number;
  /** Number of entries that expired/returned to bank (NOT active listings) */
  expiredCount: number;
  totalUnits: number;
  entries: SaleEntry[];
}

// ============================================================
// Types - Active Listings (listings_en_venta_capturado.json)
// ============================================================

export interface ActiveListingEntry {
  itemId: number;
  name: string;
  /** Lot size: 1, 10, 100 */
  quantity: number;
  /** Price per lot */
  price: number;
  /** Seconds remaining until expiry */
  secondsRemaining: number;
  /** "2d 3h" */
  timeLabel: string;
  /** ISO-like expiry date "YYYY-MM-DD HH:MM:SS" from sniffer */
  expiresAt: string | null;
  /** HDV Category: 'recursos' | 'equipamiento' | 'consumibles' */
  market?: "recursos" | "equipamiento" | "consumibles" | string;
}

export interface ActiveListingsSnapshot {
  id: string;
  importedAt: number;
  capturedAt: string;
  totalLots: number;
  totalValue: number;
  mercadillos?: Record<string, { totalLots: number; totalValue: number; listings: ActiveListingEntry[] }>;
  listings: ActiveListingEntry[];
}

// ============================================================
// Storage helpers
// ============================================================

export function getStoredSalesHistory(): SalesHistorySnapshot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SALES_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function getStoredActiveListings(): ActiveListingsSnapshot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ACTIVE_LISTINGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveHistory(snapshots: SalesHistorySnapshot[]): void {
  if (typeof window === "undefined") return;
  try {
    const trimmed = snapshots.sort((a, b) => b.importedAt - a.importedAt).slice(0, MAX_HISTORY_SNAPSHOTS);
    localStorage.setItem(SALES_HISTORY_KEY, JSON.stringify(trimmed));
    window.dispatchEvent(new CustomEvent("dofus_sales_history_updated"));
  } catch (e) { console.warn("[salesHistoryService] save error:", e); }
}

function saveListings(snapshots: ActiveListingsSnapshot[]): void {
  if (typeof window === "undefined") return;
  try {
    const trimmed = snapshots.sort((a, b) => b.importedAt - a.importedAt).slice(0, MAX_LISTINGS_SNAPSHOTS);
    localStorage.setItem(ACTIVE_LISTINGS_KEY, JSON.stringify(trimmed));
    window.dispatchEvent(new CustomEvent("dofus_sales_history_updated"));
  } catch (e) { console.warn("[salesHistoryService] save listings error:", e); }
}

// ============================================================
// Import: historial_ventas_capturado.json
// ============================================================

export interface ImportHistoryResult {
  snapshot: SalesHistorySnapshot;
  isDuplicate: boolean;
  totalSnapshots: number;
}

export function importSalesHistoryJSON(raw: unknown): ImportHistoryResult {
  const data = raw as any;
  if (!data || !Array.isArray(data.sales)) {
    throw new Error("Formato inválido: se espera un objeto con campo 'sales' (array).");
  }

  const meta = data.metadata || {};
  const capturedAt: string = meta.capturedAt || new Date().toISOString();

  const entries: SaleEntry[] = (data.sales as any[])
    .filter((s) => s && typeof s === "object" && s.itemId > 0 && s.price > 0)
    .map((s) => ({
      itemId: Number(s.itemId),
      name: String(s.name || `Objeto #${s.itemId}`),
      price: Number(s.price || 0),
      quantity: Number(s.quantity || 1),
      date: String(s.date || ""),
      rawDate: String(s.rawDate || ""),
      timestamp: Number(s.timestamp || 0),
      status: s.status === "Sin vender" ? "Sin vender" : "Vendido",
    }));

  const sold = entries.filter((e) => e.status === "Vendido");
  const expired = entries.filter((e) => e.status === "Sin vender");

  const snapshot: SalesHistorySnapshot = {
    id: `hist_${Date.now()}`,
    importedAt: Date.now(),
    capturedAt,
    totalSales: entries.length,
    soldKamas: sold.reduce((acc, e) => acc + e.price * e.quantity, 0),
    expiredKamas: expired.reduce((acc, e) => acc + e.price * e.quantity, 0),
    soldCount: sold.length,
    expiredCount: expired.length,
    totalUnits: entries.reduce((acc, e) => acc + e.quantity, 0),
    entries,
  };

  const existing = getStoredSalesHistory();
  const isDuplicate = existing.some((s) => s.capturedAt === capturedAt);

  if (!isDuplicate) saveHistory([snapshot, ...existing]);

  return { snapshot, isDuplicate, totalSnapshots: isDuplicate ? existing.length : Math.min(existing.length + 1, MAX_HISTORY_SNAPSHOTS) };
}

// ============================================================
// Import: listings_en_venta_capturado.json
// ============================================================

export interface ImportListingsResult {
  snapshot: ActiveListingsSnapshot;
  isDuplicate: boolean;
  totalSnapshots: number;
}

export function importActiveListingsJSON(raw: unknown): ImportListingsResult {
  const data = raw as any;
  if (!data || !Array.isArray(data.listings)) {
    throw new Error("Formato inválido: se espera un objeto con campo 'listings' (array).");
  }

  const meta = data.metadata || {};
  const capturedAt: string = meta.capturedAt || new Date().toISOString();

  const listings: ActiveListingEntry[] = (data.listings as any[])
    .filter((l) => l && l.itemId > 0 && l.price > 0)
    .map((l) => ({
      itemId: Number(l.itemId),
      name: String(l.name || `Objeto #${l.itemId}`),
      quantity: Number(l.quantity || 1),
      price: Number(l.price || 0),
      secondsRemaining: Number(l.secondsRemaining || 0),
      timeLabel: String(l.timeLabel || "Desconocido"),
      expiresAt: l.expiresAt || null,
      market: l.market || undefined,
    }));

  const totalValue = listings.reduce((acc, l) => acc + l.price, 0);

  const snapshot: ActiveListingsSnapshot = {
    id: `lst_${Date.now()}`,
    importedAt: Date.now(),
    capturedAt,
    totalLots: listings.length,
    totalValue,
    mercadillos: data.mercadillos || undefined,
    listings,
  };

  const existing = getStoredActiveListings();
  const isDuplicate = existing.some((s) => s.capturedAt === capturedAt);

  if (!isDuplicate) saveListings([snapshot, ...existing]);

  return { snapshot, isDuplicate, totalSnapshots: isDuplicate ? existing.length : Math.min(existing.length + 1, MAX_LISTINGS_SNAPSHOTS) };
}

// ============================================================
// Clear
// ============================================================

export function clearSalesHistory(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(SALES_HISTORY_KEY);
    window.dispatchEvent(new CustomEvent("dofus_sales_history_updated"));
  }
}

export function clearActiveListings(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(ACTIVE_LISTINGS_KEY);
    window.dispatchEvent(new CustomEvent("dofus_sales_history_updated"));
  }
}

// ============================================================
// Analytics - Sales History
// ============================================================

export interface ItemSoldStats {
  itemId: number;
  name: string;
  totalUnitsSold: number;
  totalKamas: number;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  /** Times it appeared as "Vendido" across snapshots */
  transactionCount: number;
  lastSoldAt: string | null;
  /** Times this item appeared as "Sin vender" (expired, returned to bank) */
  expiredCount: number;
  /** Estimated sell velocity: units per day */
  unitsPerDay: number;
}

export function computeSoldStats(snapshots: SalesHistorySnapshot[]): ItemSoldStats[] {
  if (snapshots.length === 0) return [];

  const seen = new Set<string>();
  const byItem = new Map<number, {
    name: string;
    units: number[];
    kamas: number[];
    prices: number[];
    rawDates: string[];
    expiredCount: number;
  }>();

  for (const snap of snapshots) {
    // Count expired per item in this snapshot
    const expiredByItem = new Map<number, number>();
    for (const e of snap.entries) {
      if (e.status === "Sin vender") {
        expiredByItem.set(e.itemId, (expiredByItem.get(e.itemId) || 0) + 1);
      }
    }

    for (const e of snap.entries) {
      if (e.status !== "Vendido") continue;
      const key = `${e.rawDate}|${e.itemId}|${e.price}|${e.quantity}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const existing = byItem.get(e.itemId);
      if (existing) {
        existing.units.push(e.quantity);
        existing.kamas.push(e.price * e.quantity);
        existing.prices.push(e.price);
        existing.rawDates.push(e.rawDate);
      } else {
        byItem.set(e.itemId, {
          name: e.name,
          units: [e.quantity],
          kamas: [e.price * e.quantity],
          prices: [e.price],
          rawDates: [e.rawDate],
          expiredCount: expiredByItem.get(e.itemId) || 0,
        });
      }
    }
  }

  return Array.from(byItem.entries()).map(([itemId, d]) => {
    const totalUnitsSold = d.units.reduce((a, b) => a + b, 0);
    const totalKamas = d.kamas.reduce((a, b) => a + b, 0);
    const validTs = d.rawDates.map((r) => new Date(r).getTime()).filter((t) => !isNaN(t) && t > 0);
    let unitsPerDay = 0;
    if (validTs.length >= 2) {
      const range = Math.max(1, (Math.max(...validTs) - Math.min(...validTs)) / 86400000);
      unitsPerDay = totalUnitsSold / range;
    } else {
      unitsPerDay = totalUnitsSold;
    }
    const sorted = [...d.rawDates].sort().reverse();
    return {
      itemId,
      name: d.name,
      totalUnitsSold,
      totalKamas,
      avgPrice: totalUnitsSold > 0 ? Math.round(totalKamas / totalUnitsSold) : 0,
      minPrice: Math.min(...d.prices),
      maxPrice: Math.max(...d.prices),
      transactionCount: d.units.length,
      lastSoldAt: sorted[0] || null,
      expiredCount: d.expiredCount,
      unitsPerDay: Number(unitsPerDay.toFixed(2)),
    };
  }).sort((a, b) => b.totalKamas - a.totalKamas);
}

export interface HistorySummary {
  totalKamasSold: number;
  totalKamasExpired: number;
  totalUnitsSold: number;
  totalExpiredUnits: number;
  distinctItemsSold: number;
  distinctItemsExpired: number;
  snapshotCount: number;
  oldestCapture: string | null;
  newestCapture: string | null;
}

export function computeHistorySummary(snapshots: SalesHistorySnapshot[]): HistorySummary {
  const empty: HistorySummary = {
    totalKamasSold: 0, totalKamasExpired: 0,
    totalUnitsSold: 0, totalExpiredUnits: 0,
    distinctItemsSold: 0, distinctItemsExpired: 0,
    snapshotCount: 0, oldestCapture: null, newestCapture: null,
  };
  if (snapshots.length === 0) return empty;

  const seen = new Set<string>();
  const soldIds = new Set<number>();
  const expiredIds = new Set<number>();
  let totalKamasSold = 0, totalKamasExpired = 0;
  let totalUnitsSold = 0, totalExpiredUnits = 0;

  for (const snap of snapshots) {
    for (const e of snap.entries) {
      const key = `${e.rawDate}|${e.itemId}|${e.price}|${e.quantity}|${e.status}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (e.status === "Vendido") {
        soldIds.add(e.itemId);
        totalKamasSold += e.price * e.quantity;
        totalUnitsSold += e.quantity;
      } else {
        expiredIds.add(e.itemId);
        totalKamasExpired += e.price * e.quantity;
        totalExpiredUnits += e.quantity;
      }
    }
  }

  const dates = snapshots.map((s) => s.capturedAt).sort();
  return {
    totalKamasSold, totalKamasExpired,
    totalUnitsSold, totalExpiredUnits,
    distinctItemsSold: soldIds.size,
    distinctItemsExpired: expiredIds.size,
    snapshotCount: snapshots.length,
    oldestCapture: dates[0] || null,
    newestCapture: dates[dates.length - 1] || null,
  };
}

export interface ActiveListingsSummary {
  totalLots: number;
  totalUnits: number;
  totalValue: number;
  expiringSoonLots: number;
  byItemMap: Record<number, {
    count: number;
    totalQty: number;
    totalValue: number;
    minSecondsRemaining: number;
    timeLabel: string;
    listings: ActiveListingEntry[];
  }>;
}

export function computeActiveListingsSummary(snapshots: ActiveListingsSnapshot[]): ActiveListingsSummary {
  const result: ActiveListingsSummary = {
    totalLots: 0,
    totalUnits: 0,
    totalValue: 0,
    expiringSoonLots: 0,
    byItemMap: {},
  };

  if (snapshots.length === 0) return result;
  // Use the newest active listings snapshot
  const latest = snapshots[0];
  if (!latest) return result;

  for (const l of latest.listings) {
    result.totalLots += 1;
    result.totalUnits += l.quantity;
    result.totalValue += l.price;

    if (l.secondsRemaining > 0 && l.secondsRemaining <= 86400) {
      result.expiringSoonLots += 1;
    }

    if (!result.byItemMap[l.itemId]) {
      result.byItemMap[l.itemId] = {
        count: 0,
        totalQty: 0,
        totalValue: 0,
        minSecondsRemaining: l.secondsRemaining,
        timeLabel: l.timeLabel,
        listings: [],
      };
    }
    const itemData = result.byItemMap[l.itemId];
    itemData.count += 1;
    itemData.totalQty += l.quantity;
    itemData.totalValue += l.price;
    itemData.listings.push(l);
    if (l.secondsRemaining > 0 && (itemData.minSecondsRemaining === 0 || l.secondsRemaining < itemData.minSecondsRemaining)) {
      itemData.minSecondsRemaining = l.secondsRemaining;
      itemData.timeLabel = l.timeLabel;
    }
  }

  return result;
}

export function deleteHistorySnapshot(id: string): void {
  const current = getStoredSalesHistory();
  saveHistory(current.filter((s) => s.id !== id));
}

export function deleteListingsSnapshot(id: string): void {
  const current = getStoredActiveListings();
  saveListings(current.filter((s) => s.id !== id));
}

