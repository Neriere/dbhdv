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
import { isBycResource, getOptimizedIngredientCost } from "./bycCostService";
import { USER_JOBS_DEFINITIONS, JobConfigDefinition } from "./userJobsService";
import { DofusRecipe, DofusItem } from "../types";

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
  profitUnit: number; // positivo = ganancia, negativo = pérdida
  totalProfit: number;
  avgDailySales: number;
  turnoverRating: "alta" | "media" | "baja" | null;
  daysToSell: number | null;
  requiresByc: boolean;
  requiresPebbles: boolean;
}

export interface ConsolidatedMaterial {
  itemId: number;
  name: string;
  iconId: number;
  quantity: number;
  unitPrice: number;
  totalCost: number;
  isByc: boolean;
}

export interface JobPlanState {
  jobId: number;
  jobNameEs: string;
  startingLevel: number;
  startingXp: number;
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
  selectedCrafts: SelectedCraftEntry[];
  materialsNeeded: ConsolidatedMaterial[];
  summary: {
    totalCrafts: number;
    totalInvestment: number;
    totalNetRevenue: number;
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
): { cost: number; requiresByc: boolean; requiresPebbles: boolean } {
  if (!recipe || !recipe.ingredientIds || recipe.ingredientIds.length === 0) {
    return { cost: 0, requiresByc: false, requiresPebbles: false };
  }

  let totalCost = 0;
  let requiresByc = false;
  let requiresPebbles = false;

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
  }

  return { cost: totalCost, requiresByc, requiresPebbles };
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
  isBoostedServer = false
): { totalXpEarned: number; finalXp: number; finalLevel: number } {
  let runningXp = startingXp;
  let totalXpEarned = 0;

  for (let i = 0; i < amount; i++) {
    const currentLevel = xpToLevel(runningXp);
    const xp = getCraftXpByJobLevel(recipeLevel, currentLevel, xpMultiplier, 1.0, isBoostedServer);
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
  maxIterations = 50000
): { amountNeeded: number; totalXpEarned: number; finalXp: number; finalLevel: number } {
  let runningXp = startingXp;
  let totalXpEarned = 0;
  let amount = 0;

  while (xpToLevel(runningXp) < targetLevel && amount < maxIterations) {
    const currentLevel = xpToLevel(runningXp);
    const xp = getCraftXpByJobLevel(recipeLevel, currentLevel, xpMultiplier, 1.0, isBoostedServer);
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
  isBoostedServer = false
): { updatedEntries: SelectedCraftEntry[]; finalXp: number; finalLevel: number } {
  const pricesMap = getStoredMarketPrices();
  const salesMap = getStoredSalesVolumeMap();

  let runningXp = baseStartingXp;
  const updatedEntries: SelectedCraftEntry[] = [];

  for (const c of crafts) {
    if (c.amount <= 0) continue;

    const startXpForThisItem = runningXp;
    const sim = simulateCraftBatch(
      startXpForThisItem,
      c.item.level || 1,
      c.amount,
      xpMultiplier,
      isBoostedServer
    );

    runningXp = sim.finalXp;

    const costInfo = calculateOptimizedCraftCost(c.recipe, pricesMap);
    const craftCostUnit = costInfo.cost;
    const marketPriceUnit = pricesMap[c.item.id] || getStoredItemPrice(c.item.id) || 0;
    const netSaleUnit = Math.floor(marketPriceUnit * 0.98);
    const profitUnit = netSaleUnit - craftCostUnit;

    const volumeData = salesMap[c.item.id] as ItemSalesVolume | undefined;
    const salesAnalysis = analyzeSalesVolume(marketPriceUnit, volumeData);

    updatedEntries.push({
      recipe: c.recipe,
      item: c.item,
      amount: c.amount,
      xpGained: sim.totalXpEarned,
      craftCostUnit,
      totalCraftCost: craftCostUnit * c.amount,
      marketPriceUnit,
      netSaleUnit,
      totalNetSale: netSaleUnit * c.amount,
      profitUnit,
      totalProfit: profitUnit * c.amount,
      avgDailySales: salesAnalysis.avgDailySales || 0,
      turnoverRating: salesAnalysis.turnoverRating,
      daysToSell: salesAnalysis.daysToSell,
      requiresByc: costInfo.requiresByc,
      requiresPebbles: costInfo.requiresPebbles,
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
    { quantity: number; unitPrice: number; name: string; iconId: number; isByc: boolean }
  >();
  const pricesMap = getStoredMarketPrices();

  for (const c of crafts) {
    const recipe = c.recipe;
    if (!recipe || !recipe.ingredientIds) continue;

    for (let i = 0; i < recipe.ingredientIds.length; i++) {
      const ingId = recipe.ingredientIds[i];
      const qty = (recipe.quantities?.[i] || 1) * c.amount;
      const current = ingMap.get(ingId);

      if (current) {
        current.quantity += qty;
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

        ingMap.set(ingId, {
          quantity: qty,
          unitPrice: costInfo.cost,
          name,
          iconId,
          isByc: costInfo.isByc,
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
  let maxDaysToSell = 0;

  for (const c of crafts) {
    totalCrafts += c.amount;
    totalInvestment += c.totalCraftCost;
    totalNetRevenue += c.totalNetSale;
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
 * Genera automáticamente la lista óptima de SelectedCrafts para alcanzar el nivel objetivo
 * según la estrategia de juego elegida.
 */
export function generateAutoOptimizedCrafts(
  options: AutoOptimizeOptions
): SelectedCraftEntry[] {
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
  const baseStartingXp = levelToXp(cleanStart);
  const targetXp = levelToXp(cleanTarget);

  // Filtrar recetas válidas para este oficio
  const jobRecipes = snapshot
    .filter((item) => {
      if (item.jobId !== jobId) return false;
      if (!item.recipeData || !item.recipeData.ingredientIds?.length) return false;

      // Filtro de consumibles/componentes si la estrategia lo requiere
      if (strategy === "consumables_only") {
        // En Dofus: equipables tienen typeId de armas/armaduras (sombreros, capas, etc.)
        // Si el objeto tiene efectos de equipo o superCategory de equipo, se omite
        const isEquip =
          item.type?.superCategoryId === 1 || // Equipamiento
          item.type?.superCategoryId === 2;   // Armas
        if (isEquip) return false;
      }

      return true;
    })
    .map((item) => {
      const recipe = item.recipeData!;
      const costInfo = calculateOptimizedCraftCost(recipe, pricesMap);
      const marketPrice = pricesMap[item.id] || getStoredItemPrice(item.id) || 0;
      const netSale = Math.floor(marketPrice * 0.98);
      const profit = netSale - costInfo.cost;
      const netCost = costInfo.cost - netSale;

      const volumeData = salesMap[item.id] as ItemSalesVolume | undefined;
      const salesAnalysis = analyzeSalesVolume(marketPrice, volumeData);
      const avgDailySales = salesAnalysis.avgDailySales || 0;

      // Límite de absorción
      let maxAllowed: number;
      if (avgDailySales > 0) {
        maxAllowed = Math.max(1, Math.round(avgDailySales * maxDailyAbsorptionRatio));
      } else {
        maxAllowed = 2; // Objeto sin ventas: permitir prueba pequeña
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

  let runningXp = baseStartingXp;
  const craftUsageMap = new Map<number, number>();
  const craftSequence: Array<{ recipe: DofusRecipe; item: CraftableItem; amount: number }> = [];

  let iteration = 0;
  const maxIterations = 5000;

  while (xpToLevel(runningXp) < cleanTarget && runningXp < targetXp && iteration < maxIterations) {
    iteration++;
    const currentJobLevel = xpToLevel(runningXp);

    // Filtrar recetas disponibles para el nivel actual
    const available = jobRecipes.filter(
      (r) => r.level <= currentJobLevel && currentJobLevel <= r.level + 100
    );
    if (available.length === 0) break;

    // Calcular XP dinámico y score según estrategia
    const scored = available
      .map((r) => {
        const xp = getCraftXpByJobLevel(r.level, currentJobLevel, xpMultiplier, 1.0, isBoostedServer);
        if (xp <= 0) return null;

        const used = craftUsageMap.get(r.item.id) || 0;
        const capacity = Math.max(0, r.maxAllowed - used);

        let score = 0;
        switch (strategy) {
          case "low_budget":
            // 💸 Minimizar gasto bruto de ingredientes por XP
            score = r.craftCost / xp;
            break;
          case "profit":
            // 💰 Maximizar beneficio neto por XP (menor netCost/xp o más negativo)
            score = r.netCost / xp;
            break;
          case "high_turnover":
            // 🌊 Priorizar rotación alta
            score = r.netCost / xp - r.avgDailySales * 100;
            break;
          case "fastest":
            // ⚡ Maximizar XP por crafteo (menos clics)
            score = -xp;
            break;
          case "consumables_only":
            score = r.craftCost / xp;
            break;
          case "crush_runes":
            // ♻️ Maximizar valor de runas frente a coste
            const runeProfit = r.runesEstimate - r.craftCost;
            score = -runeProfit / xp;
            break;
        }

        return {
          ...r,
          xpPerCraft: xp,
          score,
          capacity,
        };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);

    if (scored.length === 0) break;

    // Priorizar recetas con capacidad de rotación disponible
    let candidates = scored.filter((s) => s.capacity > 0);
    if (candidates.length === 0) {
      // Si todas alcanzaron el cupo, flexibilizar para no trancar
      candidates = scored;
    }

    // Ordenar por score ascendente (menor coste o mejor métrica)
    candidates.sort((a, b) => a.score - b.score);

    const chosen = candidates[0];
    const xpRemaining = targetXp - runningXp;
    const craftsForLevel = Math.max(1, Math.ceil(xpRemaining / chosen.xpPerCraft));
    const batchSize = Math.max(
      1,
      Math.min(craftsForLevel, chosen.capacity || craftsForLevel, 10)
    );

    // Simular el lote craft a craft
    const sim = simulateCraftBatch(
      runningXp,
      chosen.level,
      batchSize,
      xpMultiplier,
      isBoostedServer
    );

    runningXp = sim.finalXp;
    craftUsageMap.set(chosen.item.id, (craftUsageMap.get(chosen.item.id) || 0) + batchSize);

    const existingSeq = craftSequence.find((s) => s.item.id === chosen.item.id);
    if (existingSeq) {
      existingSeq.amount += batchSize;
    } else {
      craftSequence.push({
        recipe: chosen.recipe,
        item: chosen.item,
        amount: batchSize,
      });
    }
  }

  // Recalcular secuencia completa con trazabilidad de XP
  const { updatedEntries } = recalculateSelectedCraftsSequence(
    baseStartingXp,
    craftSequence,
    xpMultiplier,
    isBoostedServer
  );

  return updatedEntries;
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
