import React, { useState } from "react";
import {
  Wrench,
  DollarSign,
  Zap,
  Sparkles,
  ShoppingCart,
  Check,
  History,
  Clock,
  BarChart2,
} from "lucide-react";
import { PresetCraftableItem } from "../../data/presetCraftableItems";
import {
  formatRelativeTime,
  getItemFallbackIconUrl,
  getItemIconUrl,
  getItemName,
  getItemTypeName,
  addToShoppingList,
} from "../../services/dofusDbService";
import { SafeImage } from "../SafeImage";
import {
  analyzeSalesVolume,
  getStoredSalesVolumeMap,
  saveItemSalesVolume,
} from "../../services/salesVolumeService";

interface RecipeSummaryCardProps {
  item: PresetCraftableItem;
  salePrice: number;
  salePriceDraft: string;
  onSalePriceDraftChange: (val: string) => void;
  onCommitSalePrice: (val: string) => void;
  priceUpdatedAt: Record<number, number>;
  autoOptimalCost: number;
  directCraftCost: number;
  onSelectForCrushing?: (item: PresetCraftableItem) => void;
  onOpenHistory?: (item: PresetCraftableItem) => void;
}

export const RecipeSummaryCard: React.FC<RecipeSummaryCardProps> = ({
  item,
  salePrice,
  salePriceDraft,
  onSalePriceDraftChange,
  onCommitSalePrice,
  priceUpdatedAt,
  autoOptimalCost,
  directCraftCost,
  onSelectForCrushing,
  onOpenHistory,
}) => {
  const [addedToListNotice, setAddedToListNotice] = useState(false);
  const [isVolumeDrawerOpen, setIsVolumeDrawerOpen] = useState(false);
  const [salesMap, setSalesMap] = useState(() => getStoredSalesVolumeMap());

  const activeSalesVolume = salesMap[item.id];
  const activeSalesAnalysis = analyzeSalesVolume(item.id, activeSalesVolume);

  const effectiveSalePrice = salePrice > 0 ? salePrice : 0;
  const activeSaleTax = effectiveSalePrice * 0.03;
  const netProfit = effectiveSalePrice > 0 ? effectiveSalePrice - activeSaleTax - autoOptimalCost : 0;
  const profitMarginPercent =
    autoOptimalCost > 0 && effectiveSalePrice > 0
      ? (netProfit / autoOptimalCost) * 100
      : 0;

  const handleUpdateVolume = (
    itemId: number,
    field: "sales24h" | "sales7d" | "sales30d",
    value: string
  ) => {
    const num = value === "" ? undefined : Math.max(0, parseInt(value, 10) || 0);
    const updated = saveItemSalesVolume(itemId, {
      ...(activeSalesVolume || { id: itemId }),
      [field]: num,
    });
    setSalesMap((prev) => ({ ...prev, [itemId]: updated }));
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 md:p-6 space-y-5 shadow-2xl">
      {/* Top Header Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-950 p-2 border border-slate-800 flex items-center justify-center shrink-0 shadow-lg">
            <SafeImage
              src={getItemIconUrl(item.id)}
              fallbackSrc={getItemFallbackIconUrl()}
              alt={getItemName(item)}
              className="w-full h-full object-contain"
            />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl md:text-2xl font-black text-white tracking-wide">
                {getItemName(item)}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 text-xs font-bold font-mono">
                Niv. {item.level}
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
                {item.jobNameEs}
              </span>
              {getItemTypeName(item) && (
                <span className="px-2 py-0.5 rounded-lg bg-sky-500/10 border border-sky-500/20 font-bold text-sky-400">
                  {getItemTypeName(item)}
                </span>
              )}
              {onSelectForCrushing && (
                <button
                  type="button"
                  onClick={() => onSelectForCrushing(item)}
                  className="px-2 py-0.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 font-bold text-amber-400 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5" />
                  Romper
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  addToShoppingList(item, 1);
                  setAddedToListNotice(true);
                  setTimeout(() => setAddedToListNotice(false), 2000);
                }}
                className="px-2.5 py-0.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 font-bold text-emerald-300 flex items-center gap-1 transition-colors cursor-pointer"
              >
                {addedToListNotice ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <ShoppingCart className="w-3.5 h-3.5" />}
                {addedToListNotice ? "¡Añadido!" : "Añadir al carrito"}
              </button>
            </div>
          </div>
        </div>

        {/* Sale Price Interactive Editor Box */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 text-right w-full md:w-auto shrink-0 shadow-inner space-y-1.5">
          <label className="block text-[11px] font-bold text-slate-400 flex items-center justify-end gap-1">
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            Precio Venta HDV
          </label>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsVolumeDrawerOpen((prev) => !prev)}
              className={`p-1.5 rounded-xl border transition-all shrink-0 cursor-pointer ${
                isVolumeDrawerOpen || activeSalesAnalysis.hasData
                  ? "bg-indigo-950/60 border-indigo-500/60 text-indigo-300"
                  : "bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200"
              }`}
              title="Registrar o ver volumen de ventas (24h, 7d, 30d)"
            >
              <BarChart2 className="w-3.5 h-3.5" />
            </button>
            {onOpenHistory && (
              <button
                type="button"
                onClick={() => onOpenHistory(item)}
                className="p-1.5 rounded-xl bg-slate-900 hover:bg-amber-500/20 border border-slate-700 hover:border-amber-500/40 text-slate-400 hover:text-amber-300 transition-all shrink-0 cursor-pointer"
                title="Ver historial de precios de este objeto"
              >
                <History className="w-3.5 h-3.5" />
              </button>
            )}
            <div className="relative">
              <input
                type="number"
                value={salePriceDraft}
                onChange={(e) => onSalePriceDraftChange(e.target.value)}
                onBlur={() => onCommitSalePrice(salePriceDraft)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onCommitSalePrice(salePriceDraft);
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
          </div>
          <div className="flex items-center justify-end gap-1 text-[10px] text-slate-500 font-medium pt-0.5">
            <Clock className="w-2.5 h-2.5 text-slate-500 shrink-0" />
            <span>
              {priceUpdatedAt[item.id]
                ? formatRelativeTime(priceUpdatedAt[item.id])
                : "Sin fecha de precio"}
            </span>
          </div>
        </div>
      </div>

      {/* Sales Volume Drawer (24h / 7d / 30d) */}
      {isVolumeDrawerOpen && (
        <div className="bg-slate-950/90 border border-indigo-500/30 rounded-xl p-3.5 sm:p-4 space-y-3 animate-fadeIn">
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
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-300">Últimas 24h</span>
                <span className="text-[11px] text-slate-500">Unidades vendidas</span>
              </div>
              <input
                type="number"
                min="0"
                value={activeSalesVolume?.sales24h !== undefined ? activeSalesVolume.sales24h : ""}
                onChange={(e) => handleUpdateVolume(item.id, "sales24h", e.target.value)}
                placeholder="—"
                className="w-16 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-right font-mono font-bold text-indigo-300 text-sm focus:outline-none focus:border-indigo-400"
              />
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-300">Últimos 7 días</span>
                <span className="text-[11px] text-slate-500">Total semana</span>
              </div>
              <input
                type="number"
                min="0"
                value={activeSalesVolume?.sales7d !== undefined ? activeSalesVolume.sales7d : ""}
                onChange={(e) => handleUpdateVolume(item.id, "sales7d", e.target.value)}
                placeholder="—"
                className="w-16 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-right font-mono font-bold text-indigo-300 text-sm focus:outline-none focus:border-indigo-400"
              />
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-300">Últimos 30 días</span>
                <span className="text-[11px] text-slate-500">Total mes</span>
              </div>
              <input
                type="number"
                min="0"
                value={activeSalesVolume?.sales30d !== undefined ? activeSalesVolume.sales30d : ""}
                onChange={(e) => handleUpdateVolume(item.id, "sales30d", e.target.value)}
                placeholder="—"
                className="w-16 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-right font-mono font-bold text-indigo-300 text-sm focus:outline-none focus:border-indigo-400"
              />
            </div>
          </div>

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
    </div>
  );
};
