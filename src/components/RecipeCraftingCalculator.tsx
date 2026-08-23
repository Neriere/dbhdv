import React, { useState, useEffect, useRef } from "react";
import {
  Wrench,
  Search,
  SlidersHorizontal,
  ChevronRight,
  ChevronDown,
  DollarSign,
  TrendingUp,
  Layers,
  ArrowRightLeft,
  Check,
  Zap,
  Sparkles,
  Info,
  RefreshCw,
  FlaskConical,
  Sword,
  Wand2,
  Gem,
  Footprints,
  Scissors,
  Shield,
  Pickaxe,
  Axe,
  Wheat,
  Drumstick,
  Fish,
  ShoppingBag,
  ExternalLink,
  Heart,
  ChevronLeft,
  ArrowLeft,
  Tag,
  ShoppingCart,
} from "lucide-react";

import {
  DofusItem,
  DofusJob,
  RecipeTreeNode,
  CraftStrategyMode,
  MarketPriceMap,
} from "../types";
import { DOFUS_JOBS, getJobForItem, isOmittedItem } from "../data/dofusJobs";
import {
  PRESET_CRAFTABLE_ITEMS,
  DEFAULT_INGREDIENT_PRICES,
  PresetCraftableItem,
} from "../data/presetCraftableItems";
import {
  getCraftableItemsSnapshot,
  initializeDatabase,
  getStoredMarketPrices,
  getStoredPriceUpdatedAt,
  saveMarketPrice,
  buildRecipeTree,
  calculateTreeCraftCost,
  getItemName,
  getItemTypeName,
  getItemIconUrl,
  getItemFallbackIconUrl,
  resolveMissingItemNamesInBatch,
  addToShoppingList,
} from "../services/dofusDbService";
import { matchesSearchQuery } from "../utils/searchUtils";

// Icon Map helper for professions
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
  Sparkles,
};

const getJobBadgeStyle = (jobName: string) => {
  const name = (jobName || "").toLowerCase();
  if (name.includes("alquimista"))
    return "bg-emerald-500/20 border-emerald-500/40 text-emerald-300";
  if (name.includes("campesino"))
    return "bg-amber-500/20 border-amber-500/40 text-amber-300";
  if (name.includes("cazador"))
    return "bg-orange-500/20 border-orange-500/40 text-orange-300";
  if (name.includes("leñador") || name.includes("lenador"))
    return "bg-lime-500/20 border-lime-500/40 text-lime-300";
  if (name.includes("minero"))
    return "bg-cyan-500/20 border-cyan-500/40 text-cyan-300";
  if (name.includes("pescador"))
    return "bg-blue-500/20 border-blue-500/40 text-blue-300";
  if (name.includes("runa") || name.includes("forjamagia"))
    return "bg-violet-500/20 border-violet-500/40 text-violet-300";
  if (
    name.includes("equipamiento") ||
    name.includes("forjador") ||
    name.includes("zapatero") ||
    name.includes("sastre") ||
    name.includes("joyero") ||
    name.includes("escultor")
  ) {
    return "bg-purple-500/20 border-purple-500/40 text-purple-300";
  }
  return "bg-neutral-800 border-neutral-700 text-neutral-300";
};

export const RecipeCraftingCalculator: React.FC<{
  initialSelectedItem?: DofusItem | null;
  onSelectForCrushing?: (item: DofusItem) => void;
}> = ({ initialSelectedItem, onSelectForCrushing }) => {
  // Page / View mode state: false = Catalog list, true = Dedicated Item Page
  const [isDetailView, setIsDetailView] = useState<boolean>(
    Boolean(initialSelectedItem),
  );

  // Selected Job (Profession) Filter
  const [selectedJobId, setSelectedJobId] = useState<number | "all">("all");

  // Level Filter
  const [minLevel, setMinLevel] = useState<number | "">(1);
  const [maxLevel, setMaxLevel] = useState<number | "">(200);

  // Search text
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Sort By & Profit Filters
  const [sortBy, setSortBy] = useState<
    | "level_asc"
    | "level_desc"
    | "profit_desc"
    | "roi_desc"
    | "cost_asc"
    | "name"
  >("profit_desc");
  const [onlyProfitable, setOnlyProfitable] = useState<boolean>(false);
  const [minProfitKamas, setMinProfitKamas] = useState<number | "">(0);
  const [minRoiPercent, setMinRoiPercent] = useState<number | "">(0);

  const [marketPrices, setMarketPrices] = useState<MarketPriceMap>({});
  const [priceUpdatedAt, setPriceUpdatedAt] = useState<Record<number, number>>(
    {},
  );
  const [databaseVersion, setDatabaseVersion] = useState<number>(0);

  const [activePresetItem, setActivePresetItem] =
    useState<PresetCraftableItem | null>(PRESET_CRAFTABLE_ITEMS[0]);

  const [recipeTree, setRecipeTree] = useState<RecipeTreeNode | null>(null);
  const [loadingTree, setLoadingTree] = useState<boolean>(false);

  const [activeSalePrice, setActiveSalePrice] = useState<number | "">("");
  const [salePriceDraft, setSalePriceDraft] = useState<string>("");
  const [salePriceSavedFeedback, setSalePriceSavedFeedback] = useState<boolean>(false);
  const [addedToListNotice, setAddedToListNotice] = useState<boolean>(false);
  const saleDebounceTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  // FAST REACTIVE PRICE UPDATE:
  // Optimistically updates local React state immediately (0ms) so calculations update live on keystroke/blur
  // without triggering a full page re-fetch or loading spinners.
  const handlePriceChange = (itemId: number, newPrice: number) => {
    setMarketPrices((prev) => ({
      ...prev,
      [itemId]: newPrice,
    }));
    setPriceUpdatedAt((prev) => ({
      ...prev,
      [itemId]: Date.now(),
    }));

    // Async save to database quietly in background
    saveMarketPrice(itemId, newPrice).catch((error) => {
      console.error(`No se pudo guardar el precio del item ${itemId}:`, error);
    });
  };

  const handleSalePriceInputChange = (val: string) => {
    setSalePriceDraft(val);
    if (saleDebounceTimerRef.current) {
      clearTimeout(saleDebounceTimerRef.current);
    }
    if (!activePresetItem) return;

    // Debounce recalculations and saving after user pauses typing (500ms)
    saleDebounceTimerRef.current = setTimeout(() => {
      const num = val === "" ? 0 : Math.max(0, Number(val));
      setActiveSalePrice(num > 0 ? num : "");
      handlePriceChange(activePresetItem.id, num);
      setSalePriceSavedFeedback(true);
      setTimeout(() => setSalePriceSavedFeedback(false), 1500);
    }, 500);
  };

  const handleCommitSalePriceNow = (val: string) => {
    if (saleDebounceTimerRef.current) {
      clearTimeout(saleDebounceTimerRef.current);
    }
    if (!activePresetItem) return;
    const num = val === "" ? 0 : Math.max(0, Number(val));
    setActiveSalePrice(num > 0 ? num : "");
    handlePriceChange(activePresetItem.id, num);
    setSalePriceSavedFeedback(true);
    setTimeout(() => setSalePriceSavedFeedback(false), 1500);
  };

  useEffect(() => {
    const hydrateState = () => {
      setMarketPrices({
        ...DEFAULT_INGREDIENT_PRICES,
        ...getStoredMarketPrices(),
      });
      setPriceUpdatedAt(getStoredPriceUpdatedAt());
      setDatabaseVersion((prev) => prev + 1);
    };

    initializeDatabase()
      .then(() => {
        hydrateState();
      })
      .catch((error) => {
        console.error("No se pudo inicializar la base local:", error);
      });

    const handleDbUpdate = () => {
      hydrateState();
    };
    window.addEventListener("dofus_database_updated", handleDbUpdate);

    return () => {
      window.removeEventListener("dofus_database_updated", handleDbUpdate);
    };
  }, []);

  // Track last handled external initialSelectedItem to avoid resetting on recalculations
  const lastHandledInitialItemRef = useRef<number | null>(null);

  // Handle external selection (e.g. from Global Profit Ranking)
  useEffect(() => {
    if (initialSelectedItem && initialSelectedItem.id !== lastHandledInitialItemRef.current) {
      lastHandledInitialItemRef.current = initialSelectedItem.id;
      const foundPreset = PRESET_CRAFTABLE_ITEMS.find(
        (p) => p.id === initialSelectedItem.id,
      );
      if (foundPreset) {
        setActivePresetItem(foundPreset);
      } else {
        const itemJob = getJobForItem(initialSelectedItem);
        const tempPreset: PresetCraftableItem = {
          ...initialSelectedItem,
          jobId: itemJob.jobId,
          jobNameEs: itemJob.jobNameEs,
          defaultMarketSalePrice: initialSelectedItem.price || 150000,
          recipeData: {
            id: 9999,
            resultId: initialSelectedItem.id,
            ingredientIds: [2469, 2470],
            quantities: [5, 5],
          },
        };
        setActivePresetItem(tempPreset);
      }
      setIsDetailView(true);
    }
  }, [initialSelectedItem]);

  useEffect(() => {
    if (activePresetItem) {
      const storedPrice = marketPrices[activePresetItem.id];
      if (typeof storedPrice === "number" && storedPrice > 0) {
        setActiveSalePrice(storedPrice);
        setSalePriceDraft(String(storedPrice));
      } else {
        setActiveSalePrice("");
        setSalePriceDraft("");
      }
    } else {
      setActiveSalePrice("");
      setSalePriceDraft("");
    }
  }, [activePresetItem?.id]);

  // Build recipe tree ONLY when activePresetItem ID changes, NOT on every price edit!
  useEffect(() => {
    if (!activePresetItem) {
      setRecipeTree(null);
      return;
    }

    let isMounted = true;
    setLoadingTree(true);

    buildRecipeTree(activePresetItem.id, 1, 0, 3, new Set(), marketPrices)
      .then((tree) => {
        if (isMounted) {
          setRecipeTree(tree);
          setLoadingTree(false);
        }
      })
      .catch((err) => {
        console.error("Error al construir árbol de receta:", err);
        if (isMounted) setLoadingTree(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activePresetItem?.id]);

  const ITEMS_PER_PAGE = 25;
  const [currentPage, setCurrentPage] = useState<number>(1);

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
    minRoiPercent,
  ]);

  const [resolvedNamesTrigger, setResolvedNamesTrigger] = useState<number>(0);

  useEffect(() => {
    const handleDbUpdate = () => {
      setResolvedNamesTrigger((prev) => prev + 1);
    };
    window.addEventListener("dofus_database_updated", handleDbUpdate);
    return () => {
      window.removeEventListener("dofus_database_updated", handleDbUpdate);
    };
  }, []);

  const allCraftableItems: PresetCraftableItem[] = React.useMemo(() => {
    return getCraftableItemsSnapshot() as PresetCraftableItem[];
  }, [resolvedNamesTrigger, databaseVersion]);

  const getItemMetrics = (item: PresetCraftableItem) => {
    let cost = 0;
    if (item.recipeData && item.recipeData.ingredientIds) {
      item.recipeData.ingredientIds.forEach((ingId, idx) => {
        const qty = item.recipeData.quantities[idx] || 1;
        const ingPrice = marketPrices[ingId] || 0;
        cost += ingPrice * qty;
      });
    }
    const salePrice = marketPrices[item.id] || 0;
    const saleTax = salePrice > 0 ? Math.ceil(salePrice * 0.03) : 0;
    const netProfit = salePrice > 0 ? salePrice - saleTax - cost : -cost;
    const roi = cost > 0 ? (netProfit / cost) * 100 : 0;
    return { cost, salePrice, saleTax, netProfit, roi };
  };

  const filteredItems = React.useMemo(() => {
    const effMinLevel = minLevel === "" ? 1 : Number(minLevel);
    const effMaxLevel = maxLevel === "" ? 200 : Number(maxLevel);
    const effMinProfit = minProfitKamas === "" ? 0 : Number(minProfitKamas);
    const effMinRoi = minRoiPercent === "" ? 0 : Number(minRoiPercent);

    // 1. Filter and pre-compute metrics once per item
    const candidates: Array<{ item: PresetCraftableItem; metrics: ReturnType<typeof getItemMetrics>; name: string }> = [];

    for (const item of allCraftableItems) {
      if (selectedJobId !== "all" && item.jobId !== selectedJobId) {
        continue;
      }
      if (item.level < effMinLevel || item.level > effMaxLevel) {
        continue;
      }
      const itemName = getItemName(item);
      if (searchTerm.trim()) {
        if (
          !matchesSearchQuery(
            [
              itemName,
              getItemTypeName(item),
              item.jobNameEs,
              item.id,
            ],
            searchTerm,
          )
        ) {
          continue;
        }
      }

      const metrics = getItemMetrics(item);
      if (onlyProfitable && metrics.netProfit <= 0) continue;
      if (effMinProfit > 0 && metrics.netProfit < effMinProfit) continue;
      if (effMinRoi > 0 && metrics.roi < effMinRoi) continue;

      candidates.push({ item, metrics, name: itemName });
    }

    // 2. High-speed sort using pre-computed values without repeated metric calculations
    candidates.sort((a, b) => {
      const aIsNamed = !a.name.startsWith("Objeto #");
      const bIsNamed = !b.name.startsWith("Objeto #");
      if (aIsNamed && !bIsNamed) return -1;
      if (!aIsNamed && bIsNamed) return 1;

      if (sortBy === "profit_desc") return b.metrics.netProfit - a.metrics.netProfit;
      if (sortBy === "roi_desc") return b.metrics.roi - a.metrics.roi;
      if (sortBy === "cost_asc") return a.metrics.cost - b.metrics.cost;
      if (sortBy === "level_asc") return a.item.level - b.item.level;
      if (sortBy === "level_desc") return b.item.level - a.item.level;
      if (sortBy === "name") return a.name.localeCompare(b.name);
      return 0;
    });

    return candidates.map((c) => c.item);
  }, [
    allCraftableItems,
    selectedJobId,
    minLevel,
    maxLevel,
    searchTerm,
    sortBy,
    onlyProfitable,
    minProfitKamas,
    minRoiPercent,
    marketPrices,
  ]);

  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE) || 1;
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedItems = React.useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
    return filteredItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredItems, safeCurrentPage]);

  const paginatedIdsString = React.useMemo(() => {
    return paginatedItems.map((item) => item.id).join(",");
  }, [paginatedItems]);

  useEffect(() => {
    if (!paginatedIdsString) return;
    const visibleIds = paginatedIdsString
      .split(",")
      .map(Number)
      .filter(Boolean);

    const missingIds = visibleIds.filter((id) => {
      const item = paginatedItems.find((i) => i.id === id);
      const name = item ? getItemName(item) : "";
      return !name || name.startsWith("Objeto #");
    });

    if (missingIds.length > 0) {
      void resolveMissingItemNamesInBatch(missingIds);
    }
  }, [paginatedIdsString]);

  // Real-time synchronous calculation using marketPrices
  const directCraftCost = recipeTree
    ? calculateTreeCraftCost(recipeTree, "direct_buy", marketPrices)
    : 0;

  const autoOptimalCost = recipeTree
    ? calculateTreeCraftCost(recipeTree, "auto_optimal", marketPrices)
    : 0;

  const effectiveSalePrice =
    typeof activeSalePrice === "number" ? activeSalePrice : 0;
  const activeSaleTax =
    effectiveSalePrice > 0 ? Math.ceil(effectiveSalePrice * 0.03) : 0;
  const netProfit =
    effectiveSalePrice > 0
      ? effectiveSalePrice - activeSaleTax - autoOptimalCost
      : -autoOptimalCost;
  const profitMarginPercent =
    autoOptimalCost > 0 ? (netProfit / autoOptimalCost) * 100 : 0;

  const handleSelectItemForDetail = (item: PresetCraftableItem) => {
    setActivePresetItem(item);
    setIsDetailView(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ---------------------------------------------------------------------------
  // VIEW MODE A: DEDICATED FULL-WIDTH ITEM PAGE ("PÁGINA PROPIA" HORIZONTAL)
  // ---------------------------------------------------------------------------
  if (isDetailView && activePresetItem) {
    return (
      <div className="space-y-4 w-full">
        {/* Top Header Navigation Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-lg">
          <button
            onClick={() => setIsDetailView(false)}
            className="w-full sm:w-auto px-3.5 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 hover:border-amber-500/50 text-amber-400 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>Volver</span>
          </button>
        </div>

        {/* Hero Item Banner Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-slate-950 border border-slate-800 rounded-2xl p-2 flex items-center justify-center shrink-0 shadow-inner">
                {getItemIconUrl(activePresetItem) ? (
                  <img
                    src={getItemIconUrl(activePresetItem)}
                    alt={getItemName(activePresetItem)}
                    className="w-12 h-12 object-contain"
                    onError={(e) => {
                      const fallback = getItemFallbackIconUrl(activePresetItem);
                      if (
                        fallback &&
                        (e.target as HTMLImageElement).src !== fallback
                      ) {
                        (e.target as HTMLImageElement).src = fallback;
                      } else {
                        (e.target as HTMLElement).style.display = "none";
                      }
                    }}
                  />
                ) : (
                  <Wrench className="w-7 h-7 text-slate-500" />
                )}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl md:text-2xl font-black text-white tracking-wide">
                    {getItemName(activePresetItem)}
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 text-xs font-bold font-mono">
                    Niv. {activePresetItem.level}
                  </span>
                </div>
                <div className="flex items-center gap-2 pt-0.5 flex-wrap text-xs">
                  <span className="px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20 font-bold text-amber-400">
                    {activePresetItem.jobNameEs}
                  </span>
                  {getItemTypeName(activePresetItem) && (
                    <span className="px-2 py-0.5 rounded-lg bg-sky-500/10 border border-sky-500/20 font-bold text-sky-400">
                      {getItemTypeName(activePresetItem)}
                    </span>
                  )}
                  {onSelectForCrushing && (
                    <button
                      onClick={() => onSelectForCrushing(activePresetItem)}
                      className="px-2 py-0.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 font-bold text-amber-400 flex items-center gap-1 transition-colors"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      Romper
                    </button>
                  )}
                  <button
                    onClick={() => {
                      addToShoppingList(activePresetItem, 1);
                      setAddedToListNotice(true);
                      setTimeout(() => setAddedToListNotice(false), 2000);
                    }}
                    className="px-2.5 py-0.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 font-bold text-emerald-300 flex items-center gap-1 transition-colors"
                  >
                    {addedToListNotice ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <ShoppingCart className="w-3.5 h-3.5" />}
                    {addedToListNotice ? "¡Añadido!" : "Añadir al carrito"}
                  </button>
                </div>
              </div>
            </div>

            {/* Sale Price Interactive Editor Box */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 text-right w-full md:w-auto shrink-0 shadow-inner">
              <label className="block text-[11px] font-bold text-slate-400 mb-1 flex items-center justify-end gap-1">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                Precio Venta HDV
              </label>
              <div className="flex items-center justify-end gap-2">
                <div className="relative">
                  <input
                    type="number"
                    value={salePriceDraft}
                    onChange={(e) => handleSalePriceInputChange(e.target.value)}
                    onBlur={() => handleCommitSalePriceNow(salePriceDraft)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleCommitSalePriceNow(salePriceDraft);
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    placeholder="0"
                    className="w-32 bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1 text-right text-emerald-400 font-mono font-bold text-base focus:outline-none focus:border-amber-500 transition-colors pr-6"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-500 font-mono pointer-events-none">
                    K
                  </span>
                </div>
                {salePriceSavedFeedback && (
                  <span className="flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg">
                    <Check className="w-3.5 h-3.5" />
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Metrics Dashboard */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-0.5 shadow-md">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                Costo Crafteo
              </span>
              <div className="text-xl font-black font-mono text-amber-400">
                {autoOptimalCost.toLocaleString()} K
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-0.5 shadow-md">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                Venta (-3%)
              </span>
              <div className="text-xl font-black font-mono text-emerald-400">
                {effectiveSalePrice > 0 ? `${(effectiveSalePrice - activeSaleTax).toLocaleString()} K` : "---"}
              </div>
            </div>

            <div
              className={`p-3 rounded-xl border space-y-0.5 shadow-md ${
                netProfit >= 0
                  ? "bg-emerald-500/10 border-emerald-500/30"
                  : "bg-red-500/10 border-red-500/30"
              }`}
            >
              <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider block">
                Ganancia Neta
              </span>
              <div
                className={`text-xl font-black font-mono ${
                  netProfit >= 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {effectiveSalePrice > 0 ? `${netProfit >= 0 ? "+" : ""}${netProfit.toLocaleString()} K` : "---"}
              </div>
            </div>

            <div
              className={`p-3 rounded-xl border space-y-0.5 shadow-md ${
                profitMarginPercent >= 0
                  ? "bg-amber-500/10 border-amber-500/30"
                  : "bg-red-500/10 border-red-500/30"
              }`}
            >
              <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider block">
                ROI
              </span>
              <div
                className={`text-xl font-black font-mono ${
                  profitMarginPercent >= 0 ? "text-amber-400" : "text-red-400"
                }`}
              >
                {effectiveSalePrice > 0 ? `${profitMarginPercent > 0 ? "+" : ""}${profitMarginPercent.toFixed(1)}%` : "---"}
              </div>
            </div>
          </div>

          {/* Strategy Banner */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-amber-500/30 space-y-2.5 shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                Ruta de Fabricación
              </span>
              {autoOptimalCost < directCraftCost && (
                <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded border border-emerald-500/30">
                  Ahorro: {(directCraftCost - autoOptimalCost).toLocaleString()} K
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs font-mono">
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400 text-[10px] font-sans block font-semibold">
                  Compra Directa:
                </span>
                <span className="text-sm font-bold text-white">
                  {directCraftCost.toLocaleString()} K
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-emerald-500/30">
                <span className="text-slate-400 text-[10px] font-sans block font-semibold">
                  Ruta Óptima:
                </span>
                <span className="text-sm font-bold text-emerald-400">
                  {autoOptimalCost.toLocaleString()} K
                </span>
              </div>
            </div>
          </div>

          {/* Horizontal Ingredients Section */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <Layers className="w-5 h-5 text-amber-400" />
                  Ingredientes y Precios de Mercadillo
                </h2>
                {recipeTree?.subIngredients && recipeTree.subIngredients.filter((s) => (marketPrices[s.itemId] || 0) <= 0).length > 0 && (
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    ⚠️ {recipeTree.subIngredients.filter((s) => (marketPrices[s.itemId] || 0) <= 0).length} sin precio
                  </span>
                )}
              </div>
            </div>

            {loadingTree ? (
              <div className="py-16 text-center space-y-3 bg-slate-950 border border-slate-800 rounded-2xl">
                <RefreshCw className="w-8 h-8 animate-spin text-amber-400 mx-auto" />
                <p className="text-xs text-slate-400">
                  Cargando receta e ingredientes...
                </p>
              </div>
            ) : recipeTree &&
              recipeTree.subIngredients &&
              recipeTree.subIngredients.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {recipeTree.subIngredients.map((childNode) => (
                  <HorizontalIngredientCard
                    key={childNode.itemId}
                    node={childNode}
                    marketPrices={marketPrices}
                    priceUpdatedAt={priceUpdatedAt}
                    onPriceChange={handlePriceChange}
                  />
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-slate-500 bg-slate-950 border border-slate-800 rounded-2xl">
                Este objeto no posee receta de fabricación registrada o es un recurso base.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // VIEW MODE B: FULL CATALOG & SEARCH PAGE (MODO CATÁLOGO)
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-4 w-full">
      {/* Job Selection Cards Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-black text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
            <Wrench className="w-4 h-4 text-amber-400" />
            Selecciona un Oficio
          </span>
          <span className="text-[11px] font-mono text-slate-500">
            {selectedJobId === "all"
              ? `Mostrando todos (${DOFUS_JOBS.length} oficios)`
              : `Oficio: ${DOFUS_JOBS.find((j) => j.id === selectedJobId)?.nameEs || `ID #${selectedJobId}`}`}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2 text-xs">
          <button
            onClick={() => setSelectedJobId("all")}
            className={`px-3 py-2 rounded-xl font-bold transition-all flex items-center justify-center sm:justify-start gap-2 ${
              selectedJobId === "all"
                ? "bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20"
                : "bg-slate-950 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 hover:bg-slate-900"
            }`}
          >
            <Layers className="w-4 h-4 shrink-0" />
            <span className="truncate">Todos ({DOFUS_JOBS.length})</span>
          </button>

          {DOFUS_JOBS.map((job) => {
            const isSelected = selectedJobId === job.id;
            const JobIcon = JOB_ICON_MAP[job.icon] || Wrench;
            return (
              <button
                key={job.id}
                onClick={() => setSelectedJobId(job.id)}
                className={`px-3 py-2 rounded-xl font-bold transition-all flex items-center justify-center sm:justify-start gap-2 ${
                  isSelected
                    ? "bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20"
                    : "bg-slate-950 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 hover:bg-slate-900"
                }`}
              >
                <JobIcon className="w-4 h-4 shrink-0 text-amber-400" />
                <span className="truncate">{job.nameEs}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <Wrench className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                Catálogo de Recetas
                <span className="text-xs text-amber-400 font-mono font-bold px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  {filteredItems.length} Objetos
                </span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <label className="inline-flex items-center gap-1.5 cursor-pointer bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-slate-300 hover:text-white transition-colors">
              <input
                type="checkbox"
                checked={onlyProfitable}
                onChange={(e) => setOnlyProfitable(e.target.checked)}
                className="rounded border-slate-700 text-amber-500 focus:ring-0 bg-slate-950"
              />
              <span className="font-bold text-emerald-400">
                Solo Rentables (&gt;0 K)
              </span>
            </label>
          </div>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          <div>
            <label className="block text-slate-400 font-bold mb-1 flex items-center gap-1">
              <Search className="w-3.5 h-3.5 text-amber-400" />
              Buscar Objeto
            </label>
            <input
              type="text"
              placeholder="ej. Gelano, Sombrero..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none font-medium"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-bold mb-1 flex items-center gap-1">
              <Tag className="w-3.5 h-3.5 text-amber-400" />
              Rango de Nivel
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
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-bold focus:border-amber-500 focus:outline-none"
            >
              <option value="all">Todos los Niveles (1-200)</option>
              <option value="1-50">Nivel 1 - 50</option>
              <option value="51-100">Nivel 51 - 100</option>
              <option value="101-150">Nivel 101 - 150</option>
              <option value="151-200">Nivel 151 - 200</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 font-bold mb-1">
              Ordenar Por
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-bold focus:border-amber-500 focus:outline-none"
            >
              <option value="profit_desc">Mayor Ganancia (Kamas)</option>
              <option value="roi_desc">Mayor Rentabilidad (% ROI)</option>
              <option value="cost_asc">Menor Costo Crafteo</option>
              <option value="level_asc">Nivel Ascendente</option>
              <option value="level_desc">Nivel Descendente</option>
              <option value="name">Nombre A-Z</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 font-bold mb-1">
              Ganancia Mín. (Kamas)
            </label>
            <input
              type="number"
              value={minProfitKamas}
              onChange={(e) => {
                const val = e.target.value;
                setMinProfitKamas(val === "" ? "" : Number(val));
              }}
              step={5000}
              placeholder="0"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono focus:border-amber-500 focus:outline-none font-bold"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-bold mb-1">
              ROI Mínimo (%)
            </label>
            <input
              type="number"
              value={minRoiPercent}
              onChange={(e) => {
                const val = e.target.value;
                setMinRoiPercent(val === "" ? "" : Number(val));
              }}
              placeholder="0"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono focus:border-amber-500 focus:outline-none font-bold"
            />
          </div>
        </div>
      </div>

      {/* Catalog Items List Grid (25 items per page) */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {paginatedItems.map((item) => {
            const metrics = getItemMetrics(item);
            const itemName = getItemName(item);
            const iconUrl = getItemIconUrl(item);
            const jobBadgeClass = getJobBadgeStyle(item.jobNameEs);

            return (
              <div
                key={item.id}
                onClick={() => handleSelectItemForDetail(item)}
                className="bg-slate-900 border border-slate-800 hover:border-amber-500/60 rounded-2xl p-3.5 sm:p-4 transition-all cursor-pointer shadow-lg hover:shadow-amber-500/10 group flex flex-col justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 p-1 flex items-center justify-center shrink-0 group-hover:border-amber-500/40 transition-colors shadow-inner">
                    {iconUrl ? (
                      <img
                        src={iconUrl}
                        alt={itemName}
                        className="w-10 h-10 object-contain"
                        onError={(e) => {
                          const fallback = getItemFallbackIconUrl(item);
                          if (
                            fallback &&
                            (e.target as HTMLImageElement).src !== fallback
                          ) {
                            (e.target as HTMLImageElement).src = fallback;
                          } else {
                            (e.target as HTMLElement).style.display = "none";
                          }
                        }}
                      />
                    ) : (
                      <Wrench className="w-5 h-5 text-slate-500" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-start justify-between gap-1.5">
                      <span className="font-black text-white text-base leading-snug truncate group-hover:text-amber-400 transition-colors">
                        {itemName}
                      </span>
                      <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-md bg-slate-950 text-amber-400 border border-slate-800 shrink-0">
                        Nv. {item.level}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <span
                        className={`text-xs font-bold px-2.5 py-0.5 rounded-md border ${jobBadgeClass}`}
                      >
                        {item.jobNameEs}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 grid grid-cols-3 gap-2 text-center font-mono">
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                      Costo
                    </span>
                    <span className="text-sm font-bold text-slate-200">
                      {metrics.cost > 0
                        ? `${metrics.cost.toLocaleString()} K`
                        : "---"}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                      Venta
                    </span>
                    <span className="text-sm font-bold text-amber-300">
                      {metrics.salePrice > 0
                        ? `${metrics.salePrice.toLocaleString()} K`
                        : "---"}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                      Ganancia
                    </span>
                    <span
                      className={`text-sm font-black block ${
                        metrics.netProfit >= 0
                          ? "text-emerald-400"
                          : "text-rose-400"
                      }`}
                    >
                      {metrics.salePrice > 0
                        ? `${metrics.netProfit >= 0 ? "+" : ""}${metrics.netProfit.toLocaleString()} K`
                        : "---"}
                    </span>
                  </div>
                </div>

                <div className="pt-0.5 flex items-center justify-between text-xs text-amber-400 font-bold group-hover:translate-x-0.5 transition-transform">
                  <span className="flex items-center gap-2">
                    {metrics.roi > 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-xs font-mono border border-emerald-500/30 font-bold">
                        +{metrics.roi.toFixed(0)}% ROI
                      </span>
                    )}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-amber-400 transition-colors" />
                </div>
              </div>
            );
          })}
        </div>

        {filteredItems.length === 0 && (
          <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 text-xs">
            No se encontraron objetos con los filtros seleccionados.
          </div>
        )}

        {/* Catalog Pagination Controls */}
        {filteredItems.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shadow-md">
            <span className="text-slate-400 font-mono">
              Mostrando{" "}
              <strong className="text-white">
                {(safeCurrentPage - 1) * ITEMS_PER_PAGE + 1}
              </strong>{" "}
              a{" "}
              <strong className="text-white">
                {Math.min(
                  safeCurrentPage * ITEMS_PER_PAGE,
                  filteredItems.length,
                )}
              </strong>{" "}
              de{" "}
              <strong className="text-amber-400">{filteredItems.length}</strong>{" "}
              Objetos
            </span>

            <div className="flex items-center gap-2">
              <button
                disabled={safeCurrentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500/50 disabled:opacity-40 disabled:hover:border-slate-800 text-slate-300 font-bold flex items-center gap-1 transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Atrás</span>
              </button>

              <span className="px-3 font-mono text-slate-400 text-xs">
                Página{" "}
                <strong className="text-amber-400">{safeCurrentPage}</strong> de{" "}
                {totalPages}
              </span>

              <button
                disabled={safeCurrentPage >= totalPages}
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500/50 disabled:opacity-40 disabled:hover:border-slate-800 text-slate-300 font-bold flex items-center gap-1 transition-all"
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

// -----------------------------------------------------------------------------
// HORIZONTAL INGREDIENT CARD COMPONENT
// -----------------------------------------------------------------------------
interface HorizontalIngredientCardProps {
  node: RecipeTreeNode;
  marketPrices: MarketPriceMap;
  priceUpdatedAt: Record<number, number>;
  onPriceChange: (itemId: number, newPrice: number) => void;
}

const HorizontalIngredientCard: React.FC<HorizontalIngredientCardProps> = ({
  node,
  marketPrices,
  priceUpdatedAt,
  onPriceChange,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const currentPrice = marketPrices[node.itemId] || node.marketPrice || 0;
  const [draftPrice, setDraftPrice] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const totalPriceForQuantity = currentPrice * node.quantity;
  const hasSubCraft =
    node.isCraftable && node.subIngredients && node.subIngredients.length > 0;

  const directBuyCost = totalPriceForQuantity;
  const subCraftCost = hasSubCraft
    ? calculateTreeCraftCost(node, "auto_optimal", marketPrices)
    : directBuyCost;

  const isSubcraftCheaper = hasSubCraft && subCraftCost < directBuyCost;
  const savings = Math.abs(directBuyCost - subCraftCost);

  const handleInputChange = (val: string) => {
    setDraftPrice(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const numericVal = val === "" ? 0 : Number(val);
      onPriceChange(node.itemId, numericVal);
    }, 500);
  };

  const handleInputBlurOrEnter = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const nextValue =
      draftPrice === null
        ? currentPrice
        : draftPrice === ""
          ? 0
          : Number(draftPrice);
    onPriceChange(node.itemId, nextValue);
    setDraftPrice(null);
  };

  return (
    <div className="bg-slate-950 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-4 space-y-3.5 text-xs shadow-lg flex flex-col justify-between">
      <div className="space-y-3">
        {/* Header with Icon, Quantity and Name */}
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-slate-900 border border-slate-800 p-1 flex items-center justify-center shrink-0 shadow-inner">
              {getItemIconUrl(node.item) ? (
                <img
                  src={getItemIconUrl(node.item)}
                  alt={getItemName(node.item)}
                  className="w-9 h-9 object-contain"
                  onError={(e) => {
                    const fallback = getItemFallbackIconUrl(node.item);
                    if (
                      fallback &&
                      (e.target as HTMLImageElement).src !== fallback
                    ) {
                      (e.target as HTMLImageElement).src = fallback;
                    } else {
                      (e.target as HTMLElement).style.display = "none";
                    }
                  }}
                />
              ) : (
                <span className="font-mono text-amber-400 font-bold text-xs">
                  x{node.quantity}
                </span>
              )}
            </div>

            <div className="min-w-0">
              <span className="font-black text-white text-sm block truncate leading-tight">
                {getItemName(node.item)}
              </span>
            </div>
          </div>

          <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 font-black font-mono text-xs shrink-0 shadow-sm">
            x{node.quantity}
          </span>
        </div>

        {/* Real-time Interactive Unit Price Editor */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-300">
            <span>Precio Unitario:</span>
            <span className="font-mono font-bold text-amber-400">Kamas</span>
          </div>
          <input
            type="number"
            value={
              draftPrice !== null
                ? draftPrice
                : currentPrice > 0
                  ? currentPrice
                  : ""
            }
            onChange={(e) => handleInputChange(e.target.value)}
            onBlur={handleInputBlurOrEnter}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleInputBlurOrEnter();
                (e.target as HTMLInputElement).blur();
              }
            }}
            placeholder="0"
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-right text-amber-300 font-mono font-black text-base focus:outline-none focus:border-amber-400 transition-colors"
          />
        </div>
      </div>

      <div className="space-y-2.5 pt-2 border-t border-slate-800">
        {/* Total Cost for required quantity */}
        <div className="flex items-center justify-between font-mono">
          <span className="text-xs font-bold text-slate-400">
            Subtotal ({node.quantity}x):
          </span>
          <span className="text-emerald-400 font-black text-base">
            {totalPriceForQuantity.toLocaleString()} K
          </span>
        </div>

        {/* Sub-crafting comparison & Toggle */}
        {hasSubCraft && (
          <div className="pt-1.5 space-y-2">
            {/* Explicit comparison box showing both options */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                {currentPrice > 0 ? (
                  subCraftCost < directBuyCost ? (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-black text-[11px] font-mono">
                      Craftear (-
                      {(directBuyCost - subCraftCost).toLocaleString()} K)
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md bg-sky-500/20 border border-sky-500/40 text-sky-300 font-black text-[11px] font-mono">
                      Comprar Directo{" "}
                      {savings > 0 ? `(-${savings.toLocaleString()} K)` : ""}
                    </span>
                  )
                ) : (
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 font-black text-[11px] font-mono">
                    Crafteo: {subCraftCost.toLocaleString()} K
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div
                  className={`p-2 rounded-lg border ${
                    currentPrice > 0 && directBuyCost <= subCraftCost
                      ? "bg-sky-500/10 border-sky-500/40"
                      : "bg-slate-950 border-slate-800"
                  }`}
                >
                  <span className="text-[10px] text-slate-400 block font-sans font-bold">
                    Comprar Listo:
                  </span>
                  <span className="font-black text-white text-xs">
                    {currentPrice > 0
                      ? `${directBuyCost.toLocaleString()} K`
                      : "Sin precio"}
                  </span>
                </div>
                <div
                  className={`p-2 rounded-lg border ${
                    currentPrice > 0 && subCraftCost < directBuyCost
                      ? "bg-emerald-500/10 border-emerald-500/40"
                      : "bg-slate-950 border-slate-800"
                  }`}
                >
                  <span className="text-[10px] text-slate-400 block font-sans font-bold">
                    Craftear Sub-receta:
                  </span>
                  <span className="font-black text-emerald-400 text-xs">
                    {subCraftCost.toLocaleString()} K
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full py-1.5 px-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500/40 text-slate-300 hover:text-white text-xs font-bold flex items-center justify-between transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <span className="text-amber-400">⚙️</span>
                <span>
                  Desglose de Sub-receta ({node.subIngredients?.length})
                </span>
              </span>
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-amber-400" />
              )}
            </button>

            {isExpanded && node.subIngredients && (
              <div className="mt-2 space-y-2 pl-1 border-l-2 border-amber-500/30">
                {node.subIngredients.map((sub) => (
                  <SubIngredientRow
                    key={sub.itemId}
                    sub={sub}
                    marketPrices={marketPrices}
                    onPriceChange={onPriceChange}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// SUB-INGREDIENT ROW COMPONENT (EDITABLE PRICES FOR SUB-RECIPES)
// -----------------------------------------------------------------------------
interface SubIngredientRowProps {
  sub: RecipeTreeNode;
  marketPrices: MarketPriceMap;
  onPriceChange: (itemId: number, newPrice: number) => void;
}

const SubIngredientRow: React.FC<SubIngredientRowProps> = ({
  sub,
  marketPrices,
  onPriceChange,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const currentPrice = marketPrices[sub.itemId] || sub.marketPrice || 0;
  const [draftPrice, setDraftPrice] = useState<string | null>(null);

  const displayPrice =
    draftPrice !== null ? draftPrice : currentPrice > 0 ? currentPrice : "";
  const subTotal = currentPrice * sub.quantity;
  const hasSubSubCraft =
    sub.isCraftable && sub.subIngredients && sub.subIngredients.length > 0;

  const subCraftCost = hasSubSubCraft
    ? calculateTreeCraftCost(sub, "full_subcraft", marketPrices)
    : subTotal;
  const directBuyCost = subTotal;
  const isSubCraftCheaper =
    hasSubSubCraft && currentPrice > 0 && subCraftCost < directBuyCost;
  const subSavings =
    hasSubSubCraft && currentPrice > 0
      ? Math.abs(directBuyCost - subCraftCost)
      : 0;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 space-y-2 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-slate-950 border border-slate-800 p-0.5 flex items-center justify-center shrink-0">
            {getItemIconUrl(sub.item) ? (
              <img
                src={getItemIconUrl(sub.item)}
                alt={getItemName(sub.item)}
                className="w-5 h-5 object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            ) : (
              <span className="text-[10px] text-amber-400 font-mono font-bold">
                x{sub.quantity}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <span className="text-xs font-bold text-white block truncate">
              {getItemName(sub.item)}
            </span>
          </div>
        </div>
        <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold font-mono text-xs shrink-0">
          x{sub.quantity}
        </span>
      </div>

      <div className="bg-slate-950 border border-slate-800 rounded-lg p-2 flex items-center justify-between gap-2 text-xs font-mono">
        <span className="text-slate-400 text-[11px] font-bold">Precio U.:</span>
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={displayPrice}
            onChange={(e) => {
              const val = e.target.value;
              setDraftPrice(val);
              const numericVal = val === "" ? 0 : Number(val);
              onPriceChange(sub.itemId, numericVal);
            }}
            onBlur={() => {
              const nextVal =
                draftPrice === null
                  ? currentPrice
                  : draftPrice === ""
                    ? 0
                    : Number(draftPrice);
              onPriceChange(sub.itemId, nextVal);
              setDraftPrice(null);
            }}
            placeholder="0"
            className="w-24 bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-lg px-2 py-1 text-right font-black text-amber-400 text-xs focus:outline-none"
          />
          <span className="text-slate-400 font-bold">K</span>
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] font-mono px-0.5">
        <span className="text-slate-400 font-bold">Total ({sub.quantity}x):</span>
        {currentPrice > 0 ? (
          <span className="text-emerald-400 font-black">
            {subTotal.toLocaleString()} K
          </span>
        ) : (
          <span className="text-amber-400/80 font-bold text-[10px]">
            0 K (sin precio)
          </span>
        )}
      </div>

      {hasSubSubCraft && (
        <div className="pt-1.5 border-t border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-400 font-bold">Crafteo de Sub-receta:</span>
            <span className="text-emerald-400 font-black">
              {subCraftCost.toLocaleString()} K
            </span>
          </div>

          {currentPrice > 0 && (
            <div className="text-[10px] font-mono font-bold">
              {isSubCraftCheaper ? (
                <span className="text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 px-1.5 py-0.5 rounded block text-center">
                  Más rentable craftear (-{subSavings.toLocaleString()} K)
                </span>
              ) : (
                <span className="text-sky-300 bg-sky-500/20 border border-sky-500/30 px-1.5 py-0.5 rounded block text-center">
                  Más rentable comprar listo (-{subSavings.toLocaleString()} K)
                </span>
              )}
            </div>
          )}

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full py-1 px-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 text-[10px] font-bold flex items-center justify-between transition-colors"
          >
            <span>Sub-ingredientes ({sub.subIngredients?.length})</span>
            {isExpanded ? (
              <ChevronDown className="w-3 h-3 text-amber-400" />
            ) : (
              <ChevronRight className="w-3 h-3 text-amber-400" />
            )}
          </button>
          {isExpanded && sub.subIngredients && (
            <div className="mt-2 space-y-2 pl-1 border-l-2 border-amber-500/30">
              {sub.subIngredients.map((childSub) => (
                <SubIngredientRow
                  key={childSub.itemId}
                  sub={childSub}
                  marketPrices={marketPrices}
                  onPriceChange={onPriceChange}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
