import React from 'react';
import {
  Search,
  X,
  Filter,
  List,
  LayoutGrid,
  Layers,
  Package,
  Hammer,
  ArrowUpDown,
  BarChart2,
  Sparkles,
  Zap,
  AlertCircle,
  Tag,
} from 'lucide-react';
import { groupPriceProfilesByCategory } from '../../utils/serverUtils';
import {
  PriceFilterCategory,
  ItemScopeFilter,
  SortByField,
  GATHERING_CATEGORIES,
} from './types';

interface PriceManagerFiltersProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  priceProfiles: Array<{ id: number; name: string; category?: string }>;
  activePriceProfileId: number;
  onChangeProfile: (profileId: number) => void;
  viewMode: 'table' | 'grid';
  setViewMode: (mode: 'table' | 'grid') => void;
  filteredCount: number;
  totalScopeCount: number;
  activeScope: ItemScopeFilter;
  setActiveScope: (scope: ItemScopeFilter) => void;
  scopeCounts: { all: number; resources: number; craftable: number };
  sortByField: SortByField;
  setSortByField: (field: SortByField) => void;
  activeCategory: PriceFilterCategory;
  setActiveCategory: (cat: PriceFilterCategory) => void;
  categoryCounts: Record<string, number>;
}

export const PriceManagerFilters: React.FC<PriceManagerFiltersProps> = ({
  searchTerm,
  setSearchTerm,
  priceProfiles,
  activePriceProfileId,
  onChangeProfile,
  viewMode,
  setViewMode,
  filteredCount,
  totalScopeCount,
  activeScope,
  setActiveScope,
  scopeCounts,
  sortByField,
  setSortByField,
  activeCategory,
  setActiveCategory,
  categoryCounts,
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-lg">
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_220px_auto] gap-3">
        {/* Search input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar recurso por nombre o ID..."
            className="w-full pl-10 pr-10 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-medium text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors shadow-inner font-sans"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3.5 top-2.5 text-slate-500 hover:text-slate-300 p-0.5 rounded"
              title="Limpiar búsqueda"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Profile select */}
        <select
          value={activePriceProfileId}
          onChange={(event) => {
            onChangeProfile(Number(event.target.value));
          }}
          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-slate-200 focus:outline-none focus:border-amber-500 shadow-inner cursor-pointer"
          title="Servidor o perfil de precios"
        >
          {groupPriceProfilesByCategory(priceProfiles as any).map((group) => (
            <optgroup
              key={group.category}
              label={`── ${group.label} ──`}
              className="bg-slate-950 text-amber-400 font-bold"
            >
              {group.profiles.map((profile) => (
                <option
                  key={profile.id}
                  value={profile.id}
                  className="bg-slate-900 text-slate-100 font-normal py-1"
                >
                  {profile.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase tracking-wider flex-wrap gap-2">
          <span className="flex items-center gap-1.5 text-amber-400">
            <Filter className="w-3.5 h-3.5" /> Categorías y Filtros
          </span>
          <div className="flex items-center gap-3">
            {/* View Mode Toggle: Tabla / Tarjetas */}
            <div className="flex items-center bg-slate-950 p-0.5 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-amber-500/20 text-amber-300 shadow-sm border border-amber-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Vista en tabla / lista detallada"
              >
                <List className="w-3.5 h-3.5" />
                <span>Tabla</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-amber-500/20 text-amber-300 shadow-sm border border-amber-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Vista en cuadrícula de tarjetas"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Tarjetas</span>
              </button>
            </div>

            <span className="text-slate-400 font-mono text-[11px] font-bold">
              {filteredCount} / {totalScopeCount} Objetos
            </span>
          </div>
        </div>

        {/* Scope Pre-Filter: Tipo de Item */}
        <div className="space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <Layers className="w-3 h-3 inline mr-1" />
            Tipo de Item
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setActiveScope('resources_only')}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeScope === 'resources_only'
                  ? 'bg-teal-500/20 border-teal-500 text-teal-300 shadow-md font-black ring-1 ring-teal-400/50'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-teal-300 hover:border-teal-500/40'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              Solo Recursos ({scopeCounts.resources})
            </button>
            <button
              onClick={() => setActiveScope('craftable_only')}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeScope === 'craftable_only'
                  ? 'bg-violet-500/20 border-violet-500 text-violet-300 shadow-md font-black ring-1 ring-violet-400/50'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-violet-300 hover:border-violet-500/40'
              }`}
            >
              <Hammer className="w-3.5 h-3.5" />
              Solo Crafteables ({scopeCounts.craftable})
            </button>
            <button
              onClick={() => setActiveScope('all_scope')}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                activeScope === 'all_scope'
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm font-black'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Todos ({scopeCounts.all})
            </button>
          </div>
        </div>

        {/* Sort by Sales */}
        <div className="space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <ArrowUpDown className="w-3 h-3 inline mr-1" />
            Ordenar por Ventas
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { id: 'sales24h' as SortByField, label: 'Más vendidos 24h' },
              { id: 'sales7d' as SortByField, label: 'Más vendidos 7d' },
              { id: 'sales30d' as SortByField, label: 'Más vendidos 30d' },
              { id: 'avgDaily' as SortByField, label: 'Promedio diario' },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => setSortByField(sortByField === opt.id ? 'default' : opt.id)}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all flex items-center gap-1 ${
                  sortByField === opt.id
                    ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-sm font-black'
                    : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-700'
                }`}
              >
                <BarChart2 className="w-3 h-3" />
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Gathering Categories */}
        <div className="space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Recolección
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
            {GATHERING_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.id;
              const count = categoryCounts[cat.id] || 0;
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setActiveCategory(isActive ? 'all' : cat.id);
                  }}
                  className={`p-2 rounded-xl border text-left text-xs font-bold transition-all flex items-center justify-between gap-1.5 ${
                    isActive
                      ? `${cat.color} border-current shadow-md bg-amber-500/20 text-amber-300 font-black`
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <Icon
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isActive ? 'text-amber-400' : 'text-slate-400'
                      }`}
                    />
                    <span className="truncate text-xs">{cat.label}</span>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/40 border border-slate-800 text-slate-300">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Production & Use Categories */}
        <div className="space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Producción y uso
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setActiveCategory('dofus')}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeCategory === 'dofus'
                  ? 'bg-amber-500/25 border-amber-400 text-amber-200 shadow-md font-black ring-1 ring-amber-400/50'
                  : 'bg-slate-950 border-slate-800 text-amber-400 hover:text-amber-300 hover:border-amber-500/40'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Dofus ({categoryCounts.dofus})
            </button>
            <button
              onClick={() => setActiveCategory('runes')}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeCategory === 'runes'
                  ? 'bg-purple-500/20 border-purple-500 text-purple-300 shadow-sm font-black'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-purple-400" />
              Runas Base ({categoryCounts.runes})
            </button>
            <button
              onClick={() => setActiveCategory('equipment')}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                activeCategory === 'equipment'
                  ? 'bg-sky-500/20 border-sky-500 text-sky-300 shadow-sm font-black'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Equipables ({categoryCounts.equipment})
            </button>
            <button
              onClick={() => setActiveCategory('craft_ingredients')}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeCategory === 'craft_ingredients'
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm font-black'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Hammer className="w-3.5 h-3.5 text-amber-400" />
              Ingredientes ({categoryCounts.craft_ingredients})
            </button>
            <button
              onClick={() => setActiveCategory('monsters')}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                activeCategory === 'monsters'
                  ? 'bg-orange-500/20 border-orange-500 text-orange-300 shadow-sm font-black'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Monstruos ({categoryCounts.monsters})
            </button>
          </div>
        </div>

        {/* Price State Filter */}
        <div className="space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Estado de Precios
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setActiveCategory('without_price')}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeCategory === 'without_price'
                  ? 'bg-rose-500/20 border-rose-500 text-rose-300 shadow-sm font-black'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
              Sin precio ({categoryCounts.without_price})
            </button>
            <button
              onClick={() => setActiveCategory('has_price')}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeCategory === 'has_price'
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm font-black'
                  : 'bg-slate-950 border-slate-800 text-emerald-400 hover:text-white'
              }`}
            >
              <Tag className="w-3.5 h-3.5 text-emerald-400" />
              Con precio ({categoryCounts.has_price})
            </button>
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                activeCategory === 'all'
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm font-black'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Todo ({categoryCounts.all})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
