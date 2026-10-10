import type { DofusItem } from "../../types";

export interface IngestMarketPricePayload {
  item_id: number;
  item_name?: string;
  type?: 'recurso' | 'equipable' | string;
  precios: Record<string, number | string> | Array<number | string>;
  server?: string;
  source?: string;
  suggested_price?: number;
  suggestedPrice?: number;
}

export interface IngestMarketPriceResult {
  success: boolean;
  item_id: number;
  name: string;
  type: string;
  calculated_price: number;
  min_price: number;
  max_price: number;
  raw_average: number;
  offers_count: number;
  filtered_outliers?: number;
  anti_troll_triggered?: boolean;
  server: string;
  profile_id: number;
  updated_at: number;
}

export const DOFUS_EQUIPMENT_TYPE_IDS = new Set<number>([
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 16, 17, 18, 19, 20, 21, 22, 23,
  81, 82, 90, 97, 120, 121, 151, 169, 170, 187, 188, 189, 190, 196, 207, 220, 333
]);

export function isEquipmentTypeId(typeId: number): boolean {
  return DOFUS_EQUIPMENT_TYPE_IDS.has(Number(typeId));
}

export interface CalculatedMarketPriceResult {
  resolvedType: 'equipable' | 'recurso';
  finalPrice: number;
  minPrice: number;
  maxPrice: number;
  rawAvg: number;
  offersCount: number;
  filteredOutliers: number;
  antiTrollTriggered: boolean;
}

export function calculateItemMarketPrice(
  item: DofusItem | null | undefined,
  precios: any,
  fallbackType?: string,
  suggestedPrice?: number
): CalculatedMarketPriceResult {
  const typeId = Number(item?.typeId || item?.type?.id || 0);
  const superCategoryId = Number((item as any)?.superCategoryId || item?.type?.superCategoryId || 0);
  let resolvedType: 'equipable' | 'recurso' = 'recurso';

  // Consumibles (superCategoryId 2) y Recursos (superCategoryId 3) siempre se comercializan por lotes (x1, x10, x100, x1000)
  if (superCategoryId === 2 || superCategoryId === 3) {
    resolvedType = 'recurso';
  } else if (fallbackType === 'recurso' || fallbackType === 'equipable') {
    resolvedType = fallbackType;
  } else if (typeId > 0) {
    resolvedType = isEquipmentTypeId(typeId) ? 'equipable' : 'recurso';
  } else if (precios && typeof precios === 'object' && !Array.isArray(precios)) {
    const keys = Object.keys(precios);
    if (keys.some(k => ['10', '100', '1000'].includes(k))) {
      resolvedType = 'recurso';
    } else {
      resolvedType = 'equipable';
    }
  }

  let finalPrice = 0;
  let minPrice = 0;
  let maxPrice = 0;
  let rawAvg = 0;
  let offersCount = 0;
  let filteredOutliers = 0;
  let antiTrollTriggered = false;

  const rawItemName = item?.name?.es || (typeof item?.name === 'string' ? (item.name as string) : '') || (item as any)?.name_es || '';

  if (resolvedType === 'recurso') {
    let p1 = 0, p10 = 0, p100 = 0, p1000 = 0;

    if (Array.isArray(precios)) {
      let arr = precios.map(Number).filter(n => !Number.isNaN(n) && n >= 0);
      if (arr.length > 1 && arr[0] >= 1 && arr[0] <= 10 && arr.length === arr[0] + 1) {
        arr = arr.slice(1);
      } else if (arr.length === 5 && arr[0] <= 100 && (arr[0] <= 20 || (arr[1] > 0 && arr[2] >= arr[1]))) {
        arr = arr.slice(1);
      } else if (arr.length > 1 && arr[0] <= 10 && arr[1] >= 20) {
        arr = arr.slice(1);
      } else if (arr.length > 1 && arr[0] <= 50 && arr[1] > 0 && (arr[1] / Math.max(1, arr[0])) > 40) {
        arr = arr.slice(1);
      }
      p1 = Number(arr[0] || 0);
      p10 = Number(arr[1] || 0);
      p100 = Number(arr[2] || 0);
      p1000 = Number(arr[3] || 0);
    } else if (precios && typeof precios === 'object') {
      const rawObj = precios as Record<string, number | string>;
      p1 = Number(rawObj['1'] ?? rawObj[1] ?? 0);
      p10 = Number(rawObj['10'] ?? rawObj[10] ?? 0);
      p100 = Number(rawObj['100'] ?? rawObj[100] ?? 0);
      p1000 = Number(rawObj['1000'] ?? rawObj[1000] ?? 0);

      // Desfasaje automático si 'p1' contiene el prefijo del conteo de lotes o TypeID/Categoría (1..20)
      if (p1 <= 20 && p10 > 50 && (p10 / 10) > (p1 * 3)) {
        const isShiftedLots = p100 > 0 && (p100 / 10) <= (p10 * 3.0) && (p100 / 10) >= (p10 * 0.3);
        if (isShiftedLots) {
          p1 = Number(rawObj['10'] ?? 0);
          p10 = Number(rawObj['100'] ?? 0);
          p100 = Number(rawObj['1000'] ?? 0);
          p1000 = 0;
        }
      }

      // Si los lotes vienen invertidos (descendentes de x1000 a x1)
      if (p1 > 0 && p1000 > 0 && p1 > p1000) {
        const temp1 = p1;
        const temp10 = p10;
        p1 = p1000;
        p10 = p100;
        p100 = temp10;
        p1000 = temp1;
      }

      // Si solo viene un único precio en p1 pero es astronómico (>= 1,000,000k),
      // corresponde al lote de x1000 que se asignó a p1 (ej: Corteza de Brus a 29,999,990k por 1000 unidades)
      if (p1 >= 1_000_000 && p10 === 0 && p100 === 0 && p1000 === 0) {
        p1000 = p1;
        p1 = 0;
      } else if (p1 >= 200_000 && p10 === 0 && p100 === 0 && p1000 === 0 && (item?.level || 0) < 200) {
        p100 = p1;
        p1 = 0;
      }
    }

    const rawLots: { size: number; total: number; unit: number; baseWeight: number }[] = [];
    if (p1 > 0) rawLots.push({ size: 1, total: p1, unit: p1, baseWeight: 0.10 });
    if (p10 > 0) rawLots.push({ size: 10, total: p10, unit: Math.round(p10 / 10), baseWeight: 0.35 });
    if (p100 > 0) rawLots.push({ size: 100, total: p100, unit: Math.round(p100 / 100), baseWeight: 0.40 });
    if (p1000 > 0) rawLots.push({ size: 1000, total: p1000, unit: Math.round(p1000 / 1000), baseWeight: 0.15 });

    // Protección contra números de categoría (ej: 4 o 6) enviados como precio único
    // para pergaminos, esquíritus, consumibles, pócimas, o cualquier objeto que no sea recurso básico de nivel 1
    if (rawLots.length === 1 && rawLots[0].unit <= 10) {
      const lowerName = rawItemName.toLowerCase();
      const isSuspectItem = lowerName.includes('esquíritu') ||
                            lowerName.includes('esquiritu') ||
                            lowerName.includes('pergamino') ||
                            lowerName.includes('poción') ||
                            lowerName.includes('pocion') ||
                            lowerName.includes('runa') ||
                            (item && (item.level || 0) > 1);
      if (isSuspectItem) {
        console.warn(`[Market Ingest] Descartado precio anómalo/categoría (${rawLots[0].unit}k) para objeto: ${rawItemName} (#${item?.id})`);
        return {
          resolvedType,
          finalPrice: 0,
          minPrice: 0,
          maxPrice: 0,
          rawAvg: 0,
          offersCount: 0,
          filteredOutliers: 0,
          antiTrollTriggered: false,
        };
      }
    }

    if (rawLots.length > 0) {
      offersCount = rawLots.length;
      const allUnits = rawLots.map(l => l.unit);
      minPrice = Math.min(...allUnits);
      maxPrice = Math.max(...allUnits);
      const sum = allUnits.reduce((acc, val) => acc + val, 0);
      rawAvg = Math.round(sum / allUnits.length);

      if (rawLots.length === 1) {
        finalPrice = rawLots[0].unit;
      } else {
        // Depuración de outliers (troleos en x1 o errores tipográficos 1k) cuando hay 3 o 4 lotes
        let validLots = rawLots;
        if (rawLots.length >= 3) {
          const sortedUnits = [...allUnits].sort((a, b) => a - b);
          // Usar la mediana inferior para preservar el suelo real accesible del mercado
          const medianUnit = sortedUnits[Math.floor((sortedUnits.length - 1) / 2)];
          const cleaned = rawLots.filter(l => l.unit >= medianUnit * 0.25 && l.unit <= medianUnit * 3.5);
          if (cleaned.length > 0) {
            filteredOutliers = rawLots.length - cleaned.length;
            validLots = cleaned;
          }
        }
        const totalWeight = validLots.reduce((sum, l) => sum + l.baseWeight, 0);
        const weightedSum = validLots.reduce((sum, l) => sum + (l.unit * l.baseWeight), 0);
        finalPrice = Math.round(weightedSum / totalWeight);
      }
    }
  } else {
    let numericPrices: number[] = [];
    if (Array.isArray(precios)) {
      numericPrices = precios.map(Number).filter(n => !Number.isNaN(n) && n >= 50);
    } else if (precios && typeof precios === 'object') {
      numericPrices = Object.values(precios).map(Number).filter(n => !Number.isNaN(n) && n >= 50);
    }

    if (numericPrices.length > 0) {
      const sorted = [...numericPrices].sort((a, b) => a - b);
      offersCount = sorted.length;
      minPrice = sorted[0];
      maxPrice = sorted[sorted.length - 1];

      const sum = sorted.reduce((acc, val) => acc + val, 0);
      rawAvg = Math.round(sum / sorted.length);

      if (sorted.length === 1) {
        finalPrice = sorted[0];
      } else if (sorted.length === 2) {
        finalPrice = Math.round((sorted[0] + sorted[1]) / 2);
      } else {
        // Filtrar exomagueos extremos (> 1.8x del precio mínimo)
        const standardOffers = sorted.filter((p) => p <= minPrice * 1.8);
        const validOffers = standardOffers.length > 0 ? standardOffers : sorted;
        filteredOutliers = sorted.length - validOffers.length;

        // Promedio del grupo de ofertas más bajas competitivas (hasta las 3 primeras)
        const lowCluster = validOffers.slice(0, Math.min(3, validOffers.length));
        const lowAvg = lowCluster.reduce((a, b) => a + b, 0) / lowCluster.length;
        const medStd = validOffers[Math.floor(validOffers.length / 2)];

        // Mezcla ponderada: 70% precio competitivo bajo + 30% mediana estándar
        finalPrice = Math.round(lowAvg * 0.70 + medStd * 0.30);
      }
    }
  }

  // Salvaguarda de Precios Inflados / Ausencia de Stock contra Cotización Histórica:
  // 1. Si no hay ofertas en mercadillo (0 stock), se usa la cotización sugerida disponible.
  // 2. Si el precio en mercadillo está inflado (>= 3.0x de cotización), se protege contra troll inflado.
  // 3. Falso dump: si hay 2 o más ofertas en mercadillo o es equipable, el precio de mercadillo es real.
  //    Solo se considera dump anómalo si hay exactamente 1 oferta solitaria de recurso por debajo del 25%.
  if (suggestedPrice && suggestedPrice >= 1) {
    if (finalPrice > 0) {
      const isExaggerated = finalPrice >= suggestedPrice * 3.0;
      const isExtremeDump =
        offersCount === 1 &&
        resolvedType === "recurso" &&
        finalPrice <= suggestedPrice * 0.25;

      if (isExaggerated || isExtremeDump) {
        antiTrollTriggered = true;
        finalPrice = Math.round(suggestedPrice);
      }
    } else {
      // Sin ofertas disponibles en mercadillo: asignar temporalmente cotización sugerida
      finalPrice = Math.round(suggestedPrice);
    }
  }

  return {
    resolvedType,
    finalPrice,
    minPrice,
    maxPrice,
    rawAvg,
    offersCount,
    filteredOutliers,
    antiTrollTriggered,
  };
}
