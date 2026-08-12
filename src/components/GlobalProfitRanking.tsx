import React, { useState, useEffect, useMemo } from "react";
import {
  Trophy,
  TrendingUp,
  Search,
  SlidersHorizontal,
  DollarSign,
  Wrench,
  ArrowUpRight,
  Sparkles,
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
} from "lucide-react";
import { DofusItem, MarketPriceMap, RecipeTreeNode } from "../types";
import { DOFUS_JOBS, getJobForItem, isOmittedItem } from "../data/dofusJobs";
import {
  PRESET_CRAFTABLE_ITEMS,
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
  getItemIconUrl,
  getItemFallbackIconUrl,
} from "../services/dofusDbService";

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

export interface CalculatedRecipeProfit {
  item: PresetCraftableItem;
  craftCost: number;
  salePrice: number;
  netProfit: number;
  roiPercent: number;
  jobName: string;
  jobId: number;
}

interface GlobalProfitRankingProps {
  onSelectRecipeForCalculator: (item: PresetCraftableItem) => void;
}

export const GlobalProfitRanking: React.FC<GlobalProfitRankingProps> = ({
  onSelectRecipeForCalculator,
}) => {
  const ITEMS_PER_PAGE = 25;
  const [currentPage, setCurrentPage] = useState<number>(1);

  const [databaseVersion, setDatabaseVersion] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedJobId, setSelectedJobId] = useState<number | "all">("all");
  const [minProfit, setMinProfit] = useState<number | "">(0);
  const [minRoi, setMinRoi] = useState<number | "">(0);
  const [maxCraftCost, setMaxCraftCost] = useState<number | "">(20000000);
  const [minLevel, setMinLevel] = useState<number | "">(1);
  const [maxLevel, setMaxLevel] = useState<number | "">(200);
  const [sortBy, setSortBy] = useState<
    "profit_desc" | "roi_desc" | "cost_asc" | "price_desc"
  >("profit_desc");

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [
    selectedJobId,
    searchTerm,
    minLevel,
    maxLevel,
    minProfit,
    minRoi,
    maxCraftCost,
    sortBy,
  ]);

  const [marketPrices, setMarketPrices] = useState<MarketPriceMap>({});
  const [priceUpdatedAt, setPriceUpdatedAt] = useState<Record<number, number>>(
    {},
  );

  const [priceDrafts, setPriceDrafts] = useState<Record<number, string>>({});
  const [savedFeedbackItemId, setSavedFeedbackItemId] = useState<number | null>(
    null,
  );

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

  const handlePriceSave = (itemId: number, newPrice: number) => {
    saveMarketPrice(itemId, newPrice)
      .then((updated) => {
        setMarketPrices({ ...DEFAULT_INGREDIENT_PRICES, ...updated });
        setSavedFeedbackItemId(itemId);
        setTimeout(() => setSavedFeedbackItemId(null), 1500);
      })
      .catch((error) => {
        console.error(
          `No se pudo guardar el precio del item ${itemId}:`,
          error,
        );
      });
  };

  const formatUpdatedAtLabel = (itemId: number) => {
    const updatedAt = priceUpdatedAt[itemId];
    return updatedAt
      ? `Actualizado: ${new Date(updatedAt).toLocaleString()}`
      : "";
  };

  const allCraftableItems: PresetCraftableItem[] = useMemo(() => {
    return getCraftableItemsSnapshot() as PresetCraftableItem[];
  }, [databaseVersion]);

  // Compute profit metrics for all items
  const rankedItems: CalculatedRecipeProfit[] = useMemo(() => {
    return allCraftableItems.map((item) => {
      // Calculate craft cost based on direct ingredients in marketPrices
      let craftCost = 0;
      if (item.recipeData && item.recipeData.ingredientIds) {
        item.recipeData.ingredientIds.forEach((ingId, idx) => {
          const qty = item.recipeData.quantities[idx] || 1;
          const ingPrice = marketPrices[ingId] || 0;
          craftCost += ingPrice * qty;
        });
      }

      const salePrice = marketPrices[item.id] || 0;
      const netProfit = salePrice - craftCost;
      const roiPercent = craftCost > 0 ? (netProfit / craftCost) * 100 : 0;

      return {
        item,
        craftCost,
        salePrice,
        netProfit,
        roiPercent,
        jobName: item.jobNameEs,
        jobId: item.jobId,
      };
    });
  }, [allCraftableItems, marketPrices]);

  // Filter and sort ranked items
  const filteredRankings = useMemo(() => {
    const effMinLevel = minLevel === "" ? 1 : Number(minLevel);
    const effMaxLevel = maxLevel === "" ? 200 : Number(maxLevel);
    const effMinProfit = minProfit === "" ? 0 : Number(minProfit);
    const effMinRoi = minRoi === "" ? 0 : Number(minRoi);
    const effMaxCraftCost =
      maxCraftCost === "" ? Infinity : Number(maxCraftCost);

    return rankedItems
      .filter((entry) => {
        if (selectedJobId !== "all" && entry.jobId !== selectedJobId)
          return false;
        if (entry.item.level < effMinLevel || entry.item.level > effMaxLevel)
          return false;
        if (entry.netProfit < effMinProfit) return false;
        if (entry.roiPercent < effMinRoi) return false;
        if (entry.craftCost > effMaxCraftCost) return false;

        if (searchTerm.trim()) {
          const name = getItemName(entry.item).toLowerCase();
          const term = searchTerm.toLowerCase();
          if (
            !name.includes(term) &&
            !entry.item.id.toString().includes(term)
          ) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "profit_desc") return b.netProfit - a.netProfit;
        if (sortBy === "roi_desc") return b.roiPercent - a.roiPercent;
        if (sortBy === "cost_asc") return a.craftCost - b.craftCost;
        if (sortBy === "price_desc") return b.salePrice - a.salePrice;
        return 0;
      });
  }, [
    rankedItems,
    selectedJobId,
    minLevel,
    maxLevel,
    minProfit,
    minRoi,
    maxCraftCost,
    searchTerm,
    sortBy,
  ]);

  // Compute total pages & current paginated rankings slice
  const totalPages = Math.ceil(filteredRankings.length / ITEMS_PER_PAGE) || 1;
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedRankings = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
    return filteredRankings.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredRankings, safeCurrentPage]);

  return (
    <div className="space-y-5">
      {/* Job Selection Visual Cards Bar */}
      <div className="bg-[#0f0f0f] border border-neutral-800 rounded-xl p-3 shadow-lg space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-neutral-300 flex items-center gap-1.5 uppercase tracking-wider">
            <Wrench className="w-4 h-4 text-amber-400" />
            Oficios de Crafteo
          </span>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          <button
            onClick={() => setSelectedJobId("all")}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
              selectedJobId === "all"
                ? "bg-amber-500 text-black font-bold shadow-md shadow-amber-500/20"
                : "bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800 hover:border-neutral-700"
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
                className={`px-2.5 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
                  isSelected
                    ? "bg-amber-500 text-black font-bold shadow-md shadow-amber-500/20"
                    : "bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800 hover:border-neutral-700"
                }`}
              >
                <JobIcon className="w-3.5 h-3.5" />
                <span>{job.nameEs}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-[#0f0f0f] border border-neutral-800 rounded-xl p-4 space-y-4 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-neutral-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Ranking
                <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 font-mono font-semibold border border-emerald-500/30">
                  {filteredRankings.length} Recetas
                </span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
            <span className="text-neutral-500 text-[11px] font-mono mr-1">
              Filtro Rápido:
            </span>
            <button
              onClick={() => {
                setMinProfit(0);
                setMinRoi(0);
              }}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                minProfit === 0 && minRoi === 0
                  ? "bg-amber-500 text-black font-bold"
                  : "bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800"
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => {
                setMinProfit(1);
                setMinRoi(0);
              }}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                minProfit === 1 && minRoi === 0
                  ? "bg-emerald-500 text-black font-bold"
                  : "bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800"
              }`}
            >
              Solo Rentables (&gt;0 K)
            </button>
            <button
              onClick={() => {
                setMinProfit(25000);
                setMinRoi(20);
              }}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                minProfit === 25000
                  ? "bg-emerald-500 text-black font-bold"
                  : "bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800"
              }`}
            >
              &gt;25k K / +20% ROI
            </button>
          </div>
        </div>

        {/* Filter Controls Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          {/* Level Preset Range Filter */}
          <div>
            <label className="block text-neutral-400 font-medium mb-1 flex items-center gap-1">
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
              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white font-medium focus:border-amber-500 focus:outline-none"
            >
              <option value="all">Todos los Niveles (1-200)</option>
              <option value="1-50">Nivel 1 - 50</option>
              <option value="51-100">Nivel 51 - 100</option>
              <option value="101-150">Nivel 101 - 150</option>
              <option value="151-200">Nivel 151 - 200</option>
            </select>
          </div>

          {/* Search Input */}
          <div>
            <label className="block text-neutral-400 font-medium mb-1 flex items-center gap-1">
              <Search className="w-3.5 h-3.5 text-amber-400" />
              Buscar Objeto
            </label>
            <input
              type="text"
              placeholder="ej. Gelano, Anillo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white placeholder-neutral-500 focus:border-amber-500 focus:outline-none"
            />
          </div>

          {/* Sort By Dropdown */}
          <div>
            <label className="block text-neutral-400 font-medium mb-1 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              Ordenar Por
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white font-medium focus:border-amber-500 focus:outline-none"
            >
              <option value="profit_desc">Mayor Ganancia (Kamas)</option>
              <option value="roi_desc">Mayor Rentabilidad (% ROI)</option>
              <option value="cost_asc">Menor Costo de Crafteo</option>
              <option value="price_desc">Mayor Precio de Venta</option>
            </select>
          </div>

          {/* Min Profit Input */}
          <div>
            <label className="block text-neutral-400 font-medium mb-1 flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              Ganancia Mín. (K)
            </label>
            <input
              type="number"
              value={minProfit}
              onChange={(e) => {
                const val = e.target.value;
                setMinProfit(val === "" ? "" : Number(val));
              }}
              step={5000}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white font-mono focus:border-amber-500 focus:outline-none"
            />
          </div>

          {/* Max Craft Cost Budget */}
          <div>
            <label className="block text-neutral-400 font-medium mb-1 flex items-center gap-1">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              Presupuesto Máx. (K)
            </label>
            <input
              type="number"
              value={maxCraftCost}
              onChange={(e) => {
                const val = e.target.value;
                setMaxCraftCost(val === "" ? "" : Number(val));
              }}
              step={50000}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white font-mono focus:border-amber-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Global Profit Rankings Table */}
      <div className="bg-[#0f0f0f] border border-neutral-800 rounded-xl overflow-hidden shadow-lg">
        {filteredRankings.length === 0 ? (
          <div className="p-12 text-center text-neutral-500">
            <Trophy className="w-10 h-10 mx-auto text-neutral-600 mb-2 opacity-40" />
            <p className="text-sm font-semibold text-neutral-400">
              No se encontraron recetas con los filtros aplicados.
            </p>
            <p className="text-xs mt-1">
              Prueba a reducir la ganancia mínima o seleccionar "Todos los
              Oficios".
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#141414] border-b border-neutral-800 text-neutral-400 uppercase font-mono tracking-wider">
                <tr>
                  <th className="py-3 px-3 w-12 text-center">#</th>
                  <th className="py-3 px-3">Objeto & Oficio</th>
                  <th className="py-3 px-3 text-right">Costo Crafteo</th>
                  <th className="py-3 px-3 text-right">Precio Venta</th>
                  <th className="py-3 px-3 text-right">Ganancia Neta</th>
                  <th className="py-3 px-3 text-center">ROI %</th>
                  <th className="py-3 px-3 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60 font-sans">
                {paginatedRankings.map((entry, idx) => {
                  const absoluteIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE + idx;
                  const rank = absoluteIndex + 1;
                  const item = entry.item;
                  const itemName = getItemName(item);
                  const iconUrl = getItemIconUrl(item);
                  const fallbackIcon = getItemFallbackIconUrl(item);
                  const isProfitable = entry.netProfit > 0;

                  const JobIcon =
                    JOB_ICON_MAP[
                      DOFUS_JOBS.find((j) => j.id === item.jobId)?.icon ||
                        "Wrench"
                    ] || Wrench;

                  const isSaved = savedFeedbackItemId === item.id;

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-neutral-800/40 transition-colors group"
                    >
                      {/* Rank Badge */}
                      <td className="py-2.5 px-3 text-center font-mono font-bold">
                        {rank === 1 && (
                          <span className="w-7 h-7 mx-auto rounded-full bg-amber-500 text-black flex items-center justify-center font-black shadow-md shadow-amber-500/20">
                            1
                          </span>
                        )}
                        {rank === 2 && (
                          <span className="w-7 h-7 mx-auto rounded-full bg-slate-300 text-black flex items-center justify-center font-black shadow-md">
                            2
                          </span>
                        )}
                        {rank === 3 && (
                          <span className="w-7 h-7 mx-auto rounded-full bg-amber-700 text-white flex items-center justify-center font-black shadow-md">
                            3
                          </span>
                        )}
                        {rank > 3 && (
                          <span className="text-neutral-500 font-mono">
                            #{rank}
                          </span>
                        )}
                      </td>

                      {/* Item Info */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={iconUrl}
                            alt={itemName}
                            className="w-10 h-10 rounded-xl bg-neutral-900 border border-neutral-800 p-1 object-contain shrink-0 shadow-inner"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = fallbackIcon;
                            }}
                          />
                          <div>
                            <div className="font-extrabold text-white text-sm sm:text-base group-hover:text-amber-400 transition-colors flex items-center gap-2">
                              {itemName}
                              <span className="text-xs font-mono font-bold text-amber-400 px-2 py-0.5 rounded-full bg-neutral-900 border border-neutral-700">
                                Niv. {item.level}
                              </span>
                            </div>
                            <div className="text-xs font-medium text-neutral-400 flex items-center gap-1.5 mt-0.5">
                              <JobIcon className="w-3.5 h-3.5 text-amber-400" />
                              <span>{entry.jobName}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Craft Cost */}
                      <td className="py-3 px-3 text-right font-mono font-bold text-sm text-neutral-200">
                        {entry.craftCost.toLocaleString()} K
                      </td>

                      {/* Editable Sale Price */}
                      <td className="py-3 px-3 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <input
                            type="number"
                            value={
                              priceDrafts[item.id] !== undefined
                                ? priceDrafts[item.id]
                                : entry.salePrice > 0
                                  ? entry.salePrice
                                  : ""
                            }
                            title={formatUpdatedAtLabel(item.id)}
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
                            className="w-28 bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-right font-mono text-sm font-bold text-amber-300 focus:border-amber-400 focus:outline-none transition-colors"
                          />
                          <span className="text-neutral-400 font-bold font-mono text-xs">K</span>
                          {isSaved && (
                            <Check className="w-4 h-4 text-emerald-400" />
                          )}
                        </div>
                      </td>

                      {/* Net Profit */}
                      <td className="py-3 px-3 text-right font-mono font-extrabold text-base">
                        <span
                          className={
                            isProfitable ? "text-emerald-400" : "text-rose-400"
                          }
                        >
                          {isProfitable ? "+" : ""}
                          {entry.netProfit.toLocaleString()} K
                        </span>
                      </td>

                      {/* ROI Badge */}
                      <td className="py-3 px-3 text-center font-mono">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-lg text-xs font-extrabold border ${
                            entry.roiPercent >= 50
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                              : entry.roiPercent > 0
                                ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                : "bg-rose-500/20 text-rose-400 border-rose-500/30"
                          }`}
                        >
                          {entry.roiPercent > 0 ? "+" : ""}
                          {entry.roiPercent.toFixed(0)}%
                        </span>
                      </td>

                      {/* Inspect Action */}
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => onSelectRecipeForCalculator(item)}
                          className="px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-amber-500 hover:text-black border border-neutral-800 text-neutral-300 font-semibold text-xs transition-all flex items-center gap-1 mx-auto"
                          title="Ver desglose completo de ingredientes en la calculadora"
                        >
                          <span>Calcular</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar Footer */}
        {filteredRankings.length > 0 && (
          <div className="bg-[#141414] border-t border-neutral-800 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="text-neutral-400 font-mono">
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
              de <strong className="text-amber-400">{filteredRankings.length}</strong>{" "}
              objetos
            </div>

            <div className="flex items-center gap-1.5">
              <button
                disabled={safeCurrentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-amber-500/50 disabled:opacity-40 disabled:hover:border-neutral-800 text-neutral-300 font-medium flex items-center gap-1 transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Atrás</span>
              </button>

              <div className="flex items-center gap-1 font-mono px-2">
                <span className="text-amber-400 font-bold">
                  {safeCurrentPage}
                </span>
                <span className="text-neutral-500">/</span>
                <span className="text-neutral-400">{totalPages}</span>
              </div>

              <button
                disabled={safeCurrentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-amber-500/50 disabled:opacity-40 disabled:hover:border-neutral-800 text-neutral-300 font-medium flex items-center gap-1 transition-all"
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
