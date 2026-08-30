import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Zap,
  Search,
  Coins,
  Sparkles,
  Trophy,
  RotateCcw,
  Check,
  Tag,
  Shield,
  Sword,
  Wand2,
  Gem,
  Footprints,
  Scissors,
  Crosshair,
  Save,
  Percent,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  X,
  Sliders,
  Layers,
  Store,
  Calendar,
  Clock,
  Filter,
  ArrowUpDown,
  CheckCircle2,
  ExternalLink,
  Flame,
  Droplet,
  Wind,
  Mountain,
  CircleDot,
  TrendingUp,
  Crown,
  Disc,
  Eye,
  Target,
  Heart,
  Moon,
  RefreshCw,
} from 'lucide-react';
import { DofusItem, MarketPriceMap, PriceProfile } from '../types';
import {
  CRUSHING_ALLOWED_JOBS,
  isPetItem,
} from '../data/dofusJobs';
import {
  BASE_RUNES_BY_ID,
  BaseRuneDefinition,
  calculateItemCrushing,
  CrushingResult,
  DOFUS_BASE_RUNES,
  getSavedItemCoefficient,
  getItemCoefficientTimestamp,
  saveItemCoefficient,
  getAllSavedItemCoefficients,
  getAllSavedItemCoefficientTimestamps,
  TopFocusOption,
} from '../data/dofusRuneWeights';
import { DofocusSyncModal } from './crushing/DofocusSyncModal';
import {
  CraftableItem,
  getCrushableItemsSnapshot,
  getItemFallbackIconUrl,
  getItemIconUrl,
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
} from '../services/dofusDbService';
import { SafeImage } from './SafeImage';
import { RuneIcon } from './RuneIcon';
import { KamaDisplay } from './common/KamaDisplay';
import { RecipeSidebar, RecipeIngredientDetail } from './crushing/RecipeSidebar';
import { CrushingRunesTable } from './crushing/CrushingRunesTable';
import { CrushingStrategyHero } from './crushing/CrushingStrategyHero';
import { matchesSearchQuery } from '../utils/searchUtils';
import { isBycResource, analyzeBycResourceCost, getOptimizedIngredientCost } from '../services/bycCostService';

interface CrushingCalculatorProps {
  initialSelectedItem?: DofusItem | null;
  onSelectRecipeForCalculator?: (item: DofusItem) => void;
}

type CrushingViewMode = 'catalog' | 'detail' | 'rune_prices';

type DateFilterOption =
  | 'all'
  | 'custom_only'
  | 'today'
  | '3days'
  | 'week'
  | 'month'
  | 'default_only';

type SortOption =
  | 'profit_desc'
  | 'coeff_desc'
  | 'rune_profit_desc'
  | 'roi_desc'
  | 'breakeven_asc'
  | 'cost_asc'
  | 'level_desc'
  | 'date_desc';

const FILTER_PERSISTENCE_KEY = 'dofus_crushing_filters_v2';
const CRUSHING_STATE_KEY = 'dofus_crushing_state_v2';

interface SavedFiltersState {
  searchQuery?: string;
  selectedSlots?: string[];
  minLevel?: number | '';
  maxLevel?: number | '';
  minCoeff?: number | '';
  maxCoeff?: number | '';
  selectedStatFilterIds?: string[];
  dateFilter?: DateFilterOption;
  sortBy?: SortOption;
  currentPage?: number;
  isStatsFilterOpen?: boolean;
}

interface SavedCrushingViewState {
  viewMode?: CrushingViewMode;
  selectedItemId?: number | null;
}

const getInitialSavedViewState = (): SavedCrushingViewState => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(CRUSHING_STATE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error loading saved view state:', e);
  }
  return {};
};

const getInitialSavedFilters = (): SavedFiltersState => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(FILTER_PERSISTENCE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error loading saved filters:', e);
  }
  return {};
};

const JOB_ICONS_MAP: Record<number, React.ComponentType<{ className?: string }>> = {
  27: Scissors, // Sastre
  16: Gem, // Joyero
  15: Footprints, // Zapatero
  60: Shield, // Fabricante
  11: Sword, // Herrero
  13: Wand2, // Escultor
};

function formatTimeAgo(ts: number | null | undefined): string {
  if (!ts) return 'Por defecto';
  const diffMs = Date.now() - ts;
  const diffMin = Math.floor(diffMs / (1000 * 60));
  if (diffMin < 1) return 'Hace un momento';
  if (diffMin < 60) return `Hace ${diffMin}m`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Hace ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays}d`;
  const d = new Date(ts);
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}

function formatFullDate(ts: number | null | undefined): string {
  if (!ts) return 'No registrado aún (100% por defecto)';
  const d = new Date(ts);
  return `${d.toLocaleDateString()} a las ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export const CrushingCalculator: React.FC<CrushingCalculatorProps> = ({
  initialSelectedItem,
  onSelectRecipeForCalculator,
}) => {
  const savedViewState = useMemo(() => getInitialSavedViewState(), []);

  // Navigation View Mode: 'catalog' (Listado) vs 'detail' (Simulador Detallado) vs 'rune_prices' (HDV Runas)
  const [viewMode, setViewMode] = useState<CrushingViewMode>(savedViewState.viewMode ?? 'catalog');
  
  // Database & Cache state
  const [activeProfile, setActiveProfile] = useState<PriceProfile | undefined>(() => getActivePriceProfile());
  const [marketPrices, setMarketPrices] = useState<MarketPriceMap>({});
  const [priceUpdatedAt, setPriceUpdatedAt] = useState<Record<number, number>>({});
  const [crushableItems, setCrushableItems] = useState<CraftableItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<CraftableItem | null>(null);
  const [savedCoefficients, setSavedCoefficients] = useState<Record<number, number>>({});
  const [savedTimestamps, setSavedTimestamps] = useState<Record<number, number>>({});
  const [isDofocusModalOpen, setIsDofocusModalOpen] = useState<boolean>(false);

  // Persist current viewMode and selectedItem in storage so switching tabs keeps exact section
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

  // =========================================================================
  // CATALOG ADVANCED FILTERS & STATE (Persistent across page reloads/views)
  // =========================================================================
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

  // Persist filter settings to localStorage
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

  // =========================================================================
  // DETAIL SIMULATOR STATE
  // =========================================================================
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

    // Initialize rune price drafts
    const initialRuneDrafts: Record<number, string> = {};
    for (const rune of DOFUS_BASE_RUNES) {
      const p = storedPrices[rune.id] ?? rune.defaultPrice;
      initialRuneDrafts[rune.id] = String(p);
    }
    setRunePriceDrafts(initialRuneDrafts);

    // Restore previous selected item if not already selected
    setSelectedItem((prev) => {
      if (prev) {
        // Keep updated item from latest snapshot if matching id
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

    const handleDbUpdate = () => hydrate();
    const handleProfileChange = (e: any) => {
      const newProfile = e.detail?.profile || getActivePriceProfile();
      setActiveProfile(newProfile);
      hydrate();
    };
    const handleCoeffUpdate = () => {
      const currentProfile = getActivePriceProfile();
      setSavedCoefficients(getAllSavedItemCoefficients(currentProfile?.slug));
      setSavedTimestamps(getAllSavedItemCoefficientTimestamps(currentProfile?.slug));
    };

    window.addEventListener('dofus_database_updated', handleDbUpdate);
    window.addEventListener('dofus_profile_changed', handleProfileChange);
    window.addEventListener('dofus_coefficients_updated', handleCoeffUpdate);
    return () => {
      window.removeEventListener('dofus_database_updated', handleDbUpdate);
      window.removeEventListener('dofus_profile_changed', handleProfileChange);
      window.removeEventListener('dofus_coefficients_updated', handleCoeffUpdate);
    };
  }, []);

  // Track last handled external initialSelectedItem to prevent reverting on recalculations
  const lastHandledInitialItemRef = useRef<number | null>(null);

  // Handle external navigation with initialSelectedItem (only when prop explicitly changes to a new item)
  useEffect(() => {
    if (initialSelectedItem && initialSelectedItem.id !== lastHandledInitialItemRef.current) {
      lastHandledInitialItemRef.current = initialSelectedItem.id;
      const found = crushableItems.find((i) => i.id === initialSelectedItem.id) || (initialSelectedItem as any);
      setSelectedItem(found);
      setViewMode('detail');
    }
  }, [initialSelectedItem, crushableItems]);

  // Load saved coefficient when selectedItem changes
  useEffect(() => {
    if (selectedItem) {
      const saved = getSavedItemCoefficient(selectedItem.id);
      setCoefficientPercent(saved || 100);
      setFocusedRuneId(null);
      setCustomStatValues({});
    }
  }, [selectedItem?.id]);

  // Track custom selected ByC method per ingredient (e.g., 'direct', 'fragments', 'map')
  const [selectedBycMethods, setSelectedBycMethods] = useState<Record<number, 'direct' | 'fragments' | 'map'>>({});

  // Compute craft cost for an item using lowest detected ingredient prices & ByC optimal costs
  const getItemCraftCost = (item: CraftableItem): number => {
    if (!item.recipeData || !item.recipeData.ingredientIds || item.recipeData.ingredientIds.length === 0) {
      return marketPrices[item.id] || item.defaultMarketSalePrice || 0;
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

        drafts[ingId] = String(marketPrices[ingId] ?? unitPrice);

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
    const singleCraftCost = getItemCraftCost(selectedItem);
    return calculateItemCrushing(
      selectedItem,
      coefficientPercent,
      focusedRuneId,
      marketPrices,
      singleCraftCost,
      'avg',
      customStatValues,
    );
  }, [
    selectedItem,
    coefficientPercent,
    focusedRuneId,
    marketPrices,
    customStatValues,
  ]);

  // Quick reset buttons to set all stats to Min, Avg, or Max
  const handleResetStatsToPreset = (mode: 'min' | 'avg' | 'max') => {
    if (!crushingSimulation) return;
    const newValues: Record<number, number> = {};
    for (const st of crushingSimulation.statYields) {
      if (mode === 'min') {
        newValues[st.rune.id] = st.statMin;
      } else if (mode === 'max') {
        newValues[st.rune.id] = st.statMax;
      } else {
        newValues[st.rune.id] = Math.ceil((st.statMin + st.statMax) / 2);
      }
    }
    setCustomStatValues(newValues);
  };

  // Handle individual stat value change in detail view
  const handleStatChange = (runeId: number, value: string) => {
    const numeric = Math.max(0, Number(value) || 0);
    setCustomStatValues((prev) => ({
      ...prev,
      [runeId]: numeric,
    }));
  };

  // Handle saving coefficient for current item
  const handleSaveItemCoefficient = () => {
    if (!selectedItem) return;
    saveItemCoefficient(selectedItem.id, coefficientPercent);
    setSavedCoefficients(getAllSavedItemCoefficients());
    setSavedTimestamps(getAllSavedItemCoefficientTimestamps());
    setSavedCoeffFeedback(true);
    setTimeout(() => setSavedCoeffFeedback(false), 2000);
  };

  const ingDebounceTimersRef = useRef<Record<number, NodeJS.Timeout>>({});
  const runeDebounceTimersRef = useRef<Record<number, NodeJS.Timeout>>({});
  const hdvDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Handle updating ingredient price inline
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

  // Debounced auto-save for ingredient price input
  const handleIngredientPriceDraftChange = (ingId: number, rawValue: string) => {
    setIngredientDrafts((prev) => ({ ...prev, [ingId]: rawValue }));
    if (ingDebounceTimersRef.current[ingId]) {
      clearTimeout(ingDebounceTimersRef.current[ingId]);
    }
    ingDebounceTimersRef.current[ingId] = setTimeout(() => {
      void handleUpdateIngredientPrice(ingId, rawValue);
    }, 450);
  };

  // Handle updating finished item HDV sale price inline
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

  // Debounced auto-save for HDV sale price input
  const handleItemHdvPriceDraftChange = (rawValue: string) => {
    setItemHdvPriceDraft(rawValue);
    if (hdvDebounceTimerRef.current) {
      clearTimeout(hdvDebounceTimerRef.current);
    }
    hdvDebounceTimerRef.current = setTimeout(() => {
      void handleUpdateItemHdvPrice(rawValue);
    }, 450);
  };

  // Handle updating rune price from detail or rune manager
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

  // Debounced auto-save for rune price input
  const handleRunePriceDraftChange = (runeId: number, rawValue: string) => {
    setRunePriceDrafts((prev) => ({ ...prev, [runeId]: rawValue }));
    if (runeDebounceTimersRef.current[runeId]) {
      clearTimeout(runeDebounceTimersRef.current[runeId]);
    }
    runeDebounceTimersRef.current[runeId] = setTimeout(() => {
      void handleUpdateRunePrice(runeId, rawValue);
    }, 450);
  };

  // Transition to detail view with selected item
  const handleOpenDetail = (item: CraftableItem) => {
    setSelectedItem(item);
    setViewMode('detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // =========================================================================
  // ADVANCED FILTER DEFINITIONS (Dofus 3.0 & Kamaskope Standard)
  // =========================================================================
  const EQUIPMENT_SLOTS = useMemo(() => [
    { id: 'all', label: 'Todos', typeIds: [], icon: Layers },
    { id: 'sombrero', label: 'Sombrero', typeIds: [16], icon: Crown },
    { id: 'capa', label: 'Capa', typeIds: [17, 81], icon: Shield },
    { id: 'amuleto', label: 'Amuleto', typeIds: [1], icon: CircleDot },
    { id: 'anillo', label: 'Anillo', typeIds: [9], icon: Disc },
    { id: 'cinturon', label: 'Cinturón', typeIds: [10], icon: Sliders },
    { id: 'botas', label: 'Botas', typeIds: [11], icon: Footprints },
    { id: 'arma_herrero', label: 'Arma (Herrero)', jobId: 11, typeIds: [5, 6, 7, 8, 19, 20, 21, 22, 212], icon: Sword },
    { id: 'arma_escultor', label: 'Arma (Escultor)', jobId: 13, typeIds: [2, 3, 4], icon: Wand2 },
    { id: 'escudo', label: 'Escudo', typeIds: [82], icon: Shield },
    { id: 'trofeo', label: 'Trofeo', typeIds: [151, 271], icon: Trophy },
  ], []);

  interface StatFilterDef {
    id: string;
    runeId?: number;
    iconId?: number;
    textKey?: string;
    name: string;
    color: string;
    glyphType: string;
  }

  const STAT_FILTERS_DAMAGES: StatFilterDef[] = useMemo(() => [
    { id: 'da_tierra', runeId: 11657, iconId: 11657, name: 'Tierra (fijos)', color: '#b45309', glyphType: 'plant' },
    { id: 'da_fuego', runeId: 11659, iconId: 11659, name: 'Fuego (fijos)', color: '#ef4444', glyphType: 'fire' },
    { id: 'da_agua', runeId: 11661, iconId: 11661, name: 'Agua (fijos)', color: '#0ea5e9', glyphType: 'water' },
    { id: 'da_aire', runeId: 11663, iconId: 11663, name: 'Aire (fijos)', color: '#14b8a6', glyphType: 'air' },
    { id: 'da_neutro', runeId: 11665, iconId: 11665, name: 'Neutrales (fijos)', color: '#94a3b8', glyphType: 'neutral' },
    { id: 'da_cri', runeId: 11653, iconId: 11653, name: 'Críticos', color: '#ec4899', glyphType: 'crit' },
    { id: 'da_gen', runeId: 7435, iconId: 7435, name: 'Daños', color: '#d946ef', glyphType: 'zap' },
    { id: 'da_emp', runeId: 11649, iconId: 11649, name: 'Empuje', color: '#f97316', glyphType: 'arrow' },
    { id: 'da_trampas', runeId: 7445, iconId: 7445, textKey: 'trampa', name: 'Trampas (fijos)', color: '#b45309', glyphType: 'trap' },
    { id: 'da_pot_trampas', runeId: 7446, iconId: 7446, textKey: 'pot_trampa', name: 'Potencia Trampas (%)', color: '#eab308', glyphType: 'zap' },
    { id: 'da_hech', runeId: 18722, iconId: 18722, name: 'Hechizos (%)', color: '#eab308', glyphType: 'star' },
    { id: 'da_arm', runeId: 18721, iconId: 18721, name: 'Arma (%)', color: '#d97706', glyphType: 'sword' },
    { id: 'da_dis', runeId: 18720, iconId: 18720, name: 'Distancia (%)', color: '#06b6d4', glyphType: 'target' },
    { id: 'da_cac', runeId: 18719, iconId: 18719, name: 'Cuerpo a Cuerpo (%)', color: '#ef4444', glyphType: 'fist' },
  ], []);

  const STAT_FILTERS_RESISTANCES: StatFilterDef[] = useMemo(() => [
    { id: 'res_p_tie', runeId: 7459, iconId: 7459, name: 'Tierra (%)', color: '#b45309', glyphType: 'plant' },
    { id: 'res_tie', runeId: 7455, iconId: 7455, name: 'Tierra (fija)', color: '#92400e', glyphType: 'plant' },
    { id: 'res_p_fue', runeId: 7457, iconId: 7457, name: 'Fuego (%)', color: '#ef4444', glyphType: 'fire' },
    { id: 'res_fue', runeId: 7452, iconId: 7452, name: 'Fuego (fija)', color: '#dc2626', glyphType: 'fire' },
    { id: 'res_p_agu', runeId: 7560, iconId: 7560, name: 'Agua (%)', color: '#0ea5e9', glyphType: 'water' },
    { id: 'res_agu', runeId: 7454, iconId: 7454, name: 'Agua (fija)', color: '#0284c7', glyphType: 'water' },
    { id: 'res_p_air', runeId: 7458, iconId: 7458, name: 'Aire (%)', color: '#14b8a6', glyphType: 'air' },
    { id: 'res_air', runeId: 7453, iconId: 7453, name: 'Aire (fija)', color: '#0d9488', glyphType: 'air' },
    { id: 'res_p_neu', runeId: 7460, iconId: 7460, name: 'Neutral (%)', color: '#94a3b8', glyphType: 'neutral' },
    { id: 'res_neu', runeId: 7456, iconId: 7456, name: 'Neutral (fija)', color: '#64748b', glyphType: 'neutral' },
    { id: 'res_cri', runeId: 11655, iconId: 11655, name: 'Crítica (fija)', color: '#ec4899', glyphType: 'crit' },
    { id: 'res_emp', runeId: 11651, iconId: 11651, name: 'Empuje (fija)', color: '#f97316', glyphType: 'arrow' },
    { id: 'res_p_dis', runeId: 18724, iconId: 18724, name: 'Distancia (%)', color: '#06b6d4', glyphType: 'target' },
    { id: 'res_p_cac', runeId: 18723, iconId: 18723, name: 'Cuerpo a Cuerpo (%)', color: '#ef4444', glyphType: 'fist' },
  ], []);

  const STAT_FILTERS_CHARACTERISTICS: StatFilterDef[] = useMemo(() => [
    { id: 'pa', runeId: 1557, iconId: 1557, name: 'PA', color: '#38bdf8', glyphType: 'star' },
    { id: 'fo', runeId: 1519, iconId: 1519, name: 'Fuerza', color: '#b45309', glyphType: 'plant' },
    { id: 'caza', runeId: 10057, iconId: 10057, name: 'Caza', color: '#ef4444', glyphType: 'caza' },
    { id: 'pm', runeId: 1558, iconId: 1558, name: 'PM', color: '#10b981', glyphType: 'pm' },
    { id: 'inte', runeId: 1522, iconId: 1522, name: 'Inteligencia', color: '#f97316', glyphType: 'fire' },
    { id: 'fui', runeId: 11637, iconId: 11637, name: 'Huida', color: '#f59e0b', glyphType: 'dodge' },
    { id: 'al', runeId: 7438, iconId: 7438, name: 'Alcance', color: '#2dd4bf', glyphType: 'eye' },
    { id: 'sue', runeId: 1525, iconId: 1525, name: 'Suerte', color: '#0ea5e9', glyphType: 'water' },
    { id: 'pla', runeId: 11639, iconId: 11639, name: 'Placaje', color: '#84cc16', glyphType: 'lock' },
    { id: 'invo', runeId: 7442, iconId: 7442, name: 'Invocaciones', color: '#eab308', glyphType: 'invo' },
    { id: 'agi', runeId: 1524, iconId: 1524, name: 'Agilidad', color: '#10b981', glyphType: 'air' },
    { id: 'esq_pa', runeId: 11641, iconId: 11641, name: 'Esquiva PA', color: '#0284c7', glyphType: 'shield' },
    { id: 'cri', runeId: 7433, iconId: 7433, name: 'Críticos (%)', color: '#ef4444', glyphType: 'crit' },
    { id: 'sa', runeId: 1521, iconId: 1521, name: 'Sabiduría', color: '#a855f7', glyphType: 'moon' },
    { id: 'esq_pm', runeId: 11643, iconId: 11643, name: 'Esquiva PM', color: '#059669', glyphType: 'shield' },
    { id: 'pot', runeId: 7436, iconId: 7436, name: 'Potencia', color: '#eab308', glyphType: 'zap' },
    { id: 'vi', runeId: 1523, iconId: 1523, name: 'Vitalidad', color: '#f43f5e', glyphType: 'heart' },
    { id: 'ret_pa', runeId: 11645, iconId: 11645, name: 'Retirada de PA', color: '#0284c7', glyphType: 'star' },
    { id: 'pod', runeId: 7443, iconId: 7443, name: 'Pods', color: '#ca8a04', glyphType: 'pod' },
    { id: 'ini', runeId: 7448, iconId: 7448, name: 'Iniciativa', color: '#d946ef', glyphType: 'ini' },
    { id: 'ret_pm', runeId: 11647, iconId: 11647, name: 'Retirada de PM', color: '#059669', glyphType: 'pm' },
    { id: 'cu', runeId: 7434, iconId: 7434, name: 'Curación', color: '#ef4444', glyphType: 'heal' },
    { id: 'prosp', runeId: 7451, iconId: 7451, name: 'Prospección', color: '#06b6d4', glyphType: 'search' },
    { id: 'reenvio', runeId: 7437, iconId: 7437, textKey: 'reenvio', name: 'Reenvío de Daños', color: '#c084fc', glyphType: 'return' },
  ], []);

  const ALL_STAT_FILTERS = useMemo(() => [
    ...STAT_FILTERS_DAMAGES,
    ...STAT_FILTERS_RESISTANCES,
    ...STAT_FILTERS_CHARACTERISTICS,
  ], [STAT_FILTERS_DAMAGES, STAT_FILTERS_RESISTANCES, STAT_FILTERS_CHARACTERISTICS]);

  // Helper to render miniature glyph icon for stats
  const renderStatGlyph = (type: string, color: string) => {
    switch (type) {
      case 'plant':
        return (
          <Sparkles className="w-3.5 h-3.5 shrink-0" style={{ color }} />
        );
      case 'fire':
        return (
          <Flame className="w-3.5 h-3.5 shrink-0" style={{ color }} />
        );
      case 'water':
        return (
          <Droplet className="w-3.5 h-3.5 shrink-0" style={{ color }} />
        );
      case 'air':
        return (
          <Wind className="w-3.5 h-3.5 shrink-0" style={{ color }} />
        );
      case 'neutral':
        return (
          <CircleDot className="w-3.5 h-3.5 shrink-0" style={{ color }} />
        );
      case 'crit':
        return (
          <Sparkles className="w-3.5 h-3.5 shrink-0" style={{ color }} />
        );
      case 'zap':
        return (
          <Zap className="w-3.5 h-3.5 shrink-0" style={{ color }} />
        );
      case 'arrow':
        return (
          <ArrowRight className="w-3.5 h-3.5 shrink-0" style={{ color }} />
        );
      case 'star':
        return (
          <Sparkles className="w-3.5 h-3.5 shrink-0" style={{ color }} />
        );
      case 'sword':
        return (
          <Sword className="w-3.5 h-3.5 shrink-0" style={{ color }} />
        );
      case 'target':
        return (
          <Target className="w-3.5 h-3.5 shrink-0" style={{ color }} />
        );
      case 'fist':
        return (
          <Sword className="w-3.5 h-3.5 shrink-0" style={{ color }} />
        );
      case 'pm':
        return (
          <Footprints className="w-3.5 h-3.5 shrink-0" style={{ color }} />
        );
      case 'eye':
        return (
          <Eye className="w-3.5 h-3.5 shrink-0" style={{ color }} />
        );
      case 'invo':
        return (
          <Shield className="w-3.5 h-3.5 shrink-0" style={{ color }} />
        );
      case 'caza':
        return (
          <Sword className="w-3.5 h-3.5 shrink-0" style={{ color }} />
        );
      case 'moon':
        return (
          <Moon className="w-3.5 h-3.5 shrink-0" style={{ color }} />
        );
      case 'heart':
        return (
          <Heart className="w-3.5 h-3.5 shrink-0" style={{ color }} />
        );
      case 'shield':
        return (
          <Shield className="w-3.5 h-3.5 shrink-0" style={{ color }} />
        );
      case 'lock':
        return (
          <Shield className="w-3.5 h-3.5 shrink-0" style={{ color }} />
        );
      case 'dodge':
        return (
          <Wind className="w-3.5 h-3.5 shrink-0" style={{ color }} />
        );
      case 'heal':
        return (
          <Heart className="w-3.5 h-3.5 shrink-0" style={{ color }} />
        );
      case 'search':
        return (
          <Search className="w-3.5 h-3.5 shrink-0" style={{ color }} />
        );
      case 'pod':
        return (
          <Layers className="w-3.5 h-3.5 shrink-0" style={{ color }} />
        );
      case 'ini':
        return (
          <Sparkles className="w-3.5 h-3.5 shrink-0" style={{ color }} />
        );
      case 'return':
        return (
          <RotateCcw className="w-3.5 h-3.5 shrink-0" style={{ color }} />
        );
      default:
        return (
          <CircleDot className="w-3.5 h-3.5 shrink-0" style={{ color }} />
        );
    }
  };

  // Helper to render official DofusDB icon for stats with fallback to glyph
  const renderStatButtonIcon = (stat: StatFilterDef) => {
    const rune = stat.runeId ? BASE_RUNES_BY_ID[stat.runeId] : null;
    const iconId = rune?.iconId || stat.iconId || stat.runeId;
    const primaryUrl = iconId ? `https://api.dofusdb.fr/img/items/${iconId}.png` : null;

    if (primaryUrl) {
      return (
        <img
          src={primaryUrl}
          alt={stat.name}
          className="w-4 h-4 object-contain shrink-0 drop-shadow-sm"
          loading="lazy"
          onError={(e) => {
            (e.currentTarget as HTMLElement).style.display = 'none';
          }}
        />
      );
    }
    return renderStatGlyph(stat.glyphType, stat.color);
  };

  // Toggle multi-select slot filter
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

  // Toggle multi-select stat filter
  const handleToggleStatFilter = (statDef: StatFilterDef) => {
    setSelectedStatFilterIds((prev) => {
      if (prev.includes(statDef.id)) {
        return prev.filter((id) => id !== statDef.id);
      } else {
        return [...prev, statDef.id];
      }
    });
    setCurrentPage(1);
  };

  // Clear all filters
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

  // Clear only stats filters
  const handleClearStatsOnly = () => {
    setSelectedStatFilterIds([]);
    setCurrentPage(1);
  };

  // Compute metrics and filter/sort the entire catalog
  const processedCatalogItems = useMemo(() => {
    const now = Date.now();
    const allStatMap = new Map<string, StatFilterDef>(ALL_STAT_FILTERS.map((s) => [s.id, s]));
    const targetFilterRuneId = selectedStatFilterIds.length === 1 ? allStatMap.get(selectedStatFilterIds[0])?.runeId : null;

    // 1. FAST PRE-FILTERING: Filter candidate items first (Slot, Level, Coeff, Search Query, Date)
    // to avoid executing heavy simulation and cost calculations on filtered-out items
    const candidates = crushableItems.filter((item) => {
      if (isPetItem(item)) return false;

      const level = item.level || 1;
      const typeId = item.typeId || item.type?.id || 0;

      // Level filter (Manual numeric inputs)
      if (typeof minLevel === 'number' && level < minLevel) return false;
      if (typeof maxLevel === 'number' && level > maxLevel) return false;

      const savedCoeff = savedCoefficients[item.id] ?? 100;
      // Coefficient % filter
      if (typeof minCoeff === 'number' && savedCoeff < minCoeff) return false;
      if (typeof maxCoeff === 'number' && savedCoeff > maxCoeff) return false;

      const hasCustomCoeff = savedCoefficients[item.id] !== undefined;
      const coeffTimestamp = savedTimestamps[item.id] ?? null;

      // Date of Coefficient filter
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

      // Multi-select Equipment Slot filter
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

      // Search query (Accent and case-insensitive)
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

      // Quick effect pre-check for stats filter if effects are present
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

    // 2. Process simulations ONLY for matching candidates
    const results = candidates.map((item) => {
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

      // Best strategy calculation
      const bestStrat = sim.bestFocusOption;
      const bestStratProfit = bestStrat ? bestStrat.netProfit : sim.normalNetProfit;
      const bestStratValue = bestStrat ? bestStrat.totalKamasValue : sim.normalTotalKamasValue;
      const bestStratRoi = bestStrat ? bestStrat.roiPercent : sim.normalRoiPercent;
      const bestStratIsNormal = bestStrat ? Boolean(bestStrat.isNormal) : true;
      const bestStratRune = bestStrat && !bestStrat.isNormal ? bestStrat.rune : null;

      const maxProfit = bestStratProfit;
      const maxKamasValue = bestStratValue;
      const maxRoi = bestStratRoi;

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
        maxProfit,
        maxKamasValue,
        maxRoi,
        breakEvenCoeff: sim.breakEvenCoefficient,
        targetRuneYield,
        runeSpecificRunes,
        runeSpecificKamas,
      };
    });

    // 3. Complete Stats Filter check (checks exact rune yields produced in simulation)
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

    // 4. Sort items
    return filtered.sort((a, b) => {
      if (sortBy === 'profit_desc') {
        return b.maxProfit - a.maxProfit;
      }
      if (sortBy === 'coeff_desc') {
        return b.savedCoeff - a.savedCoeff;
      }
      if (sortBy === 'roi_desc') {
        return b.maxRoi - a.maxRoi;
      }
      if (sortBy === 'breakeven_asc') {
        return a.breakEvenCoeff - b.breakEvenCoeff;
      }
      if (sortBy === 'cost_asc') {
        return a.singleCraftCost - b.singleCraftCost;
      }
      if (sortBy === 'level_desc') {
        return b.level - a.level;
      }
      if (sortBy === 'date_desc') {
        return (b.coeffTimestamp || 0) - (a.coeffTimestamp || 0);
      }
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
    ALL_STAT_FILTERS,
    EQUIPMENT_SLOTS,
  ]);

  const totalPages = Math.max(1, Math.ceil(processedCatalogItems.length / PAGE_SIZE));
  const paginatedCatalogItems = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return processedCatalogItems.slice(start, start + PAGE_SIZE);
  }, [processedCatalogItems, currentPage]);

  // Autocomplete search suggestions for Detail view
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

  // Filtered runes list for the HDV Runas manager tab
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

  return (
    <div className="space-y-5 w-full pb-12">
      {/* Top Header & Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-2xl px-5 py-3.5 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-black text-xl text-white tracking-tight">
                Rompedora de Runas
              </h1>
              <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {crushableItems.length} objetos
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Machacado de equipables, cálculo exacto de runas, coeficientes y rentabilidad.
            </p>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsDofocusModalOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-950 hover:bg-amber-500/15 text-slate-300 hover:text-amber-300 border border-slate-800 hover:border-amber-500/40 shadow-sm transition-all cursor-pointer"
            title="Sincronizar coeficientes de rotura desde DoFocus (Draconiros)"
          >
            <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
            <span>Sincronizar DoFocus</span>
            <span className="px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold">
              Draconiros
            </span>
          </button>

          {/* View Switcher Tabs */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0 gap-1">
            <button
              onClick={() => setViewMode('catalog')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'catalog'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Catálogo
            </button>

            {selectedItem && (
              <button
                onClick={() => setViewMode('detail')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'detail'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Crosshair className="w-3.5 h-3.5" />
                Simulador
              </button>
            )}

            <button
              onClick={() => setViewMode('rune_prices')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'rune_prices'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              Precios Runas ({DOFUS_BASE_RUNES.length})
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. VISTA: CATÁLOGO Y LISTADO DE MACHACADO                                 */}
      {/* ========================================================================= */}
      {viewMode === 'catalog' && (
        <div className="space-y-4">
          {/* Main Filter Control Box (Collapsible & Persistent Multi-Select) */}
          <div className="bg-[#0f0e17] border border-purple-900/40 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4">
            {/* 1. Essential Filters Row 1: Multi-select Equipment Slots */}
            <div className="flex flex-wrap items-center gap-2 pb-1 max-w-full">
              <button
                onClick={() => handleToggleSlot('all')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-black whitespace-nowrap transition-all shrink-0 ${
                  selectedSlots.length === 0
                    ? 'bg-purple-600 text-white font-extrabold shadow-md shadow-purple-950/80 border border-purple-400'
                    : 'bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800 border border-purple-950/40'
                }`}
              >
                <Layers className="w-4 h-4" />
                Todos
              </button>
              {EQUIPMENT_SLOTS.filter((s) => s.id !== 'all').map((slot) => {
                const Icon = slot.icon;
                const isSelected = selectedSlots.includes(slot.id);
                return (
                  <button
                    key={slot.id}
                    onClick={() => handleToggleSlot(slot.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all shrink-0 ${
                      isSelected
                        ? 'bg-purple-600 text-white font-extrabold shadow-md shadow-purple-950/80 border border-purple-400 ring-1 ring-purple-300'
                        : 'bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800 border border-purple-950/40'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {slot.label}
                  </button>
                );
              })}
            </div>

            {/* 2. Essential Filters Row 2: Level, Coeff %, Date Dropdown & Stats Filter Toggle */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-purple-950/60">
              <div className="flex items-center gap-2.5 flex-wrap">
                {/* Level Inputs */}
                <div className="flex items-center gap-1.5 bg-slate-950/90 border border-purple-950/60 rounded-xl px-3 py-2 text-sm">
                  <span className="font-bold text-slate-300">Niv.</span>
                  <input
                    type="number"
                    min="1"
                    max="200"
                    placeholder="Mín."
                    value={minLevel}
                    onChange={(e) => {
                      setMinLevel(
                        e.target.value === ''
                          ? ''
                          : Math.max(1, Math.min(200, Number(e.target.value)))
                      );
                      setCurrentPage(1);
                    }}
                    className="w-14 bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-center text-sm font-mono font-bold text-amber-300 placeholder-slate-600 focus:outline-none focus:border-purple-500"
                  />
                  <span className="text-slate-500 font-bold">-</span>
                  <input
                    type="number"
                    min="1"
                    max="200"
                    placeholder="Máx."
                    value={maxLevel}
                    onChange={(e) => {
                      setMaxLevel(
                        e.target.value === ''
                          ? ''
                          : Math.max(1, Math.min(200, Number(e.target.value)))
                      );
                      setCurrentPage(1);
                    }}
                    className="w-14 bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-center text-sm font-mono font-bold text-amber-300 placeholder-slate-600 focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* Coeff % Inputs */}
                <div className="flex items-center gap-1.5 bg-slate-950/90 border border-purple-950/60 rounded-xl px-3 py-2 text-sm">
                  <span className="font-bold text-slate-300">Coef %</span>
                  <input
                    type="number"
                    min="1"
                    max="2000"
                    placeholder="Mín."
                    value={minCoeff}
                    onChange={(e) => {
                      setMinCoeff(
                        e.target.value === ''
                          ? ''
                          : Math.max(1, Math.min(2000, Number(e.target.value)))
                      );
                      setCurrentPage(1);
                    }}
                    className="w-16 bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-center text-sm font-mono font-bold text-purple-300 placeholder-slate-600 focus:outline-none focus:border-purple-500"
                  />
                  <span className="text-slate-500 font-bold">-</span>
                  <input
                    type="number"
                    min="1"
                    max="2000"
                    placeholder="Máx."
                    value={maxCoeff}
                    onChange={(e) => {
                      setMaxCoeff(
                        e.target.value === ''
                          ? ''
                          : Math.max(1, Math.min(2000, Number(e.target.value)))
                      );
                      setCurrentPage(1);
                    }}
                    className="w-16 bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-center text-sm font-mono font-bold text-purple-300 placeholder-slate-600 focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* Updated Date Dropdown */}
                <div className="flex items-center gap-2 bg-slate-950/90 border border-purple-950/60 rounded-xl px-3 py-2 text-sm">
                  <Clock className="w-4 h-4 text-purple-400" />
                  <span className="font-bold text-slate-300 hidden sm:inline">Fecha:</span>
                  <select
                    value={dateFilter}
                    onChange={(e) => {
                      setDateFilter(e.target.value as DateFilterOption);
                      setCurrentPage(1);
                    }}
                    className="bg-transparent text-sm font-bold text-slate-200 focus:outline-none cursor-pointer"
                  >
                    <option value="all" className="bg-slate-950">Todo</option>
                    <option value="today" className="bg-slate-950">Hoy (&lt;24h)</option>
                    <option value="3days" className="bg-slate-950">Últimos 3 días</option>
                    <option value="week" className="bg-slate-950">Última semana</option>
                    <option value="month" className="bg-slate-950">Último mes</option>
                    <option value="custom_only" className="bg-slate-950">Con Coef Guardado</option>
                    <option value="default_only" className="bg-slate-950">Sin Registrar (100%)</option>
                  </select>
                </div>
              </div>

              {/* Stats Filter Toggle Button & Reset Button */}
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setIsStatsFilterOpen(!isStatsFilterOpen)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm ${
                    selectedStatFilterIds.length > 0
                      ? 'bg-purple-600 text-white border border-purple-400 ring-1 ring-purple-300'
                      : isStatsFilterOpen
                      ? 'bg-purple-950/90 text-purple-200 border border-purple-700'
                      : 'bg-slate-900/90 text-slate-300 hover:text-white border border-purple-950/60 hover:border-purple-700'
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span>Filtro de Estadísticas</span>
                  {selectedStatFilterIds.length > 0 && (
                    <span className="px-2 py-0.5 bg-purple-900 text-white rounded-full text-xs font-black border border-purple-400/50">
                      {selectedStatFilterIds.length}
                    </span>
                  )}
                  {isStatsFilterOpen ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>

                {(selectedSlots.length > 0 ||
                  minLevel !== '' ||
                  maxLevel !== '' ||
                  minCoeff !== '' ||
                  maxCoeff !== '' ||
                  selectedStatFilterIds.length > 0 ||
                  dateFilter !== 'all' ||
                  searchQuery !== '') && (
                  <button
                    onClick={handleClearAllFilters}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold text-red-400 hover:text-red-300 bg-red-950/40 hover:bg-red-900/60 border border-red-800/50 transition-colors"
                    title="Limpiar todos los filtros"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Limpiar
                  </button>
                )}
              </div>
            </div>

            {/* 3. Collapsible 3-Column Stats Filter Grid with DofusDB real icons */}
            {isStatsFilterOpen && (
              <div className="pt-3 border-t border-purple-950/60 space-y-3 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span className="text-sm font-bold text-purple-300">
                      Seleccionar estadísticas (selección múltiple permitida):
                    </span>
                  </div>
                  {selectedStatFilterIds.length > 0 && (
                    <button
                      onClick={handleClearStatsOnly}
                      className="text-xs font-bold text-red-400 hover:text-red-300 underline"
                    >
                      Limpiar estadísticas ({selectedStatFilterIds.length})
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                  {/* COLUMN 1: DAÑOS */}
                  <div className="bg-slate-950/60 border border-purple-950/40 rounded-xl p-3 space-y-2">
                    <h4 className="text-purple-400 font-extrabold text-sm uppercase tracking-wider text-center pb-2 border-b border-purple-950/60">
                      Daños
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      {STAT_FILTERS_DAMAGES.map((stat) => {
                        const isSelected = selectedStatFilterIds.includes(stat.id);
                        return (
                          <button
                            key={stat.id}
                            onClick={() => handleToggleStatFilter(stat)}
                            className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-all text-left group ${
                              isSelected
                                ? 'bg-purple-600 text-white font-extrabold shadow-md border border-purple-300 ring-1 ring-purple-400'
                                : 'bg-slate-900/60 hover:bg-purple-950/40 text-slate-300 hover:text-white border border-slate-800/60 hover:border-purple-800/40'
                            }`}
                            title={stat.name}
                          >
                            {renderStatButtonIcon(stat)}
                            <span className="truncate text-xs font-bold">{stat.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* COLUMN 2: RESISTENCIAS */}
                  <div className="bg-slate-950/60 border border-purple-950/40 rounded-xl p-3 space-y-2">
                    <h4 className="text-purple-400 font-extrabold text-sm uppercase tracking-wider text-center pb-2 border-b border-purple-950/60">
                      Resistencias
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      {STAT_FILTERS_RESISTANCES.map((stat) => {
                        const isSelected = selectedStatFilterIds.includes(stat.id);
                        return (
                          <button
                            key={stat.id}
                            onClick={() => handleToggleStatFilter(stat)}
                            className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-all text-left group ${
                              isSelected
                                ? 'bg-purple-600 text-white font-extrabold shadow-md border border-purple-300 ring-1 ring-purple-400'
                                : 'bg-slate-900/60 hover:bg-purple-950/40 text-slate-300 hover:text-white border border-slate-800/60 hover:border-purple-800/40'
                            }`}
                            title={stat.name}
                          >
                            {renderStatButtonIcon(stat)}
                            <span className="truncate text-xs font-bold">{stat.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* COLUMN 3: CARACTERÍSTICAS */}
                  <div className="bg-slate-950/60 border border-purple-950/40 rounded-xl p-3 space-y-2">
                    <h4 className="text-purple-400 font-extrabold text-sm uppercase tracking-wider text-center pb-2 border-b border-purple-950/60">
                      Características
                    </h4>
                    <div className="grid grid-cols-3 gap-2">
                      {STAT_FILTERS_CHARACTERISTICS.map((stat) => {
                        const isSelected = selectedStatFilterIds.includes(stat.id);
                        return (
                          <button
                            key={stat.id}
                            onClick={() => handleToggleStatFilter(stat)}
                            className={`flex items-center gap-2 px-2 py-2 rounded-lg text-xs font-medium transition-all text-left group ${
                              isSelected
                                ? 'bg-purple-600 text-white font-extrabold shadow-md border border-purple-300 ring-1 ring-purple-400'
                                : 'bg-slate-900/60 hover:bg-purple-950/40 text-slate-300 hover:text-white border border-slate-800/60 hover:border-purple-800/40'
                            }`}
                            title={stat.name}
                          >
                            {renderStatButtonIcon(stat)}
                            <span className="truncate text-xs font-bold">{stat.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 4. Bottom Row: Search Input + Sorting Selector */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-3 border-t border-purple-950/60">
              {/* Search input */}
              <div className="md:col-span-7 lg:col-span-8 relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar equipable por nombre (ej. Gelanillo, Solomonk, Capa del Roble Blando...)"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full bg-slate-950 border border-purple-950/60 rounded-xl pl-10 pr-9 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all font-medium"
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setCurrentPage(1);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Sorting Selector */}
              <div className="md:col-span-5 lg:col-span-4 relative">
                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="w-full bg-slate-950 border border-purple-950/60 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 font-bold focus:outline-none focus:border-purple-500 transition-all appearance-none cursor-pointer pr-9"
                  >
                    <option value="profit_desc">Mayor Ganancia Total (Kamas)</option>
                    <option value="coeff_desc">Mayor Coeficiente (%)</option>
                    <option value="roi_desc">Mayor Rentabilidad (% ROI)</option>
                    <option value="breakeven_asc">Menor Coef. Rentable</option>
                    <option value="cost_asc">Menor Costo de Crafteo</option>
                    <option value="level_desc">Nivel (200 → 1)</option>
                    <option value="date_desc">Coeficiente Más Reciente</option>
                  </select>
                  <ArrowUpDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* 5. Active Filters Chips Indicator */}
            {(selectedStatFilterIds.length > 0 || selectedSlots.length > 0) && (
              <div className="flex items-center justify-between bg-purple-950/40 border border-purple-500/40 rounded-xl px-3.5 py-2 text-xs">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span className="text-purple-200 font-bold mr-1">Filtros activos:</span>
                  
                  {selectedSlots.map((slotId) => {
                    const slotDef = EQUIPMENT_SLOTS.find((s) => s.id === slotId);
                    if (!slotDef) return null;
                    return (
                      <button
                        key={slotId}
                        onClick={() => handleToggleSlot(slotId)}
                        className="inline-flex items-center gap-1 bg-purple-900/90 text-purple-100 hover:bg-purple-800 px-2 py-0.5 rounded-lg text-xs font-bold border border-purple-700 transition-all"
                        title="Quitar filtro de tipo"
                      >
                        <span>{slotDef.label}</span>
                        <X className="w-3 h-3 text-purple-300" />
                      </button>
                    );
                  })}

                  {selectedStatFilterIds.map((statId) => {
                    const statDef = ALL_STAT_FILTERS.find((s) => s.id === statId);
                    if (!statDef) return null;
                    return (
                      <button
                        key={statId}
                        onClick={() => handleToggleStatFilter(statDef)}
                        className="inline-flex items-center gap-1 bg-purple-900/90 text-purple-100 hover:bg-purple-800 px-2 py-0.5 rounded-lg text-xs font-bold border border-purple-700 transition-all"
                        title="Quitar filtro de estadística"
                      >
                        {renderStatButtonIcon(statDef)}
                        <span>{statDef.name}</span>
                        <X className="w-3 h-3 text-purple-300" />
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={handleClearAllFilters}
                  className="text-xs text-purple-400 hover:text-purple-300 underline font-bold shrink-0 ml-2"
                >
                  Limpiar todo
                </button>
              </div>
            )}
          </div>

          {/* Results Summary Bar */}
          <div className="flex items-center justify-between text-sm text-slate-400 px-1 font-medium">
            <span>
              Mostrando <strong className="text-slate-200">{paginatedCatalogItems.length}</strong> de <strong className="text-slate-200">{processedCatalogItems.length}</strong> equipables
            </span>
            <span>
              Página <strong className="text-slate-200">{currentPage}</strong> de <strong className="text-slate-200">{totalPages}</strong>
            </span>
          </div>

          {/* Catalog Grid Cards */}
          {paginatedCatalogItems.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
              <Sparkles className="w-12 h-12 text-slate-600 mx-auto" />
              <h3 className="text-lg font-bold text-white">No se encontraron equipables</h3>
              <p className="text-sm text-slate-400 max-w-md mx-auto">
                No hay objetos que coincidan con los filtros seleccionados (oficio, nivel, runa o fecha de registro).
              </p>
              <button
                onClick={handleClearAllFilters}
                className="px-5 py-2.5 bg-purple-600 text-white font-black rounded-xl text-sm hover:bg-purple-500 transition-colors inline-block shadow-lg"
              >
                Limpiar Filtros
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {paginatedCatalogItems.map((entry) => {
                const item = entry.item;
                const itemName = getItemName(item);
                const typeName = getItemTypeName(item);
                const iconUrl = getItemIconUrl(item);

                return (
                  <div
                    key={item.id}
                    onClick={() => handleOpenDetail(item)}
                    className="bg-slate-900 border border-slate-800 hover:border-amber-500/60 rounded-2xl p-4 sm:p-4.5 transition-all cursor-pointer shadow-lg hover:shadow-amber-500/10 group flex flex-col justify-between gap-3.5"
                  >
                    {/* Top Identity Row */}
                    <div className="flex items-start gap-3.5">
                      <div className="w-14 h-14 rounded-xl bg-slate-950 border border-slate-800 p-1 flex items-center justify-center shrink-0 group-hover:border-amber-500/40 transition-colors shadow-inner">
                        <SafeImage
                          src={iconUrl}
                          fallbackSrc={getItemFallbackIconUrl(item)}
                          alt={itemName}
                          className="w-12 h-12 object-contain"
                        />
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-black text-white text-base sm:text-lg leading-snug truncate group-hover:text-amber-400 transition-colors">
                            {itemName}
                          </span>
                          <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-md bg-slate-950 text-amber-400 border border-slate-800 shrink-0">
                            Nv. {entry.level}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-md border bg-slate-950 text-slate-300 border-slate-800">
                            {entry.jobNameEs}
                          </span>
                          {entry.hasCustomCoeff ? (
                            <span
                              className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1"
                              title={`Registrado: ${formatFullDate(entry.coeffTimestamp)}`}
                            >
                              <Percent className="w-3.5 h-3.5 text-amber-400" />
                              {entry.savedCoeff}%
                              <span className="text-[11px] text-amber-400/80 font-normal">
                                ({formatTimeAgo(entry.coeffTimestamp)})
                              </span>
                            </span>
                          ) : (
                            <span className="text-xs font-mono text-slate-400 px-2 py-0.5 bg-slate-950/60 rounded border border-slate-800">
                              Coef: 100%
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Target Rune Highlight (if specific rune is filtered) */}
                    {entry.targetRuneYield && (
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5 flex items-center justify-between text-xs sm:text-sm font-mono">
                        <div className="flex items-center gap-1.5 truncate">
                          <RuneIcon rune={entry.targetRuneYield.rune} size="xs" />
                          <span className="font-bold text-amber-300 truncate">
                            {entry.targetRuneYield.rune.name}: ~{entry.runeSpecificRunes.toFixed(2)} runas
                          </span>
                        </div>
                        <span className="font-black text-amber-400 shrink-0">
                          {entry.runeSpecificKamas.toLocaleString()} K
                        </span>
                      </div>
                    )}

                    {/* Metrics 3-box Grid: Coste | Valor Runas | Ganancia */}
                    <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 grid grid-cols-3 gap-2 text-center font-mono">
                      <div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                          Costo
                        </span>
                        <span className="text-sm sm:text-base font-bold text-slate-200">
                          {entry.singleCraftCost > 0
                            ? `${entry.singleCraftCost.toLocaleString()} K`
                            : '---'}
                        </span>
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                          Runas
                        </span>
                        <span className="text-sm sm:text-base font-bold text-amber-300">
                          {entry.maxKamasValue > 0
                            ? `${entry.maxKamasValue.toLocaleString()} K`
                            : '---'}
                        </span>
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                          Ganancia
                        </span>
                        <span
                          className={`text-sm sm:text-base font-black block ${
                            entry.maxProfit >= 0
                              ? 'text-emerald-400'
                              : 'text-rose-400'
                          }`}
                        >
                          {entry.maxProfit > 0 ? '+' : ''}
                          {entry.maxProfit.toLocaleString()} K
                        </span>
                      </div>
                    </div>

                    {/* Bottom Action Footer */}
                    <div className="pt-0.5 flex items-center justify-between text-xs sm:text-sm text-amber-400 font-bold group-hover:translate-x-1 transition-transform">
                      <div className="flex items-center gap-2 flex-wrap">
                        {entry.maxRoi > 0 && (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-xs font-mono border border-emerald-500/30 font-bold">
                            +{entry.maxRoi.toFixed(0)}% ROI
                          </span>
                        )}
                        {!entry.targetRuneYield && (
                          <span
                            className={`text-xs sm:text-sm flex items-center gap-1 font-semibold ${
                              entry.bestStratIsNormal
                                ? 'text-amber-300'
                                : 'text-purple-300'
                            }`}
                          >
                            <Sparkles
                              className={`w-3.5 h-3.5 ${
                                entry.bestStratIsNormal
                                  ? 'text-amber-400'
                                  : 'text-purple-400'
                              }`}
                            />
                            {entry.bestStratIsNormal
                              ? 'Sin Foco'
                              : `Foco: ${entry.bestFocusRune?.name.replace('Runa ', '')}`}
                          </span>
                        )}
                      </div>
                      <span className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-amber-400 group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors">
                        <ChevronRight className="w-4 h-4" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-center gap-2 pt-4">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-slate-900 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" /> Anterior
              </button>

              {/* Direct Page Buttons */}
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => {
                    if (totalPages <= 7) return true;
                    if (p === 1 || p === totalPages) return true;
                    return Math.abs(p - currentPage) <= 2;
                  })
                  .map((pageNum, idx, arr) => {
                    const prev = arr[idx - 1];
                    const showEllipsis = prev && pageNum - prev > 1;

                    return (
                      <React.Fragment key={pageNum}>
                        {showEllipsis && (
                          <span className="px-2 text-xs text-slate-600">...</span>
                        )}
                        <button
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-9 h-9 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                            currentPage === pageNum
                              ? 'bg-amber-500 text-slate-950 font-black shadow'
                              : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
                          }`}
                        >
                          {pageNum}
                        </button>
                      </React.Fragment>
                    );
                  })}
              </div>

              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-slate-900 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center gap-1"
              >
                Siguiente <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. VISTA: SIMULADOR DETALLADO DEL EQUIPABLE SELECCIONADO                   */}
      {/* ========================================================================= */}
      {viewMode === 'detail' && selectedItem && crushingSimulation && (
        <div className="space-y-5">
          {/* Top Return Button & Quick Item Switcher */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
            <button
              onClick={() => setViewMode('catalog')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black bg-slate-950 text-amber-400 hover:text-amber-300 border border-amber-500/30 hover:border-amber-500/60 transition-all w-fit shadow"
            >
              <ChevronLeft className="w-4 h-4" />
              Volver al Catálogo de Rompedora
            </button>

            {/* Quick Switch Dropdown */}
            <div ref={detailSearchContainerRef} className="relative sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Cambiar de objeto..."
                value={detailSearchQuery}
                onFocus={() => setIsDetailSearchOpen(true)}
                onChange={(e) => {
                  setDetailSearchQuery(e.target.value);
                  setIsDetailSearchOpen(true);
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-8 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
              {isDetailSearchOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto z-50 divide-y divide-slate-800/60">
                  {detailSearchResults.map((it) => (
                    <div
                      key={it.id}
                      onClick={() => {
                        setSelectedItem(it);
                        setIsDetailSearchOpen(false);
                        setDetailSearchQuery('');
                      }}
                      className="p-2.5 flex items-center gap-2 hover:bg-slate-900 cursor-pointer transition-colors"
                    >
                      <SafeImage
                        src={getItemIconUrl(it)}
                        fallbackSrc={getItemFallbackIconUrl(it)}
                        alt={getItemName(it)}
                        className="w-6 h-6 object-contain"
                      />
                      <span className="text-xs font-bold text-white truncate flex-1">
                        {getItemName(it)}
                      </span>
                      <span className="text-[10px] font-mono text-amber-400">
                        Nv.{it.level}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Main Detail Strategic Hero */}
          <CrushingStrategyHero
            selectedItem={selectedItem}
            craftCost={crushingSimulation.craftCost}
            marketSalePrice={Number(marketPrices[selectedItem.id] || selectedItem.defaultMarketSalePrice || 0)}
            normalTotalKamasValue={crushingSimulation.normalTotalKamasValue}
            normalNetProfit={crushingSimulation.normalNetProfit}
            bestFocusOption={crushingSimulation.bestFocusOption}
            coefficientPercent={coefficientPercent}
            savedCoefficientTimestamp={savedTimestamps[selectedItem.id]}
            savedCoeffFeedback={savedCoeffFeedback}
            breakEvenCoefficient={crushingSimulation.breakEvenCoefficient}
            activeServerName={activeProfile?.name}
            activeServerSlug={activeProfile?.slug}
            onCoefficientChange={(newCoeff) => setCoefficientPercent(newCoeff)}
            onSaveCoefficient={handleSaveItemCoefficient}
            onResetStatsPreset={handleResetStatsToPreset}
            onSelectRecipeForCalculator={onSelectRecipeForCalculator}
          />

          {/* Main Content Layout: Left Compact Recipe | Right Main Runes Focus Table */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left Column: Compact Recipe & Ingredients Price Editor */}
            <div className="lg:col-span-5 xl:col-span-4">
              <RecipeSidebar
                recipeIngredients={recipeIngredients}
                totalCraftCost={crushingSimulation.craftCost}
                ingredientDrafts={ingredientDrafts}
                savedIngFeedback={savedIngFeedback}
                onDraftChange={handleIngredientPriceDraftChange}
                onSavePrice={handleUpdateIngredientPrice}
                onSelectBycMethod={(ingId, method) => {
                  setSelectedBycMethods((prev) => ({
                    ...prev,
                    [ingId]: method,
                  }));
                }}
              />
            </div>

            {/* Right Column: Main Central Runes & Focus Table */}
            <div className="lg:col-span-7 xl:col-span-8">
              <CrushingRunesTable
                statYields={crushingSimulation.statYields}
                top3FocusOptions={crushingSimulation.top3FocusOptions}
                normalTotalKamasValue={crushingSimulation.normalTotalKamasValue}
                normalNetProfit={crushingSimulation.normalNetProfit}
                bestFocusOption={crushingSimulation.bestFocusOption}
                totalCraftCost={crushingSimulation.craftCost}
                breakEvenCoefficient={crushingSimulation.breakEvenCoefficient}
                runePriceDrafts={runePriceDrafts}
                savedRuneIdFeedback={savedRuneIdFeedback}
                focusedRuneId={focusedRuneId}
                onStatChange={handleStatChange}
                onPriceDraftChange={handleRunePriceDraftChange}
                onSaveRunePrice={handleUpdateRunePrice}
                onToggleFocus={(runeId) =>
                  setFocusedRuneId((prev) => (prev === runeId ? null : runeId))
                }
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. VISTA: GESTOR DE PRECIOS HDV RUNAS                                     */}
      {/* ========================================================================= */}
      {viewMode === 'rune_prices' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Category Filter Pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => setRuneCategoryFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    runeCategoryFilter === 'all'
                      ? 'bg-amber-500 text-slate-950 font-black'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  Todas ({DOFUS_BASE_RUNES.length})
                </button>
                <button
                  onClick={() => setRuneCategoryFilter('especial')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    runeCategoryFilter === 'especial'
                      ? 'bg-amber-500 text-slate-950 font-black'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  Especiales
                </button>
                <button
                  onClick={() => setRuneCategoryFilter('primaria')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    runeCategoryFilter === 'primaria'
                      ? 'bg-amber-500 text-slate-950 font-black'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  Primarias
                </button>
                <button
                  onClick={() => setRuneCategoryFilter('resistencia')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    runeCategoryFilter === 'resistencia'
                      ? 'bg-amber-500 text-slate-950 font-black'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  Resistencias
                </button>
                <button
                  onClick={() => setRuneCategoryFilter('dano')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    runeCategoryFilter === 'dano'
                      ? 'bg-amber-500 text-slate-950 font-black'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  Daños
                </button>
                <button
                  onClick={() => setRuneCategoryFilter('secundaria')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    runeCategoryFilter === 'secundaria'
                      ? 'bg-amber-500 text-slate-950 font-black'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  Secundarias
                </button>
              </div>

              {/* Search in runes */}
              <div className="relative sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar runa (PA, PM, Fo, Cri...)"
                  value={runeSearchTerm}
                  onChange={(e) => setRuneSearchTerm(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Grid of Runes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredBaseRunes.map((rune) => {
              const currentPrice = marketPrices[rune.id] ?? rune.defaultPrice;
              const draftVal = runePriceDrafts[rune.id] ?? String(currentPrice);
              const isSaved = savedRuneIdFeedback === rune.id;

              return (
                <div
                  key={rune.id}
                  className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-3 shadow-md flex items-center justify-between gap-3 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <RuneIcon rune={rune} size="md" />
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs sm:text-sm font-black text-white truncate">
                        {rune.name}
                      </h4>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="relative">
                      <input
                        type="number"
                        value={draftVal}
                        onChange={(e) =>
                          setRunePriceDrafts((prev) => ({
                            ...prev,
                            [rune.id]: e.target.value,
                          }))
                        }
                        onBlur={() => {
                          handleUpdateRunePrice(rune.id, draftVal);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleUpdateRunePrice(rune.id, draftVal);
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                        className="w-24 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-right text-xs font-mono font-black text-amber-300 focus:outline-none focus:border-amber-500 pr-5"
                      />
                      <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500 font-mono">
                        K
                      </span>
                    </div>

                    <button
                      onClick={() => handleUpdateRunePrice(rune.id, draftVal)}
                      title="Guardar precio de la runa"
                      className={`p-1.5 rounded-lg text-xs transition-all ${
                        isSaved
                          ? 'bg-emerald-500 text-slate-950 font-bold'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {isSaved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* DoFocus Synchronization Modal */}
      <DofocusSyncModal
        isOpen={isDofocusModalOpen}
        onClose={() => setIsDofocusModalOpen(false)}
        activeProfile={activeProfile}
        onSyncCompleted={(result) => {
          // Re-load saved coefficients into local state for active profile
          const updatedCoeffs = getAllSavedItemCoefficients(activeProfile?.slug);
          const updatedTimestamps = getAllSavedItemCoefficientTimestamps(activeProfile?.slug);
          setSavedCoefficients(updatedCoeffs);
          setSavedTimestamps(updatedTimestamps);
        }}
      />
    </div>
  );
};
