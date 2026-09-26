import React, { useState, useMemo, useEffect } from 'react';
import {
  Briefcase,
  TrendingUp,
  Coins,
  Shield,
  Sparkles,
  Check,
  Copy,
  Plus,
  Minus,
  ShoppingCart,
  Wrench,
  Zap,
  AlertCircle,
  Clock,
  Layers,
  Store,
  SlidersHorizontal,
  Flame,
  ArrowRight,
  Package,
  Trash2,
  Activity,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { useUserJobs } from '../hooks/useUserJobs';
import { useMarketPrices } from '../hooks/useMarketPrices';
import { UserJobsModal } from './common/UserJobsModal';
import { SafeImage } from './SafeImage';
import { KamaDisplay } from './common/KamaDisplay';
import { PresetCraftableItem, DEFAULT_INGREDIENT_PRICES } from '../data/presetCraftableItems';
import {
  getCraftableItemsSnapshot,
  addToShoppingList,
  getItemIconUrl,
  getItemFallbackIconUrl,
  getItemName,
} from '../services/dofusDbService';
import { isOmittedItem, isClassItem, DOFUS_JOBS, isCrushableJob } from '../data/dofusJobs';
import { getStoredSalesVolumeMap, analyzeSalesVolume, fetchAndSyncSalesVolume, ItemSalesVolume, SalesVolumeMap } from '../services/salesVolumeService';
import { copyItemNameToClipboard } from '../utils/clipboardUtils';
import { USER_JOBS_DEFINITIONS } from '../services/userJobsService';

interface DailyCraftPlannerProps {
  onSelectRecipeForCalculator: (item: PresetCraftableItem) => void;
  onSelectForCrushing?: (item: PresetCraftableItem) => void;
  onNavigateToShopping?: () => void;
}

export type OptimizationMode = 'balanced' | 'fast_cashflow' | 'max_profit' | 'max_roi';
export type MarketChannel = 'multichannel' | 'hybrid' | 'equipment' | 'consumables' | 'resources';
export type MarketCategory = 'equipment' | 'consumables' | 'resources';

export interface BatchBreakdown {
  lots100: number;
  lots10: number;
  lots1: number;
  totalSlots: number;
}

export function calculateBatchBreakdown(units: number): BatchBreakdown {
  if (units <= 0) return { lots100: 0, lots10: 0, lots1: 0, totalSlots: 0 };
  const lots100 = Math.floor(units / 100);
  const rem100 = units % 100;
  const lots10 = Math.floor(rem100 / 10);
  const lots1 = rem100 % 10;
  // En Dofus, cada lote puesto a la venta ocupa 1 slot en HDV
  const totalSlots = lots100 + lots10 + (lots1 > 0 ? 1 : 0);
  return { lots100, lots10, lots1, totalSlots };
}

export interface PlannedCraftItem {
  item: PresetCraftableItem;
  jobName: string;
  jobId: number;
  userJobLevel: number;
  canCraft: boolean;
  marketCategory: MarketCategory;
  isStackable: boolean;
  craftCostUnit: number;
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
  recommendedUnits: number;
  totalCraftCost: number;
  totalNetProfit: number;
  estimatedSlots: number;
  batchBreakdown?: BatchBreakdown;
  paybackDays: number | null;
  paybackHours: number | null;
  isOutlierPrice: boolean;
  outlierRatio: number;
  referenceMedian: number | null;
  originalSalePriceUnit: number;
  canCrush: boolean;
}

/**
 * Clasificación precisa de objetos en los 3 Mercadillos independientes de Dofus:
 * 1. Mercadillo de Equipamiento (Equipables individuales - 1 slot por unidad)
 * 2. Mercadillo de Consumibles (Panes, carnes, pescados, llaves y pociones bebibles - Lotes x1, x10, x100)
 * 3. Mercadillo de Recursos (Aleaciones, tablas, concentrados, harinas, aceites y pociones de oficio - Lotes x1, x10, x100)
 * Nota: El Mercadillo de Criaturas (filtros/extractos) está explícitamente excluido.
 */
export function getItemMarketCategory(item: {
  id?: number;
  jobId?: number;
  typeId?: number;
  type?: { id?: number; superCategoryId?: number; name?: any };
  name?: any;
}): MarketCategory | null {
  const jobId = item.jobId || 0;
  const typeId = Number(item.typeId || item.type?.id || 0);
  const superCatId = Number((item as any).superCategoryId || item.type?.superCategoryId || 0);

  const rawName = (
    typeof item.name === 'object'
      ? (item.name?.es || item.name?.fr || item.name?.en || '')
      : String(item.name || '')
  ).toLowerCase();

  const rawTypeName = (
    typeof item.type?.name === 'object'
      ? (item.type?.name?.es || item.type?.name?.fr || '')
      : String(item.type?.name || '')
  ).toLowerCase();

  // 1. Excluir Forjamagia / Runas (tienen su propio mercadillo de runas, no van en HDV Recursos)
  if (
    typeId === 78 ||
    (item as any).itemCategory === 'rune' ||
    rawTypeName.includes('runa') ||
    rawTypeName.includes('rune') ||
    rawName.startsWith('runa ') ||
    rawName.startsWith('rune ')
  ) {
    return null;
  }

  // 2. Minero (Job 24) y Leñador (Job 2):
  // Aleaciones de minero, piedras pulidas, tablas, concentrados y sustratos de leñador -> Recursos
  if (jobId === 24 || jobId === 2) {
    return 'resources';
  }

  // 3. Campesino (Job 28):
  // Harinas y Aceites van al Mercadillo de Recursos.
  // Panes van al Mercadillo de Consumibles.
  if (jobId === 28) {
    if (
      typeId === 88 || typeId === 89 || typeId === 37 || // Harinas
      typeId === 60 || typeId === 58 || typeId === 129 || // Aceites
      rawTypeName.includes('harina') || rawTypeName.includes('farine') ||
      rawTypeName.includes('aceite') || rawTypeName.includes('huile') ||
      rawName.includes('harina') || rawName.includes('farine') ||
      rawName.includes('aceite') || rawName.includes('huile')
    ) {
      return 'resources';
    }
    return 'consumables';
  }

  // 4. Alquimista (Job 26):
  // Únicamente las 5 pócimas principales de alta demanda en HDV Recursos:
  // - Pócima de firma (y desmarcar)
  // - Pócima de envejecimiento
  // - Pócima mineral
  // - Pócima de ganduleo
  // - Pócima de alteración
  // Se excluyen tinturas, esencias de mazmorra y otras pócimas secundarias sin demanda masiva.
  if (jobId === 26) {
    const isMainResourcePotion =
      /\b(firma|desmarcar|envejecimiento|vieillesse|mineral|minérale|ganduleo|paresse|alteraci[oó]n|altération)\b/i.test(rawName);

    if (isMainResourcePotion) {
      return 'resources';
    }

    // Pócimas bebibles consumibles de alta rotación (vida, curación, energía, recuerdo, bonta, brakmar)
    const isConsumablePotion =
      /\b(curaci[oó]n|vida|soin|vie|energ[íi]a|[eé]nergie|recuerdo|rappel|bonta|brakmar|mini de curaci[oó]n|gueto)\b/i.test(rawName);

    if (isConsumablePotion) {
      return 'consumables';
    }

    // Las demás pócimas menores de alquimista (tinturas, esencias, virutas, torpeza, etc.) no se incluyen
    return null;
  }

  // 5. Cazador (41) y Pescador (36): Consumibles
  if (jobId === 41 || jobId === 36) {
    return 'consumables';
  }

  // 6. Manitas / Bricoleur (Job 65): Llaves -> Consumibles
  if (jobId === 65) {
    return 'consumables';
  }

  // 7. Oficios de equipamiento: Joyero (16), Sastre (27), Zapatero (15), Herrero (11), Escultor (13), Fabricante (60)
  const EQUIPMENT_JOB_IDS = new Set([16, 27, 15, 11, 13, 60]);
  if (EQUIPMENT_JOB_IDS.has(jobId) || superCatId === 1) {
    return 'equipment';
  }

  if (superCatId === 2) return 'consumables';
  if (superCatId === 3) return 'resources';

  return null;
}

function isItemStackable(item: PresetCraftableItem): boolean {
  const cat = getItemMarketCategory(item);
  return cat === 'consumables' || cat === 'resources';
}

function calculateItemSlots(isStackable: boolean, units: number): number {
  if (units <= 0) return 0;
  if (!isStackable) {
    // Equipables ocupan 1 slot por cada unidad individual en HDV
    return units;
  }
  // Consumibles / recursos se venden en lotes (1, 10 o 100)
  return calculateBatchBreakdown(units).totalSlots;
}

const BUDGET_PRESETS = [
  { label: '1 Mk', value: 1_000_000 },
  { label: '3 Mk', value: 3_000_000 },
  { label: '5 Mk', value: 5_000_000 },
  { label: '10 Mk', value: 10_000_000 },
  { label: '20 Mk', value: 20_000_000 },
  { label: '50 Mk', value: 50_000_000 },
];

export const DailyCraftPlanner: React.FC<DailyCraftPlannerProps> = ({
  onSelectRecipeForCalculator,
  onSelectForCrushing,
  onNavigateToShopping,
}) => {
  const [budget, setBudget] = useState<number>(10_000_000);
  const [budgetInput, setBudgetInput] = useState<string>('10000000');
  const [optimizationMode, setOptimizationMode] = useState<OptimizationMode>('balanced');
  const [marketChannel, setMarketChannel] = useState<MarketChannel>('multichannel');
  const [targetDays, setTargetDays] = useState<number>(1.0);
  const [maxEquipSlots, setMaxEquipSlots] = useState<number>(150);
  const [maxConsumableSlots, setMaxConsumableSlots] = useState<number>(100);
  const [maxResourceSlots, setMaxResourceSlots] = useState<number>(100);
  const [maxBudgetShare, setMaxBudgetShare] = useState<number>(0.35); // Max 35% del presupuesto en un solo ítem
  const [onlyMyJobs, setOnlyMyJobs] = useState<boolean>(true);
  const [requireSalesHistory, setRequireSalesHistory] = useState<boolean>(true);
  const [filterOutliers, setFilterOutliers] = useState<boolean>(true);
  const [selectedJobFilter, setSelectedJobFilter] = useState<number | 'all'>('all');
  const [minRoiFilter, setMinRoiFilter] = useState<number>(15); // Mínimo 15% ROI
  const [excludedItemIds, setExcludedItemIds] = useState<Set<number>>(new Set());
  const [manualUnitsOverride, setManualUnitsOverride] = useState<Record<number, number>>({});
  const [isJobsModalOpen, setIsJobsModalOpen] = useState(false);
  const [copiedItemNameId, setCopiedItemNameId] = useState<number | null>(null);
  const [addedAllNotice, setAddedAllNotice] = useState(false);
  const [showMaterialsDrawer, setShowMaterialsDrawer] = useState<boolean>(false);
  const [copiedMaterialsNotice, setCopiedMaterialsNotice] = useState<boolean>(false);

  const { settings: userJobSettings, canCraft } = useUserJobs();
  const { marketPrices: basePrices } = useMarketPrices();
  const [salesVolumeMap, setSalesVolumeMap] = useState<SalesVolumeMap>(() => getStoredSalesVolumeMap());

  useEffect(() => {
    // Sincronizar volúmenes de ventas remotos desde la API / DB local
    fetchAndSyncSalesVolume()
      .then((remoteMap) => {
        if (remoteMap && Object.keys(remoteMap).length > 0) {
          setSalesVolumeMap(remoteMap);
        }
      })
      .catch((err) => {
        console.warn('[DailyCraftPlanner] Error sincronizando volúmenes:', err);
      });

    const handleSalesVolumeUpdate = () => {
      setSalesVolumeMap(getStoredSalesVolumeMap());
    };

    window.addEventListener('dofus_sales_volume_updated', handleSalesVolumeUpdate);
    window.addEventListener('dofus_database_updated', handleSalesVolumeUpdate);

    return () => {
      window.removeEventListener('dofus_sales_volume_updated', handleSalesVolumeUpdate);
      window.removeEventListener('dofus_database_updated', handleSalesVolumeUpdate);
    };
  }, []);

  const marketPrices = useMemo(
    () => ({ ...DEFAULT_INGREDIENT_PRICES, ...basePrices }),
    [basePrices]
  );

  const allCraftableItems: PresetCraftableItem[] = useMemo(() => {
    const raw = getCraftableItemsSnapshot() as PresetCraftableItem[];
    return raw.filter((item) => !isOmittedItem(item) && !isClassItem(item));
  }, []);

  // Manejador del presupuesto
  const handleBudgetChange = (raw: string) => {
    const clean = raw.replace(/[^0-9]/g, '');
    setBudgetInput(clean);
    const num = parseInt(clean, 10);
    if (!isNaN(num) && num >= 0) {
      setBudget(num);
    }
  };

  const handleApplyPresetBudget = (val: number) => {
    setBudget(val);
    setBudgetInput(String(val));
  };

  // 1. Filtrar candidatos válidos y calcular rentabilidad unitaria
  const candidatePool = useMemo(() => {
    const candidates: Array<{
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
    }> = [];

    for (const item of allCraftableItems) {
      if (excludedItemIds.has(item.id)) continue;
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

      const rawSalePrice = marketPrices[item.id] || 0;
      if (rawSalePrice <= 0) continue;

      // Análisis de volumen de ventas
      const vol = salesVolumeMap[item.id];
      const salesAnalysis = analyzeSalesVolume(rawSalePrice, vol);

      // Si se exige historial de ventas (24h, 7d, 30d o promedio diario) y el ítem no tiene datos:
      if (requireSalesHistory && (!salesAnalysis.hasData || salesAnalysis.avgDailySales <= 0)) {
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
          // Si la protección antifraude está activa, usar la mediana histórica real
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
        // Priorizar velocidad de retorno del dinero (menor tiempo de recuperación y mayor rotación)
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
      });
    }

    // Ordenar candidatos por puntuación descendente
    candidates.sort((a, b) => b.score - a.score);
    return candidates;
  }, [
    allCraftableItems,
    excludedItemIds,
    selectedJobFilter,
    onlyMyJobs,
    userJobSettings,
    canCraft,
    marketPrices,
    budget,
    minRoiFilter,
    requireSalesHistory,
    filterOutliers,
    marketChannel,
    salesVolumeMap,
    optimizationMode,
  ]);

  // 2. Algoritmo de Asignación de Presupuesto y Slots (Optimización con 3 Mercadillos Independientes)
  const plannedCrafts: PlannedCraftItem[] = useMemo(() => {
    if (budget <= 0 || candidatePool.length === 0) return [];

    let remainingBudget = budget;
    const isMulti = marketChannel === 'multichannel' || marketChannel === 'hybrid';
    let remainingEquipSlots = (isMulti || marketChannel === 'equipment') ? maxEquipSlots : 0;
    let remainingConsumableSlots = (isMulti || marketChannel === 'consumables') ? maxConsumableSlots : 0;
    let remainingResourceSlots = (isMulti || marketChannel === 'resources') ? maxResourceSlots : 0;
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
        const units = Math.max(0, manualQty);
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
            });
          }
        }
        continue;
      }

      // Límite por capacidad de absorción diaria del mercadillo
      let maxMarketUnits = 1;
      if (cand.avgDailySales > 0) {
        maxMarketUnits = Math.max(1, Math.round(cand.avgDailySales * targetDays));
      } else {
        maxMarketUnits = cand.isStackable ? 50 : 1;
      }

      // Límite por porcentaje máximo del presupuesto total en un solo ítem
      const maxBudgetUnits = Math.max(
        1,
        Math.floor((budget * maxBudgetShare) / cand.craftCostUnit)
      );

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
        });
      }
    }

    return plan;
  }, [
    budget,
    maxEquipSlots,
    maxConsumableSlots,
    maxResourceSlots,
    marketChannel,
    candidatePool,
    targetDays,
    maxBudgetShare,
    manualUnitsOverride,
  ]);

  // Resumen de KPIs y Métricas de Liquidez
  const summary = useMemo(() => {
    const totalCost = plannedCrafts.reduce((acc, curr) => acc + curr.totalCraftCost, 0);
    const totalProfit = plannedCrafts.reduce((acc, curr) => acc + curr.totalNetProfit, 0);
    const equipSlotsUsed = plannedCrafts
      .filter((c) => c.marketCategory === 'equipment')
      .reduce((acc, curr) => acc + curr.estimatedSlots, 0);
    const consumableSlotsUsed = plannedCrafts
      .filter((c) => c.marketCategory === 'consumables')
      .reduce((acc, curr) => acc + curr.estimatedSlots, 0);
    const resourceSlotsUsed = plannedCrafts
      .filter((c) => c.marketCategory === 'resources')
      .reduce((acc, curr) => acc + curr.estimatedSlots, 0);
    const totalSlots = equipSlotsUsed + consumableSlotsUsed + resourceSlotsUsed;
    const totalUnits = plannedCrafts.reduce((acc, curr) => acc + curr.recommendedUnits, 0);
    const overallRoi = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;
    const budgetUsedPercent = budget > 0 ? (totalCost / budget) * 100 : 0;

    // Flujo diario estimado de entrada de kamas según absorción
    const dailyInflow = plannedCrafts.reduce((acc, c) => {
      if (c.avgDailySales > 0) {
        const unitsPerDay = Math.min(c.recommendedUnits, c.avgDailySales);
        return acc + unitsPerDay * (c.salePriceUnit - c.saleTaxUnit);
      }
      return acc;
    }, 0);

    const paybackDays = (totalCost > 0 && dailyInflow > 0) ? (totalCost / dailyInflow) : null;
    const paybackHours = paybackDays !== null ? Math.round(paybackDays * 24) : null;

    return {
      totalCost,
      totalProfit,
      equipSlotsUsed,
      consumableSlotsUsed,
      resourceSlotsUsed,
      totalSlots,
      totalUnits,
      recipeCount: plannedCrafts.length,
      overallRoi,
      budgetUsedPercent,
      remainingBudget: Math.max(0, budget - totalCost),
      dailyInflow,
      paybackDays,
      paybackHours,
    };
  }, [plannedCrafts, budget]);

  // Desglose de Materiales Agregados & Cuellos de Botella
  const materialsSummary = useMemo(() => {
    if (plannedCrafts.length === 0) return null;

    const map = new Map<number, {
      id: number;
      name: string;
      totalQty: number;
      unitPrice: number;
      totalCost: number;
      recipesUsing: number;
    }>();

    let grandTotalCost = 0;

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
          map.set(ingId, {
            id: ingId,
            name,
            totalQty: totalQtyForCraft,
            unitPrice: price,
            totalCost: cost,
            recipesUsing: 1,
          });
        }
      });
    }

    const list = Array.from(map.values()).sort((a, b) => b.totalCost - a.totalCost);
    // Identificar cuellos de botella (recursos que acaparan más del 20% del costo total)
    const bottlenecks = list.filter((m) => grandTotalCost > 0 && (m.totalCost / grandTotalCost) >= 0.20);

    return {
      list,
      totalIngredientsCount: list.length,
      grandTotalCost,
      bottlenecks,
    };
  }, [plannedCrafts, marketPrices]);

  const handleCopyMaterialsList = () => {
    if (!materialsSummary) return;
    const lines = [
      `🛒 LISTA DE COMPRAS - PLAN CRAFTEO DOFUS (${plannedCrafts.length} recetas, ${summary.totalUnits} unidades)`,
      `Presupuesto total: ${summary.totalCost.toLocaleString('es-ES')} K | Ganancia neta: +${summary.totalProfit.toLocaleString('es-ES')} K (+${summary.overallRoi.toFixed(0)}% ROI)`,
      '',
      '--- MATERIALES NECESARIOS ---',
      ...materialsSummary.list.map((m) => {
        const share = materialsSummary.grandTotalCost > 0 ? ((m.totalCost / materialsSummary.grandTotalCost) * 100).toFixed(0) : '0';
        return `• ${m.totalQty.toLocaleString('es-ES')}x ${m.name} (~${m.totalCost.toLocaleString('es-ES')} K, ${share}%)`;
      }),
      '',
      `Copiado desde Calculadora HDV Dofus`
    ];
    copyItemNameToClipboard(lines.join('\n'));
    setCopiedMaterialsNotice(true);
    setTimeout(() => setCopiedMaterialsNotice(false), 2000);
  };

  // Acciones
  const handleAddAllToShoppingList = () => {
    if (plannedCrafts.length === 0) return;

    plannedCrafts.forEach((craft) => {
      addToShoppingList(craft.item, craft.recommendedUnits);
    });

    setAddedAllNotice(true);
    setTimeout(() => setAddedAllNotice(false), 2500);

    if (onNavigateToShopping) {
      setTimeout(() => {
        onNavigateToShopping();
      }, 700);
    }
  };

  const handleDiscardItem = (itemId: number) => {
    setExcludedItemIds((prev) => {
      const next = new Set(prev);
      next.add(itemId);
      return next;
    });
    setManualUnitsOverride((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  };

  const handleAdjustUnits = (itemId: number, delta: number) => {
    const existing = plannedCrafts.find((c) => c.item.id === itemId);
    const current = manualUnitsOverride[itemId] ?? existing?.recommendedUnits ?? 1;
    const nextVal = Math.max(1, current + delta);
    setManualUnitsOverride((prev) => ({
      ...prev,
      [itemId]: nextVal,
    }));
  };

  const handleCopyName = (id: number, name: string) => {
    void copyItemNameToClipboard(name);
    setCopiedItemNameId(id);
    setTimeout(() => setCopiedItemNameId(null), 1500);
  };

  return (
    <div className="space-y-4 pb-12">
      {/* Encabezado Principal */}
      <div className="bg-slate-900 border border-slate-800 px-4 py-3 sm:px-5 sm:py-3.5 rounded-2xl shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <Briefcase className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Planificador de Fabricación y Rotación
              </h1>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold uppercase tracking-wider">
                Cartera Activa
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Asignación presupuestaria y optimización de lotes según absorción diaria en mercadillos.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <button
            type="button"
            onClick={() => setIsJobsModalOpen(true)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
            <span>Mis Oficios</span>
          </button>

          {plannedCrafts.length > 0 && (
            <button
              type="button"
              onClick={handleAddAllToShoppingList}
              className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
            >
              {addedAllNotice ? <Check className="w-4 h-4" /> : <ShoppingCart className="w-4 h-4" />}
              <span>{addedAllNotice ? '¡Añadido a Compras!' : 'Añadir a Compras'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Controles de Configuración del Plan */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-md space-y-3.5">
        {/* Selector de Canal / Mercadillos */}
        <div className="bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5 shrink-0">
              <Store className="w-3.5 h-3.5 text-amber-400" />
              Mercado:
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 bg-slate-900 p-0.5 border border-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setMarketChannel('multichannel')}
                className={`py-1 px-2.5 rounded-md text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  marketChannel === 'multichannel' || marketChannel === 'hybrid'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Aprovecha los 3 mercadillos independientes de Dofus (Equipamiento, Consumibles y Recursos)"
              >
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                <span>Multicanal (3 HDVs)</span>
              </button>

              <button
                type="button"
                onClick={() => setMarketChannel('equipment')}
                className={`py-1 px-2.5 rounded-md text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  marketChannel === 'equipment'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Solo equipamiento (1 slot unitario por pieza)"
              >
                <Shield className="w-3.5 h-3.5 text-purple-400" />
                <span>Equipamiento</span>
              </button>

              <button
                type="button"
                onClick={() => setMarketChannel('consumables')}
                className={`py-1 px-2.5 rounded-md text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  marketChannel === 'consumables'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Solo consumibles (panes, carnes, pescados, llaves y pociones bebibles)"
              >
                <Package className="w-3.5 h-3.5 text-emerald-400" />
                <span>Consumibles</span>
              </button>

              <button
                type="button"
                onClick={() => setMarketChannel('resources')}
                className={`py-1 px-2.5 rounded-md text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  marketChannel === 'resources'
                    ? 'bg-amber-400/25 text-amber-200 border border-amber-400/50 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Solo recursos crafteables (aleaciones, tablas, concentrados, harinas, aceites y pociones de oficio)"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Recursos</span>
              </button>
            </div>
          </div>

          <span className="text-[11px] text-slate-500 font-mono">
            {marketChannel === 'multichannel' || marketChannel === 'hybrid'
              ? '400 Equipos + 400 Consumibles + 400 Recursos'
              : 'Límite: 400 slots disponibles'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1. Presupuesto */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              Presupuesto
            </label>
            <div className="relative">
              <input
                type="text"
                value={budgetInput}
                onChange={(e) => handleBudgetChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-lg px-2.5 py-1.5 text-white font-mono font-bold text-xs outline-none transition-all pr-12"
                placeholder="10000000"
              />
              <span className="absolute right-2.5 top-1.5 text-xs text-amber-400 font-bold font-mono">
                K
              </span>
            </div>
            {/* Presets de presupuesto */}
            <div className="flex flex-wrap gap-1 pt-0.5">
              {BUDGET_PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => handleApplyPresetBudget(p.value)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all cursor-pointer ${
                    budget === p.value
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Modo de Optimización */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
              Estrategia
            </label>
            <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 border border-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setOptimizationMode('balanced')}
                className={`py-1 px-1.5 rounded text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  optimizationMode === 'balanced'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Equilibrio entre beneficio total y velocidad de venta"
              >
                <Flame className="w-3 h-3 text-amber-400" />
                <span>Equilibrio</span>
              </button>

              <button
                type="button"
                onClick={() => setOptimizationMode('fast_cashflow')}
                className={`py-1 px-1.5 rounded text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  optimizationMode === 'fast_cashflow'
                    ? 'bg-amber-400/25 text-amber-200 border border-amber-400/50 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Mayor velocidad de retorno de kamas (menor tiempo en mercadillo)"
              >
                <Zap className="w-3 h-3 text-amber-300" />
                <span>Flujo Rápido</span>
              </button>

              <button
                type="button"
                onClick={() => setOptimizationMode('max_profit')}
                className={`py-1 px-1.5 rounded text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  optimizationMode === 'max_profit'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Maximiza el total de kamas netos ganados dentro del presupuesto"
              >
                <Coins className="w-3 h-3 text-emerald-400" />
                <span>Beneficio</span>
              </button>

              <button
                type="button"
                onClick={() => setOptimizationMode('max_roi')}
                className={`py-1 px-1.5 rounded text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  optimizationMode === 'max_roi'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Mayor rentabilidad porcentual sobre el costo"
              >
                <Sparkles className="w-3 h-3 text-sky-400" />
                <span>Mayor ROI</span>
              </button>
            </div>
          </div>

          {/* 3. Absorción y Días de Rotación */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              Horizonte de Absorción
            </label>
            <div className="grid grid-cols-4 gap-1 bg-slate-950 p-1 border border-slate-800 rounded-lg text-center">
              {[0.5, 1.0, 2.0, 3.0].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setTargetDays(d)}
                  className={`py-1 rounded text-xs font-mono font-bold transition-all cursor-pointer ${
                    targetDays === d
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title={`Tope de unidades ajustado a las ventas estimadas de ${d} ${d === 1 ? 'día' : 'días'}`}
                >
                  {d}d
                </button>
              ))}
            </div>
            <span className="text-[10px] text-slate-500 block pt-0.5">
              Tope: ventas de {targetDays} {targetDays === 1 ? 'día' : 'días'}
            </span>
          </div>

          {/* 4. Límite de Slots HDV */}
          <div className="space-y-1">
            {marketChannel === 'multichannel' || marketChannel === 'hybrid' ? (
              <div className="space-y-1.5">
                <div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-300 flex items-center gap-1">
                      <Shield className="w-3 h-3 text-purple-400" />
                      Slots Equipos:
                    </span>
                    <span className="font-mono text-purple-300 font-bold text-[10px]">
                      {maxEquipSlots} / 400
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 bg-slate-950 p-0.5 border border-slate-800 rounded-lg text-center mt-0.5">
                    {[50, 100, 150, 400].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setMaxEquipSlots(s)}
                        className={`py-0.5 rounded text-[10px] font-mono font-bold cursor-pointer ${
                          maxEquipSlots === s
                            ? 'bg-purple-500/25 text-purple-300 border border-purple-500/40'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-300 flex items-center gap-1">
                      <Package className="w-3 h-3 text-emerald-400" />
                      Slots Consumibles:
                    </span>
                    <span className="font-mono text-emerald-300 font-bold text-[10px]">
                      {maxConsumableSlots} / 400
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 bg-slate-950 p-0.5 border border-slate-800 rounded-lg text-center mt-0.5">
                    {[50, 100, 150, 400].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setMaxConsumableSlots(s)}
                        className={`py-0.5 rounded text-[10px] font-mono font-bold cursor-pointer ${
                          maxConsumableSlots === s
                            ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-300 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      Slots Recursos:
                    </span>
                    <span className="font-mono text-amber-300 font-bold text-[10px]">
                      {maxResourceSlots} / 400
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 bg-slate-950 p-0.5 border border-slate-800 rounded-lg text-center mt-0.5">
                    {[50, 100, 150, 400].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setMaxResourceSlots(s)}
                        className={`py-0.5 rounded text-[10px] font-mono font-bold cursor-pointer ${
                          maxResourceSlots === s
                            ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : marketChannel === 'equipment' ? (
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5 text-purple-400" />
                    Slots Equipos
                  </label>
                  <span className="text-[10px] font-mono text-purple-300 font-bold">
                    {maxEquipSlots} / 400
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1 bg-slate-950 p-1 border border-slate-800 rounded-lg text-center mt-1">
                  {[50, 100, 150, 400].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setMaxEquipSlots(s)}
                      className={`py-1 rounded text-[11px] font-mono font-bold transition-all cursor-pointer ${
                        maxEquipSlots === s
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : marketChannel === 'consumables' ? (
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5 text-emerald-400" />
                    Slots Consumibles
                  </label>
                  <span className="text-[10px] font-mono text-emerald-300 font-bold">
                    {maxConsumableSlots} / 400
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1 bg-slate-950 p-1 border border-slate-800 rounded-lg text-center mt-1">
                  {[50, 100, 150, 400].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setMaxConsumableSlots(s)}
                      className={`py-1 rounded text-[11px] font-mono font-bold transition-all cursor-pointer ${
                        maxConsumableSlots === s
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5 text-amber-400" />
                    Slots Recursos
                  </label>
                  <span className="text-[10px] font-mono text-amber-300 font-bold">
                    {maxResourceSlots} / 400
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1 bg-slate-950 p-1 border border-slate-800 rounded-lg text-center mt-1">
                  {[50, 100, 150, 400].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setMaxResourceSlots(s)}
                      className={`py-1 rounded text-[11px] font-mono font-bold transition-all cursor-pointer ${
                        maxResourceSlots === s
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Barra Secundaria de Filtros */}
        <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            {/* Toggle Solo mis oficios */}
            <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={onlyMyJobs}
                onChange={(e) => setOnlyMyJobs(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-amber-400/50 cursor-pointer"
              />
              <span className="font-semibold text-slate-300 flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-amber-400" />
                Solo mis oficios
              </span>
            </label>

            {/* Toggle Solo con historial de ventas */}
            <label
              className="inline-flex items-center gap-1.5 cursor-pointer select-none pl-2 border-l border-slate-800"
              title="Excluir objetos sin ventas registradas en HDV"
            >
              <input
                type="checkbox"
                checked={requireSalesHistory}
                onChange={(e) => setRequireSalesHistory(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-400/50 cursor-pointer"
              />
              <span className="font-semibold text-slate-300 flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                Con historial de ventas
              </span>
            </label>

            {/* Toggle Antifraude / Precios Inflados */}
            <label
              className="inline-flex items-center gap-1.5 cursor-pointer select-none pl-2 border-l border-slate-800"
              title="Ajusta el precio a la mediana histórica cuando la oferta en mercadillo está anormalmente inflada"
            >
              <input
                type="checkbox"
                checked={filterOutliers}
                onChange={(e) => setFilterOutliers(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-950 text-indigo-500 focus:ring-indigo-400/50 cursor-pointer"
              />
              <span className="font-semibold text-slate-300 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                Filtrar anomalías de precio
              </span>
            </label>

            {/* Filtro por Oficio Específico */}
            <div className="flex items-center gap-1.5 pl-2 border-l border-slate-800">
              <span className="text-slate-400 font-medium">Oficio:</span>
              <select
                value={selectedJobFilter}
                onChange={(e) => setSelectedJobFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 text-xs font-semibold outline-none cursor-pointer"
              >
                <option value="all">Todos los oficios</option>
                {DOFUS_JOBS.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.nameEs}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro ROI Mínimo */}
            <div className="flex items-center gap-1.5 pl-2 border-l border-slate-800">
              <span className="text-slate-400 font-medium">ROI Mínimo:</span>
              <select
                value={minRoiFilter}
                onChange={(e) => setMinRoiFilter(Number(e.target.value))}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 text-xs font-semibold outline-none cursor-pointer"
              >
                <option value={0}>Sin mínimo (0%)</option>
                <option value={10}>&gt;= 10%</option>
                <option value={15}>&gt;= 15%</option>
                <option value={25}>&gt;= 25%</option>
                <option value={40}>&gt;= 40%</option>
                <option value={60}>&gt;= 60%</option>
              </select>
            </div>

            {/* Diversificación máxima */}
            <div className="flex items-center gap-1.5 pl-2 border-l border-slate-800">
              <span className="text-slate-400 font-medium">Diversificación:</span>
              <select
                value={maxBudgetShare}
                onChange={(e) => setMaxBudgetShare(Number(e.target.value))}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 text-xs font-semibold outline-none cursor-pointer"
              >
                <option value={0.25}>Alta (Máx. 25% por ítem)</option>
                <option value={0.35}>Media (Máx. 35% por ítem)</option>
                <option value={0.50}>Baja (Máx. 50% por ítem)</option>
                <option value={1.00}>Sin límite (100% por ítem)</option>
              </select>
            </div>
          </div>

          {excludedItemIds.size > 0 && (
            <button
              type="button"
              onClick={() => setExcludedItemIds(new Set())}
              className="text-rose-400 hover:text-rose-300 font-semibold text-[11px] underline flex items-center gap-1 cursor-pointer"
            >
              Restablecer {excludedItemIds.size} {excludedItemIds.size === 1 ? 'descarte' : 'descartes'}
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards de Resumen del Plan */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* KPI 1: Inversión / Presupuesto */}
        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl shadow-md space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span className="flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              Capital Invertido
            </span>
            <span className="font-mono font-bold text-amber-300">
              {summary.budgetUsedPercent.toFixed(1)}%
            </span>
          </div>
          <div className="text-base sm:text-lg font-black text-white font-mono">
            <KamaDisplay amount={summary.totalCost} />
          </div>
          <div className="w-full h-1 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-500"
              style={{ width: `${Math.min(100, summary.budgetUsedPercent)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
            <span>Presupuesto: {budget.toLocaleString('es-ES')} K</span>
            <span>Remanente: {summary.remainingBudget.toLocaleString('es-ES')} K</span>
          </div>
        </div>

        {/* KPI 2: Ganancia Neta Estimada */}
        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl shadow-md space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              Beneficio Neto Proyectado
            </span>
            <span className="font-mono font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 text-[10px]">
              +{summary.overallRoi.toFixed(1)}% ROI
            </span>
          </div>
          <div className="text-base sm:text-lg font-black text-emerald-400 font-mono">
            +<KamaDisplay amount={summary.totalProfit} />
          </div>
          <span className="text-[10px] text-slate-500 block">
            Tasa de venta (2%) deducida
          </span>
        </div>

        {/* KPI 3: Variedad y Objetos */}
        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl shadow-md space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span className="flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-sky-400" />
              Volumen de Producción
            </span>
            <span className="text-sky-300 font-bold font-mono text-[11px]">
              {summary.recipeCount} recetas
            </span>
          </div>
          <div className="text-base sm:text-lg font-black text-white font-mono">
            {summary.totalUnits} {summary.totalUnits === 1 ? 'unidad' : 'unidades'}
          </div>
          <span className="text-[10px] text-slate-500 block">
            Distribución multiobjeto
          </span>
        </div>

        {/* KPI 4: Slots de Mercadillo */}
        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl shadow-md space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span className="flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5 text-purple-400" />
              Slots en Mercadillo
            </span>
            <span className="font-mono font-bold text-purple-300 text-[11px]">
              {marketChannel === 'multichannel' || marketChannel === 'hybrid'
                ? `${summary.totalSlots} slots tot.`
                : `${summary.totalSlots} / ${
                    marketChannel === 'equipment'
                      ? maxEquipSlots
                      : marketChannel === 'consumables'
                      ? maxConsumableSlots
                      : maxResourceSlots
                  }`}
            </span>
          </div>
          {marketChannel === 'multichannel' || marketChannel === 'hybrid' ? (
            <div className="space-y-0.5 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1">
                  <Shield className="w-3 h-3 text-purple-400" /> Equipos:
                </span>
                <span className="font-bold text-purple-300">{summary.equipSlotsUsed} / {maxEquipSlots}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1">
                  <Package className="w-3 h-3 text-emerald-400" /> Consumibles:
                </span>
                <span className="font-bold text-emerald-300">{summary.consumableSlotsUsed} / {maxConsumableSlots}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" /> Recursos:
                </span>
                <span className="font-bold text-amber-300">{summary.resourceSlotsUsed} / {maxResourceSlots}</span>
              </div>
            </div>
          ) : (
            <div className="text-base sm:text-lg font-black text-purple-300 font-mono">
              {summary.totalSlots} slots ocupados
            </div>
          )}
          <span className="text-[10px] text-slate-500 block">
            {marketChannel === 'multichannel' || marketChannel === 'hybrid'
              ? '3 canales independientes'
              : 'Capacidad asignada'}
          </span>
        </div>
      </div>

      {/* KPI Barra de Liquidez y Retorno de Inversión */}
      {summary.dailyInflow > 0 && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2.5 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-300 shrink-0">
              <Zap className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="font-medium text-slate-300">
                Retorno de Inversión Proyectado:
              </span>
              <span className="font-mono font-bold text-amber-300 px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-[11px]">
                {summary.paybackHours !== null ? `~${summary.paybackHours} h` : `~${summary.paybackDays?.toFixed(1)} d`}
              </span>
              <span className="text-slate-500 font-mono text-[11px]">
                (Flujo: <span className="text-emerald-400 font-bold">~{summary.dailyInflow.toLocaleString('es-ES')} K/día</span>)
              </span>
            </div>
          </div>

          <div className="text-xs font-mono">
            {summary.paybackHours !== null && summary.paybackHours <= 24 && (
              <span className="text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 text-[10px]">
                Retorno rápido (&lt; 24h)
              </span>
            )}
          </div>
        </div>
      )}

      {/* Desglose Agregado de Materiales y Cuellos de Botella */}
      {materialsSummary && materialsSummary.list.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg transition-all">
          <div
            onClick={() => setShowMaterialsDrawer(!showMaterialsDrawer)}
            className="p-3.5 bg-slate-950/70 hover:bg-slate-950 flex items-center justify-between cursor-pointer border-b border-slate-800/60 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <Package className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-white text-xs flex items-center gap-2">
                  Desglose Agregado de Materiales & Cuellos de Botella
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                    {materialsSummary.totalIngredientsCount} recursos necesarios
                  </span>
                </span>
                <p className="text-[11px] text-slate-400">
                  {materialsSummary.bottlenecks.length > 0
                    ? `⚠️ ${materialsSummary.bottlenecks.length} cuello(s) de botella acaparan la mayor parte del presupuesto`
                    : 'Gasto de materiales bien distribuido sin dependencias críticas'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopyMaterialsList();
                }}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                title="Copiar lista de compras en formato texto para compartir o pegar en Dofus"
              >
                {copiedMaterialsNotice ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                <span>{copiedMaterialsNotice ? '¡Copiado!' : 'Copiar Lista'}</span>
              </button>
              {showMaterialsDrawer ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </div>
          </div>

          {showMaterialsDrawer && (
            <div className="p-4 space-y-3 bg-slate-900/60">
              {materialsSummary.bottlenecks.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-200">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span className="font-bold text-amber-300">Cuellos de botella detectados en la cartera:</span>
                    <p className="text-[11px] text-amber-200/90 leading-relaxed">
                      {materialsSummary.bottlenecks.map((b) => {
                        const pct = ((b.totalCost / materialsSummary.grandTotalCost) * 100).toFixed(0);
                        return `"${b.name}" (${b.totalQty.toLocaleString('es-ES')}x = ${b.totalCost.toLocaleString('es-ES')} K, ~${pct}% del gasto total)`;
                      }).join(' • ')}
                      . Vigila la disponibilidad y precio de estos recursos antes de empezar a craftear.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-60 overflow-y-auto pr-1">
                {materialsSummary.list.map((mat) => {
                  const pct = materialsSummary.grandTotalCost > 0 ? (mat.totalCost / materialsSummary.grandTotalCost) * 100 : 0;
                  const isBottleneck = pct >= 20;

                  return (
                    <div
                      key={mat.id}
                      className={`p-2 rounded-xl border flex items-center justify-between text-xs font-mono ${
                        isBottleneck
                          ? 'bg-amber-950/20 border-amber-500/40 text-amber-200'
                          : 'bg-slate-950 border-slate-800/80 text-slate-300'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-bold truncate text-white" title={mat.name}>
                          {mat.name}
                        </div>
                        <div className="text-[10px] text-slate-400 font-sans">
                          {mat.totalQty.toLocaleString('es-ES')}x • {mat.unitPrice.toLocaleString('es-ES')} K/u
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-amber-300">
                          {mat.totalCost.toLocaleString('es-ES')} K
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {pct.toFixed(0)}% del gasto
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lista / Cartera Recomendada */}
      {plannedCrafts.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center max-w-lg mx-auto space-y-4 shadow-lg">
          <div className="w-14 h-14 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-center text-slate-500 mx-auto">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">No se encontraron crafteos viables con los filtros actuales</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Intenta incrementar el presupuesto, bajar el filtro de ROI mínimo, o desactivar temporalmente
              &ldquo;Solo oficios que puedo craftear&rdquo; {requireSalesHistory ? 'o "Solo con historial de ventas"' : ''} para ampliar las opciones.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => handleApplyPresetBudget(10_000_000)}
              className="px-3 py-1.5 bg-amber-500 text-slate-950 rounded-xl text-xs font-bold cursor-pointer hover:bg-amber-400"
            >
              Probar con 10 Mk
            </button>
            <button
              type="button"
              onClick={() => setMinRoiFilter(0)}
              className="px-3 py-1.5 bg-slate-800 text-slate-300 border border-slate-700 rounded-xl text-xs font-bold cursor-pointer hover:bg-slate-700"
            >
              Quitar ROI mínimo
            </button>
            {requireSalesHistory && (
              <button
                type="button"
                onClick={() => setRequireSalesHistory(false)}
                className="px-3 py-1.5 bg-slate-800 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold cursor-pointer hover:bg-slate-700"
              >
                Permitir sin historial de ventas
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsJobsModalOpen(true)}
              className="px-3 py-1.5 bg-slate-800 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold cursor-pointer hover:bg-slate-700"
            >
              Configurar Niveles de Oficio
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Cartera Recomendada ({plannedCrafts.length} recetas)
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {plannedCrafts.map((craft) => {
              const itemName = getItemName(craft.item);
              const isCopied = copiedItemNameId === craft.item.id;

              return (
                <div
                  key={craft.item.id}
                  className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-3.5 shadow-md flex flex-col justify-between gap-2.5 transition-all relative overflow-hidden group"
                >
                  {/* Decorative badge */}
                  <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-bl-full pointer-events-none" />

                  {/* Top: Header Info */}
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 bg-slate-950 border border-slate-800 rounded-xl p-1.5 shrink-0 flex items-center justify-center shadow-inner">
                          <SafeImage
                            src={getItemIconUrl(craft.item)}
                            fallbackSrc={getItemFallbackIconUrl(craft.item)}
                            alt={itemName}
                            className="w-9 h-9 object-contain"
                          />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h3
                              onClick={() => handleCopyName(craft.item.id, itemName)}
                              className="font-bold text-white text-sm truncate hover:text-amber-300 transition-colors cursor-pointer"
                              title={`${itemName} (Clic para copiar nombre)`}
                            >
                              {itemName}
                            </h3>
                            <button
                              type="button"
                              onClick={() => handleCopyName(craft.item.id, itemName)}
                              className="text-slate-500 hover:text-slate-300 p-0.5 cursor-pointer"
                              title="Copiar nombre"
                            >
                              {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 flex-wrap mt-0.5">
                            <span className="font-mono text-slate-300">Nv. {craft.item.level}</span>
                            <span>•</span>
                            <span className="text-amber-300/90 font-semibold">{craft.jobName}</span>
                            <span className="px-1.5 py-0.2 rounded bg-slate-950 border border-slate-800 text-[10px] text-slate-400">
                              Nv. {craft.userJobLevel}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Discard button */}
                      <button
                        type="button"
                        onClick={() => handleDiscardItem(craft.item.id)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors shrink-0 cursor-pointer"
                        title="Descartar este objeto del plan y re-optimizar presupuesto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Quantity Stepper & Badges */}
                    <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-400 font-medium">Fabricar:</span>
                        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5">
                          <button
                            type="button"
                            onClick={() => handleAdjustUnits(craft.item.id, -1)}
                            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-colors cursor-pointer"
                            title="Restar 1 unidad"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-7 text-center font-mono font-black text-amber-300 text-xs">
                            {craft.recommendedUnits}x
                          </span>
                          <button
                            type="button"
                            onClick={() => handleAdjustUnits(craft.item.id, 1)}
                            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-colors cursor-pointer"
                            title="Sumar 1 unidad"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* HDV Channel & Slots info badge */}
                      <div className="flex items-center gap-1.5 text-[11px] font-mono flex-wrap justify-end">
                        {craft.marketCategory === 'equipment' ? (
                          <span
                            className="text-[10px] text-purple-300 font-sans px-1.5 py-0.5 rounded bg-purple-500/15 border border-purple-500/30 flex items-center gap-1"
                            title="Mercadillo de Equipamiento (1 slot unitario por cada unidad)"
                          >
                            <Shield className="w-3 h-3 text-purple-400" />
                            HDV Equipos ({craft.estimatedSlots}s)
                          </span>
                        ) : craft.marketCategory === 'consumables' ? (
                          <span
                            className="text-[10px] text-emerald-300 font-sans px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 flex items-center gap-1"
                            title={`Mercadillo de Consumibles (${craft.estimatedSlots} slots): lotes x1, x10, x100`}
                          >
                            <Package className="w-3 h-3 text-emerald-400" />
                            HDV Consumibles ({craft.estimatedSlots}s)
                          </span>
                        ) : (
                          <span
                            className="text-[10px] text-amber-300 font-sans px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 flex items-center gap-1"
                            title={`Mercadillo de Recursos (${craft.estimatedSlots} slots): lotes x1, x10, x100`}
                          >
                            <Sparkles className="w-3 h-3 text-amber-400" />
                            HDV Recursos ({craft.estimatedSlots}s)
                          </span>
                        )}

                        {craft.isStackable && craft.batchBreakdown && (
                          <span
                            className="text-[10px] text-slate-300 font-sans px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800"
                            title={`Desglose en lotes puestos a la venta: ${craft.batchBreakdown.lots100 > 0 ? `${craft.batchBreakdown.lots100}x [100] ` : ''}${craft.batchBreakdown.lots10 > 0 ? `${craft.batchBreakdown.lots10}x [10] ` : ''}${craft.batchBreakdown.lots1 > 0 ? `${craft.batchBreakdown.lots1}x [1]` : ''}`}
                          >
                            {craft.batchBreakdown.lots100 > 0 ? `${craft.batchBreakdown.lots100}x100 ` : ''}
                            {craft.batchBreakdown.lots10 > 0 ? `${craft.batchBreakdown.lots10}x10 ` : ''}
                            {craft.batchBreakdown.lots1 > 0 ? `${craft.batchBreakdown.lots1}x1` : ''}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Outlier / Exomagueo Protection notice if applicable */}
                    {craft.isOutlierPrice && (
                      craft.originalSalePriceUnit !== craft.salePriceUnit ? (
                        <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20 font-mono">
                          <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span className="leading-tight">
                            Precio protegido: calculando con mediana ({craft.salePriceUnit.toLocaleString('es-ES')} K)
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-[10px] text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20 font-mono">
                          <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                          <span className="leading-tight">
                            Anomalía: +{((craft.outlierRatio - 1) * 100).toFixed(0)}% sobre mediana ({craft.referenceMedian?.toLocaleString('es-ES')} K)
                          </span>
                        </div>
                      )
                    )}

                    {/* Breakdown Numbers */}
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1">
                      <div className="bg-slate-950/50 p-2 rounded-xl border border-slate-800/50 space-y-0.5">
                        <span className="text-[10px] text-slate-500 font-sans block">Inversión Crafteo</span>
                        <div className="font-bold text-white">
                          <KamaDisplay amount={craft.totalCraftCost} />
                        </div>
                        <span className="text-[10px] text-slate-500 block">
                          Unit: {craft.craftCostUnit.toLocaleString('es-ES')} K
                        </span>
                      </div>

                      <div className="bg-slate-950/50 p-2 rounded-xl border border-slate-800/50 space-y-0.5 text-right">
                        <span className="text-[10px] text-emerald-400/90 font-sans block font-semibold">
                          Beneficio Neto (+{craft.roiPercent.toFixed(0)}%)
                        </span>
                        <div className="font-bold text-emerald-400">
                          +<KamaDisplay amount={craft.totalNetProfit} />
                        </div>
                        <span className="text-[10px] text-slate-500 block">
                          Venta HDV: {craft.salePriceUnit.toLocaleString('es-ES')} K
                        </span>
                      </div>
                    </div>

                    {/* Market Velocity & Cashflow Indicators */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] bg-slate-950/40 px-2.5 py-1.5 rounded-xl border border-slate-800/40">
                        <span className="text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-400" />
                          Ventas diarias HDV:
                        </span>
                        {craft.hasSalesData && craft.avgDailySales > 0 ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-amber-300 font-mono flex items-center gap-1">
                              ~{craft.avgDailySales.toFixed(1)} uds/día
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  craft.turnoverRating === 'alta'
                                    ? 'bg-emerald-400'
                                    : craft.turnoverRating === 'media'
                                    ? 'bg-amber-400'
                                    : 'bg-rose-400'
                                }`}
                                title={craft.turnoverLabel || ''}
                              />
                            </span>
                            {(craft.sales24h || craft.sales7d || craft.sales30d) ? (
                              <span
                                className="text-[10px] text-slate-400 font-mono bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800"
                                title={`Historial HDV: 24h: ${craft.sales24h ?? '-'} | 7d: ${craft.sales7d ?? '-'} | 30d: ${craft.sales30d ?? '-'}`}
                              >
                                {craft.sales24h ? `${craft.sales24h} (24h)` : craft.sales7d ? `${craft.sales7d} (7d)` : `${craft.sales30d} (30d)`}
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-rose-400/90 font-medium bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20 text-[10px]">
                            Sin histórico HDV (tope seguro 1x)
                          </span>
                        )}
                      </div>

                      {craft.paybackHours !== null && (
                        <div className="flex items-center justify-between text-[11px] bg-slate-950/40 px-2.5 py-1 rounded-xl border border-slate-800/40 font-mono">
                          <span className="text-slate-400 flex items-center gap-1 font-sans">
                            <Zap className="w-3 h-3 text-amber-400" />
                            Retorno capital:
                          </span>
                          <span className="text-amber-300 font-bold">
                            ~{craft.paybackHours}h ({craft.paybackDays?.toFixed(1)}d)
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bottom: Action Buttons */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-1.5 text-xs">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onSelectRecipeForCalculator(craft.item)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-bold flex items-center gap-1 transition-colors cursor-pointer text-[11px]"
                        title="Ver detalles de la receta y materiales"
                      >
                        <Wrench className="w-3 h-3 text-amber-400" />
                        <span>Receta</span>
                      </button>

                      {craft.canCrush && onSelectForCrushing && (
                        <button
                          type="button"
                          onClick={() => onSelectForCrushing(craft.item)}
                          className="px-2 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-lg font-bold flex items-center gap-1 transition-colors cursor-pointer text-[11px]"
                          title="Simular en rompedora de runas"
                        >
                          <Zap className="w-3 h-3" />
                          <span>Romper</span>
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        addToShoppingList(craft.item, craft.recommendedUnits);
                        setAddedAllNotice(true);
                        setTimeout(() => setAddedAllNotice(false), 1500);
                      }}
                      className="px-2.5 py-1 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 rounded-lg font-bold flex items-center gap-1 transition-colors cursor-pointer text-[11px]"
                      title="Añadir esta cantidad a la lista de compras"
                    >
                      <ShoppingCart className="w-3 h-3" />
                      <span>+ Carrito</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal para configurar oficios del usuario */}
      <UserJobsModal
        isOpen={isJobsModalOpen}
        onClose={() => setIsJobsModalOpen(false)}
      />
    </div>
  );
};
