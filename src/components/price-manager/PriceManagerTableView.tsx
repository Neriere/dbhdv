import React from 'react';
import {
  Check,
  Copy,
  Clock,
  FlaskConical,
  Hammer,
  Package,
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
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

interface PriceManagerTableViewProps {
  paginatedItems: DofusItem[];
  marketPrices: MarketPriceMap;
  priceDrafts: Record<number, string>;
  priceUpdatedAt: Record<number, number>;
  savedFeedbackItemId: number | null;
  recipeIngredientIds: Set<number>;
  craftableItemIds: Set<number>;
  salesVolumes: SalesVolumeMap;
  addedCartItemIds: Record<number, boolean>;
  copiedItemId: number | null;
  priceChanges: Record<number, PriceChangeInfo>;
  onPriceDraftChange: (itemId: number, value: string) => void;
  onPriceUpdate: (itemId: number, rawValue: string) => void;
  onCopyItemName: (item: DofusItem) => void;
  onAddToShoppingList: (item: DofusItem, quantity?: number) => void;
  onOpenItemHistory: (item: DofusItem) => void;
  onOpenSalesVolume: (item: DofusItem) => void;
  onSelectItemForRecipe?: (item: DofusItem) => void;
}

export const PriceManagerTableView: React.FC<PriceManagerTableViewProps> = ({
  paginatedItems,
  marketPrices,
  priceDrafts,
  priceUpdatedAt,
  savedFeedbackItemId,
  recipeIngredientIds,
  craftableItemIds,
  salesVolumes,
  addedCartItemIds,
  copiedItemId,
  priceChanges,
  onPriceDraftChange,
  onPriceUpdate,
  onCopyItemName,
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
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-950/90 text-slate-400 font-mono border-b border-slate-800 text-[11px] uppercase tracking-wider sticky top-0 z-10 backdrop-blur-md">
            <tr>
              <th className="py-3.5 px-4 min-w-[280px] font-bold">Recurso / Objeto</th>
              <th className="py-3.5 px-4 min-w-[180px] font-bold">Precio HDV (Kamas)</th>
              <th className="py-3.5 px-4 min-w-[150px] text-center font-bold">Variación</th>
              <th className="py-3.5 px-4 min-w-[150px] font-bold">Actualizado</th>
              <th className="py-3.5 px-4 min-w-[150px] text-center font-bold">Lista de Compra</th>
              <th className="py-3.5 px-4 min-w-[130px] text-center font-bold">Historial</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-sans text-xs">
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
              const isCopied = copiedItemId === item.id;
              const change = priceChanges[item.id];

              return (
                <tr
                  key={item.id}
                  className={`hover:bg-slate-800/40 transition-colors group ${
                    currentPrice > 0 ? 'bg-slate-900/30' : ''
                  }`}
                >
                  {/* 1. Recurso / Objeto */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 p-1 shrink-0 flex items-center justify-center relative shadow-inner group-hover:border-amber-500/40 transition-colors">
                        {BASE_RUNES_BY_ID[item.id] ? (
                          <RuneIcon rune={BASE_RUNES_BY_ID[item.id]} size="md" />
                        ) : (
                          <img
                            src={getItemIconUrl(item)}
                            alt={getItemName(item)}
                            className="w-8 h-8 object-contain"
                            onError={(e) => {
                              const target = e.currentTarget;
                              const fallback = getItemFallbackIconUrl(item);
                              if (target.src !== fallback) target.src = fallback;
                            }}
                          />
                        )}
                        {item.level && !BASE_RUNES_BY_ID[item.id] && (
                          <span className="absolute -bottom-1 -right-1 px-1 py-0.2 bg-slate-900 border border-slate-700 text-[9px] font-mono text-amber-400 rounded font-bold shadow">
                            {item.level}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-white text-sm group-hover:text-amber-300 transition-colors truncate">
                            {getItemName(item)}
                          </span>
                          <button
                            type="button"
                            onClick={() => onCopyItemName(item)}
                            className="p-1 rounded hover:bg-amber-500/20 text-slate-500 hover:text-amber-300 transition-colors cursor-pointer shrink-0"
                            title="Copiar nombre para buscar en Dofus (Ctrl+V)"
                          >
                            {isCopied ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5 text-xs text-slate-400 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-slate-300 font-semibold text-[11px]">
                            {typeName}
                          </span>
                          {isUsedInCrafting && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold text-[10px] flex items-center gap-1">
                              <FlaskConical className="w-2.5 h-2.5" />
                              Ingrediente
                            </span>
                          )}
                          {hasCraftRecipe ? (
                            <span className="px-2 py-0.5 rounded-md bg-violet-500/15 border border-violet-500/30 text-violet-300 font-bold text-[10px] flex items-center gap-1">
                              <Hammer className="w-2.5 h-2.5" />
                              Crafteable
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-teal-500/10 border border-teal-500/20 text-teal-400 font-bold text-[10px] flex items-center gap-1">
                              <Package className="w-2.5 h-2.5" />
                              Recurso
                            </span>
                          )}
                          {hasSalesData ? (
                            <button
                              onClick={() => onOpenSalesVolume(item)}
                              className="px-2 py-0.5 rounded-md bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/25 text-[10px] font-mono text-cyan-300 font-bold transition-colors cursor-pointer flex items-center gap-1"
                              title="Ventas registradas: 24h, 7d, 30d (Clic para editar)"
                            >
                              <Activity className="w-2.5 h-2.5" />
                              <span>{vol.sales24h ?? 0}/24h</span>
                              <span className="opacity-60">·</span>
                              <span>{vol.sales7d ?? 0}/7d</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => onOpenSalesVolume(item)}
                              className="px-1.5 py-0.5 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-[10px] text-slate-500 hover:text-cyan-400 font-mono transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                              title="Registrar ventas (24h/7d/30d)"
                            >
                              + Ventas
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* 2. Precio HDV */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="relative w-32 sm:w-36">
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
                          placeholder="0"
                          title={formatUpdatedAtLabel(item.id)}
                          className="w-full pl-3 pr-7 py-1.5 bg-slate-950 border border-slate-700/80 focus:border-amber-400 rounded-xl text-xs font-mono font-black text-amber-300 placeholder-slate-600 focus:outline-none transition-colors shadow-inner"
                        />
                        <span className="absolute right-2.5 top-2 text-xs text-slate-500 font-bold font-mono pointer-events-none">
                          K
                        </span>
                      </div>

                      {isSaved && (
                        <span className="px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 text-[11px] font-bold flex items-center gap-1 border border-emerald-500/30 shrink-0">
                          <Check className="w-3 h-3 text-emerald-400" />
                        </span>
                      )}
                    </div>
                  </td>

                  {/* 3. Variación */}
                  <td className="py-3 px-4 text-center font-mono">
                    {(() => {
                      if (change && change.difference > 0) {
                        return (
                          <div
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-bold"
                            title={`Precio anterior: ${change.oldPrice.toLocaleString()} K -> Actual: ${change.price.toLocaleString()} K`}
                          >
                            <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <div className="text-left leading-tight">
                              <div>+{change.difference.toLocaleString()} K</div>
                              <div className="text-[10px] text-emerald-500/80">
                                +{change.percentageChange > 0 ? change.percentageChange.toFixed(1) : '0'}%
                              </div>
                            </div>
                          </div>
                        );
                      }
                      if (change && change.difference < 0) {
                        return (
                          <div
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs font-bold"
                            title={`Precio anterior: ${change.oldPrice.toLocaleString()} K -> Actual: ${change.price.toLocaleString()} K`}
                          >
                            <TrendingDown className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                            <div className="text-left leading-tight">
                              <div>{change.difference.toLocaleString()} K</div>
                              <div className="text-[10px] text-rose-500/80">
                                {change.percentageChange.toFixed(1)}%
                              </div>
                            </div>
                          </div>
                        );
                      }
                      if (change && change.difference === 0) {
                        return (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono text-slate-500 bg-slate-950/60 border border-slate-800">
                            <Minus className="w-3 h-3 text-slate-600" /> Sin cambio
                          </span>
                        );
                      }
                      return (
                        <span className="text-slate-600 text-[11px] font-mono">
                          -
                        </span>
                      );
                    })()}
                  </td>

                  {/* 4. Actualizado */}
                  <td className="py-3 px-4">
                    <div
                      className="flex items-center gap-1.5 text-slate-400 text-xs"
                      title={formatUpdatedAtLabel(item.id)}
                    >
                      <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="font-mono text-[11px] text-slate-300">
                        {priceUpdatedAt[item.id]
                          ? formatRelativeTime(priceUpdatedAt[item.id])
                          : 'Sin registro'}
                      </span>
                    </div>
                  </td>

                  {/* 5. Lista de Compra */}
                  <td className="py-3 px-4 text-center">
                    <button
                      type="button"
                      onClick={() => onAddToShoppingList(item, 1)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-sm ${
                        isAddedCart
                          ? 'bg-emerald-500/25 border-emerald-500/50 text-emerald-300 ring-1 ring-emerald-400/40 font-black'
                          : 'bg-slate-950 hover:bg-emerald-500/20 border-slate-800 hover:border-emerald-500/40 text-slate-300 hover:text-emerald-300'
                      }`}
                      title="Añadir 1 unidad a la lista de compras"
                    >
                      {isAddedCart ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>¡Añadido!</span>
                        </>
                      ) : (
                        <>
                          <ShoppingCart className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Añadir</span>
                        </>
                      )}
                    </button>
                  </td>

                  {/* 6. Historial & Recetas */}
                  <td className="py-3 px-4 text-center">
                    <div className="inline-flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => onOpenItemHistory(item)}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-950 hover:bg-amber-500/20 border border-slate-800 hover:border-amber-500/40 text-slate-300 hover:text-amber-300 transition-all font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
                        title="Ver historial detallado de precios"
                      >
                        <History className="w-3.5 h-3.5 text-amber-400" />
                        <span>Historial</span>
                      </button>

                      {onSelectItemForRecipe && (
                        <button
                          onClick={() => onSelectItemForRecipe(item)}
                          className="p-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-amber-300 transition-all cursor-pointer shadow-sm"
                          title="Ver o calcular recetas con este objeto"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
