import { ItemSalesVolume, SalesVolumeMap } from "../types";

export type { ItemSalesVolume, SalesVolumeMap };

const SALES_VOLUME_STORAGE_KEY = "dofus_sales_volume_v1";

/**
 * Obtener el mapa de volúmenes guardados localmente
 */
export function getStoredSalesVolumeMap(): SalesVolumeMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(SALES_VOLUME_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Aplica una actualización remota respetando Last-Write-Wins (LWW) por timestamp
 */
export function handleRemoteVolumeUpdate(itemId: number, remoteVolume: ItemSalesVolume): boolean {
  if (typeof window === "undefined" || !itemId || !remoteVolume) return false;
  const current = getStoredSalesVolumeMap();
  const existing = current[itemId];

  const localTime = existing?.updatedAt || 0;
  const remoteTime = remoteVolume.updatedAt || 0;

  // Solo se actualiza si la cotización remota es más reciente o igual a la local
  if (remoteTime >= localTime || !existing) {
    current[itemId] = {
      ...existing,
      ...remoteVolume,
      updatedAt: remoteTime || Date.now(),
    };
    try {
      localStorage.setItem(SALES_VOLUME_STORAGE_KEY, JSON.stringify(current));
      window.dispatchEvent(
        new CustomEvent("dofus_sales_volume_updated", { detail: { itemId, volume: current[itemId] } })
      );
      return true;
    } catch (e) {
      console.warn("[handleRemoteVolumeUpdate] Storage write error:", e);
    }
  }
  return false;
}

/**
 * Sincroniza un mapa completo remoto con la base local usando LWW.
 * Si la base local tiene cambios más recientes que la remota, los conserva y los envía a la nube.
 */
export function syncRemoteSalesVolume(remoteMap: SalesVolumeMap): SalesVolumeMap {
  if (typeof window === "undefined") return remoteMap || {};
  const current = getStoredSalesVolumeMap();
  const localNewerToPush: Record<number, ItemSalesVolume> = {};
  let hasLocalUpdates = false;

  // 1. Procesar datos remotos
  if (remoteMap && typeof remoteMap === "object") {
    for (const [idStr, remoteVol] of Object.entries(remoteMap)) {
      const itemId = Number(idStr);
      if (!itemId || !remoteVol) continue;

      const localVol = current[itemId];
      const localTime = localVol?.updatedAt || 0;
      const remoteTime = remoteVol.updatedAt || 0;

      if (!localVol || remoteTime >= localTime) {
        current[itemId] = remoteVol;
        hasLocalUpdates = true;
      } else {
        // La versión local es más reciente: conservar y marcar para sincronizar al servidor
        localNewerToPush[itemId] = localVol;
      }
    }
  }

  // 2. Verificar datos locales que no existen en el servidor aún
  for (const [idStr, localVol] of Object.entries(current)) {
    const itemId = Number(idStr);
    if (!itemId || !localVol) continue;
    if (!remoteMap || !remoteMap[itemId]) {
      localNewerToPush[itemId] = localVol;
    }
  }

  if (hasLocalUpdates) {
    try {
      localStorage.setItem(SALES_VOLUME_STORAGE_KEY, JSON.stringify(current));
      window.dispatchEvent(
        new CustomEvent("dofus_sales_volume_updated", { detail: { count: Object.keys(current).length } })
      );
    } catch (e) {
      console.warn("[syncRemoteSalesVolume] Storage write error:", e);
    }
  }

  // 3. Si hay datos locales más recientes, subirlos a la nube para que otros jugadores los vean
  if (Object.keys(localNewerToPush).length > 0 && typeof window !== "undefined" && window.location?.host) {
    void fetch("/api/local-db/sales-volume/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ volumes: localNewerToPush }),
    }).catch((err) => {
      console.warn("[syncRemoteSalesVolume] Error sincronizando cambios locales a la nube:", err);
    });
  }

  return current;
}

/**
 * Consulta la API y sincroniza los volúmenes de venta con la nube
 */
export async function fetchAndSyncSalesVolume(): Promise<SalesVolumeMap> {
  if (typeof window === "undefined" || !window.location?.host) return getStoredSalesVolumeMap();
  try {
    const res = await fetch("/api/local-db/sales-volume");
    if (!res.ok) return getStoredSalesVolumeMap();
    const data = await res.json();
    if (data?.salesVolume) {
      return syncRemoteSalesVolume(data.salesVolume);
    }
  } catch (err) {
    console.warn("[fetchAndSyncSalesVolume] Error fetching sales volume:", err);
  }
  return getStoredSalesVolumeMap();
}

/**
 * Guardar volumen de ventas para un ítem con timestamp y persistencia en la nube
 */
export function saveItemSalesVolume(itemId: number, volume: Partial<ItemSalesVolume>): SalesVolumeMap {
  const current = getStoredSalesVolumeMap();
  const existing = current[itemId] || {};
  const now = Date.now();

  const updated: ItemSalesVolume = {
    ...existing,
    ...volume,
    updatedAt: now,
  };

  current[itemId] = updated;

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(SALES_VOLUME_STORAGE_KEY, JSON.stringify(current));
      window.dispatchEvent(new CustomEvent("dofus_sales_volume_updated", { detail: { itemId, volume: updated } }));
    } catch (e) {
      console.warn("Error guardando volumen de ventas localmente:", e);
    }

    // Sincronización asíncrona a la nube con LWW
    if (window.location?.host) {
      void fetch(`/api/local-db/sales-volume/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ volume: updated, updatedAt: now }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data && data.volume && data.volume.updatedAt > now) {
            // El servidor tenía un registro más reciente que no fue sobreescrito, actualizar local
            handleRemoteVolumeUpdate(itemId, data.volume);
          }
        })
        .catch((err) => {
          console.warn("[saveItemSalesVolume] Error enviando a la nube:", err);
        });
    }
  }

  return current;
}

/**
 * Calcula métricas analíticas a partir de los 3 registros (24h, 7d, 30d)
 * Si no existen registros suficientes (>0), retorna null sin clasificar como estancado.
 */
export interface SalesAnalysisResult {
  hasData: boolean;
  sales24h: number;
  sales7d: number;
  sales30d: number;
  avgDailySales: number;
  daysToSell: number | null;
  turnoverRating: "alta" | "media" | "baja" | null;
  turnoverLabel: string | null;
  momentum: "acelerado" | "estable" | "desacelerado" | null;
  suggestedPrice: number | null;
}

export function analyzeSalesVolume(
  currentPrice: number,
  volume?: ItemSalesVolume | null
): SalesAnalysisResult {
  const v24h = volume?.sales24h;
  const v7d = volume?.sales7d;
  const v30d = volume?.sales30d;
  const directDaily = volume?.avgDailySales;

  const hasPeriodData =
    (v24h !== undefined && v24h > 0) ||
    (v7d !== undefined && v7d > 0) ||
    (v30d !== undefined && v30d > 0);
  const hasDirectDaily = directDaily !== undefined && directDaily > 0;

  if (!hasPeriodData && !hasDirectDaily) {
    return {
      hasData: false,
      sales24h: v24h ?? 0,
      sales7d: v7d ?? 0,
      sales30d: v30d ?? 0,
      avgDailySales: 0,
      daysToSell: null,
      turnoverRating: null,
      turnoverLabel: null,
      momentum: null,
      suggestedPrice: null,
    };
  }

  const s24h = Math.max(0, v24h || 0);
  const s7d = Math.max(0, v7d || 0);
  const s30d = Math.max(0, v30d || 0);

  // Estimación de ventas diarias ponderadas:
  // 50% peso a 24h, 35% peso a 7d (diario), 15% peso a 30d (diario)
  const dailyFrom7d = s7d / 7;
  const dailyFrom30d = s30d / 30;

  let weightedDaily = 0;
  let weightsSum = 0;

  if (v24h !== undefined && v24h >= 0) {
    weightedDaily += s24h * 0.5;
    weightsSum += 0.5;
  }
  if (v7d !== undefined && v7d >= 0) {
    weightedDaily += dailyFrom7d * 0.35;
    weightsSum += 0.35;
  }
  if (v30d !== undefined && v30d >= 0) {
    weightedDaily += dailyFrom30d * 0.15;
    weightsSum += 0.15;
  }

  let avgDaily = weightsSum > 0 ? weightedDaily / weightsSum : (directDaily || 0);
  // If direct daily was explicitly set and hasPeriodData is false, use directDaily
  if (!hasPeriodData && hasDirectDaily) {
    avgDaily = directDaily!;
  }
  const daysToSell = avgDaily > 0 ? 1 / avgDaily : null;

  // Clasificación de rotación
  let turnoverRating: "alta" | "media" | "baja" | null = null;
  let turnoverLabel: string | null = null;

  if (avgDaily >= 3) {
    turnoverRating = "alta";
    turnoverLabel = "Alta rotación (< 8 horas)";
  } else if (avgDaily >= 1) {
    turnoverRating = "alta";
    turnoverLabel = "Alta rotación (~1 día)";
  } else if (avgDaily >= 0.25) {
    turnoverRating = "media";
    turnoverLabel = `Rotación media (~${Math.round(daysToSell || 3)} días)`;
  } else if (avgDaily > 0) {
    turnoverRating = "baja";
    turnoverLabel = `Rotación lenta (~${Math.round(daysToSell || 7)} días)`;
  }

  // Momentum (comparando 24h vs promedio 7d)
  let momentum: "acelerado" | "estable" | "desacelerado" | null = null;
  if (s7d > 0 && v24h !== undefined) {
    const expected24h = s7d / 7;
    if (s24h > expected24h * 1.3) {
      momentum = "acelerado";
    } else if (s24h < expected24h * 0.7) {
      momentum = "desacelerado";
    } else {
      momentum = "estable";
    }
  }

  // Precio sugerido de venta según liquidez y precio actual
  let suggestedPrice: number | null = null;
  if (currentPrice > 0) {
    if (turnoverRating === "alta") {
      // Precio competitivo inmediato (0.5% a 1% bajo precio actual)
      suggestedPrice = Math.round(currentPrice * 0.99);
    } else if (turnoverRating === "media") {
      suggestedPrice = Math.round(currentPrice * 0.98);
    } else if (turnoverRating === "baja") {
      suggestedPrice = Math.round(currentPrice * 0.95);
    } else {
      suggestedPrice = currentPrice;
    }
  }

  return {
    hasData: true,
    sales24h: s24h,
    sales7d: s7d,
    sales30d: s30d,
    avgDailySales: Number(avgDaily.toFixed(2)),
    daysToSell: daysToSell ? Number(daysToSell.toFixed(1)) : null,
    turnoverRating,
    turnoverLabel,
    momentum,
    suggestedPrice,
  };
}
