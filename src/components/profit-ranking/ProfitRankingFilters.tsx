import React from "react";
import {
  Trophy,
  TrendingUp,
  Search,
  DollarSign,
  Wrench,
  Tag,
  Coins,
  Layers,
  Briefcase,
  Activity,
  ShieldCheck,
  RotateCcw,
  Percent,
} from "lucide-react";
import { DOFUS_JOBS } from "../../data/dofusJobs";
import { MarketCategory } from "../DailyCraftPlanner";
import {
  JOB_ICON_MAP,
  StrategyFilter,
  SalesLiquidityFilter,
  SortByOption,
} from "./types";

interface ProfitRankingFiltersProps {
  selectedJobId: number | "all";
  setSelectedJobId: (id: number | "all") => void;
  strategyFilter: StrategyFilter;
  setStrategyFilter: (f: StrategyFilter) => void;
  marketCategoryFilter: "all" | MarketCategory;
  setMarketCategoryFilter: (f: "all" | MarketCategory) => void;
  salesLiquidityFilter: SalesLiquidityFilter;
  setSalesLiquidityFilter: (f: SalesLiquidityFilter) => void;
  filterOutliers: boolean;
  setFilterOutliers: (v: boolean) => void;
  hasActiveFilters: boolean;
  handleResetFilters: () => void;
  minLevel: number | "";
  setMinLevel: (v: number | "") => void;
  maxLevel: number | "";
  setMaxLevel: (v: number | "") => void;
  searchTerm: string;
  setSearchTerm: (s: string) => void;
  sortBy: SortByOption;
  setSortBy: (s: SortByOption) => void;
  minRoi: number | "";
  setMinRoi: (v: number | "") => void;
  minProfit: number | "";
  setMinProfit: (v: number | "") => void;
  maxCraftCost: number | "";
  setMaxCraftCost: (v: number | "") => void;
  filteredCount: number;
  isUserJobsEnabled: boolean;
}

export const ProfitRankingFilters: React.FC<ProfitRankingFiltersProps> = ({
  selectedJobId,
  setSelectedJobId,
  strategyFilter,
  setStrategyFilter,
  marketCategoryFilter,
  setMarketCategoryFilter,
  salesLiquidityFilter,
  setSalesLiquidityFilter,
  filterOutliers,
  setFilterOutliers,
  hasActiveFilters,
  handleResetFilters,
  minLevel,
  setMinLevel,
  maxLevel,
  setMaxLevel,
  searchTerm,
  setSearchTerm,
  sortBy,
  setSortBy,
  minRoi,
  setMinRoi,
  minProfit,
  setMinProfit,
  maxCraftCost,
  setMaxCraftCost,
  filteredCount,
  isUserJobsEnabled,
}) => {
  return (
    <>
      {/* User Jobs Global Filter Notice */}
      {isUserJobsEnabled && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs shadow-sm animate-fade-in">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
              <Briefcase className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <span className="truncate">
              <strong>Filtro global de oficios activo:</strong> El ranking solo incluye recetas que tu personaje puede craftear según tus niveles de oficio.
            </span>
          </div>
          <span className="text-[11px] font-mono text-emerald-400/80 shrink-0 font-bold">
            {filteredCount} recetas en ranking
          </span>
        </div>
      )}

      {/* Job Selection Cards */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 shadow-lg space-y-2">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          <button
            onClick={() => setSelectedJobId("all")}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
              selectedJobId === "all"
                ? "bg-amber-500 text-slate-950 shadow-md font-black"
                : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
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
                className={`px-2.5 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
                  isSelected
                    ? "bg-amber-500 text-slate-950 shadow-md font-black"
                    : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                }`}
              >
                <JobIcon className="w-3.5 h-3.5" />
                <span>{job.nameEs}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                Ranking de Rentabilidad
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold border border-emerald-500/30">
                  {filteredCount}
                </span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
            <button
              onClick={() => setStrategyFilter("all")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                strategyFilter === "all"
                  ? "bg-amber-500 text-slate-950 font-black"
                  : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setStrategyFilter("profitable")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                strategyFilter === "profitable"
                  ? "bg-emerald-500 text-slate-950 font-black"
                  : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
              }`}
            >
              Rentables (&gt;0 K)
            </button>
            <button
              onClick={() => setStrategyFilter("hdv")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                strategyFilter === "hdv"
                  ? "bg-sky-500 text-slate-950 font-black"
                  : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
              }`}
            >
              Venta HDV
            </button>
            <button
              onClick={() => setStrategyFilter("crush")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                strategyFilter === "crush"
                  ? "bg-purple-500 text-slate-950 font-black"
                  : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
              }`}
            >
              Runas
            </button>
          </div>
        </div>

        {/* Channel & Antifraud Sub-bar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pb-1">
          {/* Mercadillo Channel Tabs */}
          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Canal HDV:</span>
            <button
              onClick={() => setMarketCategoryFilter("all")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                marketCategoryFilter === "all"
                  ? "bg-amber-500 text-slate-950 font-black shadow-sm"
                  : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
              }`}
            >
              Todos HDVs
            </button>
            <button
              onClick={() => setMarketCategoryFilter("equipment")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                marketCategoryFilter === "equipment"
                  ? "bg-sky-500 text-slate-950 font-black shadow-sm"
                  : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
              }`}
            >
              Equipamiento
            </button>
            <button
              onClick={() => setMarketCategoryFilter("consumables")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                marketCategoryFilter === "consumables"
                  ? "bg-emerald-500 text-slate-950 font-black shadow-sm"
                  : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
              }`}
            >
              Consumibles
            </button>
            <button
              onClick={() => setMarketCategoryFilter("resources")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                marketCategoryFilter === "resources"
                  ? "bg-amber-600 text-slate-950 font-black shadow-sm"
                  : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
              }`}
            >
              Recursos
            </button>
          </div>

          {/* Antifraud & Reset Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFilterOutliers(!filterOutliers)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border ${
                filterOutliers
                  ? "bg-emerald-950/60 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900/50"
                  : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
              }`}
              title={
                filterOutliers
                  ? "Antifraude ACTIVO: Precios de venta inflados (>45% s/ mediana 7d/30d) se ajustan automáticamente a la mediana real para evitar ganancias irreales de exomagueos."
                  : "Antifraude INACTIVO: Se utiliza el precio bruto registrado sin verificar anomalías."
              }
            >
              <ShieldCheck className={`w-3.5 h-3.5 ${filterOutliers ? "text-emerald-400" : "text-slate-500"}`} />
              <span>Antifraude: {filterOutliers ? "ON" : "OFF"}</span>
            </button>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-2.5 py-1 rounded-lg text-xs font-bold text-slate-400 hover:text-rose-400 bg-slate-950 border border-slate-800 hover:border-rose-500/30 transition-all flex items-center gap-1"
                title="Restablecer todos los filtros a sus valores predeterminados"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restablecer</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Controls Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2.5 text-xs">
          <div>
            <label className="block text-slate-400 font-bold mb-1 flex items-center gap-1">
              <Tag className="w-3.5 h-3.5 text-amber-400" />
              Nivel
            </label>
            <select
              value={`${minLevel}-${maxLevel}`}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "all") {
                  setMinLevel(1);
                  setMaxLevel(200);
                } else {
                  const [min, max] = val.split("-").map(Number);
                  setMinLevel(min);
                  setMaxLevel(max);
                }
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-200 font-bold focus:border-amber-500 focus:outline-none"
            >
              <option value="all">Todos (1-200)</option>
              <option value="1-50">1 - 50</option>
              <option value="51-100">51 - 100</option>
              <option value="101-150">101 - 150</option>
              <option value="151-200">151 - 200</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 font-bold mb-1 flex items-center gap-1">
              <Search className="w-3.5 h-3.5 text-amber-400" />
              Buscar
            </label>
            <input
              type="text"
              placeholder="Nombre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none font-medium"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-bold mb-1 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              Ordenar
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-200 font-bold focus:border-amber-500 focus:outline-none"
            >
              <option value="best_profit_desc">Mayor Ganancia</option>
              <option value="sale_profit_desc">Mayor Ganancia HDV</option>
              <option value="crush_profit_desc">Mayor Ganancia Runas</option>
              <option value="best_roi_desc">Mayor ROI (%)</option>
              <option value="turnover_desc">Mayor Rotación (Ventas/Día)</option>
              <option value="fast_payback">Retorno Rápido (Payback)</option>
              <option value="cost_asc">Menor Costo</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 font-bold mb-1 flex items-center gap-1">
              <Percent className="w-3.5 h-3.5 text-emerald-400" />
              ROI Mínimo
            </label>
            <select
              value={minRoi === "" ? 0 : minRoi}
              onChange={(e) => {
                const val = Number(e.target.value);
                setMinRoi(val);
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-200 font-bold focus:border-amber-500 focus:outline-none font-mono"
            >
              <option value="0">Todos (0%+)</option>
              <option value="15">≥ 15% ROI</option>
              <option value="30">≥ 30% ROI</option>
              <option value="50">≥ 50% ROI</option>
              <option value="100">≥ 100% ROI</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 font-bold mb-1 flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-sky-400" />
              Liquidez / Ventas
            </label>
            <select
              value={salesLiquidityFilter}
              onChange={(e) => setSalesLiquidityFilter(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-200 font-bold focus:border-amber-500 focus:outline-none"
            >
              <option value="all">Todas las recetas</option>
              <option value="verified">Ventas verificadas (&gt;0/d)</option>
              <option value="medium_high">Rotación Media/Alta (≥0.5/d)</option>
              <option value="high">Alta Rotación (≥2/d)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 font-bold mb-1 flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              Ganancia Mín.
            </label>
            <input
              type="number"
              value={minProfit}
              onChange={(e) => {
                const val = e.target.value;
                setMinProfit(val === "" ? "" : Number(val));
              }}
              step={5000}
              placeholder="0 K"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-100 font-mono font-bold focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-bold mb-1 flex items-center gap-1">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              Presupuesto Máx.
            </label>
            <input
              type="number"
              value={maxCraftCost}
              onChange={(e) => {
                const val = e.target.value;
                setMaxCraftCost(val === "" ? "" : Number(val));
              }}
              step={50000}
              placeholder="Sin límite"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-100 font-mono font-bold focus:border-amber-500 focus:outline-none"
            />
          </div>
        </div>
      </div>
    </>
  );
};
