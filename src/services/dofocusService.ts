import {
  bulkSaveItemCoefficients,
  getAllSavedItemCoefficients,
  getAllSavedItemCoefficientTimestamps,
  saveItemCoefficient,
} from "../data/dofusRuneWeights";

export const SERVER_NAME_TO_SLUG: Record<string, string> = {
  draconiros: "draconiros",
  dakal: "dakal",
  rafal: "rafal",
  mikhal: "mikhal",
  brial: "brial",
  kourial: "kourial",
  salar: "salar",
  talkasha: "tal-kasha",
  "tal kasha": "tal-kasha",
  "tal-kasha": "tal-kasha",
  imagiro: "imagiro",
  tylezia: "tylezia",
  hellmina: "hellmina",
  "hell mina": "hellmina",
  "hell-mina": "hellmina",
  orukam: "orukam",
  ombre: "ombre",
};

export const SERVER_SLUG_TO_DOFOCUS_NAME: Record<string, string> = {
  draconiros: "Draconiros",
  dakal: "Dakal",
  rafal: "Rafal",
  mikhal: "Mikhal",
  brial: "Brial",
  kourial: "Kourial",
  salar: "Salar",
  "tal-kasha": "TalKasha",
  imagiro: "Imagiro",
  tylezia: "Tylezia",
  hellmina: "HellMina",
  orukam: "Orukam",
  ombre: "Ombre",
};

export function normalizeServerToSlug(serverNameOrSlug: string): string {
  if (!serverNameOrSlug) return "draconiros";
  const clean = serverNameOrSlug.trim().toLowerCase();
  return SERVER_NAME_TO_SLUG[clean] || clean.replace(/[\s_]+/g, "-");
}

export function normalizeServerToDoFocusName(serverNameOrSlug: string): string {
  if (!serverNameOrSlug) return "Draconiros";
  const slug = normalizeServerToSlug(serverNameOrSlug);
  return SERVER_SLUG_TO_DOFOCUS_NAME[slug] || serverNameOrSlug;
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
      { _id: "dakal", name: "Dakal" },
      { _id: "rafal", name: "Rafal" },
      { _id: "mikhal", name: "Mikhal" },
      { _id: "brial", name: "Brial" },
      { _id: "kourial", name: "Kourial" },
      { _id: "salar", name: "Salar" },
      { _id: "talkasha", name: "TalKasha" },
      { _id: "imagiro", name: "Imagiro" },
      { _id: "tylezia", name: "Tylezia" },
      { _id: "hellmina", name: "HellMina" },
      { _id: "orukam", name: "Orukam" },
      { _id: "ombre", name: "Ombre" },
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
