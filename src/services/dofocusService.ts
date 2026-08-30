import {
  bulkSaveItemCoefficients,
  getAllSavedItemCoefficients,
  getAllSavedItemCoefficientTimestamps,
  saveItemCoefficient,
} from "../data/dofusRuneWeights";

export interface DofocusServer {
  _id: string;
  name: string;
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
      { _id: "brial", name: "Brial" },
      { _id: "imagiro", name: "Imagiro" },
      { _id: "orukam", name: "Orukam" },
      { _id: "talkasha", name: "TalKasha" },
      { _id: "hellmina", name: "HellMina" },
      { _id: "tylezia", name: "Tylezia" },
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
  const url = `/api/dofocus/coefficients/${encodeURIComponent(serverName)}${
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
  const res = await fetch(`/api/dofocus/item/${itemId}?server=${encodeURIComponent(serverName)}`);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Synchronize coefficients from DoFocus into local storage & state.
 *
 * @param serverName Target Dofus server (defaults to "Draconiros")
 * @param options.onlyIfDefault If true, only update items whose current coefficient is missing or default 100%
 * @param options.forceRefresh If true, bypass backend cache and fetch fresh from DoFocus
 */
export async function syncDofocusCoefficients(
  serverName = "Draconiros",
  options: {
    onlyIfDefault?: boolean;
    forceRefresh?: boolean;
    minDaysOld?: number;
  } = {}
): Promise<DofocusSyncResult> {
  const data = await fetchDofocusServerCoefficients(serverName, options.forceRefresh);
  const coefficients = data.coefficients || [];

  const existing = getAllSavedItemCoefficients();
  let entriesToSave = coefficients;

  if (options.onlyIfDefault) {
    entriesToSave = coefficients.filter((item) => {
      const curr = existing[item.itemId];
      return curr === undefined || curr === 100;
    });
  }

  const result = bulkSaveItemCoefficients(entriesToSave, {
    onlyIfDefault: options.onlyIfDefault,
  });

  // Compute summary metrics
  const validCoeffs = coefficients.map((c) => c.coefficient).filter((c) => typeof c === "number");
  const avgCoeff = validCoeffs.length > 0
    ? Math.round(validCoeffs.reduce((a, b) => a + b, 0) / validCoeffs.length)
    : 100;

  const topProfitableCount = coefficients.filter((c) => c.coefficient >= 150).length;

  return {
    server: serverName,
    totalAvailable: coefficients.length,
    updatedCount: result.updatedCount,
    skippedCount: coefficients.length - result.updatedCount,
    averageCoefficient: avgCoeff,
    topProfitableItemsCount: topProfitableCount,
    timestamp: Date.now(),
  };
}
