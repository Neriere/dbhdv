import React from 'react';
import {
  Coins,
  CheckCircle2,
} from 'lucide-react';
import { levelToXp } from '../../../services/jobLevelingService';

interface JobOptimizerProgressBarProps {
  startingLevel: number;
  actualLevel: number;
  targetLevel: number;
  actualXp: number;
  totalXpGained: number;
  progressPercent: number;
  updatedSelectedCraftsCount: number;
  planSummary: {
    totalInvestment: number;
    totalNetRevenue: number;
    netProfitOrLoss: number;
    globalKamasPerXp: number;
    totalSebuscalines?: number;
    totalSebuscalinesValue?: number;
  };
  copiedNotification: boolean;
  shoppingNotification: string | null;
  onNavigateToShopping?: () => void;
  onSaveAsStarting: () => void;
  onClearPlan: () => void;
  onCopySummary: () => void;
}

export const JobOptimizerProgressBar: React.FC<JobOptimizerProgressBarProps> = ({
  startingLevel,
  actualLevel,
  targetLevel,
  actualXp,
  totalXpGained,
  progressPercent,
  updatedSelectedCraftsCount,
  planSummary,
  copiedNotification,
  shoppingNotification,
  onNavigateToShopping,
  onSaveAsStarting,
  onClearPlan,
  onCopySummary,
}) => {
  return (
    <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
      {/* Nivel y XP Ganada */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-center sm:text-left">
        <div className="text-base sm:text-lg font-bold text-white flex flex-wrap items-center justify-center sm:justify-start gap-2">
          <span>Level: {startingLevel}</span>
          {startingLevel !== actualLevel && (
            <>
              <span className="text-amber-400 font-extrabold">&rarr; {actualLevel}</span>
              <span className="text-xs font-normal text-slate-400 font-mono">
                (+{totalXpGained.toLocaleString()} xp)
              </span>
            </>
          )}
          <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-800 text-amber-300 font-mono">
            Meta: Nvl {targetLevel}
          </span>
        </div>

        {/* Acciones de la barra */}
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={onSaveAsStarting}
            className="px-3 py-1 text-xs font-semibold text-amber-400 hover:text-amber-300 hover:bg-slate-800 rounded-md transition cursor-pointer"
            title="Guardar nivel alcanzado como nuevo punto de inicio"
          >
            SAVE
          </button>
          <button
            onClick={onClearPlan}
            className="px-3 py-1 text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-slate-800 rounded-md transition cursor-pointer"
            title="Limpiar crafteos seleccionados y fases"
          >
            DELETE
          </button>
          <button
            onClick={onCopySummary}
            className="px-3 py-1 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition cursor-pointer"
            title="Copiar plan al portapapeles"
          >
            {copiedNotification ? '¡COPIADO!' : 'SHARE'}
          </button>
        </div>
      </div>

      {/* Barra azul de progreso */}
      <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800">
        <div
          className="bg-sky-500 h-full rounded-full transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
          title={`${progressPercent}% (${actualXp.toLocaleString()} / ${levelToXp(actualLevel + 1).toLocaleString()} XP)`}
        />
      </div>

      {/* Mini KPIs Económicos */}
      {updatedSelectedCraftsCount > 0 && (
        <div className="space-y-2 pt-2 border-t border-slate-800">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
            <div className="p-2 bg-slate-950/60 rounded-lg">
              <span className="text-slate-500 block text-[10px]">INVERSIÓN TOTAL</span>
              <span className="text-slate-200 font-bold">{planSummary.totalInvestment.toLocaleString()} k</span>
            </div>
            <div className="p-2 bg-slate-950/60 rounded-lg">
              <span className="text-slate-500 block text-[10px]">
                RETORNO {planSummary.totalSebuscalines && planSummary.totalSebuscalines > 0 ? 'TOTAL (HDV + ByC)' : 'HDV (-2%)'}
              </span>
              <span className="text-slate-200 font-bold">{planSummary.totalNetRevenue.toLocaleString()} k</span>
            </div>
            <div className="p-2 bg-slate-950/60 rounded-lg">
              <span className="text-slate-500 block text-[10px]">BALANCE NETO</span>
              <span className={`font-bold ${planSummary.netProfitOrLoss >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {planSummary.netProfitOrLoss >= 0 ? '+' : ''}{planSummary.netProfitOrLoss.toLocaleString()} k
              </span>
            </div>
            <div className="p-2 bg-slate-950/60 rounded-lg">
              <span className="text-slate-500 block text-[10px]">EFICIENCIA GLOBAL</span>
              <span className="text-slate-300 font-bold">{planSummary.globalKamasPerXp.toFixed(2)} k/xp</span>
            </div>
          </div>

          {/* Pill informativo de Sebuscalines de Cacerías ByC */}
          {planSummary.totalSebuscalines !== undefined && planSummary.totalSebuscalines > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs">
              <div className="flex items-center gap-2 text-amber-300">
                <Coins className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong>Botín de Sebuscalines incluido:</strong> +{planSummary.totalSebuscalines.toLocaleString()} Sebuscalines de cofres ByC
                </span>
              </div>
              <span className="font-mono font-bold text-amber-400">
                +{planSummary.totalSebuscalinesValue?.toLocaleString()} k de retorno
              </span>
            </div>
          )}
        </div>
      )}

      {/* Alerta de notificación al añadir a compras */}
      {shoppingNotification && (
        <div className="flex items-center justify-between p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{shoppingNotification}</span>
          </div>
          {onNavigateToShopping && (
            <button
              onClick={onNavigateToShopping}
              className="text-xs font-semibold underline hover:text-emerald-200 cursor-pointer"
            >
              Ir a Compras &rarr;
            </button>
          )}
        </div>
      )}
    </div>
  );
};
