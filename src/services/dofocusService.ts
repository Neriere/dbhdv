import {
  bulkSaveItemCoefficients,
  getAllSavedItemCoefficients,
  getAllSavedItemCoefficientTimestamps,
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
  const res = await fetch(`/api/dofocus/item/${itemId}?server=${encodeURIComponent(dofocusName)}`);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
}

export interface DofocusSyncOptions {
  onlyIfDefault?: boolean;
  forceRefresh?: boolean;
  maxAgeDays?: number | null; // e.g. 1 (1 día), 3 (3 días), 5 (5 días), 7 (1 semana), 30 (1 mes) or null (todos)
  protectNewerLocalEdits?: boolean;
  serverSlug?: string;
}

/**
 * Synchronize coefficients from DoFocus into local storage & state for a specific server profile.
 *
 * @param serverName Target Dofus server (defaults to "Draconiros")
 * @param options Synchronization and filter options
 */
export async function syncDofocusCoefficients(
  serverName = "Draconiros",
  options: DofocusSyncOptions = {}
): Promise<DofocusSyncResult> {
  const dofocusName = normalizeServerToDoFocusName(serverName);
  const serverSlug = options.serverSlug || normalizeServerToSlug(serverName);
  const data = await fetchDofocusServerCoefficients(dofocusName, options.forceRefresh);
  const coefficients = data.coefficients || [];

  const result = bulkSaveItemCoefficients(
    coefficients,
    {
      onlyIfDefault: options.onlyIfDefault,
      maxAgeDays: options.maxAgeDays,
      protectNewerLocalEdits: options.protectNewerLocalEdits ?? true,
      serverSlug,
    },
    serverSlug
  );

  // Also persist to SQLite backend database in background
  try {
    const allSavedCoeffs = getAllSavedItemCoefficients(serverSlug);
    const allSavedTimestamps = getAllSavedItemCoefficientTimestamps(serverSlug);
    const entries = Object.entries(allSavedCoeffs).map(([itemIdStr, coeff]) => ({
      itemId: Number(itemIdStr),
      coefficient: coeff,
      updatedAt: allSavedTimestamps[Number(itemIdStr)] || Date.now(),
    }));

    if (entries.length > 0) {
      void fetch("/api/local-db/coefficients/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries, serverSlug }),
      }).catch((e) => console.warn("Background SQLite sync failed:", e));
    }
  } catch (err) {
    console.warn("Could not push bulk coefficients to backend SQLite:", err);
  }

  // Compute summary metrics
  const validCoeffs = coefficients.map((c) => c.coefficient).filter((c) => typeof c === "number");
  const avgCoeff = validCoeffs.length > 0
    ? Math.round(validCoeffs.reduce((a, b) => a + b, 0) / validCoeffs.length)
    : 100;

  const topProfitableCount = coefficients.filter((c) => c.coefficient >= 150).length;

  return {
    server: dofocusName,
    serverSlug,
    totalAvailable: coefficients.length,
    updatedCount: result.updatedCount,
    skippedCount: result.skippedCount,
    averageCoefficient: avgCoeff,
    topProfitableItemsCount: topProfitableCount,
    timestamp: Date.now(),
  };
}
