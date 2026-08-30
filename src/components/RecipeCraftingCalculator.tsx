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
  History,
  Map as MapIcon,
  Vault,
  BarChart2,
  FolderOpen,
  FolderClosed,
  GitBranch,
  CornerDownRight,
  Hammer,
  CheckCircle2,
} from "lucide-react";
import { ItemPriceHistoryModal } from "./ItemPriceHistoryModal";
import {
  getStoredSalesVolumeMap,
  saveItemSalesVolume,
  analyzeSalesVolume,
  ItemSalesVolume,
} from "../services/salesVolumeService";
import {
  isBycResource,
  analyzeBycResourceCost,
  getOptimizedIngredientCost,
  BycResourceCostAnalysis,
} from "../services/bycCostService";

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
  addOrUpdateBankItem,
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
  Map: MapIcon,
};

const getJobBadgeStyle = (jobName: string) => {
  const name = (jobName || "").toLowerCase();
  if (name.includes("mapa") || name.includes("tesoro"))
    return "bg-amber-500/20 border-amber-500/40 text-amber-200";
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
  const [itemForHistory, setItemForHistory] = useState<DofusItem | null>(null);

  const [activeSalePrice, setActiveSalePrice] = useState<number | "">("");
  const [salePriceDraft, setSalePriceDraft] = useState<string>("");
  const [salePriceSavedFeedback, setSalePriceSavedFeedback] = useState<boolean>(false);
  const [addedToListNotice, setAddedToListNotice] = useState<boolean>(false);
  const [treeExpandTrigger, setTreeExpandTrigger] = useState<{ trigger: number; expand: boolean }>({
    trigger: 0,
    expand: false,
  });
  const saleDebounceTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Sales Volume Map (24h, 7d, 30d records)
  const [salesVolumeMap, setSalesVolumeMap] = useState<Record<number, ItemSalesVolume>>(() => {
    return getStoredSalesVolumeMap();
  });
  const [isDetailVolumeDrawerOpen, setIsDetailVolumeDrawerOpen] = useState<boolean>(false);

  useEffect(() => {
    const handleVolumeUpdated = () => {
      setSalesVolumeMap(getStoredSalesVolumeMap());
    };
    window.addEventListener("dofus_sales_volume_updated", handleVolumeUpdated);
    return () => {
      window.removeEventListener("dofus_sales_volume_updated", handleVolumeUpdated);
    };
  }, []);

  const handleUpdateVolume = (
    itemId: number,
    field: "sales24h" | "sales7d" | "sales30d",
    value: string
  ) => {
    const num = value === "" ? undefined : Math.max(0, parseInt(value, 10) || 0);
    const updated = saveItemSalesVolume(itemId, { [field]: num });
    setSalesVolumeMap({ ...updated });
  };

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

  const [itemsPerPage, setItemsPerPage] = useState<number>(24);
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
    itemsPerPage,
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

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage) || 1;
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedItems = React.useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * itemsPerPage;
    return filteredItems.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredItems, safeCurrentPage, itemsPerPage]);

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

  const activeSalesVolume = activePresetItem ? salesVolumeMap[activePresetItem.id] : undefined;
  const activeSalesAnalysis = analyzeSalesVolume(effectiveSalePrice, activeSalesVolume);

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
                  {activeSalesAnalysis.hasData && activeSalesAnalysis.turnoverRating && (
                    <span
                      className={`px-2 py-0.5 rounded-md text-xs font-bold border flex items-center gap-1 ${
                        activeSalesAnalysis.turnoverRating === "alta"
                          ? "bg-emerald-950/60 text-emerald-300 border-emerald-500/40"
                          : activeSalesAnalysis.turnoverRating === "media"
                          ? "bg-amber-950/60 text-amber-300 border-amber-500/40"
                          : "bg-slate-800 text-slate-300 border-slate-700"
                      }`}
                    >
                      <span>{activeSalesAnalysis.turnoverLabel}</span>
                    </span>
                  )}
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
                <button
                  type="button"
                  onClick={() => setIsDetailVolumeDrawerOpen((prev) => !prev)}
                  className={`p-1.5 rounded-xl border transition-all shrink-0 ${
                    isDetailVolumeDrawerOpen || activeSalesAnalysis.hasData
                      ? "bg-indigo-950/60 border-indigo-500/60 text-indigo-300"
                      : "bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200"
                  }`}
                  title="Registrar o ver volumen de ventas (24h, 7d, 30d)"
                >
                  <BarChart2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setItemForHistory(activePresetItem)}
                  className="p-1.5 rounded-xl bg-slate-900 hover:bg-amber-500/20 border border-slate-700 hover:border-amber-500/40 text-slate-400 hover:text-amber-300 transition-all shrink-0"
                  title="Ver historial de precios de este objeto"
                >
                  <History className="w-3.5 h-3.5" />
                </button>
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

          {/* Sales Volume Drawer (24h / 7d / 30d) for Recipe Crafting item */}
          {isDetailVolumeDrawerOpen && (
            <div className="bg-slate-950/90 border border-indigo-500/30 rounded-xl p-3.5 sm:p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                    Registro de Ventas en Mercadillo (HDV)
                  </span>
                </div>
                <span className="text-xs text-slate-400">
                  Ingresa las ventas registradas para estimar velocidad y precio
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* Input: Últimas 24 horas */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-300">Últimas 24h</span>
                    <span className="text-[11px] text-slate-500">Unidades vendidas</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    value={activeSalesVolume?.sales24h !== undefined ? activeSalesVolume.sales24h : ""}
                    onChange={(e) => handleUpdateVolume(activePresetItem.id, "sales24h", e.target.value)}
                    placeholder="—"
                    className="w-16 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-right font-mono font-bold text-indigo-300 text-sm focus:outline-none focus:border-indigo-400"
                  />
                </div>

                {/* Input: Últimos 7 días */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-300">Últimos 7 días</span>
                    <span className="text-[11px] text-slate-500">Total semana</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    value={activeSalesVolume?.sales7d !== undefined ? activeSalesVolume.sales7d : ""}
                    onChange={(e) => handleUpdateVolume(activePresetItem.id, "sales7d", e.target.value)}
                    placeholder="—"
                    className="w-16 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-right font-mono font-bold text-indigo-300 text-sm focus:outline-none focus:border-indigo-400"
                  />
                </div>

                {/* Input: Últimos 30 días */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-300">Últimos 30 días</span>
                    <span className="text-[11px] text-slate-500">Total mes</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    value={activeSalesVolume?.sales30d !== undefined ? activeSalesVolume.sales30d : ""}
                    onChange={(e) => handleUpdateVolume(activePresetItem.id, "sales30d", e.target.value)}
                    placeholder="—"
                    className="w-16 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-right font-mono font-bold text-indigo-300 text-sm focus:outline-none focus:border-indigo-400"
                  />
                </div>
              </div>

              {/* Estimates Output (Only when data exists) */}
              {activeSalesAnalysis.hasData ? (
                <div className="pt-2 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="flex flex-col">
                    <span className="text-slate-400">Ritmo diario estimado:</span>
                    <span className="text-slate-200 font-bold font-mono text-sm mt-0.5">
                      ~{activeSalesAnalysis.avgDailySales} u/día
                    </span>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-slate-400">Tiempo de venta estimado:</span>
                    <span className="text-slate-200 font-bold font-mono text-sm mt-0.5">
                      {activeSalesAnalysis.daysToSell !== null
                        ? activeSalesAnalysis.daysToSell < 1
                          ? `< 24 horas`
                          : `~${Math.round(activeSalesAnalysis.daysToSell)} días`
                        : "—"}
                    </span>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-slate-400">Precio sugerido de venta:</span>
                    <span className="text-amber-300 font-bold font-mono text-sm mt-0.5">
                      {activeSalesAnalysis.suggestedPrice !== null
                        ? `${activeSalesAnalysis.suggestedPrice.toLocaleString()} K`
                        : "—"}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic pt-1">
                  Sin datos de ventas ingresados aún. Los cálculos se actualizarán automáticamente al ingresar valores.
                </p>
              )}
            </div>
          )}

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
                    {recipeTree.subIngredients.filter((s) => (marketPrices[s.itemId] || 0) <= 0).length} sin precio
                  </span>
                )}
              </div>

              {/* Quick Tree Expand / Collapse Controls */}
              {recipeTree?.subIngredients && recipeTree.subIngredients.some((s) => s.isCraftable && s.subIngredients && s.subIngredients.length > 0) && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTreeExpandTrigger({ trigger: Date.now(), expand: true })}
                    className="px-2.5 py-1 rounded-xl bg-slate-950 hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 border border-slate-800 hover:border-amber-500/40 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                    title="Desplegar todos los sub-árboles de crafteo de la receta"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                    <span>Desplegar todo el árbol</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTreeExpandTrigger({ trigger: Date.now(), expand: false })}
                    className="px-2.5 py-1 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                    title="Plegar todos los sub-árboles"
                  >
                    <FolderClosed className="w-3.5 h-3.5" />
                    <span>Plegar todo</span>
                  </button>
                </div>
              )}
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
                    onOpenHistory={(item) => setItemForHistory(item)}
                    forceExpandTrigger={treeExpandTrigger.trigger}
                    forceExpandValue={treeExpandTrigger.expand}
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

        {/* Item Price History Modal */}
        <ItemPriceHistoryModal
          item={itemForHistory}
          isOpen={!!itemForHistory}
          onClose={() => setItemForHistory(null)}
          onPriceChanged={() => {
            const updatedPrices = getStoredMarketPrices();
            setMarketPrices({
              ...DEFAULT_INGREDIENT_PRICES,
              ...updatedPrices,
            });
            setPriceUpdatedAt(getStoredPriceUpdatedAt());
          }}
        />
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
                    <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                      <span
                        className={`text-xs font-bold px-2.5 py-0.5 rounded-md border ${jobBadgeClass}`}
                      >
                        {item.jobNameEs}
                      </span>
                      {(() => {
                        const itemVol = salesVolumeMap[item.id];
                        const itemAnalysis = analyzeSalesVolume(metrics.salePrice, itemVol);
                        if (!itemAnalysis.hasData || !itemAnalysis.turnoverRating) return null;
                        return (
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                              itemAnalysis.turnoverRating === "alta"
                                ? "bg-emerald-950/60 text-emerald-300 border-emerald-500/40"
                                : itemAnalysis.turnoverRating === "media"
                                ? "bg-amber-950/60 text-amber-300 border-amber-500/40"
                                : "bg-slate-800 text-slate-300 border-slate-700"
                            }`}
                          >
                            {itemAnalysis.turnoverLabel}
                          </span>
                        );
                      })()}
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
            <div className="flex items-center gap-3">
              <span className="text-slate-400 font-mono">
                Mostrando{" "}
                <strong className="text-white">
                  {(safeCurrentPage - 1) * itemsPerPage + 1}
                </strong>{" "}
                a{" "}
                <strong className="text-white">
                  {Math.min(
                    safeCurrentPage * itemsPerPage,
                    filteredItems.length,
                  )}
                </strong>{" "}
                de{" "}
                <strong className="text-amber-400">{filteredItems.length}</strong>{" "}
                Objetos
              </span>

              <div className="flex items-center gap-1.5 pl-2 border-l border-slate-800">
                <span className="text-slate-500 text-[11px] font-medium hidden sm:inline">
                  Por página:
                </span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  aria-label="Objetos por página"
                  className="bg-slate-950 text-slate-300 border border-slate-800 hover:border-slate-700 rounded-lg px-2 py-1 text-xs font-bold font-mono outline-none cursor-pointer"
                >
                  <option value={24}>24</option>
                  <option value={48}>48</option>
                  <option value={96}>96</option>
                </select>
              </div>
            </div>

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

      {/* Item Price History Modal */}
      <ItemPriceHistoryModal
        item={itemForHistory}
        isOpen={!!itemForHistory}
        onClose={() => setItemForHistory(null)}
        onPriceChanged={() => {
          const updatedPrices = getStoredMarketPrices();
          setMarketPrices({
            ...DEFAULT_INGREDIENT_PRICES,
            ...updatedPrices,
          });
          setPriceUpdatedAt(getStoredPriceUpdatedAt());
        }}
      />
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
  onOpenHistory?: (item: DofusItem) => void;
  forceExpandTrigger?: number;
  forceExpandValue?: boolean;
}

const HorizontalIngredientCard: React.FC<HorizontalIngredientCardProps> = ({
  node,
  marketPrices,
  priceUpdatedAt,
  onPriceChange,
  onOpenHistory,
  forceExpandTrigger = 0,
  forceExpandValue = false,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const currentPrice = marketPrices[node.itemId] || node.marketPrice || 0;
  const [draftPrice, setDraftPrice] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync with global expand/collapse buttons
  useEffect(() => {
    if (forceExpandTrigger > 0) {
      setIsExpanded(forceExpandValue);
    }
  }, [forceExpandTrigger, forceExpandValue]);

  const isByc = isBycResource(node.itemId);
  const bycAnalysis = isByc ? analyzeBycResourceCost(node.itemId, marketPrices) : null;
  const [selectedBycMethod, setSelectedBycMethod] = useState<"direct" | "fragments" | "map">(
    bycAnalysis?.bestMethod || "direct"
  );

  const effectiveBycUnitPrice = bycAnalysis
    ? selectedBycMethod === "fragments"
      ? bycAnalysis.fragmentsPrice
      : selectedBycMethod === "map"
        ? bycAnalysis.mapPrice
        : bycAnalysis.directPrice
    : currentPrice;

  const effectiveUnitPrice = isByc && bycAnalysis ? effectiveBycUnitPrice : currentPrice;
  const totalPriceForQuantity = effectiveUnitPrice * node.quantity;
  const hasSubCraft =
    node.isCraftable && node.subIngredients && node.subIngredients.length > 0;

  const directBuyCost = totalPriceForQuantity;
  const subCraftCost = hasSubCraft
    ? calculateTreeCraftCost(node, "auto_optimal", marketPrices)
    : directBuyCost;

  const isSubcraftCheaper = hasSubCraft && currentPrice > 0 && subCraftCost < directBuyCost;
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

  const handleApplyBycMethod = (method: "direct" | "fragments" | "map") => {
    setSelectedBycMethod(method);
    if (!bycAnalysis) return;
    let priceToApply = bycAnalysis.directPrice;
    if (method === "fragments") priceToApply = bycAnalysis.fragmentsPrice;
    if (method === "map") priceToApply = bycAnalysis.mapPrice;
    if (priceToApply > 0) {
      onPriceChange(node.itemId, priceToApply);
    }
  };

  const itemName = getItemName(node.item);

  return (
    <div
      className={`bg-slate-950 border rounded-2xl p-4 space-y-3.5 text-xs shadow-lg flex flex-col justify-between transition-colors ${
        isExpanded
          ? "border-amber-500/60 ring-1 ring-amber-500/20"
          : "border-slate-800 hover:border-amber-500/40"
      }`}
    >
      <div className="space-y-3">
        {/* Header with Icon, Quantity and Name */}
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-slate-900 border border-slate-800 p-1 flex items-center justify-center shrink-0 shadow-inner">
              {getItemIconUrl(node.item) ? (
                <img
                  src={getItemIconUrl(node.item)}
                  alt={itemName}
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
                {itemName}
              </span>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                {hasSubCraft ? (
                  <span className="px-1.5 py-0.2 text-[10px] font-bold rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                    <Wrench className="w-2.5 h-2.5" />
                    Sub-receta ({node.subIngredients?.length})
                  </span>
                ) : (
                  <span className="px-1.5 py-0.2 text-[10px] font-semibold rounded bg-slate-800 text-slate-400 border border-slate-700">
                    Recurso base
                  </span>
                )}
              </div>
            </div>
          </div>

          <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 font-black font-mono text-xs shrink-0 shadow-sm">
            x{node.quantity}
          </span>
        </div>

        {/* Real-time Interactive Unit Price Editor */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-300">
            <div className="flex items-center gap-1.5">
              <span>Precio Unitario:</span>
              {onOpenHistory && (
                <button
                  type="button"
                  onClick={() => onOpenHistory(node.item)}
                  className="p-1 rounded bg-slate-950 hover:bg-amber-500/20 text-slate-400 hover:text-amber-300 border border-slate-800 transition-colors cursor-pointer"
                  title="Ver historial de precios"
                >
                  <History className="w-3 h-3" />
                </button>
              )}
            </div>
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
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400">
              Subtotal ({node.quantity}x):
            </span>
            <button
              type="button"
              onClick={() => {
                addOrUpdateBankItem(node.item.id, node.quantity);
                window.dispatchEvent(new CustomEvent("dofus_bank_inventory_updated"));
              }}
              className="px-1.5 py-0.5 rounded bg-slate-950 hover:bg-amber-500/20 text-slate-400 hover:text-amber-300 border border-slate-800 transition-colors text-[10px] font-sans flex items-center gap-1 cursor-pointer"
              title="Guardar esta cantidad en Mi Banco"
            >
              <Vault className="w-3 h-3 text-amber-400" />
              +Banco
            </button>
          </div>
          <span className="text-emerald-400 font-black text-base">
            {totalPriceForQuantity.toLocaleString()} K
          </span>
        </div>

        {/* ByC Legendary Hunt Acquisition Selector */}
        {isByc && bycAnalysis && (
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-amber-400 font-bold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Obtención ByC ({bycAnalysis.hunt.monsterName})
              </span>
              {bycAnalysis.savingsVsDirect > 0 && selectedBycMethod !== "direct" && (
                <span className="text-emerald-400 font-bold font-mono text-[11px] bg-emerald-500/15 px-2 py-0.5 rounded border border-emerald-500/30">
                  Ahorro: -{(bycAnalysis.savingsVsDirect * node.quantity).toLocaleString()} K
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-1.5 text-xs">
              {/* Option 1: Direct Resource */}
              <button
                type="button"
                onClick={() => handleApplyBycMethod("direct")}
                className={`p-2 rounded-xl border text-center transition flex flex-col items-center justify-center cursor-pointer ${
                  selectedBycMethod === "direct"
                    ? "bg-amber-500/20 border-amber-500/60 text-amber-200 font-bold shadow-sm"
                    : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                }`}
              >
                <span className="text-[10px] font-sans">HDV Recurso</span>
                <span className="font-mono text-xs mt-0.5 font-bold">
                  {bycAnalysis.directPrice > 0 ? `${bycAnalysis.directPrice.toLocaleString()} K` : "—"}
                </span>
              </button>

              {/* Option 2: Fragments */}
              <button
                type="button"
                onClick={() => handleApplyBycMethod("fragments")}
                className={`p-2 rounded-xl border text-center transition flex flex-col items-center justify-center cursor-pointer ${
                  selectedBycMethod === "fragments"
                    ? "bg-emerald-500/20 border-emerald-500/60 text-emerald-200 font-bold shadow-sm"
                    : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                } ${bycAnalysis.bestMethod === "fragments" ? "ring-1 ring-emerald-400/40" : ""}`}
              >
                <span className="text-[10px] font-sans flex items-center gap-1">
                  <Layers className="w-2.5 h-2.5 text-indigo-400" />
                  Fragmentos
                </span>
                <span className="font-mono text-xs mt-0.5 font-bold">
                  {bycAnalysis.fragmentsPrice > 0 ? `${bycAnalysis.fragmentsPrice.toLocaleString()} K` : "—"}
                </span>
              </button>

              {/* Option 3: Whole Map */}
              <button
                type="button"
                onClick={() => handleApplyBycMethod("map")}
                className={`p-2 rounded-xl border text-center transition flex flex-col items-center justify-center cursor-pointer ${
                  selectedBycMethod === "map"
                    ? "bg-emerald-500/20 border-emerald-500/60 text-emerald-200 font-bold shadow-sm"
                    : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                } ${bycAnalysis.bestMethod === "map" ? "ring-1 ring-emerald-400/40" : ""}`}
              >
                <span className="text-[10px] font-sans flex items-center gap-1">
                  <MapIcon className="w-2.5 h-2.5 text-amber-400" />
                  Mapa Entero
                </span>
                <span className="font-mono text-xs mt-0.5 font-bold">
                  {bycAnalysis.mapPrice > 0 ? `${bycAnalysis.mapPrice.toLocaleString()} K` : "—"}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Sub-crafting comparison & Toggle Tree */}
        {hasSubCraft && (
          <div className="pt-1.5 space-y-2.5">
            {/* Explicit comparison box */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                {currentPrice > 0 ? (
                  isSubcraftCheaper ? (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-black text-[11px] font-mono flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      Más rentable craftear (-{(directBuyCost - subCraftCost).toLocaleString()} K)
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md bg-sky-500/20 border border-sky-500/40 text-sky-300 font-black text-[11px] font-mono">
                      Más rentable comprar listo {savings > 0 ? `(-${savings.toLocaleString()} K)` : ""}
                    </span>
                  )
                ) : (
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 font-black text-[11px] font-mono">
                    Crafteo estimado: {subCraftCost.toLocaleString()} K
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

            {/* Tree Branch Accordion Button */}
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className={`w-full py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-between transition-all cursor-pointer shadow-sm ${
                isExpanded
                  ? "bg-amber-500/20 border-amber-500/50 text-amber-200 shadow-amber-500/10"
                  : "bg-slate-900 hover:bg-slate-850 border-slate-800 hover:border-amber-500/40 text-slate-300 hover:text-white"
              }`}
            >
              <span className="flex items-center gap-2">
                <GitBranch className={`w-3.5 h-3.5 ${isExpanded ? "text-amber-400" : "text-slate-400"}`} />
                <span>
                  {isExpanded
                    ? `Plegar sub-receta (${node.subIngredients?.length})`
                    : `Desplegar sub-receta (${node.subIngredients?.length})`}
                </span>
              </span>
              <div className="flex items-center gap-1.5">
                {currentPrice > 0 && isSubcraftCheaper && !isExpanded && (
                  <span className="text-[10px] text-emerald-300 font-mono font-bold bg-emerald-500/20 px-1.5 py-0.5 rounded">
                    Ahorras {savings.toLocaleString()} K
                  </span>
                )}
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-amber-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                )}
              </div>
            </button>

            {/* Tree Sub-Ingredients Node Container */}
            {isExpanded && node.subIngredients && (
              <div className="space-y-2 pt-1 animate-fadeIn">
                {/* Visual Branch Header */}
                <div className="bg-amber-950/40 border border-amber-500/30 rounded-xl px-2.5 py-1.5 flex items-center justify-between text-xs text-amber-300 font-bold">
                  <span className="flex items-center gap-1.5 truncate">
                    <CornerDownRight className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="truncate">
                      Ingredientes para fabricar <strong>{itemName}</strong>:
                    </span>
                  </span>
                  <span className="text-[10px] font-mono text-amber-400/80 shrink-0 ml-1">
                    x{node.quantity}
                  </span>
                </div>

                {/* Vertical Tree Connector Guideline */}
                <div className="space-y-2 pl-2.5 border-l-2 border-amber-500/40 ml-1.5">
                  {node.subIngredients.map((sub) => (
                    <SubIngredientRow
                      key={sub.itemId}
                      sub={sub}
                      level={1}
                      parentName={itemName}
                      marketPrices={marketPrices}
                      onPriceChange={onPriceChange}
                      onOpenHistory={onOpenHistory}
                      forceExpandTrigger={forceExpandTrigger}
                      forceExpandValue={forceExpandValue}
                    />
                  ))}
                </div>
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
  level?: number;
  parentName?: string;
  marketPrices: MarketPriceMap;
  onPriceChange: (itemId: number, newPrice: number) => void;
  onOpenHistory?: (item: DofusItem) => void;
  forceExpandTrigger?: number;
  forceExpandValue?: boolean;
}

const SubIngredientRow: React.FC<SubIngredientRowProps> = ({
  sub,
  level = 1,
  parentName,
  marketPrices,
  onPriceChange,
  onOpenHistory,
  forceExpandTrigger = 0,
  forceExpandValue = false,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const currentPrice = marketPrices[sub.itemId] || sub.marketPrice || 0;
  const [draftPrice, setDraftPrice] = useState<string | null>(null);

  // Sync with global expand/collapse buttons
  useEffect(() => {
    if (forceExpandTrigger > 0) {
      setIsExpanded(forceExpandValue);
    }
  }, [forceExpandTrigger, forceExpandValue]);

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

  const subName = getItemName(sub.item);

  // Level theme palette
  const levelThemes = [
    {
      bg: "bg-slate-900/95",
      border: "border-amber-500/40 hover:border-amber-500/60",
      accent: "text-amber-400",
      badgeBg: "bg-amber-500/15 text-amber-300 border-amber-500/30",
      line: "border-l-2 border-amber-500/50",
      pill: "bg-amber-950/40 border-amber-500/30 text-amber-300",
    },
    {
      bg: "bg-slate-950/95",
      border: "border-indigo-500/40 hover:border-indigo-500/60",
      accent: "text-indigo-400",
      badgeBg: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
      line: "border-l-2 border-indigo-500/50",
      pill: "bg-indigo-950/40 border-indigo-500/30 text-indigo-300",
    },
    {
      bg: "bg-slate-950/95",
      border: "border-sky-500/40 hover:border-sky-500/60",
      accent: "text-sky-400",
      badgeBg: "bg-sky-500/15 text-sky-300 border-sky-500/30",
      line: "border-l-2 border-sky-500/50",
      pill: "bg-sky-950/40 border-sky-500/30 text-sky-300",
    },
  ];
  const theme = levelThemes[Math.min(level - 1, levelThemes.length - 1)];

  return (
    <div
      className={`rounded-2xl p-3.5 space-y-2.5 shadow-lg transition-all border ${theme.bg} ${theme.border}`}
    >
      {/* Context Badge: Explains exactly which parent item this belongs to */}
      {parentName && (
        <div className="flex items-center gap-1 text-[10px] text-slate-400 font-semibold bg-slate-950/60 px-2 py-0.5 rounded-md border border-slate-800/80 w-fit max-w-full truncate">
          <CornerDownRight className={`w-3 h-3 ${theme.accent} shrink-0`} />
          <span className="text-slate-500">Ingrediente de:</span>
          <span className="font-bold text-slate-300 truncate">{parentName}</span>
        </div>
      )}

      {/* Header: Branch Icon, Item Thumbnail, Name & Quantity */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-slate-950 border border-slate-800 p-0.5 flex items-center justify-center shrink-0 shadow-inner">
            {getItemIconUrl(sub.item) ? (
              <img
                src={getItemIconUrl(sub.item)}
                alt={subName}
                className="w-6 h-6 object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            ) : (
              <span className={`text-[10px] ${theme.accent} font-mono font-bold`}>
                x{sub.quantity}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <span className="text-xs font-black text-white block truncate leading-tight">
              {subName}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              {hasSubSubCraft ? (
                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border flex items-center gap-1 ${theme.badgeBg}`}>
                  <Wrench className="w-2.5 h-2.5" />
                  Sub-crafteo ({sub.subIngredients?.length})
                </span>
              ) : (
                <span className="text-[10px] text-slate-400 font-semibold">Recurso</span>
              )}
            </div>
          </div>
        </div>
        <span className={`px-2.5 py-0.5 rounded-lg border font-black font-mono text-xs shrink-0 ${theme.badgeBg}`}>
          x{sub.quantity}
        </span>
      </div>

      {/* Price Input Row */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-2 flex items-center justify-between gap-2 text-xs font-mono">
        <div className="flex items-center gap-1">
          <span className="text-slate-400 text-[11px] font-bold">Precio U.:</span>
          {onOpenHistory && (
            <button
              type="button"
              onClick={() => onOpenHistory(sub.item)}
              className="p-1 rounded bg-slate-900 hover:bg-amber-500/20 text-slate-400 hover:text-amber-300 border border-slate-800 transition-colors cursor-pointer"
              title="Ver historial de precios"
            >
              <History className="w-3 h-3" />
            </button>
          )}
        </div>
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

      {/* Subtotal line */}
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

      {/* Nested Sub-Sub Crafting Tree */}
      {hasSubSubCraft && (
        <div className="pt-2 border-t border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-400 font-bold">Crafteo de Sub-receta:</span>
            <span className="text-emerald-400 font-black">
              {subCraftCost.toLocaleString()} K
            </span>
          </div>

          {currentPrice > 0 && (
            <div className="text-[10px] font-mono font-bold">
              {isSubCraftCheaper ? (
                <span className="text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 px-2 py-1 rounded-lg block text-center">
                  ✓ Más rentable craftear (-{subSavings.toLocaleString()} K)
                </span>
              ) : (
                <span className="text-sky-300 bg-sky-500/20 border border-sky-500/30 px-2 py-1 rounded-lg block text-center">
                  Más rentable comprar listo (-{subSavings.toLocaleString()} K)
                </span>
              )}
            </div>
          )}

          {/* Toggle Nested Level */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className={`w-full py-1.5 px-2.5 rounded-xl text-[11px] font-bold flex items-center justify-between transition-all border cursor-pointer ${
              isExpanded
                ? `${theme.badgeBg} shadow-sm`
                : "bg-slate-950 hover:bg-slate-900 border-slate-800 text-slate-300"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <GitBranch className={`w-3.5 h-3.5 ${theme.accent}`} />
              <span>
                {isExpanded
                  ? `Plegar sub-árbol (${sub.subIngredients?.length} ingredientes)`
                  : `Desplegar sub-árbol (${sub.subIngredients?.length} ingredientes)`}
              </span>
            </span>
            {isExpanded ? (
              <ChevronDown className={`w-3.5 h-3.5 ${theme.accent}`} />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            )}
          </button>

          {isExpanded && sub.subIngredients && (
            <div className="space-y-2 pt-1 animate-fadeIn">
              <div className={`border rounded-xl px-2.5 py-1.5 flex items-center justify-between text-[11px] font-bold ${theme.pill}`}>
                <span className="flex items-center gap-1 truncate">
                  <CornerDownRight className={`w-3 h-3 ${theme.accent} shrink-0`} />
                  <span className="truncate">Ingredientes para fabricar <strong>{subName}</strong>:</span>
                </span>
                <span className="font-mono text-xs shrink-0 ml-1">x{sub.quantity}</span>
              </div>

              <div className={`space-y-2.5 pl-2.5 ${theme.line} ml-1.5`}>
                {sub.subIngredients.map((childSub) => (
                  <SubIngredientRow
                    key={childSub.itemId}
                    sub={childSub}
                    level={level + 1}
                    parentName={subName}
                    marketPrices={marketPrices}
                    onPriceChange={onPriceChange}
                    onOpenHistory={onOpenHistory}
                    forceExpandTrigger={forceExpandTrigger}
                    forceExpandValue={forceExpandValue}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
