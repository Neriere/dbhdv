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
} from "lucide-react";
import { MarketPriceMap } from "../types";
import { DOFUS_JOBS, isOmittedItem, isCrushableJob } from "../data/dofusJobs";
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

  const [databaseVersion, setDatabaseVersion] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedJobId, setSelectedJobId] = useState<number | "all">("all");
  const [strategyFilter, setStrategyFilter] = useState<"all" | "hdv" | "crush" | "profitable">("all");
  const [minProfit, setMinProfit] = useState<number | "">(0);
  const [minRoi, setMinRoi] = useState<number | "">(0);
  const [maxCraftCost, setMaxCraftCost] = useState<number | "">(20000000);
  const [minLevel, setMinLevel] = useState<number | "">(1);
  const [maxLevel, setMaxLevel] = useState<number | "">(200);
  const [sortBy, setSortBy] = useState<
    "best_profit_desc" | "sale_profit_desc" | "crush_profit_desc" | "best_roi_desc" | "cost_asc"
  >("best_profit_desc");

  useEffect(() => {
    setCurrentPage(1);
  }, [
    selectedJobId,
    strategyFilter,
    searchTerm,
    minLevel,
    maxLevel,
    minProfit,
    minRoi,
    maxCraftCost,
    sortBy,
  ]);

  const [marketPrices, setMarketPrices] = useState<MarketPriceMap>({});
  const [priceUpdatedAt, setPriceUpdatedAt] = useState<Record<number, number>>({});
  const [priceDrafts, setPriceDrafts] = useState<Record<number, string>>({});
  const [savedFeedbackItemId, setSavedFeedbackItemId] = useState<number | null>(null);
  const [addedCartItemId, setAddedCartItemId] = useState<number | null>(null);

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
        console.error("Error inicializando base:", error);
      });

    const handleDbUpdate = () => {
      hydrateState();
    };
    window.addEventListener("dofus_database_updated", handleDbUpdate);

    return () => {
      window.removeEventListener("dofus_database_updated", handleDbUpdate);
    };
  }, []);

  const handlePriceSave = (itemId: number, newPrice: number) => {
    saveMarketPrice(itemId, newPrice)
      .then((updated) => {
        setMarketPrices({ ...DEFAULT_INGREDIENT_PRICES, ...updated });
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
    return raw.filter((item) => !isOmittedItem(item));
  }, [databaseVersion]);

  const rankedItems: CalculatedRecipeRanking[] = useMemo(() => {
    return allCraftableItems.map((item) => {
      let craftCost = 0;
      if (item.recipeData && item.recipeData.ingredientIds) {
        item.recipeData.ingredientIds.forEach((ingId, idx) => {
          const qty = item.recipeData.quantities[idx] || 1;
          const ingPrice = marketPrices[ingId] || 0;
          craftCost += ingPrice * qty;
        });
      }

      const salePrice = marketPrices[item.id] || 0;
      const saleTax = salePrice > 0 ? Math.ceil(salePrice * 0.03) : 0;
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

      return {
        item,
        craftCost,
        salePrice,
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
      };
    });
  }, [allCraftableItems, marketPrices]);

  const filteredRankings = useMemo(() => {
    const effMinLevel = minLevel === "" ? 1 : Number(minLevel);
    const effMaxLevel = maxLevel === "" ? 200 : Number(maxLevel);
    const effMinProfit = minProfit === "" ? 0 : Number(minProfit);
    const effMinRoi = minRoi === "" ? 0 : Number(minRoi);
    const effMaxCraftCost = maxCraftCost === "" ? Infinity : Number(maxCraftCost);

    return rankedItems
      .filter((entry) => {
        if (selectedJobId !== "all" && entry.jobId !== selectedJobId) return false;
        if (entry.item.level < effMinLevel || entry.item.level > effMaxLevel) return false;
        if (entry.craftCost > effMaxCraftCost) return false;

        if (strategyFilter === "profitable" && entry.bestNetProfit <= 0) return false;
        if (strategyFilter === "hdv" && (entry.saleNetProfit <= 0 || entry.salePrice <= 0)) return false;
        if (strategyFilter === "crush" && (entry.crushNetProfit <= 0 || !entry.canCrush)) return false;

        if (entry.bestNetProfit < effMinProfit) return false;
        if (entry.bestRoiPercent < effMinRoi) return false;

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
        return 0;
      });
  }, [
    rankedItems,
    selectedJobId,
    strategyFilter,
    minLevel,
    maxLevel,
    minProfit,
    minRoi,
    maxCraftCost,
    searchTerm,
    sortBy,
  ]);

  const totalPages = Math.ceil(filteredRankings.length / ITEMS_PER_PAGE) || 1;
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedRankings = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
    return filteredRankings.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredRankings, safeCurrentPage]);

  return (
    <div className="space-y-4">
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

        {/* Filter Controls Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
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
              <option value="cost_asc">Menor Costo</option>
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
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-100 font-mono font-bold focus:border-amber-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Global Profit Rankings Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        {filteredRankings.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Trophy className="w-10 h-10 mx-auto text-slate-600 mb-2 opacity-40" />
            <p className="text-sm font-bold text-slate-400">
              No se encontraron recetas.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase font-mono tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-3 w-10 text-center">#</th>
                  <th className="py-3 px-3">Objeto</th>
                  <th className="py-3 px-3 text-right">Costo</th>
                  <th className="py-3 px-3 text-right">Venta HDV</th>
                  <th className="py-3 px-3 text-right">Runas</th>
                  <th className="py-3 px-3 text-center">Ganancia</th>
                  <th className="py-3 px-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
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
                      <td className="py-2.5 px-3 text-center font-mono font-bold">
                        {rank === 1 && (
                          <span className="w-6 h-6 mx-auto rounded-full bg-amber-500 text-slate-950 flex items-center justify-center font-black text-xs">
                            1
                          </span>
                        )}
                        {rank === 2 && (
                          <span className="w-6 h-6 mx-auto rounded-full bg-slate-300 text-slate-950 flex items-center justify-center font-black text-xs">
                            2
                          </span>
                        )}
                        {rank === 3 && (
                          <span className="w-6 h-6 mx-auto rounded-full bg-amber-700 text-white flex items-center justify-center font-black text-xs">
                            3
                          </span>
                        )}
                        {rank > 3 && (
                          <span className="text-slate-500 font-mono text-xs">
                            #{rank}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={iconUrl}
                            alt={itemName}
                            className="w-9 h-9 rounded-xl bg-slate-950 border border-slate-800 p-1 object-contain shrink-0"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = fallbackIcon;
                            }}
                          />
                          <div className="min-w-0">
                            <div className="font-extrabold text-white text-xs sm:text-sm group-hover:text-amber-400 transition-colors flex items-center gap-1.5 truncate">
                              <span className="truncate">{itemName}</span>
                              <span className="text-[10px] font-mono font-bold text-amber-300 px-1.5 py-0.2 rounded-full bg-amber-500/10 border border-amber-500/20 shrink-0">
                                Niv. {item.level}
                              </span>
                            </div>
                            <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1 mt-0.5">
                              <JobIcon className="w-3 h-3 text-amber-400" />
                              <span>{entry.jobName}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-bold text-xs text-slate-200">
                        {entry.craftCost.toLocaleString()} K
                      </td>

                      <td className="py-3 px-3 text-right font-mono">
                        <div className="inline-flex items-center justify-end gap-1">
                          <input
                            type="number"
                            value={
                              priceDrafts[item.id] !== undefined
                                ? priceDrafts[item.id]
                                : entry.salePrice > 0
                                  ? entry.salePrice
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
                            className="w-20 bg-slate-950 border border-slate-700 rounded-lg px-2 py-0.5 text-right font-mono text-xs font-bold text-amber-300 focus:border-amber-400 focus:outline-none transition-colors"
                          />
                          {isSaved && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                        </div>
                        <div className="text-[11px] mt-0.5">
                          {entry.salePrice > 0 ? (
                            <span className={entry.saleNetProfit >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                              {entry.saleNetProfit >= 0 ? "+" : ""}{entry.saleNetProfit.toLocaleString()} K
                            </span>
                          ) : (
                            <span className="text-slate-600">---</span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3 text-right font-mono">
                        {entry.canCrush ? (
                          <>
                            <span className="text-slate-300 font-bold block">
                              {entry.runicEstimatedValue.toLocaleString()} K
                            </span>
                            <span className={entry.crushNetProfit >= 0 ? "text-purple-400 font-bold text-[11px]" : "text-rose-400 font-bold text-[11px]"}>
                              {entry.crushNetProfit >= 0 ? "+" : ""}{entry.crushNetProfit.toLocaleString()} K
                            </span>
                          </>
                        ) : (
                          <span className="text-slate-600 text-[11px]">---</span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-center font-mono">
                        <div className={`font-black text-xs ${entry.bestNetProfit > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {entry.bestNetProfit > 0 ? "+" : ""}{entry.bestNetProfit.toLocaleString()} K
                        </div>
                        {entry.bestStrategy !== "none" && (
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border mt-0.5 ${
                            entry.bestStrategy === "hdv"
                              ? "bg-sky-500/20 text-sky-300 border-sky-500/40"
                              : "bg-purple-500/20 text-purple-300 border-purple-500/40"
                          }`}>
                            {entry.bestStrategy === "hdv" ? "HDV" : "Runas"} ({entry.bestRoiPercent > 0 ? "+" : ""}{entry.bestRoiPercent.toFixed(0)}%)
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => onSelectRecipeForCalculator(item)}
                            className="px-2 py-1 rounded-lg bg-slate-950 hover:bg-amber-500 hover:text-slate-950 border border-slate-800 text-slate-300 font-bold text-[11px] transition-all flex items-center gap-1"
                          >
                            <span>Crafteo</span>
                            <ArrowUpRight className="w-3 h-3" />
                          </button>

                          {entry.canCrush && onSelectForCrushing && (
                            <button
                              onClick={() => onSelectForCrushing(item)}
                              className="px-2 py-1 rounded-lg bg-slate-950 hover:bg-purple-500/20 border border-slate-800 hover:border-purple-500/40 text-purple-300 font-bold text-[11px] transition-all flex items-center gap-1"
                            >
                              <Zap className="w-3 h-3 text-purple-400" />
                              <span>Romper</span>
                            </button>
                          )}

                          <button
                            onClick={() => handleAddToCart(item)}
                            className="p-1 rounded-lg bg-slate-950 hover:bg-emerald-500/20 border border-slate-800 hover:border-emerald-500/40 text-emerald-300 transition-all"
                          >
                            {isAddedCart ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <ShoppingCart className="w-3.5 h-3.5" />}
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
