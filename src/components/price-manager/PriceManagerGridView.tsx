import React from 'react';
import {
  Check,
  Clock,
  FlaskConical,
  Hammer,
  Package,
  Activity,
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  History,
  ExternalLink,
} from 'lucide-react';
import {
  DofusItem,
  MarketPriceMap,
  SalesVolumeMap,
  PriceChangeInfo,
} from '../../types';
import {
  getItemName,
  getItemTypeName,
  getItemIconUrl,
  getItemFallbackIconUrl,
  formatRelativeTime,
} from '../../services/dofusDbService';
import { BASE_RUNES_BY_ID } from '../../data/dofusRuneWeights';
import { RuneIcon } from '../RuneIcon';

interface PriceManagerGridViewProps {
  paginatedItems: DofusItem[];
  marketPrices: MarketPriceMap;
  priceDrafts: Record<number, string>;
  priceUpdatedAt: Record<number, number>;
  savedFeedbackItemId: number | null;
  recipeIngredientIds: Set<number>;
  craftableItemIds: Set<number>;
  salesVolumes: SalesVolumeMap;
  addedCartItemIds: Record<number, boolean>;
  priceChanges: Record<number, PriceChangeInfo>;
  onPriceDraftChange: (itemId: number, value: string) => void;
  onPriceUpdate: (itemId: number, rawValue: string) => void;
  onAddToShoppingList: (item: DofusItem, quantity?: number) => void;
  onOpenItemHistory: (item: DofusItem) => void;
  onOpenSalesVolume: (item: DofusItem) => void;
  onSelectItemForRecipe?: (item: DofusItem) => void;
}

export const PriceManagerGridView: React.FC<PriceManagerGridViewProps> = ({
  paginatedItems,
  marketPrices,
  priceDrafts,
  priceUpdatedAt,
  savedFeedbackItemId,
  recipeIngredientIds,
  craftableItemIds,
  salesVolumes,
  addedCartItemIds,
  priceChanges,
  onPriceDraftChange,
  onPriceUpdate,
  onAddToShoppingList,
  onOpenItemHistory,
  onOpenSalesVolume,
  onSelectItemForRecipe,
}) => {
  const formatUpdatedAtLabel = (itemId: number) => {
    const updatedAt = priceUpdatedAt[itemId];
    return updatedAt ? `Actualizado: ${new Date(updatedAt).toLocaleString()}` : '';
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
      {paginatedItems.map((item) => {
        const currentPrice = Number(marketPrices[item.id]) || 0;
        const draftVal =
          priceDrafts[item.id] !== undefined
            ? priceDrafts[item.id]
            : currentPrice > 0
            ? String(currentPrice)
            : '';
        const isSaved = savedFeedbackItemId === item.id;
        const typeName = getItemTypeName(item);
        const isUsedInCrafting = recipeIngredientIds.has(item.id);
        const hasCraftRecipe = craftableItemIds.has(item.id);
        const vol = salesVolumes[item.id];
        const hasSalesData =
          vol &&
          ((vol.sales24h ?? 0) > 0 ||
            (vol.sales7d ?? 0) > 0 ||
            (vol.sales30d ?? 0) > 0);
        const isAddedCart = Boolean(addedCartItemIds[item.id]);
        const change = priceChanges[item.id];

        return (
          <div
            key={item.id}
            className={`bg-slate-900 border rounded-2xl p-3.5 transition-all flex flex-col justify-between gap-3 relative shadow-md ${
              currentPrice > 0
                ? 'border-amber-500/40 bg-gradient-to-b from-amber-950/20 to-slate-900'
                : 'border-slate-800 hover:border-slate-700'
            }`}
          >
            {/* Top Item Row */}
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-slate-950 border border-slate-800 p-1 shrink-0 flex items-center justify-center relative">
                {BASE_RUNES_BY_ID[item.id] ? (
                  <RuneIcon rune={BASE_RUNES_BY_ID[item.id]} size="md" />
                ) : (
                  <img
                    src={getItemIconUrl(item)}
                    alt={getItemName(item)}
                    className="max-w-full max-h-full object-contain"
                    onError={(e) => {
                      const target = e.currentTarget;
                      const fallback = getItemFallbackIconUrl(item);
                      if (target.src !== fallback) target.src = fallback;
                    }}
                  />
                )}
                {item.level && !BASE_RUNES_BY_ID[item.id] && (
                  <span className="absolute -bottom-1 -right-1 px-1.5 py-0.2 bg-slate-900 border border-slate-700 text-[10px] font-mono text-amber-400 rounded-md font-bold shadow">
                    Nv.{item.level}
                  </span>
                )}
              </div>

              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between gap-1.5">
                  <h4 className="text-sm sm:text-base font-black text-white truncate group-hover:text-amber-400 transition-colors">
                    {getItemName(item)}
                  </h4>
                  {currentPrice > 0 ? (
                    <span
                      className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold shrink-0 border border-amber-500/30"
                      title={formatUpdatedAtLabel(item.id)}
                    >
                      Fijado
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-slate-950 text-slate-500 font-mono text-[10px] font-bold shrink-0 border border-slate-800">
                      Sin precio
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-300 flex-wrap">
                  <span className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-slate-300 font-bold text-xs">
                    {typeName}
                  </span>
                  {isUsedInCrafting && (
                    <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold text-xs flex items-center gap-1">
                      <FlaskConical className="w-3 h-3" />
                      Ingrediente
                    </span>
                  )}
                  {hasCraftRecipe ? (
                    <span className="px-2 py-0.5 rounded-md bg-violet-500/15 border border-violet-500/30 text-violet-300 font-bold text-[10px] flex items-center gap-1">
                      <Hammer className="w-3 h-3" />
                      Crafteable
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md bg-teal-500/10 border border-teal-500/20 text-teal-400 font-bold text-[10px] flex items-center gap-1">
                      <Package className="w-3 h-3" />
                      Recurso
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Sales Volume & Price Change Row */}
            <div className="flex items-center justify-between gap-1.5 flex-wrap pt-1">
              <div
                onClick={() => onOpenSalesVolume(item)}
                className="group/vol flex items-center gap-1.5 flex-wrap cursor-pointer px-2 py-0.5 rounded-lg hover:bg-slate-900 border border-transparent hover:border-slate-800 transition-all text-xs"
                title="Haz clic para registrar o editar ventas en 24h, 7d y 30d"
              >
                {hasSalesData ? (
                  <>
                    <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-[10px] font-mono font-bold text-cyan-300">
                      24h: {vol.sales24h ?? 0}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-[10px] font-mono font-bold text-cyan-300">
                      7d: {vol.sales7d ?? 0}
                    </span>
                  </>
                ) : (
                  <span className="text-[10px] font-mono text-slate-500 group-hover/vol:text-cyan-400">
                    + Ventas (24h/7d)
                  </span>
                )}
              </div>

              {change && change.difference !== 0 && (
                <div
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                    change.difference > 0
                      ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-400'
                      : 'bg-rose-500/10 border border-rose-500/25 text-rose-400'
                  }`}
                  title={`Precio anterior: ${change.oldPrice.toLocaleString()} K -> Actual: ${change.price.toLocaleString()} K`}
                >
                  {change.difference > 0 ? (
                    <TrendingUp className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-rose-400" />
                  )}
                  <span>
                    {change.difference > 0
                      ? `+${change.difference.toLocaleString()}`
                      : change.difference.toLocaleString()}{' '}
                    K
                  </span>
                </div>
              )}
            </div>

            {/* Price Input Controls */}
            <div className="space-y-1.5 pt-2 border-t border-slate-800">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={draftVal}
                    onChange={(e) => onPriceDraftChange(item.id, e.target.value)}
                    onBlur={(e) => onPriceUpdate(item.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        onPriceUpdate(item.id, (e.target as HTMLInputElement).value);
                      }
                    }}
                    placeholder="Precio en Kamas..."
                    title={formatUpdatedAtLabel(item.id)}
                    className="w-full pl-3 pr-8 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm font-mono font-black text-amber-300 placeholder-slate-600 focus:outline-none focus:border-amber-400 transition-colors"
                  />
                  <span className="absolute right-3 top-2 text-xs text-slate-400 font-bold font-mono">
                    K
                  </span>
                </div>

                {/* Instant Save Feedback */}
                {isSaved && (
                  <span
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-bold flex items-center gap-1 border border-emerald-500/30 shrink-0"
                    title={formatUpdatedAtLabel(item.id)}
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-400" /> Guardado
                  </span>
                )}

                {/* Add to Shopping List Button */}
                <button
                  type="button"
                  onClick={() => onAddToShoppingList(item, 1)}
                  className={`p-2 rounded-xl border transition-all shrink-0 cursor-pointer ${
                    isAddedCart
                      ? 'bg-emerald-500/25 border-emerald-500/50 text-emerald-300'
                      : 'bg-slate-950 hover:bg-emerald-500/20 border-slate-800 hover:border-emerald-500/40 text-slate-400 hover:text-emerald-300'
                  }`}
                  title="Añadir a la lista de compras"
                >
                  {isAddedCart ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <ShoppingCart className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                </button>

                {/* Sales Volume Button */}
                <button
                  onClick={() => onOpenSalesVolume(item)}
                  className="p-2 rounded-xl bg-slate-950 hover:bg-sky-500/20 border border-slate-800 hover:border-sky-500/40 text-slate-400 hover:text-sky-300 transition-all shrink-0 cursor-pointer"
                  title="Registrar / editar volumen de ventas (24h, 7d, 30d)"
                >
                  <Activity className="w-3.5 h-3.5" />
                </button>

                {/* Price History Button */}
                <button
                  onClick={() => onOpenItemHistory(item)}
                  className="p-2 rounded-xl bg-slate-950 hover:bg-amber-500/20 border border-slate-800 hover:border-amber-500/40 text-slate-400 hover:text-amber-300 transition-all shrink-0 cursor-pointer"
                  title="Ver historial de cambios de este objeto"
                >
                  <History className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Footer Info: Relative Timestamp & Recipe Link */}
              <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                <span className="flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5 text-slate-500" />
                  {priceUpdatedAt[item.id]
                    ? formatRelativeTime(priceUpdatedAt[item.id])
                    : 'Sin cambios'}
                </span>

                {onSelectItemForRecipe && (
                  <button
                    onClick={() => onSelectItemForRecipe(item)}
                    className="text-amber-400 hover:text-amber-300 hover:underline flex items-center gap-1 font-bold cursor-pointer"
                    title="Calcular recetas con este objeto"
                  >
                    Ver Recetas <ExternalLink className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
