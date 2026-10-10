import { useState, useEffect, useMemo } from "react";
import { useUserJobs } from "../../hooks/useUserJobs";
import { useMarketPrices } from "../../hooks/useMarketPrices";
import { isOmittedItem, isClassItem, isCrushableJob } from "../../data/dofusJobs";
import {
  DEFAULT_INGREDIENT_PRICES,
  PresetCraftableItem,
} from "../../data/presetCraftableItems";
import {
  getCraftableItemsSnapshot,
  getItemName,
  getItemTypeName,
  addToShoppingList,
} from "../../services/dofusDbService";
import { calculateItemCrushing } from "../../data/dofusRuneWeights";
import { matchesSearchQuery } from "../../utils/searchUtils";
import {
  getStoredSalesVolumeMap,
  analyzeSalesVolume,
  fetchAndSyncSalesVolume,
  SalesVolumeMap,
} from "../../services/salesVolumeService";
import { getItemMarketCategory, MarketCategory } from "../DailyCraftPlanner";
import {
  CalculatedRecipeRanking,
  StrategyFilter,
  SalesLiquidityFilter,
  SortByOption,
} from "./types";

export const ITEMS_PER_PAGE = 25;

export const useGlobalProfitRanking = () => {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedJobId, setSelectedJobId] = useState<number | "all">("all");
  const [strategyFilter, setStrategyFilter] = useState<StrategyFilter>("all");
  const [marketCategoryFilter, setMarketCategoryFilter] = useState<"all" | MarketCategory>("all");
  const [salesLiquidityFilter, setSalesLiquidityFilter] = useState<SalesLiquidityFilter>("all");
  const [filterOutliers, setFilterOutliers] = useState<boolean>(true);
  const [minProfit, setMinProfit] = useState<number | "">(0);
  const [minRoi, setMinRoi] = useState<number | "">(0);
  const [maxCraftCost, setMaxCraftCost] = useState<number | "">(20000000);
  const [minLevel, setMinLevel] = useState<number | "">(1);
  const [maxLevel, setMaxLevel] = useState<number | "">(200);
  const [sortBy, setSortBy] = useState<SortByOption>("best_profit_desc");

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

  return {
    currentPage: safeCurrentPage,
    setCurrentPage,
    totalPages,
    searchTerm,
    setSearchTerm,
    selectedJobId,
    setSelectedJobId,
    strategyFilter,
    setStrategyFilter,
    marketCategoryFilter,
    setMarketCategoryFilter,
    salesLiquidityFilter,
    setSalesLiquidityFilter,
    filterOutliers,
    setFilterOutliers,
    minProfit,
    setMinProfit,
    minRoi,
    setMinRoi,
    maxCraftCost,
    setMaxCraftCost,
    minLevel,
    setMinLevel,
    maxLevel,
    setMaxLevel,
    sortBy,
    setSortBy,
    hasActiveFilters,
    handleResetFilters,
    filteredRankings,
    paginatedRankings,
    isUserJobsEnabled,
    priceDrafts,
    setPriceDrafts,
    priceUpdatedAt,
    savedFeedbackItemId,
    addedCartItemId,
    handlePriceSave,
    handleAddToCart,
  };
};
