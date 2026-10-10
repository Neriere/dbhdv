import React from 'react';
import {
  Layers,
  FolderOpen,
  FolderClosed,
  PackageCheck,
  RotateCcw,
  Shield,
  Check,
  ChevronUp,
  ChevronDown,
  Tag,
  CheckCircle2,
  Trash2,
  Hammer,
  ShoppingCart,
  Wrench,
  Zap,
} from 'lucide-react';
import { DofusItem } from '../../types';
import {
  getItemIconUrl,
  getItemFallbackIconUrl,
} from '../../services/dofusDbService';
import { SafeImage } from '../SafeImage';
import { formatKamas } from '../../utils/kamaFormatters';
import {
  ProcessedDofusbookItem,
  DofusbookComputedData,
  DofusbookFilterStatus,
} from './types';

interface DofusbookComparisonTableProps {
  filteredItems: ProcessedDofusbookItem[];
  computedData: DofusbookComputedData;
  filterStatus: DofusbookFilterStatus;
  setFilterStatus: (st: DofusbookFilterStatus) => void;
  showOnlyCraftable: boolean;
  setShowOnlyCraftable: (val: boolean) => void;
  expandedItems: Record<string, boolean>;
  onToggleItemExpand: (key: string) => void;
  onExpandAllRecipes: () => void;
  onCollapseAllRecipes: () => void;
  editingPriceItemId: number | null;
  setEditingPriceItemId: (id: number | null) => void;
  tempPriceInput: string;
  setTempPriceInput: (val: string) => void;
  obtainedMaterialIds: Record<number, boolean>;
  onToggleMaterialObtained: (itemId: number) => void;
  onToggleItemOwned: (key: string) => void;
  onToggleItemRemoved: (key: string) => void;
  onRestoreItem: (key: string) => void;
  onRestoreAllRemoved: () => void;
  onSavePrice: (itemId: number, price: number) => void;
  onSelectRecipeForCalculator?: (item: DofusItem) => void;
  onSelectForCrushing?: (item: DofusItem) => void;
}

export const DofusbookComparisonTable: React.FC<DofusbookComparisonTableProps> = ({
  filteredItems,
  computedData,
  filterStatus,
  setFilterStatus,
  showOnlyCraftable,
  setShowOnlyCraftable,
  expandedItems,
  onToggleItemExpand,
  onExpandAllRecipes,
  onCollapseAllRecipes,
  editingPriceItemId,
  setEditingPriceItemId,
  tempPriceInput,
  setTempPriceInput,
  obtainedMaterialIds,
  onToggleMaterialObtained,
  onToggleItemOwned,
  onToggleItemRemoved,
  onRestoreItem,
  onRestoreAllRemoved,
  onSavePrice,
  onSelectRecipeForCalculator,
  onSelectForCrushing,
}) => {
  return (
    <div className="space-y-3">
      {/* Sub-Filters for Piezas */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="bg-slate-950 border border-slate-800 p-0.5 rounded-xl flex items-center text-xs">
          <button
            type="button"
            onClick={() => setFilterStatus('all')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
              filterStatus === 'all'
                ? 'bg-slate-800 text-white font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Todos ({computedData.activePiecesCount})
          </button>

          <button
            type="button"
            onClick={() => setFilterStatus('needed')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
              filterStatus === 'needed'
                ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30'
                : 'text-slate-400 hover:text-amber-400'
            }`}
          >
            <span>Pendientes</span>
            <span className="text-[10px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono">
              {computedData.neededCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterStatus('owned')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
              filterStatus === 'owned'
                ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30'
                : 'text-slate-400 hover:text-emerald-400'
            }`}
          >
            <span>Obtenidos</span>
            <span className="text-[10px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono">
              {computedData.ownedCount}
            </span>
          </button>

          {computedData.removedCount > 0 && (
            <button
              type="button"
              onClick={() => setFilterStatus('removed')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                filterStatus === 'removed'
                  ? 'bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30'
                  : 'text-slate-400 hover:text-rose-400'
              }`}
            >
              <span>Descartados</span>
              <span className="text-[10px] px-1 py-0.2 rounded bg-rose-500/20 text-rose-300 font-mono">
                {computedData.removedCount}
              </span>
            </button>
          )}
        </div>

        <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer ml-1">
          <input
            type="checkbox"
            checked={showOnlyCraftable}
            onChange={(e) => setShowOnlyCraftable(e.target.checked)}
            className="rounded bg-slate-950 border-slate-700 text-amber-500 focus:ring-0 cursor-pointer"
          />
          <span>Solo con receta</span>
        </label>
      </div>

      {/* Banner if items are removed */}
      {computedData.removedCount > 0 && filterStatus !== 'removed' && (
        <div className="bg-slate-950 border border-slate-800/80 px-4 py-2.5 rounded-xl flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Trash2 className="w-3.5 h-3.5 text-slate-500" />
            <span>
              Hay <strong>{computedData.removedCount} pieza(s)</strong> eliminadas/descartadas de la sección.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFilterStatus('removed')}
              className="text-amber-400 hover:underline font-semibold cursor-pointer"
            >
              Ver descartadas
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={onRestoreAllRemoved}
              className="text-slate-300 hover:text-white font-semibold flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Restaurar todas</span>
            </button>
          </div>
        </div>
      )}

      {/* Comparison Table Box */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {/* Quick Table Subheader Controls */}
        {filteredItems.some((it) => it.ingredientsBreakdown.length > 0) && (
          <div className="bg-slate-950/90 border-b border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="text-slate-400 flex items-center gap-1.5 font-medium">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span>Recetas de fabricación del set:</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onExpandAllRecipes}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 border border-slate-800 hover:border-amber-500/40 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Desplegar todas las listas de materiales de cada objeto"
              >
                <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                <span>Desplegar todas las recetas</span>
              </button>
              <button
                type="button"
                onClick={onCollapseAllRecipes}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Plegar todas las recetas"
              >
                <FolderClosed className="w-3.5 h-3.5" />
                <span>Plegar todas</span>
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider">
                <th className="py-3 px-3 sm:px-4">Ranura / Objeto</th>
                <th className="py-3 px-3 text-center">Nivel / Tipo</th>
                <th className="py-3 px-3 text-right">Coste Crafteo</th>
                <th className="py-3 px-3 text-right">Precio HDV</th>
                <th className="py-3 px-3 text-center">Estado / Veredicto</th>
                <th className="py-3 px-3 text-center">Ahorro</th>
                <th className="py-3 px-3 text-center">Gestión & Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 text-xs">
                    <div className="flex flex-col items-center justify-center gap-2 max-w-md mx-auto py-2">
                      <PackageCheck className="w-8 h-8 text-slate-600" />
                      <p className="font-semibold text-slate-300 text-sm">
                        {computedData.activePiecesCount === 0
                          ? 'Has eliminado o descartado todas las piezas de este set.'
                          : filterStatus === 'needed' && computedData.neededCount === 0
                          ? '¡Felicidades! Ya has obtenido todas las piezas activas del set.'
                          : 'No hay piezas que coincidan con el filtro seleccionado.'}
                      </p>
                      {computedData.removedCount > 0 && (
                        <button
                          type="button"
                          onClick={onRestoreAllRemoved}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 mt-2 cursor-pointer border border-slate-700"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Restaurar {computedData.removedCount} piezas descartadas</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredItems.map((it, idx) => {
                  const itemKey = it.key || `${it.slotName}-${it.id || idx}`;
                  const isExpanded = !!expandedItems[itemKey];
                  const isEditingPrice = editingPriceItemId === it.id;
                  const isOwned = it.isOwned;
                  const isRemoved = it.isRemoved;

                  return (
                    <React.Fragment key={itemKey}>
                      <tr
                        className={`transition-colors group ${
                          isOwned
                            ? 'bg-emerald-950/20 border-l-4 border-l-emerald-500 hover:bg-emerald-950/30'
                            : isRemoved
                            ? 'bg-rose-950/10 border-l-4 border-l-rose-500/50 opacity-60 hover:bg-rose-950/20'
                            : 'hover:bg-slate-800/40'
                        }`}
                      >
                        {/* Slot & Item Name */}
                        <td className="py-3 px-3 sm:px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 p-1 flex items-center justify-center shrink-0 shadow-inner relative">
                              {it.item ? (
                                <SafeImage
                                  src={getItemIconUrl(it.item)}
                                  fallbackSrc={getItemFallbackIconUrl(it.item)}
                                  alt={it.item.name?.es || it.rawName}
                                  className="w-8 h-8 object-contain"
                                />
                              ) : (
                                <Shield className="w-4 h-4 text-slate-500" />
                              )}

                              {isOwned && (
                                <div className="absolute -top-1 -right-1 bg-emerald-500 text-slate-950 rounded-full p-0.5 shadow">
                                  <Check className="w-3 h-3 stroke-[3]" />
                                </div>
                              )}
                            </div>

                            <div className="space-y-0.5 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-bold uppercase px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700/60">
                                  {it.slotName}
                                </span>
                                {it.isDofus && (
                                  <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                    DOFUS
                                  </span>
                                )}
                                {it.isTrophy && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                                    TROFEO
                                  </span>
                                )}
                              </div>
                              <div
                                className={`font-bold text-xs sm:text-sm transition-colors ${
                                  isOwned
                                    ? 'text-emerald-300'
                                    : isRemoved
                                    ? 'text-slate-400 line-through'
                                    : 'text-white group-hover:text-amber-300'
                                }`}
                              >
                                {it.item?.name?.es || it.rawName}
                              </div>
                              {it.item?.name?.fr && it.item.name.fr !== it.item.name.es && (
                                <div className="text-[11px] text-slate-500 font-normal truncate">
                                  FR: {it.item.name.fr}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Level / Type */}
                        <td className="py-3 px-3 text-center">
                          <div className="font-bold text-slate-200">
                            {it.item?.level ? `Nv. ${it.item.level}` : '-'}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate max-w-[110px] mx-auto">
                            {it.item?.type?.name?.es || '-'}
                          </div>
                        </td>

                        {/* Craft Cost */}
                        <td className="py-3 px-3 text-right font-mono">
                          {isOwned ? (
                            <div className="space-y-0.5">
                              <span className="text-slate-500 line-through text-xs block">
                                {formatKamas(it.craftCost)}
                              </span>
                              <span className="text-emerald-400 text-[11px] font-bold">0 K (Obtenido)</span>
                            </div>
                          ) : isRemoved ? (
                            <span className="text-slate-600 text-xs italic">Descartado</span>
                          ) : it.isCraftable && it.craftCost > 0 ? (
                            <div className="space-y-0.5">
                              <div className="font-black text-amber-300">
                                {formatKamas(it.craftCost)}
                              </div>
                              <button
                                type="button"
                                onClick={() => onToggleItemExpand(itemKey)}
                                className="text-[11px] text-slate-400 hover:text-amber-400 flex items-center gap-0.5 ml-auto font-sans font-semibold cursor-pointer"
                              >
                                <span>{it.ingredientsBreakdown.length} mats</span>
                                {isExpanded ? (
                                  <ChevronUp className="w-3 h-3" />
                                ) : (
                                  <ChevronDown className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          ) : it.isCraftable ? (
                            <span className="text-slate-500 text-xs italic">Faltan precios</span>
                          ) : (
                            <span className="text-slate-600 text-xs">Sin receta</span>
                          )}
                        </td>

                        {/* Market HDV Price (Editable) */}
                        <td className="py-3 px-3 text-right font-mono">
                          {isOwned ? (
                            <div className="space-y-0.5">
                              <span className="text-slate-500 line-through text-xs block">
                                {formatKamas(it.marketPrice)}
                              </span>
                              <span className="text-emerald-400 text-[11px] font-bold">0 K (Obtenido)</span>
                            </div>
                          ) : isRemoved ? (
                            <span className="text-slate-600 text-xs italic">Descartado</span>
                          ) : isEditingPrice ? (
                            <div className="flex items-center justify-end gap-1">
                              <input
                                type="number"
                                value={tempPriceInput}
                                onChange={(e) => setTempPriceInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    onSavePrice(it.id, Number(tempPriceInput) || 0);
                                  } else if (e.key === 'Escape') {
                                    setEditingPriceItemId(null);
                                  }
                                }}
                                autoFocus
                                className="w-24 px-1.5 py-0.5 bg-slate-950 border border-amber-500 text-right text-xs rounded text-amber-300 font-mono outline-none"
                              />
                              <button
                                onClick={() =>
                                  onSavePrice(it.id, Number(tempPriceInput) || 0)
                                }
                                className="p-1 bg-amber-500 text-slate-950 rounded hover:bg-amber-400 cursor-pointer"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <div
                              onClick={() => {
                                if (it.id > 0) {
                                  setEditingPriceItemId(it.id);
                                  setTempPriceInput(String(it.marketPrice || ''));
                                }
                              }}
                              className="group/price cursor-pointer"
                              title="Haz clic para modificar el precio de mercado"
                            >
                              {it.marketPrice > 0 ? (
                                <div className="font-bold text-slate-200 group-hover/price:text-amber-400 transition-colors flex items-center justify-end gap-1">
                                <span>{formatKamas(it.marketPrice)}</span>
                                <Tag className="w-2.5 h-2.5 opacity-0 group-hover/price:opacity-100 text-slate-500" />
                              </div>
                            ) : (
                              <span className="text-slate-500 text-xs italic group-hover/price:text-amber-400">
                                + Añadir precio
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Verdict / Status */}
                      <td className="py-3 px-3 text-center">
                        {isOwned ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-black text-xs shadow-sm">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            YA OBTENIDO
                          </span>
                        ) : isRemoved ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 font-bold text-xs">
                            <Trash2 className="w-3 h-3 text-rose-400" />
                            DESCARTADO
                          </span>
                        ) : it.cheaperOption === 'craft' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-black text-xs">
                            <Hammer className="w-3 h-3" />
                            Craftear
                          </span>
                        ) : it.cheaperOption === 'buy' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-300 font-black text-xs">
                            <ShoppingCart className="w-3 h-3" />
                            Comprar HDV
                          </span>
                        ) : it.cheaperOption === 'equal' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold text-xs">
                            Mismo precio
                          </span>
                        ) : it.cheaperOption === 'dofus_excluded' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-300/80 font-semibold text-xs">
                            Dofus (Excluido)
                          </span>
                        ) : (
                          <span className="text-slate-500 text-xs">Comprar</span>
                        )}
                      </td>

                      {/* Savings */}
                      <td className="py-3 px-3 text-center font-mono">
                        {isOwned || isRemoved ? (
                          <span className="text-slate-600 text-xs">-</span>
                        ) : it.savings > 0 ? (
                          <span className="text-emerald-400 font-black text-xs">
                            +{formatKamas(it.savings)}
                          </span>
                        ) : (
                          <span className="text-slate-600 text-xs">-</span>
                        )}
                      </td>

                      {/* Actions / Management Buttons */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onToggleItemOwned(itemKey)}
                            className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                              isOwned
                                ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-sm shadow-emerald-500/20'
                                : 'bg-slate-800 text-slate-300 hover:bg-emerald-500/20 hover:text-emerald-300 hover:border-emerald-500/30 border border-slate-700'
                            }`}
                            title={isOwned ? 'Marcar como pendiente (Clic para desmarcar)' : 'Marcar como ya obtenido (Coste 0 K)'}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span className="hidden xl:inline text-[11px]">
                              {isOwned ? 'Obtenido' : 'Tengo'}
                            </span>
                          </button>

                          {isRemoved ? (
                            <button
                              type="button"
                              onClick={() => onRestoreItem(itemKey)}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors border border-slate-700 cursor-pointer flex items-center gap-1 text-[11px]"
                              title="Restaurar objeto al cálculo del set"
                            >
                              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                              <span className="hidden xl:inline">Restaurar</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onToggleItemRemoved(itemKey)}
                              className="p-1.5 bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg transition-colors border border-slate-700 cursor-pointer"
                              title="Eliminar objeto de la consideración del costo del set"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {it.item && onSelectRecipeForCalculator && it.isCraftable && !isRemoved && (
                            <button
                              type="button"
                              onClick={() => onSelectRecipeForCalculator(it.item!)}
                              className="p-1.5 bg-slate-800 hover:bg-amber-500/20 text-slate-300 hover:text-amber-400 rounded-lg transition-colors border border-slate-700 cursor-pointer"
                              title="Abrir en Calculadora de Recetas"
                            >
                              <Wrench className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {it.item && onSelectForCrushing && !isRemoved && (
                            <button
                              type="button"
                              onClick={() => onSelectForCrushing(it.item!)}
                              className="p-1.5 bg-slate-800 hover:bg-sky-500/20 text-slate-300 hover:text-sky-400 rounded-lg transition-colors border border-slate-700 cursor-pointer"
                              title="Calcular brisage en Rompedora"
                            >
                              <Zap className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Expanded Ingredient Breakdown Row */}
                    {isExpanded && it.ingredientsBreakdown.length > 0 && !isRemoved && (
                      <tr className="bg-slate-950/60 border-b border-slate-800/80">
                        <td colSpan={7} className="py-3 px-4 sm:px-6">
                          <div className="space-y-2">
                            <div className="text-xs font-bold text-amber-400 flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <Hammer className="w-3.5 h-3.5" />
                                <span>Materiales para {it.item?.name?.es || it.rawName}:</span>
                              </div>
                              {isOwned && (
                                <span className="text-[11px] text-emerald-400 font-semibold">
                                  ✓ Objeto obtenido (no se requieren estos materiales)
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                              {it.ingredientsBreakdown.map((ing) => {
                                const isEditingThisIng = editingPriceItemId === ing.id;
                                const isIngObtained = !!obtainedMaterialIds[ing.id];

                                return (
                                  <div
                                    key={ing.id}
                                    className={`rounded-xl p-2 flex items-center justify-between gap-2 transition-colors border ${
                                      isIngObtained
                                        ? 'bg-emerald-950/30 border-emerald-500/30 hover:border-emerald-500/50'
                                        : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <div className="w-7 h-7 rounded-lg bg-slate-950 border border-slate-800 p-0.5 flex items-center justify-center shrink-0">
                                        <SafeImage
                                          src={getItemIconUrl({ id: ing.id, iconId: ing.iconId })}
                                          fallbackSrc={getItemFallbackIconUrl({ id: ing.id, iconId: ing.iconId })}
                                          alt={ing.name}
                                          className="w-6 h-6 object-contain"
                                        />
                                      </div>
                                      <div className="min-w-0">
                                        <div className="font-semibold text-slate-200 text-xs truncate flex items-center gap-1">
                                          <span className="truncate">{ing.name}</span>
                                          {isIngObtained && (
                                            <span className="text-[9px] text-emerald-400 font-bold px-1 rounded bg-emerald-500/20 shrink-0">
                                              ✓ Tengo
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-[10px] text-slate-400">
                                          Cant: <strong className="text-amber-300 font-mono">x{ing.quantity}</strong>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => onToggleMaterialObtained(ing.id)}
                                        className={`p-1 rounded-md text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors border ${
                                          isIngObtained
                                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-emerald-500/20 hover:text-emerald-300 hover:border-emerald-500/30'
                                        }`}
                                        title={
                                          isIngObtained
                                            ? 'Material marcado como obtenido (Clic para desmarcar)'
                                            : 'Marcar recurso como ya obtenido'
                                        }
                                      >
                                        <CheckCircle2 className="w-3 h-3" />
                                      </button>

                                      <div className="text-right font-mono">
                                        {isEditingThisIng ? (
                                          <div className="flex items-center gap-1">
                                            <input
                                              type="number"
                                              value={tempPriceInput}
                                              onChange={(e) => setTempPriceInput(e.target.value)}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                  onSavePrice(ing.id, Number(tempPriceInput) || 0);
                                                } else if (e.key === 'Escape') {
                                                  setEditingPriceItemId(null);
                                                }
                                              }}
                                              autoFocus
                                              placeholder="Precio u."
                                              className="w-16 px-1 py-0.5 bg-slate-950 border border-amber-500 text-right text-[11px] rounded text-amber-300 font-mono outline-none"
                                            />
                                            <button
                                              type="button"
                                              onClick={() => onSavePrice(ing.id, Number(tempPriceInput) || 0)}
                                              className="p-1 bg-amber-500 text-slate-950 rounded hover:bg-amber-400 cursor-pointer"
                                              title="Guardar precio"
                                            >
                                              <Check className="w-2.5 h-2.5" />
                                            </button>
                                          </div>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setEditingPriceItemId(ing.id);
                                              setTempPriceInput(String(ing.unitPrice || ''));
                                            }}
                                            className="group/ingprice text-right block cursor-pointer"
                                            title="Haz clic para editar el precio de este recurso"
                                          >
                                            <div className={`text-xs font-bold ${
                                              isIngObtained
                                                ? 'text-emerald-400/90 line-through group-hover/ingprice:text-emerald-300'
                                                : 'text-slate-300 group-hover/ingprice:text-amber-300'
                                            }`}>
                                              {ing.totalPrice > 0 ? formatKamas(ing.totalPrice) : '-'}
                                            </div>
                                            <div className="text-[10px] text-slate-500 group-hover/ingprice:text-amber-400 flex items-center justify-end gap-0.5">
                                              <span>{ing.unitPrice > 0 ? `${formatKamas(ing.unitPrice)} u.` : 'Sin precio'}</span>
                                              <Tag className="w-2 h-2 opacity-0 group-hover/ingprice:opacity-100" />
                                            </div>
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  </div>
  );
};
