import React from 'react';
import {
  Layers,
  Sparkles,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  Search,
  X,
  ArrowUpDown,
  Clock,
  Flame,
  Droplet,
  Wind,
  CircleDot,
  Zap,
  ArrowRight,
  Sword,
  Target,
  Footprints,
  Eye,
  Shield,
  Moon,
  Heart,
} from 'lucide-react';
import { BASE_RUNES_BY_ID } from '../../data/dofusRuneWeights';
import {
  DateFilterOption,
  SortOption,
  StatFilterDef,
} from './types';
import {
  EQUIPMENT_SLOTS,
  STAT_FILTERS_DAMAGES,
  STAT_FILTERS_RESISTANCES,
  STAT_FILTERS_CHARACTERISTICS,
  ALL_STAT_FILTERS,
} from './utils';

interface CrushingCatalogFiltersProps {
  selectedSlots: string[];
  onToggleSlot: (slotId: string) => void;
  minLevel: number | '';
  setMinLevel: (val: number | '') => void;
  maxLevel: number | '';
  setMaxLevel: (val: number | '') => void;
  minCoeff: number | '';
  setMinCoeff: (val: number | '') => void;
  maxCoeff: number | '';
  setMaxCoeff: (val: number | '') => void;
  dateFilter: DateFilterOption;
  setDateFilter: (df: DateFilterOption) => void;
  isStatsFilterOpen: boolean;
  setIsStatsFilterOpen: (open: boolean) => void;
  selectedStatFilterIds: string[];
  onToggleStatFilter: (stat: StatFilterDef) => void;
  onClearAllFilters: () => void;
  onClearStatsOnly: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  sortBy: SortOption;
  setSortBy: (sb: SortOption) => void;
  setCurrentPage: (page: number) => void;
}

export const CrushingCatalogFilters: React.FC<CrushingCatalogFiltersProps> = ({
  selectedSlots,
  onToggleSlot,
  minLevel,
  setMinLevel,
  maxLevel,
  setMaxLevel,
  minCoeff,
  setMinCoeff,
  maxCoeff,
  setMaxCoeff,
  dateFilter,
  setDateFilter,
  isStatsFilterOpen,
  setIsStatsFilterOpen,
  selectedStatFilterIds,
  onToggleStatFilter,
  onClearAllFilters,
  onClearStatsOnly,
  searchQuery,
  setSearchQuery,
  sortBy,
  setSortBy,
  setCurrentPage,
}) => {
  const renderStatGlyph = (type: string, color: string) => {
    switch (type) {
      case 'plant':
      case 'crit':
      case 'star':
      case 'ini':
        return <Sparkles className="w-3.5 h-3.5 shrink-0" style={{ color }} />;
      case 'fire':
        return <Flame className="w-3.5 h-3.5 shrink-0" style={{ color }} />;
      case 'water':
        return <Droplet className="w-3.5 h-3.5 shrink-0" style={{ color }} />;
      case 'air':
      case 'dodge':
        return <Wind className="w-3.5 h-3.5 shrink-0" style={{ color }} />;
      case 'neutral':
      default:
        return <CircleDot className="w-3.5 h-3.5 shrink-0" style={{ color }} />;
      case 'zap':
        return <Zap className="w-3.5 h-3.5 shrink-0" style={{ color }} />;
      case 'arrow':
        return <ArrowRight className="w-3.5 h-3.5 shrink-0" style={{ color }} />;
      case 'sword':
      case 'fist':
      case 'caza':
        return <Sword className="w-3.5 h-3.5 shrink-0" style={{ color }} />;
      case 'target':
        return <Target className="w-3.5 h-3.5 shrink-0" style={{ color }} />;
      case 'pm':
        return <Footprints className="w-3.5 h-3.5 shrink-0" style={{ color }} />;
      case 'eye':
        return <Eye className="w-3.5 h-3.5 shrink-0" style={{ color }} />;
      case 'invo':
      case 'shield':
      case 'lock':
        return <Shield className="w-3.5 h-3.5 shrink-0" style={{ color }} />;
      case 'moon':
        return <Moon className="w-3.5 h-3.5 shrink-0" style={{ color }} />;
      case 'heart':
      case 'heal':
        return <Heart className="w-3.5 h-3.5 shrink-0" style={{ color }} />;
    }
  };

  const renderStatButtonIcon = (stat: StatFilterDef) => {
    const rune = stat.runeId ? BASE_RUNES_BY_ID[stat.runeId] : null;
    const iconId = rune?.iconId || stat.iconId || stat.runeId;
    const primaryUrl = iconId ? `https://api.dofusdb.fr/img/items/${iconId}.png` : null;

    if (primaryUrl) {
      return (
        <img
          src={primaryUrl}
          alt={stat.name}
          className="w-4 h-4 object-contain shrink-0 drop-shadow-sm"
          loading="lazy"
          onError={(e) => {
            (e.currentTarget as HTMLElement).style.display = 'none';
          }}
        />
      );
    }
    return renderStatGlyph(stat.glyphType, stat.color);
  };

  return (
    <div className="bg-[#0f0e17] border border-purple-900/40 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4">
      {/* 1. Essential Filters Row 1: Multi-select Equipment Slots */}
      <div className="flex flex-wrap items-center gap-2 pb-1 max-w-full">
        <button
          onClick={() => onToggleSlot('all')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-black whitespace-nowrap transition-all shrink-0 ${
            selectedSlots.length === 0
              ? 'bg-purple-600 text-white font-extrabold shadow-md shadow-purple-950/80 border border-purple-400'
              : 'bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800 border border-purple-950/40'
          }`}
        >
          <Layers className="w-4 h-4" />
          Todos
        </button>
        {EQUIPMENT_SLOTS.filter((s) => s.id !== 'all').map((slot) => {
          const Icon = slot.icon;
          const isSelected = selectedSlots.includes(slot.id);
          return (
            <button
              key={slot.id}
              onClick={() => onToggleSlot(slot.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all shrink-0 ${
                isSelected
                  ? 'bg-purple-600 text-white font-extrabold shadow-md shadow-purple-950/80 border border-purple-400 ring-1 ring-purple-300'
                  : 'bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800 border border-purple-950/40'
              }`}
            >
              <Icon className="w-4 h-4" />
              {slot.label}
            </button>
          );
        })}
      </div>

      {/* 2. Essential Filters Row 2: Level, Coeff %, Date Dropdown & Stats Filter Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-purple-950/60">
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Level Inputs */}
          <div className="flex items-center gap-1.5 bg-slate-950/90 border border-purple-950/60 rounded-xl px-3 py-2 text-sm">
            <span className="font-bold text-slate-300">Niv.</span>
            <input
              type="number"
              min="1"
              max="200"
              placeholder="Mín."
              value={minLevel}
              onChange={(e) => {
                setMinLevel(
                  e.target.value === ''
                    ? ''
                    : Math.max(1, Math.min(200, Number(e.target.value)))
                );
                setCurrentPage(1);
              }}
              className="w-14 bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-center text-sm font-mono font-bold text-amber-300 placeholder-slate-600 focus:outline-none focus:border-purple-500"
            />
            <span className="text-slate-500 font-bold">-</span>
            <input
              type="number"
              min="1"
              max="200"
              placeholder="Máx."
              value={maxLevel}
              onChange={(e) => {
                setMaxLevel(
                  e.target.value === ''
                    ? ''
                    : Math.max(1, Math.min(200, Number(e.target.value)))
                );
                setCurrentPage(1);
              }}
              className="w-14 bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-center text-sm font-mono font-bold text-amber-300 placeholder-slate-600 focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Coeff % Inputs */}
          <div className="flex items-center gap-1.5 bg-slate-950/90 border border-purple-950/60 rounded-xl px-3 py-2 text-sm">
            <span className="font-bold text-slate-300">Coef %</span>
            <input
              type="number"
              min="1"
              max="2000"
              placeholder="Mín."
              value={minCoeff}
              onChange={(e) => {
                setMinCoeff(
                  e.target.value === ''
                    ? ''
                    : Math.max(1, Math.min(2000, Number(e.target.value)))
                );
                setCurrentPage(1);
              }}
              className="w-16 bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-center text-sm font-mono font-bold text-purple-300 placeholder-slate-600 focus:outline-none focus:border-purple-500"
            />
            <span className="text-slate-500 font-bold">-</span>
            <input
              type="number"
              min="1"
              max="2000"
              placeholder="Máx."
              value={maxCoeff}
              onChange={(e) => {
                setMaxCoeff(
                  e.target.value === ''
                    ? ''
                    : Math.max(1, Math.min(2000, Number(e.target.value)))
                );
                setCurrentPage(1);
              }}
              className="w-16 bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-center text-sm font-mono font-bold text-purple-300 placeholder-slate-600 focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Updated Date Dropdown */}
          <div className="flex items-center gap-2 bg-slate-950/90 border border-purple-950/60 rounded-xl px-3 py-2 text-sm">
            <Clock className="w-4 h-4 text-purple-400" />
            <span className="font-bold text-slate-300 hidden sm:inline">Fecha:</span>
            <select
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value as DateFilterOption);
                setCurrentPage(1);
              }}
              className="bg-transparent text-sm font-bold text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-slate-950">Todo</option>
              <option value="today" className="bg-slate-950">Hoy (&lt;24h)</option>
              <option value="3days" className="bg-slate-950">Últimos 3 días</option>
              <option value="week" className="bg-slate-950">Última semana</option>
              <option value="month" className="bg-slate-950">Último mes</option>
              <option value="custom_only" className="bg-slate-950">Con Coef Guardado</option>
              <option value="default_only" className="bg-slate-950">Sin Registrar (100%)</option>
            </select>
          </div>
        </div>

        {/* Stats Filter Toggle Button & Reset Button */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsStatsFilterOpen(!isStatsFilterOpen)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm ${
              selectedStatFilterIds.length > 0
                ? 'bg-purple-600 text-white border border-purple-400 ring-1 ring-purple-300'
                : isStatsFilterOpen
                ? 'bg-purple-950/90 text-purple-200 border border-purple-700'
                : 'bg-slate-900/90 text-slate-300 hover:text-white border border-purple-950/60 hover:border-purple-700'
            }`}
          >
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>Filtro de Estadísticas</span>
            {selectedStatFilterIds.length > 0 && (
              <span className="px-2 py-0.5 bg-purple-900 text-white rounded-full text-xs font-black border border-purple-400/50">
                {selectedStatFilterIds.length}
              </span>
            )}
            {isStatsFilterOpen ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {(selectedSlots.length > 0 ||
            minLevel !== '' ||
            maxLevel !== '' ||
            minCoeff !== '' ||
            maxCoeff !== '' ||
            selectedStatFilterIds.length > 0 ||
            dateFilter !== 'all' ||
            searchQuery !== '') && (
            <button
              onClick={onClearAllFilters}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold text-red-400 hover:text-red-300 bg-red-950/40 hover:bg-red-900/60 border border-red-800/50 transition-colors"
              title="Limpiar todos los filtros"
            >
              <RotateCcw className="w-4 h-4" />
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* 3. Collapsible 3-Column Stats Filter Grid with DofusDB real icons */}
      {isStatsFilterOpen && (
        <div className="pt-3 border-t border-purple-950/60 space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-bold text-purple-300">
                Seleccionar estadísticas (selección múltiple permitida):
              </span>
            </div>
            {selectedStatFilterIds.length > 0 && (
              <button
                onClick={onClearStatsOnly}
                className="text-xs font-bold text-red-400 hover:text-red-300 underline"
              >
                Limpiar estadísticas ({selectedStatFilterIds.length})
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            {/* COLUMN 1: DAÑOS */}
            <div className="bg-slate-950/60 border border-purple-950/40 rounded-xl p-3 space-y-2">
              <h4 className="text-purple-400 font-extrabold text-sm uppercase tracking-wider text-center pb-2 border-b border-purple-950/60">
                Daños
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {STAT_FILTERS_DAMAGES.map((stat) => {
                  const isSelected = selectedStatFilterIds.includes(stat.id);
                  return (
                    <button
                      key={stat.id}
                      onClick={() => onToggleStatFilter(stat)}
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-all text-left group ${
                        isSelected
                          ? 'bg-purple-600 text-white font-extrabold shadow-md border border-purple-300 ring-1 ring-purple-400'
                          : 'bg-slate-900/60 hover:bg-purple-950/40 text-slate-300 hover:text-white border border-slate-800/60 hover:border-purple-800/40'
                      }`}
                      title={stat.name}
                    >
                      {renderStatButtonIcon(stat)}
                      <span className="truncate text-xs font-bold">{stat.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* COLUMN 2: RESISTENCIAS */}
            <div className="bg-slate-950/60 border border-purple-950/40 rounded-xl p-3 space-y-2">
              <h4 className="text-purple-400 font-extrabold text-sm uppercase tracking-wider text-center pb-2 border-b border-purple-950/60">
                Resistencias
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {STAT_FILTERS_RESISTANCES.map((stat) => {
                  const isSelected = selectedStatFilterIds.includes(stat.id);
                  return (
                    <button
                      key={stat.id}
                      onClick={() => onToggleStatFilter(stat)}
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-all text-left group ${
                        isSelected
                          ? 'bg-purple-600 text-white font-extrabold shadow-md border border-purple-300 ring-1 ring-purple-400'
                          : 'bg-slate-900/60 hover:bg-purple-950/40 text-slate-300 hover:text-white border border-slate-800/60 hover:border-purple-800/40'
                      }`}
                      title={stat.name}
                    >
                      {renderStatButtonIcon(stat)}
                      <span className="truncate text-xs font-bold">{stat.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* COLUMN 3: CARACTERÍSTICAS */}
            <div className="bg-slate-950/60 border border-purple-950/40 rounded-xl p-3 space-y-2">
              <h4 className="text-purple-400 font-extrabold text-sm uppercase tracking-wider text-center pb-2 border-b border-purple-950/60">
                Características
              </h4>
              <div className="grid grid-cols-3 gap-2">
                {STAT_FILTERS_CHARACTERISTICS.map((stat) => {
                  const isSelected = selectedStatFilterIds.includes(stat.id);
                  return (
                    <button
                      key={stat.id}
                      onClick={() => onToggleStatFilter(stat)}
                      className={`flex items-center gap-2 px-2 py-2 rounded-lg text-xs font-medium transition-all text-left group ${
                        isSelected
                          ? 'bg-purple-600 text-white font-extrabold shadow-md border border-purple-300 ring-1 ring-purple-400'
                          : 'bg-slate-900/60 hover:bg-purple-950/40 text-slate-300 hover:text-white border border-slate-800/60 hover:border-purple-800/40'
                      }`}
                      title={stat.name}
                    >
                      {renderStatButtonIcon(stat)}
                      <span className="truncate text-xs font-bold">{stat.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Bottom Row: Search Input + Sorting Selector */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-3 border-t border-purple-950/60">
        <div className="md:col-span-7 lg:col-span-8 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar equipable por nombre (ej. Gelanillo, Solomonk, Capa del Roble Blando...)"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-slate-950 border border-purple-950/60 rounded-xl pl-10 pr-9 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setCurrentPage(1);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="md:col-span-5 lg:col-span-4 relative">
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="w-full bg-slate-950 border border-purple-950/60 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 font-bold focus:outline-none focus:border-purple-500 transition-all appearance-none cursor-pointer pr-9"
            >
              <option value="profit_desc">Mayor Ganancia Total (Kamas)</option>
              <option value="coeff_desc">Mayor Coeficiente (%)</option>
              <option value="roi_desc">Mayor Rentabilidad (% ROI)</option>
              <option value="breakeven_asc">Menor Coef. Rentable</option>
              <option value="cost_asc">Menor Costo de Crafteo</option>
              <option value="level_desc">Nivel (200 → 1)</option>
              <option value="date_desc">Coeficiente Más Reciente</option>
            </select>
            <ArrowUpDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* 5. Active Filters Chips Indicator */}
      {(selectedStatFilterIds.length > 0 || selectedSlots.length > 0) && (
        <div className="flex items-center justify-between bg-purple-950/40 border border-purple-500/40 rounded-xl px-3.5 py-2 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span className="text-purple-200 font-bold mr-1">Filtros activos:</span>
            {selectedSlots.map((slotId) => {
              const slotDef = EQUIPMENT_SLOTS.find((s) => s.id === slotId);
              if (!slotDef) return null;
              return (
                <button
                  key={slotId}
                  onClick={() => onToggleSlot(slotId)}
                  className="inline-flex items-center gap-1 bg-purple-900/90 text-purple-100 hover:bg-purple-800 px-2 py-0.5 rounded-lg text-xs font-bold border border-purple-700 transition-all"
                  title="Quitar filtro de tipo"
                >
                  <span>{slotDef.label}</span>
                  <X className="w-3 h-3 text-purple-300" />
                </button>
              );
            })}

            {selectedStatFilterIds.map((statId) => {
              const statDef = ALL_STAT_FILTERS.find((s) => s.id === statId);
              if (!statDef) return null;
              return (
                <button
                  key={statId}
                  onClick={() => onToggleStatFilter(statDef)}
                  className="inline-flex items-center gap-1 bg-purple-900/90 text-purple-100 hover:bg-purple-800 px-2 py-0.5 rounded-lg text-xs font-bold border border-purple-700 transition-all"
                  title="Quitar filtro de estadística"
                >
                  {renderStatButtonIcon(statDef)}
                  <span>{statDef.name}</span>
                  <X className="w-3 h-3 text-purple-300" />
                </button>
              );
            })}
          </div>
          <button
            onClick={onClearAllFilters}
            className="text-xs text-purple-400 hover:text-purple-300 underline font-bold shrink-0 ml-2"
          >
            Limpiar todo
          </button>
        </div>
      )}
    </div>
  );
};
