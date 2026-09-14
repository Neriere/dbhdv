import React, { useState, useEffect, useMemo } from 'react';
import {
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  CheckCircle2,
  Circle,
  Copy,
  Check,
  Search,
  Wrench,
  Sparkles,
  AlertCircle,
  TrendingDown,
} from 'lucide-react';
import { DofusItem, ShoppingListItem } from '../types';
import {
  getShoppingList,
  updateShoppingListItemQuantity,
  removeFromShoppingList,
  clearShoppingList,
  getConsolidatedShoppingIngredients,
  getItemIconUrl,
  getItemFallbackIconUrl,
} from '../services/dofusDbService';
import { useMarketPrices } from '../hooks/useMarketPrices';
import { SafeImage } from './SafeImage';
import { KamaDisplay } from './common/KamaDisplay';
import { QuickSearchModal } from './QuickSearchModal';

interface ShoppingListPlannerProps {
  onSelectRecipeForCalculator: (item: DofusItem) => void;
  onSelectForCrushing?: (item: DofusItem) => void;
  onOpenQuickSearch?: () => void;
}

export const ShoppingListPlanner: React.FC<ShoppingListPlannerProps> = ({
  onSelectRecipeForCalculator,
  onSelectForCrushing,
  onOpenQuickSearch,
}) => {
  const [items, setItems] = useState<ShoppingListItem[]>(getShoppingList());
  const { marketPrices, updatePrice } = useMarketPrices();
  const [checkedMap, setCheckedMap] = useState<Record<number, boolean>>({});
  const [copied, setCopied] = useState(false);
  const [editingPriceId, setEditingPriceId] = useState<number | null>(null);
  const [editPriceValue, setEditPriceValue] = useState<string>('');
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  const refreshList = () => {
    setItems(getShoppingList());
  };

  const handleOpenSearch = () => {
    if (onOpenQuickSearch) {
      onOpenQuickSearch();
    } else {
      setIsSearchModalOpen(true);
    }
  };

  useEffect(() => {
    window.addEventListener('dofus_shopping_list_updated', refreshList);
    return () => {
      window.removeEventListener('dofus_shopping_list_updated', refreshList);
    };
  }, []);

  const consolidatedIngredients = useMemo(() => {
    const ings = getConsolidatedShoppingIngredients(items, marketPrices);
    return ings.map((ing) => ({
      ...ing,
      isChecked: Boolean(checkedMap[ing.itemId]),
    }));
  }, [items, marketPrices, checkedMap]);

  const totalCost = useMemo(() => {
    return consolidatedIngredients.reduce((acc, curr) => acc + curr.totalPrice, 0);
  }, [consolidatedIngredients]);

  const pendingCost = useMemo(() => {
    return consolidatedIngredients
      .filter((ing) => !ing.isChecked)
      .reduce((acc, curr) => acc + curr.totalPrice, 0);
  }, [consolidatedIngredients]);

  const unpricedCount = useMemo(() => {
    return consolidatedIngredients.filter((ing) => !ing.unitPrice || ing.unitPrice <= 0).length;
  }, [consolidatedIngredients]);

  const [qtyInputs, setQtyInputs] = useState<Record<number, string>>({});

  const toggleChecked = (itemId: number) => {
    setCheckedMap((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const handleSetExactQty = (itemId: number, qty: number) => {
    const validQty = Math.max(1, Math.min(99999, Math.floor(qty)));
    updateShoppingListItemQuantity(itemId, validQty);
    setQtyInputs((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
    refreshList();
  };

  const handleUpdateQty = (itemId: number, delta: number) => {
    const existing = items.find((i) => i.itemId === itemId);
    if (!existing) return;
    const currentVal = qtyInputs[itemId] !== undefined
      ? parseInt(qtyInputs[itemId], 10) || existing.targetQuantity
      : existing.targetQuantity;
    const newQty = Math.max(1, currentVal + delta);
    handleSetExactQty(itemId, newQty);
  };

  const handleQtyInputChange = (itemId: number, val: string) => {
    const digitsOnly = val.replace(/[^0-9]/g, '');
    setQtyInputs((prev) => ({
      ...prev,
      [itemId]: digitsOnly,
    }));

    const num = parseInt(digitsOnly, 10);
    if (!isNaN(num) && num > 0 && num <= 99999) {
      updateShoppingListItemQuantity(itemId, num);
      refreshList();
    }
  };

  const handleCommitQty = (itemId: number) => {
    const rawVal = qtyInputs[itemId];
    if (rawVal === undefined) return;
    const num = parseInt(rawVal, 10);
    if (!isNaN(num) && num > 0) {
      handleSetExactQty(itemId, num);
    } else {
      const existing = items.find((i) => i.itemId === itemId);
      handleSetExactQty(itemId, existing ? existing.targetQuantity : 1);
    }
  };

  const handleCancelQty = (itemId: number) => {
    setQtyInputs((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
    refreshList();
  };

  const handleSetAllQuantities = (qty: number) => {
    items.forEach((it) => {
      updateShoppingListItemQuantity(it.itemId, qty);
    });
    setQtyInputs({});
    refreshList();
  };

  const handleSaveInlinePrice = async (itemId: number) => {
    const num = Number(editPriceValue.replace(/[^0-9]/g, ''));
    if (!Number.isNaN(num) && num >= 0) {
      await updatePrice(itemId, num);
    }
    setEditingPriceId(null);
    setEditPriceValue('');
  };

  const handleCopyChatFormat = () => {
    if (consolidatedIngredients.length === 0) return;

    const lines = consolidatedIngredients.map(
      (ing) => `${ing.totalQuantityRequired}x ${ing.item?.name?.es || `Objeto #${ing.itemId}`}`
    );
    const text = `Lista de compra Dofus (${items.length} recetas):\n${lines.join(', ')}\nCosto total: ${totalCost.toLocaleString('es-ES')} K`;

    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <ShoppingCart className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-white tracking-tight">
              Lista de Compras
            </h2>
            <p className="text-xs text-slate-400">
              Ingredientes consolidados para fabricar tus recetas.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          <button
            onClick={handleOpenSearch}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Añadir
          </button>

          {items.length > 0 && (
            <>
              <button
                onClick={handleCopyChatFormat}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? '¡Copiado!' : 'Copiar lista'}
              </button>

              <button
                onClick={() => {
                  if (confirm('¿Vaciar toda la lista de compras?')) {
                    clearShoppingList();
                    setCheckedMap({});
                    refreshList();
                  }
                }}
                className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl transition-all cursor-pointer"
                title="Vaciar lista"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center max-w-md mx-auto space-y-3">
          <div className="w-12 h-12 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-center text-slate-500 mx-auto">
            <ShoppingCart className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Tu lista de compras está vacía</h3>
            <p className="text-xs text-slate-400 mt-1">
              Usa el botón <span className="text-amber-400 font-semibold">&ldquo;+ Añadir&rdquo;</span> para buscar y agregar objetos o recetas a tu lista.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Column: Recipes in Batch */}
          <div className="lg:col-span-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Recetas ({items.length})
              </h3>
              {items.length > 1 && (
                <div className="flex items-center gap-1 text-[10px]">
                  <span className="text-slate-500">Todas:</span>
                  {[1, 5, 10].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => handleSetAllQuantities(q)}
                      className="px-1.5 py-0.5 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-amber-300 border border-slate-800 rounded font-mono font-bold transition-colors cursor-pointer"
                      title={`Fijar todas las recetas a ${q}x`}
                    >
                      {q}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {items.map((entry) => (
                <div
                  key={entry.itemId}
                  className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl hover:border-slate-700 transition-all flex flex-col gap-2 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 bg-slate-950 border border-slate-800 rounded-lg p-1 shrink-0 flex items-center justify-center">
                        <SafeImage
                          src={getItemIconUrl(entry.item)}
                          fallbackSrc={getItemFallbackIconUrl(entry.item)}
                          alt={entry.item.name?.es || ''}
                          className="w-7 h-7 object-contain"
                        />
                      </div>
                      <div className="min-w-0">
                        <div
                          className="font-bold text-white text-xs truncate hover:text-amber-300 transition-colors"
                          title={entry.item.name?.es || `Objeto #${entry.itemId}`}
                        >
                          {entry.item.name?.es || `Objeto #${entry.itemId}`}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                          <span>Nv. {entry.item.level || 1}</span>
                          {entry.recipe && (
                            <>
                              <span>•</span>
                              <button
                                type="button"
                                onClick={() => onSelectRecipeForCalculator(entry.item)}
                                className="text-amber-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                              >
                                <Wrench className="w-3 h-3" /> Ver
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Quantity Stepper with Editable Input */}
                    <div className="flex items-center gap-1 shrink-0 bg-slate-950 p-1 border border-slate-800 rounded-lg">
                      <button
                        type="button"
                        onClick={(e) => handleUpdateQty(entry.itemId, e.shiftKey ? -10 : -1)}
                        className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-colors cursor-pointer"
                        title="Restar 1 (Shift + Clic para restar 10)"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>

                      <div className="relative flex items-center">
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={qtyInputs[entry.itemId] !== undefined ? qtyInputs[entry.itemId] : entry.targetQuantity}
                          onChange={(e) => handleQtyInputChange(entry.itemId, e.target.value)}
                          onFocus={(e) => e.target.select()}
                          onBlur={() => handleCommitQty(entry.itemId)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleCommitQty(entry.itemId);
                              (e.target as HTMLInputElement).blur();
                            }
                            if (e.key === 'Escape') {
                              handleCancelQty(entry.itemId);
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          className="w-12 text-center text-xs font-black text-amber-300 font-mono bg-slate-900 border border-slate-800 focus:border-amber-400 focus:bg-slate-950 focus:ring-1 focus:ring-amber-400/50 rounded py-0.5 outline-none transition-all cursor-text"
                          title="Escribe la cantidad directamente (Enter o clic fuera para confirmar)"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleUpdateQty(entry.itemId, e.shiftKey ? 10 : 1)}
                        className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-colors cursor-pointer"
                        title="Sumar 1 (Shift + Clic para sumar 10)"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          removeFromShoppingList(entry.itemId);
                          refreshList();
                        }}
                        className="p-1 text-rose-400 hover:bg-rose-500/20 rounded transition-colors ml-0.5 cursor-pointer"
                        title="Eliminar de la lista"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Quick Presets row */}
                  <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/60 text-[10px]">
                    <span className="text-slate-500 font-medium">Cant. rápida:</span>
                    <div className="flex items-center gap-1">
                      {[1, 5, 10, 50, 100].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => handleSetExactQty(entry.itemId, preset)}
                          className={`px-1.5 py-0.5 rounded font-mono font-bold transition-all cursor-pointer ${
                            entry.targetQuantity === preset
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                              : 'bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800'
                          }`}
                          title={`Fijar exactamente a ${preset} unidades`}
                        >
                          {preset}x
                        </button>
                      ))}
                      <div className="h-3 w-px bg-slate-800 mx-0.5" />
                      <button
                        type="button"
                        onClick={(e) => handleUpdateQty(entry.itemId, e.shiftKey ? 50 : 10)}
                        className="px-1.5 py-0.5 rounded font-mono font-bold bg-slate-950 hover:bg-slate-800 text-amber-400/90 hover:text-amber-300 border border-slate-800 hover:border-amber-500/30 transition-all cursor-pointer"
                        title="Sumar +10 (Shift + Clic para sumar +50)"
                      >
                        +10
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Budget Summary Card */}
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-2.5 shadow-md text-xs">
              <div className="font-bold text-slate-400 uppercase tracking-wider text-[11px]">
                Resumen Presupuestario
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400">Total Ingredientes:</span>
                <span className="font-bold text-white">{consolidatedIngredients.length} tipos</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400">Costo Total:</span>
                <span className="font-bold text-amber-400 font-mono text-sm">
                  <KamaDisplay amount={totalCost} />
                </span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <span className="text-slate-400 flex items-center gap-1">
                  <TrendingDown className="w-3.5 h-3.5 text-emerald-400" /> Pendiente:
                </span>
                <span className="font-bold text-emerald-300 font-mono text-sm">
                  <KamaDisplay amount={pendingCost} />
                </span>
              </div>

              {unpricedCount > 0 && (
                <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-300 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    <strong>{unpricedCount}</strong> ingredientes sin precio registrado.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Consolidated Ingredients Table */}
          <div className="lg:col-span-8 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <ShoppingCart className="w-3.5 h-3.5 text-amber-400" /> Ingredientes ({consolidatedIngredients.length})
              </h3>
              <span className="text-[11px] text-slate-500">
                Marcar elementos comprados
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 font-mono border-b border-slate-800 text-[10px] uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3 w-8 text-center">Estado</th>
                      <th className="py-2.5 px-3">Ingrediente</th>
                      <th className="py-2.5 px-3 text-center">Cantidad</th>
                      <th className="py-2.5 px-3 text-right">Precio Unitario</th>
                      <th className="py-2.5 px-3 text-right">Costo Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-sans">
                    {consolidatedIngredients.map((ing) => {
                      const isChecked = Boolean(ing.isChecked);
                      const isEditing = editingPriceId === ing.itemId;

                      return (
                        <tr
                          key={ing.itemId}
                          className={`hover:bg-slate-800/40 transition-colors ${
                            isChecked ? 'bg-slate-950/40 opacity-60' : ''
                          }`}
                        >
                          <td className="py-2 px-3 text-center">
                            <button
                              onClick={() => toggleChecked(ing.itemId)}
                              className="text-slate-500 hover:text-amber-400 transition-colors p-0.5"
                            >
                              {isChecked ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <Circle className="w-4 h-4 text-slate-600 hover:text-slate-400" />
                              )}
                            </button>
                          </td>

                          <td className="py-2 px-3">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 bg-slate-950 border border-slate-800 rounded-lg p-0.5 shrink-0 flex items-center justify-center">
                                <SafeImage
                                  src={getItemIconUrl(ing.item || { id: ing.itemId })}
                                  fallbackSrc={getItemFallbackIconUrl(ing.item || { id: ing.itemId })}
                                  alt={ing.item?.name?.es || ''}
                                  className="w-6 h-6 object-contain"
                                />
                              </div>
                              <span className={`font-bold ${isChecked ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                                {ing.item?.name?.es || `Objeto #${ing.itemId}`}
                              </span>
                            </div>
                          </td>

                          <td className="py-2 px-3 text-center font-bold text-amber-300 font-mono">
                            {ing.totalQuantityRequired.toLocaleString('es-ES')}x
                          </td>

                          <td className="py-2 px-3 text-right font-mono">
                            {isEditing ? (
                              <div className="flex items-center justify-end gap-1">
                                <input
                                  type="number"
                                  value={editPriceValue}
                                  onChange={(e) => setEditPriceValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') void handleSaveInlinePrice(ing.itemId);
                                    if (e.key === 'Escape') setEditingPriceId(null);
                                  }}
                                  autoFocus
                                  className="w-20 px-1.5 py-0.5 bg-slate-950 border border-amber-500 rounded text-right text-xs text-white outline-none"
                                />
                                <button
                                  onClick={() => void handleSaveInlinePrice(ing.itemId)}
                                  className="p-1 bg-emerald-500 text-slate-950 rounded hover:bg-emerald-400"
                                >
                                  <Check className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setEditingPriceId(ing.itemId);
                                  setEditPriceValue(String(ing.unitPrice || ''));
                                }}
                                className="group inline-flex items-center gap-1 hover:text-amber-300 font-semibold text-slate-300"
                              >
                                <KamaDisplay amount={ing.unitPrice} />
                              </button>
                            )}
                          </td>

                          <td className="py-2 px-3 text-right font-bold text-amber-400 font-mono">
                            <KamaDisplay amount={ing.totalPrice} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Search Modal for adding items to shopping list */}
      <QuickSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        onSelectForCalculator={(item) => {
          onSelectRecipeForCalculator(item);
          setIsSearchModalOpen(false);
        }}
        onSelectForCrushing={(item) => {
          if (onSelectForCrushing) {
            onSelectForCrushing(item);
          }
          setIsSearchModalOpen(false);
        }}
      />
    </div>
  );
};
