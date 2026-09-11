/**
 * Servicio de optimización y cálculo de subida de oficios (1-200) para Dofus.
 * Soporta los 14 oficios (6 de recolección y 8 de crafteo, incluido Ganadero).
 * 100% Client-Side: ejecuta en memoria con recetas, precios y volúmenes de venta locales.
 */

import {
  CraftableItem,
  getCraftableItemsSnapshot,
  getStoredMarketPrices,
  calculateItemCraftCost,
  getStoredItemPrice,
  getItemById,
} from "./dofusDbService";
import {
  getStoredSalesVolumeMap,
  analyzeSalesVolume,
  ItemSalesVolume,
} from "./salesVolumeService";
import { USER_JOBS_DEFINITIONS, JobConfigDefinition } from "./userJobsService";
import { DofusRecipe } from "../types";

// ----------------------------------------------------
// Tipos y Modelos de Datos
// ----------------------------------------------------

export type JobOptimizerMode =
  | "cheapest"       // Menor coste neto en Kamas por XP (con control de rotación)
  | "high_turnover"  // Venta rápida / alta rotación garantizada (mínimo riesgo)
  | "fastest"        // Menos crafteos / más rápido (máxima XP por craft)
  | "manual";        // Explorador y planificador manual

export interface LevelTier {
  tierIndex: number;
  fromLevel: number;
  toLevel: number;
  requiredXp: number;
}

export interface CraftPlanItem {
  itemId: number;
  name: string;
  level: number;
  iconId: number;
  recipe?: DofusRecipe;
  amount: number;
  craftLevel: number; // Nivel del oficio al momento de iniciar este craft
  xpPerCraft: number;
  totalXpGained: number;
  craftCostUnit: number;
  totalCraftCost: number;
  marketPriceUnit: number;
  netSaleUnit: number;
  totalNetSale: number;
  profitUnit: number; // positivo = ganancia, negativo = pérdida
  totalProfit: number;
  kamasPerXp: number; // coste neto / xp
  avgDailySales: number;
  turnoverRating: "alta" | "media" | "baja" | null;
  daysToSell: number | null;
}

export interface TierPlanResult {
  tier: LevelTier;
  items: CraftPlanItem[];
  xpGained: number;
  isComplete: boolean;
  totalCost: number;
  totalNetRevenue: number;
  netProfitOrLoss: number;
  totalCrafts: number;
  kamasPerXp: number;
}

export interface ConsolidatedIngredient {
  itemId: number;
  name: string;
  iconId: number;
  quantity: number;
  unitPrice: number;
  totalCost: number;
  inBankQuantity?: number;
}

export interface JobLevelingSummary {
  totalCrafts: number;
  totalInvestment: number;
  totalNetRevenue: number;
  netProfitOrLoss: number;
  globalKamasPerXp: number;
  estimatedDaysToSell: number;
}

export interface JobLevelingPlan {
  jobId: number;
  jobNameEs: string;
  startingLevel: number;
  startingXp: number;
  targetLevel: number;
  targetXp: number;
  totalXpRequired: number;
  totalXpGained: number;
  xpMultiplier: number;
  isBoostedServer: boolean;
  mode: JobOptimizerMode;
  maxDailyAbsorptionRatio: number; // Ej: 1.0 a 4.0 días de venta diaria
  skipItemsWithNoSales: boolean;
  tiers: TierPlanResult[];
  consolidatedIngredients: ConsolidatedIngredient[];
  summary: JobLevelingSummary;
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
  (j) => SUPPORTED_JOB_IDS.includes(j.id),
);

// ----------------------------------------------------
// Motor Matemático de XP Oficial de Dofus
// ----------------------------------------------------

/**
 * Retorna la experiencia total acumulada requerida para alcanzar el nivel dado.
 * Fórmula oficial: Nivel * (Nivel - 1) * 10
 */
export function levelToXp(level: number): number {
  const lvl = Math.max(1, Math.min(200, Math.floor(level)));
  return lvl * (lvl - 1) * 10;
}

/**
 * Retorna el nivel de oficio correspondiente a una cantidad de XP acumulada.
 * Fórmula inversa exacta de la curva cuadrática de Dofus.
 */
export function xpToLevel(xp: number): number {
  if (xp <= 0) return 1;
  const computed = Math.floor((Math.sqrt(1 + 0.4 * xp) + 1) / 2);
  return Math.max(1, Math.min(200, computed));
}

/**
 * Calcula la experiencia que otorga una receta para un nivel de oficio específico.
 * Incluye el decaimiento dinámico oficial y corte en 0 si oficio - 100 > receta.
 */
export function getCraftXpByJobLevel(
  recipeLevel: number,
  jobLevel: number,
  xpMultiplier = 1.0,
  craftXpRatio = 1.0,
  isBoostedServer = false,
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
// Lógica de Segmentación y Stacking de Tramos
// ----------------------------------------------------

/**
 * Obtiene el siguiente hito natural de nivel (próximo múltiplo de 10).
 * Ej: 43 -> 50, 50 -> 60, 195 -> 200.
 */
export function getNextMilestoneLevel(currentLevel: number): number {
  const lvl = Math.max(1, Math.min(200, Math.floor(currentLevel)));
  if (lvl >= 200) return 200;
  const nextMultiple = Math.ceil((lvl + 1) / 10) * 10;
  return Math.min(200, Math.max(lvl + 1, nextMultiple));
}

/**
 * Divide el rango [fromLevel, toLevel] en tramos decadales naturales.
 * Ej: 43 a 70 -> [ {43->50}, {50->60}, {60->70} ]
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

// ----------------------------------------------------
// Algoritmo de Optimización Económica por Tramo
// ----------------------------------------------------

interface RecipeEvaluation {
  item: CraftableItem;
  recipe: DofusRecipe;
  craftCostUnit: number;
  marketPriceUnit: number;
  netSaleUnit: number;
  profitUnit: number;
  netCostUnit: number;
  avgDailySales: number;
  turnoverRating: "alta" | "media" | "baja" | null;
  daysToSell: number | null;
  maxCraftsAllowed: number;
}

/**
 * Evalúa todas las recetas de un oficio disponibles para el nivel del tramo.
 */
function evaluateJobRecipes(
  jobId: number,
  currentLevel: number,
  maxDailyAbsorptionRatio: number,
  skipItemsWithNoSales: boolean,
): RecipeEvaluation[] {
  const snapshot = getCraftableItemsSnapshot();
  const salesMap = getStoredSalesVolumeMap();
  const pricesMap = getStoredMarketPrices();

  const candidates: RecipeEvaluation[] = [];

  for (const item of snapshot) {
    if (item.jobId !== jobId) continue;
    const recipe = item.recipeData;
    if (!recipe || !recipe.ingredientIds || recipe.ingredientIds.length === 0) continue;

    const itemLevel = item.level || 1;
    // Solo recetas desbloqueadas en el nivel actual y que aún den XP (nivel <= currentLevel <= nivel + 100)
    if (itemLevel > currentLevel) continue;
    if (currentLevel - 100 > itemLevel) continue;

    const craftCostUnit = calculateItemCraftCost(item.id);
    const marketPriceUnit = pricesMap[item.id] || getStoredItemPrice(item.id) || 0;
    const netSaleUnit = Math.floor(marketPriceUnit * 0.98); // Descuento de tasa HDV 2%
    const profitUnit = netSaleUnit - craftCostUnit;
    const netCostUnit = craftCostUnit - netSaleUnit; // -profitUnit

    const volumeData = salesMap[item.id] as ItemSalesVolume | undefined;
    const salesAnalysis = analyzeSalesVolume(marketPriceUnit, volumeData);
    const avgDailySales = salesAnalysis.avgDailySales || 0;

    // Control de liquidez: máximo batch basado en ventas diarias
    let maxCraftsAllowed: number;
    if (avgDailySales > 0) {
      // Hasta 1x a 4x ventas diarias según configuración
      maxCraftsAllowed = Math.max(1, Math.round(avgDailySales * maxDailyAbsorptionRatio));
    } else {
      if (skipItemsWithNoSales) {
        maxCraftsAllowed = 0;
      } else {
        // Objeto sin ventas registradas: permitir un lote pequeño de prueba (máx 3 crafteos)
        maxCraftsAllowed = 3;
      }
    }

    candidates.push({
      item,
      recipe,
      craftCostUnit,
      marketPriceUnit,
      netSaleUnit,
      profitUnit,
      netCostUnit,
      avgDailySales,
      turnoverRating: salesAnalysis.turnoverRating,
      daysToSell: salesAnalysis.daysToSell,
      maxCraftsAllowed,
    });
  }

  return candidates;
}

/**
 * Resuelve la ruta de crafteo óptima para un tramo de nivel específico.
 */
export function generateTierPlan(
  jobId: number,
  tier: LevelTier,
  options: {
    mode: JobOptimizerMode;
    xpMultiplier?: number;
    isBoostedServer?: boolean;
    maxDailyAbsorptionRatio?: number;
    skipItemsWithNoSales?: boolean;
    existingCraftTotals?: Record<number, number>; // Para no sobrecraftear entre tramos contiguos
  },
): TierPlanResult {
  const {
    mode = "cheapest",
    xpMultiplier = 1.0,
    isBoostedServer = false,
    maxDailyAbsorptionRatio = 3.0,
    skipItemsWithNoSales = false,
    existingCraftTotals = {},
  } = options;

  let currentLevel = tier.fromLevel;
  let accumulatedXpInTier = 0;
  const targetXpInTier = tier.requiredXp;

  const craftItemsMap = new Map<number, CraftPlanItem>();
  const craftUsageCount: Record<number, number> = { ...existingCraftTotals };

  // Límite de seguridad para evitar bucles infinitos
  let iteration = 0;
  const maxIterations = 1000;

  while (accumulatedXpInTier < targetXpInTier && iteration < maxIterations) {
    iteration++;

    // Evaluar recetas disponibles en el nivel actual
    const evaluations = evaluateJobRecipes(
      jobId,
      currentLevel,
      maxDailyAbsorptionRatio,
      skipItemsWithNoSales,
    );

    if (evaluations.length === 0) {
      break;
    }

    // Calcular XP y métrica de eficiencia para cada receta según el nivel actual
    const scoredCandidates = evaluations
      .map((ev) => {
        const xpPerCraft = getCraftXpByJobLevel(
          ev.item.level || 1,
          currentLevel,
          xpMultiplier,
          1.0,
          isBoostedServer,
        );
        if (xpPerCraft <= 0) return null;

        // kamasPerXp: mientras menor (o más negativo), mejor
        const kamasPerXp = ev.netCostUnit / xpPerCraft;
        const usedCount = craftUsageCount[ev.item.id] || 0;
        const remainingCapacity = Math.max(0, ev.maxCraftsAllowed - usedCount);

        return {
          ...ev,
          xpPerCraft,
          kamasPerXp,
          remainingCapacity,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);

    if (scoredCandidates.length === 0) {
      break;
    }

    // Filtrar candidatos disponibles que aún no hayan alcanzado su tope de absorción
    let viableCandidates = scoredCandidates.filter((c) => c.remainingCapacity > 0);

    // Si todos los candidatos alcanzaron el límite de rotación pero aún falta XP en el tramo:
    // flexibilizamos moderadamente permitiendo crafteos adicionales para no dejar trancado al usuario
    if (viableCandidates.length === 0) {
      viableCandidates = scoredCandidates;
    }

    // Filtrar según modo
    if (mode === "high_turnover") {
      const filteredHigh = viableCandidates.filter(
        (c) => c.avgDailySales >= 1.5 || c.turnoverRating === "alta",
      );
      if (filteredHigh.length > 0) {
        viableCandidates = filteredHigh;
      }
    }

    // Ordenar candidatos
    if (mode === "fastest") {
      // Priorizar mayor XP por craft (para menos crafteos)
      viableCandidates.sort((a, b) => b.xpPerCraft - a.xpPerCraft);
    } else {
      // "cheapest" o "high_turnover": menor kamas por XP (o mayor ganancia)
      viableCandidates.sort((a, b) => {
        if (Math.abs(a.kamasPerXp - b.kamasPerXp) > 0.001) {
          return a.kamasPerXp - b.kamasPerXp;
        }
        // Desempate: mayor rotación de mercado
        return b.avgDailySales - a.avgDailySales;
      });
    }

    const chosen = viableCandidates[0];
    const xpNeeded = targetXpInTier - accumulatedXpInTier;

    // Calcular cuántos craftear en este batch
    const craftsNeededForTier = Math.max(1, Math.ceil(xpNeeded / chosen.xpPerCraft));
    const batchSize = Math.max(
      1,
      Math.min(craftsNeededForTier, chosen.remainingCapacity || craftsNeededForTier),
    );

    const xpGainedInBatch = batchSize * chosen.xpPerCraft;
    accumulatedXpInTier += xpGainedInBatch;

    // Actualizar nivel actual del oficio
    const currentAbsoluteXp = levelToXp(tier.fromLevel) + accumulatedXpInTier;
    currentLevel = xpToLevel(currentAbsoluteXp);

    craftUsageCount[chosen.item.id] = (craftUsageCount[chosen.item.id] || 0) + batchSize;

    // Agregar o actualizar en el mapa del plan del tramo
    const existingPlanItem = craftItemsMap.get(chosen.item.id);
    if (existingPlanItem) {
      existingPlanItem.amount += batchSize;
      existingPlanItem.totalXpGained += xpGainedInBatch;
      existingPlanItem.totalCraftCost += batchSize * chosen.craftCostUnit;
      existingPlanItem.totalNetSale += batchSize * chosen.netSaleUnit;
      existingPlanItem.totalProfit += batchSize * chosen.profitUnit;
    } else {
      craftItemsMap.set(chosen.item.id, {
        itemId: chosen.item.id,
        name: typeof chosen.item.name === "object" ? chosen.item.name.es : String(chosen.item.name),
        level: chosen.item.level || 1,
        iconId: chosen.item.iconId || chosen.item.id,
        recipe: chosen.recipe,
        amount: batchSize,
        craftLevel: tier.fromLevel,
        xpPerCraft: chosen.xpPerCraft,
        totalXpGained: xpGainedInBatch,
        craftCostUnit: chosen.craftCostUnit,
        totalCraftCost: batchSize * chosen.craftCostUnit,
        marketPriceUnit: chosen.marketPriceUnit,
        netSaleUnit: chosen.netSaleUnit,
        totalNetSale: batchSize * chosen.netSaleUnit,
        profitUnit: chosen.profitUnit,
        totalProfit: batchSize * chosen.profitUnit,
        kamasPerXp: chosen.kamasPerXp,
        avgDailySales: chosen.avgDailySales,
        turnoverRating: chosen.turnoverRating,
        daysToSell: chosen.daysToSell,
      });
    }
  }

  const items = Array.from(craftItemsMap.values());
  const totalCost = items.reduce((sum, i) => sum + i.totalCraftCost, 0);
  const totalNetRevenue = items.reduce((sum, i) => sum + i.totalNetSale, 0);
  const netProfitOrLoss = totalNetRevenue - totalCost;
  const totalCrafts = items.reduce((sum, i) => sum + i.amount, 0);
  const globalKamasPerXp = accumulatedXpInTier > 0 ? (totalCost - totalNetRevenue) / accumulatedXpInTier : 0;

  return {
    tier,
    items,
    xpGained: accumulatedXpInTier,
    isComplete: accumulatedXpInTier >= targetXpInTier,
    totalCost,
    totalNetRevenue,
    netProfitOrLoss,
    totalCrafts,
    kamasPerXp: globalKamasPerXp,
  };
}

// ----------------------------------------------------
// Generación Completa del Plan y Apilamiento (Stacking)
// ----------------------------------------------------

/**
 * Consolida todos los ingredientes requeridos sumando las recetas de todos los tramos.
 */
export function consolidateIngredients(tiers: TierPlanResult[]): ConsolidatedIngredient[] {
  const ingMap = new Map<number, { quantity: number; unitPrice: number; name: string; iconId: number }>();
  const pricesMap = getStoredMarketPrices();

  for (const t of tiers) {
    for (const planItem of t.items) {
      const recipe = planItem.recipe;
      if (!recipe || !recipe.ingredientIds) continue;

      for (let i = 0; i < recipe.ingredientIds.length; i++) {
        const ingId = recipe.ingredientIds[i];
        const ingQty = (recipe.quantities?.[i] || 1) * planItem.amount;
        const current = ingMap.get(ingId);

        if (current) {
          current.quantity += ingQty;
        } else {
          const item = getItemById(ingId);
          const name = typeof item?.name === "object" ? item.name.es : item?.name ? String(item.name) : `Objeto #${ingId}`;
          const iconId = item?.iconId || ingId;
          const unitPrice = pricesMap[ingId] || getStoredItemPrice(ingId) || 0;
          ingMap.set(ingId, {
            quantity: ingQty,
            unitPrice,
            name,
            iconId,
          });
        }
      }
    }
  }

  const result: ConsolidatedIngredient[] = [];
  for (const [itemId, data] of ingMap.entries()) {
    result.push({
      itemId,
      name: data.name,
      iconId: data.iconId,
      quantity: data.quantity,
      unitPrice: data.unitPrice,
      totalCost: data.quantity * data.unitPrice,
    });
  }

  result.sort((a, b) => b.totalCost - a.totalCost);
  return result;
}

/**
 * Calcula el resumen global del plan.
 */
export function calculatePlanSummary(tiers: TierPlanResult[]): JobLevelingSummary {
  let totalCrafts = 0;
  let totalInvestment = 0;
  let totalNetRevenue = 0;
  let totalXpGained = 0;
  let maxDaysToSell = 0;

  for (const t of tiers) {
    totalCrafts += t.totalCrafts;
    totalInvestment += t.totalCost;
    totalNetRevenue += t.totalNetRevenue;
    totalXpGained += t.xpGained;

    for (const item of t.items) {
      if (item.daysToSell && item.daysToSell > maxDaysToSell) {
        maxDaysToSell = item.daysToSell;
      }
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

/**
 * Genera el plan completo de subida de nivel para un oficio dividiendo en tramos apilados.
 */
export function generateOptimizedJobPlan(options: {
  jobId: number;
  startingLevel: number;
  targetLevel: number;
  xpMultiplier?: number;
  isBoostedServer?: boolean;
  mode?: JobOptimizerMode;
  maxDailyAbsorptionRatio?: number;
  skipItemsWithNoSales?: boolean;
}): JobLevelingPlan {
  const {
    jobId,
    startingLevel,
    targetLevel,
    xpMultiplier = 1.0,
    isBoostedServer = false,
    mode = "cheapest",
    maxDailyAbsorptionRatio = 3.0,
    skipItemsWithNoSales = false,
  } = options;

  const jobDef = SUPPORTED_JOBS.find((j) => j.id === jobId);
  const jobNameEs = jobDef?.nameEs || "Oficio";

  const cleanStart = Math.max(1, Math.min(200, Math.floor(startingLevel)));
  const cleanTarget = Math.max(cleanStart, Math.min(200, Math.floor(targetLevel)));

  const startingXp = levelToXp(cleanStart);
  const targetXp = levelToXp(cleanTarget);
  const totalXpRequired = targetXp - startingXp;

  const levelTiers = calculateLevelTiers(cleanStart, cleanTarget);
  const tierResults: TierPlanResult[] = [];
  const cumulativeCraftCounts: Record<number, number> = {};

  for (const tier of levelTiers) {
    const tierPlan = generateTierPlan(jobId, tier, {
      mode,
      xpMultiplier,
      isBoostedServer,
      maxDailyAbsorptionRatio,
      skipItemsWithNoSales,
      existingCraftTotals: cumulativeCraftCounts,
    });

    tierResults.push(tierPlan);

    // Acumular crafteos para respetar límites de rotación acumulada
    for (const item of tierPlan.items) {
      cumulativeCraftCounts[item.itemId] = (cumulativeCraftCounts[item.itemId] || 0) + item.amount;
    }
  }

  const consolidatedIngredients = consolidateIngredients(tierResults);
  const summary = calculatePlanSummary(tierResults);
  const totalXpGained = tierResults.reduce((sum, t) => sum + t.xpGained, 0);

  const plan: JobLevelingPlan = {
    jobId,
    jobNameEs,
    startingLevel: cleanStart,
    startingXp,
    targetLevel: cleanTarget,
    targetXp,
    totalXpRequired,
    totalXpGained,
    xpMultiplier,
    isBoostedServer,
    mode,
    maxDailyAbsorptionRatio,
    skipItemsWithNoSales,
    tiers: tierResults,
    consolidatedIngredients,
    summary,
    lastUpdated: Date.now(),
  };

  saveStoredJobPlan(plan);
  return plan;
}

/**
 * Apila el siguiente tramo decadal a un plan existente.
 * Ej: Si el plan actual llega a nivel 50, añade el tramo 50 -> 60.
 */
export function appendNextTierToPlan(currentPlan: JobLevelingPlan): JobLevelingPlan {
  const currentTarget = currentPlan.targetLevel;
  if (currentTarget >= 200) return currentPlan;

  const nextTarget = getNextMilestoneLevel(currentTarget);
  const newTiers = calculateLevelTiers(currentTarget, nextTarget);
  if (newTiers.length === 0) return currentPlan;

  const nextTier = newTiers[0];
  nextTier.tierIndex = currentPlan.tiers.length + 1;

  // Acumular conteos actuales
  const cumulativeCraftCounts: Record<number, number> = {};
  for (const t of currentPlan.tiers) {
    for (const item of t.items) {
      cumulativeCraftCounts[item.itemId] = (cumulativeCraftCounts[item.itemId] || 0) + item.amount;
    }
  }

  const newTierPlan = generateTierPlan(currentPlan.jobId, nextTier, {
    mode: currentPlan.mode,
    xpMultiplier: currentPlan.xpMultiplier,
    isBoostedServer: currentPlan.isBoostedServer,
    maxDailyAbsorptionRatio: currentPlan.maxDailyAbsorptionRatio,
    skipItemsWithNoSales: currentPlan.skipItemsWithNoSales,
    existingCraftTotals: cumulativeCraftCounts,
  });

  const updatedTiers = [...currentPlan.tiers, newTierPlan];
  const updatedTargetXp = levelToXp(nextTarget);
  const updatedIngredients = consolidateIngredients(updatedTiers);
  const updatedSummary = calculatePlanSummary(updatedTiers);
  const totalXpGained = updatedTiers.reduce((sum, t) => sum + t.xpGained, 0);

  const updatedPlan: JobLevelingPlan = {
    ...currentPlan,
    targetLevel: nextTarget,
    targetXp: updatedTargetXp,
    totalXpRequired: updatedTargetXp - currentPlan.startingXp,
    totalXpGained,
    tiers: updatedTiers,
    consolidatedIngredients: updatedIngredients,
    summary: updatedSummary,
    lastUpdated: Date.now(),
  };

  saveStoredJobPlan(updatedPlan);
  return updatedPlan;
}

// ----------------------------------------------------
// Persistencia en LocalStorage
// ----------------------------------------------------

const STORAGE_KEY_JOB_PLAN = "dofus_job_leveling_plan_v1";

export function getStoredJobPlan(): JobLevelingPlan | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_JOB_PLAN);
    if (!raw) return null;
    return JSON.parse(raw) as JobLevelingPlan;
  } catch (err) {
    console.warn("[jobLevelingService] Error cargando plan guardado:", err);
    return null;
  }
}

export function saveStoredJobPlan(plan: JobLevelingPlan): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_JOB_PLAN, JSON.stringify(plan));
    window.dispatchEvent(new CustomEvent("dofus_job_plan_updated", { detail: plan }));
  } catch (err) {
    console.warn("[jobLevelingService] Error guardando plan en localStorage:", err);
  }
}

export function clearStoredJobPlan(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY_JOB_PLAN);
    window.dispatchEvent(new CustomEvent("dofus_job_plan_cleared"));
  } catch (err) {
    console.warn("[jobLevelingService] Error limpiando plan en localStorage:", err);
  }
}
