import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Wrench,
  ChevronRight,
  ChevronLeft,
  Layers,
  RefreshCw,
  ArrowLeft,
  FolderOpen,
  FolderClosed,
  Clock,
} from "lucide-react";
import { ItemPriceHistoryModal } from "./ItemPriceHistoryModal";
import {
  analyzeSalesVolume,
  getStoredSalesVolumeMap,
  ItemSalesVolume,
} from "../services/salesVolumeService";
import { DofusItem, PresetCraftableItem, RecipeTreeNode } from "../types";
import { isOmittedItem } from "../data/dofusJobs";
import {
  PRESET_CRAFTABLE_ITEMS,
  DEFAULT_INGREDIENT_PRICES,
} from "../data/presetCraftableItems";
import {
  getCraftableItemsSnapshot,
  buildRecipeTree,
  calculateTreeCraftCost,
  getItemName,
  getItemTypeName,
  getItemIconUrl,
  getItemFallbackIconUrl,
  resolveMissingItemNamesInBatch,
  formatRelativeTime,
} from "../services/dofusDbService";
import { matchesSearchQuery } from "../utils/searchUtils";
import { useMarketPrices } from "../hooks/useMarketPrices";
import { RecipeCatalogFilters } from "./recipes/RecipeCatalogFilters";
import { RecipeSummaryCard } from "./recipes/RecipeSummaryCard";
import { HorizontalIngredientCard } from "./recipes/RecipeTreeNodeRow";

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
  const [isDetailView, setIsDetailView] = useState<boolean>(
    Boolean(initialSelectedItem),
  );

  const [selectedJobId, setSelectedJobId] = useState<number | "all">("all");
  const [minLevel, setMinLevel] = useState<number | "">(1);
  const [maxLevel, setMaxLevel] = useState<number | "">(200);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("profit_desc");
  const [onlyProfitable, setOnlyProfitable] = useState<boolean>(false);
  const [minProfitKamas, setMinProfitKamas] = useState<number | "">(0);

  const { marketPrices: basePrices, priceUpdatedAt, updatePrice } = useMarketPrices();
  const marketPrices = useMemo(
    () => ({ ...DEFAULT_INGREDIENT_PRICES, ...basePrices }),
    [basePrices]
  );

  const [activePresetItem, setActivePresetItem] =
    useState<PresetCraftableItem | null>(PRESET_CRAFTABLE_ITEMS[0]);
  const [recipeTree, setRecipeTree] = useState<RecipeTreeNode | null>(null);
  const [loadingTree, setLoadingTree] = useState<boolean>(false);
  const [itemForHistory, setItemForHistory] = useState<DofusItem | null>(null);

  const [activeSalePrice, setActiveSalePrice] = useState<number | "">("");
  const [salePriceDraft, setSalePriceDraft] = useState<string>("");
  const [treeExpandTrigger, setTreeExpandTrigger] = useState<{ trigger: number; expand: boolean }>({
    trigger: 0,
    expand: false,
  });

  const [salesVolumeMap, setSalesVolumeMap] = useState<Record<number, ItemSalesVolume>>(() => {
    return getStoredSalesVolumeMap();
  });

  useEffect(() => {
    const handleVolumeUpdated = () => {
      setSalesVolumeMap(getStoredSalesVolumeMap());
    };
    window.addEventListener("dofus_sales_volume_updated", handleVolumeUpdated);
    return () => {
      window.removeEventListener("dofus_sales_volume_updated", handleVolumeUpdated);
    };
  }, []);

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
        const itemJob = initialSelectedItem.type?.name?.es || "Receta";
        const tempPreset: PresetCraftableItem = {
          id: initialSelectedItem.id,
          name: getItemName(initialSelectedItem),
          level: initialSelectedItem.level || 1,
          jobId: 0,
          jobNameEs: itemJob,
          recipe: [],
          type: initialSelectedItem.type,
          item: initialSelectedItem,
        };
        setActivePresetItem(tempPreset);
        setIsDetailView(true);
      }
    }
  }, [initialSelectedItem]);

  useEffect(() => {
    if (activePresetItem) {
      const currentStored = marketPrices[activePresetItem.id];
      if (typeof currentStored === "number" && currentStored > 0) {
        setActiveSalePrice(currentStored);
        setSalePriceDraft(String(currentStored));
      } else {
        setActiveSalePrice("");
        setSalePriceDraft("");
      }
    }
  }, [activePresetItem?.id, marketPrices]);

  useEffect(() => {
    let isCancelled = false;
    if (activePresetItem) {
      setLoadingTree(true);
      buildRecipeTree(activePresetItem.id, 1, 0, 5)
        .then((tree) => {
          if (!isCancelled) {
            setRecipeTree(tree);
            setLoadingTree(false);
          }
        })
        .catch((error) => {
          console.error("Error cargando el árbol de receta:", error);
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
  }, [activePresetItem?.id]);

  const allCraftableItems: PresetCraftableItem[] = useMemo(() => {
    const raw = getCraftableItemsSnapshot() as PresetCraftableItem[];
    return raw.filter((item) => !isOmittedItem(item));
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
    itemsPerPage,
  ]);

  const itemMetricsMap = useMemo(() => {
    const map = new Map<
      number,
      { cost: number; salePrice: number; netProfit: number; roi: number }
    >();

    allCraftableItems.forEach((item) => {
      let directCost = 0;
      if (item.recipe && item.recipe.length > 0) {
        item.recipe.forEach((ing) => {
          const p = marketPrices[ing.itemId] || ing.marketPrice || 0;
          directCost += p * ing.quantity;
        });
      }

      const sale = marketPrices[item.id] || 0;
      const tax = sale > 0 ? Math.ceil(sale * 0.03) : 0;
      const net = sale > 0 ? sale - tax - directCost : -directCost;
      const roi = directCost > 0 && sale > 0 ? (net / directCost) * 100 : 0;

      map.set(item.id, {
        cost: directCost,
        salePrice: sale,
        netProfit: net,
        roi,
      });
    });

    return map;
  }, [allCraftableItems, marketPrices]);

  const filteredItems = useMemo(() => {
    return allCraftableItems
      .filter((item) => {
        if (selectedJobId !== "all" && item.jobId !== selectedJobId) {
          return false;
        }

        const minL = minLevel !== "" ? minLevel : 1;
        const maxL = maxLevel !== "" ? maxLevel : 200;
        if (item.level < minL || item.level > maxL) {
          return false;
        }

        if (searchTerm.trim() !== "") {
          const name = getItemName(item);
          const type = getItemTypeName(item);
          if (
            !matchesSearchQuery(name, searchTerm) &&
            !matchesSearchQuery(type, searchTerm)
          ) {
            return false;
          }
        }

        const metrics = itemMetricsMap.get(item.id);
        const hasSalePrice = metrics && metrics.salePrice > 0;

        if (onlyProfitable) {
          if (!hasSalePrice || (metrics && metrics.netProfit <= 0)) {
            return false;
          }
        }

        if (minProfitKamas !== "" && minProfitKamas > 0) {
          if (!metrics || metrics.netProfit < minProfitKamas) {
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
        };
        const metB = itemMetricsMap.get(b.id) || {
          cost: 0,
          salePrice: 0,
          netProfit: 0,
          roi: 0,
        };

        if (sortBy === "profit_desc") {
          return metB.netProfit - metA.netProfit;
        }
        if (sortBy === "roi_desc") {
          return metB.roi - metA.roi;
        }
        if (sortBy === "cost_asc") {
          return metA.cost - metB.cost;
        }
        if (sortBy === "level_asc") {
          return a.level - b.level;
        }
        if (sortBy === "level_desc") {
          return b.level - a.level;
        }
        if (sortBy === "name") {
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
    onlyProfitable,
    minProfitKamas,
    sortBy,
    itemMetricsMap,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredItems.length / itemsPerPage),
  );
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedItems = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * itemsPerPage;
    return filteredItems.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredItems, safeCurrentPage, itemsPerPage]);

  const paginatedIdsString = useMemo(() => {
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

  const directCraftCost = recipeTree
    ? calculateTreeCraftCost(recipeTree, "direct_buy", marketPrices)
    : 0;

  const autoOptimalCost = recipeTree
    ? calculateTreeCraftCost(recipeTree, "auto_optimal", marketPrices)
    : 0;

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
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-lg">
          <button
            type="button"
            onClick={() => setIsDetailView(false)}
            className="w-full sm:w-auto px-3.5 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 hover:border-amber-500/50 text-amber-400 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md group cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>Volver al Catálogo</span>
          </button>
        </div>

        {/* Hero Item Banner Card */}
        <RecipeSummaryCard
          item={activePresetItem}
          salePrice={typeof activeSalePrice === "number" ? activeSalePrice : 0}
          salePriceDraft={salePriceDraft}
          onSalePriceDraftChange={setSalePriceDraft}
          onCommitSalePrice={handleCommitSalePrice}
          priceUpdatedAt={priceUpdatedAt}
          autoOptimalCost={autoOptimalCost}
          directCraftCost={directCraftCost}
          onSelectForCrushing={onSelectForCrushing}
          onOpenHistory={(item) => setItemForHistory(item)}
        />

        {/* Horizontal Ingredients Section */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-5 h-5 text-amber-400" />
                Ingredientes y Precios de Mercadillo
              </h2>
              {recipeTree?.subIngredients &&
                recipeTree.subIngredients.filter((s) => (marketPrices[s.itemId] || 0) <= 0).length > 0 && (
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    {recipeTree.subIngredients.filter((s) => (marketPrices[s.itemId] || 0) <= 0).length} sin precio
                  </span>
                )}
            </div>

            {recipeTree?.subIngredients &&
              recipeTree.subIngredients.some(
                (s) => s.isCraftable && s.subIngredients && s.subIngredients.length > 0
              ) && (
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

        {/* Item Price History Modal */}
        <ItemPriceHistoryModal
          item={itemForHistory}
          isOpen={!!itemForHistory}
          onClose={() => setItemForHistory(null)}
          onPriceChanged={() => {}}
        />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // VIEW MODE B: FULL CATALOG & SEARCH PAGE (MODO CATÁLOGO)
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-4 w-full">
      <RecipeCatalogFilters
        selectedJobId={selectedJobId}
        onSelectJobId={setSelectedJobId}
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        minLevel={minLevel === "" ? 1 : minLevel}
        maxLevel={maxLevel === "" ? 200 : maxLevel}
        onLevelRangeChange={(min, max) => {
          setMinLevel(min);
          setMaxLevel(max);
        }}
        onlyProfitable={onlyProfitable}
        onOnlyProfitableChange={setOnlyProfitable}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        minProfit={minProfitKamas}
        onMinProfitChange={setMinProfitKamas}
        totalItemsCount={filteredItems.length}
      />

      {/* Catalog Grid Cards */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {paginatedItems.map((item) => {
            const metrics = itemMetricsMap.get(item.id) || {
              cost: 0,
              salePrice: 0,
              netProfit: 0,
              roi: 0,
            };
            const iconUrl = getItemIconUrl(item);
            const itemName = getItemName(item);
            const jobBadgeClass = getJobBadgeStyle(item.jobNameEs);

            return (
              <div
                key={item.id}
                onClick={() => handleSelectItemForDetail(item)}
                className="bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-amber-500/50 rounded-2xl p-4 transition-all duration-200 cursor-pointer shadow-md hover:shadow-xl hover:shadow-amber-500/5 space-y-3 group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-950 p-1 border border-slate-800 group-hover:border-amber-500/40 flex items-center justify-center shrink-0 transition-colors">
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
                    {priceUpdatedAt[item.id] ? (
                      <span className="text-[10px] text-slate-500 font-normal flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5 text-slate-500 shrink-0" />
                        {formatRelativeTime(priceUpdatedAt[item.id])}
                      </span>
                    ) : null}
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
                type="button"
                disabled={safeCurrentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500/50 disabled:opacity-40 disabled:hover:border-slate-800 text-slate-300 font-bold flex items-center gap-1 transition-all cursor-pointer"
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
                type="button"
                disabled={safeCurrentPage >= totalPages}
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500/50 disabled:opacity-40 disabled:hover:border-slate-800 text-slate-300 font-bold flex items-center gap-1 transition-all cursor-pointer"
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
        onPriceChanged={() => {}}
      />
    </div>
  );
};
