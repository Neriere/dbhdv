import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Filter,
  Sparkles,
  Zap,
  Wrench,
  ShoppingCart,
  ArrowUpDown,
  Coins,
  ShieldCheck,
  Search,
} from 'lucide-react';
import { DofusItem, ArbitrageOpportunity } from '../types';
import {
  getAllLocalItems,
  getRecipeByResultId,
  getStoredItemPrice,
  calculateItemCraftCost,
  calculateEstimatedRunesValue,
  addToShoppingList,
  getItemIconUrl,
  getItemFallbackIconUrl,
} from '../services/dofusDbService';
import { matchesSearchQuery } from '../utils/searchUtils';
import { SafeImage } from './SafeImage';
import { KamaDisplay } from './common/KamaDisplay';

interface ArbitrageOpportunitiesProps {
  onSelectRecipeForCalculator: (item: DofusItem) => void;
  onSelectForCrushing: (item: DofusItem) => void;
  onOpenShoppingList?: () => void;
}

export const ArbitrageOpportunities: React.FC<ArbitrageOpportunitiesProps> = ({
  onSelectRecipeForCalculator,
  onSelectForCrushing,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [minProfit, setMinProfit] = useState<number>(10000);
  const [minRoi, setMinRoi] = useState<number>(20);
  const [minLevel, setMinLevel] = useState<number>(50);
  const [maxLevel, setMaxLevel] = useState<number>(200);
  const [strategyFilter, setStrategyFilter] = useState<'all' | 'craft_flip' | 'craft_crush' | 'hdv_crush'>('all');
  const [sortBy, setSortBy] = useState<'profit' | 'roi' | 'level'>('profit');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [addedNotice, setAddedNotice] = useState<string | null>(null);

  const allItems = useMemo(() => getAllLocalItems(), []);

  // Compute arbitrage matrix for all items
  const opportunities = useMemo(() => {
    const list: ArbitrageOpportunity[] = [];

    for (const item of allItems) {
      if (item.level < minLevel || item.level > maxLevel) continue;

      const recipe = getRecipeByResultId(item.id);
      const hdvSellPrice = getStoredItemPrice(item.id);
      const craftCost = recipe ? calculateItemCraftCost(item.id) : 0;
      const runeValue = calculateEstimatedRunesValue(item);

      // Strategy 1: Craft -> Sell on HDV
      const craftFlipProfit = (craftCost > 0 && hdvSellPrice > 0) ? (hdvSellPrice - craftCost) : 0;
      const craftFlipRoi = (craftCost > 0 && craftFlipProfit > 0) ? Math.round((craftFlipProfit / craftCost) * 100) : 0;

      // Strategy 2: Craft -> Crush to Runes
      const craftRuneProfit = (craftCost > 0 && runeValue > 0) ? (runeValue - craftCost) : 0;
      const craftRuneRoi = (craftCost > 0 && craftRuneProfit > 0) ? Math.round((craftRuneProfit / craftCost) * 100) : 0;

      // Strategy 3: Buy on HDV -> Crush to Runes
      const hdvRuneProfit = (hdvSellPrice > 0 && runeValue > 0) ? (runeValue - hdvSellPrice) : 0;
      const hdvRuneRoi = (hdvSellPrice > 0 && hdvRuneProfit > 0) ? Math.round((hdvRuneProfit / hdvSellPrice) * 100) : 0;

      let bestStrategy: 'craft_flip' | 'craft_crush' | 'hdv_crush' | 'none' = 'none';
      let bestProfit = 0;
      let bestRoi = 0;

      if (craftFlipProfit > bestProfit) {
        bestProfit = craftFlipProfit;
        bestRoi = craftFlipRoi;
        bestStrategy = 'craft_flip';
      }
      if (craftRuneProfit > bestProfit) {
        bestProfit = craftRuneProfit;
        bestRoi = craftRuneRoi;
        bestStrategy = 'craft_crush';
      }
      if (hdvRuneProfit > bestProfit) {
        bestProfit = hdvRuneProfit;
        bestRoi = hdvRuneRoi;
        bestStrategy = 'hdv_crush';
      }

      if (bestProfit >= minProfit && bestRoi >= minRoi) {
        if (strategyFilter === 'all' || strategyFilter === bestStrategy) {
          list.push({
            item,
            recipe,
            craftCost,
            hdvSellPrice,
            runeEstimatedValue: runeValue,
            craftFlipProfit,
            craftFlipRoi,
            craftRuneProfit,
            craftRuneRoi,
            hdvRuneProfit,
            hdvRuneRoi,
            bestStrategy,
            bestProfit,
            bestRoi,
          });
        }
      }
    }

    return list;
  }, [allItems, minProfit, minRoi, minLevel, maxLevel, strategyFilter]);

  const filteredAndSortedOpportunities = useMemo(() => {
    let filtered = opportunities;

    if (searchTerm.trim()) {
      filtered = filtered.filter((op) =>
        matchesSearchQuery([op.item.id, op.item.name?.es, op.item.type?.name?.es], searchTerm)
      );
    }

    return filtered.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'profit') comparison = a.bestProfit - b.bestProfit;
      else if (sortBy === 'roi') comparison = a.bestRoi - b.bestRoi;
      else if (sortBy === 'level') comparison = a.item.level - b.item.level;

      return sortOrder === 'desc' ? -comparison : comparison;
    });
  }, [opportunities, searchTerm, sortBy, sortOrder]);

  const handleAddToList = (item: DofusItem) => {
    addToShoppingList(item, 1);
    setAddedNotice(`¡${item.name?.es} añadido a la Lista de Compras!`);
    setTimeout(() => setAddedNotice(null), 2500);
  };

  const getStrategyBadge = (strat: ArbitrageOpportunity['bestStrategy']) => {
    switch (strat) {
      case 'craft_flip':
        return (
          <span className="px-2.5 py-1 bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm">
            <Wrench className="w-3.5 h-3.5" /> Craft & Flip (Venta HDV)
          </span>
        );
      case 'craft_crush':
        return (
          <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm">
            <Zap className="w-3.5 h-3.5" /> Craft & Romper (Runas)
          </span>
        );
      case 'hdv_crush':
        return (
          <span className="px-2.5 py-1 bg-blue-500/10 text-blue-300 border border-blue-500/30 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm">
            <Coins className="w-3.5 h-3.5" /> Comprar HDV & Romper
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/40 border border-slate-800 p-5 sm:p-6 rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-lg shadow-emerald-500/10">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Oportunidades de Arbitraje & Mercado
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Cruza precios de Crafteo, Venta HDV y Retorno de Runas para detectar márgenes netos inmediatos.
            </p>
          </div>
        </div>

        {addedNotice && (
          <div className="px-4 py-2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-black flex items-center gap-2 animate-pulse">
            <Sparkles className="w-4 h-4" /> {addedNotice}
          </div>
        )}
      </div>

      {/* Filter Controls */}
      <div className="bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-3xl shadow-md space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          {/* Search */}
          <div className="relative">
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Buscar Objeto
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Nombre o ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold text-white outline-none focus:border-amber-500 transition-colors"
              />
            </div>
          </div>

          {/* Strategy Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Estrategia
            </label>
            <select
              value={strategyFilter}
              onChange={(e) => setStrategyFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold text-white outline-none focus:border-amber-500"
            >
              <option value="all">Todas las Estrategias</option>
              <option value="craft_flip">Craft & Flip (Venta HDV)</option>
              <option value="craft_crush">Craft & Romper (Runas)</option>
              <option value="hdv_crush">Comprar HDV & Romper</option>
            </select>
          </div>

          {/* Min Profit */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Beneficio Mínimo
            </label>
            <select
              value={minProfit}
              onChange={(e) => setMinProfit(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold text-white outline-none focus:border-amber-500"
            >
              <option value="0">Sin Mínimo</option>
              <option value="5000">+5.000 K</option>
              <option value="10000">+10.000 K</option>
              <option value="50000">+50.000 K</option>
              <option value="100000">+100.000 K</option>
              <option value="500000">+500.000 K</option>
            </select>
          </div>

          {/* Min ROI */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              ROI Mínimo (%)
            </label>
            <select
              value={minRoi}
              onChange={(e) => setMinRoi(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold text-white outline-none focus:border-amber-500"
            >
              <option value="0">Cualquiera</option>
              <option value="15">+15% ROI</option>
              <option value="30">+30% ROI</option>
              <option value="50">+50% ROI</option>
              <option value="100">+100% ROI</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Ordenar Por
            </label>
            <div className="flex items-center gap-1.5">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold text-white outline-none focus:border-amber-500"
              >
                <option value="profit">Beneficio Neto</option>
                <option value="roi">Retorno ROI %</option>
                <option value="level">Nivel</option>
              </select>
              <button
                onClick={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                className="p-2 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-xl transition-colors shrink-0"
                title="Invertir Orden"
              >
                <ArrowUpDown className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Opportunities List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1 text-xs text-slate-400">
          <span>
            Mostrando <strong>{filteredAndSortedOpportunities.length}</strong> oportunidades detectadas
          </span>
          <span className="flex items-center gap-1 text-emerald-400 font-bold">
            <ShieldCheck className="w-3.5 h-3.5" /> Basado en tus precios registrados de perfil
          </span>
        </div>

        {filteredAndSortedOpportunities.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-12 text-center text-slate-400 space-y-2">
            <Filter className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="font-bold text-white">No se encontraron oportunidades con los filtros seleccionados.</p>
            <p className="text-xs text-slate-500">
              Prueba reduciendo el beneficio mínimo o asegurándote de haber cotizado precios en la pestaña de Precios.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredAndSortedOpportunities.map((op) => {
              return (
                <div
                  key={op.item.id}
                  className="bg-slate-900 border border-slate-800/90 rounded-3xl p-4 sm:p-5 hover:border-slate-700 transition-all flex flex-col justify-between gap-4 shadow-lg group relative overflow-hidden"
                >
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 bg-slate-950 border border-slate-800 rounded-2xl p-1 shrink-0 flex items-center justify-center shadow-inner">
                          <SafeImage
                            src={getItemIconUrl(op.item)}
                            fallbackSrc={getItemFallbackIconUrl(op.item)}
                            alt={op.item.name?.es || ''}
                            className="w-10 h-10 object-contain"
                          />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-white text-sm sm:text-base truncate group-hover:text-amber-300 transition-colors">
                            {op.item.name?.es}
                          </h4>
                          <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                            <span>Nv. {op.item.level}</span>
                            <span>•</span>
                            <span className="truncate">{op.item.type?.name?.es}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Best Strategy Badge & Profit */}
                    <div className="p-3 bg-slate-950/80 border border-slate-800/80 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between">
                        {getStrategyBadge(op.bestStrategy)}
                        <span className="text-xs px-2 py-0.5 bg-emerald-500/20 text-emerald-300 font-black rounded-lg">
                          +{op.bestRoi}% ROI
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/50">
                        <span className="text-slate-400 font-medium">Beneficio Neto:</span>
                        <span className="font-black text-emerald-400 text-sm">
                          +<KamaDisplay amount={op.bestProfit} />
                        </span>
                      </div>
                    </div>

                    {/* Price Breakdown Grid */}
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="p-2 bg-slate-950/50 border border-slate-800/50 rounded-xl">
                        <div className="text-[10px] text-slate-500 font-bold uppercase">Costo Craft</div>
                        <div className="font-bold text-slate-300 mt-0.5">
                          <KamaDisplay amount={op.craftCost} size="sm" />
                        </div>
                      </div>
                      <div className="p-2 bg-slate-950/50 border border-slate-800/50 rounded-xl">
                        <div className="text-[10px] text-slate-500 font-bold uppercase">Venta HDV</div>
                        <div className="font-bold text-slate-300 mt-0.5">
                          <KamaDisplay amount={op.hdvSellPrice} size="sm" />
                        </div>
                      </div>
                      <div className="p-2 bg-slate-950/50 border border-slate-800/50 rounded-xl">
                        <div className="text-[10px] text-slate-500 font-bold uppercase">Runas Est.</div>
                        <div className="font-bold text-amber-300 mt-0.5">
                          <KamaDisplay amount={op.runeEstimatedValue} size="sm" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-800/60 justify-end">
                    {op.recipe && (
                      <button
                        onClick={() => onSelectRecipeForCalculator(op.item)}
                        className="px-2.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                        title="Ver Receta"
                      >
                        <Wrench className="w-3.5 h-3.5" />
                        <span>Receta</span>
                      </button>
                    )}

                    <button
                      onClick={() => onSelectForCrushing(op.item)}
                      className="px-2.5 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                      title="Simular Rompedora"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>Romper</span>
                    </button>

                    {op.recipe && (
                      <button
                        onClick={() => handleAddToList(op.item)}
                        className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-xl transition-all"
                        title="Añadir a Lista de Compras"
                      >
                        <ShoppingCart className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
