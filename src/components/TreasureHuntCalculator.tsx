import React, { useState, useEffect, useMemo } from "react";
import {
  Map as MapIcon,
  Search,
  SlidersHorizontal,
  Coins,
  TrendingUp,
  Award,
  ChevronDown,
  ChevronUp,
  Layers,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  ShoppingCart,
  Vault,
  Edit2,
  Filter,
  Flame,
  MapPin,
  RefreshCw,
  HelpCircle,
  DollarSign,
  Plus,
  ExternalLink,
} from "lucide-react";
import { LEGENDARY_HUNTS, LegendaryHuntInfo } from "../data/legendaryHuntsData";
import {
  getStoredMarketPrices,
  saveMarketPrice,
  addToShoppingListById,
  getStoredBankInventory,
  getItemIconUrl,
} from "../services/dofusDbService";
import { BycDetailPage } from "./BycDetailPage";

interface TreasureHuntCalculatorProps {
  onNavigateToShopping?: () => void;
  onNavigateToBank?: () => void;
}

const SEBUSCALIN_STORAGE_KEY = "dofus_sebuscalin_unit_price_v1";

export const TreasureHuntCalculator: React.FC<TreasureHuntCalculatorProps> = ({
  onNavigateToShopping,
  onNavigateToBank,
}) => {
  // Global market prices
  const [marketPrices, setMarketPrices] = useState<Record<number, number>>({});
  const [bankInventory, setBankInventory] = useState(getStoredBankInventory());

  // Unit rate for Sebuscalines
  const [sebuscalinPrice, setSebuscalinPrice] = useState<number>(() => {
    if (typeof window === "undefined") return 25;
    const val = localStorage.getItem(SEBUSCALIN_STORAGE_KEY);
    return val ? Math.max(1, Number(val)) : 25;
  });

  // UI States
  const [searchQuery, setSearchQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [zoneFilter, setZoneFilter] = useState<string>("all");
  const [onlyProfitable, setOnlyProfitable] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<
    "profit_desc" | "roi_desc" | "hunt_vs_buy" | "sebuscalines_desc" | "cost_asc" | "level_desc"
  >("profit_desc");

  // Selected Hunt Modal for deep fragment management
  const [selectedHuntForDetail, setSelectedHuntForDetail] = useState<LegendaryHuntInfo | null>(null);

  // Direct Inline Price Drafts
  const [priceDrafts, setPriceDrafts] = useState<Record<number, string>>({});

  const handlePriceDraftChange = (itemId: number, rawVal: string) => {
    setPriceDrafts((prev) => ({ ...prev, [itemId]: rawVal }));
  };

  const handlePriceCommit = (itemId: number, rawVal: string) => {
    const parsed = Math.max(0, parseInt(rawVal.replace(/\D/g, ""), 10) || 0);
    saveMarketPrice(itemId, parsed);
    setMarketPrices((prev) => ({ ...prev, [itemId]: parsed }));
    setPriceDrafts((prev) => {
      const copy = { ...prev };
      delete copy[itemId];
      return copy;
    });
  };

  // Rate config modal
  const [isRatesModalOpen, setIsRatesModalOpen] = useState(false);
  const [tempSebuscalin, setTempSebuscalin] = useState(String(sebuscalinPrice));

  // Success toast message
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    const hydrate = () => {
      setMarketPrices(getStoredMarketPrices());
      setBankInventory(getStoredBankInventory());
    };
    hydrate();

    window.addEventListener("dofus_database_updated", hydrate);
    window.addEventListener("dofus_bank_inventory_updated", hydrate);
    return () => {
      window.removeEventListener("dofus_database_updated", hydrate);
      window.removeEventListener("dofus_bank_inventory_updated", hydrate);
    };
  }, []);

  const handleSaveRates = () => {
    const s = Math.max(1, Number(tempSebuscalin) || 25);
    setSebuscalinPrice(s);

    if (typeof window !== "undefined") {
      localStorage.setItem(SEBUSCALIN_STORAGE_KEY, String(s));
    }
    setIsRatesModalOpen(false);
    showToast("¡Precio de Sebuscalines actualizado!");
  };

  // Helper to get effective price for an item
  const getPrice = (itemId: number, defaultFallback: number) => {
    if (typeof marketPrices[itemId] === "number" && marketPrices[itemId] > 0) {
      return marketPrices[itemId];
    }
    return defaultFallback;
  };

  // Bank quantity lookup helper
  const getBankQty = (itemId: number): number => {
    const entry = bankInventory.find((b) => b.itemId === itemId);
    return entry ? entry.quantity : 0;
  };

  // Calculations for all hunts
  const calculatedHunts = useMemo(() => {
    return LEGENDARY_HUNTS.map((hunt) => {
      const wholeMapPrice = getPrice(hunt.mapItem.id, hunt.mapItem.defaultPrice);
      
      // Calculate fragments total cost
      let fragmentsTotal = 0;
      let userHasAllFragmentsInBank = true;
      let bankFragmentsCount = 0;

      for (const fId of hunt.fragments.fragmentIds) {
        const fPrice = getPrice(fId, hunt.fragments.defaultUnitPrice);
        fragmentsTotal += fPrice;
        const inBank = getBankQty(fId);
        if (inBank > 0) {
          bankFragmentsCount++;
        } else {
          userHasAllFragmentsInBank = false;
        }
      }

      // Best entry cost: is it cheaper to buy the full map or buy fragments?
      const isFragmentsCheaper = fragmentsTotal < wholeMapPrice;
      const bestEntryCost = Math.min(wholeMapPrice, fragmentsTotal);
      const entryMethodSavings = Math.abs(wholeMapPrice - fragmentsTotal);

      // Reward values
      const resourcePrice = getPrice(hunt.resource.id, hunt.resource.defaultPrice);
      const sebuscalinesValue = hunt.sebuscalines * sebuscalinPrice;

      const totalRewardValue = resourcePrice + sebuscalinesValue;
      const netProfit = totalRewardValue - bestEntryCost;
      const roiPercent = bestEntryCost > 0 ? (netProfit / bestEntryCost) * 100 : 0;

      // Comparison: Hunt vs Buy Resource directly in HDV
      // (Resource Price + Bonus currencies) - Hunt Cost
      // If positive, hunt saves you kamas and grants bonus doplons
      const huntVsBuyBenefit = resourcePrice - bestEntryCost;

      return {
        ...hunt,
        wholeMapPrice,
        fragmentsTotal,
        isFragmentsCheaper,
        bestEntryCost,
        entryMethodSavings,
        resourcePrice,
        sebuscalinesValue,
        totalRewardValue,
        netProfit,
        roiPercent,
        huntVsBuyBenefit,
        bankFragmentsCount,
        hasMapInBank: getBankQty(hunt.mapItem.id) > 0,
      };
    });
  }, [marketPrices, bankInventory, sebuscalinPrice]);

  // Filtered and sorted hunts
  const filteredHunts = useMemo(() => {
    return calculatedHunts
      .filter((h) => {
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchName = h.monsterName.toLowerCase().includes(q);
          const matchResource = h.resource.name.toLowerCase().includes(q);
          const matchZone = h.zone.toLowerCase().includes(q) || (h.subArea && h.subArea.toLowerCase().includes(q));
          if (!matchName && !matchResource && !matchZone) return false;
        }

        // Level filter
        if (levelFilter === "200" && h.monsterLevel !== 200) return false;
        if (levelFilter === "150-190" && (h.monsterLevel < 150 || h.monsterLevel > 190)) return false;
        if (levelFilter === "100-140" && (h.monsterLevel < 100 || h.monsterLevel > 140)) return false;
        if (levelFilter === "20-90" && (h.monsterLevel < 20 || h.monsterLevel > 90)) return false;

        // Zone filter (Exact BYC Zones)
        if (zoneFilter === "astrub" && !h.zone.toLowerCase().includes("astrub")) return false;
        if (zoneFilter === "castillo_amakna" && !h.zone.toLowerCase().includes("castillo") && !h.zone.toLowerCase().includes("amakna")) return false;
        if (zoneFilter === "frigost_1" && h.zone !== "Frigost I") return false;
        if (zoneFilter === "frigost_2" && h.zone !== "Frigost II") return false;
        if (zoneFilter === "frigost_3" && h.zone !== "Frigost III") return false;
        if (zoneFilter === "dimensiones" && !["anutropía", "sramvil", "zurcalia", "dimensiones"].some(d => h.zone.toLowerCase().includes(d))) return false;
        if (zoneFilter === "justicieros" && !h.zone.toLowerCase().includes("justiciero")) return false;

        // Profitable only
        if (onlyProfitable && h.netProfit <= 0) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "profit_desc") return b.netProfit - a.netProfit;
        if (sortBy === "roi_desc") return b.roiPercent - a.roiPercent;
        if (sortBy === "hunt_vs_buy") return b.huntVsBuyBenefit - a.huntVsBuyBenefit;
        if (sortBy === "sebuscalines_desc") return b.sebuscalines - a.sebuscalines;
        if (sortBy === "cost_asc") return a.bestEntryCost - b.bestEntryCost;
        if (sortBy === "level_desc") return b.monsterLevel - a.monsterLevel;
        return 0;
      });
  }, [calculatedHunts, searchQuery, levelFilter, zoneFilter, onlyProfitable, sortBy]);

  // High-level metrics
  const totalHuntsCount = calculatedHunts.length;
  const profitableHuntsCount = calculatedHunts.filter((h) => h.netProfit > 0).length;
  const highestProfitHunt = useMemo(() => {
    return [...calculatedHunts].sort((a, b) => b.netProfit - a.netProfit)[0];
  }, [calculatedHunts]);

  const handleAddFragmentsToShopping = (hunt: LegendaryHuntInfo) => {
    let count = 0;
    for (const fId of hunt.fragments.fragmentIds) {
      addToShoppingListById(fId, 1, hunt.mapItem.id);
      count++;
    }
    showToast(`Se han añadido los ${count} fragmentos de ${hunt.monsterName} a la Lista de Compras`);
  };

  const handleAddWholeMapToShopping = (hunt: LegendaryHuntInfo) => {
    addToShoppingListById(hunt.mapItem.id, 1);
    showToast(`Se ha añadido el ${hunt.mapItem.name} a la Lista de Compras`);
  };

  if (selectedHuntForDetail) {
    return (
      <div className="w-full max-w-[1760px] mx-auto px-3 sm:px-5 lg:px-8 py-6 space-y-6">
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-emerald-400/30 animate-bounce">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-medium text-sm">{toastMessage}</span>
          </div>
        )}
        <BycDetailPage
          hunt={selectedHuntForDetail}
          onBack={() => setSelectedHuntForDetail(null)}
          onSelectHunt={(h) => setSelectedHuntForDetail(h)}
          marketPrices={marketPrices}
          bankInventory={bankInventory}
          sebuscalinPrice={sebuscalinPrice}
          onUpdateSebuscalinPrice={(p) => {
            setSebuscalinPrice(p);
            if (typeof window !== "undefined") {
              localStorage.setItem(SEBUSCALIN_STORAGE_KEY, String(p));
            }
          }}
          onPriceChange={(itemId, newPrice) => {
            setMarketPrices((prev) => ({ ...prev, [itemId]: newPrice }));
          }}
          onNavigateToShopping={onNavigateToShopping}
          onNavigateToBank={onNavigateToBank}
          showToast={showToast}
        />
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1760px] mx-auto px-3 sm:px-5 lg:px-8 py-6 space-y-6">
      {/* Toast notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-emerald-400/30 animate-bounce">
          <CheckCircle2 className="w-5 h-5" />
          <span className="font-medium text-sm">{toastMessage}</span>
        </div>
      )}

      {/* Header & Hero Section - Compact & Elegant */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-amber-950/20 to-slate-900 border border-amber-500/20 p-4 sm:p-5 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shadow-inner shrink-0">
                <MapIcon className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-slate-100 tracking-tight flex items-center gap-2">
                  Búsquedas del Tesoro & Busca y Captura (ByC)
                </h1>
                <p className="text-slate-400 text-xs">
                  Calculador de rentabilidad de Mapas Legendarios: compara el coste de fragmentos vs mapa entero, el valor del recurso del jefe y el retorno en Sebuscalines.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Rates Button & Status */}
          <div className="flex items-center gap-2 bg-slate-950/90 p-2 rounded-xl border border-slate-800 shrink-0 self-start md:self-auto">
            <div className="flex items-center gap-2 text-xs font-mono px-2">
              <span className="text-slate-400">Valor Sebuscalín:</span>
              <span className="text-amber-400 font-bold">{sebuscalinPrice} K</span>
            </div>

            <button
              type="button"
              onClick={() => {
                setTempSebuscalin(String(sebuscalinPrice));
                setIsRatesModalOpen(true);
              }}
              className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Coins className="w-3.5 h-3.5" />
              Editar Cotización
            </button>
          </div>
        </div>

        {/* Global Summary Stats - Compact */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-3.5 border-t border-slate-800/80">
          <div className="px-3 py-2 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-[11px] text-slate-400 block font-medium">Total Cacerías</span>
            <span className="text-base font-bold text-slate-200">{totalHuntsCount}</span>
          </div>

          <div className="px-3 py-2 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-[11px] text-slate-400 block font-medium">Cacerías Rentables</span>
            <span className="text-base font-bold text-emerald-400">
              {profitableHuntsCount}{" "}
              <span className="text-[11px] text-slate-400 font-normal">
                ({Math.round((profitableHuntsCount / totalHuntsCount) * 100)}%)
              </span>
            </span>
          </div>

          <div className="px-3 py-2 rounded-xl bg-slate-950/60 border border-slate-800/80 col-span-2">
            <span className="text-[11px] text-slate-400 block font-medium">Cacería Top Más Rentable</span>
            {highestProfitHunt ? (
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-amber-300 truncate">
                  {highestProfitHunt.monsterName} (Nv {highestProfitHunt.monsterLevel})
                </span>
                <span className="text-xs font-bold text-emerald-400 font-mono shrink-0">
                  +{highestProfitHunt.netProfit.toLocaleString()} K ({Math.round(highestProfitHunt.roiPercent)}% ROI)
                </span>
              </div>
            ) : (
              <span className="text-xs text-slate-500">-</span>
            )}
          </div>
        </div>
      </div>

      {/* Control Bar: Filters, Search & Sorting */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-4 shadow-lg">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por monstruo, zona, recurso o mapa..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>

          {/* Level Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 overflow-x-auto w-full md:w-auto">
            {[
              { id: "all", label: "Todos" },
              { id: "200", label: "Nv 200" },
              { id: "150-190", label: "Nv 150-190" },
              { id: "100-140", label: "Nv 100-140" },
              { id: "20-90", label: "Nv 20-90" },
            ].map((lvl) => (
              <button
                key={lvl.id}
                type="button"
                onClick={() => setLevelFilter(lvl.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  levelFilter === lvl.id
                    ? "bg-amber-500 text-slate-950 shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {lvl.label}
              </button>
            ))}
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <span className="text-xs text-slate-400 whitespace-nowrap">Ordenar por:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs font-medium focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="profit_desc">Mayor Ganancia Neta (Kamas)</option>
              <option value="roi_desc">Mayor Retorno (ROI %)</option>
              <option value="hunt_vs_buy">Mayor Ahorro vs Comprar Recurso HDV</option>
              <option value="sebuscalines_desc">Mayor Cantidad de Sebuscalines</option>
              <option value="cost_asc">Coste Más Barato de Búsqueda</option>
              <option value="level_desc">Nivel de ByC (Mayor a menor)</option>
            </select>
          </div>
        </div>

        {/* Second Filter Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/60 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Zona:</span>
            <div className="flex items-center gap-1 overflow-x-auto">
              {[
                { id: "all", label: "Todas las zonas" },
                { id: "astrub", label: "Astrub" },
                { id: "castillo_amakna", label: "Castillo de Amakna" },
                { id: "frigost_1", label: "Frigost I" },
                { id: "frigost_2", label: "Frigost II" },
                { id: "frigost_3", label: "Frigost III" },
                { id: "dimensiones", label: "Dimensiones Divinas" },
                { id: "justicieros", label: "Base Justicieros" },
              ].map((z) => (
                <button
                  key={z.id}
                  type="button"
                  onClick={() => setZoneFilter(z.id)}
                  className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap ${
                    zoneFilter === z.id
                      ? "bg-slate-800 text-amber-300 font-semibold border border-amber-500/40"
                      : "text-slate-400 hover:text-slate-200 bg-slate-950/60"
                  }`}
                >
                  {z.label}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer text-slate-300 select-none">
            <input
              type="checkbox"
              checked={onlyProfitable}
              onChange={(e) => setOnlyProfitable(e.target.checked)}
              className="rounded bg-slate-950 border-slate-700 text-amber-500 focus:ring-amber-500 w-4 h-4 cursor-pointer"
            />
            <span className="text-xs font-medium">Mostrar solo con ganancia positiva</span>
          </label>
        </div>
      </div>

      {/* Hunts Grid List */}
      {filteredHunts.length === 0 ? (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-12 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-amber-400 mx-auto opacity-70" />
          <h3 className="text-lg font-bold text-slate-200">No se encontraron búsquedas con los filtros actuales</h3>
          <p className="text-sm text-slate-400">Prueba a limpiar la búsqueda o cambiar los filtros de nivel y rentabilidad.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {filteredHunts.map((hunt) => {
            const isProfitable = hunt.netProfit > 0;

            return (
              <div
                key={hunt.id}
                className={`rounded-2xl bg-slate-900/90 border transition-all duration-200 hover:border-slate-700 p-5 space-y-4 shadow-md ${
                  isProfitable ? "border-slate-800 hover:border-emerald-500/40" : "border-slate-800/80 opacity-90"
                }`}
              >
                {/* Top Row: Monster Header, Level, Zone */}
                <div className="flex items-start justify-between gap-3">
                  <div 
                    className="flex items-start gap-3 cursor-pointer group/header"
                    onClick={() => setSelectedHuntForDetail(hunt)}
                  >
                    <div className="w-14 h-14 rounded-2xl bg-slate-950 border border-slate-800 p-1.5 flex items-center justify-center shrink-0 shadow-inner relative group-hover/header:border-amber-500/50 transition-colors">
                      <img
                        src={getItemIconUrl({ iconId: hunt.resource.iconId || hunt.id, id: hunt.id })}
                        alt={hunt.monsterName}
                        className="w-10 h-10 object-contain group-hover/header:scale-105 transition-transform"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                      <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 text-[10px] font-black leading-none shadow">
                        {hunt.monsterLevel}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg font-black text-slate-100 group-hover/header:text-amber-300 transition-colors">{hunt.monsterName}</h3>
                        <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[11px] font-medium">
                          {hunt.levelRequirement}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <MapPin className="w-3.5 h-3.5 text-amber-500/70" />
                        <span>{hunt.zone}</span>
                        {hunt.subArea && <span className="text-slate-500">({hunt.subArea})</span>}
                      </div>
                    </div>
                  </div>

                  {/* Profit & ROI Tag */}
                  <div className="text-right shrink-0">
                    <span className="text-[11px] text-slate-500 block font-medium">Ganancia Neta</span>
                    <span
                      className={`text-lg font-black font-mono ${
                        isProfitable ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {hunt.netProfit >= 0 ? `+${hunt.netProfit.toLocaleString()}` : hunt.netProfit.toLocaleString()} K
                    </span>
                    <span
                      className={`text-xs block font-bold font-mono ${
                        isProfitable ? "text-emerald-500" : "text-rose-500"
                      }`}
                    >
                      {Math.round(hunt.roiPercent)}% ROI
                    </span>
                  </div>
                </div>

                {/* Middle Two-Column Breakdown: Cost vs Rewards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {/* Left: Entrada / Coste de la Búsqueda */}
                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-300 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-amber-400" />
                        Coste de Entrada
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Mejor opción:{" "}
                        <strong className="text-amber-300">
                          {hunt.isFragmentsCheaper ? "Fragmentos" : "Mapa Entero"}
                        </strong>
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      {/* Option 1: Whole Map */}
                      <div
                        className={`p-2 rounded-lg border transition-colors flex items-center justify-between gap-2 ${
                          !hunt.isFragmentsCheaper
                            ? "bg-amber-500/10 border-amber-500/40 text-slate-200"
                            : "bg-slate-900/60 border-slate-800 text-slate-400"
                        }`}
                      >
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="font-medium truncate">Mapa Entero:</span>
                        </div>
                        <div className="flex items-center gap-1 bg-slate-950/90 border border-slate-700/80 rounded-lg px-2 py-0.5 focus-within:border-amber-400 shrink-0">
                          <input
                            type="number"
                            min="0"
                            value={priceDrafts[hunt.mapItem.id] !== undefined ? priceDrafts[hunt.mapItem.id] : (hunt.wholeMapPrice > 0 ? hunt.wholeMapPrice : "")}
                            onChange={(e) => handlePriceDraftChange(hunt.mapItem.id, e.target.value)}
                            onBlur={(e) => handlePriceCommit(hunt.mapItem.id, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handlePriceCommit(hunt.mapItem.id, (e.target as HTMLInputElement).value);
                            }}
                            placeholder="0"
                            className="w-20 bg-transparent text-right font-mono font-bold text-amber-300 text-xs focus:outline-none"
                          />
                          <span className="text-[10px] text-slate-400 font-mono">K</span>
                        </div>
                      </div>

                      {/* Option 2: Fragments Total */}
                      <div
                        className={`p-2 rounded-lg border transition-colors flex items-center justify-between ${
                          hunt.isFragmentsCheaper
                            ? "bg-amber-500/10 border-amber-500/40 text-slate-200"
                            : "bg-slate-900/60 border-slate-800 text-slate-400"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{hunt.fragments.count}x Fragmentos:</span>
                          <button
                            type="button"
                            onClick={() => setSelectedHuntForDetail(hunt)}
                            className="text-slate-500 hover:text-amber-400 transition-colors text-[10px] underline"
                            title="Ver desglose de fragmentos"
                          >
                            Ver piezas
                          </button>
                        </div>
                        <span className="font-mono font-bold">{hunt.fragmentsTotal.toLocaleString()} K</span>
                      </div>

                      {/* Savings difference */}
                      <div className="text-[11px] text-slate-400 flex items-center justify-between px-1">
                        <span>Ahorro entre opciones:</span>
                        <span className="text-emerald-400 font-mono font-semibold">
                          +{hunt.entryMethodSavings.toLocaleString()} K
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Recompensas al Completar */}
                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-300 flex items-center gap-1.5">
                        <Award className="w-3.5 h-3.5 text-emerald-400" />
                        Recompensas del Cofre
                      </span>
                      <span className="text-emerald-400 font-mono font-bold">
                        {hunt.totalRewardValue.toLocaleString()} K
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      {/* ByC Resource */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 truncate min-w-0 pr-1">
                          <span className="text-slate-300 font-medium truncate">{hunt.resource.name}:</span>
                        </div>
                        <div className="flex items-center gap-1 bg-slate-950/90 border border-slate-700/80 rounded-lg px-2 py-0.5 focus-within:border-amber-400 shrink-0">
                          <input
                            type="number"
                            min="0"
                            value={priceDrafts[hunt.resource.id] !== undefined ? priceDrafts[hunt.resource.id] : (hunt.resourcePrice > 0 ? hunt.resourcePrice : "")}
                            onChange={(e) => handlePriceDraftChange(hunt.resource.id, e.target.value)}
                            onBlur={(e) => handlePriceCommit(hunt.resource.id, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handlePriceCommit(hunt.resource.id, (e.target as HTMLInputElement).value);
                            }}
                            placeholder="0"
                            className="w-20 bg-transparent text-right font-mono font-bold text-slate-200 text-xs focus:outline-none"
                          />
                          <span className="text-[10px] text-slate-400 font-mono">K</span>
                        </div>
                      </div>

                      {/* Sebuscalines */}
                      <div className="flex items-center justify-between text-slate-400">
                        <span className="text-[11px]">
                          +{hunt.sebuscalines} Sebuscalines del cofre:
                        </span>
                        <span className="font-mono text-amber-400 font-semibold">
                          +{hunt.sebuscalinesValue.toLocaleString()} K
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Direct Comparison: Hunt vs Buy Resource in HDV */}
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <Flame className={`w-3.5 h-3.5 shrink-0 ${hunt.huntVsBuyBenefit >= 0 ? "text-amber-400" : "text-slate-500"}`} />
                    <span className="text-slate-300">
                      {hunt.huntVsBuyBenefit >= 0 ? (
                        <span>
                          Ahorras <strong className="text-emerald-400 font-bold">{hunt.huntVsBuyBenefit.toLocaleString()} K</strong> haciendo la cacería vs comprar en HDV <span className="text-amber-300/90 font-medium">(+{hunt.sebuscalines} sebuscalines)</span>.
                        </span>
                      ) : (
                        <span>
                          Comprar en HDV es <strong className="text-amber-400 font-bold">{Math.abs(hunt.huntVsBuyBenefit).toLocaleString()} K</strong> más barato que montar el mapa.
                        </span>
                      )}
                    </span>
                  </div>

                  {/* Bank inventory badge */}
                  {hunt.bankFragmentsCount > 0 && (
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-semibold flex items-center gap-1 shrink-0">
                      <Vault className="w-3 h-3" />
                      {hunt.bankFragmentsCount}/{hunt.fragments.count} piezas en Banco
                    </span>
                  )}
                </div>

                {/* Bottom Action Buttons */}
                <div className="flex items-center justify-end pt-2 border-t border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => setSelectedHuntForDetail(hunt)}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500/20 to-amber-600/10 hover:from-amber-500/30 hover:to-amber-600/20 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm group"
                  >
                    <Layers className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                    <span>Ver Análisis & Crafteos</span>
                    <ArrowRight className="w-3.5 h-3.5 text-amber-400 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Edit Global Currency Rates */}
      {isRatesModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-400" />
                Cotización de Sebuscalines
              </h3>
              <button
                type="button"
                onClick={() => setIsRatesModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Define cuánto vale cada Sebuscalín en Kamas en tu servidor. Este valor se multiplicará por los Sebuscalines obtenidos en el cofre para calcular el retorno de cada cacería.
            </p>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span>Precio estimado por 1 Sebuscalín (K):</span>
                  <span className="text-slate-500 font-normal text-[11px]">(ej: 25 K)</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={tempSebuscalin}
                  onChange={(e) => setTempSebuscalin(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm font-mono focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsRatesModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveRates}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow"
              >
                Guardar Cotización
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Direct inline editing is available on each item */}
    </div>
  );
};
