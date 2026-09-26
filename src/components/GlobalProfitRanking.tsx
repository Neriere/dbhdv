import React, { useState, useEffect, useMemo } from "react";
import {
  Trophy,
  TrendingUp,
  Search,
  DollarSign,
  Wrench,
  ArrowUpRight,
  Zap,
  Tag,
  Check,
  Coins,
  Shield,
  Layers,
  FlaskConical,
  Sword,
  Wand2,
  Gem,
  Footprints,
  Scissors,
  Pickaxe,
  Axe,
  Wheat,
  Drumstick,
  Fish,
  Heart,
  ChevronLeft,
  ChevronRight,
  ShoppingCart,
  Copy,
  Briefcase,
  Activity,
  Clock,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Percent,
} from "lucide-react";
import { useUserJobs } from "../hooks/useUserJobs";
import { MarketPriceMap } from "../types";
import { DOFUS_JOBS, isOmittedItem, isClassItem, isCrushableJob } from "../data/dofusJobs";
import {
  DEFAULT_INGREDIENT_PRICES,
  PresetCraftableItem,
} from "../data/presetCraftableItems";
import {
  getCraftableItemsSnapshot,
  getStoredMarketPrices,
  getStoredPriceUpdatedAt,
  initializeDatabase,
  saveMarketPrice,
  getItemName,
  getItemTypeName,
  getItemIconUrl,
  getItemFallbackIconUrl,
  addToShoppingList,
} from "../services/dofusDbService";
import { calculateItemCrushing } from "../data/dofusRuneWeights";
import { matchesSearchQuery } from "../utils/searchUtils";
import { copyItemNameToClipboard } from "../utils/clipboardUtils";
import { PriceFreshnessBadge } from "./common/PriceFreshnessBadge";
import { useMarketPrices } from "../hooks/useMarketPrices";
import {
  getStoredSalesVolumeMap,
  analyzeSalesVolume,
  fetchAndSyncSalesVolume,
  SalesVolumeMap,
} from "../services/salesVolumeService";
import { getItemMarketCategory, MarketCategory } from "./DailyCraftPlanner";

const JOB_ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  FlaskConical,
  Sword,
  Wand2,
  Gem,
  Footprints,
  Scissors,
  Wrench,
  Shield,
  Pickaxe,
  Axe,
  Wheat,
  Drumstick,
  Fish,
  Heart,
};

export interface CalculatedRecipeRanking {
  item: PresetCraftableItem;
  craftCost: number;
  salePrice: number;
  rawSalePrice: number;
  saleTax: number;
  saleNetProfit: number;
  saleRoiPercent: number;
  canCrush: boolean;
  runicEstimatedValue: number;
  crushNetProfit: number;
  crushRoiPercent: number;
  bestStrategy: "hdv" | "crush" | "none";
  bestNetProfit: number;
  bestRoiPercent: number;
  jobName: string;
  jobId: number;
  marketCategory: MarketCategory | null;
  hasSalesData: boolean;
  sales24h: number;
  sales7d: number;
  sales30d: number;
  avgDailySales: number;
  turnoverRating: "alta" | "media" | "baja" | null;
  turnoverLabel: string | null;
  paybackDays: number | null;
  paybackHours: number | null;
  isOutlierPrice: boolean;
  outlierRatio: number;
  referenceMedian: number | null;
}

interface GlobalProfitRankingProps {
  onSelectRecipeForCalculator: (item: PresetCraftableItem) => void;
  onSelectForCrushing?: (item: PresetCraftableItem) => void;
}

export const GlobalProfitRanking: React.FC<GlobalProfitRankingProps> = ({
  onSelectRecipeForCalculator,
  onSelectForCrushing,
}) => {
  const ITEMS_PER_PAGE = 25;
  const [currentPage, setCurrentPage] = useState<number>(1);

  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedJobId, setSelectedJobId] = useState<number | "all">("all");
  const [strategyFilter, setStrategyFilter] = useState<"all" | "hdv" | "crush" | "profitable">("all");
  const [marketCategoryFilter, setMarketCategoryFilter] = useState<"all" | MarketCategory>("all");
  const [salesLiquidityFilter, setSalesLiquidityFilter] = useState<"all" | "verified" | "medium_high" | "high">("all");
  const [filterOutliers, setFilterOutliers] = useState<boolean>(true);
  const [minProfit, setMinProfit] = useState<number | "">(0);
  const [minRoi, setMinRoi] = useState<number | "">(0);
  const [maxCraftCost, setMaxCraftCost] = useState<number | "">(20000000);
  const [minLevel, setMinLevel] = useState<number | "">(1);
  const [maxLevel, setMaxLevel] = useState<number | "">(200);
  const [sortBy, setSortBy] = useState<
    | "best_profit_desc"
    | "sale_profit_desc"
    | "crush_profit_desc"
    | "best_roi_desc"
    | "cost_asc"
    | "turnover_desc"
    | "fast_payback"
  >("best_profit_desc");

  const [salesVolumeMap, setSalesVolumeMap] = useState<SalesVolumeMap>(() => getStoredSalesVolumeMap());

  const { isEnabled: isUserJobsEnabled, canCraft: canUserCraft } = useUserJobs();

  useEffect(() => {
    fetchAndSyncSalesVolume().then((map) => {
      if (map && Object.keys(map).length > 0) {
        setSalesVolumeMap({ ...map });
      }
    });

    const handleVolumeUpdate = () => {
      setSalesVolumeMap({ ...getStoredSalesVolumeMap() });
    };

    window.addEventListener("dofus_sales_volume_updated", handleVolumeUpdate);
    window.addEventListener("dofus_database_updated", handleVolumeUpdate);

    return () => {
      window.removeEventListener("dofus_sales_volume_updated", handleVolumeUpdate);
      window.removeEventListener("dofus_database_updated", handleVolumeUpdate);
    };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    selectedJobId,
    strategyFilter,
    marketCategoryFilter,
    salesLiquidityFilter,
    filterOutliers,
    searchTerm,
    minLevel,
    maxLevel,
    minProfit,
    minRoi,
    maxCraftCost,
    sortBy,
    isUserJobsEnabled,
  ]);

  const hasActiveFilters = useMemo(() => {
    return (
      selectedJobId !== "all" ||
      strategyFilter !== "all" ||
      marketCategoryFilter !== "all" ||
      salesLiquidityFilter !== "all" ||
      !filterOutliers ||
      searchTerm.trim() !== "" ||
      minLevel !== 1 ||
      maxLevel !== 200 ||
      (minProfit !== "" && minProfit !== 0) ||
      (minRoi !== "" && minRoi !== 0) ||
      (maxCraftCost !== "" && maxCraftCost !== 20000000) ||
      sortBy !== "best_profit_desc"
    );
  }, [
    selectedJobId,
    strategyFilter,
    marketCategoryFilter,
    salesLiquidityFilter,
    filterOutliers,
    searchTerm,
    minLevel,
    maxLevel,
    minProfit,
    minRoi,
    maxCraftCost,
    sortBy,
  ]);

  const handleResetFilters = () => {
    setSelectedJobId("all");
    setStrategyFilter("all");
    setMarketCategoryFilter("all");
    setSalesLiquidityFilter("all");
    setFilterOutliers(true);
    setSearchTerm("");
    setMinLevel(1);
    setMaxLevel(200);
    setMinProfit(0);
    setMinRoi(0);
    setMaxCraftCost(20000000);
    setSortBy("best_profit_desc");
  };

  const { marketPrices: basePrices, priceUpdatedAt, activeProfileId, updatePrice } = useMarketPrices();
  const marketPrices = useMemo(
    () => ({ ...DEFAULT_INGREDIENT_PRICES, ...basePrices }),
    [basePrices]
  );
  const [priceDrafts, setPriceDrafts] = useState<Record<number, string>>({});
  const [savedFeedbackItemId, setSavedFeedbackItemId] = useState<number | null>(null);
  const [addedCartItemId, setAddedCartItemId] = useState<number | null>(null);

  const handlePriceSave = (itemId: number, newPrice: number) => {
    updatePrice(itemId, newPrice)
      .then(() => {
        setSavedFeedbackItemId(itemId);
        setTimeout(() => setSavedFeedbackItemId(null), 1500);
      })
      .catch((error) => {
        console.error(`Error guardando precio ${itemId}:`, error);
      });
  };

  const handleAddToCart = (item: PresetCraftableItem) => {
    addToShoppingList(item, 1);
    setAddedCartItemId(item.id);
    setTimeout(() => setAddedCartItemId(null), 1800);
  };

  const allCraftableItems: PresetCraftableItem[] = useMemo(() => {
    const raw = getCraftableItemsSnapshot() as PresetCraftableItem[];
    return raw.filter((item) => !isOmittedItem(item) && !isClassItem(item));
  }, [activeProfileId]);

  const rankedItems: CalculatedRecipeRanking[] = useMemo(() => {
    const results: CalculatedRecipeRanking[] = [];

    for (const item of allCraftableItems) {
      if (!item.recipeData || !item.recipeData.ingredientIds || item.recipeData.ingredientIds.length === 0) {
        continue;
      }

      // STRICT FILTER: Only show items that have 100% of their ingredients with a price entered (> 0)
      const allIngredientsPriced = item.recipeData.ingredientIds.every(
        (ingId) => (marketPrices[ingId] || 0) > 0
      );

      if (!allIngredientsPriced) {
        continue;
      }

      let craftCost = 0;
      item.recipeData.ingredientIds.forEach((ingId, idx) => {
        const qty = item.recipeData.quantities[idx] || 1;
        const ingPrice = marketPrices[ingId] || 0;
        craftCost += ingPrice * qty;
      });

      const rawSalePrice = marketPrices[item.id] || 0;

      // Análisis de volumen de ventas
      const vol = salesVolumeMap[item.id];
      const salesAnalysis = analyzeSalesVolume(rawSalePrice, vol);
      const hasVerifiedSales = salesAnalysis.hasData && salesAnalysis.avgDailySales > 0;

      // Verificación de precios inflados / exomagueos (antifraude)
      const median7d = vol?.median7d;
      const median30d = vol?.median30d;
      const suggestedPrice = vol?.suggestedPrice;
      const referenceMedian =
        median7d && median7d > 0
          ? median7d
          : median30d && median30d > 0
          ? median30d
          : suggestedPrice && suggestedPrice > 0
          ? suggestedPrice
          : null;

      let isOutlierPrice = false;
      let outlierRatio = 1;
      let effectiveSalePrice = rawSalePrice;

      if (referenceMedian && referenceMedian > 0 && rawSalePrice > 0) {
        outlierRatio = rawSalePrice / referenceMedian;
        if (outlierRatio > 1.45) {
          isOutlierPrice = true;
          // Si la protección antifraude está activa, usar la mediana histórica real
          if (filterOutliers) {
            effectiveSalePrice = Math.round(referenceMedian);
          }
        }
      }

      const salePrice = effectiveSalePrice;
      const saleTax = salePrice > 0 ? Math.ceil(salePrice * 0.02) : 0;
      const saleNetProfit = salePrice > 0 ? salePrice - saleTax - craftCost : -craftCost;
      const saleRoiPercent = craftCost > 0 && salePrice > 0 ? (saleNetProfit / craftCost) * 100 : 0;

      const canCrush = isCrushableJob(item.jobId) && Array.isArray(item.possibleEffects) && item.possibleEffects.length > 0;
      let runicEstimatedValue = 0;
      if (canCrush) {
        const crushResult = calculateItemCrushing(item, 100, null, marketPrices, craftCost);
        runicEstimatedValue = crushResult.totalKamasValue;
      }
      const crushNetProfit = runicEstimatedValue > 0 ? runicEstimatedValue - craftCost : -craftCost;
      const crushRoiPercent = craftCost > 0 && runicEstimatedValue > 0 ? (crushNetProfit / craftCost) * 100 : 0;

      let bestStrategy: "hdv" | "crush" | "none" = "none";
      let bestNetProfit = Math.max(saleNetProfit, crushNetProfit);
      let bestRoiPercent = saleNetProfit >= crushNetProfit ? saleRoiPercent : crushRoiPercent;

      if (saleNetProfit > 0 || crushNetProfit > 0) {
        bestStrategy = saleNetProfit >= crushNetProfit ? "hdv" : "crush";
      }

      // Tiempo de recuperación de capital (Payback / Cashflow)
      const dailySpeed = hasVerifiedSales ? salesAnalysis.avgDailySales : 0.05;
      const dailyRevenue = dailySpeed * (salePrice - saleTax);
      const paybackDays = (dailyRevenue > 0 && craftCost > 0) ? (craftCost / dailyRevenue) : null;
      const paybackHours = paybackDays !== null ? Math.round(paybackDays * 24) : null;

      const marketCategory = getItemMarketCategory(item);

      results.push({
        item,
        craftCost,
        salePrice,
        rawSalePrice,
        saleTax,
        saleNetProfit,
        saleRoiPercent,
        canCrush,
        runicEstimatedValue,
        crushNetProfit,
        crushRoiPercent,
        bestStrategy,
        bestNetProfit,
        bestRoiPercent,
        jobName: item.jobNameEs,
        jobId: item.jobId,
        marketCategory,
        hasSalesData: salesAnalysis.hasData,
        sales24h: salesAnalysis.sales24h,
        sales7d: salesAnalysis.sales7d,
        sales30d: salesAnalysis.sales30d,
        avgDailySales: salesAnalysis.avgDailySales,
        turnoverRating: salesAnalysis.turnoverRating,
        turnoverLabel: salesAnalysis.turnoverLabel,
        paybackDays,
        paybackHours,
        isOutlierPrice,
        outlierRatio,
        referenceMedian,
      });
    }

    return results;
  }, [allCraftableItems, marketPrices, salesVolumeMap, filterOutliers]);

  const filteredRankings = useMemo(() => {
    const effMinLevel = minLevel === "" ? 1 : Number(minLevel);
    const effMaxLevel = maxLevel === "" ? 200 : Number(maxLevel);
    const effMinProfit = minProfit === "" ? 0 : Number(minProfit);
    const effMinRoi = minRoi === "" ? 0 : Number(minRoi);
    const effMaxCraftCost = maxCraftCost === "" ? Infinity : Number(maxCraftCost);

    return rankedItems
      .filter((entry) => {
        if (selectedJobId !== "all" && entry.jobId !== selectedJobId) return false;
        if (isUserJobsEnabled && !canUserCraft(entry.item)) return false;
        if (entry.item.level < effMinLevel || entry.item.level > effMaxLevel) return false;
        if (entry.craftCost > effMaxCraftCost) return false;

        // Filtro por Canal de Mercadillo (Equipamiento, Consumibles, Recursos)
        if (marketCategoryFilter !== "all" && entry.marketCategory !== marketCategoryFilter) return false;

        // Filtro de Liquidez / Historial de Ventas
        if (salesLiquidityFilter === "verified" && (!entry.hasSalesData || entry.avgDailySales <= 0)) {
          return false;
        }
        if (salesLiquidityFilter === "medium_high" && (!entry.hasSalesData || entry.avgDailySales < 0.5)) {
          return false;
        }
        if (salesLiquidityFilter === "high" && (!entry.hasSalesData || entry.avgDailySales < 2.0)) {
          return false;
        }

        if (strategyFilter === "profitable" && entry.bestNetProfit <= 0) return false;
        if (strategyFilter === "hdv" && (entry.saleNetProfit <= 0 || entry.salePrice <= 0)) return false;
        if (strategyFilter === "crush" && (entry.crushNetProfit <= 0 || !entry.canCrush)) return false;

        if (entry.bestNetProfit < effMinProfit) return false;
        if (effMinRoi > 0 && entry.bestRoiPercent < effMinRoi) return false;

        if (searchTerm.trim()) {
          if (
            !matchesSearchQuery(
              [
                getItemName(entry.item),
                getItemTypeName(entry.item),
                entry.jobName,
                entry.item.id,
              ],
              searchTerm,
            )
          ) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "best_profit_desc") return b.bestNetProfit - a.bestNetProfit;
        if (sortBy === "sale_profit_desc") return b.saleNetProfit - a.saleNetProfit;
        if (sortBy === "crush_profit_desc") return b.crushNetProfit - a.crushNetProfit;
        if (sortBy === "best_roi_desc") return b.bestRoiPercent - a.bestRoiPercent;
        if (sortBy === "cost_asc") return a.craftCost - b.craftCost;
        if (sortBy === "turnover_desc") return (b.avgDailySales || 0) - (a.avgDailySales || 0);
        if (sortBy === "fast_payback") {
          const pa = a.paybackDays !== null && a.paybackDays > 0 ? a.paybackDays : 999999;
          const pb = b.paybackDays !== null && b.paybackDays > 0 ? b.paybackDays : 999999;
          return pa - pb;
        }
        return 0;
      });
  }, [
    rankedItems,
    selectedJobId,
    strategyFilter,
    marketCategoryFilter,
    salesLiquidityFilter,
    minLevel,
    maxLevel,
    minProfit,
    minRoi,
    maxCraftCost,
    searchTerm,
    sortBy,
    isUserJobsEnabled,
    canUserCraft,
  ]);

  const totalPages = Math.ceil(filteredRankings.length / ITEMS_PER_PAGE) || 1;
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedRankings = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
    return filteredRankings.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredRankings, safeCurrentPage]);

  return (
    <div className="space-y-4">
      {/* User Jobs Global Filter Notice */}
      {isUserJobsEnabled && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs shadow-sm animate-fade-in">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
              <Briefcase className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <span className="truncate">
              <strong>Filtro global de oficios activo:</strong> El ranking solo incluye recetas que tu personaje puede craftear según tus niveles de oficio.
            </span>
          </div>
          <span className="text-[11px] font-mono text-emerald-400/80 shrink-0 font-bold">
            {filteredRankings.length} recetas en ranking
          </span>
        </div>
      )}

      {/* Job Selection Cards */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 shadow-lg space-y-2">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          <button
            onClick={() => setSelectedJobId("all")}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
              selectedJobId === "all"
                ? "bg-amber-500 text-slate-950 shadow-md font-black"
                : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Todos ({DOFUS_JOBS.length})</span>
          </button>

          {DOFUS_JOBS.map((job) => {
            const isSelected = selectedJobId === job.id;
            const JobIcon = JOB_ICON_MAP[job.icon] || Wrench;
            return (
              <button
                key={job.id}
                onClick={() => setSelectedJobId(job.id)}
                className={`px-2.5 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
                  isSelected
                    ? "bg-amber-500 text-slate-950 shadow-md font-black"
                    : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                }`}
              >
                <JobIcon className="w-3.5 h-3.5" />
                <span>{job.nameEs}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                Ranking de Rentabilidad
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold border border-emerald-500/30">
                  {filteredRankings.length}
                </span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
            <button
              onClick={() => setStrategyFilter("all")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                strategyFilter === "all"
                  ? "bg-amber-500 text-slate-950 font-black"
                  : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setStrategyFilter("profitable")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                strategyFilter === "profitable"
                  ? "bg-emerald-500 text-slate-950 font-black"
                  : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
              }`}
            >
              Rentables (&gt;0 K)
            </button>
            <button
              onClick={() => setStrategyFilter("hdv")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                strategyFilter === "hdv"
                  ? "bg-sky-500 text-slate-950 font-black"
                  : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
              }`}
            >
              Venta HDV
            </button>
            <button
              onClick={() => setStrategyFilter("crush")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                strategyFilter === "crush"
                  ? "bg-purple-500 text-slate-950 font-black"
                  : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
              }`}
            >
              Runas
            </button>
          </div>
        </div>

        {/* Channel & Antifraud Sub-bar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pb-1">
          {/* Mercadillo Channel Tabs */}
          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Canal HDV:</span>
            <button
              onClick={() => setMarketCategoryFilter("all")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                marketCategoryFilter === "all"
                  ? "bg-amber-500 text-slate-950 font-black shadow-sm"
                  : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
              }`}
            >
              Todos HDVs
            </button>
            <button
              onClick={() => setMarketCategoryFilter("equipment")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                marketCategoryFilter === "equipment"
                  ? "bg-sky-500 text-slate-950 font-black shadow-sm"
                  : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
              }`}
            >
              Equipamiento
            </button>
            <button
              onClick={() => setMarketCategoryFilter("consumables")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                marketCategoryFilter === "consumables"
                  ? "bg-emerald-500 text-slate-950 font-black shadow-sm"
                  : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
              }`}
            >
              Consumibles
            </button>
            <button
              onClick={() => setMarketCategoryFilter("resources")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                marketCategoryFilter === "resources"
                  ? "bg-amber-600 text-slate-950 font-black shadow-sm"
                  : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
              }`}
            >
              Recursos
            </button>
          </div>

          {/* Antifraud & Reset Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFilterOutliers(!filterOutliers)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border ${
                filterOutliers
                  ? "bg-emerald-950/60 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900/50"
                  : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
              }`}
              title={
                filterOutliers
                  ? "Antifraude ACTIVO: Precios de venta inflados (>45% s/ mediana 7d/30d) se ajustan automáticamente a la mediana real para evitar ganancias irreales de exomagueos."
                  : "Antifraude INACTIVO: Se utiliza el precio bruto registrado sin verificar anomalías."
              }
            >
              <ShieldCheck className={`w-3.5 h-3.5 ${filterOutliers ? "text-emerald-400" : "text-slate-500"}`} />
              <span>Antifraude: {filterOutliers ? "ON" : "OFF"}</span>
            </button>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-2.5 py-1 rounded-lg text-xs font-bold text-slate-400 hover:text-rose-400 bg-slate-950 border border-slate-800 hover:border-rose-500/30 transition-all flex items-center gap-1"
                title="Restablecer todos los filtros a sus valores predeterminados"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restablecer</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Controls Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2.5 text-xs">
          <div>
            <label className="block text-slate-400 font-bold mb-1 flex items-center gap-1">
              <Tag className="w-3.5 h-3.5 text-amber-400" />
              Nivel
            </label>
            <select
              value={`${minLevel}-${maxLevel}`}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "all") {
                  setMinLevel(1);
                  setMaxLevel(200);
                } else {
                  const [min, max] = val.split("-").map(Number);
                  setMinLevel(min);
                  setMaxLevel(max);
                }
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-200 font-bold focus:border-amber-500 focus:outline-none"
            >
              <option value="all">Todos (1-200)</option>
              <option value="1-50">1 - 50</option>
              <option value="51-100">51 - 100</option>
              <option value="101-150">101 - 150</option>
              <option value="151-200">151 - 200</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 font-bold mb-1 flex items-center gap-1">
              <Search className="w-3.5 h-3.5 text-amber-400" />
              Buscar
            </label>
            <input
              type="text"
              placeholder="Nombre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none font-medium"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-bold mb-1 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              Ordenar
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-200 font-bold focus:border-amber-500 focus:outline-none"
            >
              <option value="best_profit_desc">Mayor Ganancia</option>
              <option value="sale_profit_desc">Mayor Ganancia HDV</option>
              <option value="crush_profit_desc">Mayor Ganancia Runas</option>
              <option value="best_roi_desc">Mayor ROI (%)</option>
              <option value="turnover_desc">Mayor Rotación (Ventas/Día)</option>
              <option value="fast_payback">Retorno Rápido (Payback)</option>
              <option value="cost_asc">Menor Costo</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 font-bold mb-1 flex items-center gap-1">
              <Percent className="w-3.5 h-3.5 text-emerald-400" />
              ROI Mínimo
            </label>
            <select
              value={minRoi === "" ? 0 : minRoi}
              onChange={(e) => {
                const val = Number(e.target.value);
                setMinRoi(val);
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-200 font-bold focus:border-amber-500 focus:outline-none font-mono"
            >
              <option value="0">Todos (0%+)</option>
              <option value="15">≥ 15% ROI</option>
              <option value="30">≥ 30% ROI</option>
              <option value="50">≥ 50% ROI</option>
              <option value="100">≥ 100% ROI</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 font-bold mb-1 flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-sky-400" />
              Liquidez / Ventas
            </label>
            <select
              value={salesLiquidityFilter}
              onChange={(e) => setSalesLiquidityFilter(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-200 font-bold focus:border-amber-500 focus:outline-none"
            >
              <option value="all">Todas las recetas</option>
              <option value="verified">Ventas verificadas (&gt;0/d)</option>
              <option value="medium_high">Rotación Media/Alta (≥0.5/d)</option>
              <option value="high">Alta Rotación (≥2/d)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 font-bold mb-1 flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              Ganancia Mín.
            </label>
            <input
              type="number"
              value={minProfit}
              onChange={(e) => {
                const val = e.target.value;
                setMinProfit(val === "" ? "" : Number(val));
              }}
              step={5000}
              placeholder="0 K"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-100 font-mono font-bold focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-bold mb-1 flex items-center gap-1">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              Presupuesto Máx.
            </label>
            <input
              type="number"
              value={maxCraftCost}
              onChange={(e) => {
                const val = e.target.value;
                setMaxCraftCost(val === "" ? "" : Number(val));
              }}
              step={50000}
              placeholder="Sin límite"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-100 font-mono font-bold focus:border-amber-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Global Profit Rankings Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        {filteredRankings.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Trophy className="w-12 h-12 mx-auto text-slate-600 opacity-40" />
            <p className="text-sm font-bold text-slate-300">
              No se encontraron recetas con 100% de ingredientes costeados.
            </p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Solo se listan recetas donde todos sus ingredientes tienen un precio mayor a 0 K ingresado en el Gestor de Precios o en sus fichas.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase font-mono tracking-wider text-xs">
                <tr>
                  <th className="py-3 px-3 w-12 text-center font-bold">#</th>
                  <th className="py-3 px-4 min-w-[260px] font-bold">Objeto y Oficio</th>
                  <th className="py-3 px-4 text-right w-36 sm:w-44 font-bold">Costo Crafteo</th>
                  <th className="py-3 px-4 text-right w-44 sm:w-52 font-bold">Venta HDV</th>
                  <th className="py-3 px-4 text-right w-36 sm:w-44 font-bold">Valor Runas</th>
                  <th className="py-3 px-4 text-center w-40 sm:w-48 font-bold">Mejor Ganancia</th>
                  <th className="py-3 px-4 text-center w-36 font-bold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans text-xs sm:text-sm">
                {paginatedRankings.map((entry, idx) => {
                  const absoluteIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE + idx;
                  const rank = absoluteIndex + 1;
                  const item = entry.item;
                  const itemName = getItemName(item);
                  const iconUrl = getItemIconUrl(item);
                  const fallbackIcon = getItemFallbackIconUrl(item);

                  const JobIcon =
                    JOB_ICON_MAP[
                      DOFUS_JOBS.find((j) => j.id === item.jobId)?.icon ||
                        "Wrench"
                    ] || Wrench;

                  const isSaved = savedFeedbackItemId === item.id;
                  const isAddedCart = addedCartItemId === item.id;

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* Rank badge */}
                      <td className="py-3.5 px-3 text-center font-mono font-bold">
                        {rank === 1 && (
                          <span className="w-7 h-7 mx-auto rounded-full bg-amber-500 text-slate-950 flex items-center justify-center font-black text-xs shadow-md">
                            1
                          </span>
                        )}
                        {rank === 2 && (
                          <span className="w-7 h-7 mx-auto rounded-full bg-slate-300 text-slate-950 flex items-center justify-center font-black text-xs shadow-md">
                            2
                          </span>
                        )}
                        {rank === 3 && (
                          <span className="w-7 h-7 mx-auto rounded-full bg-amber-700 text-white flex items-center justify-center font-black text-xs shadow-md">
                            3
                          </span>
                        )}
                        {rank > 3 && (
                          <span className="text-slate-500 font-mono text-xs font-semibold">
                            #{rank}
                          </span>
                        )}
                      </td>

                      {/* Item Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl bg-slate-950 border border-slate-800 p-1 flex items-center justify-center shrink-0 shadow-inner group-hover:border-amber-500/40 transition-colors">
                            <img
                              src={iconUrl}
                              alt={itemName}
                              className="w-9 h-9 object-contain"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = fallbackIcon;
                              }}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-white text-sm group-hover:text-amber-400 transition-colors leading-snug">
                                {itemName}
                              </span>
                              <button
                                type="button"
                                onClick={() => copyItemNameToClipboard(itemName)}
                                className="p-1 rounded hover:bg-amber-500/20 text-slate-400 hover:text-amber-300 transition-colors cursor-pointer shrink-0"
                                title="Copiar nombre para buscar en Dofus (Ctrl+V)"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                              <span className="text-[11px] font-mono font-bold text-amber-300 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/25 shrink-0">
                                Niv. {item.level}
                              </span>
                            </div>
                            <div className="text-xs font-medium text-slate-400 flex items-center gap-2 mt-1 flex-wrap">
                              <div className="flex items-center gap-1 shrink-0">
                                <JobIcon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                <span>{entry.jobName}</span>
                              </div>

                              {/* Canal de Mercadillo */}
                              {entry.marketCategory && (
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0 ${
                                  entry.marketCategory === 'equipment'
                                    ? 'bg-sky-500/10 text-sky-400 border-sky-500/25'
                                    : entry.marketCategory === 'consumables'
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                                    : 'bg-amber-500/10 text-amber-400 border-amber-500/25'
                                }`}>
                                  {entry.marketCategory === 'equipment' ? 'HDV Equipos' : entry.marketCategory === 'consumables' ? 'HDV Consumibles' : 'HDV Recursos'}
                                </span>
                              )}

                              {/* Indicador de Liquidez / Ventas */}
                              {entry.hasSalesData && entry.avgDailySales > 0 ? (
                                <span
                                  className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border flex items-center gap-1 shrink-0 ${
                                    entry.avgDailySales >= 2
                                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                      : entry.avgDailySales >= 0.5
                                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                      : 'bg-slate-800 text-slate-400 border-slate-700'
                                  }`}
                                  title={`Estimación: ~${entry.avgDailySales.toFixed(1)} ventas/día (24h: ${entry.sales24h || 0}, 7d: ${entry.sales7d || 0}, 30d: ${entry.sales30d || 0})`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${
                                    entry.avgDailySales >= 2 ? 'bg-emerald-400 animate-pulse' : entry.avgDailySales >= 0.5 ? 'bg-amber-400' : 'bg-slate-400'
                                  }`} />
                                  ~{entry.avgDailySales < 1 ? entry.avgDailySales.toFixed(2) : entry.avgDailySales.toFixed(1)} uds/día
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-500 font-mono shrink-0">
                                  Sin ventas reg.
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Craft Cost */}
                      <td className="py-3.5 px-4 text-right font-mono font-black text-sm text-slate-200">
                        {entry.craftCost.toLocaleString()} K
                      </td>

                      {/* Sale Price (HDV) */}
                      <td className="py-3.5 px-4 text-right font-mono">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <input
                            type="number"
                            value={
                              priceDrafts[item.id] !== undefined
                                ? priceDrafts[item.id]
                                : entry.rawSalePrice > 0
                                  ? entry.rawSalePrice
                                  : ""
                            }
                            onChange={(e) =>
                              setPriceDrafts({
                                ...priceDrafts,
                                [item.id]: e.target.value,
                              })
                            }
                            onBlur={() => {
                              const val = priceDrafts[item.id];
                              if (val === undefined) return;
                              if (val === "") {
                                handlePriceSave(item.id, 0);
                              } else {
                                const parsed = Number(val);
                                if (!isNaN(parsed) && parsed >= 0) {
                                  handlePriceSave(item.id, parsed);
                                }
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const val = priceDrafts[item.id];
                                if (val === undefined) return;
                                if (val === "") {
                                  handlePriceSave(item.id, 0);
                                } else {
                                  const parsed = Number(val);
                                  if (!isNaN(parsed) && parsed >= 0) {
                                    handlePriceSave(item.id, parsed);
                                  }
                                }
                              }
                            }}
                            placeholder="0"
                            className="w-28 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-right font-mono text-xs font-bold text-amber-300 focus:border-amber-400 focus:outline-none transition-colors"
                          />
                          {isSaved && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                        </div>
                        <div className="flex items-center justify-end gap-1.5 mt-1 flex-wrap">
                          {entry.salePrice > 0 ? (
                            <span className={entry.saleNetProfit >= 0 ? "text-emerald-400 font-bold text-xs" : "text-rose-400 font-bold text-xs"}>
                              {entry.saleNetProfit >= 0 ? "+" : ""}{entry.saleNetProfit.toLocaleString()} K
                            </span>
                          ) : (
                            <span className="text-slate-600 font-mono text-xs">Sin precio HDV</span>
                          )}
                          <PriceFreshnessBadge updatedAt={priceUpdatedAt[item.id]} compact />
                        </div>

                        {/* Payback or Antifraud Outlier Badges */}
                        {(entry.isOutlierPrice || entry.paybackHours !== null) && (
                          <div className="flex items-center justify-end gap-1 mt-1 flex-wrap text-[10px] font-mono">
                            {entry.isOutlierPrice && (
                              <span
                                className={`px-1.5 py-0.5 rounded border flex items-center gap-1 ${
                                  filterOutliers
                                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                    : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                                }`}
                                title={`Precio en HDV: ${entry.rawSalePrice.toLocaleString()} K. Mediana de referencia: ${entry.referenceMedian?.toLocaleString()} K (+${Math.round((entry.outlierRatio - 1) * 100)}%). ${filterOutliers ? 'Se calculó la ganancia con la mediana segura.' : 'Precio inflado detectado.'}`}
                              >
                                <ShieldCheck className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                                {filterOutliers ? 'Mediana protegida' : `+${Math.round((entry.outlierRatio - 1) * 100)}% s/mediana`}
                              </span>
                            )}
                            {entry.paybackHours !== null && entry.saleNetProfit > 0 && (
                              <span
                                className="text-slate-400 bg-slate-950/80 px-1.5 py-0.5 rounded border border-slate-800 flex items-center gap-1"
                                title={`Tiempo estimado de recuperación de capital: ~${entry.paybackHours} horas de ventas`}
                              >
                                <Clock className="w-2.5 h-2.5 text-sky-400 shrink-0" />
                                {entry.paybackHours < 48 ? `~${entry.paybackHours}h retorno` : `~${Math.round(entry.paybackDays!)}d retorno`}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Runes Value */}
                      <td className="py-3.5 px-4 text-right font-mono">
                        {entry.canCrush ? (
                          <>
                            <span className="text-slate-200 font-bold text-sm block">
                              {entry.runicEstimatedValue.toLocaleString()} K
                            </span>
                            <span className={entry.crushNetProfit >= 0 ? "text-purple-400 font-bold text-xs" : "text-rose-400 font-bold text-xs"}>
                              {entry.crushNetProfit >= 0 ? "+" : ""}{entry.crushNetProfit.toLocaleString()} K
                            </span>
                          </>
                        ) : (
                          <span className="text-slate-600 text-xs">No rompible</span>
                        )}
                      </td>

                      {/* Best Net Profit */}
                      <td className="py-3.5 px-4 text-center font-mono">
                        <div className={`font-black text-sm sm:text-base ${entry.bestNetProfit > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {entry.bestNetProfit > 0 ? "+" : ""}{entry.bestNetProfit.toLocaleString()} K
                        </div>
                        {entry.bestStrategy !== "none" && (
                          <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold border mt-1 ${
                            entry.bestStrategy === "hdv"
                              ? "bg-sky-500/20 text-sky-300 border-sky-500/40"
                              : "bg-purple-500/20 text-purple-300 border-purple-500/40"
                          }`}>
                            {entry.bestStrategy === "hdv" ? "Venta HDV" : "Machacado"} ({entry.bestRoiPercent > 0 ? "+" : ""}{entry.bestRoiPercent.toFixed(0)}%)
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => onSelectRecipeForCalculator(item)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-amber-500 hover:text-slate-950 border border-slate-800 text-slate-200 font-bold text-xs transition-all flex items-center gap-1 shadow-sm"
                            title="Ver calculadora de crafteo"
                          >
                            <span>Crafteo</span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </button>

                          {entry.canCrush && onSelectForCrushing && (
                            <button
                              onClick={() => onSelectForCrushing(item)}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-purple-500/20 border border-slate-800 hover:border-purple-500/40 text-purple-300 font-bold text-xs transition-all flex items-center gap-1 shadow-sm"
                              title="Romper en la Rompedora"
                            >
                              <Zap className="w-3.5 h-3.5 text-purple-400" />
                              <span>Romper</span>
                            </button>
                          )}

                          <button
                            onClick={() => handleAddToCart(item)}
                            className="p-1.5 rounded-lg bg-slate-950 hover:bg-emerald-500/20 border border-slate-800 hover:border-emerald-500/40 text-emerald-300 transition-all shadow-sm"
                            title="Añadir ingredientes a lista de compras"
                          >
                            {isAddedCart ? <Check className="w-4 h-4 text-emerald-400" /> : <ShoppingCart className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {filteredRankings.length > 0 && (
          <div className="bg-slate-950 border-t border-slate-800 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="text-slate-400 font-mono">
              Mostrando{" "}
              <strong className="text-white">
                {(safeCurrentPage - 1) * ITEMS_PER_PAGE + 1}
              </strong>{" "}
              a{" "}
              <strong className="text-white">
                {Math.min(
                  safeCurrentPage * ITEMS_PER_PAGE,
                  filteredRankings.length,
                )}
              </strong>{" "}
              de <strong className="text-amber-400">{filteredRankings.length}</strong>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                disabled={safeCurrentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500/50 disabled:opacity-40 text-slate-300 font-bold flex items-center gap-1 transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Atrás</span>
              </button>

              <div className="flex items-center gap-1 font-mono px-2">
                <span className="text-amber-400 font-bold">
                  {safeCurrentPage}
                </span>
                <span className="text-slate-600">/</span>
                <span className="text-slate-400">{totalPages}</span>
              </div>

              <button
                disabled={safeCurrentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500/50 disabled:opacity-40 text-slate-300 font-bold flex items-center gap-1 transition-all"
              >
                <span>Siguiente</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
