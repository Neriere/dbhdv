import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  DofusItem,
  MarketPriceMap,
  PriceUpdatedAtMap,
  SalesVolumeMap,
  PriceChangeInfo,
} from '../../types';
import {
  getActivePriceProfileId,
  getImportedItems,
  getPriceProfiles,
  getStoredMarketPrices,
  getStoredPriceUpdatedAt,
  getStoredRecipes,
  saveMarketPrice,
  saveAllMarketPrices,
  importFullDatabaseJSON,
  setActiveLocalPriceProfile,
  getItemName,
  getItemTypeName,
  initializeDatabase,
  formatRelativeTime,
  addToShoppingList,
  fetchLatestPriceChanges,
} from '../../services/dofusDbService';
import { getStoredSalesVolumeMap } from '../../services/salesVolumeService';
import {
  DOFUS_DB_TYPE_TO_JOB_MAP,
  DOFUS_DU_TYPE_TO_JOB_MAP,
} from '../../data/jobCategoryDatabase';
import { ALL_DOFUS_RUNES } from '../../data/dofusAllRunesDict';
import { isOmittedItem, isDofusItem } from '../../data/dofusJobs';
import { matchesSearchQuery } from '../../utils/searchUtils';
import {
  PriceFilterCategory,
  ItemScopeFilter,
  SortByField,
  GATHERING_CATEGORIES,
  MONSTER_DROP_TYPE_IDS,
  ALL_RESOURCE_TYPES_SET,
  EQUIPMENT_TYPE_IDS_SET,
} from './types';

export const ITEMS_PER_PAGE = 50;

export function usePriceManager() {
  const [items, setItems] = useState<DofusItem[]>([]);
  const [marketPrices, setMarketPrices] = useState<MarketPriceMap>({});
  const [priceUpdatedAt, setPriceUpdatedAt] = useState<Record<number, number>>({});
  const [databaseVersion, setDatabaseVersion] = useState<number>(0);
  const [priceProfiles, setPriceProfiles] = useState(() => getPriceProfiles());
  const [activePriceProfileId, setActivePriceProfileId] = useState<number>(() =>
    getActivePriceProfileId()
  );
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<PriceFilterCategory>('all');
  const [activeScope, setActiveScope] = useState<ItemScopeFilter>('all_scope');
  const [sortByField, setSortByField] = useState<SortByField>('default');
  const [salesVolumes, setSalesVolumes] = useState<SalesVolumeMap>({});
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [savedFeedbackItemId, setSavedFeedbackItemId] = useState<number | null>(null);
  const [isGlobalHistoryOpen, setIsGlobalHistoryOpen] = useState<boolean>(false);
  const [isSnifferModalOpen, setIsSnifferModalOpen] = useState<boolean>(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState<boolean>(false);
  const [itemForHistory, setItemForHistory] = useState<DofusItem | null>(null);
  const [itemForSalesVolume, setItemForSalesVolume] = useState<DofusItem | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [priceChanges, setPriceChanges] = useState<Record<number, PriceChangeInfo>>({});
  const [addedCartItemIds, setAddedCartItemIds] = useState<Record<number, boolean>>({});
  const [copiedItemId, setCopiedItemId] = useState<number | null>(null);

  const [priceDrafts, setPriceDrafts] = useState<Record<number, string>>({});
  const debounceTimersRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  // Reset page whenever search, category, or scope changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeCategory, activeScope, sortByField]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      Object.values(debounceTimersRef.current).forEach((timer) => clearTimeout(timer));
    };
  }, []);

  const hydrateState = useCallback(() => {
    const storedPrices = getStoredMarketPrices();
    const baseRuneItems: DofusItem[] = ALL_DOFUS_RUNES.map((r) => ({
      id: r.id,
      name: { es: r.name.es, fr: r.name.fr, en: r.name.en },
      level: r.level || 1,
      typeId: 78,
      type: { id: 78, name: { es: 'Runa', fr: 'Rune', en: 'Rune' } },
      iconId: r.iconId || 78000,
      description: { es: 'Runa oficial de forjamagia y triturado.' },
    }));

    const imported = getImportedItems().filter((i) => !isOmittedItem(i));
    const existingIds = new Set<number>();
    const combined: DofusItem[] = [];

    for (const item of imported) {
      if (!existingIds.has(item.id)) {
        existingIds.add(item.id);
        combined.push(item);
      }
    }

    for (const runeItem of baseRuneItems) {
      if (!existingIds.has(runeItem.id)) {
        existingIds.add(runeItem.id);
        combined.push(runeItem);
      }
    }

    setItems(combined);
    setMarketPrices(storedPrices);
    setPriceUpdatedAt(getStoredPriceUpdatedAt());
    setPriceProfiles(getPriceProfiles());
    setActivePriceProfileId(getActivePriceProfileId());
    setSalesVolumes(getStoredSalesVolumeMap());
    setDatabaseVersion((prev) => prev + 1);

    const initialDrafts: Record<number, string> = {};
    for (const [id, price] of Object.entries(storedPrices)) {
      if (Number(price) > 0) {
        initialDrafts[Number(id)] = String(price);
      }
    }
    setPriceDrafts(initialDrafts);

    fetchLatestPriceChanges()
      .then((changes) => {
        if (changes) setPriceChanges(changes);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    initializeDatabase()
      .then(() => {
        hydrateState();
      })
      .catch((error) => {
        console.error('No se pudo inicializar la base local:', error);
      });

    const handlePricesUpdated = (event?: Event) => {
      fetchLatestPriceChanges()
        .then((changes) => {
          if (changes) setPriceChanges(changes);
        })
        .catch(() => {});

      const customEvent = event as CustomEvent<{
        updatedPrices?: MarketPriceMap;
        priceUpdatedAt?: PriceUpdatedAtMap;
        replacePrices?: boolean;
      }>;
      if (customEvent?.detail?.replacePrices) {
        const freshPrices = customEvent.detail.updatedPrices || getStoredMarketPrices();
        setMarketPrices({ ...freshPrices });
        const nextDrafts: Record<number, string> = {};
        for (const [id, p] of Object.entries(freshPrices)) {
          if (Number(p) > 0) nextDrafts[Number(id)] = String(p);
        }
        setPriceDrafts(nextDrafts);
      } else if (customEvent?.detail?.updatedPrices) {
        setMarketPrices((prev) => ({ ...prev, ...customEvent.detail.updatedPrices }));
        setPriceDrafts((prev) => {
          const next = { ...prev };
          for (const [id, p] of Object.entries(customEvent.detail.updatedPrices!)) {
            next[Number(id)] = p > 0 ? String(p) : '';
          }
          return next;
        });
      }
      if (customEvent?.detail?.priceUpdatedAt) {
        if (customEvent.detail.replacePrices) {
          setPriceUpdatedAt({ ...customEvent.detail.priceUpdatedAt });
        } else {
          setPriceUpdatedAt((prev) => ({ ...prev, ...customEvent.detail.priceUpdatedAt }));
        }
      }
    };

    const handleDbUpdate = () => {
      hydrateState();
    };

    const handleSalesVolumeUpdate = () => setSalesVolumes(getStoredSalesVolumeMap());
    const handleProfileChange = () => hydrateState();

    window.addEventListener('dofus_prices_updated', handlePricesUpdated);
    window.addEventListener('dofus_database_updated', handleDbUpdate);
    window.addEventListener('dofus_sales_volume_updated', handleSalesVolumeUpdate);
    window.addEventListener('dofus_profile_changed', handleProfileChange);

    return () => {
      window.removeEventListener('dofus_prices_updated', handlePricesUpdated);
      window.removeEventListener('dofus_database_updated', handleDbUpdate);
      window.removeEventListener('dofus_sales_volume_updated', handleSalesVolumeUpdate);
      window.removeEventListener('dofus_profile_changed', handleProfileChange);
    };
  }, [hydrateState]);

  const recipeIngredientIds = useMemo(() => {
    const recipes = getStoredRecipes();
    const set = new Set<number>();
    for (const recipe of Object.values(recipes)) {
      if (recipe.ingredientIds) {
        for (const id of recipe.ingredientIds) set.add(Number(id));
      }
      if (recipe.ingredients) {
        for (const ing of recipe.ingredients) {
          const id = Number(ing.id ?? ing.itemId ?? (ing as any).item_id);
          if (id) set.add(id);
        }
      }
    }
    return set;
  }, [databaseVersion]);

  // Set of item IDs that have their own crafting recipe
  const craftableItemIds = useMemo(() => {
    const recipes = getStoredRecipes();
    return new Set<number>(Object.keys(recipes).map(Number));
  }, [databaseVersion]);

  const handlePriceUpdate = useCallback(
    (itemId: number, rawValue: string) => {
      if (debounceTimersRef.current[itemId]) {
        clearTimeout(debounceTimersRef.current[itemId]);
        delete debounceTimersRef.current[itemId];
      }

      const numericPrice = Math.max(0, parseInt(rawValue, 10) || 0);
      const oldPrice = Number(marketPrices[itemId]) || 0;

      if (numericPrice !== oldPrice && (numericPrice > 0 || oldPrice > 0)) {
        const diff = numericPrice - oldPrice;
        const pct =
          oldPrice > 0 ? (diff / oldPrice) * 100 : numericPrice > 0 ? 100 : 0;
        setPriceChanges((prev) => ({
          ...prev,
          [itemId]: {
            itemId,
            price: numericPrice,
            oldPrice,
            difference: diff,
            percentageChange: Number(pct.toFixed(1)),
            timestamp: Date.now(),
          },
        }));
      }

      saveMarketPrice(itemId, numericPrice)
        .then((updated) => {
          setMarketPrices(updated);
          setPriceDrafts((prev) => ({
            ...prev,
            [itemId]: numericPrice > 0 ? String(numericPrice) : '',
          }));
          setSavedFeedbackItemId(itemId);
          setTimeout(
            () => setSavedFeedbackItemId((curr) => (curr === itemId ? null : curr)),
            1200
          );
        })
        .catch((error) => {
          console.error(`No se pudo guardar el precio del item ${itemId}:`, error);
        });
    },
    [marketPrices]
  );

  const handlePriceDraftChange = useCallback(
    (itemId: number, value: string) => {
      setPriceDrafts((prev) => ({ ...prev, [itemId]: value }));

      if (debounceTimersRef.current[itemId]) {
        clearTimeout(debounceTimersRef.current[itemId]);
      }

      // Auto-save after 450ms of inactivity
      debounceTimersRef.current[itemId] = setTimeout(() => {
        handlePriceUpdate(itemId, value);
      }, 450);
    },
    [handlePriceUpdate]
  );

  const handleQuickAddPrice = (itemId: number, addAmount: number) => {
    const currentPrice = Number(marketPrices[itemId]) || 0;
    const newPrice = currentPrice + addAmount;
    handlePriceUpdate(itemId, String(newPrice));
  };

  const handleAddToShoppingList = useCallback((item: DofusItem, quantity: number = 1) => {
    addToShoppingList(item, quantity);
    setAddedCartItemIds((prev) => ({ ...prev, [item.id]: true }));
    setTimeout(() => {
      setAddedCartItemIds((prev) => {
        const copy = { ...prev };
        delete copy[item.id];
        return copy;
      });
    }, 1600);
  }, []);

  const handleCopyItemName = useCallback((item: DofusItem) => {
    const name = getItemName(item);
    navigator.clipboard.writeText(name);
    setCopiedItemId(item.id);
    setTimeout(() => {
      setCopiedItemId((curr) => (curr === item.id ? null : curr));
    }, 1200);
  }, []);

  const handleChangeProfile = async (profileId: number) => {
    try {
      await setActiveLocalPriceProfile(profileId);
      setActivePriceProfileId(profileId);
      const changes = await fetchLatestPriceChanges(profileId);
      if (changes) setPriceChanges(changes);
    } catch (error) {
      console.error('No se pudo cambiar el perfil:', error);
    }
  };

  const matchCategory = useCallback(
    (item: DofusItem, cat: PriceFilterCategory): boolean => {
      const typeId = Number(item.typeId || item.type?.id || 0);

      if (cat === 'all') return true;
      if (cat === 'dofus') {
        return typeId === 23 || isDofusItem(item);
      }
      if (cat === 'runes') {
        return (
          typeId === 78 ||
          typeId === 18 ||
          ALL_DOFUS_RUNES.some((r) => r.id === item.id)
        );
      }
      if (cat === 'has_price') return (Number(marketPrices[item.id]) || 0) > 0;
      if (cat === 'without_price')
        return !marketPrices[item.id] || Number(marketPrices[item.id]) === 0;

      if (cat === 'craft_ingredients') {
        return (
          recipeIngredientIds.has(item.id) || ALL_RESOURCE_TYPES_SET.has(typeId)
        );
      }

      if (cat === 'monsters') {
        return MONSTER_DROP_TYPE_IDS.has(typeId);
      }

      if (cat === 'equipment') {
        return EQUIPMENT_TYPE_IDS_SET.has(typeId);
      }

      const targetCat = GATHERING_CATEGORIES.find((c) => c.id === cat);
      if (targetCat) {
        const jobInfo =
          DOFUS_DB_TYPE_TO_JOB_MAP[typeId] || DOFUS_DU_TYPE_TO_JOB_MAP[typeId];
        if (jobInfo && jobInfo.jobId === targetCat.jobId) return true;

        if (targetCat.jobId === 28)
          return [34, 33, 37, 58, 60, 68, 46, 28, 128, 129].includes(typeId);
        if (targetCat.jobId === 2)
          return [38, 95, 96, 98, 183, 185, 242, 12, 170].includes(typeId);
        if (targetCat.jobId === 26)
          return [
            12, 26, 35, 36, 70, 71, 79, 179, 183, 206, 228, 167, 62,
          ].includes(typeId);
        if (targetCat.jobId === 24)
          return [
            39, 40, 50, 51, 83, 85, 307, 308, 167, 153, 66, 91,
          ].includes(typeId);
        if (targetCat.jobId === 36)
          return [41, 49, 134, 135, 64].includes(typeId);
        if (targetCat.jobId === 41)
          return [63, 69, 187, 56, 59, 150].includes(typeId);
        if (targetCat.jobId === 101) return [99, 323, 326, 327].includes(typeId);
      }

      return false;
    },
    [marketPrices, recipeIngredientIds]
  );

  const filteredItems = useMemo(() => {
    let result = items;

    // 0. Scope Pre-Filter
    if (activeScope === 'resources_only') {
      const runeIdsSet = new Set(ALL_DOFUS_RUNES.map((r) => r.id));
      result = result.filter((item) => {
        const typeId = Number(item.typeId || item.type?.id || 0);
        const isRune =
          typeId === 78 || typeId === 18 || runeIdsSet.has(item.id);
        return !craftableItemIds.has(item.id) && !isRune;
      });
    } else if (activeScope === 'craftable_only') {
      result = result.filter((item) => craftableItemIds.has(item.id));
    }

    // 1. Search Query Filter
    if (searchTerm.trim()) {
      result = result.filter((item) => {
        return matchesSearchQuery(
          [getItemName(item), getItemTypeName(item), item.id],
          searchTerm
        );
      });
    }

    // 2. Active Category Filter
    if (activeCategory !== 'all') {
      result = result.filter((item) => matchCategory(item, activeCategory));
    }

    // 3. Sort by sales volume
    if (sortByField !== 'default') {
      result = [...result].sort((a, b) => {
        const volA = salesVolumes[a.id];
        const volB = salesVolumes[b.id];
        let valA = 0;
        let valB = 0;
        if (sortByField === 'sales24h') {
          valA = volA?.sales24h ?? 0;
          valB = volB?.sales24h ?? 0;
        } else if (sortByField === 'sales7d') {
          valA = volA?.sales7d ?? 0;
          valB = volB?.sales7d ?? 0;
        } else if (sortByField === 'sales30d') {
          valA = volA?.sales30d ?? 0;
          valB = volB?.sales30d ?? 0;
        } else if (sortByField === 'avgDaily') {
          valA = volA?.avgDailySales ?? 0;
          valB = volB?.avgDailySales ?? 0;
        }
        return valB - valA;
      });
    }

    return result;
  }, [
    items,
    searchTerm,
    activeCategory,
    activeScope,
    sortByField,
    matchCategory,
    craftableItemIds,
    salesVolumes,
  ]);

  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE) || 1;
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedItems = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
    return filteredItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredItems, safeCurrentPage]);

  // Compute live category item counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: 0,
      dofus: 0,
      runes: 0,
      craft_ingredients: 0,
      campesino: 0,
      lenador: 0,
      alquimista: 0,
      minero: 0,
      pescador: 0,
      cazador: 0,
      ganadero: 0,
      monsters: 0,
      equipment: 0,
      has_price: 0,
      without_price: 0,
    };

    const runeIdsSet = new Set(ALL_DOFUS_RUNES.map((r) => r.id));
    const campesinoTypes = new Set([34, 33, 37, 58, 60, 68, 46, 28, 128, 129]);
    const lenadorTypes = new Set([38, 95, 96, 98, 183, 185, 242, 12, 170]);
    const alquimistaTypes = new Set([
      12, 26, 35, 36, 70, 71, 79, 179, 183, 206, 228, 167, 62,
    ]);
    const mineroTypes = new Set([
      39, 40, 50, 51, 83, 85, 307, 308, 167, 153, 66, 91,
    ]);
    const pescadorTypes = new Set([41, 49, 134, 135, 64]);
    const cazadorTypes = new Set([63, 69, 187, 56, 59, 150]);
    const ganaderoTypes = new Set([99, 323, 326, 327]);

    let scopedItems = items;
    if (activeScope === 'resources_only') {
      scopedItems = items.filter((item) => {
        const typeId = Number(item.typeId || item.type?.id || 0);
        const isRune =
          typeId === 78 || typeId === 18 || runeIdsSet.has(item.id);
        return !craftableItemIds.has(item.id) && !isRune;
      });
    } else if (activeScope === 'craftable_only') {
      scopedItems = items.filter((item) => craftableItemIds.has(item.id));
    }

    counts.all = scopedItems.length;

    for (const item of scopedItems) {
      const typeId = Number(item.typeId || item.type?.id || 0);
      const isDof = typeId === 23 || isDofusItem(item);
      const isRune = typeId === 78 || typeId === 18 || runeIdsSet.has(item.id);

      if (isDof) counts.dofus++;
      if (isRune) counts.runes++;

      if (
        recipeIngredientIds.has(item.id) ||
        ALL_RESOURCE_TYPES_SET.has(typeId)
      ) {
        counts.craft_ingredients++;
      }

      if (campesinoTypes.has(typeId)) counts.campesino++;
      if (lenadorTypes.has(typeId)) counts.lenador++;
      if (alquimistaTypes.has(typeId)) counts.alquimista++;
      if (mineroTypes.has(typeId)) counts.minero++;
      if (pescadorTypes.has(typeId)) counts.pescador++;
      if (cazadorTypes.has(typeId)) counts.cazador++;
      if (ganaderoTypes.has(typeId)) counts.ganadero++;
      if (MONSTER_DROP_TYPE_IDS.has(typeId)) counts.monsters++;
      if (EQUIPMENT_TYPE_IDS_SET.has(typeId)) counts.equipment++;

      if (Number(marketPrices[item.id]) > 0) counts.has_price++;
      else counts.without_price++;
    }

    return counts;
  }, [items, marketPrices, recipeIngredientIds, activeScope, craftableItemIds]);

  const scopeCounts = useMemo(() => {
    const runeIdsSet = new Set(ALL_DOFUS_RUNES.map((r) => r.id));
    let resources = 0;
    let craftable = 0;
    for (const item of items) {
      const typeId = Number(item.typeId || item.type?.id || 0);
      const isRune =
        typeId === 78 || typeId === 18 || runeIdsSet.has(item.id);
      if (craftableItemIds.has(item.id)) craftable++;
      else if (!isRune) resources++;
    }
    return { all: items.length, resources, craftable };
  }, [items, craftableItemIds]);

  const refreshPrices = useCallback(() => {
    const updatedPrices = getStoredMarketPrices();
    setMarketPrices(updatedPrices);
    setPriceUpdatedAt(getStoredPriceUpdatedAt());
    void fetchLatestPriceChanges().then((changes) => {
      if (changes) setPriceChanges(changes);
    });
    const newDrafts: Record<number, string> = {};
    for (const [id, price] of Object.entries(updatedPrices)) {
      if (Number(price) > 0) newDrafts[Number(id)] = String(price);
    }
    setPriceDrafts(newDrafts);
  }, []);

  const refreshSalesVolumes = useCallback(() => {
    setSalesVolumes(getStoredSalesVolumeMap());
  }, []);

  return {
    items,
    marketPrices,
    setMarketPrices,
    priceUpdatedAt,
    setPriceUpdatedAt,
    priceProfiles,
    setPriceProfiles,
    activePriceProfileId,
    setActivePriceProfileId,
    searchTerm,
    setSearchTerm,
    activeCategory,
    setActiveCategory,
    activeScope,
    setActiveScope,
    sortByField,
    setSortByField,
    salesVolumes,
    setSalesVolumes,
    currentPage,
    setCurrentPage,
    savedFeedbackItemId,
    isGlobalHistoryOpen,
    setIsGlobalHistoryOpen,
    isSnifferModalOpen,
    setIsSnifferModalOpen,
    isBackupModalOpen,
    setIsBackupModalOpen,
    itemForHistory,
    setItemForHistory,
    itemForSalesVolume,
    setItemForSalesVolume,
    viewMode,
    setViewMode,
    priceChanges,
    addedCartItemIds,
    copiedItemId,
    priceDrafts,
    setPriceDrafts,
    recipeIngredientIds,
    craftableItemIds,
    filteredItems,
    totalPages,
    safeCurrentPage,
    paginatedItems,
    categoryCounts,
    scopeCounts,
    handlePriceUpdate,
    handlePriceDraftChange,
    handleQuickAddPrice,
    handleAddToShoppingList,
    handleCopyItemName,
    handleChangeProfile,
    refreshPrices,
    refreshSalesVolumes,
  };
}
