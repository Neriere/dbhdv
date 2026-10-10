import React from 'react';
import { Search } from 'lucide-react';
import { ZONE_FILTERS } from './types';

interface TreasureHuntControlBarProps {
  searchQuery: string;
  onSearchChange: (val: string) => void;
  levelFilter: string;
  onLevelFilterChange: (val: string) => void;
  sortBy: string;
  onSortByChange: (val: any) => void;
  zoneFilter: string;
  onZoneFilterChange: (val: string) => void;
  onlyProfitable: boolean;
  onOnlyProfitableChange: (val: boolean) => void;
}

export const TreasureHuntControlBar: React.FC<TreasureHuntControlBarProps> = ({
  searchQuery,
  onSearchChange,
  levelFilter,
  onLevelFilterChange,
  sortBy,
  onSortByChange,
  zoneFilter,
  onZoneFilterChange,
  onlyProfitable,
  onOnlyProfitableChange,
}) => {
  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-4 shadow-lg">
      <div className="flex flex-col md:flex-row items-center gap-3">
        {/* Search Input */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por monstruo, zona, recurso o mapa..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>

        {/* Level Filter Tabs */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 overflow-x-auto w-full md:w-auto">
          {[
            { id: 'all', label: 'Todos' },
            { id: '200', label: 'Nv 200' },
            { id: '150-190', label: 'Nv 150-190' },
            { id: '100-140', label: 'Nv 100-140' },
            { id: '20-90', label: 'Nv 20-90' },
          ].map((lvl) => (
            <button
              key={lvl.id}
              type="button"
              onClick={() => onLevelFilterChange(lvl.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                levelFilter === lvl.id
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {lvl.label}
            </button>
          ))}
        </div>

        {/* Sort Selector */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-xs text-slate-400 whitespace-nowrap">
            Ordenar por:
          </span>
          <select
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs font-medium focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="profit_desc">Mayor Ganancia Cacería (Kamas)</option>
            <option value="craft_profit_desc">
              Mayor Ganancia con Crafteo
            </option>
            <option value="roi_desc">Mayor Retorno (ROI %)</option>
            <option value="hunt_vs_buy">
              Mayor Ahorro vs Comprar en Mercadillo
            </option>
            <option value="sebuscalines_desc">
              Mayor Cantidad de Sebuscalines
            </option>
            <option value="cost_asc">Coste Más Barato de Búsqueda</option>
            <option value="level_desc">Nivel de ByC (Mayor a menor)</option>
          </select>
        </div>
      </div>

      {/* Second Filter Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/60 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-slate-400 font-medium shrink-0">Zona:</span>
          <div className="flex flex-wrap items-center gap-1">
            {ZONE_FILTERS.map((z) => (
              <button
                key={z.id}
                type="button"
                onClick={() => onZoneFilterChange(z.id)}
                className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap text-xs cursor-pointer ${
                  zoneFilter === z.id
                    ? 'bg-slate-800 text-amber-300 font-semibold border border-amber-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 bg-slate-950/60'
                }`}
              >
                {z.label}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer text-slate-300 select-none">
          <input
            type="checkbox"
            checked={onlyProfitable}
            onChange={(e) => onOnlyProfitableChange(e.target.checked)}
            className="rounded bg-slate-950 border-slate-700 text-amber-500 focus:ring-amber-500 w-4 h-4 cursor-pointer"
          />
          <span className="text-xs font-medium">
            Mostrar solo con ganancia positiva
          </span>
        </label>
      </div>
    </div>
  );
};
