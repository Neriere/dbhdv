import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, X, Wrench, Zap, ShoppingCart, Coins, ArrowRight, Sparkles, Filter } from 'lucide-react';
import { DofusItem, DofusRecipe } from '../types';
import {
  getAllLocalItems,
  getRecipeByResultId,
  getStoredItemPrice,
  calculateItemCraftCost,
  addToShoppingList,
  getItemIconUrl,
  getItemFallbackIconUrl,
} from '../services/dofusDbService';
import { isCrushableJob, isPetItem, getJobForItem, isOmittedItem } from '../data/dofusJobs';
import { matchesSearchQuery } from '../utils/searchUtils';
import { SafeImage } from './SafeImage';
import { KamaDisplay } from './common/KamaDisplay';

interface QuickSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectForCalculator: (item: DofusItem) => void;
  onSelectForCrushing: (item: DofusItem) => void;
  onSelectForPriceManager?: (item: DofusItem) => void;
  onOpenShoppingList?: () => void;
}

export const QuickSearchModal: React.FC<QuickSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectForCalculator,
  onSelectForCrushing,
  onSelectForPriceManager,
  onOpenShoppingList,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCraftableOnly, setFilterCraftableOnly] = useState(false);
  const [filterSuperCategory, setFilterSuperCategory] = useState<number | 'all'>('all');
  const [addedItemNotice, setAddedItemNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setSearchTerm('');
      setAddedItemNotice(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const allItems = useMemo(() => getAllLocalItems(), [isOpen]);

  const searchResults = useMemo(() => {
    if (!searchTerm.trim() && !filterCraftableOnly && filterSuperCategory === 'all') {
      return allItems.slice(0, 15);
    }

    let filtered = allItems;

    if (filterCraftableOnly) {
      filtered = filtered.filter((i) => Boolean(i.hasRecipe || getRecipeByResultId(i.id)));
    }

    if (filterSuperCategory !== 'all') {
      filtered = filtered.filter((i) => i.type?.superCategoryId === filterSuperCategory);
    }

    if (searchTerm.trim()) {
      filtered = filtered.filter((i) =>
        matchesSearchQuery([i.id, i.name?.es, i.name?.fr, i.type?.name?.es, i.level], searchTerm)
      );
    }

    return filtered.slice(0, 30);
  }, [allItems, searchTerm, filterCraftableOnly, filterSuperCategory]);

  const handleAddToList = (item: DofusItem, recipe?: DofusRecipe) => {
    addToShoppingList(item, 1, recipe);
    const itemName = item.name?.es || item.name?.fr || `Objeto #${item.id}`;
    setAddedItemNotice(`¡${itemName} añadido a la Lista de Compras!`);
    setTimeout(() => setAddedItemNotice(null), 2500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-20 px-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-950/60 flex items-center gap-3">
          <Search className="w-5 h-5 text-amber-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Buscar cualquier objeto, arma, receta, runa o recurso (Nombre, ID, Nivel)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 bg-transparent text-white placeholder-slate-500 text-sm sm:text-base outline-none font-medium"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-bold text-slate-400 bg-slate-800 border border-slate-700 rounded-md">
            ESC
          </kbd>
        </div>

        {/* Quick Filter Bar */}
        <div className="px-4 py-2 bg-slate-900/90 border-b border-slate-800/60 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-semibold flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Filtros:
            </span>
            <button
              onClick={() => setFilterCraftableOnly(!filterCraftableOnly)}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                filterCraftableOnly
                  ? 'bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/20'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {filterCraftableOnly ? '✓ Solo Crafteables' : 'Solo Crafteables'}
            </button>

            <select
              value={filterSuperCategory}
              onChange={(e) =>
                setFilterSuperCategory(e.target.value === 'all' ? 'all' : Number(e.target.value))
              }
              className="bg-slate-800 text-slate-200 border border-slate-700 rounded-lg px-2 py-1 outline-none text-xs font-semibold"
            >
              <option value="all">Todas las categorías</option>
              <option value="1">Equipamiento</option>
              <option value="2">Consumibles</option>
              <option value="3">Recursos</option>
            </select>
          </div>

          {addedItemNotice && (
            <div className="text-emerald-400 font-bold flex items-center gap-1.5 animate-pulse">
              <Sparkles className="w-3.5 h-3.5" /> {addedItemNotice}
            </div>
          )}
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/50 p-2">
          {searchResults.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              No se encontraron objetos que coincidan con &ldquo;{searchTerm}&rdquo;.
            </div>
          ) : (
            searchResults.map((item) => {
              const recipe = getRecipeByResultId(item.id);
              const marketPrice = getStoredItemPrice(item.id);
              const craftCost = recipe ? calculateItemCraftCost(item.id) : null;
              const hasProfit =
                marketPrice > 0 && craftCost !== null && craftCost > 0 && marketPrice > craftCost;

              return (
                <div
                  key={item.id}
                  className="p-2.5 sm:p-3 hover:bg-slate-800/50 rounded-xl transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 bg-slate-950 border border-slate-800 rounded-xl p-1 shrink-0 flex items-center justify-center relative shadow-inner">
                      <SafeImage
                        src={getItemIconUrl(item)}
                        fallbackSrc={getItemFallbackIconUrl(item)}
                        alt={item.name?.es || ''}
                        className="w-9 h-9 object-contain"
                      />
                      {recipe && (
                        <span
                          className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full border border-slate-900"
                          title="Objeto Crafteable"
                        />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm sm:text-base truncate group-hover:text-amber-300 transition-colors">
                          {item.name?.es || `Objeto #${item.id}`}
                        </span>
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-semibold shrink-0">
                          Nv. {item.level}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                        <span>{item.type?.name?.es || 'Desconocido'}</span>
                        <span>•</span>
                        <span>HDV: <KamaDisplay amount={marketPrice} size="sm" /></span>
                        {craftCost !== null && craftCost > 0 && (
                          <>
                            <span>•</span>
                            <span className={hasProfit ? 'text-emerald-400 font-semibold' : 'text-slate-400'}>
                              Craft: <KamaDisplay amount={craftCost} size="sm" />
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end shrink-0 pt-1 sm:pt-0">
                    {recipe && (
                      <button
                        onClick={() => {
                          onSelectForCalculator(item);
                          onClose();
                        }}
                        className="p-1.5 sm:px-2.5 sm:py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                        title="Abrir en Calculadora de Recetas"
                      >
                        <Wrench className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Receta</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        onSelectForCrushing(item);
                        onClose();
                      }}
                      className="p-1.5 sm:px-2.5 sm:py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                      title="Simular en Rompedora de Runas"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Romper</span>
                    </button>

                    <button
                      onClick={() => handleAddToList(item, recipe)}
                      className="p-1.5 sm:px-2.5 sm:py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                      title={recipe ? 'Añadir receta a Lista de Compras' : 'Añadir ingrediente a Lista de Compras'}
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">+ Lista</span>
                    </button>

                    {onSelectForPriceManager && (
                      <button
                        onClick={() => {
                          onSelectForPriceManager(item);
                          onClose();
                        }}
                        className="p-1.5 sm:px-2 sm:py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition-colors"
                        title="Editar Precio"
                      >
                        <Coins className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <span>Resultados: <strong className="text-slate-300">{searchResults.length}</strong></span>
            <span>•</span>
            <span className="hidden sm:inline">Usa <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px]">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px]">K</kbd> en cualquier momento</span>
          </div>

          {onOpenShoppingList && (
            <button
              onClick={() => {
                onOpenShoppingList();
                onClose();
              }}
              className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1"
            >
              Ver Lista de Compras <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
