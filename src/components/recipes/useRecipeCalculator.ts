import { useState, useEffect, useMemo } from 'react';
import { DofusItem, RecipeTreeNode } from '../../types';
import { isOmittedItem, isClassItem } from '../../data/dofusJobs';
import {
  PRESET_CRAFTABLE_ITEMS,
  DEFAULT_INGREDIENT_PRICES,
  PresetCraftableItem,
} from '../../data/presetCraftableItems';
import {
  getCraftableItemsSnapshot,
  buildRecipeTree,
  calculateTreeCraftCost,
  getItemName,
  getItemTypeName,
  resolveMissingItemNamesInBatch,
  triggerLivePriceSync,
  clearRecipeTreeCache,
} from '../../services/dofusDbService';
import {
  analyzeSalesVolume,
  getStoredSalesVolumeMap,
  ItemSalesVolume,
} from '../../services/salesVolumeService';
import { matchesSearchQuery } from '../../utils/searchUtils';
import { useMarketPrices } from '../../hooks/useMarketPrices';
import { useUserJobs } from '../../hooks/useUserJobs';
import {
  isBycResource,
  getOptimizedIngredientCost,
  getStoredBycMethods,
  saveStoredBycMethod,
} from '../../services/bycCostService';
import { ItemMetrics } from './types';

export function useRecipeCalculator(initialSelectedItem?: DofusItem | null) {
  const [isDetailView, setIsDetailView] = useState<boolean>(
    Boolean(initialSelectedItem)
  );

  const [selectedJobId, setSelectedJobId] = useState<number | 'all'>('all');
  const [minLevel, setMinLevel] = useState<number | ''>(1);
  const [maxLevel, setMaxLevel] = useState<number | ''>(200);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('daily_flow_desc');
  const [onlyProfitable, setOnlyProfitable] = useState<boolean>(false);
  const [minProfitKamas, setMinProfitKamas] = useState<number | ''>('');
  const [quotationFilter, setQuotationFilter] = useState<
    'all' | 'quoted' | 'unquoted'
  >('all');
  const [minDailySales, setMinDailySales] = useState<number | ''>('');
  const [onlyWithSalesData, setOnlyWithSalesData] = useState<boolean>(false);
  const [onlyFullyPricedIngredients, setOnlyFullyPricedIngredients] =
    useState<boolean>(false);
  const [minRoi, setMinRoi] = useState<number | ''>('');
  const [maxCraftCost, setMaxCraftCost] = useState<number | ''>('');
  const [itemForQuickQuote, setItemForQuickQuote] =
    useState<PresetCraftableItem | null>(null);

  const {
    marketPrices: basePrices,
    priceUpdatedAt,
    updatePrice,
    refreshPrices,
    activeProfileId,
  } = useMarketPrices();
  const { isEnabled: isUserJobsEnabled, canCraft: canUserCraft } =
    useUserJobs();

  const [activePresetItem, setActivePresetItem] =
    useState<PresetCraftableItem | null>(PRESET_CRAFTABLE_ITEMS[0]);
  const [recipeTree, setRecipeTree] = useState<RecipeTreeNode | null>(null);
  const [loadingTree, setLoadingTree] = useState<boolean>(false);
  const [itemForHistory, setItemForHistory] = useState<DofusItem | null>(null);

  const [activeSalePrice, setActiveSalePrice] = useState<number | ''>('');
  const [salePriceDraft, setSalePriceDraft] = useState<string>('');
  const [treeExpandTrigger, setTreeExpandTrigger] = useState<{
    trigger: number;
    expand: boolean;
  }>({
    trigger: 0,
    expand: false,
  });

  const [salesVolumeMap, setSalesVolumeMap] = useState<
    Record<number, ItemSalesVolume>
  >(() => {
    return getStoredSalesVolumeMap();
  });

  const marketPrices = useMemo(() => {
    const merged = { ...DEFAULT_INGREDIENT_PRICES, ...basePrices };
    if (salesVolumeMap) {
      for (const [idStr, vol] of Object.entries(salesVolumeMap)) {
        const id = Number(idStr);
        if (
          id > 0 &&
          (!merged[id] || merged[id] <= 0) &&
          vol?.suggestedPrice &&
          vol.suggestedPrice >= 1
        ) {
          merged[id] = Math.round(vol.suggestedPrice);
        }
      }
    }
    return merged;
  }, [basePrices, salesVolumeMap]);

  const effectivePriceUpdatedAt = useMemo(() => {
    const merged = { ...priceUpdatedAt };
    if (salesVolumeMap) {
      for (const [idStr, vol] of Object.entries(salesVolumeMap)) {
        const id = Number(idStr);
        if (
          id > 0 &&
          (!basePrices[id] || basePrices[id] <= 0) &&
          vol?.suggestedPrice &&
          vol.suggestedPrice >= 1
        ) {
          merged[id] = vol.updatedAt || Date.now();
        }
      }
    }
    return merged;
  }, [priceUpdatedAt, basePrices, salesVolumeMap]);

  const [selectedBycMethods, setSelectedBycMethods] = useState<
    Record<number, 'direct' | 'fragments' | 'map'>
  >(() => {
    return getStoredBycMethods();
  });

  useEffect(() => {
    const handleVolumeUpdated = () => {
      setSalesVolumeMap(getStoredSalesVolumeMap());
    };
    const handleBycChange = () => {
      setSelectedBycMethods(getStoredBycMethods());
    };
    window.addEventListener(
      'dofus_sales_volume_updated',
      handleVolumeUpdated
    );
    window.addEventListener('dofus_byc_method_changed', handleBycChange);
    window.addEventListener('dofus_profile_changed', handleBycChange);
    return () => {
      window.removeEventListener(
        'dofus_sales_volume_updated',
        handleVolumeUpdated
      );
      window.removeEventListener('dofus_byc_method_changed', handleBycChange);
      window.removeEventListener('dofus_profile_changed', handleBycChange);
    };
  }, []);

  const handleSelectBycMethod = (
    itemId: number,
    method: 'direct' | 'fragments' | 'map'
  ) => {
    saveStoredBycMethod(itemId, method);
    setSelectedBycMethods((prev) => ({
      ...prev,
      [itemId]: method,
    }));
  };

  const handlePriceChange = (itemId: number, newPrice: number) => {
    void updatePrice(itemId, newPrice);
  };

  const handleCommitSalePrice = (val: string) => {
    const parsed = Number(val);
    if (!Number.isNaN(parsed) && parsed >= 0 && activePresetItem) {
      setActiveSalePrice(parsed);
      void updatePrice(activePresetItem.id, parsed);
    }
  };

  useEffect(() => {
    if (initialSelectedItem) {
      const snap = getCraftableItemsSnapshot() as PresetCraftableItem[];
      const found = snap.find((i) => i.id === initialSelectedItem.id);
      if (found) {
        setActivePresetItem(found);
        setIsDetailView(true);
      } else {
        const itemJob = initialSelectedItem.type?.name?.es || 'Receta';
        const tempPreset: PresetCraftableItem = {
          ...initialSelectedItem,
          jobId: 0,
          jobNameEs: itemJob,
          defaultMarketSalePrice: 0,
          recipeData: (initialSelectedItem as any).recipeData || {
            id: 0,
            resultId: initialSelectedItem.id,
            ingredientIds: [],
            quantities: [],
          },
        };
        setActivePresetItem(tempPreset);
        setIsDetailView(true);
      }
    }
  }, [initialSelectedItem]);

  useEffect(() => {
    if (activePresetItem) {
      const currentStored = marketPrices[activePresetItem.id];
      if (typeof currentStored === 'number' && currentStored > 0) {
        setActiveSalePrice(currentStored);
        setSalePriceDraft(String(currentStored));
      } else {
        setActiveSalePrice('');
        setSalePriceDraft('');
      }
    }
  }, [activePresetItem?.id, marketPrices]);

  const [recipeTreeVersion, setRecipeTreeVersion] = useState<number>(0);
  const [isSyncingLive, setIsSyncingLive] = useState<boolean>(false);
  const [lastSyncNotice, setLastSyncNotice] = useState<string | null>(null);

  useEffect(() => {
    let noticeTimeout: any = null;
    let lastPriceEventTime = 0;

    const handlePriceUpdate = (e?: Event) => {
      lastPriceEventTime = Date.now();
      clearRecipeTreeCache();
      setRecipeTreeVersion((v) => v + 1);
      const customEvent = e as CustomEvent<{ count?: number }>;
      if (customEvent?.detail?.count && customEvent.detail.count > 0) {
        setLastSyncNotice(
          `¡${customEvent.detail.count} precio(s) actualizados!`
        );
        clearTimeout(noticeTimeout);
        noticeTimeout = setTimeout(() => setLastSyncNotice(null), 4000);
      }
    };

    const handleDatabaseUpdate = () => {
      if (Date.now() - lastPriceEventTime < 100) return;
      clearRecipeTreeCache();
      setRecipeTreeVersion((v) => v + 1);
    };

    window.addEventListener('dofus_prices_updated', handlePriceUpdate);
    window.addEventListener('dofus_database_updated', handleDatabaseUpdate);

    return () => {
      clearTimeout(noticeTimeout);
      window.removeEventListener('dofus_prices_updated', handlePriceUpdate);
      window.removeEventListener('dofus_database_updated', handleDatabaseUpdate);
    };
  }, []);

  const handleManualSync = async () => {
    if (isSyncingLive) return;
    setIsSyncingLive(true);
    try {
      clearRecipeTreeCache();
      const updatedCount = await triggerLivePriceSync(true);
      if (updatedCount > 0) {
        setLastSyncNotice(
          `¡${updatedCount} precios actualizados del mercadillo!`
        );
      } else {
        setLastSyncNotice('Precios al día con el servidor');
      }
      setTimeout(() => setLastSyncNotice(null), 3500);
    } catch {
      setLastSyncNotice('Error de conexión');
      setTimeout(() => setLastSyncNotice(null), 3000);
    } finally {
      setIsSyncingLive(false);
    }
  };

  useEffect(() => {
    let isCancelled = false;
    if (activePresetItem) {
      setLoadingTree(true);
      clearRecipeTreeCache();
      buildRecipeTree(
        activePresetItem.id,
        1,
        0,
        5,
        new Set(),
        marketPrices
      )
        .then((tree) => {
          if (!isCancelled) {
            setRecipeTree(tree);
            setLoadingTree(false);
          }
        })
        .catch((error) => {
          console.error('Error cargando el árbol de receta:', error);
          if (!isCancelled) {
            setLoadingTree(false);
          }
        });
    } else {
      setRecipeTree(null);
    }
    return () => {
      isCancelled = true;
    };
  }, [activePresetItem?.id, recipeTreeVersion, marketPrices]);

  const allCraftableItems: PresetCraftableItem[] = useMemo(() => {
    const raw = getCraftableItemsSnapshot() as PresetCraftableItem[];
    return raw.filter((item) => !isOmittedItem(item) && !isClassItem(item));
  }, []);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(24);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    selectedJobId,
    minLevel,
    maxLevel,
    searchTerm,
    sortBy,
    onlyProfitable,
    minProfitKamas,
    quotationFilter,
    minDailySales,
    onlyWithSalesData,
    onlyFullyPricedIngredients,
    minRoi,
    maxCraftCost,
    itemsPerPage,
    isUserJobsEnabled,
  ]);

  const quotedCount = useMemo(() => {
    return allCraftableItems.filter(
      (item) => (marketPrices[item.id] || 0) > 0
    ).length;
  }, [allCraftableItems, marketPrices]);

  const handleResetFilters = () => {
    setSelectedJobId('all');
    setMinLevel(1);
    setMaxLevel(200);
    setSearchTerm('');
    setSortBy('daily_flow_desc');
    setOnlyProfitable(false);
    setMinProfitKamas('');
    setQuotationFilter('all');
    setMinDailySales('');
    setOnlyWithSalesData(false);
    setOnlyFullyPricedIngredients(false);
    setMinRoi('');
    setMaxCraftCost('');
  };

  const hasActiveFilters = useMemo(() => {
    return (
      selectedJobId !== 'all' ||
      (minLevel !== 1 && minLevel !== '') ||
      (maxLevel !== 200 && maxLevel !== '') ||
      searchTerm.trim() !== '' ||
      onlyProfitable ||
      (minProfitKamas !== '' && minProfitKamas > 0) ||
      quotationFilter !== 'all' ||
      minDailySales !== '' ||
      onlyWithSalesData ||
      onlyFullyPricedIngredients ||
      minRoi !== '' ||
      maxCraftCost !== ''
    );
  }, [
    selectedJobId,
    minLevel,
    maxLevel,
    searchTerm,
    onlyProfitable,
    minProfitKamas,
    quotationFilter,
    minDailySales,
    onlyWithSalesData,
    onlyFullyPricedIngredients,
    minRoi,
    maxCraftCost,
  ]);

  const itemMetricsMap = useMemo(() => {
    const map = new Map<number, ItemMetrics>();

    allCraftableItems.forEach((item) => {
      let directCost = 0;
      let missingIngredientsCount = 0;
      const ingIds = item.recipeData?.ingredientIds || [];
      const quantities = item.recipeData?.quantities || [];

      ingIds.forEach((ingId, idx) => {
        const qty = quantities[idx] || 1;
        let p = marketPrices[ingId] || 0;
        if (isBycResource(ingId)) {
          const preferred = selectedBycMethods[ingId];
          p = getOptimizedIngredientCost(
            ingId,
            marketPrices,
            preferred
          ).cost;
        }
        if (p <= 0) {
          missingIngredientsCount++;
        }
        directCost += p * qty;
      });

      const sale = marketPrices[item.id] || 0;
      const tax = sale > 0 ? Math.ceil(sale * 0.02) : 0;
      const net = sale > 0 ? sale - tax - directCost : -directCost;
      const roi =
        directCost > 0 && sale > 0 ? (net / directCost) * 100 : 0;

      const vol = salesVolumeMap[item.id];
      const salesAnalysis = analyzeSalesVolume(sale, vol);
      const avgDaily = salesAnalysis.hasData
        ? salesAnalysis.avgDailySales
        : vol?.avgDailySales || 0;
      const expectedDailyFlow =
        net > 0 && avgDaily > 0 ? Math.round(net * avgDaily) : 0;

      map.set(item.id, {
        cost: directCost,
        salePrice: sale,
        netProfit: net,
        roi,
        missingIngredientsCount,
        hasFullIngredientPrices:
          missingIngredientsCount === 0 && ingIds.length > 0,
        avgDailySales: avgDaily,
        hasSalesData: salesAnalysis.hasData,
        expectedDailyFlow,
        daysToSell: salesAnalysis.daysToSell,
        turnoverRating: salesAnalysis.turnoverRating,
        turnoverLabel: salesAnalysis.turnoverLabel,
      });
    });

    return map;
  }, [allCraftableItems, marketPrices, selectedBycMethods, salesVolumeMap]);

  const filteredItems = useMemo(() => {
    return allCraftableItems
      .filter((item) => {
        if (selectedJobId !== 'all' && item.jobId !== selectedJobId) {
          return false;
        }

        if (isUserJobsEnabled && !canUserCraft(item)) {
          return false;
        }

        const minL = minLevel !== '' ? minLevel : 1;
        const maxL = maxLevel !== '' ? maxLevel : 200;
        if (item.level < minL || item.level > maxL) {
          return false;
        }

        if (searchTerm.trim() !== '') {
          const name = getItemName(item);
          const type = getItemTypeName(item);
          if (!matchesSearchQuery([name, type], searchTerm)) {
            return false;
          }
        }

        const metrics = itemMetricsMap.get(item.id);
        const hasSalePrice = Boolean(metrics && metrics.salePrice > 0);

        if (quotationFilter === 'quoted' && !hasSalePrice) {
          return false;
        }
        if (quotationFilter === 'unquoted' && hasSalePrice) {
          return false;
        }

        if (onlyProfitable) {
          if (!hasSalePrice || (metrics && metrics.netProfit <= 0)) {
            return false;
          }
        }

        if (minProfitKamas !== '' && minProfitKamas > 0) {
          if (!metrics || metrics.netProfit < minProfitKamas) {
            return false;
          }
        }

        if (minRoi !== '' && minRoi > 0) {
          if (!metrics || metrics.roi < minRoi) {
            return false;
          }
        }

        if (maxCraftCost !== '' && maxCraftCost > 0) {
          if (!metrics || metrics.cost > maxCraftCost) {
            return false;
          }
        }

        if (onlyFullyPricedIngredients) {
          if (!metrics || !metrics.hasFullIngredientPrices) {
            return false;
          }
        }

        if (onlyWithSalesData) {
          if (!metrics || !metrics.hasSalesData) {
            return false;
          }
        }

        if (minDailySales !== '' && minDailySales > 0) {
          if (
            !metrics ||
            !metrics.hasSalesData ||
            metrics.avgDailySales < minDailySales
          ) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        const metA = itemMetricsMap.get(a.id) || {
          cost: 0,
          salePrice: 0,
          netProfit: 0,
          roi: 0,
          avgDailySales: 0,
          expectedDailyFlow: 0,
        };
        const metB = itemMetricsMap.get(b.id) || {
          cost: 0,
          salePrice: 0,
          netProfit: 0,
          roi: 0,
          avgDailySales: 0,
          expectedDailyFlow: 0,
        };

        if (sortBy === 'daily_flow_desc') {
          if (metB.expectedDailyFlow !== metA.expectedDailyFlow) {
            return metB.expectedDailyFlow - metA.expectedDailyFlow;
          }
          return metB.netProfit - metA.netProfit;
        }
        if (sortBy === 'sales_velocity_desc') {
          if (metB.avgDailySales !== metA.avgDailySales) {
            return metB.avgDailySales - metA.avgDailySales;
          }
          return metB.netProfit - metA.netProfit;
        }
        if (sortBy === 'profit_desc') {
          return metB.netProfit - metA.netProfit;
        }
        if (sortBy === 'roi_desc') {
          return metB.roi - metA.roi;
        }
        if (sortBy === 'cost_asc') {
          return metA.cost - metB.cost;
        }
        if (sortBy === 'cost_desc') {
          return metB.cost - metA.cost;
        }
        if (sortBy === 'price_desc') {
          return metB.salePrice - metA.salePrice;
        }
        if (sortBy === 'level_asc') {
          return a.level - b.level;
        }
        if (sortBy === 'level_desc') {
          return b.level - a.level;
        }
        if (sortBy === 'name') {
          return getItemName(a).localeCompare(getItemName(b));
        }
        return 0;
      });
  }, [
    allCraftableItems,
    selectedJobId,
    minLevel,
    maxLevel,
    searchTerm,
    quotationFilter,
    onlyProfitable,
    minProfitKamas,
    minRoi,
    maxCraftCost,
    onlyFullyPricedIngredients,
    onlyWithSalesData,
    minDailySales,
    sortBy,
    itemMetricsMap,
    isUserJobsEnabled,
    canUserCraft,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredItems.length / itemsPerPage)
  );
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedItems = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * itemsPerPage;
    return filteredItems.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredItems, safeCurrentPage, itemsPerPage]);

  const paginatedIdsString = useMemo(() => {
    return paginatedItems.map((item) => item.id).join(',');
  }, [paginatedItems]);

  useEffect(() => {
    if (!paginatedIdsString) return;
    const visibleIds = paginatedIdsString
      .split(',')
      .map(Number)
      .filter(Boolean);

    const missingIds = visibleIds.filter((id) => {
      const item = paginatedItems.find((i) => i.id === id);
      const name = item ? getItemName(item) : '';
      return !name || name.startsWith('Objeto #');
    });

    if (missingIds.length > 0) {
      void resolveMissingItemNamesInBatch(missingIds);
    }
  }, [paginatedIdsString]);

  const directCraftCost = recipeTree
    ? calculateTreeCraftCost(
        recipeTree,
        'direct_buy',
        marketPrices,
        selectedBycMethods
      )
    : 0;

  const autoOptimalCost = recipeTree
    ? calculateTreeCraftCost(
        recipeTree,
        'auto_optimal',
        marketPrices,
        selectedBycMethods
      )
    : 0;

  const handleSelectItemForDetail = (item: PresetCraftableItem) => {
    setActivePresetItem(item);
    setIsDetailView(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return {
    isDetailView,
    setIsDetailView,
    selectedJobId,
    setSelectedJobId,
    minLevel,
    setMinLevel,
    maxLevel,
    setMaxLevel,
    searchTerm,
    setSearchTerm,
    sortBy,
    setSortBy,
    onlyProfitable,
    setOnlyProfitable,
    minProfitKamas,
    setMinProfitKamas,
    quotationFilter,
    setQuotationFilter,
    minDailySales,
    setMinDailySales,
    onlyWithSalesData,
    setOnlyWithSalesData,
    onlyFullyPricedIngredients,
    setOnlyFullyPricedIngredients,
    minRoi,
    setMinRoi,
    maxCraftCost,
    setMaxCraftCost,
    itemForQuickQuote,
    setItemForQuickQuote,
    activePresetItem,
    setActivePresetItem,
    recipeTree,
    loadingTree,
    itemForHistory,
    setItemForHistory,
    activeSalePrice,
    salePriceDraft,
    setSalePriceDraft,
    treeExpandTrigger,
    setTreeExpandTrigger,
    salesVolumeMap,
    setSalesVolumeMap,
    marketPrices,
    effectivePriceUpdatedAt,
    selectedBycMethods,
    isSyncingLive,
    lastSyncNotice,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    allCraftableItems,
    quotedCount,
    hasActiveFilters,
    itemMetricsMap,
    filteredItems,
    totalPages,
    safeCurrentPage,
    paginatedItems,
    directCraftCost,
    autoOptimalCost,
    activeProfileId,
    isUserJobsEnabled,
    handleSelectBycMethod,
    handlePriceChange,
    handleCommitSalePrice,
    handleManualSync,
    handleResetFilters,
    handleSelectItemForDetail,
    refreshPrices,
    setRecipeTreeVersion,
  };
}
