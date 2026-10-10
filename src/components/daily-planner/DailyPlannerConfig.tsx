import React from 'react';
import {
  Coins,
  Shield,
  Sparkles,
  Store,
  Layers,
  Flame,
  Package,
  Zap,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import {
  MarketChannel,
  OptimizationMode,
  BUDGET_PRESETS,
  BUDGET_SHARE_PRESETS,
} from './types';
import { DailyPlannerFiltersBar } from './DailyPlannerFiltersBar';

interface DailyPlannerConfigProps {
  marketChannel: MarketChannel;
  setMarketChannel: (ch: MarketChannel) => void;
  budget: number;
  budgetInput: string;
  handleBudgetChange: (val: string) => void;
  handleApplyPresetBudget: (val: number) => void;
  maxBudgetShare: number;
  setMaxBudgetShare: (share: number) => void;
  optimizationMode: OptimizationMode;
  setOptimizationMode: (mode: OptimizationMode) => void;
  targetDays: number;
  setTargetDays: (days: number) => void;
  maxEquipSlots: number;
  setMaxEquipSlots: (slots: number) => void;
  maxConsumableSlots: number;
  setMaxConsumableSlots: (slots: number) => void;
  maxResourceSlots: number;
  setMaxResourceSlots: (slots: number) => void;
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
  maxMarketShare: number;
  setMaxMarketShare: (share: number) => void;
  excludedCount: number;
  onClearExclusions: () => void;
  onResetAllFilters: () => void;
  justPostedNotice: string | null;
}

export const DailyPlannerConfig: React.FC<DailyPlannerConfigProps> = ({
  marketChannel,
  setMarketChannel,
  budget,
  budgetInput,
  handleBudgetChange,
  handleApplyPresetBudget,
  maxBudgetShare,
  setMaxBudgetShare,
  optimizationMode,
  setOptimizationMode,
  targetDays,
  setTargetDays,
  maxEquipSlots,
  setMaxEquipSlots,
  maxConsumableSlots,
  setMaxConsumableSlots,
  maxResourceSlots,
  setMaxResourceSlots,
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
  maxMarketShare,
  setMaxMarketShare,
  excludedCount,
  onClearExclusions,
  onResetAllFilters,
  justPostedNotice,
}) => {
  return (
    <>
      {/* Controles de Configuración del Plan */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-md space-y-3.5">
        {/* Selector de Canal / Mercadillos */}
        <div className="bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5 shrink-0">
              <Store className="w-3.5 h-3.5 text-amber-400" />
              Mercado:
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 bg-slate-900 p-0.5 border border-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setMarketChannel('multichannel')}
                className={`py-1 px-2.5 rounded-md text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  marketChannel === 'multichannel' || marketChannel === 'hybrid'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Aprovecha los 3 mercadillos independientes de Dofus (Equipamiento, Consumibles y Recursos)"
              >
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                <span>Multicanal (3 HDVs)</span>
              </button>

              <button
                type="button"
                onClick={() => setMarketChannel('equipment')}
                className={`py-1 px-2.5 rounded-md text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  marketChannel === 'equipment'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Solo equipamiento (1 slot unitario por pieza)"
              >
                <Shield className="w-3.5 h-3.5 text-purple-400" />
                <span>Equipamiento</span>
              </button>

              <button
                type="button"
                onClick={() => setMarketChannel('consumables')}
                className={`py-1 px-2.5 rounded-md text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  marketChannel === 'consumables'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Solo consumibles (panes, carnes, pescados, llaves y pociones bebibles)"
              >
                <Package className="w-3.5 h-3.5 text-emerald-400" />
                <span>Consumibles</span>
              </button>

              <button
                type="button"
                onClick={() => setMarketChannel('resources')}
                className={`py-1 px-2.5 rounded-md text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  marketChannel === 'resources'
                    ? 'bg-amber-400/25 text-amber-200 border border-amber-400/50 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Solo recursos crafteables (aleaciones, tablas, concentrados, harinas, aceites y pociones de oficio)"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Recursos</span>
              </button>
            </div>
          </div>

          <span className="text-[11px] text-slate-500 font-mono">
            {marketChannel === 'multichannel' || marketChannel === 'hybrid'
              ? '400 Equipos + 400 Consumibles + 400 Recursos'
              : 'Límite: 400 slots disponibles'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {/* 1. Mis Kamas Actuales */}
          <div className="space-y-1">
            <label
              className="text-xs font-semibold text-slate-300 flex items-center gap-1.5"
              title="Kamas disponibles en tu personaje. Se descuentan automáticamente cada vez que marcas 'Ya puesto'"
            >
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              Mis Kamas Actuales
            </label>
            <div className="relative">
              <input
                type="text"
                value={budgetInput}
                onChange={(e) => handleBudgetChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-lg px-2.5 py-1.5 text-white font-mono font-bold text-xs outline-none transition-all pr-12"
                placeholder="10000000"
              />
              <span className="absolute right-2.5 top-1.5 text-xs text-amber-400 font-bold font-mono">
                K
              </span>
            </div>
            {/* Presets de presupuesto */}
            <div className="flex flex-wrap gap-1 pt-0.5">
              {BUDGET_PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => handleApplyPresetBudget(p.value)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all cursor-pointer ${
                    budget === p.value
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Tope Presupuesto por Ítem / Unidad */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label
                className="text-xs font-semibold text-slate-300 flex items-center gap-1.5"
                title="Tope máximo de presupuesto que puede consumir una sola unidad o la suma total de un ítem para no arriesgar todo el dinero en un solo producto"
              >
                <Shield className="w-3.5 h-3.5 text-amber-400" />
                Máx. % por Ítem
              </label>
              <span className="text-[10px] font-mono text-amber-300 font-bold">
                {maxBudgetShare >= 1.0 ? 'Sin límite' : `${Math.round(maxBudgetShare * 100)}%`}
              </span>
            </div>
            {/* Botones de selección rápida de porcentaje */}
            <div className="grid grid-cols-4 gap-1 bg-slate-950 p-1 border border-slate-800 rounded-lg text-center">
              {BUDGET_SHARE_PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setMaxBudgetShare(p.value)}
                  className={`py-1 rounded text-[10px] font-mono font-bold transition-all cursor-pointer ${
                    maxBudgetShare === p.value
                      ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title={p.title}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5 font-mono">
              <span title="Tope máximo de costo por unidad o acumulado del ítem">Tope unidad/ítem:</span>
              <span className="text-amber-300 font-bold">
                {maxBudgetShare >= 1.0
                  ? 'Sin límite'
                  : `${Math.floor(budget * maxBudgetShare).toLocaleString('es-ES')} K`}
              </span>
            </div>
          </div>

          {/* 3. Modo de Optimización */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-indigo-400" />
              Estrategia
            </label>
            <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 border border-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setOptimizationMode('balanced')}
                className={`py-1 px-1.5 rounded text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  optimizationMode === 'balanced'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Equilibrio entre beneficio total y velocidad de venta"
              >
                <Flame className="w-3 h-3 text-amber-400" />
                <span>Equilibrio</span>
              </button>

              <button
                type="button"
                onClick={() => setOptimizationMode('fast_cashflow')}
                className={`py-1 px-1.5 rounded text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  optimizationMode === 'fast_cashflow'
                    ? 'bg-amber-400/25 text-amber-200 border border-amber-400/50 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Mayor velocidad de retorno de kamas (menor tiempo en mercadillo)"
              >
                <Zap className="w-3 h-3 text-amber-300" />
                <span>Flujo Rápido</span>
              </button>

              <button
                type="button"
                onClick={() => setOptimizationMode('max_profit')}
                className={`py-1 px-1.5 rounded text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  optimizationMode === 'max_profit'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Maximiza el total de kamas netos ganados dentro del presupuesto"
              >
                <Coins className="w-3 h-3 text-emerald-400" />
                <span>Beneficio</span>
              </button>

              <button
                type="button"
                onClick={() => setOptimizationMode('max_roi')}
                className={`py-1 px-1.5 rounded text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  optimizationMode === 'max_roi'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Mayor rentabilidad porcentual sobre el costo"
              >
                <Sparkles className="w-3 h-3 text-sky-400" />
                <span>Mayor ROI</span>
              </button>
            </div>
          </div>

          {/* 4. Absorción y Días de Rotación */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              Horizonte de Absorción
            </label>
            <div className="grid grid-cols-4 gap-1 bg-slate-950 p-1 border border-slate-800 rounded-lg text-center">
              {[0.5, 1.0, 2.0, 3.0].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setTargetDays(d)}
                  className={`py-1 rounded text-xs font-mono font-bold transition-all cursor-pointer ${
                    targetDays === d
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title={`Tope de unidades ajustado a las ventas estimadas de ${d} ${d === 1 ? 'día' : 'días'}`}
                >
                  {d}d
                </button>
              ))}
            </div>
            <span className="text-[10px] text-slate-500 block pt-0.5">
              Tope: ventas de {targetDays} {targetDays === 1 ? 'día' : 'días'}
            </span>
          </div>

          {/* 5. Límite de Slots HDV */}
          <div className="space-y-1">
            {marketChannel === 'multichannel' || marketChannel === 'hybrid' ? (
              <div className="space-y-1.5">
                <div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-300 flex items-center gap-1">
                      <Shield className="w-3 h-3 text-purple-400" />
                      Slots Equipos:
                    </span>
                    <span className="font-mono text-purple-300 font-bold text-[10px]">
                      {maxEquipSlots} / 400
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 bg-slate-950 p-0.5 border border-slate-800 rounded-lg text-center mt-0.5">
                    {[50, 100, 150, 400].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setMaxEquipSlots(s)}
                        className={`py-0.5 rounded text-[10px] font-mono font-bold cursor-pointer ${
                          maxEquipSlots === s
                            ? 'bg-purple-500/25 text-purple-300 border border-purple-500/40'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-300 flex items-center gap-1">
                      <Package className="w-3 h-3 text-emerald-400" />
                      Slots Consumibles:
                    </span>
                    <span className="font-mono text-emerald-300 font-bold text-[10px]">
                      {maxConsumableSlots} / 400
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 bg-slate-950 p-0.5 border border-slate-800 rounded-lg text-center mt-0.5">
                    {[50, 100, 150, 400].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setMaxConsumableSlots(s)}
                        className={`py-0.5 rounded text-[10px] font-mono font-bold cursor-pointer ${
                          maxConsumableSlots === s
                            ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-300 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      Slots Recursos:
                    </span>
                    <span className="font-mono text-amber-300 font-bold text-[10px]">
                      {maxResourceSlots} / 400
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 bg-slate-950 p-0.5 border border-slate-800 rounded-lg text-center mt-0.5">
                    {[50, 100, 150, 400].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setMaxResourceSlots(s)}
                        className={`py-0.5 rounded text-[10px] font-mono font-bold cursor-pointer ${
                          maxResourceSlots === s
                            ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : marketChannel === 'equipment' ? (
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5 text-purple-400" />
                    Slots Equipos
                  </label>
                  <span className="text-[10px] font-mono text-purple-300 font-bold">
                    {maxEquipSlots} / 400
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1 bg-slate-950 p-1 border border-slate-800 rounded-lg text-center mt-1">
                  {[50, 100, 150, 400].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setMaxEquipSlots(s)}
                      className={`py-1 rounded text-[11px] font-mono font-bold transition-all cursor-pointer ${
                        maxEquipSlots === s
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : marketChannel === 'consumables' ? (
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5 text-emerald-400" />
                    Slots Consumibles
                  </label>
                  <span className="text-[10px] font-mono text-emerald-300 font-bold">
                    {maxConsumableSlots} / 400
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1 bg-slate-950 p-1 border border-slate-800 rounded-lg text-center mt-1">
                  {[50, 100, 150, 400].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setMaxConsumableSlots(s)}
                      className={`py-1 rounded text-[11px] font-mono font-bold transition-all cursor-pointer ${
                        maxConsumableSlots === s
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5 text-amber-400" />
                    Slots Recursos
                  </label>
                  <span className="text-[10px] font-mono text-amber-300 font-bold">
                    {maxResourceSlots} / 400
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1 bg-slate-950 p-1 border border-slate-800 rounded-lg text-center mt-1">
                  {[50, 100, 150, 400].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setMaxResourceSlots(s)}
                      className={`py-1 rounded text-[11px] font-mono font-bold transition-all cursor-pointer ${
                        maxResourceSlots === s
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Barra Secundaria de Filtros */}
        <DailyPlannerFiltersBar
          onlyMyJobs={onlyMyJobs}
          setOnlyMyJobs={setOnlyMyJobs}
          requireSalesHistory={requireSalesHistory}
          setRequireSalesHistory={setRequireSalesHistory}
          recentSalesOnly={recentSalesOnly}
          setRecentSalesOnly={setRecentSalesOnly}
          minDailySales={minDailySales}
          setMinDailySales={setMinDailySales}
          filterOutliers={filterOutliers}
          setFilterOutliers={setFilterOutliers}
          useBankResources={useBankResources}
          setUseBankResources={setUseBankResources}
          avoidAlreadyListed={avoidAlreadyListed}
          setAvoidAlreadyListed={setAvoidAlreadyListed}
          selectedJobFilter={selectedJobFilter}
          setSelectedJobFilter={setSelectedJobFilter}
          minRoiFilter={minRoiFilter}
          setMinRoiFilter={setMinRoiFilter}
          maxBudgetShare={maxBudgetShare}
          budget={budget}
          maxMarketShare={maxMarketShare}
          setMaxMarketShare={setMaxMarketShare}
          excludedCount={excludedCount}
          onClearExclusions={onClearExclusions}
          onResetAllFilters={onResetAllFilters}
        />
      </div>

      {/* Notificación de Objeto Puesto en HDV */}
      {justPostedNotice && (
        <div className="bg-emerald-500/15 border border-emerald-500/30 rounded-2xl px-4 py-2.5 flex items-center justify-between text-xs text-emerald-300 shadow-md">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold">{justPostedNotice}</span>
          </div>
          <span className="text-[10px] font-mono text-emerald-400/80 bg-emerald-500/20 px-2 py-0.5 rounded">
            Kamas actualizadas
          </span>
        </div>
      )}
    </>
  );
};
