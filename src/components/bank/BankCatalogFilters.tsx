import React from "react";
import {
  Vault,
  Package,
  Layers,
  Search,
  Filter,
  RefreshCw,
  Clock,
  Sparkles,
  Loader2,
  Wrench,
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

interface BankCatalogFiltersProps {
  activeSubTab: "crafts" | "inventory";
  onSubTabChange: (tab: "crafts" | "inventory") => void;
  bankItemsCount: number;
  craftsCount: number;
  selectedJobId: number | "all";
  onSelectJobId: (id: number | "all") => void;
  craftSearchQuery: string;
  onCraftSearchQueryChange: (query: string) => void;
  onlyFullyCraftable: boolean;
  onOnlyFullyCraftableChange: (val: boolean) => void;
  minLevel: number;
  maxLevel: number;
  onLevelRangeChange: (min: number, max: number) => void;
  sortBy: string;
  onSortByChange: (val: any) => void;
  isCalculating: boolean;
  hasCalculated: boolean;
  lastCalculatedAt: number | null;
  onCalculate: () => void;
}

export const BankCatalogFilters: React.FC<BankCatalogFiltersProps> = ({
  activeSubTab,
  onSubTabChange,
  bankItemsCount,
  craftsCount,
  selectedJobId,
  onSelectJobId,
  craftSearchQuery,
  onCraftSearchQueryChange,
  onlyFullyCraftable,
  onOnlyFullyCraftableChange,
  minLevel,
  maxLevel,
  onLevelRangeChange,
  sortBy,
  onSortByChange,
  isCalculating,
  hasCalculated,
  lastCalculatedAt,
  onCalculate,
}) => {
  return (
    <div className="space-y-4">
      {/* Sub-Tab Navigation Bar & Scan Button */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            type="button"
            onClick={() => onSubTabChange("crafts")}
            className={`flex-1 md:flex-initial px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeSubTab === "crafts"
                ? "bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20"
                : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Oportunidades de Fabricación</span>
            {hasCalculated && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-950/40 text-current">
                {craftsCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onSubTabChange("inventory")}
            className={`flex-1 md:flex-initial px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeSubTab === "inventory"
                ? "bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20"
                : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            <Vault className="w-4 h-4" />
            <span>Inventario del Banco</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-950/40 text-current">
              {bankItemsCount}
            </span>
          </button>
        </div>

        {activeSubTab === "crafts" && (
          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            {lastCalculatedAt && (
              <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                <Clock className="w-3 h-3 text-slate-500" />
                Actualizado {new Date(lastCalculatedAt).toLocaleTimeString()}
              </span>
            )}

            <button
              type="button"
              onClick={onCalculate}
              disabled={isCalculating || bankItemsCount === 0}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isCalculating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Escaneando Banco...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  <span>{hasCalculated ? "Recalcular Oportunidades" : "Escanear Oportunidades"}</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {activeSubTab === "crafts" && (
        <div className="space-y-4">
          {/* Job Selection Cards */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-black text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
                <Wrench className="w-4 h-4 text-amber-400" />
                Filtrar por Oficio
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                {selectedJobId === "all"
                  ? `Todos los oficios (${DOFUS_JOBS.length})`
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
                    : "bg-slate-950 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700"
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
                        : "bg-slate-950 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <JobIcon className="w-4 h-4 shrink-0 text-amber-400" />
                    <span className="truncate">{job.nameEs}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Secondary Filters Grid */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1 flex items-center gap-1">
                  <Search className="w-3.5 h-3.5 text-amber-400" />
                  Buscar Receta
                </label>
                <input
                  type="text"
                  placeholder="ej. Gelano, Capa..."
                  value={craftSearchQuery}
                  onChange={(e) => onCraftSearchQueryChange(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">
                  Nivel de Receta ({minLevel} - {maxLevel})
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max={maxLevel}
                    value={minLevel}
                    onChange={(e) => onLevelRangeChange(Number(e.target.value) || 1, maxLevel)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-1.5 text-white text-center font-mono font-bold focus:border-amber-500 focus:outline-none"
                  />
                  <span className="text-slate-500">-</span>
                  <input
                    type="number"
                    min={minLevel}
                    max="200"
                    value={maxLevel}
                    onChange={(e) => onLevelRangeChange(minLevel, Number(e.target.value) || 200)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-1.5 text-white text-center font-mono font-bold focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">
                  Ordenar Oportunidades
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => onSortByChange(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-bold focus:border-amber-500 focus:outline-none cursor-pointer"
                >
                  <option value="profit_roi">Ganancia Neta + ROI %</option>
                  <option value="smart_score">Smart Score (Ganancia / Costo)</option>
                  <option value="roi_profit">Mayor ROI %</option>
                  <option value="fully_craftable">Fabricables Inmediatamente</option>
                  <option value="coverage">Mayor Cobertura de Banco (%)</option>
                  <option value="missingCost">Menor Costo Faltante</option>
                  <option value="level">Nivel de Objeto</option>
                </select>
              </div>

              <div className="flex items-end pb-1">
                <label className="inline-flex items-center gap-2 cursor-pointer bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 text-slate-300 hover:text-white transition-colors w-full select-none">
                  <input
                    type="checkbox"
                    checked={onlyFullyCraftable}
                    onChange={(e) => onOnlyFullyCraftableChange(e.target.checked)}
                    className="rounded border-slate-700 text-amber-500 focus:ring-0 bg-slate-950"
                  />
                  <span className="font-bold text-emerald-400 text-xs">
                    100% Fabricables Ahora
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
