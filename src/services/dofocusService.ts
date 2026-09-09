import {
  bulkSaveItemCoefficients,
  getAllSavedItemCoefficients,
  getAllSavedItemCoefficientTimestamps,
  getAllSavedItemManualEdits,
  saveItemCoefficient,
} from "../data/dofusRuneWeights";

export const SERVER_NAME_TO_SLUG: Record<string, string> = {
  draconiros: "draconiros",
  kourial: "kourial",
  mikhal: "mikhal",
  dakal: "dakal",
  brial: "brial",
  rafal: "rafal",
  salar: "salar",
  talkasha: "tal-kasha",
  "tal kasha": "tal-kasha",
  "tal-kasha": "tal-kasha",
  hellmina: "hellmina",
  "hell mina": "hellmina",
  "hell-mina": "hellmina",
  imagiro: "imagiro",
  orukam: "orukam",
  oruka: "orukam",
  tylezia: "tylezia",
  ombre: "ombre",
  shadow: "ombre",
  sombra: "ombre",
};

export const SERVER_SLUG_TO_DOFOCUS_NAME: Record<string, string> = {
  draconiros: "Draconiros",
  kourial: "Kourial",
  mikhal: "Mikhal",
  dakal: "Dakal",
  brial: "Brial",
  rafal: "Rafal",
  salar: "Salar",
  "tal-kasha": "TalKasha",
  talkasha: "TalKasha",
  hellmina: "HellMina",
  imagiro: "Imagiro",
  orukam: "Orukam",
  tylezia: "Tylezia",
  ombre: "Ombre",
};

export function normalizeServerToSlug(serverNameOrSlug: string): string {
  if (!serverNameOrSlug) return "draconiros";
  const clean = serverNameOrSlug.trim().toLowerCase();
  if (SERVER_NAME_TO_SLUG[clean]) return SERVER_NAME_TO_SLUG[clean];
  if (clean.startsWith("draconiros")) return "draconiros";
  if (clean.startsWith("dakal")) return "dakal";
  if (clean.startsWith("mikhal")) return "mikhal";
  if (clean.startsWith("brial")) return "brial";
  if (clean.startsWith("rafal")) return "rafal";
  if (clean.startsWith("kourial")) return "kourial";
  if (clean.startsWith("salar")) return "salar";
  if (clean.startsWith("tal")) return "tal-kasha";
  if (clean.startsWith("hell")) return "hellmina";
  if (clean.startsWith("imagiro")) return "imagiro";
  if (clean.startsWith("oruk")) return "orukam";
  if (clean.startsWith("tyle")) return "tylezia";
  if (clean.startsWith("ombr") || clean.startsWith("sombr") || clean.startsWith("shadow")) return "ombre";
  return clean.replace(/[\s_]+/g, "-");
}

export function normalizeServerToDoFocusName(serverNameOrSlug: string): string {
  if (!serverNameOrSlug) return "Draconiros";
  const slug = normalizeServerToSlug(serverNameOrSlug);
  return SERVER_SLUG_TO_DOFOCUS_NAME[slug] || "Draconiros";
}

export interface DofocusServer {
  _id: string;
  name: string;
  category?: string;
  categoryLabel?: string;
}

export interface DofocusCoefficientEntry {
  itemId: number;
  coefficient: number;
  dateUpdated?: string;
}

export interface DofocusServerCoefficientsResponse {
  server: string;
  total: number;
  coefficients: DofocusCoefficientEntry[];
  cached?: boolean;
  timestamp: number;
}

export interface DofocusSyncResult {
  server: string;
  serverSlug: string;
  totalAvailable: number;
  updatedCount: number;
  skippedCount: number;
  averageCoefficient: number;
  topProfitableItemsCount: number;
  timestamp: number;
}

/**
 * Get available servers from DoFocus (with fallback)
 */
export async function getDofocusServers(): Promise<DofocusServer[]> {
  try {
    const res = await fetch("/api/dofocus/servers");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? data : [{ _id: "draconiros", name: "Draconiros" }];
  } catch (err) {
    console.error("Failed to fetch DoFocus servers:", err);
    return [
      { _id: "draconiros", name: "Draconiros" },
      { _id: "kourial", name: "Kourial" },
      { _id: "mikhal", name: "Mikhal" },
      { _id: "dakal", name: "Dakal" },
      { _id: "brial", name: "Brial" },
      { _id: "rafal", name: "Rafal" },
      { _id: "salar", name: "Salar" },
      { _id: "talkasha", name: "TalKasha" },
      { _id: "hellmina", name: "HellMina" },
      { _id: "imagiro", name: "Imagiro" },
      { _id: "orukam", name: "Orukam" },
      { _id: "tylezia", name: "Tylezia" },
    ];
  }
}

/**
 * Fetch all coefficients for a server from DoFocus
 */
export async function fetchDofocusServerCoefficients(
  serverName = "Draconiros",
  forceRefresh = false
): Promise<DofocusServerCoefficientsResponse> {
  const dofocusName = normalizeServerToDoFocusName(serverName);
  const url = `/api/dofocus/coefficients/${encodeURIComponent(dofocusName)}${
    forceRefresh ? "?refresh=true" : ""
  }`;
  const res = await fetch(url);
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Error al obtener coeficientes (${res.status})`);
  }
  return res.json();
}

/**
 * Fetch a single item's coefficient from DoFocus
 */
export async function fetchDofocusItemCoefficient(
  itemId: number,
  serverName = "Draconiros"
): Promise<{ itemId: number; coefficient: number; dateUpdated: string | null; server: string }> {
  const dofocusName = normalizeServerToDoFocusName(serverName);
  try {
    const res = await fetch(`/api/dofocus/item/${itemId}?server=${encodeURIComponent(dofocusName)}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn(`[fetchDofocusItemCoefficient] Direct endpoint error for item ${itemId}:`, e);
  }

  // Fallback: search in full server list if item endpoint fails or returns 404
  try {
    const all = await fetchDofocusServerCoefficients(serverName, false);
    if (all && Array.isArray(all.coefficients)) {
      const found = all.coefficients.find((c) => c.itemId === itemId);
      if (found) {
        return {
          itemId,
          coefficient: found.coefficient,
          dateUpdated: found.dateUpdated || null,
          server: dofocusName,
        };
      }
    }
  } catch (err) {
    console.warn(`[fetchDofocusItemCoefficient] Server list fallback failed:`, err);
  }

  throw new Error(`Coeficiente no encontrado para el ítem ${itemId} en ${dofocusName}`);
}

export interface DofocusSyncOptions {
  serverSlug?: string;
}

/**
 * Synchronize coefficients from DoFocus into the SQLite database for a specific server profile.
 * Only coefficients with a newer date than what is in the database will be updated.
 *
 * @param serverName Target Dofus server (defaults to "Draconiros")
 * @param options Synchronization options
 */
export async function syncDofocusCoefficients(
  serverName = "Draconiros",
  options: DofocusSyncOptions = {}
): Promise<DofocusSyncResult> {
  const dofocusName = normalizeServerToDoFocusName(serverName);
  const serverSlug = options.serverSlug || normalizeServerToSlug(serverName);

  let data: any = null;

  // 1. Try server-side sync endpoint first if running on full-stack Express
  try {
    const res = await fetch("/api/dofocus/sync-server", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ server: dofocusName }),
    });

    if (res.ok) {
      data = await res.json();
    }
  } catch {
    // Fallback to direct client-side synchronization via /api/dofocus/coefficients/[serverName]
  }

  // 2. Resilient fallback: fetch server coefficients directly and process with date protection
  if (!data || !data.success) {
    const directRes = await fetchDofocusServerCoefficients(serverName, true);
    if (!directRes || !Array.isArray(directRes.coefficients)) {
      throw new Error("No se pudieron obtener coeficientes desde DoFocus");
    }

    // Process with date comparison, manual protection, and backup snapshot
    const bulkResult = bulkSaveItemCoefficients(directRes.coefficients, {
      serverSlug,
      protectNewerLocalEdits: true,
    });

    data = {
      success: true,
      server: dofocusName,
      serverSlug,
      totalFetched: directRes.total || directRes.coefficients.length,
      updatedCount: bulkResult.updatedCount,
      skippedCount: bulkResult.skippedCount,
      timestamp: Date.now(),
      coefficients: getAllSavedItemCoefficients(serverSlug),
      coefficientUpdatedAt: getAllSavedItemCoefficientTimestamps(serverSlug),
      manualEdits: getAllSavedItemManualEdits(serverSlug),
    };
  }

  // If server returned updated coefficients, sync local storage caches for fast UI response
  if (data.coefficients && typeof window !== "undefined") {
    localStorage.setItem(
      `dofus_user_item_coefficients_${serverSlug}`,
      JSON.stringify(data.coefficients)
    );
    if (data.coefficientUpdatedAt) {
      localStorage.setItem(
        `dofus_user_item_coeff_timestamps_${serverSlug}`,
        JSON.stringify(data.coefficientUpdatedAt)
      );
    }
    if (data.manualEdits) {
      localStorage.setItem(
        `dofus_user_item_coeff_manual_edits_${serverSlug}`,
        JSON.stringify(data.manualEdits)
      );
    }

    // Trigger update event for immediate UI reactivity
    window.dispatchEvent(
      new CustomEvent("dofus_coefficients_updated", {
        detail: {
          server: serverSlug,
          count: data.updatedCount ?? data.totalFetched,
          timestamp: Date.now(),
        },
      })
    );
  }

  // Calculate average and profitable count if coefficients available
  let avgCoeff = 100;
  let topCount = 0;
  if (data.coefficients) {
    const vals = Object.values(data.coefficients).map(Number).filter((n) => !isNaN(n));
    if (vals.length > 0) {
      avgCoeff = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
      topCount = vals.filter((n) => n >= 150).length;
    }
  }

  return {
    server: dofocusName,
    serverSlug,
    totalAvailable: data.totalFetched || 0,
    updatedCount: data.updatedCount ?? 0,
    skippedCount: data.skippedCount ?? 0,
    averageCoefficient: avgCoeff,
    topProfitableItemsCount: topCount,
    timestamp: data.timestamp || Date.now(),
  };
}

export interface GlobalSyncStatusResponse {
  isSyncRunning: boolean;
  lastSyncTimestamp: number | null;
  nextSyncTimestamp: number | null;
  serverStatuses: Record<
    string,
    {
      server: string;
      totalFetched: number;
      timestamp: number;
      success: boolean;
      error?: string;
    }
  >;
}

export async function fetchGlobalSyncStatus(): Promise<GlobalSyncStatusResponse | null> {
  try {
    const res = await fetch("/api/dofocus/sync-all-status");
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function triggerGlobalSync(): Promise<{ status: string; message: string }> {
  const res = await fetch("/api/dofocus/sync-all", { method: "POST" });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return await res.json();
}
