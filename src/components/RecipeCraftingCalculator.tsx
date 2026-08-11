import React, { useState, useEffect } from 'react';
import {
  Wrench,
  Search,
  SlidersHorizontal,
  ChevronRight,
  ChevronDown,
  DollarSign,
  TrendingUp,
  Layers,
  ArrowRightLeft,
  Check,
  Zap,
  Sparkles,
  Info,
  RefreshCw,
  FlaskConical,
  Sword,
  Wand2,
  Gem,
  Footprints,
  Scissors,
  Shield,
  Pickaxe,
  Axe,
  Wheat,
  Drumstick,
  Fish,
  ShoppingBag,
  ExternalLink,
  Heart,
} from 'lucide-react';

import {
  DofusItem,
  DofusJob,
  RecipeTreeNode,
  CraftStrategyMode,
  MarketPriceMap,
} from '../types';
import { DOFUS_JOBS, getJobForItem, isOmittedItem } from '../data/dofusJobs';
import {
  PRESET_CRAFTABLE_ITEMS,
  DEFAULT_INGREDIENT_PRICES,
  PresetCraftableItem,
} from '../data/presetCraftableItems';
import {
  getCraftableItemsSnapshot,
  initializeDatabase,
  getStoredMarketPrices,
  getStoredPriceUpdatedAt,
  saveMarketPrice,
  buildRecipeTree,
  calculateTreeCraftCost,
  autoOptimizeTreeDecisions,
  getItemName,
  getItemTypeName,
  getItemIconUrl,
  getItemFallbackIconUrl,
  resolveMissingItemNamesInBatch,
} from '../services/dofusDbService';

// Icon Map helper for professions
const JOB_ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  FlaskConical,
  Sword,
  Wand2,
  Gem,
  Footprints,
  Scissors,
  Wrench,
  Shield,
  Pickaxe,
  Axe,
  Wheat,
  Drumstick,
  Fish,
  Heart,
};

export const RecipeCraftingCalculator: React.FC<{
  initialSelectedItem?: DofusItem | null;
}> = ({ initialSelectedItem }) => {
  // Selected Job (Profession) Filter
  const [selectedJobId, setSelectedJobId] = useState<number | 'all'>('all');
  
  // Level Filter
  const [minLevel, setMinLevel] = useState<number | ''>(1);
  const [maxLevel, setMaxLevel] = useState<number | ''>(200);
  
  // Search text
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Sort By & Profit Filters
  const [sortBy, setSortBy] = useState<'level_asc' | 'level_desc' | 'profit_desc' | 'roi_desc' | 'cost_asc' | 'name'>('profit_desc');
  const [onlyProfitable, setOnlyProfitable] = useState<boolean>(false);
  const [minProfitKamas, setMinProfitKamas] = useState<number | ''>(0);
  const [minRoiPercent, setMinRoiPercent] = useState<number | ''>(0);

  const [marketPrices, setMarketPrices] = useState<MarketPriceMap>({});
  const [priceUpdatedAt, setPriceUpdatedAt] = useState<Record<number, number>>({});
  const [databaseVersion, setDatabaseVersion] = useState<number>(0);

  const [activePresetItem, setActivePresetItem] = useState<PresetCraftableItem | null>(
    PRESET_CRAFTABLE_ITEMS[0]
  );

  const [recipeTree, setRecipeTree] = useState<RecipeTreeNode | null>(null);
  const [loadingTree, setLoadingTree] = useState<boolean>(false);

  const [activeSalePrice, setActiveSalePrice] = useState<number | ''>('');

  const handlePriceChange = (itemId: number, newPrice: number) => {
    saveMarketPrice(itemId, newPrice)
      .then((updated) => {
        setMarketPrices({ ...DEFAULT_INGREDIENT_PRICES, ...updated });
      })
      .catch((error) => {
        console.error(`No se pudo guardar el precio del item ${itemId}:`, error);
      });
  };

  useEffect(() => {
    const hydrateState = () => {
      setMarketPrices({ ...DEFAULT_INGREDIENT_PRICES, ...getStoredMarketPrices() });
      setPriceUpdatedAt(getStoredPriceUpdatedAt());
      setDatabaseVersion((prev) => prev + 1);
    };

    initializeDatabase()
      .then(() => {
        hydrateState();
      })
      .catch((error) => {
        console.error('No se pudo inicializar la base local:', error);
      });

    const handleDbUpdate = () => {
      hydrateState();
    };
    window.addEventListener('dofus_database_updated', handleDbUpdate);

    return () => {
      window.removeEventListener('dofus_database_updated', handleDbUpdate);
    };
  }, []);

  useEffect(() => {
    if (initialSelectedItem) {
      const foundPreset = PRESET_CRAFTABLE_ITEMS.find((p) => p.id === initialSelectedItem.id);
      if (foundPreset) {
        setActivePresetItem(foundPreset);
      } else {
        const itemJob = getJobForItem(initialSelectedItem);
        const tempPreset: PresetCraftableItem = {
          ...initialSelectedItem,
          jobId: itemJob.jobId,
          jobNameEs: itemJob.jobNameEs,
          defaultMarketSalePrice: initialSelectedItem.price || 150000,
          recipeData: {
            id: 9999,
            resultId: initialSelectedItem.id,
            ingredientIds: [2469, 2470],
            quantities: [5, 5],
          },
        };
        setActivePresetItem(tempPreset);
      }
    }
  }, [initialSelectedItem]);

  useEffect(() => {
    if (!activePresetItem) return;

    let isMounted = true;
    setLoadingTree(true);

    const initialSalePrice =
      marketPrices[activePresetItem.id] && marketPrices[activePresetItem.id] > 0
        ? marketPrices[activePresetItem.id]
        : '';
    setActiveSalePrice(initialSalePrice);

    buildRecipeTree(activePresetItem.id, 1, 0, 3, new Set(), marketPrices)
      .then((tree) => {
        if (isMounted) {
          setRecipeTree(tree);
          setLoadingTree(false);
        }
      })
      .catch((err) => {
        console.error('Error building tree', err);
        if (isMounted) setLoadingTree(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activePresetItem, marketPrices]);

  const [displayLimit, setDisplayLimit] = useState<number>(80);
  const [resolvedNamesTrigger, setResolvedNamesTrigger] = useState<number>(0);

  useEffect(() => {
    const handleDbUpdate = () => {
      setResolvedNamesTrigger((prev) => prev + 1);
    };
    window.addEventListener('dofus_database_updated', handleDbUpdate);
    return () => {
      window.removeEventListener('dofus_database_updated', handleDbUpdate);
    };
  }, []);

  const allCraftableItems: PresetCraftableItem[] = React.useMemo(() => {
    return getCraftableItemsSnapshot() as PresetCraftableItem[];
  }, [resolvedNamesTrigger, databaseVersion]);

  const getItemMetrics = (item: PresetCraftableItem) => {
    let cost = 0;
    if (item.recipeData && item.recipeData.ingredientIds) {
      item.recipeData.ingredientIds.forEach((ingId, idx) => {
        const qty = item.recipeData.quantities[idx] || 1;
        const ingPrice = marketPrices[ingId] || 0;
        cost += ingPrice * qty;
      });
    }
    const salePrice = marketPrices[item.id] || 0;
    const netProfit = salePrice - cost;
    const roi = cost > 0 ? (netProfit / cost) * 100 : 0;
    return { cost, salePrice, netProfit, roi };
  };

  const filteredItems = React.useMemo(() => {
    const effMinLevel = minLevel === '' ? 1 : Number(minLevel);
    const effMaxLevel = maxLevel === '' ? 200 : Number(maxLevel);
    const effMinProfit = minProfitKamas === '' ? 0 : Number(minProfitKamas);
    const effMinRoi = minRoiPercent === '' ? 0 : Number(minRoiPercent);

    return allCraftableItems
      .filter((item) => {
        // Job filter
        if (selectedJobId !== 'all' && item.jobId !== selectedJobId) {
          return false;
        }
        // Level filter
        if (item.level < effMinLevel || item.level > effMaxLevel) {
          return false;
        }
        // Search term
        if (searchTerm.trim()) {
          const name = getItemName(item).toLowerCase();
          const term = searchTerm.toLowerCase();
          if (!name.includes(term) && !item.id.toString().includes(term)) {
            return false;
          }
        }

        const metrics = getItemMetrics(item);
        if (onlyProfitable && metrics.netProfit <= 0) return false;
        if (effMinProfit > 0 && metrics.netProfit < effMinProfit) return false;
        if (effMinRoi > 0 && metrics.roi < effMinRoi) return false;

        return true;
      })
      .sort((a, b) => {
        const aIsNamed = !getItemName(a).startsWith('Objeto #');
        const bIsNamed = !getItemName(b).startsWith('Objeto #');
        if (aIsNamed && !bIsNamed) return -1;
        if (!aIsNamed && bIsNamed) return 1;

        const aMetrics = getItemMetrics(a);
        const bMetrics = getItemMetrics(b);

        if (sortBy === 'profit_desc') return bMetrics.netProfit - aMetrics.netProfit;
        if (sortBy === 'roi_desc') return bMetrics.roi - aMetrics.roi;
        if (sortBy === 'cost_asc') return aMetrics.cost - bMetrics.cost;
        if (sortBy === 'level_asc') return a.level - b.level;
        if (sortBy === 'level_desc') return b.level - a.level;
        if (sortBy === 'name') return getItemName(a).localeCompare(getItemName(b));
        return 0;
      });
  }, [
    allCraftableItems,
    selectedJobId,
    minLevel,
    maxLevel,
    searchTerm,
    sortBy,
    onlyProfitable,
    minProfitKamas,
    minRoiPercent,
    marketPrices,
  ]);

  // Auto-resolve missing Spanish item names for currently visible items in background
  useEffect(() => {
    const visibleIds = filteredItems.slice(0, displayLimit).map((item) => item.id);
    if (visibleIds.length > 0) {
      resolveMissingItemNamesInBatch(visibleIds, () => {
        setResolvedNamesTrigger((prev) => prev + 1);
      });
    }
  }, [filteredItems, displayLimit]);

  // Costs calculation for current tree
  const directCraftCost = recipeTree
    ? calculateTreeCraftCost(recipeTree, 'direct_buy', marketPrices)
    : 0;

  const autoOptimalCost = recipeTree
    ? calculateTreeCraftCost(recipeTree, 'auto_optimal', marketPrices)
    : 0;

  const effectiveSalePrice = typeof activeSalePrice === 'number' ? activeSalePrice : 0;
  const netProfit = effectiveSalePrice - autoOptimalCost;
  const profitMarginPercent =
    autoOptimalCost > 0 ? (netProfit / autoOptimalCost) * 100 : 0;
  const activeSaleUpdatedAt = activePresetItem ? priceUpdatedAt[activePresetItem.id] : undefined;
  const activeSaleTitle = activeSaleUpdatedAt
    ? `Actualizado: ${new Date(activeSaleUpdatedAt).toLocaleString()}`
    : '';

  return (
    <div className="space-y-4">
      
      {/* Compact Filter Bar */}
      <div className="bg-[#0f0f0f] border border-neutral-800 rounded-xl p-4 space-y-3 shadow-md">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-800 pb-2.5">
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-amber-400 shrink-0" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Recetas
            </h2>
            <span className="text-xs text-neutral-400 font-mono px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800">
              {filteredItems.length}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            {/* Toggle: Solo Rentables */}
            <label className="inline-flex items-center gap-1.5 cursor-pointer bg-neutral-900 px-2.5 py-1 rounded-lg border border-neutral-800 text-neutral-300 hover:text-white transition-colors">
              <input
                type="checkbox"
                checked={onlyProfitable}
                onChange={(e) => setOnlyProfitable(e.target.checked)}
                className="rounded border-neutral-700 text-amber-500 focus:ring-0 bg-neutral-950"
              />
              <span className="font-semibold text-emerald-400">Solo Rentables (&gt;0 K)</span>
            </label>
          </div>
        </div>

        {/* Compact Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          
          {/* Job Dropdown Selector */}
          <div>
            <label className="block text-neutral-400 font-medium mb-1">
              Oficio ({DOFUS_JOBS.length})
            </label>
            <select
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white font-medium focus:border-amber-500 focus:outline-none"
            >
              <option value="all">Todos los Oficios</option>
              {DOFUS_JOBS.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.nameEs}
                </option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div>
            <label className="block text-neutral-400 font-medium mb-1">Buscar Objeto</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-2" />
              <input
                type="text"
                placeholder="ej. Gelano, Anillo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-lg pl-8 pr-2.5 py-1.5 text-white placeholder-neutral-500 focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Sort By Dropdown */}
          <div>
            <label className="block text-neutral-400 font-medium mb-1">Ordenar Por</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white font-medium focus:border-amber-500 focus:outline-none"
            >
              <option value="profit_desc">Mayor Ganancia (Kamas)</option>
              <option value="roi_desc">Mayor Rentabilidad (% ROI)</option>
              <option value="cost_asc">Menor Costo Crafteo</option>
              <option value="level_asc">Nivel Ascendente</option>
              <option value="level_desc">Nivel Descendente</option>
              <option value="name">Nombre A-Z</option>
            </select>
          </div>

          {/* Min Profit Filter */}
          <div>
            <label className="block text-neutral-400 font-medium mb-1">Ganancia Mín. (Kamas)</label>
            <input
              type="number"
              value={minProfitKamas}
              onChange={(e) => {
                const val = e.target.value;
                setMinProfitKamas(val === '' ? '' : Number(val));
              }}
              step={5000}
              placeholder="0"
              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white font-mono focus:border-amber-500 focus:outline-none"
            />
          </div>

          {/* Level Range */}
          <div>
            <label className="block text-neutral-400 font-medium mb-1">
              Rango Nivel ({minLevel === '' ? 1 : minLevel} - {maxLevel === '' ? 200 : maxLevel})
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={1}
                max={200}
                value={minLevel}
                onChange={(e) => {
                  const val = e.target.value;
                  setMinLevel(val === '' ? '' : Number(val));
                }}
                className="w-1/2 bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1.5 text-center text-white font-mono focus:border-amber-500 focus:outline-none"
              />
              <span className="text-neutral-500">-</span>
              <input
                type="number"
                min={1}
                max={200}
                value={maxLevel}
                onChange={(e) => {
                  const val = e.target.value;
                  setMaxLevel(val === '' ? '' : Number(val));
                }}
                className="w-1/2 bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1.5 text-center text-white font-mono focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

        </div>
      </div>

      {/* Main Split Layout: Item Selection List vs Deep Sub-crafting Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Craftable Items Selection List */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
              Objetos ({filteredItems.length})
            </h4>
            <span className="text-[11px] text-neutral-500">Selecciona uno</span>
          </div>

          <div className="space-y-2 max-h-[650px] overflow-y-auto pr-1">
            {filteredItems.slice(0, displayLimit).map((item) => {
              const isSelected = activePresetItem?.id === item.id;
              const itemSalePrice = marketPrices[item.id] || 0;

              return (
                <div
                  key={item.id}
                  onClick={() => setActivePresetItem(item)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-amber-500/10 border-amber-500 text-white shadow-md'
                      : 'bg-[#0f0f0f] border-neutral-800 hover:border-neutral-700 text-neutral-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-[#0a0a0a] border border-neutral-800 rounded-lg p-1 flex items-center justify-center shrink-0">
                      {getItemIconUrl(item) ? (
                        <img
                          src={getItemIconUrl(item)}
                          alt={getItemName(item)}
                          className="w-9 h-9 object-contain"
                          onError={(e) => {
                            const fallback = getItemFallbackIconUrl(item);
                            if (fallback && (e.target as HTMLImageElement).src !== fallback) {
                              (e.target as HTMLImageElement).src = fallback;
                            } else {
                              (e.target as HTMLElement).style.display = 'none';
                            }
                          }}
                        />
                      ) : (
                        <ShoppingBag className="w-5 h-5 text-neutral-500" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h5 className="font-bold text-sm text-white line-clamp-1">
                          {getItemName(item)}
                        </h5>
                        <span className="px-1.5 py-0.2 rounded bg-neutral-900 border border-neutral-800 text-[10px] font-mono text-amber-400">
                          Niv. {item.level}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-[10px] font-medium text-amber-300">
                          {item.jobNameEs}
                        </span>
                        {getItemTypeName(item) && (
                          <span className="px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-[10px] font-medium text-blue-300">
                            {getItemTypeName(item)}
                          </span>
                        )}
                        <span className="text-[10px] text-neutral-500 font-mono">
                          #{item.id}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    {itemSalePrice > 0 ? (
                      <div className="text-xs font-mono font-bold text-emerald-400">
                        {itemSalePrice.toLocaleString()} K
                      </div>
                    ) : (
                      <div className="text-xs font-mono text-neutral-500">
                        Sin precio
                      </div>
                    )}
                    <span className="text-[10px] text-amber-400 font-mono block mt-0.5">
                      {isSelected ? '▶ Activo' : 'Ver'}
                    </span>
                  </div>
                </div>
              );
            })}

            {filteredItems.length > displayLimit && (
              <button
                onClick={() => setDisplayLimit((prev) => prev + 100)}
                className="w-full py-3 bg-neutral-900 border border-neutral-800 hover:border-amber-500/50 hover:bg-neutral-800 text-amber-400 text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 mt-2"
              >
                <span>Ver más recetas ({displayLimit} de {filteredItems.length})</span>
                <ChevronDown className="w-4 h-4" />
              </button>
            )}

            {filteredItems.length === 0 && (
              <div className="p-8 text-center bg-[#0f0f0f] border border-neutral-800 rounded-xl text-neutral-500 text-xs">
                No hay objetos que coincidan con los filtros seleccionados.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Deep Nested Recipe & Sub-crafting Tree Inspector */}
        <div className="lg:col-span-7 space-y-6">
          
          {activePresetItem && (
            <div className="bg-[#0f0f0f] border border-neutral-800 rounded-xl p-5 space-y-6 shadow-md">
              
              {/* Header Info of Inspected Item */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-[#0a0a0a] border border-neutral-800 rounded-xl p-2 flex items-center justify-center shrink-0">
                    {getItemIconUrl(activePresetItem) ? (
                      <img
                        src={getItemIconUrl(activePresetItem)}
                        alt={getItemName(activePresetItem)}
                        className="w-12 h-12 object-contain"
                        onError={(e) => {
                          const fallback = getItemFallbackIconUrl(activePresetItem);
                          if (fallback && (e.target as HTMLImageElement).src !== fallback) {
                            (e.target as HTMLImageElement).src = fallback;
                          } else {
                            (e.target as HTMLElement).style.display = 'none';
                          }
                        }}
                      />
                    ) : (
                      <Wrench className="w-6 h-6 text-neutral-500" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-bold font-serif text-white italic">
                        {getItemName(activePresetItem)}
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-bold font-mono">
                        Nivel {activePresetItem.level}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-xs font-semibold text-amber-400">
                        Oficio: {activePresetItem.jobNameEs}
                      </span>
                      {getItemTypeName(activePresetItem) && (
                        <span className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-xs font-semibold text-blue-400">
                          Tipo: {getItemTypeName(activePresetItem)}
                        </span>
                      )}
                      <span className="text-xs text-neutral-500 font-mono">
                        ID: #{activePresetItem.id}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Final Item Sale Price Input */}
                <div className="bg-[#0a0a0a] border border-neutral-800 rounded-lg p-2.5 text-right shrink-0">
                  <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">
                    Venta
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={activeSalePrice}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '') {
                          setActiveSalePrice('');
                        } else {
                          const num = Math.max(0, Number(val));
                          setActiveSalePrice(num);
                        }
                      }}
                      onBlur={() => {
                        handlePriceChange(
                          activePresetItem.id,
                          typeof activeSalePrice === 'number' ? activeSalePrice : 0,
                        );
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handlePriceChange(
                            activePresetItem.id,
                            typeof activeSalePrice === 'number' ? activeSalePrice : 0,
                          );
                        }
                      }}
                      placeholder="0"
                      title={activeSaleTitle}
                      className="w-28 bg-[#0f0f0f] border border-neutral-800 rounded px-2 py-1 text-right text-emerald-400 font-mono font-bold text-sm focus:outline-none focus:border-amber-500"
                    />
                    <span className="text-xs text-neutral-500 font-bold">K</span>
                  </div>
                </div>
              </div>

              {/* Profitability Summary Panel */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                
                <div className="p-3.5 rounded-xl bg-[#0a0a0a] border border-neutral-800 space-y-1">
                  <span className="text-[11px] text-neutral-400 font-bold uppercase tracking-wider">
                    Costo
                  </span>
                  <div className="text-lg font-bold font-mono text-amber-400">
                    {autoOptimalCost.toLocaleString()} K
                  </div>
                  <p className="text-[10px] text-neutral-500">Ruta más barata</p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#0a0a0a] border border-neutral-800 space-y-1">
                  <span className="text-[11px] text-neutral-400 font-bold uppercase tracking-wider">
                    Venta
                  </span>
                  <div className="text-lg font-bold font-mono text-emerald-400">
                    {activeSalePrice.toLocaleString()} K
                  </div>
                  <p className="text-[10px] text-neutral-500">Precio actual</p>
                </div>

                <div
                  className={`p-3.5 rounded-xl border space-y-1 ${
                    netProfit >= 0
                      ? 'bg-emerald-500/10 border-emerald-500/30'
                      : 'bg-red-500/10 border-red-500/30'
                  }`}
                >
                  <span className="text-[11px] text-neutral-300 font-bold uppercase tracking-wider">
                    Ganancia
                  </span>
                  <div
                    className={`text-lg font-bold font-mono ${
                      netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {netProfit >= 0 ? '+' : ''}
                    {netProfit.toLocaleString()} K
                  </div>
                  <p className="text-[10px] font-mono text-neutral-300">
                    Margen ROI: {profitMarginPercent.toFixed(1)}%
                  </p>
                </div>

              </div>

              {/* Recommendation Banner */}
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
                <div className="text-xs text-amber-200/90 leading-relaxed">
                  {autoOptimalCost < directCraftCost ? (
                    <p>
                      Te conviene <strong className="text-emerald-400 font-bold">Craftear fabricando los sub-ingredientes</strong>. Ahorras{' '}
                      <strong className="text-emerald-300 font-bold font-mono">
                        {(directCraftCost - autoOptimalCost).toLocaleString()} K
                      </strong>.
                    </p>
                  ) : (
                    <p>
                      Te conviene <strong className="text-blue-400 font-bold">Comprar los ingredientes directos en el mercadillo</strong>.
                    </p>
                  )}
                </div>
              </div>

              {/* Nested Recipe Ingredients List */}
              <div className="space-y-3 pt-2 border-t border-neutral-800">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-2">
                    <Layers className="w-4 h-4 text-amber-400" />
                    Ingredientes y Precios de Mercadillo
                  </h4>
                  <span className="text-[11px] text-neutral-500">
                    Coloca o ajusta los precios en Kamas para ver el autoanálisis al instante
                  </span>
                </div>

                {loadingTree ? (
                  <div className="py-12 text-center space-y-2">
                    <RefreshCw className="w-6 h-6 animate-spin text-amber-400 mx-auto" />
                    <p className="text-xs text-neutral-400">Construyendo árbol de ingredientes...</p>
                  </div>
                ) : recipeTree && recipeTree.subIngredients ? (
                  <div className="space-y-3.5 bg-[#0a0a0a] border border-neutral-800 rounded-xl p-4">
                    {recipeTree.subIngredients.map((childNode) => (
                      <TreeNodeItem
                        key={childNode.itemId}
                        node={childNode}
                        marketPrices={marketPrices}
                        priceUpdatedAt={priceUpdatedAt}
                        onPriceChange={handlePriceChange}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs text-neutral-500">
                    Este objeto no posee receta de fabricación o es un recurso base.
                  </div>
                )}

              </div>

            </div>
          )}

        </div>

      </div>

    </div>
  );
};

// Sub-Component: Recursive Tree Node Item Component
interface TreeNodeItemProps {
  node: RecipeTreeNode;
  marketPrices: MarketPriceMap;
  priceUpdatedAt: Record<number, number>;
  onPriceChange: (itemId: number, newPrice: number) => void;
}

const TreeNodeItem: React.FC<TreeNodeItemProps> = ({
  node,
  marketPrices,
  priceUpdatedAt,
  onPriceChange,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const currentPrice = marketPrices[node.itemId] || node.marketPrice || 0;
  const [draftPrice, setDraftPrice] = useState<string | null>(null);

  const totalPriceForQuantity = currentPrice * node.quantity;

  const hasSubCraft = node.isCraftable && node.subIngredients && node.subIngredients.length > 0;

  // Calculate direct market cost vs sub-crafting cost
  const directBuyCost = totalPriceForQuantity;
  const subCraftCost = hasSubCraft
    ? calculateTreeCraftCost(node, 'auto_optimal', marketPrices)
    : directBuyCost;
  const updatedAtTitle = priceUpdatedAt[node.itemId]
    ? `Actualizado: ${new Date(priceUpdatedAt[node.itemId]).toLocaleString()}`
    : '';

  const isSubcraftCheaper = hasSubCraft && subCraftCost < directBuyCost;
  const savings = Math.abs(directBuyCost - subCraftCost);

  return (
    <div className="space-y-2">
      <div className="p-3 rounded-lg bg-[#0f0f0f] border border-neutral-800 space-y-2 text-xs">
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {/* Left info */}
          <div className="flex items-center gap-2 min-w-0">
            {hasSubCraft && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1 text-neutral-400 hover:text-white"
                title={isExpanded ? 'Contraer sub-receta' : 'Expandir sub-receta'}
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-amber-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-amber-400" />
                )}
              </button>
            )}

            <div className="w-9 h-9 rounded bg-[#0a0a0a] border border-neutral-800 p-0.5 flex items-center justify-center shrink-0">
              {getItemIconUrl(node.item) ? (
                <img
                  src={getItemIconUrl(node.item)}
                  alt={getItemName(node.item)}
                  className="w-7 h-7 object-contain"
                  onError={(e) => {
                    const fallback = getItemFallbackIconUrl(node.item);
                    if (fallback && (e.target as HTMLImageElement).src !== fallback) {
                      (e.target as HTMLImageElement).src = fallback;
                    } else {
                      (e.target as HTMLElement).style.display = 'none';
                    }
                  }}
                />
              ) : (
                <span className="font-mono text-amber-400 font-bold text-xs">x{node.quantity}</span>
              )}
            </div>

            <div className="min-w-0">
              <span className="font-bold text-white block truncate">
                <span className="text-amber-400 font-mono font-normal mr-1.5">x{node.quantity}</span>
                {getItemName(node.item)}
              </span>
              <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 font-mono flex-wrap">
                {getItemTypeName(node.item) && (
                  <span className="text-blue-300 bg-blue-500/10 px-1.5 py-0.2 rounded border border-blue-500/20 font-sans text-[10px]">
                    {getItemTypeName(node.item)}
                  </span>
                )}
                <span>ID #{node.itemId}</span>
                {hasSubCraft && (
                  <span className="text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20 font-sans text-[10px] font-bold">
                    ⚙️ Sub-crafteable
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right Unit Price Input & Total */}
          <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
            <div className="flex items-center gap-1.5 bg-[#0a0a0a] border border-neutral-800 rounded px-2 py-1">
              <span className="text-[11px] text-neutral-400 font-mono">Precio Un.:</span>
              <input
                type="number"
                value={draftPrice !== null ? draftPrice : (currentPrice > 0 ? currentPrice : '')}
                title={updatedAtTitle}
                onChange={(e) => {
                  const val = e.target.value;
                  setDraftPrice(val);
                }}
                onBlur={() => {
                  const nextValue = draftPrice === null ? currentPrice : (draftPrice === '' ? 0 : Number(draftPrice));
                  onPriceChange(node.itemId, nextValue);
                  setDraftPrice(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const nextValue = draftPrice === null ? currentPrice : (draftPrice === '' ? 0 : Number(draftPrice));
                    onPriceChange(node.itemId, nextValue);
                    setDraftPrice(null);
                  }
                }}
                className="w-20 bg-transparent text-right text-amber-400 font-mono font-bold text-xs focus:outline-none"
              />
              <span className="text-neutral-500 font-bold text-[11px]">K</span>
            </div>

            <span className="text-xs font-mono font-bold text-emerald-400 min-w-[70px] text-right">
              = {totalPriceForQuantity.toLocaleString()} K
            </span>
          </div>
        </div>

        {/* Recommendation Callout for Sub-Craftable Ingredient */}
        {hasSubCraft && (
          <div className="mt-2 pt-2 border-t border-neutral-800/80">
            {isSubcraftCheaper ? (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-1.5 flex items-center justify-between gap-2 text-xs text-emerald-300">
                <div className="flex items-center gap-1.5 font-bold">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Conviene CRAFTEAR este subingrediente</span>
                </div>
                <div className="font-mono text-xs text-emerald-400 font-bold">
                  Ahorras {savings.toLocaleString()} K
                </div>
              </div>
            ) : (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg px-3 py-1.5 flex items-center justify-between gap-2 text-xs text-blue-300">
                <div className="flex items-center gap-1.5 font-bold">
                  <ShoppingBag className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span>Conviene COMPRAR DIRECTAMENTE en mercadillo</span>
                </div>
                {directBuyCost < subCraftCost && (
                  <div className="font-mono text-xs text-blue-300 font-bold">
                    Ahorras {savings.toLocaleString()} K
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Recursive Sub-Ingredients Render */}
      {hasSubCraft && isExpanded && (
        <div className="pl-4 sm:pl-6 border-l-2 border-amber-500/30 space-y-2.5 my-1.5">
          {node.subIngredients!.map((subNode) => (
            <TreeNodeItem
              key={subNode.itemId}
              node={subNode}
              marketPrices={marketPrices}
              priceUpdatedAt={priceUpdatedAt}
              onPriceChange={onPriceChange}
            />
          ))}
        </div>
      )}
    </div>
  );
};
