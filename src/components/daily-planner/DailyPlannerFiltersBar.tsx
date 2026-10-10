import React from 'react';
import {
  Shield,
  Activity,
  Flame,
  ShieldCheck,
  Vault,
  Tag,
  RotateCcw,
} from 'lucide-react';
import { DOFUS_JOBS } from '../../data/dofusJobs';

interface DailyPlannerFiltersBarProps {
  onlyMyJobs: boolean;
  setOnlyMyJobs: (val: boolean) => void;
  requireSalesHistory: boolean;
  setRequireSalesHistory: (val: boolean) => void;
  recentSalesOnly: boolean;
  setRecentSalesOnly: (val: boolean) => void;
  minDailySales: number;
  setMinDailySales: (val: number) => void;
  filterOutliers: boolean;
  setFilterOutliers: (val: boolean) => void;
  useBankResources: boolean;
  setUseBankResources: (val: boolean) => void;
  avoidAlreadyListed: boolean;
  setAvoidAlreadyListed: (val: boolean) => void;
  selectedJobFilter: number | 'all';
  setSelectedJobFilter: (job: number | 'all') => void;
  minRoiFilter: number;
  setMinRoiFilter: (roi: number) => void;
  maxBudgetShare: number;
  budget: number;
  maxMarketShare: number;
  setMaxMarketShare: (share: number) => void;
  excludedCount: number;
  onClearExclusions: () => void;
  onResetAllFilters: () => void;
}

export const DailyPlannerFiltersBar: React.FC<DailyPlannerFiltersBarProps> = ({
  onlyMyJobs,
  setOnlyMyJobs,
  requireSalesHistory,
  setRequireSalesHistory,
  recentSalesOnly,
  setRecentSalesOnly,
  minDailySales,
  setMinDailySales,
  filterOutliers,
  setFilterOutliers,
  useBankResources,
  setUseBankResources,
  avoidAlreadyListed,
  setAvoidAlreadyListed,
  selectedJobFilter,
  setSelectedJobFilter,
  minRoiFilter,
  setMinRoiFilter,
  maxBudgetShare,
  budget,
  maxMarketShare,
  setMaxMarketShare,
  excludedCount,
  onClearExclusions,
  onResetAllFilters,
}) => {
  return (
    <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
      <div className="flex flex-wrap items-center gap-3">
        {/* Toggle Solo mis oficios */}
        <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={onlyMyJobs}
            onChange={(e) => setOnlyMyJobs(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-amber-400/50 cursor-pointer"
          />
          <span className="font-semibold text-slate-300 flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-amber-400" />
            Solo mis oficios
          </span>
        </label>

        {/* Toggle Solo con historial de ventas */}
        <label
          className="inline-flex items-center gap-1.5 cursor-pointer select-none pl-2 border-l border-slate-800"
          title="Excluir objetos sin ventas registradas en HDV"
        >
          <input
            type="checkbox"
            checked={requireSalesHistory}
            onChange={(e) => setRequireSalesHistory(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-400/50 cursor-pointer"
          />
          <span className="font-semibold text-slate-300 flex items-center gap-1">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            Con ventas
          </span>
        </label>

        {/* Toggle Solo ventas recientes (24h o 7d) */}
        {requireSalesHistory && (
          <label
            className="inline-flex items-center gap-1.5 cursor-pointer select-none pl-2 border-l border-slate-800"
            title="Excluye objetos con 0 ventas en las últimas 24 horas y 7 días, evitando que ítems con ventas viejas en 30 días consuman el presupuesto"
          >
            <input
              type="checkbox"
              checked={recentSalesOnly}
              onChange={(e) => setRecentSalesOnly(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-amber-400/50 cursor-pointer"
            />
            <span className="font-semibold text-amber-300 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              Solo recientes (24h/7d)
            </span>
          </label>
        )}

        {/* Selector de Rotación Mínima */}
        {requireSalesHistory && (
          <div className="flex items-center gap-1">
            <select
              value={minDailySales}
              onChange={(e) => setMinDailySales(Number(e.target.value))}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-0.5 text-slate-200 text-xs font-semibold outline-none cursor-pointer font-mono"
              title="Velocidad mínima de ventas al día exigida"
            >
              <option value={0}>Todas (&gt;0/d)</option>
              <option value={0.2}>&ge; 0.2 uds/d</option>
              <option value={0.5}>&ge; 0.5 uds/d</option>
              <option value={1.0}>&ge; 1.0 uds/d</option>
              <option value={2.0}>&ge; 2.0 uds/d</option>
            </select>
          </div>
        )}

        {/* Toggle Antifraude / Precios Inflados */}
        <label
          className="inline-flex items-center gap-1.5 cursor-pointer select-none pl-2 border-l border-slate-800"
          title="Ajusta el precio a la mediana histórica cuando la oferta en mercadillo está anormalmente inflada"
        >
          <input
            type="checkbox"
            checked={filterOutliers}
            onChange={(e) => setFilterOutliers(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-950 text-indigo-500 focus:ring-indigo-400/50 cursor-pointer"
          />
          <span className="font-semibold text-slate-300 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            Filtrar anomalías de precio
          </span>
        </label>

        {/* Toggle Usar recursos de Mi Banco */}
        <label
          className="inline-flex items-center gap-1.5 cursor-pointer select-none pl-2 border-l border-slate-800"
          title="Al marcar un objeto como 'Puesto en HDV', se descuentan automáticamente los ingredientes que tengas en Mi Banco (y se restauran si pulsas 'Deshacer')"
        >
          <input
            type="checkbox"
            checked={useBankResources}
            onChange={(e) => setUseBankResources(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-amber-400/50 cursor-pointer"
          />
          <span className={`font-semibold flex items-center gap-1 ${useBankResources ? 'text-amber-400' : 'text-slate-400'}`}>
            <Vault className="w-3.5 h-3.5 text-amber-400" />
            Descontar de Mi Banco al Poner
          </span>
        </label>

        {/* Toggle Evitar ítems ya en HDV */}
        <label
          className="inline-flex items-center gap-1.5 cursor-pointer select-none pl-2 border-l border-slate-800"
          title="Prioriza objetos que no tienes actualmente a la venta en mercadillo para diversificar y evitar saturar tus propios lotes"
        >
          <input
            type="checkbox"
            checked={avoidAlreadyListed}
            onChange={(e) => setAvoidAlreadyListed(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-950 text-sky-500 focus:ring-sky-400/50 cursor-pointer"
          />
          <span className={`font-semibold flex items-center gap-1 ${avoidAlreadyListed ? 'text-sky-400' : 'text-slate-400'}`}>
            <Tag className="w-3.5 h-3.5 text-sky-400" />
            Evitar ya en HDV
          </span>
        </label>

        {/* Filtro por Oficio Específico */}
        <div className="flex items-center gap-1.5 pl-2 border-l border-slate-800">
          <span className="text-slate-400 font-medium">Oficio:</span>
          <select
            value={selectedJobFilter}
            onChange={(e) => setSelectedJobFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 text-xs font-semibold outline-none cursor-pointer"
          >
            <option value="all">Todos los oficios</option>
            {DOFUS_JOBS.map((j) => (
              <option key={j.id} value={j.id}>
                {j.nameEs}
              </option>
            ))}
          </select>
        </div>

        {/* Filtro ROI Mínimo */}
        <div className="flex items-center gap-1.5 pl-2 border-l border-slate-800">
          <span className="text-slate-400 font-medium">ROI Mínimo:</span>
          <select
            value={minRoiFilter}
            onChange={(e) => setMinRoiFilter(Number(e.target.value))}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 text-xs font-semibold outline-none cursor-pointer"
          >
            <option value={0}>Sin mínimo (0%)</option>
            <option value={10}>&gt;= 10%</option>
            <option value={15}>&gt;= 15%</option>
            <option value={25}>&gt;= 25%</option>
            <option value={40}>&gt;= 40%</option>
            <option value={60}>&gt;= 60%</option>
          </select>
        </div>

        {/* Indicador de tope de diversificación */}
        <div className="flex items-center gap-1.5 pl-2 border-l border-slate-800 text-slate-400">
          <span className="font-medium">Tope ítem:</span>
          <span className="font-mono font-bold text-amber-300">
            {maxBudgetShare >= 1.0
              ? 'Sin límite'
              : `${Math.round(maxBudgetShare * 100)}% (${Math.floor(budget * maxBudgetShare).toLocaleString('es-ES')} K)`}
          </span>
        </div>

        {/* Cuota de ventas diaria para alta rotación */}
        <div className="flex items-center gap-1.5 pl-2 border-l border-slate-800">
          <span className="text-slate-400 font-medium">Cuota Ventas:</span>
          <select
            value={maxMarketShare}
            onChange={(e) => setMaxMarketShare(Number(e.target.value))}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 text-xs font-semibold outline-none cursor-pointer font-mono"
            title="Para ítems de alta rotación (>10 uds/día), limita las unidades a fabricar a este porcentaje de las ventas (5%, 10%, 15% o 20% máx). Para 1-10 uds/día, limita a 1-2 unidades."
          >
            <option value={0.05}>5% máx/día</option>
            <option value={0.10}>10% máx/día</option>
            <option value={0.15}>15% máx/día</option>
            <option value={0.20}>20% máx/día</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {excludedCount > 0 && (
          <button
            type="button"
            onClick={onClearExclusions}
            className="text-rose-400 hover:text-rose-300 font-semibold text-[11px] underline flex items-center gap-1 cursor-pointer"
          >
            Restablecer {excludedCount} {excludedCount === 1 ? 'descarte' : 'descartes'}
          </button>
        )}

        <button
          type="button"
          onClick={onResetAllFilters}
          className="text-slate-400 hover:text-amber-300 font-semibold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
          title="Restablecer filtros, presupuesto y configuración a los valores por defecto"
        >
          <RotateCcw className="w-3 h-3 text-slate-500" />
          <span>Restablecer todo</span>
        </button>
      </div>
    </div>
  );
};
