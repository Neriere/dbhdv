import React, { useState, useMemo } from 'react';
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
import { getStoredSalesVolumeMap, analyzeSalesVolume, ItemSalesVolume } from '../services/salesVolumeService';
import { copyItemNameToClipboard } from '../utils/clipboardUtils';
import { USER_JOBS_DEFINITIONS } from '../services/userJobsService';

interface DailyCraftPlannerProps {
  onSelectRecipeForCalculator: (item: PresetCraftableItem) => void;
  onSelectForCrushing?: (item: PresetCraftableItem) => void;
  onNavigateToShopping?: () => void;
}

export type OptimizationMode = 'balanced' | 'max_profit' | 'max_roi';

export interface PlannedCraftItem {
  item: PresetCraftableItem;
  jobName: string;
  jobId: number;
  userJobLevel: number;
  canCraft: boolean;
  isStackable: boolean;
  craftCostUnit: number;
  salePriceUnit: number;
  saleTaxUnit: number;
  netProfitUnit: number;
  roiPercent: number;
  avgDailySales: number;
  turnoverRating: 'alta' | 'media' | 'baja' | null;
  turnoverLabel: string | null;
  hasSalesData: boolean;
  recommendedUnits: number;
  totalCraftCost: number;
  totalNetProfit: number;
  estimatedSlots: number;
  canCrush: boolean;
}

const STACKABLE_JOB_IDS = new Set([26, 28, 41, 2, 24, 36, 65]);

function isItemStackable(item: PresetCraftableItem): boolean {
  if (item.jobId && STACKABLE_JOB_IDS.has(item.jobId)) return true;
  return false;
}

function calculateItemSlots(isStackable: boolean, units: number): number {
  if (units <= 0) return 0;
  if (!isStackable) {
    // Equipables ocupan 1 slot por cada unidad individual en HDV
    return units;
  }
  // Consumibles / recursos se venden en lotes (ej. lotes de 10 o 100)
  if (units >= 100) {
    return Math.max(1, Math.ceil(units / 100));
  }
  if (units >= 10) {
    return Math.max(1, Math.ceil(units / 10));
  }
  return 1;
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
  const [targetDays, setTargetDays] = useState<number>(1.0);
  const [maxHdvSlots, setMaxHdvSlots] = useState<number>(150);
  const [maxBudgetShare, setMaxBudgetShare] = useState<number>(0.35); // Max 35% del presupuesto en un solo ítem
  const [onlyMyJobs, setOnlyMyJobs] = useState<boolean>(true);
  const [selectedJobFilter, setSelectedJobFilter] = useState<number | 'all'>('all');
  const [minRoiFilter, setMinRoiFilter] = useState<number>(15); // Mínimo 15% ROI
  const [excludedItemIds, setExcludedItemIds] = useState<Set<number>>(new Set());
  const [manualUnitsOverride, setManualUnitsOverride] = useState<Record<number, number>>({});
  const [isJobsModalOpen, setIsJobsModalOpen] = useState(false);
  const [copiedItemNameId, setCopiedItemNameId] = useState<number | null>(null);
  const [addedAllNotice, setAddedAllNotice] = useState(false);

  const { settings: userJobSettings, canCraft } = useUserJobs();
  const { marketPrices: basePrices } = useMarketPrices();
  const salesVolumeMap = useMemo(() => getStoredSalesVolumeMap(), []);

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
      isStackable: boolean;
      craftCostUnit: number;
      salePriceUnit: number;
      saleTaxUnit: number;
      netProfitUnit: number;
      roiPercent: number;
      avgDailySales: number;
      turnoverRating: 'alta' | 'media' | 'baja' | null;
      turnoverLabel: string | null;
      hasSalesData: boolean;
      score: number;
      canCrush: boolean;
    }> = [];

    for (const item of allCraftableItems) {
      if (excludedItemIds.has(item.id)) continue;
      if (!item.recipeData?.ingredientIds || item.recipeData.ingredientIds.length === 0) continue;

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

      const salePriceUnit = marketPrices[item.id] || 0;
      if (salePriceUnit <= 0) continue;

      const saleTaxUnit = Math.ceil(salePriceUnit * 0.02);
      const netProfitUnit = salePriceUnit - saleTaxUnit - craftCostUnit;
      if (netProfitUnit <= 0) continue;

      const roiPercent = (netProfitUnit / craftCostUnit) * 100;
      if (roiPercent < minRoiFilter) continue;

      // Análisis de volumen de ventas
      const vol = salesVolumeMap[item.id];
      const salesAnalysis = analyzeSalesVolume(salePriceUnit, vol);
      const isStackable = isItemStackable(item);

      const jobMeta = DOFUS_JOBS.find((j) => j.id === item.jobId);
      const jobName = jobMeta?.nameEs || userJobDef?.nameEs || 'Oficio';

      const canCrush = isCrushableJob(item.jobId) && Array.isArray(item.possibleEffects) && item.possibleEffects.length > 0;

      // Calcular puntuación heurística según el modo
      let score = 0;
      const dailySpeed = salesAnalysis.avgDailySales > 0 ? salesAnalysis.avgDailySales : 0.5;

      if (optimizationMode === 'balanced') {
        // Balance entre kamas netos y rotación diaria
        // Items que se venden bien diariamente y tienen buen beneficio reciben mayor prioridad
        score = netProfitUnit * Math.log10(dailySpeed * 10 + 1) * (1 + roiPercent / 200);
      } else if (optimizationMode === 'max_profit') {
        // Priorizar retorno absoluto en kamas por crafteo
        score = netProfitUnit;
      } else {
        // Priorizar mayor ROI porcentual
        score = roiPercent;
      }

      candidates.push({
        item,
        jobName,
        jobId: item.jobId || 0,
        userJobLevel: userLevel,
        canCraftItem,
        isStackable,
        craftCostUnit,
        salePriceUnit,
        saleTaxUnit,
        netProfitUnit,
        roiPercent,
        avgDailySales: salesAnalysis.avgDailySales,
        turnoverRating: salesAnalysis.turnoverRating,
        turnoverLabel: salesAnalysis.turnoverLabel,
        hasSalesData: salesAnalysis.hasData,
        score,
        canCrush,
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
    salesVolumeMap,
    optimizationMode,
  ]);

  // 2. Algoritmo de Asignación de Presupuesto y Slots (Optimización de Cartera)
  const plannedCrafts: PlannedCraftItem[] = useMemo(() => {
    if (budget <= 0 || candidatePool.length === 0) return [];

    let remainingBudget = budget;
    let remainingSlots = maxHdvSlots;
    const plan: PlannedCraftItem[] = [];

    for (const cand of candidatePool) {
      if (remainingBudget < cand.craftCostUnit || remainingSlots <= 0) break;

      // Si el usuario fijó manualmente una cantidad, respetarla
      const manualQty = manualUnitsOverride[cand.item.id];
      if (manualQty !== undefined) {
        const units = Math.max(0, manualQty);
        if (units > 0) {
          const cost = units * cand.craftCostUnit;
          const slots = calculateItemSlots(cand.isStackable, units);
          if (cost <= remainingBudget && slots <= remainingSlots) {
            remainingBudget -= cost;
            remainingSlots -= slots;
            plan.push({
              item: cand.item,
              jobName: cand.jobName,
              jobId: cand.jobId,
              userJobLevel: cand.userJobLevel,
              canCraft: cand.canCraftItem,
              isStackable: cand.isStackable,
              craftCostUnit: cand.craftCostUnit,
              salePriceUnit: cand.salePriceUnit,
              saleTaxUnit: cand.saleTaxUnit,
              netProfitUnit: cand.netProfitUnit,
              roiPercent: cand.roiPercent,
              avgDailySales: cand.avgDailySales,
              turnoverRating: cand.turnoverRating,
              turnoverLabel: cand.turnoverLabel,
              hasSalesData: cand.hasSalesData,
              recommendedUnits: units,
              totalCraftCost: cost,
              totalNetProfit: units * cand.netProfitUnit,
              estimatedSlots: slots,
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
        // Si no tiene datos de ventas, aplicamos un límite seguro:
        // 1 unidad si es equipable (para no arriesgar), o 50 unidades si es consumible/recurso
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

      // Calcular unidades a asignar
      let targetUnits = Math.min(maxMarketUnits, maxBudgetUnits, maxAffordableUnits);

      // Si es equipable, limitar además por slots disponibles restantes
      if (!cand.isStackable) {
        targetUnits = Math.min(targetUnits, remainingSlots);
      } else {
        const slotsNeeded = calculateItemSlots(cand.isStackable, targetUnits);
        if (slotsNeeded > remainingSlots) {
          targetUnits = Math.max(1, Math.floor(targetUnits * (remainingSlots / slotsNeeded)));
        }
      }

      if (targetUnits > 0) {
        const cost = targetUnits * cand.craftCostUnit;
        const slots = calculateItemSlots(cand.isStackable, targetUnits);

        remainingBudget -= cost;
        remainingSlots -= slots;

        plan.push({
          item: cand.item,
          jobName: cand.jobName,
          jobId: cand.jobId,
          userJobLevel: cand.userJobLevel,
          canCraft: cand.canCraftItem,
          isStackable: cand.isStackable,
          craftCostUnit: cand.craftCostUnit,
          salePriceUnit: cand.salePriceUnit,
          saleTaxUnit: cand.saleTaxUnit,
          netProfitUnit: cand.netProfitUnit,
          roiPercent: cand.roiPercent,
          avgDailySales: cand.avgDailySales,
          turnoverRating: cand.turnoverRating,
          turnoverLabel: cand.turnoverLabel,
          hasSalesData: cand.hasSalesData,
          recommendedUnits: targetUnits,
          totalCraftCost: cost,
          totalNetProfit: targetUnits * cand.netProfitUnit,
          estimatedSlots: slots,
          canCrush: cand.canCrush,
        });
      }
    }

    return plan;
  }, [
    budget,
    maxHdvSlots,
    candidatePool,
    targetDays,
    maxBudgetShare,
    manualUnitsOverride,
  ]);

  // Resumen de KPIs
  const summary = useMemo(() => {
    const totalCost = plannedCrafts.reduce((acc, curr) => acc + curr.totalCraftCost, 0);
    const totalProfit = plannedCrafts.reduce((acc, curr) => acc + curr.totalNetProfit, 0);
    const totalSlots = plannedCrafts.reduce((acc, curr) => acc + curr.estimatedSlots, 0);
    const totalUnits = plannedCrafts.reduce((acc, curr) => acc + curr.recommendedUnits, 0);
    const overallRoi = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;
    const budgetUsedPercent = budget > 0 ? (totalCost / budget) * 100 : 0;

    return {
      totalCost,
      totalProfit,
      totalSlots,
      totalUnits,
      recipeCount: plannedCrafts.length,
      overallRoi,
      budgetUsedPercent,
      remainingBudget: Math.max(0, budget - totalCost),
    };
  }, [plannedCrafts, budget]);

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
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-inner">
            <Briefcase className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-white tracking-tight">
                Planificador de Crafteo Diario
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-black uppercase tracking-wider">
                Cartera Rentable
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Optimiza qué craftear hoy según tus oficios, presupuesto y absorción de ventas en mercadillo.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <button
            type="button"
            onClick={() => setIsJobsModalOpen(true)}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
            <span>Mis Oficios</span>
          </button>

          {plannedCrafts.length > 0 && (
            <button
              type="button"
              onClick={handleAddAllToShoppingList}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl text-xs transition-all flex items-center gap-2 shadow-lg cursor-pointer"
            >
              {addedAllNotice ? <Check className="w-4 h-4" /> : <ShoppingCart className="w-4 h-4" />}
              <span>{addedAllNotice ? '¡Añadido al Carrito!' : 'Añadir Todo al Carrito'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Controles de Configuración del Plan */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Presupuesto */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-amber-400" />
              Presupuesto de Inversión
            </label>
            <div className="relative">
              <input
                type="text"
                value={budgetInput}
                onChange={(e) => handleBudgetChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2 text-white font-mono font-bold text-sm outline-none transition-all pr-12"
                placeholder="10000000"
              />
              <span className="absolute right-3 top-2.5 text-xs text-amber-400 font-bold font-mono">
                Kamas
              </span>
            </div>
            {/* Presets de presupuesto */}
            <div className="flex flex-wrap gap-1 pt-1">
              {BUDGET_PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => handleApplyPresetBudget(p.value)}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer ${
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
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-indigo-400" />
              Estrategia de Optimización
            </label>
            <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 border border-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => setOptimizationMode('balanced')}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  optimizationMode === 'balanced'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Equilibrio entre ganancia en kamas y velocidad de venta diaria"
              >
                <Flame className="w-3 h-3 text-amber-400" />
                <span>Equilibrio</span>
              </button>

              <button
                type="button"
                onClick={() => setOptimizationMode('max_profit')}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
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
                className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  optimizationMode === 'max_roi'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Maximiza el margen porcentual de retorno sobre la inversión"
              >
                <Sparkles className="w-3 h-3 text-sky-400" />
                <span>Mayor ROI</span>
              </button>
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">
              {optimizationMode === 'balanced' && 'Prioriza objetos rentables que se venden rápido cada día.'}
              {optimizationMode === 'max_profit' && 'Prioriza el retorno bruto más alto en kamas totales.'}
              {optimizationMode === 'max_roi' && 'Prioriza el porcentaje de ganancia sobre los kamas invertidos.'}
            </p>
          </div>

          {/* 3. Absorción y Días de Rotación */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-emerald-400" />
              Horizonte de Ventas (Días)
            </label>
            <div className="grid grid-cols-4 gap-1 bg-slate-950 p-1 border border-slate-800 rounded-xl text-center">
              {[0.5, 1.0, 2.0, 3.0].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setTargetDays(d)}
                  className={`py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                    targetDays === d
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">
              Máx. unidades crafteadas según las ventas de {targetDays} {targetDays === 1 ? 'día' : 'días'}.
            </p>
          </div>

          {/* 4. Límite de Slots HDV y Diversificación */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Store className="w-4 h-4 text-amber-400" />
                Límite Slots HDV
              </label>
              <span className="text-[10px] font-mono text-amber-400 font-bold">
                {maxHdvSlots} / 400
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1 bg-slate-950 p-1 border border-slate-800 rounded-xl text-center">
              {[50, 100, 150, 400].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setMaxHdvSlots(s)}
                  className={`py-1 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer ${
                    maxHdvSlots === s
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {s} slots
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">
              Equipables = 1 slot/u. Consumibles = 1 slot por lote.
            </p>
          </div>
        </div>

        {/* Barra Secundaria de Filtros */}
        <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            {/* Toggle Solo mis oficios */}
            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={onlyMyJobs}
                onChange={(e) => setOnlyMyJobs(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-amber-400/50 cursor-pointer"
              />
              <span className="font-bold text-slate-300 flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-amber-400" />
                Solo oficios que puedo craftear
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
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-md space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span className="flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-amber-400" />
              Capital Invertido
            </span>
            <span className="font-mono font-bold text-amber-300">
              {summary.budgetUsedPercent.toFixed(1)}%
            </span>
          </div>
          <div className="text-lg font-black text-white font-mono">
            <KamaDisplay amount={summary.totalCost} />
          </div>
          {/* Progress bar */}
          <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-500"
              style={{ width: `${Math.min(100, summary.budgetUsedPercent)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>Presupuesto: {budget.toLocaleString('es-ES')} K</span>
            <span>Restante: {summary.remainingBudget.toLocaleString('es-ES')} K</span>
          </div>
        </div>

        {/* KPI 2: Ganancia Neta Estimada */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-md space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span className="flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Ganancia Neta Estimada
            </span>
            <span className="font-mono font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
              +{summary.overallRoi.toFixed(1)}% ROI
            </span>
          </div>
          <div className="text-lg font-black text-emerald-400 font-mono">
            +<KamaDisplay amount={summary.totalProfit} />
          </div>
          <p className="text-[11px] text-slate-400">
            Ya descuenta el 2% de tasa mercadillo HDV.
          </p>
        </div>

        {/* KPI 3: Variedad y Objetos */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-md space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span className="flex items-center gap-1.5">
              <Package className="w-4 h-4 text-sky-400" />
              Volumen de Crafteo
            </span>
            <span className="text-sky-300 font-bold font-mono">
              {summary.recipeCount} recetas distintas
            </span>
          </div>
          <div className="text-lg font-black text-white font-mono">
            {summary.totalUnits} {summary.totalUnits === 1 ? 'unidad' : 'unidades'}
          </div>
          <p className="text-[11px] text-slate-400">
            Diversificación para vender múltiples cosas al día.
          </p>
        </div>

        {/* KPI 4: Slots de Mercadillo */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-md space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span className="flex items-center gap-1.5">
              <Store className="w-4 h-4 text-purple-400" />
              Slots Mercadillo (HDV)
            </span>
            <span className="font-mono font-bold text-purple-300">
              {summary.totalSlots} / {maxHdvSlots}
            </span>
          </div>
          <div className="text-lg font-black text-purple-300 font-mono">
            {summary.totalSlots} slots ocupados
          </div>
          <p className="text-[11px] text-slate-400">
            De un promedio estándar de 400 slots disponibles.
          </p>
        </div>
      </div>

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
              &ldquo;Solo oficios que puedo craftear&rdquo; para ver recetas de mayor nivel.
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
            <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Cartera de Crafteo Recomendada ({plannedCrafts.length} recetas)
            </h2>
            <span className="text-xs text-slate-400">
              Haz clic en <span className="text-rose-400 font-semibold">Descartar</span> para probar otra receta con ese presupuesto.
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {plannedCrafts.map((craft) => {
              const itemName = getItemName(craft.item);
              const isCopied = copiedItemNameId === craft.item.id;

              return (
                <div
                  key={craft.item.id}
                  className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 shadow-md flex flex-col justify-between gap-3 transition-all relative overflow-hidden group"
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

                      {/* HDV Slots info badge */}
                      <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono">
                        <Store className="w-3.5 h-3.5 text-purple-400" />
                        <span>{craft.estimatedSlots} {craft.estimatedSlots === 1 ? 'slot' : 'slots'}</span>
                        {craft.isStackable && (
                          <span className="text-[10px] text-slate-500" title="Se agrupa en lotes (consumible/recurso)">
                            (Lote)
                          </span>
                        )}
                      </div>
                    </div>

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

                    {/* Market Velocity Indicator */}
                    <div className="flex items-center justify-between text-[11px] bg-slate-950/40 px-2.5 py-1.5 rounded-xl border border-slate-800/40">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-400" />
                        Ventas diarias HDV:
                      </span>
                      {craft.hasSalesData && craft.avgDailySales > 0 ? (
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
                      ) : (
                        <span className="text-slate-500 font-medium">
                          Sin histórico (tope seguro 1x)
                        </span>
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
