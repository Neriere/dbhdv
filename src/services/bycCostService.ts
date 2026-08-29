import { BYC_LEGENDARY_HUNTS, BycHuntData } from "../data/bycDatabase";
import { MarketPriceMap } from "../types";
import { getStoredMarketPrices, getStoredItemPrice } from "./dofusDbService";

export interface BycResourceCostOption {
  method: "direct" | "fragments" | "map";
  label: string;
  cost: number;
  isCheapest: boolean;
}

export interface BycResourceCostAnalysis {
  resourceId: number;
  resourceName: string;
  hunt: BycHuntData;
  directPrice: number;
  fragmentsPrice: number;
  mapPrice: number;
  bestMethod: "direct" | "fragments" | "map";
  bestCost: number;
  savingsVsDirect: number;
  sebuscalinesEarned: number;
  sebuscalinesValue: number;
}

// Mapa rápido resourceId -> BycHuntData
const resourceToHuntMap = new Map<number, BycHuntData>();
for (const hunt of BYC_LEGENDARY_HUNTS) {
  if (hunt.resource && hunt.resource.id) {
    resourceToHuntMap.set(hunt.resource.id, hunt);
  }
}

/**
 * Comprueba si un ingrediente/ítem es un recurso obtenido de Cacería Legendaria (ByC)
 */
export function isBycResource(itemId: number): boolean {
  return resourceToHuntMap.has(itemId);
}

/**
 * Obtiene la cacería legendaria asociada a un recurso
 */
export function getBycHuntForResource(itemId: number): BycHuntData | undefined {
  return resourceToHuntMap.get(itemId);
}

/**
 * Analiza las 3 formas de obtener un recurso ByC:
 * 1. Compra directa en HDV
 * 2. Compra de todos los fragmentos y cacería
 * 3. Compra del mapa entero y cacería
 */
export function analyzeBycResourceCost(
  resourceId: number,
  marketPrices: MarketPriceMap = getStoredMarketPrices(),
  sebuscalineKamasRatio: number = 1000 // default 1.000 K por sebuscalín
): BycResourceCostAnalysis | null {
  const hunt = resourceToHuntMap.get(resourceId);
  if (!hunt) return null;

  // 1. Direct HDV Resource Price
  const directPrice = marketPrices[resourceId] ?? getStoredItemPrice(resourceId) ?? hunt.resource.defaultPrice ?? 0;

  // 2. Fragments Cost
  let fragmentsPrice = 0;
  if (hunt.fragments && hunt.fragments.length > 0) {
    for (const f of hunt.fragments) {
      const fPrice = marketPrices[f.id] ?? getStoredItemPrice(f.id) ?? f.defaultPrice ?? 0;
      fragmentsPrice += fPrice;
    }
  } else {
    fragmentsPrice = hunt.mapItem?.defaultPrice || 0;
  }

  // 3. Whole Map Price
  const mapPrice = marketPrices[hunt.mapItem.id] ?? getStoredItemPrice(hunt.mapItem.id) ?? hunt.mapItem.defaultPrice ?? 0;

  // Sebuscalines valuation (chest sebuscalines)
  const sebuscalinesEarned = hunt.chestSebuscalines || hunt.sebuscalines || 0;
  const sebuscalinesValue = sebuscalinesEarned * sebuscalineKamasRatio;

  // Net cost taking into account sebuscalines returned from hunt
  const netFragmentsCost = Math.max(0, fragmentsPrice - sebuscalinesValue);
  const netMapCost = Math.max(0, mapPrice - sebuscalinesValue);

  // We determine what is best for crafting/crushing acquisition cost
  // Note: Raw acquisition expenditure without selling sebuscalines is fragmentsPrice or mapPrice,
  // but if sebuscalines have value, net cost is lower.
  // By default comparing pure item purchase: fragmentsPrice vs mapPrice vs directPrice
  let bestMethod: "direct" | "fragments" | "map" = "direct";
  let bestCost = directPrice > 0 ? directPrice : Infinity;

  if (fragmentsPrice > 0 && fragmentsPrice < bestCost) {
    bestCost = fragmentsPrice;
    bestMethod = "fragments";
  }

  if (mapPrice > 0 && mapPrice < bestCost) {
    bestCost = mapPrice;
    bestMethod = "map";
  }

  if (bestCost === Infinity) {
    bestCost = directPrice || 0;
    bestMethod = "direct";
  }

  const savingsVsDirect = directPrice > 0 && bestCost < directPrice ? directPrice - bestCost : 0;

  return {
    resourceId,
    resourceName: hunt.resource.name,
    hunt,
    directPrice,
    fragmentsPrice,
    mapPrice,
    bestMethod,
    bestCost,
    savingsVsDirect,
    sebuscalinesEarned,
    sebuscalinesValue,
  };
}

/**
 * Devuelve el precio de adquisición más económico para cualquier ítem:
 * Si es un recurso ByC, compara HDV vs Fragmentos vs Mapa.
 * Si es un ingrediente normal, devuelve el precio HDV o subcrafteo.
 */
export function getOptimizedIngredientCost(
  itemId: number,
  marketPrices: MarketPriceMap = getStoredMarketPrices(),
  preferredMethodByc?: "auto" | "direct" | "fragments" | "map"
): { cost: number; isByc: boolean; method?: "direct" | "fragments" | "map"; bycAnalysis?: BycResourceCostAnalysis } {
  if (isBycResource(itemId)) {
    const analysis = analyzeBycResourceCost(itemId, marketPrices);
    if (analysis) {
      if (preferredMethodByc === "direct") {
        return { cost: analysis.directPrice, isByc: true, method: "direct", bycAnalysis: analysis };
      }
      if (preferredMethodByc === "fragments") {
        return { cost: analysis.fragmentsPrice, isByc: true, method: "fragments", bycAnalysis: analysis };
      }
      if (preferredMethodByc === "map") {
        return { cost: analysis.mapPrice, isByc: true, method: "map", bycAnalysis: analysis };
      }
      // auto: best cost
      return { cost: analysis.bestCost, isByc: true, method: analysis.bestMethod, bycAnalysis: analysis };
    }
  }

  const direct = marketPrices[itemId] ?? getStoredItemPrice(itemId) ?? 0;
  return { cost: direct, isByc: false };
}
