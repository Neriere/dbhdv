import React from 'react';
import {
  RotateCcw,
  Zap,
  SlidersHorizontal,
} from 'lucide-react';
import {
  SUPPORTED_JOBS,
  JobOptimizerStrategy,
  xpToLevel,
  levelToXp,
} from '../../../services/jobLevelingService';

interface JobOptimizerConfigBarProps {
  jobId: number;
  jobLevels: Record<number, number>;
  userSavedLevel: number;
  startingLevel: number;
  targetLevel: number;
  startingXp: number;
  xpMultiplier: number;
  isBoostedServer: boolean;
  strategy: JobOptimizerStrategy;
  setStrategy: (s: JobOptimizerStrategy) => void;
  showAdvancedFilters: boolean;
  setShowAdvancedFilters: (show: boolean) => void;
  excludeByc: boolean;
  setExcludeByc: (val: boolean) => void;
  excludePebbles: boolean;
  setExcludePebbles: (val: boolean) => void;
  maxDailyAbsorptionRatio: number;
  setMaxDailyAbsorptionRatio: (val: number) => void;
  onSelectJob: (jobId: number) => void;
  onStartingLevelChange: (lvl: number) => void;
  onTargetLevelChange: (lvl: number) => void;
  onSetTargetNextMilestone: () => void;
  onSetTargetPlusTen: () => void;
  onSetTarget100: () => void;
  onSetTarget200: () => void;
  onStartingXpChange: (xp: number) => void;
  setXpMultiplier: (mult: number) => void;
  setIsBoostedServer: (boost: boolean) => void;
  onAutoOptimize: () => void;
}

export const JobOptimizerConfigBar: React.FC<JobOptimizerConfigBarProps> = ({
  jobId,
  jobLevels,
  userSavedLevel,
  startingLevel,
  targetLevel,
  startingXp,
  xpMultiplier,
  isBoostedServer,
  strategy,
  setStrategy,
  showAdvancedFilters,
  setShowAdvancedFilters,
  excludeByc,
  setExcludeByc,
  excludePebbles,
  setExcludePebbles,
  maxDailyAbsorptionRatio,
  setMaxDailyAbsorptionRatio,
  onSelectJob,
  onStartingLevelChange,
  onTargetLevelChange,
  onSetTargetNextMilestone,
  onSetTargetPlusTen,
  onSetTarget100,
  onSetTarget200,
  onStartingXpChange,
  setXpMultiplier,
  setIsBoostedServer,
  onAutoOptimize,
}) => {
  return (
    <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-start">
        {/* Job Select */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">
            Oficio
          </label>
          <select
            value={jobId}
            onChange={(e) => onSelectJob(Number(e.target.value))}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm font-semibold text-white focus:outline-none focus:border-amber-500"
          >
            {SUPPORTED_JOBS.map((j) => (
              <option key={j.id} value={j.id}>
                {j.nameEs} (Lvl {jobLevels[j.id] || 1})
              </option>
            ))}
          </select>
        </div>

        {/* Level Start Input */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">
            Nivel de Inicio
          </label>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={1}
              max={200}
              value={startingLevel}
              onChange={(e) => onStartingLevelChange(Number(e.target.value) || 1)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm font-semibold text-white focus:outline-none focus:border-amber-500 font-mono"
            />
            <button
              onClick={() => onStartingLevelChange(userSavedLevel)}
              title="Cargar nivel guardado de mi perfil"
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-200 transition shrink-0"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Target Level Input */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-amber-400">
              Nivel Objetivo
            </label>
            <span className="text-[10px] text-slate-400 font-mono">Meta</span>
          </div>
          <input
            type="number"
            min={startingLevel + 1}
            max={200}
            value={targetLevel}
            onChange={(e) => onTargetLevelChange(Number(e.target.value) || (startingLevel + 1))}
            className="w-full bg-slate-950 border border-amber-500/50 rounded-lg px-3 py-2 text-sm font-bold text-amber-300 focus:outline-none focus:border-amber-400 font-mono"
          />
          <div className="flex items-center gap-1 mt-1.5">
            <button
              onClick={onSetTargetNextMilestone}
              className="flex-1 py-0.5 px-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded text-[10px] font-bold font-mono transition"
              title="Fijar siguiente hito decadal"
            >
              +Hito
            </button>
            <button
              onClick={onSetTargetPlusTen}
              className="flex-1 py-0.5 px-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded text-[10px] font-bold font-mono transition"
              title="+10 niveles"
            >
              +10
            </button>
            <button
              onClick={onSetTarget100}
              className="flex-1 py-0.5 px-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded text-[10px] font-bold font-mono transition"
              title="Fijar nivel 100"
            >
              100
            </button>
            <button
              onClick={onSetTarget200}
              className="flex-1 py-0.5 px-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded text-[10px] font-bold font-mono transition"
              title="Fijar nivel 200"
            >
              200
            </button>
          </div>
        </div>

        {/* Experience Points Input */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-amber-300">
              XP Actual del Oficio
            </label>
            <span className="text-[10px] text-amber-400 font-mono font-bold">
              Nv. {xpToLevel(startingXp)}
            </span>
          </div>
          <input
            type="number"
            min={0}
            max={398000}
            value={startingXp}
            onChange={(e) => onStartingXpChange(Number(e.target.value) || 0)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm font-semibold text-white focus:outline-none focus:border-amber-500 font-mono"
            title="Introduce tu XP exacta para empezar el cálculo desde tus puntos actuales en vez de XP cero del nivel"
          />
          <div className="text-[10px] text-slate-400 mt-1 truncate font-mono">
            {(() => {
              const currentLvl = xpToLevel(startingXp);
              const curLvlXp = levelToXp(currentLvl);
              const nextLvlXp = levelToXp(currentLvl + 1);
              const diff = Math.max(1, nextLvlXp - curLvlXp);
              const inProgress = Math.max(0, startingXp - curLvlXp);
              const pct = Math.min(100, Math.floor((inProgress / diff) * 100));
              return `${inProgress.toLocaleString()} / ${diff.toLocaleString()} XP (${pct}%)`;
            })()}
          </div>
        </div>

        {/* XP Coefficient */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">
            Coeficiente de XP
          </label>
          <select
            value={xpMultiplier}
            onChange={(e) => setXpMultiplier(Number(e.target.value))}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
          >
            <option value={1.0}>100% (Normal)</option>
            <option value={1.25}>125% (+25%)</option>
            <option value={1.5}>150% (+50% Bonus Pack)</option>
            <option value={2.0}>200% (+100% Almanax)</option>
            <option value={3.0}>300% (Temporis / 3x)</option>
          </select>
        </div>

        {/* Epic Server Bonus / Boosted */}
        <div className="flex items-center pt-5">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-300">
            <input
              type="checkbox"
              checked={isBoostedServer}
              onChange={(e) => setIsBoostedServer(e.target.checked)}
              className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-amber-500 focus:ring-0"
            />
            <span>Bonus servidor épico / x3</span>
          </label>
        </div>
      </div>

      {/* Barra de Filtros y Estrategias */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-slate-400 font-medium">Estrategia:</span>
          <select
            value={strategy}
            onChange={(e) => setStrategy(e.target.value as JobOptimizerStrategy)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-amber-300 font-medium focus:outline-none"
          >
            <option value="mixed_budget">🔀 Mixto: Menor Inversión (Venta HDV + Romper máx 3x)</option>
            <option value="mixed_profit">🔀 Mixto: Máxima Rentabilidad (Venta HDV + Romper máx 3x)</option>
            <option value="low_budget">💸 Mínimo Gasto de Bolsillo (Solo Crafteo Barato)</option>
            <option value="profit">💰 Máxima Rentabilidad (Solo Reventa HDV)</option>
            <option value="high_turnover">🌊 Alta Rotación y Liquidez (Venta Rápida)</option>
            <option value="fastest">⚡ Ultrarrápido (Menos Crafteos / Más XP)</option>
            <option value="consumables_only">🌿 Solo Consumibles / Componentes</option>
            <option value="crush_runes">♻️ Rompe-Runas (Solo Machacado)</option>
          </select>

          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
          >
            <SlidersHorizontal className="w-3 h-3" />
            <span>Filtros avanzados</span>
          </button>
        </div>

        {/* Botón Destacado Auto-Optimizar hacia Nivel Objetivo */}
        <button
          onClick={onAutoOptimize}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition"
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Auto-Optimizar Ruta ({startingLevel} &rarr; {targetLevel})</span>
        </button>
      </div>

      {/* Panel Desplegable de Filtros Avanzados */}
      {showAdvancedFilters && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-950/60 border border-slate-800 rounded-xl text-xs animate-fade-in">
          <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={excludeByc}
              onChange={(e) => setExcludeByc(e.target.checked)}
              className="rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-0"
            />
            <span>Excluir recetas de Busca y Captura (ByC)</span>
          </label>

          <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={excludePebbles}
              onChange={(e) => setExcludePebbles(e.target.checked)}
              className="rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-0"
            />
            <span>Excluir recetas con Guijarros de Koliseo</span>
          </label>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 shrink-0">Límite ventas diarias:</span>
            <select
              value={maxDailyAbsorptionRatio}
              onChange={(e) => setMaxDailyAbsorptionRatio(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200"
            >
              <option value={1.0}>1x ventas diarias</option>
              <option value={2.0}>2x ventas diarias</option>
              <option value={3.0}>3x ventas diarias (Recomendado)</option>
              <option value={4.0}>4x ventas diarias (Flexible)</option>
              <option value={999}>Sin límite de ventas</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
};
