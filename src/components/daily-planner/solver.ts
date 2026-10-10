import { PresetCraftableItem } from '../../data/presetCraftableItems';
import { DOFUS_JOBS, isCrushableJob } from '../../data/dofusJobs';
import { USER_JOBS_DEFINITIONS } from '../../services/userJobsService';
import { analyzeSalesVolume, SalesVolumeMap } from '../../services/salesVolumeService';
import { ItemSoldStats } from '../../services/salesHistoryService';
import { getItemName } from '../../services/dofusDbService';
import {
  OptimizationMode,
  MarketChannel,
  MarketCategory,
  PlannedCraftItem,
} from './types';
import {
  getItemMarketCategory,
  calculateItemSlots,
  calculateBatchBreakdown,
} from './utils';

export interface CandidateItem {
  item: PresetCraftableItem;
  jobName: string;
  jobId: number;
  userJobLevel: number;
  canCraftItem: boolean;
  category: MarketCategory;
  isStackable: boolean;
  craftCostUnit: number;
  rawSalePrice: number;
  salePriceUnit: number;
  saleTaxUnit: number;
  netProfitUnit: number;
  roiPercent: number;
  avgDailySales: number;
  sales24h?: number;
  sales7d?: number;
  sales30d?: number;
  turnoverRating: 'alta' | 'media' | 'baja' | null;
  turnoverLabel: string | null;
  hasSalesData: boolean;
  score: number;
  canCrush: boolean;
  paybackDays: number | null;
  paybackHours: number | null;
  isOutlierPrice: boolean;
  outlierRatio: number;
  referenceMedian: number | null;
  activeInHdv?: {
    lots: number;
    totalQty: number;
    timeLabel: string;
  };
}

export interface CandidatePoolParams {
  allCraftableItems: PresetCraftableItem[];
  excludedItemIds: Set<number>;
  postedItemIds: Set<number>;
  marketChannel: MarketChannel;
  selectedJobFilter: number | 'all';
  userJobSettings: { jobs: Record<number, number> };
  canCraft: (item: PresetCraftableItem) => boolean;
  onlyMyJobs: boolean;
  marketPrices: Record<number, number>;
  budget: number;
  maxBudgetShare: number;
  salesVolumeMap: SalesVolumeMap;
  requireSalesHistory: boolean;
  recentSalesOnly: boolean;
  minDailySales: number;
  filterOutliers: boolean;
  minRoiFilter: number;
  optimizationMode: OptimizationMode;
  avoidAlreadyListed: boolean;
  activeSummary?: {
    byItemMap?: Record<number, { count: number; totalQty: number; timeLabel: string }>;
  };
  soldStatsMap: Map<number, ItemSoldStats>;
}

export function evaluateCandidatePool(params: CandidatePoolParams): CandidateItem[] {
  const {
    allCraftableItems,
    excludedItemIds,
    postedItemIds,
    marketChannel,
    selectedJobFilter,
    userJobSettings,
    canCraft,
    onlyMyJobs,
    marketPrices,
    budget,
    maxBudgetShare,
    salesVolumeMap,
    requireSalesHistory,
    recentSalesOnly,
    minDailySales,
    filterOutliers,
    minRoiFilter,
    optimizationMode,
    avoidAlreadyListed,
    activeSummary,
    soldStatsMap,
  } = params;

  const candidates: CandidateItem[] = [];

  for (const item of allCraftableItems) {
    if (excludedItemIds.has(item.id)) continue;
    if (postedItemIds.has(item.id)) continue;
    if (!item.recipeData?.ingredientIds || item.recipeData.ingredientIds.length === 0) continue;

    const category = getItemMarketCategory(item);
    if (!category) continue;
    const isStackable = category !== 'equipment';

    // Filtro por Canal de Mercadillo objetivo
    if (marketChannel === 'equipment' && category !== 'equipment') continue;
    if (marketChannel === 'consumables' && category !== 'consumables') continue;
    if (marketChannel === 'resources' && category !== 'resources') continue;

    // Filtro de oficio seleccionado
    if (selectedJobFilter !== 'all' && item.jobId !== selectedJobFilter) continue;

    // Verificar si el usuario puede craftearlo con sus niveles
    const userJobDef = USER_JOBS_DEFINITIONS.find((j) => j.id === item.jobId);
    const userLevel = item.jobId ? (userJobSettings.jobs[item.jobId] ?? 1) : 200;
    const canCraftItem = canCraft(item);

    if (onlyMyJobs && !canCraftItem) continue;

    // Todos los ingredientes deben tener precio registrado
    const allPriced = item.recipeData.ingredientIds.every(
      (ingId) => (marketPrices[ingId] || 0) > 0
    );
    if (!allPriced) continue;

    let craftCostUnit = 0;
    item.recipeData.ingredientIds.forEach((ingId, idx) => {
      const qty = item.recipeData.quantities[idx] || 1;
      const ingPrice = marketPrices[ingId] || 0;
      craftCostUnit += ingPrice * qty;
    });

    if (craftCostUnit <= 0 || craftCostUnit > budget) continue;

    // Si el ítem individual cuesta más de lo que permite el porcentaje máximo de diversificación:
    if (maxBudgetShare < 1.0 && craftCostUnit > (budget * maxBudgetShare)) {
      continue;
    }

    const rawSalePrice = marketPrices[item.id] || 0;
    if (rawSalePrice <= 0) continue;

    // Análisis de volumen de ventas
    const vol = salesVolumeMap[item.id];
    const salesAnalysis = analyzeSalesVolume(rawSalePrice, vol);

    // Si se exige historial de ventas (24h, 7d, 30d o promedio diario) y el ítem no tiene datos:
    if (requireSalesHistory) {
      if (!salesAnalysis.hasData || salesAnalysis.avgDailySales <= 0) {
        continue;
      }

      // Filtro de frescura de ventas: Excluye ítems sin ventas en las últimas 24h ni en 7d
      if (recentSalesOnly && !salesAnalysis.hasRecentSales) {
        continue;
      }
    }

    // Filtro explícito de rotación mínima diaria
    if (minDailySales > 0 && salesAnalysis.avgDailySales < minDailySales) {
      continue;
    }

    // Verificación de precios inflados / exomagueos (antifraude)
    const median7d = vol?.median7d;
    const median30d = vol?.median30d;
    const suggestedPrice = vol?.suggestedPrice;
    const referenceMedian = (median7d && median7d > 0)
      ? median7d
      : (median30d && median30d > 0)
      ? median30d
      : (suggestedPrice && suggestedPrice > 0)
      ? suggestedPrice
      : null;

    let isOutlierPrice = false;
    let outlierRatio = 1;
    let effectiveSalePrice = rawSalePrice;

    if (referenceMedian && referenceMedian > 0) {
      outlierRatio = rawSalePrice / referenceMedian;
      if (outlierRatio > 1.45) {
        isOutlierPrice = true;
        if (filterOutliers) {
          effectiveSalePrice = Math.round(referenceMedian);
        }
      }
    }

    const saleTaxUnit = Math.ceil(effectiveSalePrice * 0.02);
    const netProfitUnit = effectiveSalePrice - saleTaxUnit - craftCostUnit;
    if (netProfitUnit <= 0) continue;

    const roiPercent = (netProfitUnit / craftCostUnit) * 100;
    if (roiPercent < minRoiFilter) continue;

    const jobMeta = DOFUS_JOBS.find((j) => j.id === item.jobId);
    const jobName = jobMeta?.nameEs || userJobDef?.nameEs || 'Oficio';
    const canCrush = isCrushableJob(item.jobId) && Array.isArray(item.possibleEffects) && item.possibleEffects.length > 0;

    // Tiempo de recuperación de capital (Cashflow / Payback)
    const hasVerifiedSales = salesAnalysis.hasData && salesAnalysis.avgDailySales > 0;
    const dailySpeed = hasVerifiedSales ? salesAnalysis.avgDailySales : 0.05;
    const dailyRevenue = dailySpeed * (effectiveSalePrice - saleTaxUnit);
    const paybackDays = (dailyRevenue > 0 && craftCostUnit > 0) ? (craftCostUnit / dailyRevenue) : null;
    const paybackHours = paybackDays !== null ? Math.round(paybackDays * 24) : null;

    // Calcular puntuación heurística según el modo
    let score = 0;

    if (optimizationMode === 'balanced') {
      score = netProfitUnit * Math.log10(dailySpeed * 10 + 1) * (1 + roiPercent / 200);
    } else if (optimizationMode === 'fast_cashflow') {
      const dailyRecoveryRate = paybackDays ? (1 / Math.max(0.1, paybackDays)) : 0.1;
      score = netProfitUnit * dailyRecoveryRate * (1 + roiPercent / 100);
    } else if (optimizationMode === 'max_profit') {
      score = netProfitUnit;
    } else {
      score = roiPercent;
    }

    // Si no tiene ventas históricas comprobadas, penalizar la puntuación fuertemente
    if (!hasVerifiedSales) {
      score *= 0.15;
    }

    // Integración de listings activos en venta: si ya está a la venta en HDV, depriorizar para diversificar
    const activeInHdv = activeSummary?.byItemMap?.[item.id];
    if (avoidAlreadyListed && activeInHdv && activeInHdv.totalQty > 0) {
      if (activeInHdv.count >= 2) {
        score *= 0.20;
      } else {
        score *= 0.50;
      }
    }

    // Impulso adicional para objetos con ventas comprobadas en el historial personal del usuario
    const userPersonalSale = soldStatsMap.get(item.id);
    if (userPersonalSale && userPersonalSale.totalUnitsSold > 0) {
      score *= 1.25;
    }

    candidates.push({
      item,
      jobName,
      jobId: item.jobId || 0,
      userJobLevel: userLevel,
      canCraftItem,
      category,
      isStackable,
      craftCostUnit,
      rawSalePrice,
      salePriceUnit: effectiveSalePrice,
      saleTaxUnit,
      netProfitUnit,
      roiPercent,
      avgDailySales: salesAnalysis.avgDailySales,
      sales24h: salesAnalysis.sales24h,
      sales7d: salesAnalysis.sales7d,
      sales30d: salesAnalysis.sales30d,
      turnoverRating: salesAnalysis.turnoverRating,
      turnoverLabel: salesAnalysis.turnoverLabel,
      hasSalesData: salesAnalysis.hasData,
      score,
      canCrush,
      paybackDays,
      paybackHours,
      isOutlierPrice,
      outlierRatio,
      referenceMedian,
      activeInHdv: activeInHdv ? {
        lots: activeInHdv.count,
        totalQty: activeInHdv.totalQty,
        timeLabel: activeInHdv.timeLabel,
      } : undefined,
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

export interface SolvePlannedCraftsParams {
  effectiveBudget: number;
  budget: number;
  candidatePool: CandidateItem[];
  marketChannel: MarketChannel;
  maxEquipSlots: number;
  maxConsumableSlots: number;
  maxResourceSlots: number;
  postedSummary: {
    equipSlots: number;
    consumableSlots: number;
    resourceSlots: number;
  };
  manualUnitsOverride: Record<number, number>;
  targetDays: number;
  maxBudgetShare: number;
  maxMarketShare: number;
}

export function solvePlannedCrafts(params: SolvePlannedCraftsParams): PlannedCraftItem[] {
  const {
    effectiveBudget,
    budget,
    candidatePool,
    marketChannel,
    maxEquipSlots,
    maxConsumableSlots,
    maxResourceSlots,
    postedSummary,
    manualUnitsOverride,
    targetDays,
    maxBudgetShare,
    maxMarketShare,
  } = params;

  if (effectiveBudget <= 0 || candidatePool.length === 0) return [];

  let remainingBudget = effectiveBudget;
  const isMulti = marketChannel === 'multichannel' || marketChannel === 'hybrid';
  let remainingEquipSlots = (isMulti || marketChannel === 'equipment')
    ? Math.max(0, maxEquipSlots - postedSummary.equipSlots)
    : 0;
  let remainingConsumableSlots = (isMulti || marketChannel === 'consumables')
    ? Math.max(0, maxConsumableSlots - postedSummary.consumableSlots)
    : 0;
  let remainingResourceSlots = (isMulti || marketChannel === 'resources')
    ? Math.max(0, maxResourceSlots - postedSummary.resourceSlots)
    : 0;
  const plan: PlannedCraftItem[] = [];

  for (const cand of candidatePool) {
    if (remainingBudget < cand.craftCostUnit) continue;

    // Verificar slots disponibles según el canal de mercadillo del ítem
    if (cand.category === 'equipment' && remainingEquipSlots <= 0) continue;
    if (cand.category === 'consumables' && remainingConsumableSlots <= 0) continue;
    if (cand.category === 'resources' && remainingResourceSlots <= 0) continue;

    // Si el usuario fijó manualmente una cantidad, respetarla
    const manualQty = manualUnitsOverride[cand.item.id];
    if (manualQty !== undefined) {
      let units = Math.max(0, manualQty);
      if (units * cand.craftCostUnit > remainingBudget) {
        units = Math.floor(remainingBudget / cand.craftCostUnit);
      }
      if (units > 0) {
        const cost = units * cand.craftCostUnit;
        const slots = calculateItemSlots(cand.isStackable, units);
        const maxAvail =
          cand.category === 'equipment'
            ? remainingEquipSlots
            : cand.category === 'consumables'
            ? remainingConsumableSlots
            : remainingResourceSlots;

        if (cost <= remainingBudget && slots <= maxAvail) {
          remainingBudget -= cost;
          if (cand.category === 'equipment') {
            remainingEquipSlots -= slots;
          } else if (cand.category === 'consumables') {
            remainingConsumableSlots -= slots;
          } else {
            remainingResourceSlots -= slots;
          }

          const dailyRev = cand.avgDailySales > 0 ? Math.min(units, cand.avgDailySales) * (cand.salePriceUnit - cand.saleTaxUnit) : 0;
          const itemPaybackDays = (cost > 0 && dailyRev > 0) ? (cost / dailyRev) : null;
          const itemPaybackHours = itemPaybackDays !== null ? Math.round(itemPaybackDays * 24) : null;

          plan.push({
            item: cand.item,
            jobName: cand.jobName,
            jobId: cand.jobId,
            userJobLevel: cand.userJobLevel,
            canCraft: cand.canCraftItem,
            marketCategory: cand.category,
            isStackable: cand.isStackable,
            craftCostUnit: cand.craftCostUnit,
            salePriceUnit: cand.salePriceUnit,
            saleTaxUnit: cand.saleTaxUnit,
            netProfitUnit: cand.netProfitUnit,
            roiPercent: cand.roiPercent,
            avgDailySales: cand.avgDailySales,
            sales24h: cand.sales24h,
            sales7d: cand.sales7d,
            sales30d: cand.sales30d,
            turnoverRating: cand.turnoverRating,
            turnoverLabel: cand.turnoverLabel,
            hasSalesData: cand.hasSalesData,
            recommendedUnits: units,
            totalCraftCost: cost,
            totalNetProfit: units * cand.netProfitUnit,
            estimatedSlots: slots,
            batchBreakdown: cand.isStackable ? calculateBatchBreakdown(units) : undefined,
            paybackDays: itemPaybackDays,
            paybackHours: itemPaybackHours,
            isOutlierPrice: cand.isOutlierPrice,
            outlierRatio: cand.outlierRatio,
            referenceMedian: cand.referenceMedian,
            originalSalePriceUnit: cand.rawSalePrice,
            canCrush: cand.canCrush,
            activeInHdv: cand.activeInHdv,
          });
        }
      }
      continue;
    }

    // Límite por capacidad de absorción diaria del mercadillo en el horizonte seleccionado
    let maxMarketUnits = 0;
    if (cand.avgDailySales > 0) {
      const totalHorizonAbsorption = cand.avgDailySales * targetDays;
      if (totalHorizonAbsorption < 0.5) continue;

      if (cand.avgDailySales <= 10) {
        if (cand.avgDailySales >= 5 && targetDays >= 1.0) {
          maxMarketUnits = 2;
        } else {
          maxMarketUnits = 1;
        }
      } else {
        const marketShareUnits = Math.round(totalHorizonAbsorption * maxMarketShare);
        maxMarketUnits = Math.max(2, marketShareUnits);
      }

      maxMarketUnits = Math.min(maxMarketUnits, Math.max(1, Math.round(totalHorizonAbsorption)));
    } else {
      maxMarketUnits = cand.isStackable ? 50 : 1;
    }

    // Límite por porcentaje máximo del presupuesto total en un solo ítem
    const maxBudgetCap = budget * maxBudgetShare;
    const maxBudgetUnits = Math.floor(Math.min(maxBudgetCap, remainingBudget) / cand.craftCostUnit);
    if (maxBudgetUnits <= 0) continue;

    // Límite por presupuesto restante actual
    const maxAffordableUnits = Math.floor(remainingBudget / cand.craftCostUnit);
    if (maxAffordableUnits <= 0) continue;

    let targetUnits = Math.min(maxMarketUnits, maxBudgetUnits, maxAffordableUnits);

    if (cand.category === 'equipment') {
      targetUnits = Math.min(targetUnits, remainingEquipSlots);
    } else {
      const availableSlots = cand.category === 'consumables' ? remainingConsumableSlots : remainingResourceSlots;
      let slotsNeeded = calculateItemSlots(cand.isStackable, targetUnits);
      while (slotsNeeded > availableSlots && targetUnits > 0) {
        if (targetUnits > 100) targetUnits -= 100;
        else if (targetUnits > 10) targetUnits -= 10;
        else targetUnits -= 1;
        slotsNeeded = calculateItemSlots(cand.isStackable, targetUnits);
      }
    }

    if (targetUnits > 0) {
      const cost = targetUnits * cand.craftCostUnit;
      const slots = calculateItemSlots(cand.isStackable, targetUnits);
      const batchBreakdown = cand.isStackable ? calculateBatchBreakdown(targetUnits) : undefined;

      remainingBudget -= cost;
      if (cand.category === 'equipment') {
        remainingEquipSlots -= slots;
      } else if (cand.category === 'consumables') {
        remainingConsumableSlots -= slots;
      } else {
        remainingResourceSlots -= slots;
      }

      const dailyRev = cand.avgDailySales > 0 ? Math.min(targetUnits, cand.avgDailySales) * (cand.salePriceUnit - cand.saleTaxUnit) : 0;
      const itemPaybackDays = (cost > 0 && dailyRev > 0) ? (cost / dailyRev) : null;
      const itemPaybackHours = itemPaybackDays !== null ? Math.round(itemPaybackDays * 24) : null;

      plan.push({
        item: cand.item,
        jobName: cand.jobName,
        jobId: cand.jobId,
        userJobLevel: cand.userJobLevel,
        canCraft: cand.canCraftItem,
        marketCategory: cand.category,
        isStackable: cand.isStackable,
        craftCostUnit: cand.craftCostUnit,
        salePriceUnit: cand.salePriceUnit,
        saleTaxUnit: cand.saleTaxUnit,
        netProfitUnit: cand.netProfitUnit,
        roiPercent: cand.roiPercent,
        avgDailySales: cand.avgDailySales,
        sales24h: cand.sales24h,
        sales7d: cand.sales7d,
        sales30d: cand.sales30d,
        turnoverRating: cand.turnoverRating,
        turnoverLabel: cand.turnoverLabel,
        hasSalesData: cand.hasSalesData,
        recommendedUnits: targetUnits,
        totalCraftCost: cost,
        totalNetProfit: targetUnits * cand.netProfitUnit,
        estimatedSlots: slots,
        batchBreakdown,
        paybackDays: itemPaybackDays,
        paybackHours: itemPaybackHours,
        isOutlierPrice: cand.isOutlierPrice,
        outlierRatio: cand.outlierRatio,
        referenceMedian: cand.referenceMedian,
        originalSalePriceUnit: cand.rawSalePrice,
        canCrush: cand.canCrush,
        activeInHdv: cand.activeInHdv,
      });
    }
  }

  return plan;
}

export interface MaterialDetail {
  id: number;
  name: string;
  totalQty: number;
  unitPrice: number;
  totalCost: number;
  recipesUsing: number;
  inBankQty: number;
  coveredByBankQty: number;
  neededToBuyQty: number;
  bankSavingsCost: number;
}

export interface MaterialsSummaryResult {
  list: MaterialDetail[];
  totalIngredientsCount: number;
  grandTotalCost: number;
  totalBankSavings: number;
  effectiveCostAfterBank: number;
  bottlenecks: MaterialDetail[];
}

export function calculateMaterialsSummary(
  plannedCrafts: PlannedCraftItem[],
  marketPrices: Record<number, number>,
  useBankResources: boolean,
  bankQtyMap: Record<number, number>
): MaterialsSummaryResult | null {
  if (plannedCrafts.length === 0) return null;

  const map = new Map<number, MaterialDetail>();
  let grandTotalCost = 0;
  let totalBankSavings = 0;

  for (const craft of plannedCrafts) {
    if (!craft.item.recipeData?.ingredientIds) continue;
    const { ingredientIds, quantities } = craft.item.recipeData;

    ingredientIds.forEach((ingId, idx) => {
      const qtyPerCraft = quantities[idx] || 1;
      const totalQtyForCraft = qtyPerCraft * craft.recommendedUnits;
      const price = marketPrices[ingId] || 0;
      const cost = price * totalQtyForCraft;
      grandTotalCost += cost;

      const existing = map.get(ingId);
      if (existing) {
        existing.totalQty += totalQtyForCraft;
        existing.totalCost += cost;
        existing.recipesUsing += 1;
      } else {
        const name = getItemName({ id: ingId } as any) || `Recurso #${ingId}`;
        const inBankQty = useBankResources ? (bankQtyMap[ingId] || 0) : 0;
        map.set(ingId, {
          id: ingId,
          name,
          totalQty: totalQtyForCraft,
          unitPrice: price,
          totalCost: cost,
          recipesUsing: 1,
          inBankQty,
          coveredByBankQty: 0,
          neededToBuyQty: totalQtyForCraft,
          bankSavingsCost: 0,
        });
      }
    });
  }

  map.forEach((item) => {
    if (useBankResources && item.inBankQty > 0) {
      item.coveredByBankQty = Math.min(item.inBankQty, item.totalQty);
      item.neededToBuyQty = Math.max(0, item.totalQty - item.coveredByBankQty);
      item.bankSavingsCost = item.coveredByBankQty * item.unitPrice;
      totalBankSavings += item.bankSavingsCost;
    } else {
      item.coveredByBankQty = 0;
      item.neededToBuyQty = item.totalQty;
      item.bankSavingsCost = 0;
    }
  });

  const list = Array.from(map.values()).sort((a, b) => b.totalCost - a.totalCost);
  const bottlenecks = list.filter((m) => grandTotalCost > 0 && (m.totalCost / grandTotalCost) >= 0.20);

  return {
    list,
    totalIngredientsCount: list.length,
    grandTotalCost,
    totalBankSavings,
    effectiveCostAfterBank: Math.max(0, grandTotalCost - totalBankSavings),
    bottlenecks,
  };
}
