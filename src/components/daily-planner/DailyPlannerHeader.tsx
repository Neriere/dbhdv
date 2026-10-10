import React from 'react';
import {
  Briefcase,
  SlidersHorizontal,
  Check,
  ShoppingCart,
  TrendingUp,
  Store,
} from 'lucide-react';

interface DailyPlannerHeaderProps {
  plannedCraftsCount: number;
  onOpenJobsModal: () => void;
  onAddAllToShoppingList: () => void;
  addedAllNotice: boolean;
  plannerMainTab: 'craft_planner' | 'sales_analytics';
  setPlannerMainTab: (tab: 'craft_planner' | 'sales_analytics') => void;
  soldStatsCount: number;
  activeTotalLots: number;
}

export const DailyPlannerHeader: React.FC<DailyPlannerHeaderProps> = ({
  plannedCraftsCount,
  onOpenJobsModal,
  onAddAllToShoppingList,
  addedAllNotice,
  plannerMainTab,
  setPlannerMainTab,
  soldStatsCount,
  activeTotalLots,
}) => {
  return (
    <>
      {/* Encabezado Principal */}
      <div className="bg-slate-900 border border-slate-800 px-4 py-3 sm:px-5 sm:py-3.5 rounded-2xl shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <Briefcase className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Planificador de Fabricación y Rotación
              </h1>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold uppercase tracking-wider">
                Cartera Activa
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <button
            type="button"
            onClick={onOpenJobsModal}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
            <span>Mis Oficios</span>
          </button>

          {plannedCraftsCount > 0 && (
            <button
              type="button"
              onClick={onAddAllToShoppingList}
              className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
            >
              {addedAllNotice ? <Check className="w-4 h-4" /> : <ShoppingCart className="w-4 h-4" />}
              <span>{addedAllNotice ? '¡Añadido a Compras!' : 'Añadir a Compras'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Selector de Pestañas Principales: Plan de Crafteo vs Historial y Análisis de Ventas */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-2 rounded-2xl shadow-sm">
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setPlannerMainTab('craft_planner')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              plannerMainTab === 'craft_planner'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5 text-amber-400" />
            <span>Planificador de Crafteo ({plannedCraftsCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setPlannerMainTab('sales_analytics')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              plannerMainTab === 'sales_analytics'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>Historial y Análisis de Ventas (HDV)</span>
            {(soldStatsCount > 0 || activeTotalLots > 0) && (
              <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                {activeTotalLots > 0 ? `${activeTotalLots} en HDV` : `${soldStatsCount} vendidos`}
              </span>
            )}
          </button>
        </div>

        {plannerMainTab === 'craft_planner' && (
          <div className="text-xs text-slate-400 px-2 flex items-center gap-3">
            {activeTotalLots > 0 && (
              <span className="text-blue-400 flex items-center gap-1">
                <Store className="w-3.5 h-3.5" />
                <strong>{activeTotalLots}</strong> lotes en HDV
              </span>
            )}
            {soldStatsCount > 0 && (
              <span className="text-emerald-400 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" />
                <strong>{soldStatsCount}</strong> recetas en historial
              </span>
            )}
          </div>
        )}
      </div>
    </>
  );
};
