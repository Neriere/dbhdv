import React from "react";
import {
  Copy,
  Check,
  ShieldCheck,
  Clock,
  ArrowUpRight,
  Zap,
  ShoppingCart,
  Wrench,
} from "lucide-react";
import { DOFUS_JOBS } from "../../data/dofusJobs";
import {
  getItemName,
  getItemIconUrl,
  getItemFallbackIconUrl,
} from "../../services/dofusDbService";
import { copyItemNameToClipboard } from "../../utils/clipboardUtils";
import { PriceFreshnessBadge } from "../common/PriceFreshnessBadge";
import { PresetCraftableItem } from "../../data/presetCraftableItems";
import { CalculatedRecipeRanking, JOB_ICON_MAP } from "./types";

interface ProfitRankingRowProps {
  entry: CalculatedRecipeRanking;
  rank: number;
  priceDraft: string | undefined;
  onPriceDraftChange: (itemId: number, val: string) => void;
  onPriceSave: (itemId: number, price: number) => void;
  priceUpdatedAt?: number | null;
  isSaved: boolean;
  isAddedCart: boolean;
  filterOutliers: boolean;
  onSelectRecipeForCalculator: (item: PresetCraftableItem) => void;
  onSelectForCrushing?: (item: PresetCraftableItem) => void;
  onAddToCart: (item: PresetCraftableItem) => void;
}

export const ProfitRankingRow: React.FC<ProfitRankingRowProps> = ({
  entry,
  rank,
  priceDraft,
  onPriceDraftChange,
  onPriceSave,
  priceUpdatedAt,
  isSaved,
  isAddedCart,
  filterOutliers,
  onSelectRecipeForCalculator,
  onSelectForCrushing,
  onAddToCart,
}) => {
  const item = entry.item;
  const itemName = getItemName(item);
  const iconUrl = getItemIconUrl(item);
  const fallbackIcon = getItemFallbackIconUrl(item);

  const JobIcon =
    JOB_ICON_MAP[
      DOFUS_JOBS.find((j) => j.id === item.jobId)?.icon || "Wrench"
    ] || Wrench;

  const handleCommitPrice = () => {
    if (priceDraft === undefined) return;
    if (priceDraft === "") {
      onPriceSave(item.id, 0);
    } else {
      const parsed = Number(priceDraft);
      if (!isNaN(parsed) && parsed >= 0) {
        onPriceSave(item.id, parsed);
      }
    }
  };

  return (
    <tr className="hover:bg-slate-800/40 transition-colors group">
      {/* Rank badge */}
      <td className="py-3.5 px-3 text-center font-mono font-bold">
        {rank === 1 && (
          <span className="w-7 h-7 mx-auto rounded-full bg-amber-500 text-slate-950 flex items-center justify-center font-black text-xs shadow-md">
            1
          </span>
        )}
        {rank === 2 && (
          <span className="w-7 h-7 mx-auto rounded-full bg-slate-300 text-slate-950 flex items-center justify-center font-black text-xs shadow-md">
            2
          </span>
        )}
        {rank === 3 && (
          <span className="w-7 h-7 mx-auto rounded-full bg-amber-700 text-white flex items-center justify-center font-black text-xs shadow-md">
            3
          </span>
        )}
        {rank > 3 && (
          <span className="text-slate-500 font-mono text-xs font-semibold">
            #{rank}
          </span>
        )}
      </td>

      {/* Item Info */}
      <td className="py-3.5 px-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-slate-950 border border-slate-800 p-1 flex items-center justify-center shrink-0 shadow-inner group-hover:border-amber-500/40 transition-colors">
            <img
              src={iconUrl}
              alt={itemName}
              className="w-9 h-9 object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = fallbackIcon;
              }}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-white text-sm group-hover:text-amber-400 transition-colors leading-snug">
                {itemName}
              </span>
              <button
                type="button"
                onClick={() => copyItemNameToClipboard(itemName)}
                className="p-1 rounded hover:bg-amber-500/20 text-slate-400 hover:text-amber-300 transition-colors cursor-pointer shrink-0"
                title="Copiar nombre para buscar en Dofus (Ctrl+V)"
              >
                <Copy className="w-3 h-3" />
              </button>
              <span className="text-[11px] font-mono font-bold text-amber-300 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/25 shrink-0">
                Niv. {item.level}
              </span>
            </div>
            <div className="text-xs font-medium text-slate-400 flex items-center gap-2 mt-1 flex-wrap">
              <div className="flex items-center gap-1 shrink-0">
                <JobIcon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>{entry.jobName}</span>
              </div>

              {/* Canal de Mercadillo */}
              {entry.marketCategory && (
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0 ${
                    entry.marketCategory === "equipment"
                      ? "bg-sky-500/10 text-sky-400 border-sky-500/25"
                      : entry.marketCategory === "consumables"
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
                      : "bg-amber-500/10 text-amber-400 border-amber-500/25"
                  }`}
                >
                  {entry.marketCategory === "equipment"
                    ? "HDV Equipos"
                    : entry.marketCategory === "consumables"
                    ? "HDV Consumibles"
                    : "HDV Recursos"}
                </span>
              )}

              {/* Indicador de Liquidez / Ventas */}
              {entry.hasSalesData && entry.avgDailySales > 0 ? (
                <span
                  className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border flex items-center gap-1 shrink-0 ${
                    entry.avgDailySales >= 2
                      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                      : entry.avgDailySales >= 0.5
                      ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                      : "bg-slate-800 text-slate-400 border-slate-700"
                  }`}
                  title={`Estimación: ~${entry.avgDailySales.toFixed(1)} ventas/día (24h: ${entry.sales24h || 0}, 7d: ${entry.sales7d || 0}, 30d: ${entry.sales30d || 0})`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      entry.avgDailySales >= 2
                        ? "bg-emerald-400 animate-pulse"
                        : entry.avgDailySales >= 0.5
                        ? "bg-amber-400"
                        : "bg-slate-400"
                    }`}
                  />
                  ~
                  {entry.avgDailySales < 1
                    ? entry.avgDailySales.toFixed(2)
                    : entry.avgDailySales.toFixed(1)}{" "}
                  uds/día
                </span>
              ) : (
                <span className="text-[10px] text-slate-500 font-mono shrink-0">
                  Sin ventas reg.
                </span>
              )}
            </div>
          </div>
        </div>
      </td>

      {/* Craft Cost */}
      <td className="py-3.5 px-4 text-right font-mono font-black text-sm text-slate-200">
        {entry.craftCost.toLocaleString()} K
      </td>

      {/* Sale Price (HDV) */}
      <td className="py-3.5 px-4 text-right font-mono">
        <div className="inline-flex items-center justify-end gap-1.5">
          <input
            type="number"
            value={
              priceDraft !== undefined
                ? priceDraft
                : entry.rawSalePrice > 0
                ? entry.rawSalePrice
                : ""
            }
            onChange={(e) => onPriceDraftChange(item.id, e.target.value)}
            onBlur={handleCommitPrice}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleCommitPrice();
              }
            }}
            placeholder="0"
            className="w-28 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-right font-mono text-xs font-bold text-amber-300 focus:border-amber-400 focus:outline-none transition-colors"
          />
          {isSaved && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
        </div>
        <div className="flex items-center justify-end gap-1.5 mt-1 flex-wrap">
          {entry.salePrice > 0 ? (
            <span
              className={
                entry.saleNetProfit >= 0
                  ? "text-emerald-400 font-bold text-xs"
                  : "text-rose-400 font-bold text-xs"
              }
            >
              {entry.saleNetProfit >= 0 ? "+" : ""}
              {entry.saleNetProfit.toLocaleString()} K
            </span>
          ) : (
            <span className="text-slate-600 font-mono text-xs">Sin precio HDV</span>
          )}
          <PriceFreshnessBadge updatedAt={priceUpdatedAt} compact />
        </div>

        {/* Payback or Antifraud Outlier Badges */}
        {(entry.isOutlierPrice || entry.paybackHours !== null) && (
          <div className="flex items-center justify-end gap-1 mt-1 flex-wrap text-[10px] font-mono">
            {entry.isOutlierPrice && (
              <span
                className={`px-1.5 py-0.5 rounded border flex items-center gap-1 ${
                  filterOutliers
                    ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                    : "bg-rose-500/15 text-rose-300 border-rose-500/30"
                }`}
                title={`Precio en HDV: ${entry.rawSalePrice.toLocaleString()} K. Mediana de referencia: ${entry.referenceMedian?.toLocaleString()} K (+${Math.round((entry.outlierRatio - 1) * 100)}%). ${filterOutliers ? "Se calculó la ganancia con la mediana segura." : "Precio inflado detectado."}`}
              >
                <ShieldCheck className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                {filterOutliers
                  ? "Mediana protegida"
                  : `+${Math.round((entry.outlierRatio - 1) * 100)}% s/mediana`}
              </span>
            )}
            {entry.paybackHours !== null && entry.saleNetProfit > 0 && (
              <span
                className="text-slate-400 bg-slate-950/80 px-1.5 py-0.5 rounded border border-slate-800 flex items-center gap-1"
                title={`Tiempo estimado de recuperación de capital: ~${entry.paybackHours} horas de ventas`}
              >
                <Clock className="w-2.5 h-2.5 text-sky-400 shrink-0" />
                {entry.paybackHours < 48
                  ? `~${entry.paybackHours}h retorno`
                  : `~${Math.round(entry.paybackDays!)}d retorno`}
              </span>
            )}
          </div>
        )}
      </td>

      {/* Runes Value */}
      <td className="py-3.5 px-4 text-right font-mono">
        {entry.canCrush ? (
          <>
            <span className="text-slate-200 font-bold text-sm block">
              {entry.runicEstimatedValue.toLocaleString()} K
            </span>
            <span
              className={
                entry.crushNetProfit >= 0
                  ? "text-purple-400 font-bold text-xs"
                  : "text-rose-400 font-bold text-xs"
              }
            >
              {entry.crushNetProfit >= 0 ? "+" : ""}
              {entry.crushNetProfit.toLocaleString()} K
            </span>
          </>
        ) : (
          <span className="text-slate-600 text-xs">No rompible</span>
        )}
      </td>

      {/* Best Net Profit */}
      <td className="py-3.5 px-4 text-center font-mono">
        <div
          className={`font-black text-sm sm:text-base ${
            entry.bestNetProfit > 0 ? "text-emerald-400" : "text-rose-400"
          }`}
        >
          {entry.bestNetProfit > 0 ? "+" : ""}
          {entry.bestNetProfit.toLocaleString()} K
        </div>
        {entry.bestStrategy !== "none" && (
          <span
            className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold border mt-1 ${
              entry.bestStrategy === "hdv"
                ? "bg-sky-500/20 text-sky-300 border-sky-500/40"
                : "bg-purple-500/20 text-purple-300 border-purple-500/40"
            }`}
          >
            {entry.bestStrategy === "hdv" ? "Venta HDV" : "Machacado"} (
            {entry.bestRoiPercent > 0 ? "+" : ""}
            {entry.bestRoiPercent.toFixed(0)}%)
          </span>
        )}
      </td>

      {/* Actions */}
      <td className="py-3.5 px-4 text-center">
        <div className="flex items-center justify-center gap-1.5">
          <button
            onClick={() => onSelectRecipeForCalculator(item)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-amber-500 hover:text-slate-950 border border-slate-800 text-slate-200 font-bold text-xs transition-all flex items-center gap-1 shadow-sm"
            title="Ver calculadora de crafteo"
          >
            <span>Crafteo</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>

          {entry.canCrush && onSelectForCrushing && (
            <button
              onClick={() => onSelectForCrushing(item)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-purple-500/20 border border-slate-800 hover:border-purple-500/40 text-purple-300 font-bold text-xs transition-all flex items-center gap-1 shadow-sm"
              title="Romper en la Rompedora"
            >
              <Zap className="w-3.5 h-3.5 text-purple-400" />
              <span>Romper</span>
            </button>
          )}

          <button
            onClick={() => onAddToCart(item)}
            className="p-1.5 rounded-lg bg-slate-950 hover:bg-emerald-500/20 border border-slate-800 hover:border-emerald-500/40 text-emerald-300 transition-all shadow-sm"
            title="Añadir ingredientes a lista de compras"
          >
            {isAddedCart ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <ShoppingCart className="w-4 h-4" />
            )}
          </button>
        </div>
      </td>
    </tr>
  );
};
