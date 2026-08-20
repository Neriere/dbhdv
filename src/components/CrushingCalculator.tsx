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
  HelpCircle,
  Percent,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  X,
  Sliders,
  DollarSign,
  Layers,
  Store,
  ShoppingCart,
} from 'lucide-react';
import { DofusItem, MarketPriceMap } from '../types';
import {
  CRUSHING_ALLOWED_JOBS,
} from '../data/dofusJobs';
import {
  BASE_RUNES_BY_ID,
  BaseRuneDefinition,
  calculateItemCrushing,
  CrushingResult,
  DOFUS_BASE_RUNES,
  getSavedItemCoefficient,
  saveItemCoefficient,
  TopFocusOption,
} from '../data/dofusRuneWeights';
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
  fetchRecipeByResultId,
  fetchItemDetailsById,
  getImportedItems,
  initializeDatabase,
  saveMarketPrice,
} from '../services/dofusDbService';
import { SafeImage } from './SafeImage';
import { RuneIcon } from './RuneIcon';

interface CrushingCalculatorProps {
  initialSelectedItem?: DofusItem | null;
  onSelectRecipeForCalculator?: (item: DofusItem) => void;
}

type CrushingTab = 'simulator' | 'ranking' | 'rune_prices';

const JOB_ICONS_MAP: Record<number, any> = {
  27: Scissors, // Sastre
  16: Gem, // Joyero
  15: Footprints, // Zapatero
  60: Shield, // Fabricante
  11: Sword, // Herrero
  13: Wand2, // Escultor
};

export const CrushingCalculator: React.FC<CrushingCalculatorProps> = ({
  initialSelectedItem,
  onSelectRecipeForCalculator,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<CrushingTab>('simulator');
  const [marketPrices, setMarketPrices] = useState<MarketPriceMap>({});
  const [priceUpdatedAt, setPriceUpdatedAt] = useState<Record<number, number>>({});
  const [crushableItems, setCrushableItems] = useState<CraftableItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<CraftableItem | null>(null);

  // Search and Job Explorer State
  const [itemSearchQuery, setItemSearchQuery] = useState<string>('');
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [selectedJobFilter, setSelectedJobFilter] = useState<number | 'all'>('all');
  const [isJobExplorerOpen, setIsJobExplorerOpen] = useState<boolean>(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Simulator controls
  const [coefficientPercent, setCoefficientPercent] = useState<number>(100);
  const [customStatValues, setCustomStatValues] = useState<Record<number, number>>({});
  const [focusedRuneId, setFocusedRuneId] = useState<number | null>(null);
  const [savedCoeffFeedback, setSavedCoeffFeedback] = useState<boolean>(false);

  // Inline rune price drafts & feedback
  const [runePriceDrafts, setRunePriceDrafts] = useState<Record<number, string>>({});
  const [savedRuneIdFeedback, setSavedRuneIdFeedback] = useState<number | null>(null);

  // Ranking controls
  const [rankingSearch, setRankingSearch] = useState<string>('');
  const [rankingJobFilter, setRankingJobFilter] = useState<number | 'all'>('all');
  const [rankingMinLevel, setRankingMinLevel] = useState<number | ''>(1);
  const [rankingMaxLevel, setRankingMaxLevel] = useState<number | ''>(200);
  const [rankingMinProfit, setRankingMinProfit] = useState<number | ''>(0);
  const [rankingMinRoi, setRankingMinRoi] = useState<number | ''>(0);
  const [rankingFocusMode, setRankingFocusMode] = useState<'best_focus' | 'normal'>('best_focus');
  const [rankingSortBy, setRankingSortBy] = useState<
    'profit_desc' | 'roi_desc' | 'breakeven_asc' | 'cost_asc' | 'level_desc'
  >('profit_desc');
  const [rankingPage, setRankingPage] = useState<number>(1);
  const RANKING_PAGE_SIZE = 25;

  // Rune Manager tab filter
  const [runeCategoryFilter, setRuneCategoryFilter] = useState<
    'all' | 'especial' | 'primaria' | 'dano' | 'resistencia' | 'secundaria'
  >('all');
  const [runeSearchTerm, setRuneSearchTerm] = useState<string>('');

  // Recipe ingredients & HDV price state
  interface RecipeIngredientDetail {
    id: number;
    name: string;
    iconId: number;
    quantity: number;
    unitPrice: number;
    totalCost: number;
  }

  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredientDetail[]>([]);
  const [ingredientDrafts, setIngredientDrafts] = useState<Record<number, string>>({});
  const [itemHdvPriceDraft, setItemHdvPriceDraft] = useState<string>('');
  const [savedIngFeedback, setSavedIngFeedback] = useState<number | null>(null);
  const [savedHdvFeedback, setSavedHdvFeedback] = useState<boolean>(false);
  const [isRecipeOpen, setIsRecipeOpen] = useState<boolean>(true);

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Hydrate local database state
  useEffect(() => {
    const hydrate = () => {
      const storedPrices = getStoredMarketPrices();
      setMarketPrices(storedPrices);
      setPriceUpdatedAt(getStoredPriceUpdatedAt());
      const snapshot = getCrushableItemsSnapshot();
      setCrushableItems(snapshot);

      // Initialize rune price drafts
      const initialRuneDrafts: Record<number, string> = {};
      for (const rune of DOFUS_BASE_RUNES) {
        const p = storedPrices[rune.id] ?? rune.defaultPrice;
        initialRuneDrafts[rune.id] = String(p);
      }
      setRunePriceDrafts(initialRuneDrafts);
    };

    initializeDatabase()
      .then(() => hydrate())
      .catch((e) => console.error('Error inicializando base en CrushingCalculator:', e));

    const handleDbUpdate = () => hydrate();
    window.addEventListener('dofus_database_updated', handleDbUpdate);
    return () => window.removeEventListener('dofus_database_updated', handleDbUpdate);
  }, []);

  // Update selected item when initialSelectedItem prop changes
  useEffect(() => {
    if (initialSelectedItem && crushableItems.length > 0) {
      const found = crushableItems.find((i) => i.id === initialSelectedItem.id);
      if (found) {
        setSelectedItem(found);
        setActiveSubTab('simulator');
      }
    } else if (!selectedItem && crushableItems.length > 0) {
      // Default to Gelanillo (2469) or first item
      const gelano = crushableItems.find((i) => i.id === 2469) || crushableItems[0];
      setSelectedItem(gelano);
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

  // Resolve recipe ingredients and HDV price draft when selectedItem or marketPrices change
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

        const unitPrice = getLowestDetectedPrice(ingId, marketPrices, recipesMap);
        drafts[ingId] = String(marketPrices[ingId] ?? unitPrice);

        ingDetails.push({
          id: ingId,
          name: ingItem ? getItemName(ingItem) : `Ingrediente #${ingId}`,
          iconId: ingItem?.iconId || (ingItem as any)?.icon_id || ingId,
          quantity: qty,
          unitPrice,
          totalCost: unitPrice * qty,
        });
      }

      setRecipeIngredients(ingDetails);
      setIngredientDrafts((prev) => ({ ...drafts, ...prev }));
    };

    void loadIngredients();
  }, [selectedItem?.id, marketPrices]);

  // Compute craft cost for an item using lowest detected ingredient prices
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
      const ingPrice = getLowestDetectedPrice(ingId, marketPrices, recipesMap);
      total += ingPrice * qty;
    }
    return total;
  };

  // Run calculation for current selected item
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

  // Handle individual stat value change (manual editing always active)
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
    setSavedCoeffFeedback(true);
    setTimeout(() => setSavedCoeffFeedback(false), 2000);
  };

  // Handle updating ingredient price inline
  const handleUpdateIngredientPrice = async (ingId: number, rawValue: string) => {
    const numeric = Math.max(0, Math.trunc(Number(rawValue) || 0));
    setIngredientDrafts((prev) => ({ ...prev, [ingId]: String(numeric) }));
    await saveMarketPrice(ingId, numeric);
    setSavedIngFeedback(ingId);
    setTimeout(() => setSavedIngFeedback(null), 1500);
  };

  // Handle updating finished item HDV sale price inline
  const handleUpdateItemHdvPrice = async (rawValue: string) => {
    if (!selectedItem) return;
    const numeric = Math.max(0, Math.trunc(Number(rawValue) || 0));
    setItemHdvPriceDraft(String(numeric));
    await saveMarketPrice(selectedItem.id, numeric);
    setSavedHdvFeedback(true);
    setTimeout(() => setSavedHdvFeedback(false), 1500);
  };

  // Handle updating rune price from simulator or rune manager
  const handleUpdateRunePrice = async (runeId: number, rawValue: string) => {
    const numeric = Math.max(0, Math.trunc(Number(rawValue) || 0));
    setRunePriceDrafts((prev) => ({ ...prev, [runeId]: String(numeric) }));
    await saveMarketPrice(runeId, numeric);
    setSavedRuneIdFeedback(runeId);
    setTimeout(() => setSavedRuneIdFeedback(null), 1500);
  };

  // Filtered items based on job filter and search query
  const jobFilteredItems = useMemo(() => {
    const query = itemSearchQuery.toLowerCase().trim();
    return crushableItems.filter((item) => {
      if (selectedJobFilter !== 'all' && item.jobId !== selectedJobFilter) return false;
      if (!query) return true;
      const name = getItemName(item).toLowerCase();
      const type = getItemTypeName(item).toLowerCase();
      return name.includes(query) || type.includes(query) || String(item.id).includes(query);
    });
  }, [crushableItems, itemSearchQuery, selectedJobFilter]);

  // Autocomplete dropdown suggestions
  const searchResults = useMemo(() => {
    return jobFilteredItems.slice(0, 30);
  }, [jobFilteredItems]);

  // Global Ranking calculations for all 6 professions
  const rankedItemsData = useMemo(() => {
    const results = crushableItems.map((item) => {
      const singleCraftCost = getItemCraftCost(item);
      const savedCoeff = getSavedItemCoefficient(item.id) || 100;
      const sim = calculateItemCrushing(
        item,
        savedCoeff,
        null,
        marketPrices,
        singleCraftCost,
        'avg',
        {},
      );

      const bestFocus = sim.bestFocusOption;
      const effectiveProfit =
        rankingFocusMode === 'best_focus' && bestFocus && bestFocus.netProfit > sim.netProfit
          ? bestFocus.netProfit
          : sim.netProfit;
      const effectiveTotalValue =
        rankingFocusMode === 'best_focus' && bestFocus && bestFocus.totalKamasValue > sim.totalKamasValue
          ? bestFocus.totalKamasValue
          : sim.totalKamasValue;
      const effectiveRoi =
        rankingFocusMode === 'best_focus' && bestFocus && bestFocus.roiPercent > sim.roiPercent
          ? bestFocus.roiPercent
          : sim.roiPercent;
      const effectiveFocusRune =
        rankingFocusMode === 'best_focus' && bestFocus && bestFocus.netProfit > sim.netProfit
          ? bestFocus.rune
          : null;

      return {
        item,
        level: item.level || 1,
        jobId: item.jobId,
        jobNameEs: item.jobNameEs,
        singleCraftCost,
        savedCoeff,
        normalProfit: sim.normalNetProfit,
        normalRoi: sim.normalRoiPercent,
        normalValue: sim.normalTotalKamasValue,
        breakEvenCoeff: sim.breakEvenCoefficient,
        effectiveProfit,
        effectiveRoi,
        effectiveTotalValue,
        effectiveFocusRune,
        statCount: sim.statYields.length,
      };
    });

    // Apply ranking filters
    return results
      .filter((r) => {
        if (rankingJobFilter !== 'all' && r.jobId !== rankingJobFilter) return false;
        if (typeof rankingMinLevel === 'number' && r.level < rankingMinLevel) return false;
        if (typeof rankingMaxLevel === 'number' && r.level > rankingMaxLevel) return false;
        if (typeof rankingMinProfit === 'number' && r.effectiveProfit < rankingMinProfit) return false;
        if (typeof rankingMinRoi === 'number' && r.effectiveRoi < rankingMinRoi) return false;
        if (rankingSearch.trim().length > 0) {
          const q = rankingSearch.toLowerCase().trim();
          const name = getItemName(r.item).toLowerCase();
          return name.includes(q) || r.jobNameEs.toLowerCase().includes(q);
        }
        return true;
      })
      .sort((a, b) => {
        if (rankingSortBy === 'profit_desc') return b.effectiveProfit - a.effectiveProfit;
        if (rankingSortBy === 'roi_desc') return b.effectiveRoi - a.effectiveRoi;
        if (rankingSortBy === 'breakeven_asc') return a.breakEvenCoeff - b.breakEvenCoeff;
        if (rankingSortBy === 'cost_asc') return a.singleCraftCost - b.singleCraftCost;
        if (rankingSortBy === 'level_desc') return b.level - a.level;
        return 0;
      });
  }, [
    crushableItems,
    marketPrices,
    rankingJobFilter,
    rankingMinLevel,
    rankingMaxLevel,
    rankingMinProfit,
    rankingMinRoi,
    rankingSearch,
    rankingFocusMode,
    rankingSortBy,
  ]);

  const paginatedRankedItems = useMemo(() => {
    const start = (rankingPage - 1) * RANKING_PAGE_SIZE;
    return rankedItemsData.slice(start, start + RANKING_PAGE_SIZE);
  }, [rankedItemsData, rankingPage]);

  const totalRankingPages = Math.max(
    1,
    Math.ceil(rankedItemsData.length / RANKING_PAGE_SIZE),
  );

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
      {/* Compact Clean Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-2xl px-5 py-3 shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Zap className="w-5 h-5" />
          </div>
          <span className="font-black text-lg text-white tracking-tight">
            Rompedora de Runas
          </span>
        </div>

        {/* Compact Sub-tabs Navigation */}
        <div className="flex items-center bg-slate-950 p-1.5 rounded-xl border border-slate-800 shrink-0 gap-1">
          <button
            onClick={() => setActiveSubTab('simulator')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${
              activeSubTab === 'simulator'
                ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Crosshair className="w-4 h-4" />
            Simulador
          </button>
          <button
            onClick={() => setActiveSubTab('ranking')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${
              activeSubTab === 'ranking'
                ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Trophy className="w-4 h-4" />
            Ranking Crafteos
          </button>
          <button
            onClick={() => setActiveSubTab('rune_prices')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${
              activeSubTab === 'rune_prices'
                ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Tag className="w-4 h-4" />
            HDV Runas ({DOFUS_BASE_RUNES.length})
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. SUB-TAB: SIMULADOR DE MACHACADO                                        */}
      {/* ========================================================================= */}
      {activeSubTab === 'simulator' && (
        <div className="space-y-5">
          {/* Item Selector & Job Filter Bar */}
          <div
            ref={searchContainerRef}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg relative z-30 space-y-3"
          >
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
              {/* Autocomplete Input */}
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar objeto a romper (Gelanillo, Capa Lorko, etc.)..."
                  value={itemSearchQuery}
                  onFocus={() => setIsSearchOpen(true)}
                  onChange={(e) => {
                    setItemSearchQuery(e.target.value);
                    setIsSearchOpen(true);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-9 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all font-medium"
                />
                {itemSearchQuery && (
                  <button
                    onClick={() => setItemSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}

                {/* Autocomplete Dropdown */}
                {isSearchOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl overflow-hidden max-h-80 overflow-y-auto z-50 divide-y divide-slate-800/60">
                    {searchResults.length === 0 ? (
                      <div className="p-4 text-center text-sm text-slate-500">
                        No se encontraron objetos para machacar
                      </div>
                    ) : (
                      searchResults.map((item) => {
                        const isSelected = selectedItem?.id === item.id;
                        const cost = getItemCraftCost(item);
                        return (
                          <div
                            key={item.id}
                            onClick={() => {
                              setSelectedItem(item);
                              setIsSearchOpen(false);
                              setItemSearchQuery('');
                            }}
                            className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-amber-500/15 text-amber-300'
                                : 'hover:bg-slate-900 text-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-800 p-0.5 shrink-0 flex items-center justify-center">
                                <SafeImage
                                  src={getItemIconUrl(item)}
                                  fallbackSrc={getItemFallbackIconUrl(item)}
                                  alt={getItemName(item)}
                                  className="w-full h-full object-contain"
                                />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold truncate">
                                  {getItemName(item)}
                                </p>
                                <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                                  <span className="text-amber-400 font-bold font-mono">
                                    Nv. {item.level || 1}
                                  </span>
                                  <span>•</span>
                                  <span>{item.jobNameEs}</span>
                                  <span>•</span>
                                  <span>{getItemTypeName(item)}</span>
                                </p>
                              </div>
                            </div>

                            <div className="text-right shrink-0 ml-3">
                              <span className="text-sm font-mono font-bold text-slate-200">
                                {cost > 0 ? `${cost.toLocaleString()} K` : 'Sin precio'}
                              </span>
                              <p className="text-xs text-slate-500">Coste Craft</p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Job filter pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 shrink-0">
                <button
                  onClick={() => {
                    setSelectedJobFilter('all');
                    setIsJobExplorerOpen(true);
                  }}
                  className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 ${
                    selectedJobFilter === 'all'
                      ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                      : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
                  }`}
                >
                  Todos ({crushableItems.length})
                </button>
                {CRUSHING_ALLOWED_JOBS.map((job) => {
                  const isSelected = selectedJobFilter === job.id;
                  const JobIcon = JOB_ICONS_MAP[job.id] || Shield;
                  return (
                    <button
                      key={job.id}
                      onClick={() => {
                        setSelectedJobFilter(job.id);
                        setIsJobExplorerOpen(true);
                      }}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 ${
                        isSelected
                          ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                          : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      <JobIcon className="w-4 h-4" />
                      <span>{job.nameEs}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Job Items Drawer / Grid */}
            {isJobExplorerOpen && (
              <div className="pt-3 border-t border-slate-800/80">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-amber-400" />
                    Objetos disponibles para machacar ({jobFilteredItems.length})
                  </span>
                  <button
                    onClick={() => setIsJobExplorerOpen(false)}
                    className="text-xs text-slate-400 hover:text-white font-bold px-2 py-1 bg-slate-950 rounded-lg border border-slate-800"
                  >
                    Ocultar lista ✕
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5 max-h-56 overflow-y-auto pr-1">
                  {jobFilteredItems.map((item) => {
                    const isSelected = selectedItem?.id === item.id;
                    const cost = getItemCraftCost(item);
                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          setSelectedItem(item);
                          setIsJobExplorerOpen(false);
                        }}
                        className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                            : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 p-0.5 shrink-0 flex items-center justify-center">
                            <SafeImage
                              src={getItemIconUrl(item)}
                              fallbackSrc={getItemFallbackIconUrl(item)}
                              alt={getItemName(item)}
                              className="w-full h-full object-contain"
                            />
                          </div>
                          <span className="text-xs font-mono font-bold text-amber-400">
                            N.{item.level || 1}
                          </span>
                        </div>
                        <p className="text-xs font-bold truncate leading-tight">
                          {getItemName(item)}
                        </p>
                        <span className="text-xs font-mono text-slate-400 mt-1">
                          {cost > 0 ? `${cost.toLocaleString()} K` : '—'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Active Simulation Workbench */}
          {selectedItem && crushingSimulation && (
            <div className="space-y-4">
              {/* Sleek Top Header Bar: Identity, Controls & Strategic Numbers (Craft, Venta HDV & Roto por Runas) */}
              {(() => {
                const hdvPrice = marketPrices[selectedItem.id] ?? selectedItem.defaultMarketSalePrice ?? 0;
                const craftCost = crushingSimulation.craftCost;
                const hdvProfit = hdvPrice - craftCost;

                const normalProfit = crushingSimulation.normalNetProfit;
                const normalValue = crushingSimulation.normalTotalKamasValue;

                const bestFocus = crushingSimulation.bestFocusOption;
                const focusProfit = bestFocus ? bestFocus.netProfit : normalProfit;
                const focusValue = bestFocus ? bestFocus.totalKamasValue : normalValue;
                const focusRuneName = bestFocus ? bestFocus.rune.name.replace('Runa ', '') : 'Todas';

                // Highest runes value & profit between normal and best focus
                const highestRunesValue = Math.max(normalValue, focusValue);
                const highestRunesProfit = Math.max(normalProfit, focusProfit);
                const isFocusHigher = focusValue > normalValue;

                return (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
                    <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
                      {/* Left: Item Identity */}
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="w-16 h-16 rounded-2xl bg-slate-950 border border-amber-500/30 flex items-center justify-center p-2 shadow-md shrink-0">
                          <SafeImage
                            key={selectedItem.id}
                            src={getItemIconUrl(selectedItem)}
                            fallbackSrc={getItemFallbackIconUrl(selectedItem)}
                            alt={getItemName(selectedItem)}
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <h2 className="text-xl font-black text-white truncate">
                              {getItemName(selectedItem)}
                            </h2>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0 font-mono">
                              Nv. {selectedItem.level || 1}
                            </span>
                            <span className="text-xs text-slate-400 font-medium">
                              {getItemTypeName(selectedItem)} • {selectedItem.jobNameEs}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-400 mt-1.5 flex-wrap">
                            {onSelectRecipeForCalculator && (
                              <button
                                onClick={() => onSelectRecipeForCalculator(selectedItem)}
                                className="flex items-center gap-1 text-xs font-bold text-amber-400 hover:text-amber-300 transition-colors"
                              >
                                Ver Receta Completa <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Quick Controls (Presets & Coeficiente) */}
                      <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap shrink-0 border-t lg:border-t-0 lg:border-l border-slate-800 pt-3 lg:pt-0 lg:pl-5">
                        {/* Jet Quick Presets */}
                        <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2">
                          <span className="text-xs font-bold text-slate-400 flex items-center gap-1 pr-1">
                            <Sliders className="w-3.5 h-3.5 text-amber-400" /> Jets:
                          </span>
                          <button
                            onClick={() => handleResetStatsToPreset('min')}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-900 text-slate-300 hover:text-white border border-slate-800 transition-all"
                          >
                            Mín
                          </button>
                          <button
                            onClick={() => handleResetStatsToPreset('avg')}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 transition-all"
                          >
                            Prom
                          </button>
                          <button
                            onClick={() => handleResetStatsToPreset('max')}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-900 text-slate-300 hover:text-white border border-slate-800 transition-all"
                          >
                            Máx
                          </button>
                        </div>

                        {/* Coeficiente (%) Manual Input */}
                        <div className="flex items-center gap-2 bg-slate-950 border border-amber-500/30 rounded-xl px-3 py-2">
                          <div className="flex items-center gap-1">
                            <Percent className="w-4 h-4 text-amber-400" />
                            <span className="text-xs font-black uppercase text-amber-400 tracking-wider">Coef:</span>
                          </div>
                          <div className="relative">
                            <input
                              type="number"
                              min="1"
                              max="2000"
                              value={coefficientPercent}
                              onChange={(e) =>
                                setCoefficientPercent(Math.max(1, Number(e.target.value) || 1))
                              }
                              className="w-20 bg-slate-900 border border-amber-500/40 rounded-lg px-2 py-1 text-center text-sm font-black text-amber-300 focus:outline-none focus:border-amber-400 font-mono"
                            />
                            <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs font-black text-amber-500">
                              %
                            </span>
                          </div>
                          <button
                            onClick={handleSaveItemCoefficient}
                            title="Guardar coeficiente para este item"
                            className={`p-2 rounded-lg text-xs font-bold transition-all ${
                              savedCoeffFeedback
                                ? 'bg-emerald-500 text-slate-950 font-black'
                                : 'bg-slate-900 text-amber-300 border border-amber-500/30 hover:bg-amber-500 hover:text-slate-950'
                            }`}
                          >
                            {savedCoeffFeedback ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Top Strategic Summary: Coste Craft, Venta HDV & Roto por Runas */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-3.5 border-t border-slate-800">
                      {/* Box 1: Coste Craft */}
                      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                        <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase tracking-wider mb-1.5">
                          <span className="flex items-center gap-1.5">
                            <Layers className="w-4 h-4 text-amber-400" /> Coste Craft
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between">
                          <span className="text-xl sm:text-2xl font-mono font-black text-amber-300">
                            {craftCost.toLocaleString()} K
                          </span>
                          <span className="text-xs text-slate-500 font-medium">
                            {recipeIngredients.length} ingredientes
                          </span>
                        </div>
                      </div>

                      {/* Box 2: Venta Directa en HDV */}
                      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                        <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase tracking-wider mb-1.5">
                          <span className="flex items-center gap-1.5">
                            <Store className="w-4 h-4 text-emerald-400" /> Venta HDV
                          </span>
                          <div className="flex items-center gap-1.5">
                            <div className="relative">
                              <input
                                type="number"
                                min="0"
                                value={itemHdvPriceDraft}
                                onChange={(e) => setItemHdvPriceDraft(e.target.value)}
                                onBlur={(e) => handleUpdateItemHdvPrice(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleUpdateItemHdvPrice(itemHdvPriceDraft);
                                    (e.target as HTMLInputElement).blur();
                                  }
                                }}
                                className="w-28 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-right font-mono text-sm font-bold text-emerald-300 focus:outline-none focus:border-emerald-400 pr-5"
                              />
                              <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500">
                                K
                              </span>
                            </div>
                            <button
                              onClick={() => handleUpdateItemHdvPrice(itemHdvPriceDraft)}
                              title="Guardar precio HDV"
                              className={`p-1.5 rounded-lg text-xs transition-all ${
                                savedHdvFeedback
                                  ? 'bg-emerald-500 text-slate-950 font-bold'
                                  : 'bg-slate-800 text-slate-400 hover:text-white'
                              }`}
                            >
                              {savedHdvFeedback ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                        <div className="flex items-baseline justify-between mt-1">
                          <span className="text-xs text-slate-400 font-semibold">Ganancia Venta:</span>
                          <span className={`text-lg font-mono font-black ${hdvProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {hdvProfit >= 0 ? '+' : ''}{hdvProfit.toLocaleString()} K
                          </span>
                        </div>
                      </div>

                      {/* Box 3: Roto por Runas (Mejor valor detectado) */}
                      <div className={`bg-slate-950/80 border rounded-xl p-4 flex flex-col justify-between ${
                        highestRunesProfit > hdvProfit && highestRunesProfit > 0
                          ? 'border-purple-500/50 bg-purple-950/20'
                          : 'border-slate-800'
                      }`}>
                        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider mb-1.5">
                          <span className="flex items-center gap-1.5 text-purple-300">
                            <Crosshair className="w-4 h-4 text-purple-400" /> Roto por Runas {isFocusHigher ? `(Foco ${focusRuneName})` : '(Sin Foco)'}
                          </span>
                          <span className="text-xs font-mono text-slate-300 font-bold">
                            {highestRunesValue.toLocaleString()} K
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between mt-1">
                          <span className="text-xs text-slate-400 font-semibold">Ganancia Runas:</span>
                          <span className={`text-lg font-mono font-black ${highestRunesProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {highestRunesProfit >= 0 ? '+' : ''}{highestRunesProfit.toLocaleString()} K
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Main Content Layout: Left Compact Recipe | Right Main Runes Focus Table */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* Left Column: Compact Recipe & Ingredients Price Editor (33% on large screens) */}
                <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4.5 h-4.5 text-amber-400" />
                      <h3 className="text-sm font-black uppercase tracking-wider text-white">
                        Receta ({recipeIngredients.length})
                      </h3>
                    </div>
                    <span className="text-xs font-mono font-black text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
                      {crushingSimulation.craftCost.toLocaleString()} K
                    </span>
                  </div>

                  {recipeIngredients.length > 0 ? (
                    <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
                      {recipeIngredients.map((ing) => {
                        const draftVal = ingredientDrafts[ing.id] ?? String(ing.unitPrice);
                        const isSaved = savedIngFeedback === ing.id;
                        return (
                          <div
                            key={ing.id}
                            className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-2.5 flex items-center justify-between gap-2.5 hover:border-slate-700 transition-colors"
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 p-0.5 shrink-0 flex items-center justify-center">
                                <SafeImage
                                  src={getItemIconUrl(ing)}
                                  fallbackSrc={getItemFallbackIconUrl(ing)}
                                  alt={ing.name}
                                  className="w-full h-full object-contain"
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-slate-100 truncate leading-tight">
                                  {ing.name}
                                </p>
                                <span className="text-xs font-mono text-amber-400 font-bold">
                                  x{ing.quantity} • {ing.totalCost.toLocaleString()} K
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <div className="relative">
                                <input
                                  type="number"
                                  min="0"
                                  value={draftVal}
                                  onChange={(e) =>
                                    setIngredientDrafts((prev) => ({
                                      ...prev,
                                      [ing.id]: e.target.value,
                                    }))
                                  }
                                  onBlur={(e) =>
                                    handleUpdateIngredientPrice(ing.id, e.target.value)
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleUpdateIngredientPrice(ing.id, draftVal);
                                      (e.target as HTMLInputElement).blur();
                                    }
                                  }}
                                  className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-right font-mono text-sm font-bold text-slate-100 focus:outline-none focus:border-amber-500 pr-5"
                                />
                                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500">
                                  K
                                </span>
                              </div>
                              <button
                                onClick={() => handleUpdateIngredientPrice(ing.id, draftVal)}
                                title="Guardar precio"
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
                  ) : (
                    <div className="py-6 text-center text-xs text-slate-500">
                      Sin receta registrada o es recurso base.
                    </div>
                  )}
                </div>

                {/* Right Column: Main Central Runes & Focus Table (67% on large screens) */}
                <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3.5">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 pb-3.5">
                    <div className="flex items-center gap-2.5">
                      <Sparkles className="w-4.5 h-4.5 text-amber-400" />
                      <h3 className="text-base font-black text-white">
                        Runas Obtenidas y Focos
                      </h3>
                    </div>
                    <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-400 font-medium">
                      <span>Mínimo Rentable: <strong className="text-orange-400 font-mono font-black">{crushingSimulation.breakEvenCoefficient}%</strong></span>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-xs">
                          <th className="py-3 px-3.5 min-w-[150px]">Estadística (Jet)</th>
                          <th className="py-3 px-3.5 min-w-[180px]">Runa</th>
                          <th className="py-3 px-3.5 min-w-[120px]">Precio HDV</th>
                          <th className="py-3 px-3.5 min-w-[130px] text-amber-400 bg-amber-500/5">Sin Foco</th>
                          <th className="py-3 px-3.5 min-w-[170px] text-purple-300 bg-purple-500/5">Con Foco</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-medium">
                        {crushingSimulation.statYields.map((yieldItem) => {
                          const runePrice =
                            runePriceDrafts[yieldItem.rune.id] ?? String(yieldItem.unitPrice);

                          // Find rank among all focus yields
                          const sortedByFocus = [...crushingSimulation.statYields].sort(
                            (a, b) => b.focusKamasValue - a.focusKamasValue
                          );
                          const rankIndex = sortedByFocus.findIndex((s) => s.rune.id === yieldItem.rune.id);
                          const rank = rankIndex + 1;
                          const gainVsNormal = yieldItem.focusKamasValue - crushingSimulation.normalTotalKamasValue;

                          // Ranking styling
                          const isTop1 = rank === 1;
                          const isTop2 = rank === 2;
                          const isTop3 = rank === 3;

                          return (
                            <tr
                              key={yieldItem.rune.id}
                              className={`transition-colors ${
                                isTop1
                                  ? 'bg-amber-500/10 border-l-4 border-l-amber-400 hover:bg-amber-500/15'
                                  : isTop2
                                    ? 'bg-sky-500/5 border-l-4 border-l-sky-400 hover:bg-sky-500/10'
                                    : isTop3
                                      ? 'bg-orange-500/5 border-l-4 border-l-orange-400 hover:bg-orange-500/10'
                                      : 'hover:bg-slate-800/30'
                              }`}
                            >
                              {/* Tirada / Jet Controls */}
                              <td className="py-2.5 px-3.5">
                                <div className="space-y-1.5">
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => handleStatChange(yieldItem.rune.id, String(yieldItem.statMin))}
                                      className={`px-2 py-0.5 rounded text-xs font-mono font-bold transition-all ${
                                        yieldItem.statSelectedVal === yieldItem.statMin
                                          ? 'bg-slate-700 text-white'
                                          : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                                      }`}
                                      title="Mínimo"
                                    >
                                      Min
                                    </button>
                                    <button
                                      onClick={() => handleStatChange(yieldItem.rune.id, String(Math.ceil((yieldItem.statMin + yieldItem.statMax) / 2)))}
                                      className={`px-2 py-0.5 rounded text-xs font-mono font-bold transition-all ${
                                        yieldItem.statSelectedVal === Math.ceil((yieldItem.statMin + yieldItem.statMax) / 2)
                                          ? 'bg-amber-500 text-slate-950 font-black'
                                          : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                                      }`}
                                      title="Medio"
                                    >
                                      Med
                                    </button>
                                    <button
                                      onClick={() => handleStatChange(yieldItem.rune.id, String(yieldItem.statMax))}
                                      className={`px-2 py-0.5 rounded text-xs font-mono font-bold transition-all ${
                                        yieldItem.statSelectedVal === yieldItem.statMax
                                          ? 'bg-slate-700 text-white'
                                          : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                                      }`}
                                      title="Máximo"
                                    >
                                      Max
                                    </button>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="number"
                                      min="0"
                                      value={yieldItem.statSelectedVal}
                                      onChange={(e) =>
                                        handleStatChange(yieldItem.rune.id, e.target.value)
                                      }
                                      className="w-20 bg-slate-950 border border-slate-700 rounded-lg px-2 py-0.5 text-center text-sm font-mono font-bold text-white focus:outline-none focus:border-amber-500"
                                    />
                                    <span className="text-xs text-slate-400 font-mono">
                                      ({yieldItem.statMin} - {yieldItem.statMax})
                                    </span>
                                  </div>
                                </div>
                              </td>

                              {/* Rune identity */}
                              <td className="py-2.5 px-3.5">
                                <div className="flex items-center gap-2.5">
                                  <RuneIcon rune={yieldItem.rune} size="sm" showTooltip />
                                  <div className="min-w-0">
                                    <p className="font-bold text-white flex items-center gap-1.5 truncate leading-tight text-sm">
                                      <span className="text-amber-400">+{yieldItem.statSelectedVal}</span>
                                      <span className="truncate">{yieldItem.rune.name.replace('Runa ', '')}</span>
                                    </p>
                                    <span className="text-xs font-mono text-slate-400">
                                      Peso: {yieldItem.unitWeight}
                                    </span>
                                  </div>
                                </div>
                              </td>

                              {/* HDV Price Editor */}
                              <td className="py-2.5 px-3.5">
                                <div className="flex items-center gap-1.5">
                                  <div className="relative">
                                    <input
                                      type="number"
                                      min="0"
                                      value={runePrice}
                                      onChange={(e) =>
                                        setRunePriceDrafts((prev) => ({
                                          ...prev,
                                          [yieldItem.rune.id]: e.target.value,
                                        }))
                                      }
                                      onBlur={(e) =>
                                        handleUpdateRunePrice(yieldItem.rune.id, e.target.value)
                                      }
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          handleUpdateRunePrice(
                                            yieldItem.rune.id,
                                            (e.target as HTMLInputElement).value,
                                          );
                                        }
                                      }}
                                      className="w-24 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-right text-sm font-mono font-bold text-slate-100 focus:outline-none focus:border-amber-500 pr-5"
                                    />
                                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500">
                                      K
                                    </span>
                                  </div>
                                  {savedRuneIdFeedback === yieldItem.rune.id && (
                                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                                  )}
                                </div>
                              </td>

                              {/* Normal Yield (Sin foco) */}
                              <td className="py-2.5 px-3.5 bg-amber-500/5 font-mono">
                                <div className="font-black text-amber-300 text-sm">
                                  {yieldItem.normalRunesPerItem.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })} <span className="text-xs text-amber-400/80 font-semibold">runas</span>
                                </div>
                                <div className="text-xs font-bold text-slate-300">
                                  {yieldItem.normalKamasValue.toLocaleString()} K
                                </div>
                              </td>

                              {/* Focus Yield (Con foco) */}
                              <td className="py-2.5 px-3.5 bg-purple-500/5 font-mono">
                                <div className="flex items-center justify-between gap-2">
                                  <div>
                                    <span
                                      className={`font-black text-sm ${
                                        isTop1
                                          ? 'text-amber-300'
                                          : isTop2
                                            ? 'text-sky-300'
                                            : isTop3
                                              ? 'text-orange-300'
                                              : 'text-purple-300'
                                      }`}
                                    >
                                      {yieldItem.focusRunesPerItem.toLocaleString(undefined, {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })} <span className="text-xs text-purple-400/80 font-semibold">runas</span>
                                    </span>
                                    <div className="text-xs font-bold text-slate-200">
                                      {yieldItem.focusKamasValue.toLocaleString()} K
                                    </div>
                                  </div>

                                  <div className="text-right shrink-0">
                                    {isTop1 && (
                                      <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-black text-xs">
                                        TOP 1
                                      </span>
                                    )}
                                    {isTop2 && (
                                      <span className="px-2 py-0.5 rounded bg-sky-500 text-slate-950 font-black text-xs">
                                        TOP 2
                                      </span>
                                    )}
                                    {isTop3 && (
                                      <span className="px-2 py-0.5 rounded bg-orange-500 text-slate-950 font-black text-xs">
                                        TOP 3
                                      </span>
                                    )}
                                    {!isTop1 && !isTop2 && !isTop3 && (
                                      <span
                                        className={`text-[10px] font-mono font-bold ${
                                          gainVsNormal >= 0 ? 'text-emerald-400' : 'text-slate-500'
                                        }`}
                                      >
                                        {gainVsNormal >= 0 ? '+' : ''}
                                        {gainVsNormal.toLocaleString()} K
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      {/* Table Footer with Kamaskope Totals */}
                      <tfoot>
                        <tr className="border-t-2 border-slate-800 bg-slate-950 font-mono text-xs">
                          <td colSpan={3} className="py-2.5 px-3 font-bold text-slate-400 text-right uppercase tracking-wider">
                            Totales estimados:
                          </td>
                          <td className="py-2.5 px-3 bg-amber-500/10 border-l border-r border-amber-500/20">
                            <span className="text-[10px] text-amber-400 block font-sans font-bold">Total sin foco:</span>
                            <span className="text-sm font-black text-amber-300">
                              {crushingSimulation.normalTotalKamasValue.toLocaleString()} K
                            </span>
                          </td>
                          <td className="py-2.5 px-3 bg-purple-500/10 border-r border-purple-500/20">
                            <span className="text-[10px] text-purple-300 block font-sans font-bold">
                              Mejor foco ({crushingSimulation.bestFocusOption?.rune.name.replace('Runa ', '')}):
                            </span>
                            <span className="text-sm font-black text-purple-300">
                              {(crushingSimulation.bestFocusOption?.totalKamasValue ?? crushingSimulation.normalTotalKamasValue).toLocaleString()} K
                            </span>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. SUB-TAB: RANKING GLOBAL DE CRAFTEOS                                     */}
      {/* ========================================================================= */}
      {activeSubTab === 'ranking' && (
        <div className="space-y-4">
          {/* Ranking Filters Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Search */}
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">
                  Buscar Objeto
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Nombre del objeto..."
                    value={rankingSearch}
                    onChange={(e) => {
                      setRankingSearch(e.target.value);
                      setRankingPage(1);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Job Filter */}
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">
                  Oficio ({CRUSHING_ALLOWED_JOBS.length})
                </label>
                <select
                  value={rankingJobFilter}
                  onChange={(e) => {
                    const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                    setRankingJobFilter(val);
                    setRankingPage(1);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="all">Todos los 6 oficios</option>
                  {CRUSHING_ALLOWED_JOBS.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.nameEs}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sorting Mode */}
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">
                  Ordenar Por
                </label>
                <select
                  value={rankingSortBy}
                  onChange={(e) => {
                    setRankingSortBy(e.target.value as any);
                    setRankingPage(1);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="profit_desc">Mayor Ganancia Neta (Kamas)</option>
                  <option value="roi_desc">Mayor Retorno (ROI %)</option>
                  <option value="breakeven_asc">Menor Coef. Rentable</option>
                  <option value="cost_asc">Menor Coste de Craft</option>
                  <option value="level_desc">Mayor Nivel</option>
                </select>
              </div>

              {/* Focus Strategy */}
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">
                  Estrategia Evaluada
                </label>
                <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <button
                    onClick={() => setRankingFocusMode('best_focus')}
                    className={`py-1 rounded-lg text-xs font-bold transition-all ${
                      rankingFocusMode === 'best_focus'
                        ? 'bg-purple-600 text-white font-black'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Mejor Foco
                  </button>
                  <button
                    onClick={() => setRankingFocusMode('normal')}
                    className={`py-1 rounded-lg text-xs font-bold transition-all ${
                      rankingFocusMode === 'normal'
                        ? 'bg-amber-500 text-slate-950 font-black'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Sin Foco
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Ranking Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-lg overflow-hidden">
            <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">
                Mostrando {paginatedRankedItems.length} de {rankedItemsData.length} objetos
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={rankingPage <= 1}
                  onClick={() => setRankingPage((p) => Math.max(1, p - 1))}
                  className="p-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono font-bold text-slate-400">
                  {rankingPage} / {totalRankingPages}
                </span>
                <button
                  disabled={rankingPage >= totalRankingPages}
                  onClick={() => setRankingPage((p) => Math.min(totalRankingPages, p + 1))}
                  className="p-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px] bg-slate-950/60">
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Objeto</th>
                    <th className="py-2.5 px-3">Oficio</th>
                    <th className="py-2.5 px-3 text-right">Coste Craft</th>
                    <th className="py-2.5 px-3 text-right">Coef. Registrado</th>
                    <th className="py-2.5 px-3 text-right">Mín. Rentable</th>
                    <th className="py-2.5 px-3">Estrategia</th>
                    <th className="py-2.5 px-3 text-right">Valor Bruto</th>
                    <th className="py-2.5 px-3 text-right">Beneficio Neto</th>
                    <th className="py-2.5 px-3 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {paginatedRankedItems.map((entry, idx) => {
                    const globalRank = (rankingPage - 1) * RANKING_PAGE_SIZE + idx + 1;
                    const isProfitable = entry.effectiveProfit > 0;
                    return (
                      <tr key={entry.item.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-500">
                          {globalRank}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-800 p-0.5 shrink-0 flex items-center justify-center">
                              <SafeImage
                                src={getItemIconUrl(entry.item)}
                                fallbackSrc={getItemFallbackIconUrl(entry.item)}
                                alt={getItemName(entry.item)}
                                className="w-full h-full object-contain"
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-white truncate max-w-[180px]">
                                {getItemName(entry.item)}
                              </p>
                              <span className="text-[10px] font-mono text-amber-400">
                                Nv. {entry.level}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-400">
                          {entry.jobNameEs}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-300">
                          {entry.singleCraftCost.toLocaleString()} K
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-amber-400 font-bold">
                          {entry.savedCoeff}%
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-orange-400 font-bold">
                          {entry.breakEvenCoeff}%
                        </td>
                        <td className="py-2.5 px-3">
                          {entry.effectiveFocusRune ? (
                            <div className="flex items-center gap-1.5 text-purple-300">
                              <RuneIcon rune={entry.effectiveFocusRune} size="xs" />
                              <span className="truncate max-w-[120px] font-bold text-[11px]">
                                Foco: {entry.effectiveFocusRune.name}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px]">Sin Foco</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-300">
                          {entry.effectiveTotalValue.toLocaleString()} K
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          <p
                            className={`font-black ${
                              isProfitable ? 'text-emerald-400' : 'text-red-400'
                            }`}
                          >
                            {isProfitable ? '+' : ''}
                            {entry.effectiveProfit.toLocaleString()} K
                          </p>
                          <span
                            className={`text-[10px] font-bold ${
                              entry.effectiveRoi >= 0 ? 'text-emerald-400' : 'text-red-400'
                            }`}
                          >
                            {entry.effectiveRoi}% ROI
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() => {
                              setSelectedItem(entry.item);
                              setActiveSubTab('simulator');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500 hover:text-slate-950 font-bold text-[11px] transition-all"
                          >
                            Simular
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. SUB-TAB: HDV PRECIOS DE RUNAS                                          */}
      {/* ========================================================================= */}
      {activeSubTab === 'rune_prices' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Category Filter */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                {(
                  [
                    { key: 'all', label: 'Todas' },
                    { key: 'especial', label: 'Especiales (PA/PM/AL)' },
                    { key: 'primaria', label: 'Primarias' },
                    { key: 'dano', label: 'Daños / Curas' },
                    { key: 'resistencia', label: 'Resistencias' },
                    { key: 'secundaria', label: 'Secundarias' },
                  ] as const
                ).map((cat) => (
                  <button
                    key={cat.key}
                    onClick={() => setRuneCategoryFilter(cat.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                      runeCategoryFilter === cat.key
                        ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                        : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Search Rune */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar runa..."
                  value={runeSearchTerm}
                  onChange={(e) => setRuneSearchTerm(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredBaseRunes.map((rune) => {
              const currentPrice = runePriceDrafts[rune.id] ?? String(marketPrices[rune.id] ?? rune.defaultPrice);
              const isSaved = savedRuneIdFeedback === rune.id;

              return (
                <div
                  key={rune.id}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-md flex items-center justify-between gap-3 hover:border-slate-700 transition-all"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <RuneIcon rune={rune} size="md" showTooltip />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{rune.name}</p>
                      <p className="text-[10px] text-slate-400 truncate">
                        Peso: {rune.unitWeight} • {rune.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <input
                      type="number"
                      min="0"
                      value={currentPrice}
                      onChange={(e) =>
                        setRunePriceDrafts((prev) => ({
                          ...prev,
                          [rune.id]: e.target.value,
                        }))
                      }
                      onBlur={(e) => handleUpdateRunePrice(rune.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleUpdateRunePrice(rune.id, (e.target as HTMLInputElement).value);
                        }
                      }}
                      className="w-20 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-right text-xs font-mono font-bold text-slate-100 focus:outline-none focus:border-amber-500"
                    />
                    <span className="text-[11px] font-bold text-slate-500">K</span>
                    {isSaved && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
