/**
 * Servicio de optimización y cálculo de subida de oficios (1-200) para Dofus.
 * Soporta los 14 oficios (6 de recolección y 8 de crafteo, incluido Ganadero).
 * Simulación exacta craft-a-craft con decaimiento dinámico oficial de XP.
 * Integración económica avanzada con cálculo de fragmentos de Busca y Captura (ByC).
 */

import {
  CraftableItem,
  getCraftableItemsSnapshot,
  getStoredMarketPrices,
  getStoredRecipes,
  getStoredItemPrice,
  getItemById,
  calculateEstimatedRunesValue,
} from "./dofusDbService";
import {
  getStoredSalesVolumeMap,
  analyzeSalesVolume,
  ItemSalesVolume,
} from "./salesVolumeService";
import {
  isBycResource,
  getOptimizedIngredientCost,
  getBycHuntForResource,
  getStoredSebuscalinPrice,
} from "./bycCostService";
import { USER_JOBS_DEFINITIONS, JobConfigDefinition } from "./userJobsService";
import { DofusRecipe, DofusItem } from "../types";
import { isQuestOrZeroXpCraft } from "../data/dofusJobs";
export { isQuestOrZeroXpCraft };

// ----------------------------------------------------
// Tipos y Modelos de Datos
// ----------------------------------------------------

export type JobOptimizerStrategy =
  | "low_budget"        // 💸 Mínimo Gasto de Bolsillo (menor coste bruto total en ingredientes)
  | "profit"            // 💰 Máxima Rentabilidad (mayor ganancia neta en mercadillo)
  | "high_turnover"     // 🌊 Alta Rotación y Liquidez (venta rápida en 24-48h)
  | "fastest"           // ⚡ Ultrarrápido (máxima XP por craft, menos clics)
  | "consumables_only"  // 🌿 Solo Consumibles/Componentes (apilables en x100, sin equipables)
  | "crush_runes";      // ♻️ Rompe-Runas (craftear para machacar en la Rompedora)

export interface SelectedCraftEntry {
  recipe: DofusRecipe;
  item: CraftableItem;
  amount: number;
  xpGained: number; // XP real acumulada sumando craft a craft con decaimiento
  craftCostUnit: number; // Coste óptimo por unidad (incluyendo ByC por fragmentos)
  totalCraftCost: number;
  marketPriceUnit: number;
  netSaleUnit: number;
  totalNetSale: number;
  sebuscalinesPerCraft: number; // Sebuscalines obtenidos por unidad de craft (si la ruta ByC es fragmento/mapa)
  totalSebuscalines: number;     // Sebuscalines totales obtenidos
  sebuscalinesValueUnit: number; // Valor en kamas de los sebuscalines obtenidos por unidad
  totalSebuscalinesValue: number;// Valor en kamas total del botín de sebuscalines
  totalRevenueUnit: number;      // Retorno total unitario (netSaleUnit + sebuscalinesValueUnit)
  totalRevenue: number;          // Retorno total (totalNetSale + totalSebuscalinesValue)
  profitUnit: number;            // Retorno unitario - coste (positivo = ganancia, negativo = pérdida)
  totalProfit: number;
  avgDailySales: number;
  turnoverRating: "alta" | "media" | "baja" | null;
  daysToSell: number | null;
  requiresByc: boolean;
  requiresPebbles: boolean;
  phaseIndex?: number; // Fase o tramo al que pertenece el crafteo
  isLevelInsufficient?: boolean; // Verdadero si el nivel al llegar a este paso es inferior al nivel requerido
  levelRequired?: number;        // Nivel requerido para craftear el objeto
  levelAtCraft?: number;         // Nivel del oficio al iniciar este lote de crafteo
}

export interface LevelTier {
  tierIndex: number;
  fromLevel: number;
  toLevel: number;
  requiredXp: number;
}

export interface JobPlanPhase {
  phaseIndex: number;
  fromLevel: number;
  toLevel: number;
  startXp: number;
  targetXp: number;
  requiredXp: number;
  xpGained: number;
  crafts: SelectedCraftEntry[];
  totalInvestment: number;
  totalNetRevenue: number;
  totalSebuscalines?: number;
  totalSebuscalinesValue?: number;
  netProfitOrLoss: number;
}

export interface ConsolidatedMaterial {
  itemId: number;
  name: string;
  iconId: number;
  quantity: number;
  unitPrice: number;
  totalCost: number;
  isByc: boolean;
  bycMethod?: "direct" | "fragments" | "map";
  sebuscalinesEarned?: number;
  sebuscalinesValue?: number;
}

export interface JobPlanState {
  jobId: number;
  jobNameEs: string;
  startingLevel: number;
  startingXp: number;
  targetLevel: number;
  targetXp: number;
  actualLevel: number;
  actualXp: number;
  totalXpGained: number;
  xpMultiplier: number;
  isBoostedServer: boolean;
  strategy: JobOptimizerStrategy;
  maxDailyAbsorptionRatio: number; // 1x a 4x ventas diarias
  excludeByc: boolean;
  excludePebbles: boolean;
  maxCostPerCraft: number; // 0 = ilimitado
  phases: JobPlanPhase[];
  selectedCrafts: SelectedCraftEntry[];
  materialsNeeded: ConsolidatedMaterial[];
  summary: {
    totalCrafts: number;
    totalInvestment: number;
    totalNetRevenue: number;
    totalSebuscalines?: number;
    totalSebuscalinesValue?: number;
    netProfitOrLoss: number;
    globalKamasPerXp: number;
    estimatedDaysToSell: number;
  };
  lastUpdated: number;
}

// ----------------------------------------------------
// Constantes de Oficios Soportados (14 oficios)
// ----------------------------------------------------

export const SUPPORTED_JOB_IDS: number[] = [
  // Recolección (6)
  26, // Alquimista
  28, // Campesino
  41, // Cazador
  2,  // Leñador
  24, // Minero
  36, // Pescador
  // Crafteo (8)
  16, // Joyero
  27, // Sastre
  15, // Zapatero
  11, // Herrero
  13, // Escultor
  60, // Fabricante
  65, // Manitas
  101,// Ganadero (objetos de cría)
];

export const SUPPORTED_JOBS: JobConfigDefinition[] = USER_JOBS_DEFINITIONS.filter(
  (j) => SUPPORTED_JOB_IDS.includes(j.id)
);

// Tipo 152: Guijarros en Dofus
export const PEBBLE_TYPE_ID = 152;
export const KNOWN_PEBBLE_IDS = new Set([
  12737, 12738, 12740, 13365, 13366, 13367, 18766, 23244, 23944, 29444,
]);

export function isPebbleResource(itemId: number): boolean {
  if (KNOWN_PEBBLE_IDS.has(itemId)) return true;
  const item = getItemById(itemId);
  return item?.typeId === PEBBLE_TYPE_ID || item?.type?.id === PEBBLE_TYPE_ID;
}

// ----------------------------------------------------
// Motor Matemático de XP Oficial de Dofus
// ----------------------------------------------------

/**
 * Retorna la experiencia acumulada oficial para alcanzar un nivel (1 a 200).
 * Nivel * (Nivel - 1) * 10
 */
export function levelToXp(level: number): number {
  const lvl = Math.max(1, Math.min(200, Math.floor(level)));
  return lvl * (lvl - 1) * 10;
}

/**
 * Retorna el nivel correspondiente a una cantidad de XP acumulada.
 */
export function xpToLevel(xp: number): number {
  if (xp <= 0) return 1;
  const computed = Math.floor((Math.sqrt(1 + 0.4 * xp) + 1) / 2);
  return Math.max(1, Math.min(200, computed));
}

/**
 * Retorna el siguiente hito decadal de nivel (10, 20, 30... 200).
 */
export function getNextMilestoneLevel(currentLevel: number, step = 10, offset = 0): number {
  const lvl = Math.max(1, Math.min(200, Math.floor(currentLevel)));
  if (lvl >= 200) return 200;

  let s = lvl;
  let e = offset || 0;
  while (e >= 0) {
    if (s % step !== 0) {
      s -= s % step;
    }
    s += step;
    e -= 1;
  }
  return Math.min(200, Math.max(lvl + 1, s));
}

/**
 * Divide el rango de niveles en tramos decadales (ej. 43 -> 50, 50 -> 60, etc.)
 */
export function calculateLevelTiers(fromLevel: number, toLevel: number): LevelTier[] {
  const start = Math.max(1, Math.min(200, Math.floor(fromLevel)));
  const end = Math.max(start, Math.min(200, Math.floor(toLevel)));
  if (start >= end) return [];

  const tiers: LevelTier[] = [];
  let curr = start;
  let idx = 1;

  while (curr < end) {
    let nextMilestone = Math.ceil((curr + 1) / 10) * 10;
    if (nextMilestone <= curr) nextMilestone = curr + 10;
    const tierEnd = Math.min(end, nextMilestone);

    const startXp = levelToXp(curr);
    const endXp = levelToXp(tierEnd);
    tiers.push({
      tierIndex: idx++,
      fromLevel: curr,
      toLevel: tierEnd,
      requiredXp: endXp - startXp,
    });

    curr = tierEnd;
  }

  return tiers;
}

/**
 * Porcentaje de progresión hacia el siguiente nivel.
 */
export function calculateLevelProgressionPercent(currentXp: number): number {
  const currentLvl = xpToLevel(currentXp);
  if (currentLvl >= 200) return 100;

  const currentLevelXp = levelToXp(currentLvl);
  const nextLevelXp = levelToXp(currentLvl + 1);
  const neededForLevel = nextLevelXp - currentLevelXp;
  const progressInLevel = currentXp - currentLevelXp;

  if (neededForLevel <= 0) return 100;
  const pct = Math.floor((progressInLevel / neededForLevel) * 100);
  return Math.max(0, Math.min(100, pct));
}

/**
 * Calcula la experiencia que otorga una receta para un nivel de oficio específico.
 * Decaimiento oficial: 20 * NivelReceta / ( (NivelOficio - NivelReceta)^1.1 / 10 + 1 )
 */
export function getCraftXpByJobLevel(
  recipeLevel: number,
  jobLevel: number,
  xpMultiplier = 1.0,
  craftXpRatio = 1.0,
  isBoostedServer = false
): number {
  if (recipeLevel > jobLevel) {
    return 0;
  }
  if (jobLevel - 100 > recipeLevel) {
    return 0;
  }
  const delta = Math.max(0, jobLevel - recipeLevel);
  const base = (20 * recipeLevel * (isBoostedServer ? 3 : 1)) / (Math.pow(delta, 1.1) / 10 + 1);
  const xp = Math.floor(Math.floor(base * craftXpRatio) * xpMultiplier);
  return isNaN(xp) || xp < 0 ? 0 : xp;
}

// ----------------------------------------------------
// Coste Óptimo de Recetas (Con Fragmentos de ByC)
// ----------------------------------------------------

export function calculateOptimizedCraftCost(
  recipe: DofusRecipe,
  marketPrices = getStoredMarketPrices()
): {
  cost: number;
  requiresByc: boolean;
  requiresPebbles: boolean;
  sebuscalinesEarned: number;
  sebuscalinesValue: number;
  sebuscalinUnitPrice: number;
} {
  const sebuscalinUnitPrice = getStoredSebuscalinPrice();
  if (!recipe || !recipe.ingredientIds || recipe.ingredientIds.length === 0) {
    return {
      cost: 0,
      requiresByc: false,
      requiresPebbles: false,
      sebuscalinesEarned: 0,
      sebuscalinesValue: 0,
      sebuscalinUnitPrice,
    };
  }

  let totalCost = 0;
  let requiresByc = false;
  let requiresPebbles = false;
  let sebuscalinesEarned = 0;

  for (let i = 0; i < recipe.ingredientIds.length; i++) {
    const ingId = recipe.ingredientIds[i];
    const qty = recipe.quantities?.[i] || 1;

    if (isBycResource(ingId)) {
      requiresByc = true;
    }
    if (isPebbleResource(ingId)) {
      requiresPebbles = true;
    }

    // Ruta de coste optimizada (fragmentos de mapa si es ByC o precio más bajo)
    const costInfo = getOptimizedIngredientCost(ingId, marketPrices, "auto");
    totalCost += costInfo.cost * qty;

    // Si el ingrediente es de Busca y Captura y la ruta óptima es fragmentos o mapa:
    // Significa que se consiguió también un retorno del cofre de Sebuscalines por cada cacería realizada
    if (costInfo.isByc && (costInfo.method === "fragments" || costInfo.method === "map")) {
      const hunt = costInfo.bycAnalysis?.hunt || getBycHuntForResource(ingId);
      const chestSebus = hunt?.chestSebuscalines || hunt?.sebuscalines || 0;
      sebuscalinesEarned += chestSebus * qty;
    }
  }

  const sebuscalinesValue = sebuscalinesEarned * sebuscalinUnitPrice;

  return {
    cost: totalCost,
    requiresByc,
    requiresPebbles,
    sebuscalinesEarned,
    sebuscalinesValue,
    sebuscalinUnitPrice,
  };
}

// ----------------------------------------------------
// Simulación Exacta Craft-a-Craft (Idéntica a DofusDB)
// ----------------------------------------------------

/**
 * Simula el XP ganado al craftear `amount` unidades de una receta a partir de un XP inicial.
 * En cada unidad simula el avance de nivel y aplica el decaimiento dinámico.
 */
export function simulateCraftBatch(
  startingXp: number,
  recipeLevel: number,
  amount: number,
  xpMultiplier = 1.0,
  isBoostedServer = false,
  craftXpRatio = 1.0
): { totalXpEarned: number; finalXp: number; finalLevel: number } {
  let runningXp = startingXp;
  let totalXpEarned = 0;

  if (craftXpRatio === 0) {
    return {
      totalXpEarned: 0,
      finalXp: startingXp,
      finalLevel: xpToLevel(startingXp),
    };
  }

  for (let i = 0; i < amount; i++) {
    const currentLevel = xpToLevel(runningXp);
    if (currentLevel < recipeLevel) {
      break;
    }
    const xp = getCraftXpByJobLevel(recipeLevel, currentLevel, xpMultiplier, craftXpRatio, isBoostedServer);
    if (xp <= 0) break;

    totalXpEarned += xp;
    runningXp += xp;
  }

  return {
    totalXpEarned,
    finalXp: runningXp,
    finalLevel: xpToLevel(runningXp),
  };
}

/**
 * Simula cuántos crafteos de una receta se necesitan para alcanzar un nivel objetivo.
 * Replica `addToLevel` de DofusDB con decaimiento dinámico craft a craft.
 */
export function simulateCraftsUntilLevel(
  startingXp: number,
  recipeLevel: number,
  targetLevel: number,
  xpMultiplier = 1.0,
  isBoostedServer = false,
  craftXpRatio = 1.0,
  maxIterations = 50000
): { amountNeeded: number; totalXpEarned: number; finalXp: number; finalLevel: number } {
  let runningXp = startingXp;
  let totalXpEarned = 0;
  let amount = 0;

  if (craftXpRatio === 0) {
    return {
      amountNeeded: 0,
      totalXpEarned: 0,
      finalXp: startingXp,
      finalLevel: xpToLevel(startingXp),
    };
  }

  while (xpToLevel(runningXp) < targetLevel && amount < maxIterations) {
    const currentLevel = xpToLevel(runningXp);
    if (currentLevel < recipeLevel) {
      break;
    }
    const xp = getCraftXpByJobLevel(recipeLevel, currentLevel, xpMultiplier, craftXpRatio, isBoostedServer);
    if (xp <= 0) break;

    totalXpEarned += xp;
    runningXp += xp;
    amount++;
  }

  return {
    amountNeeded: amount,
    totalXpEarned,
    finalXp: runningXp,
    finalLevel: xpToLevel(runningXp),
  };
}

/**
 * Recalcula de forma encadenada toda la lista de crafteos seleccionados.
 * El primer crafteo inicia en `baseStartingXp`, y cada crafteo subsiguiente
 * parte del XP acumulado dejado por los anteriores, asegurando que el decaimiento
 * sea 100% exacto para todas las recetas del plan.
 */
export function recalculateSelectedCraftsSequence(
  baseStartingXp: number,
  crafts: Array<{ recipe: DofusRecipe; item: CraftableItem; amount: number }>,
  xpMultiplier = 1.0,
  isBoostedServer = false,
  customPricesMap?: Record<number, number>
): { updatedEntries: SelectedCraftEntry[]; finalXp: number; finalLevel: number } {
  const pricesMap = customPricesMap ?? getStoredMarketPrices();
  const salesMap = getStoredSalesVolumeMap();

  let runningXp = baseStartingXp;
  const updatedEntries: SelectedCraftEntry[] = [];

  for (const c of crafts) {
    if (c.amount <= 0) continue;

    const startXpForThisItem = runningXp;
    const currentLevelAtCraft = xpToLevel(startXpForThisItem);
    const requiredItemLevel = c.item.level || 1;
    const isLevelInsufficient = currentLevelAtCraft < requiredItemLevel;
    const isQuestOrZero = isQuestOrZeroXpCraft(c.item, c.recipe);
    const itemCraftRatio = isQuestOrZero
      ? 0
      : ((c.item as any)?.craftXpRatio ?? (c.recipe as any)?.craftXpRatio ?? 1.0);

    const sim = simulateCraftBatch(
      startXpForThisItem,
      requiredItemLevel,
      c.amount,
      xpMultiplier,
      isBoostedServer,
      itemCraftRatio
    );

    runningXp = sim.finalXp;

    const costInfo = calculateOptimizedCraftCost(c.recipe, pricesMap);
    const craftCostUnit = costInfo.cost;
    const marketPriceUnit = pricesMap[c.item.id] || getStoredItemPrice(c.item.id) || 0;
    const netSaleUnit = Math.floor(marketPriceUnit * 0.98);
    const sebuscalinesPerCraft = costInfo.sebuscalinesEarned;
    const sebuscalinesValueUnit = costInfo.sebuscalinesValue;
    const totalRevenueUnit = netSaleUnit + sebuscalinesValueUnit;
    const profitUnit = totalRevenueUnit - craftCostUnit;

    const totalCraftCost = craftCostUnit * c.amount;
    const totalNetSale = netSaleUnit * c.amount;
    const totalSebuscalines = sebuscalinesPerCraft * c.amount;
    const totalSebuscalinesValue = sebuscalinesValueUnit * c.amount;
    const totalRevenue = totalNetSale + totalSebuscalinesValue;
    const totalProfit = profitUnit * c.amount;

    const volumeData = salesMap[c.item.id] as ItemSalesVolume | undefined;
    const salesAnalysis = analyzeSalesVolume(marketPriceUnit, volumeData);

    updatedEntries.push({
      recipe: c.recipe,
      item: c.item,
      amount: c.amount,
      xpGained: sim.totalXpEarned,
      craftCostUnit,
      totalCraftCost,
      marketPriceUnit,
      netSaleUnit,
      totalNetSale,
      sebuscalinesPerCraft,
      totalSebuscalines,
      sebuscalinesValueUnit,
      totalSebuscalinesValue,
      totalRevenueUnit,
      totalRevenue,
      profitUnit,
      totalProfit,
      avgDailySales: salesAnalysis.avgDailySales || 0,
      turnoverRating: salesAnalysis.turnoverRating,
      daysToSell: salesAnalysis.daysToSell,
      requiresByc: costInfo.requiresByc,
      requiresPebbles: costInfo.requiresPebbles,
      isLevelInsufficient,
      levelRequired: requiredItemLevel,
      levelAtCraft: currentLevelAtCraft,
    });
  }

  return {
    updatedEntries,
    finalXp: runningXp,
    finalLevel: xpToLevel(runningXp),
  };
}

// ----------------------------------------------------
// Consolidación de Materiales y Resumen
// ----------------------------------------------------

export function consolidateMaterialsNeeded(
  crafts: SelectedCraftEntry[]
): ConsolidatedMaterial[] {
  const ingMap = new Map<
    number,
    {
      quantity: number;
      unitPrice: number;
      name: string;
      iconId: number;
      isByc: boolean;
      bycMethod?: "direct" | "fragments" | "map";
      sebuscalinesEarned?: number;
      sebuscalinesValue?: number;
    }
  >();
  const pricesMap = getStoredMarketPrices();
  const sebuscalinPrice = getStoredSebuscalinPrice();

  for (const c of crafts) {
    const recipe = c.recipe;
    if (!recipe || !recipe.ingredientIds) continue;

    for (let i = 0; i < recipe.ingredientIds.length; i++) {
      const ingId = recipe.ingredientIds[i];
      const qty = (recipe.quantities?.[i] || 1) * c.amount;
      const current = ingMap.get(ingId);

      if (current) {
        current.quantity += qty;
        if (current.isByc && (current.bycMethod === "fragments" || current.bycMethod === "map")) {
          const hunt = getBycHuntForResource(ingId);
          const chestSebus = hunt?.chestSebuscalines || hunt?.sebuscalines || 0;
          current.sebuscalinesEarned = (current.sebuscalinesEarned || 0) + chestSebus * qty;
          current.sebuscalinesValue = (current.sebuscalinesEarned || 0) * sebuscalinPrice;
        }
      } else {
        const item = getItemById(ingId);
        const name =
          typeof item?.name === "object"
            ? item.name.es
            : item?.name
            ? String(item.name)
            : `Objeto #${ingId}`;
        const iconId = item?.iconId || ingId;
        const costInfo = getOptimizedIngredientCost(ingId, pricesMap, "auto");

        let sebuscalinesEarned = 0;
        let sebuscalinesValue = 0;
        if (costInfo.isByc && (costInfo.method === "fragments" || costInfo.method === "map")) {
          const hunt = costInfo.bycAnalysis?.hunt || getBycHuntForResource(ingId);
          const chestSebus = hunt?.chestSebuscalines || hunt?.sebuscalines || 0;
          sebuscalinesEarned = chestSebus * qty;
          sebuscalinesValue = sebuscalinesEarned * sebuscalinPrice;
        }

        ingMap.set(ingId, {
          quantity: qty,
          unitPrice: costInfo.cost,
          name,
          iconId,
          isByc: costInfo.isByc,
          bycMethod: costInfo.method,
          sebuscalinesEarned,
          sebuscalinesValue,
        });
      }
    }
  }

  const result: ConsolidatedMaterial[] = [];
  for (const [itemId, data] of ingMap.entries()) {
    result.push({
      itemId,
      name: data.name,
      iconId: data.iconId,
      quantity: data.quantity,
      unitPrice: data.unitPrice,
      totalCost: data.quantity * data.unitPrice,
      isByc: data.isByc,
      bycMethod: data.bycMethod,
      sebuscalinesEarned: data.sebuscalinesEarned,
      sebuscalinesValue: data.sebuscalinesValue,
    });
  }

  result.sort((a, b) => b.totalCost - a.totalCost);
  return result;
}

export function calculateSummary(
  crafts: SelectedCraftEntry[],
  totalXpGained: number
): JobPlanState["summary"] {
  let totalCrafts = 0;
  let totalInvestment = 0;
  let totalNetRevenue = 0;
  let totalSebuscalines = 0;
  let totalSebuscalinesValue = 0;
  let maxDaysToSell = 0;

  for (const c of crafts) {
    totalCrafts += c.amount;
    totalInvestment += c.totalCraftCost;
    const revenue = c.totalRevenue ?? (c.totalNetSale + (c.totalSebuscalinesValue || 0));
    totalNetRevenue += revenue;
    totalSebuscalines += (c.totalSebuscalines || 0);
    totalSebuscalinesValue += (c.totalSebuscalinesValue || 0);
    if (c.daysToSell && c.daysToSell > maxDaysToSell) {
      maxDaysToSell = c.daysToSell;
    }
  }

  const netProfitOrLoss = totalNetRevenue - totalInvestment;
  const globalKamasPerXp = totalXpGained > 0 ? (totalInvestment - totalNetRevenue) / totalXpGained : 0;

  return {
    totalCrafts,
    totalInvestment,
    totalNetRevenue,
    totalSebuscalines,
    totalSebuscalinesValue,
    netProfitOrLoss,
    globalKamasPerXp,
    estimatedDaysToSell: Math.ceil(maxDaysToSell),
  };
}

// ----------------------------------------------------
// Motor de Auto-Optimización con las 6 Rutas
// ----------------------------------------------------

export interface AutoOptimizeOptions {
  jobId: number;
  startingLevel: number;
  targetLevel: number;
  strategy: JobOptimizerStrategy;
  xpMultiplier?: number;
  isBoostedServer?: boolean;
  maxDailyAbsorptionRatio?: number; // 1x a 4x ventas
  excludeByc?: boolean;
  excludePebbles?: boolean;
  maxCostPerCraft?: number; // 0 = sin límite
}

/**
 * Genera crafteos optimizados organizados en FASES estructuradas según tramos de niveles.
 */
export function generateOptimizedPhases(
  options: AutoOptimizeOptions
): JobPlanPhase[] {
  const {
    jobId,
    startingLevel,
    targetLevel,
    strategy,
    xpMultiplier = 1.0,
    isBoostedServer = false,
    maxDailyAbsorptionRatio = 3.0,
    excludeByc = false,
    excludePebbles = false,
    maxCostPerCraft = 0,
  } = options;

  const snapshot = getCraftableItemsSnapshot();
  const pricesMap = getStoredMarketPrices();
  const salesMap = getStoredSalesVolumeMap();

  const cleanStart = Math.max(1, Math.min(200, Math.floor(startingLevel)));
  const cleanTarget = Math.max(cleanStart, Math.min(200, Math.floor(targetLevel)));
  const tiers = calculateLevelTiers(cleanStart, cleanTarget);
  if (tiers.length === 0) return [];

  // Filtrar recetas válidas para este oficio (excluyendo estrictamente recetas de misión o con 0 XP)
  const jobRecipes = snapshot
    .filter((item) => {
      if (item.jobId !== jobId) return false;
      if (!item.recipeData || !item.recipeData.ingredientIds?.length) return false;
      if (isQuestOrZeroXpCraft(item, item.recipeData)) return false;

      if (strategy === "consumables_only") {
        const isEquip =
          item.type?.superCategoryId === 1 || item.type?.superCategoryId === 2;
        if (isEquip) return false;
      }

      return true;
    })
    .map((item) => {
      const recipe = item.recipeData!;
      const costInfo = calculateOptimizedCraftCost(recipe, pricesMap);
      const marketPrice = pricesMap[item.id] || getStoredItemPrice(item.id) || 0;
      const netSale = Math.floor(marketPrice * 0.98);
      const totalRevenue = netSale + costInfo.sebuscalinesValue;
      const profit = totalRevenue - costInfo.cost;
      const netCost = costInfo.cost - totalRevenue;

      const volumeData = salesMap[item.id] as ItemSalesVolume | undefined;
      const salesAnalysis = analyzeSalesVolume(marketPrice, volumeData);
      const avgDailySales = salesAnalysis.avgDailySales || 0;

      let maxAllowed: number;
      if (avgDailySales > 0) {
        maxAllowed = Math.max(1, Math.round(avgDailySales * maxDailyAbsorptionRatio));
      } else {
        maxAllowed = Math.max(1, Math.round(2 * maxDailyAbsorptionRatio));
      }

      const runesEstimate =
        strategy === "crush_runes" ? calculateEstimatedRunesValue(item) : 0;

      return {
        item,
        recipe,
        level: item.level || 1,
        craftCost: costInfo.cost,
        marketPrice,
        netSale,
        profit,
        netCost,
        avgDailySales,
        turnoverRating: salesAnalysis.turnoverRating,
        daysToSell: salesAnalysis.daysToSell,
        maxAllowed,
        requiresByc: costInfo.requiresByc,
        requiresPebbles: costInfo.requiresPebbles,
        runesEstimate,
      };
    })
    .filter((r) => {
      if (excludeByc && r.requiresByc) return false;
      if (excludePebbles && r.requiresPebbles) return false;
      if (maxCostPerCraft > 0 && r.craftCost > maxCostPerCraft) return false;
      return true;
    });

  if (jobRecipes.length === 0) return [];

  const phases: JobPlanPhase[] = [];
  let runningXp = levelToXp(cleanStart);
  const cumulativeUsage = new Map<number, number>();

  for (const tier of tiers) {
    const tierStartLvl = xpToLevel(runningXp);
    const tierTargetLvl = tier.toLevel;
    const tierStartXp = runningXp;
    const tierTargetXp = levelToXp(tierTargetLvl);
    const requiredXp = Math.max(0, tierTargetXp - tierStartXp);

    const tierSequence: Array<{ recipe: DofusRecipe; item: CraftableItem; amount: number }> = [];
    let tierIteration = 0;
    const maxTierIterations = 1000;

    while (
      xpToLevel(runningXp) < tierTargetLvl &&
      runningXp < tierTargetXp &&
      tierIteration < maxTierIterations
    ) {
      tierIteration++;
      const currentJobLevel = xpToLevel(runningXp);

      const available = jobRecipes.filter(
        (r) => r.level <= currentJobLevel && currentJobLevel <= r.level + 100
      );
      if (available.length === 0) break;

      const scored = available
        .map((r) => {
          const xpRatio = (r.item as any)?.craftXpRatio !== undefined
            ? (r.item as any).craftXpRatio
            : (r.recipe as any)?.craftXpRatio ?? 1.0;
          const xp = getCraftXpByJobLevel(r.level, currentJobLevel, xpMultiplier, xpRatio, isBoostedServer);
          if (xp <= 0) return null;

          const used = cumulativeUsage.get(r.item.id) || 0;
          const capacity = Math.max(0, r.maxAllowed - used);

          let score = 0;
          switch (strategy) {
            case "low_budget":
              score = r.craftCost / xp;
              break;
            case "profit":
              score = -(r.profit / xp);
              break;
            case "high_turnover":
              const turnoverWeight =
                r.turnoverRating === "alta" ? 0.3 : r.turnoverRating === "media" ? 0.7 : 2.0;
              score = (r.craftCost / xp) * turnoverWeight;
              break;
            case "fastest":
              score = -xp;
              break;
            case "consumables_only":
              score = r.craftCost / xp;
              break;
            case "crush_runes":
              const netRunesBenefit = r.runesEstimate - r.craftCost;
              score = netRunesBenefit >= 0 ? -netRunesBenefit * 100 : r.craftCost / xp;
              break;
          }

          return {
            ...r,
            xpRatio,
            xpPerCraft: xp,
            score,
            capacity,
          };
        })
        .filter((s): s is NonNullable<typeof s> => s !== null);

      if (scored.length === 0) break;

      let candidates = scored.filter((s) => s.capacity > 0);
      if (candidates.length === 0) {
        candidates = scored;
      }

      candidates.sort((a, b) => {
        if (Math.abs(a.score - b.score) > 1e-9) {
          return a.score - b.score;
        }
        if (strategy === "low_budget") {
          if (b.profit !== a.profit) return b.profit - a.profit;
          return a.craftCost - b.craftCost;
        }
        if (strategy === "profit") {
          if (b.profit !== a.profit) return b.profit - a.profit;
          return b.xpPerCraft - a.xpPerCraft;
        }
        if (strategy === "fastest") {
          return a.craftCost - b.craftCost;
        }
        return a.craftCost - b.craftCost;
      });

      const nextLvlXp = levelToXp(currentJobLevel + 1);
      const xpToNextLevel = Math.min(tierTargetXp, nextLvlXp) - runningXp;

      const bestCand = candidates[0];
      const craftsNeededBest = Math.max(1, Math.ceil(xpToNextLevel / bestCand.xpPerCraft));

      const executeBatch = (cand: typeof bestCand, count: number) => {
        const sim = simulateCraftBatch(
          runningXp,
          cand.level,
          count,
          xpMultiplier,
          isBoostedServer,
          cand.xpRatio
        );
        runningXp = sim.finalXp;
        cumulativeUsage.set(cand.item.id, (cumulativeUsage.get(cand.item.id) || 0) + count);

        const lastSeq = tierSequence.length > 0 ? tierSequence[tierSequence.length - 1] : null;
        if (lastSeq && lastSeq.item.id === cand.item.id) {
          lastSeq.amount += count;
        } else {
          tierSequence.push({
            recipe: cand.recipe,
            item: cand.item,
            amount: count,
          });
        }
      };

      if (bestCand.capacity >= craftsNeededBest || candidates.length === 1) {
        const batchLimit = bestCand.capacity > 0 ? bestCand.capacity : craftsNeededBest;
        const batchSize = Math.max(1, Math.min(craftsNeededBest, batchLimit));
        executeBatch(bestCand, batchSize);
      } else {
        const top = candidates.slice(0, 4);
        let bestCombo: Array<{ cand: typeof top[0]; amount: number }> | null = null;
        let bestMetric = Infinity;

        function search(
          idx: number,
          combo: Array<{ cand: typeof top[0]; amount: number }>,
          accXp: number,
          accCost: number,
          accProfit: number
        ) {
          if (accXp >= xpToNextLevel) {
            const metric = strategy === "profit" ? -accProfit : accCost;
            if (metric < bestMetric) {
              bestMetric = metric;
              bestCombo = combo.map((c) => ({ ...c }));
            }
            return;
          }
          if (idx >= top.length) return;

          const cand = top[idx];
          const maxNeeded = Math.ceil((xpToNextLevel - accXp) / cand.xpPerCraft);
          const maxUse = Math.min(cand.capacity > 0 ? cand.capacity : maxNeeded, maxNeeded);

          for (let count = maxUse; count >= 0; count--) {
            if (count > 0) {
              combo.push({ cand, amount: count });
              search(
                idx + 1,
                combo,
                accXp + count * cand.xpPerCraft,
                accCost + count * cand.craftCost,
                accProfit + count * cand.profit
              );
              combo.pop();
            } else {
              search(idx + 1, combo, accXp, accCost, accProfit);
            }
          }
        }

        search(0, [], 0, 0, 0);

        if (bestCombo && (bestCombo as any[]).length > 0) {
          for (const step of bestCombo as any[]) {
            executeBatch(step.cand, step.amount);
          }
        } else {
          const batchLimit = bestCand.capacity > 0 ? bestCand.capacity : craftsNeededBest;
          const batchSize = Math.max(1, Math.min(craftsNeededBest, batchLimit));
          executeBatch(bestCand, batchSize);
        }
      }
    }

    const { updatedEntries } = recalculateSelectedCraftsSequence(
      tierStartXp,
      tierSequence,
      xpMultiplier,
      isBoostedServer
    );

    const phaseCrafts = updatedEntries.map((c) => ({
      ...c,
      phaseIndex: tier.tierIndex,
    }));

    let phaseInvestment = 0;
    let phaseNetRevenue = 0;
    let phaseSebuscalines = 0;
    let phaseSebuscalinesValue = 0;
    let phaseXpGained = 0;

    for (const c of phaseCrafts) {
      phaseInvestment += c.totalCraftCost;
      phaseNetRevenue += (c.totalRevenue ?? (c.totalNetSale + (c.totalSebuscalinesValue || 0)));
      phaseSebuscalines += (c.totalSebuscalines || 0);
      phaseSebuscalinesValue += (c.totalSebuscalinesValue || 0);
      phaseXpGained += c.xpGained;
    }

    phases.push({
      phaseIndex: tier.tierIndex,
      fromLevel: tierStartLvl,
      toLevel: tierTargetLvl,
      startXp: tierStartXp,
      targetXp: tierTargetXp,
      requiredXp,
      xpGained: phaseXpGained,
      crafts: phaseCrafts,
      totalInvestment: phaseInvestment,
      totalNetRevenue: phaseNetRevenue,
      totalSebuscalines: phaseSebuscalines,
      totalSebuscalinesValue: phaseSebuscalinesValue,
      netProfitOrLoss: phaseNetRevenue - phaseInvestment,
    });
  }

  return phases;
}

/**
 * Genera automáticamente la lista óptima de SelectedCrafts para alcanzar el nivel objetivo
 * según la estrategia de juego elegida, derivada de las fases optimizadas.
 */
export function generateAutoOptimizedCrafts(
  options: AutoOptimizeOptions
): SelectedCraftEntry[] {
  const phases = generateOptimizedPhases(options);
  return phases.flatMap((p) => p.crafts);
}

/**
 * Apila la siguiente fase decadal a un plan existente (ej: si está en 50, añade 50 -> 60).
 */
export function appendNextPhaseToPlan(
  currentPhases: JobPlanPhase[],
  options: Omit<AutoOptimizeOptions, "startingLevel" | "targetLevel">
): { updatedPhases: JobPlanPhase[]; nextTargetLevel: number } {
  const lastPhase = currentPhases[currentPhases.length - 1];
  const lastLevel = lastPhase ? lastPhase.toLevel : 1;
  if (lastLevel >= 200) {
    return { updatedPhases: currentPhases, nextTargetLevel: 200 };
  }

  const nextMilestone = getNextMilestoneLevel(lastLevel);
  const newPhases = generateOptimizedPhases({
    ...options,
    startingLevel: lastLevel,
    targetLevel: nextMilestone,
  });

  const offset = currentPhases.length;
  const reindexed = newPhases.map((p, idx) => ({
    ...p,
    phaseIndex: offset + idx + 1,
    crafts: p.crafts.map((c) => ({ ...c, phaseIndex: offset + idx + 1 })),
  }));

  return {
    updatedPhases: [...currentPhases, ...reindexed],
    nextTargetLevel: nextMilestone,
  };
}

// ----------------------------------------------------
// Persistencia en LocalStorage
// ----------------------------------------------------

const STORAGE_KEY_JOB_PLAN_V2 = "dofus_job_leveling_plan_v2";

export function getStoredJobPlanV2(): JobPlanState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_JOB_PLAN_V2);
    if (!raw) return null;
    return JSON.parse(raw) as JobPlanState;
  } catch (err) {
    console.warn("[jobLevelingService] Error cargando plan guardado v2:", err);
    return null;
  }
}

export function saveStoredJobPlanV2(plan: JobPlanState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_JOB_PLAN_V2, JSON.stringify(plan));
    window.dispatchEvent(new CustomEvent("dofus_job_plan_v2_updated", { detail: plan }));
  } catch (err) {
    console.warn("[jobLevelingService] Error guardando plan v2:", err);
  }
}

export function clearStoredJobPlanV2(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY_JOB_PLAN_V2);
    window.dispatchEvent(new CustomEvent("dofus_job_plan_v2_cleared"));
  } catch (err) {
    console.warn("[jobLevelingService] Error limpiando plan v2:", err);
  }
}
