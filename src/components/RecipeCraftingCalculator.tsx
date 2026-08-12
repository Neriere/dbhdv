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
  ChevronLeft,
  ArrowLeft,
  Tag,
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

const getJobBadgeStyle = (jobName: string) => {
  const name = (jobName || '').toLowerCase();
  if (name.includes('alquimista')) return 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300';
  if (name.includes('campesino')) return 'bg-amber-500/20 border-amber-500/40 text-amber-300';
  if (name.includes('cazador')) return 'bg-orange-500/20 border-orange-500/40 text-orange-300';
  if (name.includes('leñador') || name.includes('lenador')) return 'bg-lime-500/20 border-lime-500/40 text-lime-300';
  if (name.includes('minero')) return 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300';
  if (name.includes('pescador')) return 'bg-blue-500/20 border-blue-500/40 text-blue-300';
  if (name.includes('equipamiento') || name.includes('forjador') || name.includes('zapatero') || name.includes('sastre') || name.includes('joyero') || name.includes('escultor')) {
    return 'bg-purple-500/20 border-purple-500/40 text-purple-300';
  }
  return 'bg-neutral-800 border-neutral-700 text-neutral-300';
};

export const RecipeCraftingCalculator: React.FC<{
  initialSelectedItem?: DofusItem | null;
}> = ({ initialSelectedItem }) => {
  // Page / View mode state: false = Catalog list, true = Dedicated Item Page
  const [isDetailView, setIsDetailView] = useState<boolean>(
    Boolean(initialSelectedItem)
  );

  // Selected Job (Profession) Filter
  const [selectedJobId, setSelectedJobId] = useState<number | 'all'>('all');

  // Level Filter
  const [minLevel, setMinLevel] = useState<number | ''>(1);
  const [maxLevel, setMaxLevel] = useState<number | ''>(200);

  // Search text
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Sort By & Profit Filters
  const [sortBy, setSortBy] = useState<
    | 'level_asc'
    | 'level_desc'
    | 'profit_desc'
    | 'roi_desc'
    | 'cost_asc'
    | 'name'
  >('profit_desc');
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

  // FAST REACTIVE PRICE UPDATE:
  // Optimistically updates local React state immediately (0ms) so calculations update live on keystroke/blur
  // without triggering a full page re-fetch or loading spinners.
  const handlePriceChange = (itemId: number, newPrice: number) => {
    setMarketPrices((prev) => ({
      ...prev,
      [itemId]: newPrice,
    }));
    setPriceUpdatedAt((prev) => ({
      ...prev,
      [itemId]: Date.now(),
    }));

    // Async save to database quietly in background
    saveMarketPrice(itemId, newPrice).catch((error) => {
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

  // Handle external selection (e.g. from Global Profit Ranking)
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
      setIsDetailView(true);
    }
  }, [initialSelectedItem]);

  useEffect(() => {
    if (activePresetItem) {
      const storedPrice = marketPrices[activePresetItem.id];
      if (typeof storedPrice === 'number' && storedPrice > 0) {
        setActiveSalePrice(storedPrice);
      } else {
        setActiveSalePrice('');
      }
    } else {
      setActiveSalePrice('');
    }
  }, [activePresetItem?.id, marketPrices[activePresetItem?.id || 0]]);

  // Build recipe tree ONLY when activePresetItem ID changes, NOT on every price edit!
  useEffect(() => {
    if (!activePresetItem) {
      setRecipeTree(null);
      return;
    }

    let isMounted = true;
    setLoadingTree(true);

    buildRecipeTree(activePresetItem.id, 1, 0, 3, new Set(), marketPrices)
      .then((tree) => {
        if (isMounted) {
          setRecipeTree(tree);
          setLoadingTree(false);
        }
      })
      .catch((err) => {
        console.error('Error al construir árbol de receta:', err);
        if (isMounted) setLoadingTree(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activePresetItem?.id]);

  const ITEMS_PER_PAGE = 25;
  const [currentPage, setCurrentPage] = useState<number>(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    selectedJobId,
    minLevel,
    maxLevel,
    searchTerm,
    sortBy,
    onlyProfitable,
    minProfitKamas,
    minRoiPercent,
  ]);

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
        if (selectedJobId !== 'all' && item.jobId !== selectedJobId) {
          return false;
        }
        if (item.level < effMinLevel || item.level > effMaxLevel) {
          return false;
        }
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

  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE) || 1;
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedItems = React.useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
    return filteredItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredItems, safeCurrentPage]);

  useEffect(() => {
    const visibleIds = paginatedItems.map((item) => item.id);
    if (visibleIds.length > 0) {
      resolveMissingItemNamesInBatch(visibleIds, () => {
        setResolvedNamesTrigger((prev) => prev + 1);
      });
    }
  }, [paginatedItems]);

  // Real-time synchronous calculation using marketPrices
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

  const handleSelectItemForDetail = (item: PresetCraftableItem) => {
    setActivePresetItem(item);
    setIsDetailView(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ---------------------------------------------------------------------------
  // VIEW MODE A: DEDICATED FULL-WIDTH ITEM PAGE ("PÁGINA PROPIA" HORIZONTAL)
  // ---------------------------------------------------------------------------
  if (isDetailView && activePresetItem) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto w-full">
        {/* Top Header Navigation Bar */}
        <div className="bg-[#0f0f0f] border border-neutral-800 rounded-xl p-4 flex items-center justify-between gap-4 shadow-lg">
          <button
            onClick={() => setIsDetailView(false)}
            className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 hover:border-amber-500/50 text-amber-400 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>Volver al Catálogo de Recetas</span>
          </button>
        </div>

        {/* Hero Item Banner Card */}
        <div className="bg-[#0f0f0f] border border-neutral-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border-b border-neutral-800 pb-6">
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 bg-[#0a0a0a] border border-neutral-800 rounded-2xl p-3 flex items-center justify-center shrink-0 shadow-inner">
                {getItemIconUrl(activePresetItem) ? (
                  <img
                    src={getItemIconUrl(activePresetItem)}
                    alt={getItemName(activePresetItem)}
                    className="w-14 h-14 object-contain"
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
                  <Wrench className="w-8 h-8 text-neutral-500" />
                )}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl md:text-3xl font-bold font-serif text-white italic tracking-wide">
                    {getItemName(activePresetItem)}
                  </h1>
                  <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 text-xs font-bold font-mono">
                    Nivel {activePresetItem.level}
                  </span>
                </div>
                <div className="flex items-center gap-2 pt-1 flex-wrap text-xs">
                  <span className="px-2.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 font-semibold text-amber-400">
                    Oficio: {activePresetItem.jobNameEs}
                  </span>
                  {getItemTypeName(activePresetItem) && (
                    <span className="px-2.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 font-semibold text-blue-400">
                      Tipo: {getItemTypeName(activePresetItem)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Sale Price Interactive Editor Box */}
            <div className="bg-[#0a0a0a] border border-neutral-800 rounded-xl p-4 text-right w-full md:w-auto shrink-0 shadow-inner">
              <label className="block text-[11px] uppercase font-bold text-neutral-400 mb-1.5 flex items-center justify-end gap-1">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                Precio de Venta Mercadillo
              </label>
              <div className="flex items-center justify-end gap-2">
                <input
                  type="number"
                  value={activeSalePrice}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') {
                      setActiveSalePrice('');
                      handlePriceChange(activePresetItem.id, 0);
                    } else {
                      const num = Math.max(0, Number(val));
                      setActiveSalePrice(num);
                      handlePriceChange(activePresetItem.id, num);
                    }
                  }}
                  placeholder="0"
                  className="w-36 bg-[#0f0f0f] border border-neutral-700 rounded-lg px-3 py-1.5 text-right text-emerald-400 font-mono font-bold text-lg focus:outline-none focus:border-amber-500 transition-colors"
                />
                <span className="text-sm font-bold text-neutral-400">Kamas</span>
              </div>
            </div>
          </div>

          {/* Horizontal Metrics Dashboard (4 KPI Cards Side-by-Side) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-[#0a0a0a] border border-neutral-800 space-y-1 shadow-md">
              <span className="text-xs text-neutral-400 font-bold uppercase tracking-wider block">
                Costo Fabricación Óptimo
              </span>
              <div className="text-2xl font-bold font-mono text-amber-400">
                {autoOptimalCost.toLocaleString()} K
              </div>
              <p className="text-xs text-neutral-500">Ruta más barata calculada</p>
            </div>

            <div className="p-4 rounded-xl bg-[#0a0a0a] border border-neutral-800 space-y-1 shadow-md">
              <span className="text-xs text-neutral-400 font-bold uppercase tracking-wider block">
                Precio Venta Esperado
              </span>
              <div className="text-2xl font-bold font-mono text-emerald-400">
                {effectiveSalePrice.toLocaleString()} K
              </div>
              <p className="text-xs text-neutral-500">Mercadillo actual</p>
            </div>

            <div
              className={`p-4 rounded-xl border space-y-1 shadow-md ${
                netProfit >= 0
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : 'bg-red-500/10 border-red-500/30'
              }`}
            >
              <span className="text-xs text-neutral-300 font-bold uppercase tracking-wider block">
                Ganancia Neta
              </span>
              <div
                className={`text-2xl font-bold font-mono ${
                  netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {netProfit >= 0 ? '+' : ''}
                {netProfit.toLocaleString()} K
              </div>
              <p className="text-xs font-mono text-neutral-400">
                Beneficio limpio por unidad
              </p>
            </div>

            <div
              className={`p-4 rounded-xl border space-y-1 shadow-md ${
                profitMarginPercent >= 0
                  ? 'bg-amber-500/10 border-amber-500/30'
                  : 'bg-red-500/10 border-red-500/30'
              }`}
            >
              <span className="text-xs text-neutral-300 font-bold uppercase tracking-wider block">
                Margen Rentabilidad (ROI)
              </span>
              <div
                className={`text-2xl font-bold font-mono ${
                  profitMarginPercent >= 0 ? 'text-amber-400' : 'text-red-400'
                }`}
              >
                {profitMarginPercent > 0 ? '+' : ''}
                {profitMarginPercent.toFixed(1)}%
              </div>
              <p className="text-xs font-mono text-neutral-400">Retorno sobre inversión</p>
            </div>
          </div>

          {/* Smart Strategy Banner */}
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-amber-400 shrink-0" />
            <div className="text-xs text-amber-200/90 leading-relaxed font-sans">
              {autoOptimalCost < directCraftCost ? (
                <p>
                  Recomendación:{' '}
                  <strong className="text-emerald-400 font-bold">
                    Craftear fabricando los sub-ingredientes
                  </strong>. Ahorras{' '}
                  <strong className="text-emerald-300 font-bold font-mono text-sm">
                    {(directCraftCost - autoOptimalCost).toLocaleString()} Kamas
                  </strong>{' '}
                  en comparación con comprar todo terminado.
                </p>
              ) : (
                <p>
                  Recomendación:{' '}
                  <strong className="text-blue-400 font-bold">
                    Comprar los ingredientes directos en el mercadillo
                  </strong>. No es necesario fabricar sub-crafteos intermedios.
                </p>
              )}
            </div>
          </div>

          {/* Horizontal Ingredients Section */}
          <div className="space-y-4 pt-4 border-t border-neutral-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-5 h-5 text-amber-400" />
                Ingredientes y Precios de Mercadillo
              </h2>
            </div>

            {loadingTree ? (
              <div className="py-16 text-center space-y-3 bg-[#0a0a0a] border border-neutral-800 rounded-xl">
                <RefreshCw className="w-8 h-8 animate-spin text-amber-400 mx-auto" />
                <p className="text-xs text-neutral-400">
                  Cargando receta e ingredientes...
                </p>
              </div>
            ) : recipeTree && recipeTree.subIngredients && recipeTree.subIngredients.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {recipeTree.subIngredients.map((childNode) => (
                  <HorizontalIngredientCard
                    key={childNode.itemId}
                    node={childNode}
                    marketPrices={marketPrices}
                    priceUpdatedAt={priceUpdatedAt}
                    onPriceChange={handlePriceChange}
                  />
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-neutral-500 bg-[#0a0a0a] border border-neutral-800 rounded-xl">
                Este objeto no posee receta de fabricación registrada o es un recurso base.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // VIEW MODE B: FULL CATALOG & SEARCH PAGE (MODO CATÁLOGO)
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-5 max-w-7xl mx-auto w-full">
      {/* Job Selection Cards Bar */}
      <div className="bg-[#0f0f0f] border border-neutral-800 rounded-xl p-3 shadow-lg space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-neutral-300 flex items-center gap-1.5 uppercase tracking-wider">
            <Wrench className="w-4 h-4 text-amber-400" />
            Selecciona un Oficio
          </span>
          <span className="text-[11px] font-mono text-neutral-500">
            {selectedJobId === 'all'
              ? 'Todos los oficios'
              : `Oficio ID: #${selectedJobId}`}
          </span>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          <button
            onClick={() => setSelectedJobId('all')}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
              selectedJobId === 'all'
                ? 'bg-amber-500 text-black font-bold shadow-md shadow-amber-500/20'
                : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800 hover:border-neutral-700'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Todos ({DOFUS_JOBS.length})</span>
          </button>

          {DOFUS_JOBS.map((job) => {
            const isSelected = selectedJobId === job.id;
            const JobIcon = JOB_ICON_MAP[job.icon] || Wrench;
            return (
              <button
                key={job.id}
                onClick={() => setSelectedJobId(job.id)}
                className={`px-2.5 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
                  isSelected
                    ? 'bg-amber-500 text-black font-bold shadow-md shadow-amber-500/20'
                    : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800 hover:border-neutral-700'
                }`}
              >
                <JobIcon className="w-3.5 h-3.5" />
                <span>{job.nameEs}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-[#0f0f0f] border border-neutral-800 rounded-xl p-4 space-y-4 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-3">
          <div className="flex items-center gap-2.5">
            <Wrench className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                Catálogo de Recetas
                <span className="text-xs text-amber-400 font-mono px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                  {filteredItems.length} Objetos
                </span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <label className="inline-flex items-center gap-1.5 cursor-pointer bg-neutral-900 px-3 py-1.5 rounded-lg border border-neutral-800 text-neutral-300 hover:text-white transition-colors">
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

        {/* Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          <div>
            <label className="block text-neutral-400 font-medium mb-1 flex items-center gap-1">
              <Search className="w-3.5 h-3.5 text-amber-400" />
              Buscar Objeto
            </label>
            <input
              type="text"
              placeholder="ej. Gelano, Sombrero..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white placeholder-neutral-500 focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-neutral-400 font-medium mb-1 flex items-center gap-1">
              <Tag className="w-3.5 h-3.5 text-amber-400" />
              Rango de Nivel
            </label>
            <select
              value={`${minLevel}-${maxLevel}`}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'all') {
                  setMinLevel(1);
                  setMaxLevel(200);
                } else {
                  const [min, max] = val.split('-').map(Number);
                  setMinLevel(min);
                  setMaxLevel(max);
                }
              }}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white font-medium focus:border-amber-500 focus:outline-none"
            >
              <option value="all">Todos los Niveles (1-200)</option>
              <option value="1-50">Nivel 1 - 50</option>
              <option value="51-100">Nivel 51 - 100</option>
              <option value="101-150">Nivel 101 - 150</option>
              <option value="151-200">Nivel 151 - 200</option>
            </select>
          </div>

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

          <div>
            <label className="block text-neutral-400 font-medium mb-1">ROI Mínimo (%)</label>
            <input
              type="number"
              value={minRoiPercent}
              onChange={(e) => {
                const val = e.target.value;
                setMinRoiPercent(val === '' ? '' : Number(val));
              }}
              placeholder="0"
              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white font-mono focus:border-amber-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Catalog Items List Grid (25 items per page) */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedItems.map((item) => {
            const metrics = getItemMetrics(item);
            const itemName = getItemName(item);
            const iconUrl = getItemIconUrl(item);
            const jobBadgeClass = getJobBadgeStyle(item.jobNameEs);

            return (
              <div
                key={item.id}
                onClick={() => handleSelectItemForDetail(item)}
                className="bg-[#0f0f0f] border border-neutral-800 hover:border-amber-500/60 rounded-2xl p-4 transition-all cursor-pointer shadow-lg hover:shadow-amber-500/10 group flex flex-col justify-between gap-4"
              >
                <div className="flex items-start gap-3">
                  <div className="w-14 h-14 rounded-xl bg-[#0a0a0a] border border-neutral-800 p-1.5 flex items-center justify-center shrink-0 group-hover:border-amber-500/40 transition-colors shadow-inner">
                    {iconUrl ? (
                      <img
                        src={iconUrl}
                        alt={itemName}
                        className="w-11 h-11 object-contain"
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
                      <Wrench className="w-6 h-6 text-neutral-500" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-extrabold text-white text-base leading-snug truncate group-hover:text-amber-400 transition-colors">
                        {itemName}
                      </span>
                      <span className="text-xs font-bold font-mono px-2.5 py-0.5 rounded-full bg-neutral-900 text-amber-400 border border-neutral-800 shrink-0">
                        Niv. {item.level}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${jobBadgeClass}`}>
                        {item.jobNameEs}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-[#0a0a0a] border border-neutral-800/80 rounded-xl p-3 grid grid-cols-3 gap-2 text-center font-mono">
                  <div>
                    <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-0.5">Costo</span>
                    <span className="text-sm font-bold text-neutral-200">
                      {metrics.cost > 0 ? `${metrics.cost.toLocaleString()} K` : '---'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-0.5">Venta</span>
                    <span className="text-sm font-bold text-amber-300">
                      {metrics.salePrice > 0 ? `${metrics.salePrice.toLocaleString()} K` : '---'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-0.5">Ganancia</span>
                    <span
                      className={`text-sm font-extrabold block ${
                        metrics.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {metrics.salePrice > 0
                        ? `${metrics.netProfit >= 0 ? '+' : ''}${metrics.netProfit.toLocaleString()} K`
                        : '---'}
                    </span>
                  </div>
                </div>

                <div className="pt-0.5 flex items-center justify-between text-xs text-amber-400 font-bold group-hover:translate-x-1 transition-transform">
                  <span className="flex items-center gap-1.5">
                    {metrics.roi > 0 && (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[11px] font-mono border border-emerald-500/30 font-bold">
                        +{metrics.roi.toFixed(0)}% ROI
                      </span>
                    )}
                    <span>Ver Receta y Desglose</span>
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            );
          })}
        </div>

        {filteredItems.length === 0 && (
          <div className="p-12 text-center bg-[#0f0f0f] border border-neutral-800 rounded-xl text-neutral-400 text-xs">
            No se encontraron objetos con los filtros seleccionados.
          </div>
        )}

        {/* Catalog Pagination Controls */}
        {filteredItems.length > 0 && (
          <div className="bg-[#0f0f0f] border border-neutral-800 rounded-xl px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shadow-md">
            <span className="text-neutral-400 font-mono">
              Mostrando{' '}
              <strong className="text-white">
                {(safeCurrentPage - 1) * ITEMS_PER_PAGE + 1}
              </strong>{' '}
              a{' '}
              <strong className="text-white">
                {Math.min(safeCurrentPage * ITEMS_PER_PAGE, filteredItems.length)}
              </strong>{' '}
              de <strong className="text-amber-400">{filteredItems.length}</strong> Objetos
            </span>

            <div className="flex items-center gap-2">
              <button
                disabled={safeCurrentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-amber-500/50 disabled:opacity-40 disabled:hover:border-neutral-800 text-neutral-300 font-medium flex items-center gap-1 transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Atrás</span>
              </button>

              <span className="px-3 font-mono text-neutral-400 text-xs">
                Página <strong className="text-amber-400">{safeCurrentPage}</strong> de{' '}
                {totalPages}
              </span>

              <button
                disabled={safeCurrentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-amber-500/50 disabled:opacity-40 disabled:hover:border-neutral-800 text-neutral-300 font-medium flex items-center gap-1 transition-all"
              >
                <span>Siguiente</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// HORIZONTAL INGREDIENT CARD COMPONENT
// -----------------------------------------------------------------------------
interface HorizontalIngredientCardProps {
  node: RecipeTreeNode;
  marketPrices: MarketPriceMap;
  priceUpdatedAt: Record<number, number>;
  onPriceChange: (itemId: number, newPrice: number) => void;
}

const HorizontalIngredientCard: React.FC<HorizontalIngredientCardProps> = ({
  node,
  marketPrices,
  priceUpdatedAt,
  onPriceChange,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const currentPrice = marketPrices[node.itemId] || node.marketPrice || 0;
  const [draftPrice, setDraftPrice] = useState<string | null>(null);

  const totalPriceForQuantity = currentPrice * node.quantity;
  const hasSubCraft =
    node.isCraftable && node.subIngredients && node.subIngredients.length > 0;

  const directBuyCost = totalPriceForQuantity;
  const subCraftCost = hasSubCraft
    ? calculateTreeCraftCost(node, 'auto_optimal', marketPrices)
    : directBuyCost;

  const isSubcraftCheaper = hasSubCraft && subCraftCost < directBuyCost;
  const savings = Math.abs(directBuyCost - subCraftCost);

  return (
    <div className="bg-[#0a0a0a] border border-neutral-800 hover:border-amber-500/40 rounded-2xl p-4 space-y-3.5 text-xs shadow-lg flex flex-col justify-between">
      <div className="space-y-3">
        {/* Header with Icon, Quantity and Name */}
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-[#0f0f0f] border border-neutral-800 p-1 flex items-center justify-center shrink-0 shadow-inner">
              {getItemIconUrl(node.item) ? (
                <img
                  src={getItemIconUrl(node.item)}
                  alt={getItemName(node.item)}
                  className="w-9 h-9 object-contain"
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
                <span className="font-mono text-amber-400 font-bold text-xs">
                  x{node.quantity}
                </span>
              )}
            </div>

            <div className="min-w-0">
              <span className="font-extrabold text-white text-sm sm:text-base block truncate leading-tight">
                {getItemName(node.item)}
              </span>
            </div>
          </div>

          <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 font-extrabold font-mono text-xs shrink-0 shadow-sm">
            x{node.quantity}
          </span>
        </div>

        {/* Real-time Interactive Unit Price Editor */}
        <div className="bg-[#0f0f0f] border border-neutral-800/90 rounded-xl p-3 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-semibold text-neutral-300">
            <span>Precio Unitario:</span>
            <span className="font-mono font-bold text-amber-400">Kamas</span>
          </div>
          <input
            type="number"
            value={draftPrice !== null ? draftPrice : currentPrice > 0 ? currentPrice : ''}
            onChange={(e) => {
              const val = e.target.value;
              setDraftPrice(val);
              // Live reactive calculation on typing
              const numericVal = val === '' ? 0 : Number(val);
              onPriceChange(node.itemId, numericVal);
            }}
            onBlur={() => {
              const nextValue =
                draftPrice === null ? currentPrice : draftPrice === '' ? 0 : Number(draftPrice);
              onPriceChange(node.itemId, nextValue);
              setDraftPrice(null);
            }}
            placeholder="0"
            className="w-full bg-[#0a0a0a] border border-neutral-700 rounded-lg px-3 py-1.5 text-right text-amber-300 font-mono font-extrabold text-base focus:outline-none focus:border-amber-400 transition-colors"
          />
        </div>
      </div>

      <div className="space-y-2.5 pt-2 border-t border-neutral-800">
        {/* Total Cost for required quantity */}
        <div className="flex items-center justify-between font-mono">
          <span className="text-xs font-semibold text-neutral-400">Subtotal ({node.quantity}x):</span>
          <span className="text-emerald-400 font-extrabold text-base">
            {totalPriceForQuantity.toLocaleString()} K
          </span>
        </div>

        {/* Sub-crafting badge & Toggle */}
        {hasSubCraft && (
          <div className="pt-1">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full py-1.5 px-2 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-amber-500/40 text-neutral-300 hover:text-white text-[11px] font-semibold flex items-center justify-between transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <span className="text-amber-400">⚙️</span>
                <span>Sub-receta ({node.subIngredients?.length})</span>
              </span>
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-amber-400" />
              )}
            </button>

            {isExpanded && node.subIngredients && (
              <div className="mt-2 space-y-2 pl-1 border-l-2 border-amber-500/30">
                {node.subIngredients.map((sub) => (
                  <SubIngredientRow
                    key={sub.itemId}
                    sub={sub}
                    marketPrices={marketPrices}
                    onPriceChange={onPriceChange}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// SUB-INGREDIENT ROW COMPONENT (EDITABLE PRICES FOR SUB-RECIPES)
// -----------------------------------------------------------------------------
interface SubIngredientRowProps {
  sub: RecipeTreeNode;
  marketPrices: MarketPriceMap;
  onPriceChange: (itemId: number, newPrice: number) => void;
}

const SubIngredientRow: React.FC<SubIngredientRowProps> = ({
  sub,
  marketPrices,
  onPriceChange,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const currentPrice = marketPrices[sub.itemId] || sub.marketPrice || 0;
  const [draftPrice, setDraftPrice] = useState<string | null>(null);

  const displayPrice =
    draftPrice !== null ? draftPrice : currentPrice > 0 ? currentPrice : '';
  const subTotal = currentPrice * sub.quantity;
  const hasSubSubCraft =
    sub.isCraftable && sub.subIngredients && sub.subIngredients.length > 0;

  return (
    <div className="bg-[#0f0f0f] border border-neutral-800 rounded-lg p-2.5 space-y-2 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded bg-[#0a0a0a] border border-neutral-800 p-0.5 flex items-center justify-center shrink-0">
            {getItemIconUrl(sub.item) ? (
              <img
                src={getItemIconUrl(sub.item)}
                alt={getItemName(sub.item)}
                className="w-5 h-5 object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <span className="text-[10px] text-amber-400 font-mono font-bold">
                x{sub.quantity}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <span className="text-xs font-bold text-white block truncate">
              {getItemName(sub.item)}
            </span>
          </div>
        </div>
        <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold font-mono text-xs shrink-0">
          x{sub.quantity}
        </span>
      </div>

      <div className="bg-[#0a0a0a] border border-neutral-800/90 rounded p-2 flex items-center justify-between gap-2 text-xs font-mono">
        <span className="text-neutral-400 text-[11px]">Precio U.:</span>
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={displayPrice}
            onChange={(e) => {
              const val = e.target.value;
              setDraftPrice(val);
              const numericVal = val === '' ? 0 : Number(val);
              onPriceChange(sub.itemId, numericVal);
            }}
            onBlur={() => {
              const nextVal =
                draftPrice === null
                  ? currentPrice
                  : draftPrice === ''
                  ? 0
                  : Number(draftPrice);
              onPriceChange(sub.itemId, nextVal);
              setDraftPrice(null);
            }}
            placeholder="0"
            className="w-24 bg-[#0f0f0f] border border-neutral-700 focus:border-amber-500 rounded px-2 py-1 text-right font-bold text-amber-400 text-xs focus:outline-none"
          />
          <span className="text-neutral-400 font-bold">K</span>
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] font-mono px-0.5">
        <span className="text-neutral-400">Total ({sub.quantity}x):</span>
        <span className="text-emerald-400 font-bold">
          {subTotal.toLocaleString()} K
        </span>
      </div>

      {hasSubSubCraft && (
        <div className="pt-1 border-t border-neutral-800/60">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full py-1 px-2 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-[10px] font-semibold flex items-center justify-between transition-colors"
          >
            <span>Sub-ingredientes ({sub.subIngredients?.length})</span>
            {isExpanded ? (
              <ChevronDown className="w-3 h-3 text-amber-400" />
            ) : (
              <ChevronRight className="w-3 h-3 text-amber-400" />
            )}
          </button>
          {isExpanded && sub.subIngredients && (
            <div className="mt-2 space-y-2 pl-1 border-l-2 border-amber-500/30">
              {sub.subIngredients.map((childSub) => (
                <SubIngredientRow
                  key={childSub.itemId}
                  sub={childSub}
                  marketPrices={marketPrices}
                  onPriceChange={onPriceChange}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
