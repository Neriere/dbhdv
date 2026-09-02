import React from "react";
import {
  Wrench,
  Search,
  Tag,
  Layers,
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
  Heart,
  Sparkles,
  Map as MapIcon,
} from "lucide-react";
import { DOFUS_JOBS } from "../../data/dofusJobs";

export const JOB_ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
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
  Sparkles,
  Map: MapIcon,
};

interface RecipeCatalogFiltersProps {
  selectedJobId: number | "all";
  onSelectJobId: (id: number | "all") => void;
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  minLevel: number;
  maxLevel: number;
  onLevelRangeChange: (min: number, max: number) => void;
  onlyProfitable: boolean;
  onOnlyProfitableChange: (val: boolean) => void;
  sortBy: string;
  onSortByChange: (sort: string) => void;
  minProfit: number | "";
  onMinProfitChange: (val: number | "") => void;
  totalItemsCount: number;
}

export const RecipeCatalogFilters: React.FC<RecipeCatalogFiltersProps> = ({
  selectedJobId,
  onSelectJobId,
  searchTerm,
  onSearchTermChange,
  minLevel,
  maxLevel,
  onLevelRangeChange,
  onlyProfitable,
  onOnlyProfitableChange,
  sortBy,
  onSortByChange,
  minProfit,
  onMinProfitChange,
  totalItemsCount,
}) => {
  return (
    <div className="space-y-4 w-full">
      {/* Job Selection Cards Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-black text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
            <Wrench className="w-4 h-4 text-amber-400" />
            Selecciona un Oficio
          </span>
          <span className="text-[11px] font-mono text-slate-500">
            {selectedJobId === "all"
              ? `Mostrando todos (${DOFUS_JOBS.length} oficios)`
              : `Oficio: ${DOFUS_JOBS.find((j) => j.id === selectedJobId)?.nameEs || `ID #${selectedJobId}`}`}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2 text-xs">
          <button
            type="button"
            onClick={() => onSelectJobId("all")}
            className={`px-3 py-2 rounded-xl font-bold transition-all flex items-center justify-center sm:justify-start gap-2 cursor-pointer ${
              selectedJobId === "all"
                ? "bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20"
                : "bg-slate-950 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 hover:bg-slate-900"
            }`}
          >
            <Layers className="w-4 h-4 shrink-0" />
            <span className="truncate">Todos ({DOFUS_JOBS.length})</span>
          </button>

          {DOFUS_JOBS.map((job) => {
            const isSelected = selectedJobId === job.id;
            const JobIcon = JOB_ICON_MAP[job.icon] || Wrench;
            return (
              <button
                type="button"
                key={job.id}
                onClick={() => onSelectJobId(job.id)}
                className={`px-3 py-2 rounded-xl font-bold transition-all flex items-center justify-center sm:justify-start gap-2 cursor-pointer ${
                  isSelected
                    ? "bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20"
                    : "bg-slate-950 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 hover:bg-slate-900"
                }`}
              >
                <JobIcon className="w-4 h-4 shrink-0 text-amber-400" />
                <span className="truncate">{job.nameEs}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <Wrench className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                Catálogo de Recetas
                <span className="text-xs text-amber-400 font-mono font-bold px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  {totalItemsCount} Objetos
                </span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <label className="inline-flex items-center gap-1.5 cursor-pointer bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-slate-300 hover:text-white transition-colors select-none">
              <input
                type="checkbox"
                checked={onlyProfitable}
                onChange={(e) => onOnlyProfitableChange(e.target.checked)}
                className="rounded border-slate-700 text-amber-500 focus:ring-0 bg-slate-950"
              />
              <span className="font-bold text-emerald-400">
                Solo Rentables (&gt;0 K)
              </span>
            </label>
          </div>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block text-slate-400 font-bold mb-1 flex items-center gap-1">
              <Search className="w-3.5 h-3.5 text-amber-400" />
              Buscar Objeto
            </label>
            <input
              type="text"
              placeholder="ej. Gelano, Sombrero..."
              value={searchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none font-medium"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-bold mb-1 flex items-center gap-1">
              <Tag className="w-3.5 h-3.5 text-amber-400" />
              Rango de Nivel
            </label>
            <select
              value={`${minLevel}-${maxLevel}`}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "all") {
                  onLevelRangeChange(1, 200);
                } else {
                  const [min, max] = val.split("-").map(Number);
                  onLevelRangeChange(min, max);
                }
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-bold focus:border-amber-500 focus:outline-none cursor-pointer"
            >
              <option value="all">Todos los Niveles (1-200)</option>
              <option value="1-50">Nivel 1 - 50</option>
              <option value="51-100">Nivel 51 - 100</option>
              <option value="101-150">Nivel 101 - 150</option>
              <option value="151-200">Nivel 151 - 200</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 font-bold mb-1">
              Ordenar Por
            </label>
            <select
              value={sortBy}
              onChange={(e) => onSortByChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-bold focus:border-amber-500 focus:outline-none cursor-pointer"
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
            <label className="block text-slate-400 font-bold mb-1">
              Ganancia Mín. (Kamas)
            </label>
            <input
              type="number"
              value={minProfit}
              onChange={(e) =>
                onMinProfitChange(
                  e.target.value === "" ? "" : Number(e.target.value)
                )
              }
              placeholder="0 K"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-bold focus:border-amber-500 focus:outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
