import { useState, useEffect, useMemo, useRef } from 'react';
import { DofusItem, MarketPriceMap, PriceProfile } from '../../types';
import { isPetItem } from '../../data/dofusJobs';
import { useUserJobs } from '../../hooks/useUserJobs';
import {
  calculateItemCrushing,
  CrushingResult,
  DOFUS_BASE_RUNES,
  saveItemCoefficient,
  getAllSavedItemCoefficients,
  getAllSavedItemCoefficientTimestamps,
  getAllSavedItemManualEdits,
} from '../../data/dofusRuneWeights';
import {
  CraftableItem,
  getCrushableItemsSnapshot,
  getItemName,
  getItemTypeName,
  getStoredMarketPrices,
  getStoredPriceUpdatedAt,
  getStoredRecipes,
  getLowestDetectedPrice,
  calculateSubCraftCost,
  fetchRecipeByResultId,
  fetchItemDetailsById,
  getImportedItems,
  initializeDatabase,
  saveMarketPrice,
  getActivePriceProfile,
  saveProfileCoefficient,
} from '../../services/dofusDbService';
import { matchesSearchQuery } from '../../utils/searchUtils';
import {
  isBycResource,
  analyzeBycResourceCost,
  getOptimizedIngredientCost,
  getStoredBycMethods,
  saveStoredBycMethod,
} from '../../services/bycCostService';
import { RecipeIngredientDetail } from './RecipeSidebar';
import {
  CrushingCalculatorProps,
  CrushingViewMode,
  DateFilterOption,
  SortOption,
  ProcessedCatalogItem,
  CRUSHING_STATE_KEY,
  FILTER_PERSISTENCE_KEY,
} from './types';
import {
  getInitialSavedViewState,
  getInitialSavedFilters,
  EQUIPMENT_SLOTS,
  ALL_STAT_FILTERS,
} from './utils';

export function useCrushingCalculator({
  initialSelectedItem,
}: CrushingCalculatorProps) {
  const savedViewState = useMemo(() => getInitialSavedViewState(), []);

  // Navigation View Mode
  const [viewMode, setViewMode] = useState<CrushingViewMode>(savedViewState.viewMode ?? 'catalog');

  // Database & Cache state
  const { isEnabled: isUserJobsEnabled, canCraftOrMage } = useUserJobs();
  const [activeProfile, setActiveProfile] = useState<PriceProfile | undefined>(() => getActivePriceProfile());
  const [marketPrices, setMarketPrices] = useState<MarketPriceMap>({});
  const [, setPriceUpdatedAt] = useState<Record<number, number>>({});
  const [crushableItems, setCrushableItems] = useState<CraftableItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<CraftableItem | null>(null);
  const selectedItemRef = useRef<CraftableItem | null>(null);

  useEffect(() => {
    selectedItemRef.current = selectedItem;
  }, [selectedItem]);

  const [savedCoefficients, setSavedCoefficients] = useState<Record<number, number>>({});
  const [savedTimestamps, setSavedTimestamps] = useState<Record<number, number>>({});
  const [savedManualEdits, setSavedManualEdits] = useState<Record<number, number>>({});
  const [isDofocusModalOpen, setIsDofocusModalOpen] = useState<boolean>(false);

  // Persist current viewMode and selectedItem in storage
  useEffect(() => {
    try {
      localStorage.setItem(
        CRUSHING_STATE_KEY,
        JSON.stringify({
          viewMode,
          selectedItemId: selectedItem?.id ?? null,
        })
      );
    } catch (e) {
      console.error('Error saving crushing view state:', e);
    }
  }, [viewMode, selectedItem]);

  // Catalog Filters State
  const savedFilters = useMemo(() => getInitialSavedFilters(), []);

  const [searchQuery, setSearchQuery] = useState<string>(savedFilters.searchQuery ?? '');
  const [selectedSlots, setSelectedSlots] = useState<string[]>(savedFilters.selectedSlots ?? []);
  const [minLevel, setMinLevel] = useState<number | ''>(savedFilters.minLevel ?? '');
  const [maxLevel, setMaxLevel] = useState<number | ''>(savedFilters.maxLevel ?? '');
  const [minCoeff, setMinCoeff] = useState<number | ''>(savedFilters.minCoeff ?? '');
  const [maxCoeff, setMaxCoeff] = useState<number | ''>(savedFilters.maxCoeff ?? '');
  const [selectedStatFilterIds, setSelectedStatFilterIds] = useState<string[]>(
    savedFilters.selectedStatFilterIds ?? []
  );
  const [dateFilter, setDateFilter] = useState<DateFilterOption>(savedFilters.dateFilter ?? 'all');
  const [sortBy, setSortBy] = useState<SortOption>(savedFilters.sortBy ?? 'profit_desc');
  const [currentPage, setCurrentPage] = useState<number>(savedFilters.currentPage ?? 1);
  const [isStatsFilterOpen, setIsStatsFilterOpen] = useState<boolean>(
    savedFilters.isStatsFilterOpen ?? false
  );
  const PAGE_SIZE = 24;

  // Persist filter settings
  useEffect(() => {
    try {
      localStorage.setItem(
        FILTER_PERSISTENCE_KEY,
        JSON.stringify({
          searchQuery,
          selectedSlots,
          minLevel,
          maxLevel,
          minCoeff,
          maxCoeff,
          selectedStatFilterIds,
          dateFilter,
          sortBy,
          currentPage,
          isStatsFilterOpen,
        })
      );
    } catch (e) {
      console.error('Error saving filters:', e);
    }
  }, [
    searchQuery,
    selectedSlots,
    minLevel,
    maxLevel,
    minCoeff,
    maxCoeff,
    selectedStatFilterIds,
    dateFilter,
    sortBy,
    currentPage,
    isStatsFilterOpen,
  ]);

  // Detail Simulator State
  const [coefficientPercent, setCoefficientPercent] = useState<number>(100);
  const [customStatValues, setCustomStatValues] = useState<Record<number, number>>({});
  const [focusedRuneId, setFocusedRuneId] = useState<number | null>(null);
  const [savedCoeffFeedback, setSavedCoeffFeedback] = useState<boolean>(false);
  const [detailSearchQuery, setDetailSearchQuery] = useState<string>('');
  const [isDetailSearchOpen, setIsDetailSearchOpen] = useState<boolean>(false);
  const detailSearchContainerRef = useRef<HTMLDivElement>(null);

  // Recipe ingredients state for detail view
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredientDetail[]>([]);
  const [ingredientDrafts, setIngredientDrafts] = useState<Record<number, string>>({});
  const [itemHdvPriceDraft, setItemHdvPriceDraft] = useState<string>('');
  const [savedIngFeedback, setSavedIngFeedback] = useState<number | null>(null);
  const [savedHdvFeedback, setSavedHdvFeedback] = useState<boolean>(false);

  // Inline rune price drafts
  const [runePriceDrafts, setRunePriceDrafts] = useState<Record<number, string>>({});
  const [savedRuneIdFeedback, setSavedRuneIdFeedback] = useState<number | null>(null);

  // HDV Runas Sub-Tab State
  const [runeCategoryFilter, setRuneCategoryFilter] = useState<
    'all' | 'especial' | 'primaria' | 'dano' | 'resistencia' | 'secundaria'
  >('all');
  const [runeSearchTerm, setRuneSearchTerm] = useState<string>('');

  // ByC Methods
  const [selectedBycMethods, setSelectedBycMethods] = useState<Record<number, 'direct' | 'fragments' | 'map'>>(() =>
    getStoredBycMethods()
  );

  const handleSaveSelectedBycMethod = (resourceId: number, method: 'direct' | 'fragments' | 'map') => {
    saveStoredBycMethod(resourceId, method);
    setSelectedBycMethods((prev) => ({ ...prev, [resourceId]: method }));
  };

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        detailSearchContainerRef.current &&
        !detailSearchContainerRef.current.contains(e.target as Node)
      ) {
        setIsDetailSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Hydrate local database state
  const hydrate = () => {
    const currentProfile = getActivePriceProfile();
    setActiveProfile(currentProfile);
    const storedPrices = getStoredMarketPrices();
    setMarketPrices(storedPrices);
    setPriceUpdatedAt(getStoredPriceUpdatedAt());
    const snapshot = getCrushableItemsSnapshot().filter((item) => !isPetItem(item));
    setCrushableItems(snapshot);
    setSavedCoefficients(getAllSavedItemCoefficients(currentProfile?.slug));
    setSavedTimestamps(getAllSavedItemCoefficientTimestamps(currentProfile?.slug));
    setSavedManualEdits(getAllSavedItemManualEdits(currentProfile?.slug));

    const initialRuneDrafts: Record<number, string> = {};
    for (const rune of DOFUS_BASE_RUNES) {
      const p = storedPrices[rune.id] ?? rune.defaultPrice;
      initialRuneDrafts[rune.id] = String(p);
    }
    setRunePriceDrafts(initialRuneDrafts);

    setSelectedItem((prev) => {
      if (prev) {
        const updated = snapshot.find((i) => i.id === prev.id);
        return updated || prev;
      }
      if (initialSelectedItem) {
        const found = snapshot.find((i) => i.id === initialSelectedItem.id) || (initialSelectedItem as any);
        return found;
      }
      if (savedViewState.selectedItemId) {
        const savedItem = snapshot.find((i) => i.id === savedViewState.selectedItemId);
        if (savedItem) return savedItem;
      }
      return null;
    });
  };

  useEffect(() => {
    initializeDatabase()
      .then(() => hydrate())
      .catch((e) => console.error('Error inicializando base en CrushingCalculator:', e));

    let lastPriceEventTime = 0;

    const handlePricesUpdate = (e: any) => {
      lastPriceEventTime = Date.now();
      const customEvent = e as CustomEvent<{
        updatedPrices?: MarketPriceMap;
        priceUpdatedAt?: Record<number, number>;
      }>;
      if (customEvent?.detail?.updatedPrices) {
        setMarketPrices((prev) => ({ ...prev, ...customEvent.detail.updatedPrices }));
        setRunePriceDrafts((prev) => {
          const next = { ...prev };
          let changed = false;
          for (const [idStr, p] of Object.entries(customEvent.detail.updatedPrices!)) {
            const id = Number(idStr);
            if (next[id] !== undefined && next[id] !== String(p)) {
              next[id] = String(p);
              changed = true;
            }
          }
          return changed ? next : prev;
        });
      }
      if (customEvent?.detail?.priceUpdatedAt) {
        setPriceUpdatedAt((prev) => ({ ...prev, ...customEvent.detail.priceUpdatedAt }));
      }
    };

    const handleDbUpdate = () => {
      if (Date.now() - lastPriceEventTime < 100) return;
      hydrate();
    };
    const handleProfileChange = (e: any) => {
      const newProfile = e.detail?.profile || getActivePriceProfile();
      setActiveProfile(newProfile);
      hydrate();
    };
    const handleCoeffUpdate = (e: any) => {
      const currentProfile = getActivePriceProfile();
      const updatedCoeffs = getAllSavedItemCoefficients(currentProfile?.slug);
      setSavedCoefficients(updatedCoeffs);
      setSavedTimestamps(getAllSavedItemCoefficientTimestamps(currentProfile?.slug));
      setSavedManualEdits(getAllSavedItemManualEdits(currentProfile?.slug));
      if (selectedItemRef.current) {
        const currentId = selectedItemRef.current.id;
        const targetItemId = e?.detail?.itemId;
        if ((!targetItemId || targetItemId === currentId) && updatedCoeffs[currentId]) {
          setCoefficientPercent(updatedCoeffs[currentId]);
        }
      }
    };

    window.addEventListener('dofus_prices_updated', handlePricesUpdate);
    window.addEventListener('dofus_database_updated', handleDbUpdate);
    window.addEventListener('dofus_profile_changed', handleProfileChange);
    window.addEventListener('dofus_coefficients_updated', handleCoeffUpdate);
    return () => {
      window.removeEventListener('dofus_prices_updated', handlePricesUpdate);
      window.removeEventListener('dofus_database_updated', handleDbUpdate);
      window.removeEventListener('dofus_profile_changed', handleProfileChange);
      window.removeEventListener('dofus_coefficients_updated', handleCoeffUpdate);
    };
  }, []);

  // Update coefficient when selecting new item
  useEffect(() => {
    if (!selectedItem) return;
    const currentProfile = activeProfile || getActivePriceProfile();
    const saved = savedCoefficients[selectedItem.id];
    setCoefficientPercent(saved ?? 100);
    setCustomStatValues({});
    setFocusedRuneId(null);
  }, [selectedItem?.id, activeProfile]);

  const getItemCraftCost = (item: CraftableItem): number => {
    if (!item.recipeData?.ingredientIds || item.recipeData.ingredientIds.length === 0) {
      return item.defaultCraftCost || 0;
    }
    let total = 0;
    const { ingredientIds, quantities } = item.recipeData;
    const recipesMap = getStoredRecipes();
    for (let i = 0; i < ingredientIds.length; i += 1) {
      const ingId = ingredientIds[i];
      const qty = quantities?.[i] || 1;

      if (isBycResource(ingId)) {
        const preferredMethod = selectedBycMethods[ingId];
        const bycCostInfo = getOptimizedIngredientCost(ingId, marketPrices, preferredMethod);
        total += bycCostInfo.cost * qty;
      } else {
        const ingPrice = getLowestDetectedPrice(ingId, marketPrices, recipesMap);
        total += ingPrice * qty;
      }
    }
    return total;
  };

  // Resolve recipe ingredients and HDV price draft for detail view
  useEffect(() => {
    if (!selectedItem) {
      setRecipeIngredients([]);
      return;
    }

    const currentHdvPrice = marketPrices[selectedItem.id] ?? selectedItem.defaultMarketSalePrice ?? 0;
    setItemHdvPriceDraft(String(currentHdvPrice));

    const loadIngredients = async () => {
      let recipe = selectedItem.recipeData;
      if (!recipe || !recipe.ingredientIds || recipe.ingredientIds.length === 0) {
        recipe = (await fetchRecipeByResultId(selectedItem.id)) || undefined;
      }

      if (!recipe || !recipe.ingredientIds || recipe.ingredientIds.length === 0) {
        setRecipeIngredients([]);
        return;
      }

      const recipesMap = getStoredRecipes();
      const importedList = getImportedItems();
      const importedMap = new Map<number, DofusItem>();
      importedList.forEach((i) => importedMap.set(i.id, i));

      const ingDetails: RecipeIngredientDetail[] = [];
      const drafts: Record<number, string> = {};

      for (let i = 0; i < recipe.ingredientIds.length; i++) {
        const ingId = recipe.ingredientIds[i];
        const qty = recipe.quantities?.[i] || 1;
        let ingItem = importedMap.get(ingId);
        if (!ingItem) {
          ingItem = (await fetchItemDetailsById(ingId)) || undefined;
        }

        const isByc = isBycResource(ingId);
        const bycAnalysis = isByc ? analyzeBycResourceCost(ingId, marketPrices) || undefined : undefined;
        const selectedBycMethod = selectedBycMethods[ingId] || (bycAnalysis?.bestMethod ?? 'direct');

        const directBuyPrice = marketPrices[ingId] || 0;
        const subCraftCost = calculateSubCraftCost(ingId, marketPrices, recipesMap);
        const isCraftable = subCraftCost > 0;

        let unitPrice = directBuyPrice;
        let isCraftCheaper = false;

        if (isByc && bycAnalysis) {
          if (selectedBycMethod === 'fragments') {
            unitPrice = bycAnalysis.fragmentsPrice;
          } else if (selectedBycMethod === 'map') {
            unitPrice = bycAnalysis.mapPrice;
          } else {
            unitPrice = bycAnalysis.directPrice;
          }
        } else if (isCraftable && directBuyPrice > 0) {
          if (subCraftCost < directBuyPrice) {
            unitPrice = subCraftCost;
            isCraftCheaper = true;
          } else {
            unitPrice = directBuyPrice;
          }
        } else if (isCraftable && directBuyPrice === 0) {
          unitPrice = subCraftCost;
          isCraftCheaper = true;
        }

        drafts[ingId] = String(marketPrices[ingId] || 0);

        ingDetails.push({
          id: ingId,
          name: ingItem ? getItemName(ingItem) : `Ingrediente #${ingId}`,
          iconId: ingItem?.iconId || (ingItem as any)?.icon_id || ingId,
          quantity: qty,
          unitPrice,
          marketBuyPrice: directBuyPrice,
          subCraftCost,
          isCraftable,
          isCraftCheaper,
          totalCost: unitPrice * qty,
          isByc,
          bycAnalysis,
          selectedBycMethod,
        });
      }

      setRecipeIngredients(ingDetails);
      setIngredientDrafts((prev) => ({ ...drafts, ...prev }));
    };

    void loadIngredients();
  }, [selectedItem?.id, marketPrices, selectedBycMethods]);

  // Run calculation for current selected item in Detail view
  const crushingSimulation = useMemo<CrushingResult | null>(() => {
    if (!selectedItem) return null;
    const detailCraftCost =
      recipeIngredients.length > 0
        ? recipeIngredients.reduce((sum, ing) => sum + (ing.totalCost || 0), 0)
        : getItemCraftCost(selectedItem);
    return calculateItemCrushing(
      selectedItem,
      coefficientPercent,
      focusedRuneId,
      marketPrices,
      detailCraftCost,
      'avg',
      customStatValues,
    );
  }, [
    selectedItem,
    coefficientPercent,
    focusedRuneId,
    marketPrices,
    customStatValues,
    recipeIngredients,
    selectedBycMethods,
  ]);

  const handleResetStatsToPreset = (mode: 'min' | 'avg' | 'max') => {
    if (!crushingSimulation) return;
    const newValues: Record<number, number> = {};
    for (const st of crushingSimulation.statYields) {
      if (mode === 'min') {
        newValues[st.rune.id] = st.statMin;
      } else if (mode === 'max') {
        newValues[st.rune.id] = st.statMax;
      } else {
        newValues[st.rune.id] = Math.floor((st.statMin + st.statMax) / 2);
      }
    }
    setCustomStatValues(newValues);
  };

  const handleStatChange = (runeId: number, value: string) => {
    const numeric = Math.max(0, Number(value) || 0);
    setCustomStatValues((prev) => ({
      ...prev,
      [runeId]: numeric,
    }));
  };

  const handleSaveItemCoefficient = (
    explicitCoeff?: number,
    options?: { timestamp?: number; isManual?: boolean }
  ) => {
    if (!selectedItem) return;
    const currentProfile = activeProfile || getActivePriceProfile();
    const coeffToSave = typeof explicitCoeff === 'number' ? explicitCoeff : coefficientPercent;
    saveItemCoefficient(selectedItem.id, coeffToSave, currentProfile?.slug, options);
    void saveProfileCoefficient(selectedItem.id, coeffToSave, currentProfile?.id, options);
    setSavedCoefficients(getAllSavedItemCoefficients(currentProfile?.slug));
    setSavedTimestamps(getAllSavedItemCoefficientTimestamps(currentProfile?.slug));
    setSavedManualEdits(getAllSavedItemManualEdits(currentProfile?.slug));
    setSavedCoeffFeedback(true);
    setTimeout(() => setSavedCoeffFeedback(false), 2000);
  };

  const ingDebounceTimersRef = useRef<Record<number, NodeJS.Timeout>>({});
  const runeDebounceTimersRef = useRef<Record<number, NodeJS.Timeout>>({});
  const hdvDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleUpdateIngredientPrice = async (ingId: number, rawValue: string) => {
    if (ingDebounceTimersRef.current[ingId]) {
      clearTimeout(ingDebounceTimersRef.current[ingId]);
    }
    const numeric = Math.max(0, Math.trunc(Number(rawValue) || 0));
    setIngredientDrafts((prev) => ({ ...prev, [ingId]: String(numeric) }));
    setMarketPrices((prev) => ({ ...prev, [ingId]: numeric }));
    await saveMarketPrice(ingId, numeric);
    setSavedIngFeedback(ingId);
    setTimeout(() => setSavedIngFeedback(null), 1500);
  };

  const handleIngredientPriceDraftChange = (ingId: number, rawValue: string) => {
    setIngredientDrafts((prev) => ({ ...prev, [ingId]: rawValue }));
    if (ingDebounceTimersRef.current[ingId]) {
      clearTimeout(ingDebounceTimersRef.current[ingId]);
    }
    ingDebounceTimersRef.current[ingId] = setTimeout(() => {
      void handleUpdateIngredientPrice(ingId, rawValue);
    }, 450);
  };

  const handleUpdateItemHdvPrice = async (rawValue: string) => {
    if (!selectedItem) return;
    if (hdvDebounceTimerRef.current) {
      clearTimeout(hdvDebounceTimerRef.current);
    }
    const numeric = Math.max(0, Math.trunc(Number(rawValue) || 0));
    setItemHdvPriceDraft(String(numeric));
    setMarketPrices((prev) => ({ ...prev, [selectedItem.id]: numeric }));
    await saveMarketPrice(selectedItem.id, numeric);
    setSavedHdvFeedback(true);
    setTimeout(() => setSavedHdvFeedback(false), 1500);
  };

  const handleItemHdvPriceDraftChange = (rawValue: string) => {
    setItemHdvPriceDraft(rawValue);
    if (hdvDebounceTimerRef.current) {
      clearTimeout(hdvDebounceTimerRef.current);
    }
    hdvDebounceTimerRef.current = setTimeout(() => {
      void handleUpdateItemHdvPrice(rawValue);
    }, 450);
  };

  const handleUpdateRunePrice = async (runeId: number, rawValue: string) => {
    if (runeDebounceTimersRef.current[runeId]) {
      clearTimeout(runeDebounceTimersRef.current[runeId]);
    }
    const numeric = Math.max(0, Math.trunc(Number(rawValue) || 0));
    setRunePriceDrafts((prev) => ({ ...prev, [runeId]: String(numeric) }));
    setMarketPrices((prev) => ({ ...prev, [runeId]: numeric }));
    await saveMarketPrice(runeId, numeric);
    setSavedRuneIdFeedback(runeId);
    setTimeout(() => setSavedRuneIdFeedback(null), 1500);
  };

  const handleRunePriceDraftChange = (runeId: number, rawValue: string) => {
    setRunePriceDrafts((prev) => ({ ...prev, [runeId]: rawValue }));
    if (runeDebounceTimersRef.current[runeId]) {
      clearTimeout(runeDebounceTimersRef.current[runeId]);
    }
    runeDebounceTimersRef.current[runeId] = setTimeout(() => {
      void handleUpdateRunePrice(runeId, rawValue);
    }, 450);
  };

  const handleOpenDetail = (item: CraftableItem) => {
    setSelectedItem(item);
    setViewMode('detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleSlot = (slotId: string) => {
    if (slotId === 'all') {
      setSelectedSlots([]);
      return;
    }
    setSelectedSlots((prev) => {
      if (prev.includes(slotId)) {
        return prev.filter((s) => s !== slotId);
      } else {
        return [...prev, slotId];
      }
    });
    setCurrentPage(1);
  };

  const handleToggleStatFilter = (statDef: { id: string }) => {
    setSelectedStatFilterIds((prev) => {
      if (prev.includes(statDef.id)) {
        return prev.filter((id) => id !== statDef.id);
      } else {
        return [...prev, statDef.id];
      }
    });
    setCurrentPage(1);
  };

  const handleClearAllFilters = () => {
    setSearchQuery('');
    setSelectedSlots([]);
    setMinLevel('');
    setMaxLevel('');
    setMinCoeff('');
    setMaxCoeff('');
    setSelectedStatFilterIds([]);
    setDateFilter('all');
    setSortBy('profit_desc');
    setCurrentPage(1);
  };

  const handleClearStatsOnly = () => {
    setSelectedStatFilterIds([]);
    setCurrentPage(1);
  };

  // Compute metrics and filter/sort the entire catalog
  const processedCatalogItems = useMemo<ProcessedCatalogItem[]>(() => {
    const now = Date.now();
    const allStatMap = new Map(ALL_STAT_FILTERS.map((s) => [s.id, s]));
    const targetFilterRuneId = selectedStatFilterIds.length === 1 ? allStatMap.get(selectedStatFilterIds[0])?.runeId : null;

    const candidates = crushableItems.filter((item) => {
      if (isPetItem(item)) return false;
      if (isUserJobsEnabled && !canCraftOrMage(item)) return false;

      const level = item.level || 1;
      const typeId = item.typeId || item.type?.id || 0;

      if (typeof minLevel === 'number' && level < minLevel) return false;
      if (typeof maxLevel === 'number' && level > maxLevel) return false;

      const savedCoeff = savedCoefficients[item.id] ?? 100;
      if (typeof minCoeff === 'number' && savedCoeff < minCoeff) return false;
      if (typeof maxCoeff === 'number' && savedCoeff > maxCoeff) return false;

      const hasCustomCoeff = savedCoefficients[item.id] !== undefined;
      const coeffTimestamp = savedTimestamps[item.id] ?? null;

      if (dateFilter === 'custom_only' && !hasCustomCoeff) return false;
      if (dateFilter === 'default_only' && hasCustomCoeff) return false;
      if (dateFilter === 'today') {
        if (!coeffTimestamp || now - coeffTimestamp > 24 * 60 * 60 * 1000) return false;
      }
      if (dateFilter === '3days') {
        if (!coeffTimestamp || now - coeffTimestamp > 3 * 24 * 60 * 60 * 1000) return false;
      }
      if (dateFilter === 'week') {
        if (!coeffTimestamp || now - coeffTimestamp > 7 * 24 * 60 * 60 * 1000) return false;
      }
      if (dateFilter === 'month') {
        if (!coeffTimestamp || now - coeffTimestamp > 30 * 24 * 60 * 60 * 1000) return false;
      }

      if (selectedSlots.length > 0) {
        let matchesSlot = false;
        for (const slotId of selectedSlots) {
          if (slotId === 'arma') {
            if (item.jobId === 11 || item.jobId === 13 || [2, 3, 4, 5, 6, 7, 8, 19, 20, 21, 22, 212].includes(typeId)) {
              matchesSlot = true;
              break;
            }
          }
          const slotDef = EQUIPMENT_SLOTS.find((s) => s.id === slotId);
          if (slotDef) {
            if (slotDef.jobId && item.jobId === slotDef.jobId) {
              matchesSlot = true;
              break;
            }
            if (slotDef.typeIds.includes(typeId)) {
              matchesSlot = true;
              break;
            }
          }
        }
        if (!matchesSlot) return false;
      }

      if (searchQuery.trim().length > 0) {
        if (
          !matchesSearchQuery(
            [
              getItemName(item),
              getItemTypeName(item),
              item.jobNameEs,
              item.id,
            ],
            searchQuery,
          )
        ) {
          return false;
        }
      }

      if (selectedStatFilterIds.length > 0) {
        const effs = item.possibleEffects || item.effects || [];
        for (const statId of selectedStatFilterIds) {
          const statDef = allStatMap.get(statId);
          if (!statDef) continue;
          if (statDef.textKey) {
            const matchesText = effs.some((eff) => {
              const formatted = (eff.formatted || eff.characteristicName || '').toLowerCase();
              if (statDef.textKey === 'trampa') return formatted.includes('trampa');
              if (statDef.textKey === 'pot_trampa') return formatted.includes('trampa') && (formatted.includes('potencia') || formatted.includes('%'));
              if (statDef.textKey === 'reenvio') return formatted.includes('reenvío') || formatted.includes('reenvio') || formatted.includes('renvoi');
              return false;
            });
            if (!matchesText) return false;
          }
        }
      }

      return true;
    });

    const results: ProcessedCatalogItem[] = candidates.map((item) => {
      const singleCraftCost = getItemCraftCost(item);
      const savedCoeff = savedCoefficients[item.id] ?? 100;
      const coeffTimestamp = savedTimestamps[item.id] ?? null;

      const sim = calculateItemCrushing(
        item,
        savedCoeff,
        null,
        marketPrices,
        singleCraftCost,
        'avg',
        {},
      );

      const bestStrat = sim.bestFocusOption;
      const bestStratProfit = bestStrat ? bestStrat.netProfit : sim.normalNetProfit;
      const bestStratValue = bestStrat ? bestStrat.totalKamasValue : sim.normalTotalKamasValue;
      const bestStratRoi = bestStrat ? bestStrat.roiPercent : sim.normalRoiPercent;
      const bestStratIsNormal = bestStrat ? Boolean(bestStrat.isNormal) : true;
      const bestStratRune = bestStrat && !bestStrat.isNormal ? bestStrat.rune : null;

      const targetRuneYield = targetFilterRuneId ? (sim.statYields.find(st => st.rune.id === targetFilterRuneId) || null) : null;
      const runeSpecificRunes = targetRuneYield ? targetRuneYield.normalRunesPerItem : 0;
      const runeSpecificKamas = targetRuneYield ? targetRuneYield.normalKamasValue : 0;

      return {
        item,
        level: item.level || 1,
        typeId: item.typeId || item.type?.id || 0,
        jobId: item.jobId,
        jobNameEs: item.jobNameEs,
        singleCraftCost,
        savedCoeff,
        coeffTimestamp,
        isManualEdit: Boolean(savedManualEdits[item.id]),
        hasCustomCoeff: savedCoefficients[item.id] !== undefined,
        sim,
        normalProfit: sim.normalNetProfit,
        normalValue: sim.normalTotalKamasValue,
        normalRoi: sim.normalRoiPercent,
        bestFocusProfit: bestStratProfit,
        bestFocusValue: bestStratValue,
        bestFocusRoi: bestStratRoi,
        bestFocusRune: bestStratRune,
        bestStratIsNormal,
        maxProfit: bestStratProfit,
        maxKamasValue: bestStratValue,
        maxRoi: bestStratRoi,
        breakEvenCoeff: sim.breakEvenCoefficient,
        targetRuneYield,
        runeSpecificRunes,
        runeSpecificKamas,
      };
    });

    const filtered = selectedStatFilterIds.length > 0
      ? results.filter((entry) => {
          for (const statId of selectedStatFilterIds) {
            const statDef = allStatMap.get(statId);
            if (!statDef) continue;
            if (statDef.runeId) {
              const matchesStat = entry.sim.statYields.some((st) => st.rune.id === statDef.runeId);
              if (!matchesStat) return false;
            }
          }
          return true;
        })
      : results;

    return filtered.sort((a, b) => {
      if (sortBy === 'profit_desc') return b.maxProfit - a.maxProfit;
      if (sortBy === 'coeff_desc') return b.savedCoeff - a.savedCoeff;
      if (sortBy === 'roi_desc') return b.maxRoi - a.maxRoi;
      if (sortBy === 'breakeven_asc') return a.breakEvenCoeff - b.breakEvenCoeff;
      if (sortBy === 'cost_asc') return a.singleCraftCost - b.singleCraftCost;
      if (sortBy === 'level_desc') return b.level - a.level;
      if (sortBy === 'date_desc') return (b.coeffTimestamp || 0) - (a.coeffTimestamp || 0);
      return 0;
    });
  }, [
    crushableItems,
    marketPrices,
    savedCoefficients,
    savedTimestamps,
    searchQuery,
    selectedSlots,
    minLevel,
    maxLevel,
    minCoeff,
    maxCoeff,
    selectedStatFilterIds,
    dateFilter,
    sortBy,
    isUserJobsEnabled,
    canCraftOrMage,
    selectedBycMethods,
  ]);

  const totalPages = Math.max(1, Math.ceil(processedCatalogItems.length / PAGE_SIZE));
  const paginatedCatalogItems = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return processedCatalogItems.slice(start, start + PAGE_SIZE);
  }, [processedCatalogItems, currentPage]);

  const detailSearchResults = useMemo(() => {
    if (!detailSearchQuery.trim()) return crushableItems.slice(0, 20);
    const q = detailSearchQuery.toLowerCase().trim();
    return crushableItems
      .filter((i) => {
        const name = getItemName(i).toLowerCase();
        const type = getItemTypeName(i).toLowerCase();
        return name.includes(q) || type.includes(q) || String(i.id).includes(q);
      })
      .slice(0, 20);
  }, [crushableItems, detailSearchQuery]);

  const filteredBaseRunes = useMemo(() => {
    return DOFUS_BASE_RUNES.filter((rune) => {
      if (runeCategoryFilter !== 'all' && rune.category !== runeCategoryFilter) {
        return false;
      }
      if (runeSearchTerm.trim().length > 0) {
        const q = runeSearchTerm.toLowerCase().trim();
        return (
          rune.name.toLowerCase().includes(q) ||
          rune.shortCode.toLowerCase().includes(q) ||
          rune.description.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [runeCategoryFilter, runeSearchTerm]);

  const handleDofocusSyncCompleted = () => {
    const updatedCoeffs = getAllSavedItemCoefficients(activeProfile?.slug);
    const updatedTimestamps = getAllSavedItemCoefficientTimestamps(activeProfile?.slug);
    const updatedManual = getAllSavedItemManualEdits(activeProfile?.slug);
    setSavedCoefficients(updatedCoeffs);
    setSavedTimestamps(updatedTimestamps);
    setSavedManualEdits(updatedManual);
    if (selectedItem && updatedCoeffs[selectedItem.id]) {
      setCoefficientPercent(updatedCoeffs[selectedItem.id]);
    }
  };

  return {
    viewMode,
    setViewMode,
    activeProfile,
    marketPrices,
    crushableItems,
    selectedItem,
    setSelectedItem,
    savedCoefficients,
    savedTimestamps,
    savedManualEdits,
    isDofocusModalOpen,
    setIsDofocusModalOpen,
    searchQuery,
    setSearchQuery,
    selectedSlots,
    minLevel,
    setMinLevel,
    maxLevel,
    setMaxLevel,
    minCoeff,
    setMinCoeff,
    maxCoeff,
    setMaxCoeff,
    selectedStatFilterIds,
    dateFilter,
    setDateFilter,
    sortBy,
    setSortBy,
    currentPage,
    setCurrentPage,
    isStatsFilterOpen,
    setIsStatsFilterOpen,
    coefficientPercent,
    setCoefficientPercent,
    focusedRuneId,
    setFocusedRuneId,
    savedCoeffFeedback,
    detailSearchQuery,
    setDetailSearchQuery,
    isDetailSearchOpen,
    setIsDetailSearchOpen,
    detailSearchContainerRef,
    recipeIngredients,
    ingredientDrafts,
    itemHdvPriceDraft,
    savedIngFeedback,
    savedHdvFeedback,
    runePriceDrafts,
    setRunePriceDrafts,
    savedRuneIdFeedback,
    runeCategoryFilter,
    setRuneCategoryFilter,
    runeSearchTerm,
    setRuneSearchTerm,
    selectedBycMethods,
    handleSaveSelectedBycMethod,
    crushingSimulation,
    handleResetStatsToPreset,
    handleStatChange,
    handleSaveItemCoefficient,
    handleIngredientPriceDraftChange,
    handleUpdateIngredientPrice,
    handleItemHdvPriceDraftChange,
    handleRunePriceDraftChange,
    handleUpdateRunePrice,
    handleDofocusSyncCompleted,
    handleOpenDetail,
    handleToggleSlot,
    handleToggleStatFilter,
    handleClearAllFilters,
    handleClearStatsOnly,
    processedCatalogItems,
    totalPages,
    paginatedCatalogItems,
    detailSearchResults,
    filteredBaseRunes,
    isUserJobsEnabled,
  };
}
