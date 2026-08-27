import React, { useState } from "react";
import {
  ArrowLeft,
  Coins,
  Map as MapIcon,
  Layers,
  Sparkles,
  Award,
  Vault,
  Edit2,
  CheckCircle2,
  Search,
  ChevronDown,
  ChevronUp,
  Snowflake,
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

  // Expanded equipment recipes
  const [expandedEquipmentIds, setExpandedEquipmentIds] = useState<Record<number, boolean>>({});

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
  const resourcePrice = getPrice(hunt.resource.id, hunt.resource.defaultPrice);

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
  const missionSebuscalines = hunt.missionSebuscalines || chestSebuscalines * 2;

  // Rewards calculation
  const sebuscalinesValue = chestSebuscalines * sebuscalinPrice;
  const totalRewardsValue = resourcePrice + sebuscalinesValue;
  const bonusCurrenciesValue = sebuscalinesValue;

  // Best entry cost
  const bestEntryCost = Math.min(wholeMapPrice, fragmentsTotalCost);
  const netHuntProfit = totalRewardsValue - bestEntryCost;
  const netHuntRoi = bestEntryCost > 0 ? (netHuntProfit / bestEntryCost) * 100 : 0;

  // Cost to get resource via hunt (Map cost - bonus currencies)
  const effectiveResourceCostViaMap = Math.max(0, wholeMapPrice - bonusCurrenciesValue);
  const effectiveResourceCostViaFragments = Math.max(0, fragmentsTotalCost - bonusCurrenciesValue);
  const bestResourceCostViaHunt = Math.min(effectiveResourceCostViaMap, effectiveResourceCostViaFragments);
  const huntVsBuySavings = resourcePrice - bestResourceCostViaHunt;

  // Related equipment list
  const relatedEquipment: BycRelatedEquipment[] = getRelatedEquipmentForHunt(
    hunt.id,
    hunt.monsterName,
    hunt.monsterLevel,
    hunt.resource.id,
    hunt.resource.name,
    resourcePrice
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
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition font-medium text-xs sm:text-sm shadow-sm shrink-0"
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
            <p className="text-[11px] text-slate-400 mt-0.5">
              Requisito de búsqueda: <span className="text-slate-300 font-medium">{hunt.levelRequirement}</span>
            </p>
          </div>
        </div>

        {/* Right Controls: Sebuscalin Quote + Quick Hunt Switcher */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap shrink-0">
          {/* Inline Sebuscalin Quote Input */}
          <div className="bg-slate-950/90 border border-amber-500/40 rounded-xl px-2.5 py-1.5 flex items-center gap-2 shadow-sm">
            <Coins className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-xs font-semibold text-amber-300 whitespace-nowrap">
              1 Sebuscalín =
            </span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="1"
                step="1"
                value={sebuscalinPrice}
                onChange={(e) => onUpdateSebuscalinPrice(Math.max(1, Number(e.target.value) || 1))}
                className="w-16 bg-slate-900 border border-amber-500/50 rounded-lg px-1.5 py-0.5 text-xs font-bold text-amber-300 text-right focus:outline-none focus:border-amber-400"
              />
              <span className="text-[11px] text-slate-400 font-medium">K</span>
            </div>
          </div>

          {/* Quick Hunt Switcher */}
          <div className="relative">
            <button
              onClick={() => setIsSwitchDropdownOpen(!isSwitchDropdownOpen)}
              className="flex items-center justify-between gap-2.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-xl border border-slate-700 text-xs sm:text-sm font-medium transition w-full sm:w-56"
            >
              <span className="truncate flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                Cambiar monstruo...
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>

            {isSwitchDropdownOpen && (
              <>
                {/* Backdrop to close on outside click */}
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

      {/* UNIFIED SECTION 1: MAP FRAGMENTS & RESOURCE ACQUISITION */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
        {/* Header with Title and Global Price Inputs */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-slate-950 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
              <img
                src={getItemIconUrl(hunt.resource.id)}
                alt={hunt.resource.name}
                className="w-8 h-8 object-contain"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-white">
                  1. Mapa & Adquisición de {hunt.resource.name}
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
                Compara el coste de armar fragmentos, comprar mapa entero o comprar directo en HDV (Cofre otorga +{chestSebuscalines} Sebuscalines = {formatKamas(sebuscalinesValue)} K).
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
                  value={priceDrafts[hunt.resource.id] !== undefined ? priceDrafts[hunt.resource.id] : (resourcePrice > 0 ? resourcePrice : "")}
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

        {/* Content: Fragments Grid (Left) & 3-Way Acquisition Comparison (Right) */}
        {(() => {
          const costMapNet = Math.max(0, wholeMapPrice - sebuscalinesValue);
          const costFragsNet = Math.max(0, fragmentsTotalCost - sebuscalinesValue);
          const costDirect = resourcePrice;
          const minAcqCost = Math.min(costMapNet, costFragsNet, costDirect);

          const savingsMap = resourcePrice - costMapNet;
          const savingsFrags = resourcePrice - costFragsNet;

          return (
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
                  <span className="text-slate-400">Suma total de {hunt.fragments.count} fragmentos:</span>
                  <span className="font-mono font-bold text-amber-300">
                    {formatKamas(fragmentsTotalCost)} Kamas
                  </span>
                </div>
              </div>

              {/* Right Column: 3-Way Acquisition Matrix */}
              <div className="lg:col-span-5 space-y-2.5">
                {/* 3 Acquisition Option Cards */}
                <div className="space-y-2">
                  {/* Option 1: Map */}
                  <div className={`p-3 rounded-xl border flex items-center justify-between transition ${
                    minAcqCost === costMapNet
                      ? "bg-emerald-950/30 border-emerald-500/50 ring-1 ring-emerald-500/30"
                      : "bg-slate-800/40 border-slate-700/70"
                  }`}>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <MapIcon className="w-4 h-4 text-amber-400" />
                        <span className="text-xs sm:text-sm font-bold text-slate-200">1. Cazar con Mapa</span>
                        {minAcqCost === costMapNet && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500 text-slate-950">
                            MEJOR
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {formatKamas(wholeMapPrice)} K - {formatKamas(sebuscalinesValue)} K cofre
                      </span>
                    </div>

                    <div className="text-right">
                      <div className="text-sm sm:text-base font-black font-mono text-white">
                        {formatKamas(costMapNet)} K
                      </div>
                      <span className={`text-xs font-mono font-bold ${savingsMap >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {savingsMap >= 0 ? `+${formatKamas(savingsMap)}` : `-${formatKamas(Math.abs(savingsMap))}`} K vs HDV
                      </span>
                    </div>
                  </div>

                  {/* Option 2: Fragments */}
                  <div className={`p-3 rounded-xl border flex items-center justify-between transition ${
                    minAcqCost === costFragsNet
                      ? "bg-emerald-950/30 border-emerald-500/50 ring-1 ring-emerald-500/30"
                      : "bg-slate-800/40 border-slate-700/70"
                  }`}>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-indigo-400" />
                        <span className="text-xs sm:text-sm font-bold text-slate-200">2. Cazar con Fragmentos</span>
                        {minAcqCost === costFragsNet && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500 text-slate-950">
                            MEJOR
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {formatKamas(fragmentsTotalCost)} K - {formatKamas(sebuscalinesValue)} K cofre
                      </span>
                    </div>

                    <div className="text-right">
                      <div className="text-sm sm:text-base font-black font-mono text-white">
                        {formatKamas(costFragsNet)} K
                      </div>
                      <span className={`text-xs font-mono font-bold ${savingsFrags >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {savingsFrags >= 0 ? `+${formatKamas(savingsFrags)}` : `-${formatKamas(Math.abs(savingsFrags))}`} K vs HDV
                      </span>
                    </div>
                  </div>

                  {/* Option 3: Buy Resource Direct */}
                  <div className={`p-3 rounded-xl border flex items-center justify-between transition ${
                    minAcqCost === costDirect
                      ? "bg-emerald-950/30 border-emerald-500/50 ring-1 ring-emerald-500/30"
                      : "bg-slate-800/40 border-slate-700/70"
                  }`}>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <Award className="w-4 h-4 text-cyan-400" />
                        <span className="text-xs sm:text-sm font-bold text-slate-200">3. Comprar en HDV</span>
                        {minAcqCost === costDirect && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500 text-slate-950">
                            MEJOR
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400">
                        Compra directa sin cacería
                      </span>
                    </div>

                    <div className="text-right">
                      <div className="text-sm sm:text-base font-black font-mono text-white">
                        {formatKamas(costDirect)} K
                      </div>
                      <span className="text-xs font-mono text-slate-400">
                        Precio base HDV
                      </span>
                    </div>
                  </div>
                </div>

                {/* Acquisition Verdict */}
                <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-2.5 text-xs sm:text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                  <div className="truncate">
                    {minAcqCost === costFragsNet && costFragsNet < costDirect ? (
                      <span className="text-emerald-400 font-semibold">
                        ¡Conviene cazar con fragmentos! (Ahorras {formatKamas(costDirect - costFragsNet)} K)
                      </span>
                    ) : minAcqCost === costMapNet && costMapNet < costDirect ? (
                      <span className="text-emerald-400 font-semibold">
                        ¡Conviene cazar con mapa entero! (Ahorras {formatKamas(costDirect - costMapNet)} K)
                      </span>
                    ) : (
                      <span className="text-slate-300 font-medium">
                        Conviene comprar el recurso directo en HDV.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* SECTION 2: RELATED EQUIPMENT CRAFTING */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <h2 className="text-base sm:text-lg font-bold text-white">
              2. Equipables Relacionados & Rentabilidad de Crafteo
            </h2>
          </div>

          <div className="text-xs text-slate-400 bg-slate-800 px-3 py-1 rounded-lg border border-slate-700 self-start sm:self-center font-medium">
            {relatedEquipment.length} equipable(s)
          </div>
        </div>

        {/* Equipment List */}
        <div className="space-y-3">
          {relatedEquipment.map((eq) => {
            const salePrice = getPrice(eq.id, eq.defaultSalePrice);
            const isExpanded = expandedEquipmentIds[eq.id] ?? true;

            // Calculate other ingredients cost (excluding ByC boss resource)
            const otherIngredients = eq.recipeIngredients.filter((ing) => ing.id !== hunt.resource.id);
            const otherIngredientsCost = otherIngredients.reduce((acc, ing) => {
              const ingPrice = getPrice(ing.id, ing.defaultPrice);
              return acc + ingPrice * ing.quantity;
            }, 0);

            const resourceQtyNeeded = eq.resourceQuantityNeeded || 1;

            // Triple Crafting Methods:
            // Method 1: Buy Whole Map and Hunt
            const craftCost_FullMap = otherIngredientsCost + (wholeMapPrice * resourceQtyNeeded) - (bonusCurrenciesValue * resourceQtyNeeded);
            // Method 2: Buy Fragments and Hunt
            const craftCost_Fragments = otherIngredientsCost + (fragmentsTotalCost * resourceQtyNeeded) - (bonusCurrenciesValue * resourceQtyNeeded);
            // Method 3: Buy Resource Directly in HDV
            const craftCost_DirectResource = otherIngredientsCost + (resourcePrice * resourceQtyNeeded);

            // Calculate optimal ByC unit cost among the 3 options
            const unitCost_FullMap = Math.max(0, wholeMapPrice - bonusCurrenciesValue);
            const unitCost_Fragments = Math.max(0, fragmentsTotalCost - bonusCurrenciesValue);
            const unitCost_Direct = resourcePrice;

            const minUnitBycCost = Math.min(unitCost_FullMap, unitCost_Fragments, unitCost_Direct);

            // Best craft method label
            let bestMethodLabel = "";
            let bestMethodFullDesc = "";
            if (minUnitBycCost === unitCost_Fragments) {
              bestMethodLabel = "Fragmentos";
              bestMethodFullDesc = "Cazando con Fragmentos";
            } else if (minUnitBycCost === unitCost_FullMap) {
              bestMethodLabel = "Mapa Entero";
              bestMethodFullDesc = "Cazando con Mapa Entero";
            } else {
              bestMethodLabel = "Compra HDV";
              bestMethodFullDesc = "Comprando en HDV";
            }

            const minCraftCost = otherIngredientsCost + (minUnitBycCost * resourceQtyNeeded);
            const maxProfit = salePrice - minCraftCost;
            const maxRoi = minCraftCost > 0 ? (maxProfit / minCraftCost) * 100 : 0;

            return (
              <div
                key={eq.id}
                className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-3.5 sm:p-4 shadow-md space-y-3 transition hover:border-slate-600"
              >
                {/* Equipment Header Row */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0 shadow-md">
                      <img
                        src={getItemIconUrl(eq.id)}
                        alt={eq.name}
                        className="w-10 h-10 object-contain"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          {eq.type}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-700 text-slate-300">
                          Nv. {eq.level}
                        </span>
                        <h3 className="text-sm sm:text-base font-bold text-white">{eq.name}</h3>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Requiere {resourceQtyNeeded}x <span className="text-amber-300 font-semibold">{hunt.resource.name}</span> (adquirido mediante <span className="text-emerald-400 font-bold">{bestMethodFullDesc}</span>)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    {/* Market Sale Price Box */}
                    <div className="bg-slate-900/90 border border-slate-700 rounded-lg px-3 py-1.5 flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400 uppercase">Venta HDV:</span>
                      <div className="flex items-center gap-1 bg-slate-950 border border-slate-700 rounded px-2 py-0.5 focus-within:border-amber-400">
                        <input
                          type="number"
                          min="0"
                          value={priceDrafts[eq.id] !== undefined ? priceDrafts[eq.id] : (salePrice > 0 ? salePrice : "")}
                          onChange={(e) => handlePriceDraftChange(eq.id, e.target.value)}
                          onBlur={(e) => handlePriceCommit(eq.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handlePriceCommit(eq.id, (e.target as HTMLInputElement).value);
                          }}
                          placeholder="0"
                          className="w-24 bg-transparent text-right font-mono font-bold text-amber-300 text-xs sm:text-sm focus:outline-none"
                        />
                        <span className="text-xs text-slate-400 font-mono">K</span>
                      </div>
                    </div>

                    {/* Crafting Cost with Optimal Method */}
                    <div className="bg-slate-900/70 border border-slate-700/80 rounded-lg px-3 py-1.5 flex flex-col">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Coste Crafteo ({bestMethodLabel})</span>
                      <span className="text-xs sm:text-sm font-mono font-bold text-slate-200">
                        {formatKamas(minCraftCost)} K
                      </span>
                    </div>

                    {/* Best Profit Badge */}
                    <div className={`rounded-lg px-3 py-1.5 flex flex-col border ${
                      maxProfit >= 0
                        ? "bg-emerald-950/40 border-emerald-500/40"
                        : "bg-rose-950/40 border-rose-500/40"
                    }`}>
                      <span className={`text-[10px] font-bold uppercase ${
                        maxProfit >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}>
                        {maxProfit >= 0 ? "Margen Beneficio" : "Margen Pérdida"}
                      </span>
                      <span className={`text-xs sm:text-sm font-black font-mono ${
                        maxProfit >= 0 ? "text-emerald-300" : "text-rose-400"
                      }`}>
                        {maxProfit >= 0 ? `+${formatKamas(maxProfit)}` : `-${formatKamas(Math.abs(maxProfit))}`} K{" "}
                        <span className="text-[11px] font-medium">({maxRoi >= 0 ? `+${maxRoi.toFixed(0)}%` : `${maxRoi.toFixed(0)}%`})</span>
                      </span>
                    </div>

                    <button
                      onClick={() => toggleEquipmentExpand(eq.id)}
                      className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition border border-slate-700"
                      title={isExpanded ? "Ocultar ingredientes" : "Ver ingredientes"}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Collapsible Ingredients Breakdown */}
                {isExpanded && (
                  <div className="pt-2.5 border-t border-slate-700/60 space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-400 flex-wrap gap-1">
                      <span className="font-bold uppercase tracking-wider text-slate-300">
                        Ingredientes de la Receta
                      </span>
                      <span className="text-[11px]">
                        Otros ingredientes: <strong className="text-slate-300 font-mono">{formatKamas(otherIngredientsCost)} K</strong> + ByC ({bestMethodLabel} x{resourceQtyNeeded}): <strong className="text-amber-300 font-mono">{formatKamas(minUnitBycCost * resourceQtyNeeded)} K</strong>
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {eq.recipeIngredients.map((ing) => {
                        const isBycResource = ing.id === hunt.resource.id;
                        const ingPrice = isBycResource ? minUnitBycCost : getPrice(ing.id, ing.defaultPrice);
                        const inBank = getBankQty(ing.id);

                        return (
                          <div
                            key={ing.id}
                            className={`flex items-center justify-between p-2.5 rounded-xl border text-xs ${
                              isBycResource
                                ? "bg-emerald-950/20 border-emerald-500/50 ring-1 ring-emerald-500/20"
                                : inBank >= ing.quantity
                                ? "bg-emerald-950/15 border-emerald-600/30"
                                : "bg-slate-900/60 border-slate-800"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                                <img
                                  src={getItemIconUrl(ing.id)}
                                  alt={ing.name}
                                  className="w-6 h-6 object-contain"
                                  referrerPolicy="no-referrer"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = "none";
                                  }}
                                />
                              </div>
                              <div className="min-w-0">
                                <div className="font-semibold text-slate-200 truncate flex items-center gap-1">
                                  <span>{ing.quantity}x {ing.name}</span>
                                  {isBycResource && (
                                    <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-emerald-500/30 text-emerald-300 border border-emerald-500/40">
                                      AUTO ({bestMethodLabel})
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                                  {isBycResource ? (
                                    <span className="text-emerald-400 font-mono font-medium">
                                      {formatKamas(minUnitBycCost)} K/u (Óptimo)
                                    </span>
                                  ) : (
                                    <span>{formatKamas(ingPrice)} K/u</span>
                                  )}
                                  {inBank > 0 && (
                                    <span className="text-emerald-400 font-bold">
                                      ({inBank} banco)
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0 ml-2">
                              {isBycResource ? (
                                <div className="px-2 py-1 bg-emerald-950/40 border border-emerald-500/40 rounded-lg text-right">
                                  <span className="font-bold text-emerald-300 text-xs font-mono">
                                    = {formatKamas(minUnitBycCost * ing.quantity)} K
                                  </span>
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-center gap-0.5 bg-slate-900 border border-slate-700/80 rounded-md px-1.5 py-0.5 focus-within:border-amber-400">
                                    <input
                                      type="number"
                                      min="0"
                                      value={priceDrafts[ing.id] !== undefined ? priceDrafts[ing.id] : (ingPrice > 0 ? ingPrice : "")}
                                      onChange={(e) => handlePriceDraftChange(ing.id, e.target.value)}
                                      onBlur={(e) => handlePriceCommit(ing.id, e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") handlePriceCommit(ing.id, (e.target as HTMLInputElement).value);
                                      }}
                                      placeholder="0"
                                      className="w-16 bg-transparent text-right font-mono font-bold text-amber-300 text-xs focus:outline-none"
                                    />
                                    <span className="text-[10px] text-slate-400 font-mono">K</span>
                                  </div>
                                  <span className="font-bold text-slate-300 text-xs font-mono min-w-[55px] text-right">
                                    = {formatKamas(ingPrice * ing.quantity)} K
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
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

