import React from 'react';
import { Filter, Search } from 'lucide-react';
import { MainTab, StatFilter, JobFilter } from './types';

interface ConsumablesFiltersBarProps {
  activeTab: MainTab;
  statFilter: StatFilter;
  onSetStatFilter: (stat: StatFilter) => void;
  searchQuery: string;
  onSetSearchQuery: (query: string) => void;
  jobFilter: JobFilter;
  onSetJobFilter: (job: JobFilter) => void;
  limitFilter: string;
  onSetLimitFilter: (limit: string) => void;
}

export const ConsumablesFiltersBar: React.FC<ConsumablesFiltersBarProps> = ({
  activeTab,
  statFilter,
  onSetStatFilter,
  searchQuery,
  onSetSearchQuery,
  jobFilter,
  onSetJobFilter,
  limitFilter,
  onSetLimitFilter,
}) => {
  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3.5 space-y-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Selector de Característica */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Stat:
          </span>
          {(
            [
              'Todas',
              'Fuerza',
              'Vitalidad',
              'Sabiduría',
              'Inteligencia',
              'Suerte',
              'Agilidad',
            ] as StatFilter[]
          ).map((stat) => (
            <button
              key={stat}
              onClick={() => onSetStatFilter(stat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                statFilter === stat
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
                  : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              {stat}
            </button>
          ))}
        </div>

        {/* Buscador de texto */}
        <div className="relative min-w-[220px]">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSetSearchQuery(e.target.value)}
            placeholder="Buscar por nombre o ingrediente..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Filtros secundarios específicos de Consumibles */}
      {activeTab === 'consumables' && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-slate-800/60">
          {/* Oficio */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-1">
              Oficio:
            </span>
            {(
              [
                'Todos',
                'Cazador',
                'Pescador',
                'Campesino',
                'Alquimista',
              ] as JobFilter[]
            ).map((job) => (
              <button
                key={job}
                onClick={() => onSetJobFilter(job)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all border ${
                  jobFilter === job
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                    : 'bg-slate-950/40 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                {job}
              </button>
            ))}
          </div>

          {/* Límite de Stat */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-1">
              Límite de Stat:
            </span>
            {[
              { id: 'todos', label: 'Todos' },
              { id: '25', label: '≤ 25 (Pequeño)' },
              { id: '50', label: '≤ 50 (Mediano)' },
              { id: '80', label: '≤ 80 (Grande)' },
              { id: '100', label: '≤ 100 (Potente)' },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => onSetLimitFilter(opt.id)}
                className={`px-2 py-0.8 rounded text-xs font-mono transition-all border ${
                  limitFilter === opt.id
                    ? 'bg-sky-500/20 text-sky-300 border-sky-500/50 font-bold'
                    : 'bg-slate-950/40 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
