import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  Coins,
  Map as MapIcon,
  Layers,
  Sparkles,
  Award,
  Vault,
  Search,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Percent,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  BarChart2,
} from "lucide-react";
import { LegendaryHuntInfo, LEGENDARY_HUNTS } from "../data/legendaryHuntsData";
import {
  getRelatedEquipmentForHunt,
  BycRelatedEquipment,
} from "../data/bycEquipmentData";
import {
  getItemIconUrl,
  saveMarketPrice,
  BankInventoryItem,
} from "../services/dofusDbService";
import {
  getStoredSalesVolumeMap,
  saveItemSalesVolume,
  analyzeSalesVolume,
  ItemSalesVolume,
} from "../services/salesVolumeService";

interface BycDetailPageProps {
  hunt: LegendaryHuntInfo;
  onBack: () => void;
  onSelectHunt: (hunt: LegendaryHuntInfo) => void;
  marketPrices: Record<number, number>;
  bankInventory: BankInventoryItem[] | Record<number, number>;
  sebuscalinPrice: number;
  onUpdateSebuscalinPrice: (price: number) => void;
  sandRosePrice?: number;
  onUpdateSandRosePrice?: (price: number) => void;
  onPriceChange: (itemId: number, newPrice: number) => void;
  onNavigateToShopping?: () => void;
  onNavigateToBank?: () => void;
  showToast: (msg: string) => void;
}

const MARKET_TAX_RATE = 0.03; // 3% HDV Tax

export const BycDetailPage: React.FC<BycDetailPageProps> = ({
  hunt,
  onBack,
  onSelectHunt,
  marketPrices,
  bankInventory,
  sebuscalinPrice,
  onUpdateSebuscalinPrice,
  onPriceChange,
  showToast,
}) => {
  // Direct Inline Price Drafts
  const [priceDrafts, setPriceDrafts] = useState<Record<number, string>>({});

  const handlePriceDraftChange = (itemId: number, rawVal: string) => {
    setPriceDrafts((prev) => ({ ...prev, [itemId]: rawVal }));
  };

  const handlePriceCommit = (itemId: number, rawVal: string) => {
    const num = Math.max(0, Number(rawVal.replace(/\D/g, "")) || 0);
    saveMarketPrice(itemId, num);
    onPriceChange(itemId, num);
    setPriceDrafts((prev) => {
      const copy = { ...prev };
      delete copy[itemId];
      return copy;
    });
  };

  // Search/filter for switching hunt quickly
  const [huntSearch, setHuntSearch] = useState("");
  const [isSwitchDropdownOpen, setIsSwitchDropdownOpen] = useState(false);

  // Sales Volume Map (24h, 7d, 30d records)
  const [salesVolumeMap, setSalesVolumeMap] = useState<Record<number, ItemSalesVolume>>(() => {
    return getStoredSalesVolumeMap();
  });

  const [activeVolumeModalItemId, setActiveVolumeModalItemId] = useState<number | null>(null);

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

  // Expanded equipment recipes
  const [expandedEquipmentIds, setExpandedEquipmentIds] = useState<Record<number, boolean>>({});

  // Selected ByC acquisition method per equipment (default is optimal)
  const [selectedEquipmentMethod, setSelectedEquipmentMethod] = useState<Record<number, "fragments" | "map" | "hdv">>({});

  const toggleEquipmentExpand = (id: number) => {
    setExpandedEquipmentIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Helper to format currency
  const formatKamas = (val: number) => {
    return new Intl.NumberFormat("es-ES").format(Math.round(val));
  };

  // Helper to resolve bank quantity safely
  const getBankQty = (itemId: number): number => {
    if (Array.isArray(bankInventory)) {
      const found = bankInventory.find((b) => b.itemId === itemId);
      return found ? found.quantity : 0;
    }
    return (bankInventory as Record<number, number>)[itemId] || 0;
  };

  // Safe item price lookup
  const getPrice = (itemId: number, defaultVal: number) => {
    return marketPrices[itemId] !== undefined ? marketPrices[itemId] : defaultVal;
  };

  // Prices for this hunt
  const wholeMapPrice = getPrice(hunt.mapItem.id, hunt.mapItem.defaultPrice);
  const resourcePriceGross = getPrice(hunt.resource.id, hunt.resource.defaultPrice);
  // Net resource income after 3% HDV sales tax
  const resourceNetIncome = Math.round(resourcePriceGross * (1 - MARKET_TAX_RATE));

  // Calculate fragments cost
  const fragmentPrices = hunt.fragments.fragmentIds.map((fragId) =>
    getPrice(fragId, hunt.fragments.defaultUnitPrice)
  );
  const fragmentsTotalCost = fragmentPrices.reduce((a, b) => a + b, 0);

  // Bank counts
  const fragmentsInBank = hunt.fragments.fragmentIds.map((id) => getBankQty(id));
  const totalFragmentsInBank = fragmentsInBank.reduce((a, b) => a + b, 0);
  const wholeMapsInBank = getBankQty(hunt.mapItem.id);
  const resourcesInBank = getBankQty(hunt.resource.id);

  // Sebuscalines rewards: Chest gives 50% of the mission reward
  const chestSebuscalines = hunt.chestSebuscalines || hunt.sebuscalines;
  const sebuscalinesValue = chestSebuscalines * sebuscalinPrice;

  // Total gross and net returns for pure Hunting (Hunt & Sell raw items)
  const totalHuntGrossReturn = resourcePriceGross + sebuscalinesValue;
  // Net return considering 3% tax on selling the boss resource in HDV (Sebuscalines converted directly have no HDV tax)
  const totalHuntNetReturn = resourceNetIncome + sebuscalinesValue;

  // Profit for hunting via Whole Map
  const profitMapNet = totalHuntNetReturn - wholeMapPrice;
  const roiMap = wholeMapPrice > 0 ? (profitMapNet / wholeMapPrice) * 100 : 0;

  // Profit for hunting via Fragments
  const profitFragsNet = totalHuntNetReturn - fragmentsTotalCost;
  const roiFrags = fragmentsTotalCost > 0 ? (profitFragsNet / fragmentsTotalCost) * 100 : 0;

  // Best acquisition method for the resource
  // Effective unit cost = Total Investment - Sebuscalines (can be negative if chest pays for the map!)
  const effectiveCostViaMap = wholeMapPrice - sebuscalinesValue;
  const effectiveCostViaFrags = fragmentsTotalCost - sebuscalinesValue;
  const effectiveCostViaHdv = resourcePriceGross; // Buying directly from HDV costs the gross price (no tax on buying, no chest)

  let bestHuntMethod: "fragments" | "map" = fragmentsTotalCost <= wholeMapPrice ? "fragments" : "map";
  let bestHuntInvestment = bestHuntMethod === "fragments" ? fragmentsTotalCost : wholeMapPrice;
  let bestHuntProfitNet = bestHuntMethod === "fragments" ? profitFragsNet : profitMapNet;
  let bestHuntRoi = bestHuntMethod === "fragments" ? roiFrags : roiMap;
  let bestHuntEffectiveUnitCost = bestHuntMethod === "fragments" ? effectiveCostViaFrags : effectiveCostViaMap;

  // What is the absolute cheapest way to acquire the boss resource (for crafting)?
  let optimalAcquisitionMethod: "fragments" | "map" | "hdv" = "fragments";
  let optimalUnitCostForCraft = effectiveCostViaFrags;

  if (effectiveCostViaMap < optimalUnitCostForCraft) {
    optimalAcquisitionMethod = "map";
    optimalUnitCostForCraft = effectiveCostViaMap;
  }
  if (effectiveCostViaHdv < optimalUnitCostForCraft) {
    optimalAcquisitionMethod = "hdv";
    optimalUnitCostForCraft = effectiveCostViaHdv;
  }

  // Related equipment list
  const relatedEquipment: BycRelatedEquipment[] = getRelatedEquipmentForHunt(
    hunt.id,
    hunt.monsterName,
    hunt.monsterLevel,
    hunt.resource.id,
    hunt.resource.name,
    resourcePriceGross
  );

  // Filtered hunts for quick search switch
  const filteredSwitchHunts = LEGENDARY_HUNTS.filter((h) =>
    h.monsterName.toLowerCase().includes(huntSearch.toLowerCase()) ||
    h.zone.toLowerCase().includes(huntSearch.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-12 animate-fadeIn" id="byc-detail-view">
      {/* Top Header & Breadcrumb */}
      <div className="relative z-30 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap sm:flex-nowrap">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 transition font-medium text-xs sm:text-sm shadow-sm shrink-0"
          >
            <ArrowLeft className="w-4 h-4 text-emerald-400" />
            <span>Volver a la lista</span>
          </button>

          <div className="h-6 w-px bg-slate-700 hidden sm:block" />

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Nv. {hunt.monsterLevel}
              </span>
              <h1 className="text-lg md:text-xl font-bold text-white tracking-tight">
                {hunt.monsterName}
              </h1>
              {hunt.zone && (
                <span className="text-xs text-slate-300 bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700">
                  {hunt.zone}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Requisito de búsqueda: <span className="text-slate-300 font-medium">{hunt.levelRequirement}</span>
            </p>
          </div>
        </div>

        {/* Right Controls: Sebuscalin Quote + Quick Hunt Switcher */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap shrink-0">
          {/* Inline Sebuscalin Quote Input */}
          <div className="bg-slate-950/90 border border-amber-500/40 rounded-xl px-3 py-1.5 flex items-center gap-2 shadow-sm">
            <Coins className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold text-amber-300 tracking-wider">
                1 Sebuscalín =
              </span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={sebuscalinPrice}
                  onChange={(e) => onUpdateSebuscalinPrice(Math.max(1, Number(e.target.value) || 1))}
                  className="w-16 bg-slate-900 border border-amber-500/50 rounded-md px-1.5 py-0.5 text-xs font-mono font-bold text-amber-300 text-right focus:outline-none focus:border-amber-400"
                />
                <span className="text-xs text-slate-400 font-mono">K</span>
              </div>
            </div>
          </div>

          {/* Quick Hunt Switcher */}
          <div className="relative">
            <button
              onClick={() => setIsSwitchDropdownOpen(!isSwitchDropdownOpen)}
              className="flex items-center justify-between gap-2.5 px-3 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-xl border border-slate-700 text-xs sm:text-sm font-medium transition w-full sm:w-56"
            >
              <span className="truncate flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                Cambiar monstruo...
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>

            {isSwitchDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsSwitchDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-72 max-h-80 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col">
                  <div className="p-2 border-b border-slate-800">
                    <input
                      type="text"
                      placeholder="Buscar ByC..."
                      value={huntSearch}
                      onChange={(e) => setHuntSearch(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                      autoFocus
                    />
                  </div>
                  <div className="overflow-y-auto max-h-64 p-1">
                    {filteredSwitchHunts.map((h) => (
                      <button
                        key={h.id}
                        onClick={() => {
                          onSelectHunt(h);
                          setIsSwitchDropdownOpen(false);
                          setHuntSearch("");
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-left rounded-lg text-xs transition ${
                          h.id === hunt.id
                            ? "bg-emerald-600/30 text-emerald-300 font-semibold"
                            : "text-slate-300 hover:bg-slate-800"
                        }`}
                      >
                        <span className="truncate">{h.monsterName}</span>
                        <span className="text-[10px] text-slate-400 ml-2">Nv. {h.monsterLevel}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* UNIFIED SECTION 1: MAP FRAGMENTS & HUNT PROFITABILITY */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
        {/* Header with Title and Global Price Inputs */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
              <img
                src={getItemIconUrl(hunt.resource.id)}
                alt={hunt.resource.name}
                className="w-9 h-9 object-contain"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-white">
                  1. Rentabilidad de la Cacería & {hunt.resource.name}
                </h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
                  {hunt.fragments.count} fragmentos
                </span>
                {resourcesInBank > 0 && (
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-500/20 px-2.5 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1">
                    <Vault className="w-3 h-3" /> {resourcesInBank} en banco
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Cofre otorga <strong className="text-amber-300 font-mono">+{chestSebuscalines} Sebuscalines</strong> ({formatKamas(sebuscalinesValue)} K) + 1x {hunt.resource.name} (Retorno neto venta -3% tasa HDV: <strong className="text-emerald-400 font-mono">{formatKamas(totalHuntNetReturn)} K</strong>).
              </p>
            </div>
          </div>

          {/* Quick HDV Input Controls */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Whole Map HDV Price */}
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 shadow-sm">
              <span className="text-xs sm:text-sm text-slate-300 font-medium whitespace-nowrap">Mapa en HDV:</span>
              <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 focus-within:border-amber-400">
                <input
                  type="number"
                  min="0"
                  value={priceDrafts[hunt.mapItem.id] !== undefined ? priceDrafts[hunt.mapItem.id] : (wholeMapPrice > 0 ? wholeMapPrice : "")}
                  onChange={(e) => handlePriceDraftChange(hunt.mapItem.id, e.target.value)}
                  onBlur={(e) => handlePriceCommit(hunt.mapItem.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handlePriceCommit(hunt.mapItem.id, (e.target as HTMLInputElement).value);
                  }}
                  placeholder="0"
                  className="w-24 bg-transparent text-right font-mono font-bold text-amber-300 text-xs sm:text-sm focus:outline-none"
                />
                <span className="text-xs text-slate-400 font-mono">K</span>
              </div>
            </div>

            {/* Boss Resource HDV Price */}
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 shadow-sm">
              <span className="text-xs sm:text-sm text-slate-300 font-medium whitespace-nowrap">Recurso en HDV:</span>
              <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 focus-within:border-amber-400">
                <input
                  type="number"
                  min="0"
                  value={priceDrafts[hunt.resource.id] !== undefined ? priceDrafts[hunt.resource.id] : (resourcePriceGross > 0 ? resourcePriceGross : "")}
                  onChange={(e) => handlePriceDraftChange(hunt.resource.id, e.target.value)}
                  onBlur={(e) => handlePriceCommit(hunt.resource.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handlePriceCommit(hunt.resource.id, (e.target as HTMLInputElement).value);
                  }}
                  placeholder="0"
                  className="w-24 bg-transparent text-right font-mono font-bold text-amber-300 text-xs sm:text-sm focus:outline-none"
                />
                <span className="text-xs text-slate-400 font-mono">K</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content: Fragments Grid (Left) & Profit Analysis Options (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Left Column: Fragment Pieces */}
          <div className="lg:col-span-7 space-y-2.5">
            <div className={`grid gap-2 ${
              hunt.fragments.count <= 2 
                ? "grid-cols-2" 
                : hunt.fragments.count <= 4 
                  ? "grid-cols-2 sm:grid-cols-4" 
                  : "grid-cols-2 sm:grid-cols-4"
            }`}>
              {hunt.fragments.fragmentIds.map((fragId, idx) => {
                const price = getPrice(fragId, hunt.fragments.defaultUnitPrice);
                const inBank = getBankQty(fragId);
                const pieceNum = idx + 1;

                return (
                  <div
                    key={fragId}
                    className={`flex flex-col justify-between p-2.5 rounded-xl border transition ${
                      inBank > 0
                        ? "bg-emerald-950/20 border-emerald-600/40"
                        : "bg-slate-800/60 border-slate-700/80 hover:border-indigo-500/50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        {pieceNum}/{hunt.fragments.count}
                      </span>
                      {inBank > 0 ? (
                        <span className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-500/30">
                          <Vault className="w-2.5 h-2.5" /> x{inBank}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500 font-medium">0 banco</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 my-1">
                      <div className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                        <img
                          src="https://api.dofusdb.fr/img/items/77042.png"
                          alt={`Fragmento ${pieceNum}`}
                          className="w-6 h-6 object-contain"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                      </div>
                      <span className="text-xs font-bold text-slate-200 truncate">
                        Pieza [{pieceNum}/{hunt.fragments.count}]
                      </span>
                    </div>

                    <div className="mt-1 pt-1.5 border-t border-slate-700/60 flex items-center justify-between gap-1">
                      <span className="text-[10px] text-slate-400 uppercase font-bold">HDV</span>
                      <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-md px-1.5 py-0.5 focus-within:border-amber-400">
                        <input
                          type="number"
                          min="0"
                          value={priceDrafts[fragId] !== undefined ? priceDrafts[fragId] : (price > 0 ? price : "")}
                          onChange={(e) => handlePriceDraftChange(fragId, e.target.value)}
                          onBlur={(e) => handlePriceCommit(fragId, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handlePriceCommit(fragId, (e.target as HTMLInputElement).value);
                          }}
                          placeholder="0"
                          className="w-16 bg-transparent text-right font-mono font-bold text-amber-300 text-xs focus:outline-none"
                        />
                        <span className="text-[10px] text-slate-400 font-mono">K</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Fragments Total Bar */}
            <div className="flex items-center justify-between p-2.5 px-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs sm:text-sm">
              <span className="text-slate-400">Inversión armar los {hunt.fragments.count} fragmentos:</span>
              <span className="font-mono font-bold text-amber-300">
                {formatKamas(fragmentsTotalCost)} Kamas
              </span>
            </div>
          </div>

          {/* Right Column: Complete Profitability Matrix (Hunt & Sell directly in HDV) */}
          <div className="lg:col-span-5 space-y-2.5">
            <div className="space-y-2">
              {/* Option 1: Hunt with Fragments */}
              <div className={`p-3 rounded-xl border flex items-center justify-between transition ${
                bestHuntMethod === "fragments"
                  ? "bg-emerald-950/30 border-emerald-500/50 ring-1 ring-emerald-500/30"
                  : "bg-slate-800/40 border-slate-700/70"
              }`}>
                <div>
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs sm:text-sm font-bold text-slate-200">1. Cazar con Fragmentos</span>
                    {bestHuntMethod === "fragments" && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500 text-slate-950">
                        MÁS BARATO
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Inversión: <span className="font-mono text-slate-300">{formatKamas(fragmentsTotalCost)} K</span> | Retorno: <span className="font-mono text-slate-300">{formatKamas(totalHuntNetReturn)} K</span>
                  </div>
                </div>

                <div className="text-right">
                  <div className={`text-sm sm:text-base font-black font-mono ${profitFragsNet >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {profitFragsNet >= 0 ? `+${formatKamas(profitFragsNet)}` : `-${formatKamas(Math.abs(profitFragsNet))}`} K
                  </div>
                  <span className={`text-xs font-mono font-bold ${profitFragsNet >= 0 ? "text-emerald-300/90" : "text-rose-400/90"}`}>
                    {roiFrags >= 0 ? `+${roiFrags.toFixed(0)}%` : `${roiFrags.toFixed(0)}%`} ROI neto
                  </span>
                </div>
              </div>

              {/* Option 2: Hunt with Whole Map */}
              <div className={`p-3 rounded-xl border flex items-center justify-between transition ${
                bestHuntMethod === "map"
                  ? "bg-emerald-950/30 border-emerald-500/50 ring-1 ring-emerald-500/30"
                  : "bg-slate-800/40 border-slate-700/70"
              }`}>
                <div>
                  <div className="flex items-center gap-1.5">
                    <MapIcon className="w-4 h-4 text-amber-400" />
                    <span className="text-xs sm:text-sm font-bold text-slate-200">2. Cazar con Mapa Entero</span>
                    {bestHuntMethod === "map" && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500 text-slate-950">
                        MÁS BARATO
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Inversión: <span className="font-mono text-slate-300">{formatKamas(wholeMapPrice)} K</span> | Retorno: <span className="font-mono text-slate-300">{formatKamas(totalHuntNetReturn)} K</span>
                  </div>
                </div>

                <div className="text-right">
                  <div className={`text-sm sm:text-base font-black font-mono ${profitMapNet >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {profitMapNet >= 0 ? `+${formatKamas(profitMapNet)}` : `-${formatKamas(Math.abs(profitMapNet))}`} K
                  </div>
                  <span className={`text-xs font-mono font-bold ${profitMapNet >= 0 ? "text-emerald-300/90" : "text-rose-400/90"}`}>
                    {roiMap >= 0 ? `+${roiMap.toFixed(0)}%` : `${roiMap.toFixed(0)}%`} ROI neto
                  </span>
                </div>
              </div>

              {/* Option 3: Cost to Buy Resource Direct */}
              <div className="p-3 rounded-xl border bg-slate-800/30 border-slate-700/60 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs sm:text-sm font-bold text-slate-200">3. Comprar {hunt.resource.name} en mercadillo</span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Compra directa sin cacería (0 Sebuscalines)
                  </span>
                </div>

                <div className="text-right">
                  <div className="text-sm sm:text-base font-black font-mono text-slate-200">
                    {formatKamas(resourcePriceGross)} K
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    Precio compra mercadillo
                  </span>
                </div>
              </div>
            </div>

            {/* Acquisition & Profit Verdict Banner */}
            <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 text-xs sm:text-sm flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div>
                  {bestHuntProfitNet > 0 ? (
                    <span className="text-emerald-400 font-bold">
                      ¡Cazar genera +{formatKamas(bestHuntProfitNet)} Kamas de beneficio directo! (Inviertes {formatKamas(bestHuntInvestment)} K y sacas {formatKamas(totalHuntNetReturn)} K).
                    </span>
                  ) : (
                    <span className="text-rose-400 font-bold">
                      Cazar genera déficit de -{formatKamas(Math.abs(bestHuntProfitNet))} K frente a comprar directo.
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400">
                  {effectiveCostViaFrags < 0 ? (
                    <span className="text-cyan-300">
                      ⭐ Nota: Los {chestSebuscalines} Sebuscalines superan el coste de los fragmentos, dejándote <strong>+{formatKamas(Math.abs(effectiveCostViaFrags))} K limpios</strong> de ganancia extra antes de usar/vender el recurso.
                    </span>
                  ) : (
                    <span>
                      Coste efectivo neto de la materia prima al cazar: <strong className="text-amber-300 font-mono">{formatKamas(bestHuntEffectiveUnitCost)} K</strong> (Ahorras {formatKamas(resourcePriceGross - bestHuntEffectiveUnitCost)} K vs HDV).
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: RELATED EQUIPMENT CRAFTING & DECISION STRATEGY */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-400" />
              <h2 className="text-base sm:text-lg font-bold text-white">
                2. Decisión de Negocio: ¿Vender Recurso o Craftear Equipable?
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Calcula si vale la pena transformar {hunt.resource.name} crafteando el equipable vs solo vender el recurso crudo en HDV. Incluye impuesto del 3% en ventas HDV.
            </p>
          </div>

          <div className="text-xs text-slate-400 bg-slate-800 px-3 py-1 rounded-lg border border-slate-700 self-start sm:self-center font-medium">
            {relatedEquipment.length} equipable(s)
          </div>
        </div>

        {/* Equipment List */}
        <div className="space-y-4">
          {relatedEquipment.map((eq) => {
            const salePriceGross = getPrice(eq.id, eq.defaultSalePrice);
            // Net equipment sale income after 3% tax
            const saleIncomeNet = Math.round(salePriceGross * (1 - MARKET_TAX_RATE));
            const isExpanded = expandedEquipmentIds[eq.id] ?? true;

            // Selected acquisition method for this equipment (defaults to optimal)
            const activeMethod: "fragments" | "map" | "hdv" =
              selectedEquipmentMethod[eq.id] || optimalAcquisitionMethod;

            // Calculate other ingredients cost (excluding ByC boss resource)
            const otherIngredients = eq.recipeIngredients.filter((ing) => ing.id !== hunt.resource.id);
            const otherIngredientsCost = otherIngredients.reduce((acc, ing) => {
              const ingPrice = getPrice(ing.id, ing.defaultPrice);
              return acc + ingPrice * ing.quantity;
            }, 0);

            const resourceQtyNeeded = eq.resourceQuantityNeeded || 1;

            // --- CALCULATIONS FOR ALL 3 ACQUISITION CASES ---
            // Case 1: FRAGMENTOS
            const fragsBycCost = fragmentsTotalCost * resourceQtyNeeded;
            const fragsInvestment = otherIngredientsCost + fragsBycCost;
            const fragsSebuscalines = sebuscalinesValue * resourceQtyNeeded;
            const fragsRevenue = saleIncomeNet + fragsSebuscalines;
            const fragsProfitNet = fragsRevenue - fragsInvestment;
            const fragsRoi = fragsInvestment > 0 ? (fragsProfitNet / fragsInvestment) * 100 : 0;

            // Case 2: MAPA ENTERO
            const mapBycCost = wholeMapPrice * resourceQtyNeeded;
            const mapInvestment = otherIngredientsCost + mapBycCost;
            const mapSebuscalines = sebuscalinesValue * resourceQtyNeeded;
            const mapRevenue = saleIncomeNet + mapSebuscalines;
            const mapProfitNet = mapRevenue - mapInvestment;
            const mapRoi = mapInvestment > 0 ? (mapProfitNet / mapInvestment) * 100 : 0;

            // Case 3: COMPRA RECURSO EN HDV (0 Sebuscalines!)
            const hdvBycCost = resourcePriceGross * resourceQtyNeeded;
            const hdvInvestment = otherIngredientsCost + hdvBycCost;
            const hdvSebuscalines = 0; // No hunt, no chest, no sebuscalines!
            const hdvRevenue = saleIncomeNet; // Only equipment sale
            const hdvProfitNet = hdvRevenue - hdvInvestment;
            const hdvRoi = hdvInvestment > 0 ? (hdvProfitNet / hdvInvestment) * 100 : 0;

            // Active Case Metrics based on current user selection:
            let currentBycUnitCost = 0;
            let currentBycTotalCost = 0;
            let currentInvestment = 0;
            let currentSebuscalines = 0;
            let currentRevenue = 0;
            let currentProfitNet = 0;
            let currentRoi = 0;
            let currentMethodLabel = "";

            if (activeMethod === "fragments") {
              currentBycUnitCost = fragmentsTotalCost;
              currentBycTotalCost = fragsBycCost;
              currentInvestment = fragsInvestment;
              currentSebuscalines = fragsSebuscalines;
              currentRevenue = fragsRevenue;
              currentProfitNet = fragsProfitNet;
              currentRoi = fragsRoi;
              currentMethodLabel = "Fragmentos";
            } else if (activeMethod === "map") {
              currentBycUnitCost = wholeMapPrice;
              currentBycTotalCost = mapBycCost;
              currentInvestment = mapInvestment;
              currentSebuscalines = mapSebuscalines;
              currentRevenue = mapRevenue;
              currentProfitNet = mapProfitNet;
              currentRoi = mapRoi;
              currentMethodLabel = "Mapa Entero";
            } else {
              currentBycUnitCost = resourcePriceGross;
              currentBycTotalCost = hdvBycCost;
              currentInvestment = hdvInvestment;
              currentSebuscalines = 0;
              currentRevenue = hdvRevenue;
              currentProfitNet = hdvProfitNet;
              currentRoi = hdvRoi;
              currentMethodLabel = "Recurso HDV";
            }

            // Added Value of Crafting vs Just Selling Raw Resource in HDV
            // If you already have/cazaste the raw resource, selling it raw nets (resourceNetIncome * qty)
            // Crafting takes raw resource + otherIngredientsCost and yields saleIncomeNet
            const addedValueVsRawSale = saleIncomeNet - otherIngredientsCost - (resourceNetIncome * resourceQtyNeeded);

            // Sales Volume & Velocity Analysis for Equipment
            const eqSalesVolume = salesVolumeMap[eq.id];
            const eqSalesAnalysis = analyzeSalesVolume(salePriceGross, eqSalesVolume);
            const isVolumeModalOpen = activeVolumeModalItemId === eq.id;

            return (
              <div
                key={eq.id}
                className="bg-slate-800/75 border border-slate-700 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4 transition hover:border-slate-600"
              >
                {/* Equipment Header Row */}
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-14 h-14 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0 shadow-md">
                      <img
                        src={getItemIconUrl(eq.id)}
                        alt={eq.name}
                        className="w-11 h-11 object-contain"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          {eq.type}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-slate-700 text-slate-200">
                          Nv. {eq.level}
                        </span>
                        <h3 className="text-base sm:text-lg font-bold text-white">{eq.name}</h3>

                        {/* Sales Volume / Turnover Badge (Only rendered if data exists) */}
                        {eqSalesAnalysis.hasData && eqSalesAnalysis.turnoverRating && (
                          <span
                            className={`px-2 py-0.5 rounded-md text-xs font-bold border flex items-center gap-1 ${
                              eqSalesAnalysis.turnoverRating === "alta"
                                ? "bg-emerald-950/60 text-emerald-300 border-emerald-500/40"
                                : eqSalesAnalysis.turnoverRating === "media"
                                ? "bg-amber-950/60 text-amber-300 border-amber-500/40"
                                : "bg-slate-800 text-slate-300 border-slate-700"
                            }`}
                          >
                            <span>{eqSalesAnalysis.turnoverLabel}</span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm text-slate-300 mt-1 flex items-center gap-2 flex-wrap">
                        <span>
                          Requiere {resourceQtyNeeded}x <strong className="text-amber-300">{hunt.resource.name}</strong>
                        </span>
                        <span className="text-slate-500">•</span>
                        {addedValueVsRawSale > 0 ? (
                          <span className="text-emerald-400 font-bold bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-500/30">
                            Craftear añade +{formatKamas(addedValueVsRawSale)} K frente a solo vender el recurso crudo
                          </span>
                        ) : (
                          <span className="text-amber-400 font-semibold bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-500/30">
                            Craftear rinde {formatKamas(Math.abs(addedValueVsRawSale))} K menos que vender el recurso directo
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap justify-start xl:justify-end">
                    {/* Market Sale Price Box */}
                    <div className="bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 flex items-center gap-2.5 shadow-sm">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                          Venta HDV:
                        </span>
                        <span className="text-xs text-emerald-400 font-mono font-bold">
                          Neto (-3%): {formatKamas(saleIncomeNet)} K
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 focus-within:border-amber-400">
                        <input
                          type="number"
                          min="0"
                          value={priceDrafts[eq.id] !== undefined ? priceDrafts[eq.id] : (salePriceGross > 0 ? salePriceGross : "")}
                          onChange={(e) => handlePriceDraftChange(eq.id, e.target.value)}
                          onBlur={(e) => handlePriceCommit(eq.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handlePriceCommit(eq.id, (e.target as HTMLInputElement).value);
                          }}
                          placeholder="0"
                          className="w-28 bg-transparent text-right font-mono font-bold text-amber-300 text-sm sm:text-base focus:outline-none"
                        />
                        <span className="text-xs font-mono font-bold text-slate-400">K</span>
                      </div>
                    </div>

                    {/* Total Materials Crafting Cost */}
                    <div className="bg-slate-900/90 border border-slate-700 rounded-xl px-3.5 py-2 flex flex-col justify-center shadow-sm">
                      <span className="text-xs text-slate-400 uppercase font-bold tracking-wide">
                        Inversión Materiales
                      </span>
                      <span className="text-sm sm:text-base font-mono font-black text-slate-100">
                        {formatKamas(currentInvestment)} K
                      </span>
                    </div>

                    {/* Total Profit from entire Loop */}
                    <div className={`rounded-xl px-3.5 py-2 flex flex-col justify-center border shadow-sm ${
                      currentProfitNet >= 0
                        ? "bg-emerald-950/50 border-emerald-500/50"
                        : "bg-rose-950/50 border-rose-500/50"
                    }`}>
                      <span className={`text-xs font-bold uppercase tracking-wide ${
                        currentProfitNet >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}>
                        {currentProfitNet >= 0 ? "Ganancia Total Ciclo" : "Margen Pérdida"}
                      </span>
                      <span className={`text-sm sm:text-base font-black font-mono ${
                        currentProfitNet >= 0 ? "text-emerald-300" : "text-rose-400"
                      }`}>
                        {currentProfitNet >= 0 ? `+${formatKamas(currentProfitNet)}` : `-${formatKamas(Math.abs(currentProfitNet))}`} K{" "}
                        <span className="text-xs font-bold">({currentRoi >= 0 ? `+${currentRoi.toFixed(0)}%` : `${currentRoi.toFixed(0)}%`} ROI)</span>
                      </span>
                    </div>

                    {/* Toggle Sales Volume Drawer Button */}
                    <button
                      type="button"
                      onClick={() => setActiveVolumeModalItemId(isVolumeModalOpen ? null : eq.id)}
                      className={`p-2.5 rounded-xl border transition ${
                        isVolumeModalOpen || eqSalesAnalysis.hasData
                          ? "bg-indigo-950/50 border-indigo-500/60 text-indigo-300"
                          : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
                      }`}
                      title="Registrar o ver volumen de ventas (24h, 7d, 30d)"
                    >
                      <BarChart2 className="w-5 h-5" />
                    </button>

                    <button
                      onClick={() => toggleEquipmentExpand(eq.id)}
                      className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition border border-slate-700"
                      title={isExpanded ? "Ocultar detalles" : "Ver detalles"}
                    >
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Sales Volume Drawer (24h / 7d / 30d) */}
                {isVolumeModalOpen && (
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
                          value={eqSalesVolume?.sales24h !== undefined ? eqSalesVolume.sales24h : ""}
                          onChange={(e) => handleUpdateVolume(eq.id, "sales24h", e.target.value)}
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
                          value={eqSalesVolume?.sales7d !== undefined ? eqSalesVolume.sales7d : ""}
                          onChange={(e) => handleUpdateVolume(eq.id, "sales7d", e.target.value)}
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
                          value={eqSalesVolume?.sales30d !== undefined ? eqSalesVolume.sales30d : ""}
                          onChange={(e) => handleUpdateVolume(eq.id, "sales30d", e.target.value)}
                          placeholder="—"
                          className="w-16 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-right font-mono font-bold text-indigo-300 text-sm focus:outline-none focus:border-indigo-400"
                        />
                      </div>
                    </div>

                    {/* Estimates Output (Only when data exists) */}
                    {eqSalesAnalysis.hasData ? (
                      <div className="pt-2 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div className="flex flex-col">
                          <span className="text-slate-400">Ritmo diario estimado:</span>
                          <span className="text-slate-200 font-bold font-mono text-sm mt-0.5">
                            ~{eqSalesAnalysis.avgDailySales} u/día
                          </span>
                        </div>

                        <div className="flex flex-col">
                          <span className="text-slate-400">Tiempo de venta estimado:</span>
                          <span className="text-slate-200 font-bold font-mono text-sm mt-0.5">
                            {eqSalesAnalysis.daysToSell !== null
                              ? eqSalesAnalysis.daysToSell < 1
                                ? `< 24 horas`
                                : `~${Math.round(eqSalesAnalysis.daysToSell)} días`
                              : "—"}
                          </span>
                        </div>

                        <div className="flex flex-col">
                          <span className="text-slate-400">Precio sugerido de venta:</span>
                          <span className="text-amber-300 font-bold font-mono text-sm mt-0.5">
                            {eqSalesAnalysis.suggestedPrice !== null
                              ? `${formatKamas(eqSalesAnalysis.suggestedPrice)} K`
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

                {/* 3-Method Selection Pills & Comparison Bar */}
                <div className="bg-slate-900/90 border border-slate-750 rounded-xl p-3 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <span>Seleccionar método de obtención de {hunt.resource.name}:</span>
                    </span>
                    <span className="text-xs text-slate-400">
                      Haz clic para alternar y recalcular el ciclo completo
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {/* Method 1: Fragmentos */}
                    <button
                      type="button"
                      onClick={() => setSelectedEquipmentMethod((prev) => ({ ...prev, [eq.id]: "fragments" }))}
                      className={`flex flex-col p-2.5 rounded-xl border text-left transition ${
                        activeMethod === "fragments"
                          ? "bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/30"
                          : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span>🧩 Fragmentos</span>
                          {optimalAcquisitionMethod === "fragments" && (
                            <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-bold border border-amber-500/30">
                              Óptimo
                            </span>
                          )}
                        </span>
                        <span className={`text-xs font-mono font-bold ${fragsProfitNet >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {fragsProfitNet >= 0 ? `+${formatKamas(fragsProfitNet)}` : `-${formatKamas(Math.abs(fragsProfitNet))}`} K
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                        <span>Inv: {formatKamas(fragsInvestment)} K</span>
                        <span className="text-emerald-300">+{formatKamas(fragsSebuscalines)} K Sebuscalines</span>
                      </div>
                    </button>

                    {/* Method 2: Mapa Entero */}
                    <button
                      type="button"
                      onClick={() => setSelectedEquipmentMethod((prev) => ({ ...prev, [eq.id]: "map" }))}
                      className={`flex flex-col p-2.5 rounded-xl border text-left transition ${
                        activeMethod === "map"
                          ? "bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/30"
                          : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span>🗺️ Mapa Entero</span>
                          {optimalAcquisitionMethod === "map" && (
                            <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-bold border border-amber-500/30">
                              Óptimo
                            </span>
                          )}
                        </span>
                        <span className={`text-xs font-mono font-bold ${mapProfitNet >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {mapProfitNet >= 0 ? `+${formatKamas(mapProfitNet)}` : `-${formatKamas(Math.abs(mapProfitNet))}`} K
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                        <span>Inv: {formatKamas(mapInvestment)} K</span>
                        <span className="text-emerald-300">+{formatKamas(mapSebuscalines)} K Sebuscalines</span>
                      </div>
                    </button>

                    {/* Method 3: Compra HDV */}
                    <button
                      type="button"
                      onClick={() => setSelectedEquipmentMethod((prev) => ({ ...prev, [eq.id]: "hdv" }))}
                      className={`flex flex-col p-2.5 rounded-xl border text-left transition ${
                        activeMethod === "hdv"
                          ? "bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/30"
                          : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span>🛒 Compra en HDV</span>
                          {optimalAcquisitionMethod === "hdv" && (
                            <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-bold border border-amber-500/30">
                              Óptimo
                            </span>
                          )}
                        </span>
                        <span className={`text-xs font-mono font-bold ${hdvProfitNet >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {hdvProfitNet >= 0 ? `+${formatKamas(hdvProfitNet)}` : `-${formatKamas(Math.abs(hdvProfitNet))}`} K
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                        <span>Inv: {formatKamas(hdvInvestment)} K</span>
                        <span className="text-slate-500 font-semibold">(0 Sebuscalines)</span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Collapsible Details: Financial Breakdown + Ingredients */}
                {isExpanded && (
                  <div className="pt-2 border-t border-slate-700/80 space-y-4">
                    {/* Financial Math Summary Card for Active Method */}
                    <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 sm:p-4 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                          <span>📊 Resumen Financiero del Ciclo ({currentMethodLabel})</span>
                        </span>
                        <span className="text-xs text-slate-400">
                          {activeMethod === "hdv"
                            ? "Comprando el recurso directo en mercadillo (sin cazar, sin Sebuscalines)"
                            : `Haciendo la cacería de ${hunt.monsterName} con ${currentMethodLabel} + crafteo`}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/* 1. Total Investment Breakdown */}
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-1">
                          <span className="text-xs text-slate-400 uppercase font-bold">1. Inversión Total</span>
                          <div className="text-base sm:text-lg font-black font-mono text-slate-100">
                            {formatKamas(currentInvestment)} K
                          </div>
                          <div className="text-xs text-slate-400 space-y-0.5 pt-1 border-t border-slate-800">
                            <div className="flex justify-between">
                              <span>Otros ingredientes:</span>
                              <span className="font-mono text-slate-300">{formatKamas(otherIngredientsCost)} K</span>
                            </div>
                            <div className="flex justify-between">
                              <span>{hunt.resource.name} ({currentMethodLabel}):</span>
                              <span className="font-mono text-amber-300">{formatKamas(currentBycTotalCost)} K</span>
                            </div>
                          </div>
                        </div>

                        {/* 2. Total Net Revenue Breakdown */}
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-1">
                          <span className="text-xs text-slate-400 uppercase font-bold">2. Ingresos Netos</span>
                          <div className="text-base sm:text-lg font-black font-mono text-emerald-400">
                            {formatKamas(currentRevenue)} K
                          </div>
                          <div className="text-xs text-slate-400 space-y-0.5 pt-1 border-t border-slate-800">
                            <div className="flex justify-between">
                              <span>Venta Equipo (HDV -3%):</span>
                              <span className="font-mono text-slate-300">{formatKamas(saleIncomeNet)} K</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Sebuscalines ({chestSebuscalines * resourceQtyNeeded} u):</span>
                              <span className={`font-mono ${currentSebuscalines > 0 ? "text-emerald-300 font-bold" : "text-slate-500"}`}>
                                +{formatKamas(currentSebuscalines)} K
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* 3. Pure Net Profit */}
                        <div className={`border rounded-xl p-3 space-y-1 ${
                          currentProfitNet >= 0
                            ? "bg-emerald-950/40 border-emerald-500/40"
                            : "bg-rose-950/40 border-rose-500/40"
                        }`}>
                          <span className={`text-xs uppercase font-bold ${
                            currentProfitNet >= 0 ? "text-emerald-400" : "text-rose-400"
                          }`}>
                            3. Ganancia Limpia (Beneficio)
                          </span>
                          <div className={`text-base sm:text-lg font-black font-mono ${
                            currentProfitNet >= 0 ? "text-emerald-300" : "text-rose-300"
                          }`}>
                            {currentProfitNet >= 0 ? `+${formatKamas(currentProfitNet)}` : `-${formatKamas(Math.abs(currentProfitNet))}`} K
                          </div>
                          <div className="text-xs text-slate-300 pt-1 border-t border-slate-800/80 flex items-center justify-between">
                            <span>Retorno inversión (ROI):</span>
                            <span className={`font-bold font-mono ${currentRoi >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                              {currentRoi >= 0 ? `+${currentRoi.toFixed(0)}%` : `${currentRoi.toFixed(0)}%`}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Ingredients Breakdown */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between text-xs sm:text-sm text-slate-300 flex-wrap gap-2">
                        <span className="font-bold uppercase tracking-wider text-slate-200">
                          Ingredientes de la Receta
                        </span>
                        <span className="text-xs sm:text-sm text-slate-400">
                          Otros ingredientes: <strong className="text-slate-200 font-mono">{formatKamas(otherIngredientsCost)} K</strong> + {hunt.resource.name} ({currentMethodLabel} x{resourceQtyNeeded}): <strong className="text-amber-300 font-mono">{formatKamas(currentBycTotalCost)} K</strong>
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {eq.recipeIngredients.map((ing) => {
                          const isBycResource = ing.id === hunt.resource.id;
                          const ingUnitPrice = isBycResource 
                            ? currentBycUnitCost
                            : getPrice(ing.id, ing.defaultPrice);
                          const inBank = getBankQty(ing.id);

                          return (
                            <div
                              key={ing.id}
                              className={`flex items-center justify-between p-3 rounded-xl border transition ${
                                isBycResource
                                  ? "bg-emerald-950/30 border-emerald-500/60 ring-1 ring-emerald-500/30"
                                  : inBank >= ing.quantity
                                  ? "bg-emerald-950/20 border-emerald-600/40"
                                  : "bg-slate-900/80 border-slate-700/80"
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                                  <img
                                    src={getItemIconUrl(ing.id)}
                                    alt={ing.name}
                                    className="w-7 h-7 object-contain"
                                    referrerPolicy="no-referrer"
                                    onError={(e) => {
                                      (e.target as HTMLElement).style.display = "none";
                                    }}
                                  />
                                </div>
                                <div className="min-w-0">
                                  <div className="font-bold text-slate-100 truncate flex items-center gap-1.5 text-xs sm:text-sm">
                                    <span>{ing.quantity}x {ing.name}</span>
                                    {isBycResource && (
                                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/30 text-emerald-300 border border-emerald-500/40">
                                        {currentMethodLabel}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                                    {isBycResource ? (
                                      <span className="text-emerald-400 font-mono font-bold">
                                        {formatKamas(ingUnitPrice)} K/u ({currentMethodLabel})
                                      </span>
                                    ) : (
                                      <span className="font-mono text-slate-300">{formatKamas(ingUnitPrice)} K/u</span>
                                    )}
                                    {inBank > 0 && (
                                      <span className="text-emerald-400 font-bold">
                                        ({inBank} banco)
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0 ml-2">
                                {isBycResource ? (
                                  <div className="px-2.5 py-1.5 bg-emerald-950/50 border border-emerald-500/40 rounded-lg text-right">
                                    <span className="font-bold text-xs sm:text-sm font-mono text-emerald-300">
                                      = {formatKamas(ingUnitPrice * ing.quantity)} K
                                    </span>
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex items-center gap-1 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 focus-within:border-amber-400">
                                      <input
                                        type="number"
                                        min="0"
                                        value={priceDrafts[ing.id] !== undefined ? priceDrafts[ing.id] : (ingUnitPrice > 0 ? ingUnitPrice : "")}
                                        onChange={(e) => handlePriceDraftChange(ing.id, e.target.value)}
                                        onBlur={(e) => handlePriceCommit(ing.id, e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") handlePriceCommit(ing.id, (e.target as HTMLInputElement).value);
                                        }}
                                        placeholder="0"
                                        className="w-18 bg-transparent text-right font-mono font-bold text-amber-300 text-xs sm:text-sm focus:outline-none"
                                      />
                                      <span className="text-xs text-slate-400 font-mono">K</span>
                                    </div>
                                    <span className="font-black text-slate-200 text-xs sm:text-sm font-mono min-w-[65px] text-right">
                                      = {formatKamas(ingUnitPrice * ing.quantity)} K
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};


