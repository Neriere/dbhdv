import React from 'react';
import {
  Wrench,
  Coins,
  AlertTriangle,
  Activity,
  Sparkles,
  Clock,
  History,
  ChevronRight,
} from 'lucide-react';
import { DofusItem } from '../../types';
import { PresetCraftableItem } from '../../data/presetCraftableItems';
import {
  getItemIconUrl,
  getItemFallbackIconUrl,
  getItemName,
  formatRelativeTime,
} from '../../services/dofusDbService';
import { ItemMetrics, getJobBadgeStyle } from './types';

interface RecipeCatalogCardProps {
  item: PresetCraftableItem;
  metrics: ItemMetrics;
  priceUpdatedAt?: number;
  onSelectItem: (item: PresetCraftableItem) => void;
  onOpenHistory: (item: DofusItem) => void;
  onQuickQuote: (item: PresetCraftableItem) => void;
}

export const RecipeCatalogCard: React.FC<RecipeCatalogCardProps> = ({
  item,
  metrics,
  priceUpdatedAt,
  onSelectItem,
  onOpenHistory,
  onQuickQuote,
}) => {
  const iconUrl = getItemIconUrl(item);
  const itemName = getItemName(item);
  const jobBadgeClass = getJobBadgeStyle(item.jobNameEs);

  return (
    <div
      onClick={() => onSelectItem(item)}
      className="bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-amber-500/50 rounded-2xl p-4 transition-all duration-200 cursor-pointer shadow-md hover:shadow-xl hover:shadow-amber-500/5 space-y-3 group relative flex flex-col justify-between"
    >
      <div className="space-y-3">
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
                    (e.target as HTMLElement).style.display = 'none';
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

              {/* Quotation status badge */}
              {metrics.salePrice > 0 ? (
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold font-mono flex items-center gap-1">
                  <Coins className="w-2.5 h-2.5 text-emerald-400" /> Cotizado
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-400 border border-slate-700/80 text-[10px] font-bold">
                  Sin Cotizar
                </span>
              )}

              {/* Incomplete ingredients warning */}
              {metrics.missingIngredientsCount > 0 && (
                <span
                  className="px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-bold flex items-center gap-1"
                  title={`${metrics.missingIngredientsCount} ingredientes con precio 0 K`}
                >
                  <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
                  {metrics.missingIngredientsCount} sin precio
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Market velocity and metrics badges */}
        {(metrics.avgDailySales > 0 ||
          metrics.expectedDailyFlow > 0 ||
          metrics.turnoverRating) && (
          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
            {metrics.avgDailySales > 0 && (
              <span
                className="px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-300 border border-sky-500/30 text-[10px] font-bold font-mono flex items-center gap-1"
                title="Ventas estimadas por día"
              >
                <Activity className="w-2.5 h-2.5 text-sky-400" />
                ~{metrics.avgDailySales} u/día
              </span>
            )}

            {metrics.expectedDailyFlow > 0 && (
              <span
                className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[10px] font-bold font-mono flex items-center gap-1"
                title="Flujo neto proyectado por día (Ganancia × Ventas/día)"
              >
                <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                ~{metrics.expectedDailyFlow.toLocaleString()} K/día
              </span>
            )}

            {metrics.turnoverLabel && (
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                  metrics.turnoverRating === 'alta'
                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
                    : metrics.turnoverRating === 'media'
                    ? 'bg-amber-950/60 text-amber-300 border-amber-500/40'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                {metrics.turnoverLabel}
              </span>
            )}
          </div>
        )}

        {/* Cost, Sale Price, Profit Grid */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 grid grid-cols-3 gap-2 text-center font-mono">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
              Costo
            </span>
            <span className="text-sm font-bold text-slate-200">
              {metrics.cost > 0 ? `${metrics.cost.toLocaleString()} K` : '---'}
            </span>
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
              Venta
            </span>
            <span className="text-sm font-bold text-amber-300">
              {metrics.salePrice > 0
                ? `${metrics.salePrice.toLocaleString()} K`
                : '---'}
            </span>
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
              Ganancia
            </span>
            <span
              className={`text-sm font-black block ${
                metrics.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {metrics.salePrice > 0
                ? `${metrics.netProfit >= 0 ? '+' : ''}${metrics.netProfit.toLocaleString()} K`
                : '---'}
            </span>
          </div>
        </div>
      </div>

      {/* Footer with ROI, Quick Quote Button, and View Recipe */}
      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-amber-400 font-bold">
        <div className="flex items-center gap-2">
          {metrics.roi > 0 && (
            <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-xs font-mono border border-emerald-500/30 font-bold">
              +{metrics.roi.toFixed(0)}% ROI
            </span>
          )}
          {priceUpdatedAt ? (
            <span className="text-[10px] text-slate-500 font-normal flex items-center gap-1">
              <Clock className="w-2.5 h-2.5 text-slate-500 shrink-0" />
              {formatRelativeTime(priceUpdatedAt)}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenHistory(item);
            }}
            className="p-1.5 rounded-lg bg-slate-950 hover:bg-amber-500/20 border border-slate-700 hover:border-amber-400/50 text-slate-400 hover:text-amber-300 transition-all cursor-pointer shadow-sm"
            title="Ver historial de precios de este objeto"
          >
            <History className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onQuickQuote(item);
            }}
            className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-amber-500 hover:text-slate-950 border border-slate-700 hover:border-amber-400 text-slate-300 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-sm"
            title="Cotizar precio de venta en mercadillo y volumen de ventas diario"
          >
            <Coins className="w-3 h-3 text-amber-400 group-hover:text-inherit" />
            <span>Cotizar</span>
          </button>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>
    </div>
  );
};
