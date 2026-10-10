import React from 'react';
import {
  Coins,
  TrendingUp,
  Package,
  Store,
  Shield,
  Sparkles,
  Zap,
} from 'lucide-react';
import { KamaDisplay } from '../common/KamaDisplay';
import { MarketChannel } from './types';

interface DailyPlannerSummaryProps {
  budget: number;
  summary: {
    totalCost: number;
    totalProfit: number;
    equipSlotsUsed: number;
    consumableSlotsUsed: number;
    resourceSlotsUsed: number;
    totalSlots: number;
    totalUnits: number;
    recipeCount: number;
    overallRoi: number;
    remainingBudget: number;
    dailyInflow: number;
    paybackDays: number | null;
    paybackHours: number | null;
  };
  postedSummary: {
    totalCost: number;
    totalProfit: number;
    totalUnits: number;
    equipSlots: number;
    consumableSlots: number;
    resourceSlots: number;
    totalSlots: number;
    count: number;
  };
  marketChannel: MarketChannel;
  maxEquipSlots: number;
  maxConsumableSlots: number;
  maxResourceSlots: number;
}

export const DailyPlannerSummary: React.FC<DailyPlannerSummaryProps> = ({
  budget,
  summary,
  postedSummary,
  marketChannel,
  maxEquipSlots,
  maxConsumableSlots,
  maxResourceSlots,
}) => {
  return (
    <>
      {/* KPI Cards de Resumen del Plan */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* KPI 1: Mis Kamas Actuales & Asignación */}
        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl shadow-md space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span className="flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              Mis Kamas Actuales
            </span>
            <span className="font-mono font-bold text-amber-300">
              {budget.toLocaleString('es-ES')} K
            </span>
          </div>
          <div className="text-base sm:text-lg font-black text-white font-mono">
            <KamaDisplay amount={budget} />
          </div>
          <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800 flex">
            {budget > 0 && summary.totalCost > 0 && (
              <div
                className="h-full bg-amber-500 transition-all duration-500"
                style={{ width: `${Math.min(100, (summary.totalCost / budget) * 100)}%` }}
                title={`Requerido para plan activo: ${summary.totalCost.toLocaleString('es-ES')} K`}
              />
            )}
          </div>
          <div className="flex flex-col gap-0.5 text-[11px] text-slate-400 font-mono pt-0.5">
            <div className="flex items-center justify-between text-amber-300">
              <span>Para plan activo:</span>
              <span className="font-bold">{summary.totalCost.toLocaleString('es-ES')} K</span>
            </div>
            <div className="flex items-center justify-between text-slate-400 border-t border-slate-800/80 pt-0.5">
              <span>Kamas restantes:</span>
              <span className="text-emerald-400 font-bold">{summary.remainingBudget.toLocaleString('es-ES')} K</span>
            </div>
            {postedSummary.totalCost > 0 && (
              <div className="flex items-center justify-between text-slate-500 pt-0.5">
                <span>Gastado en puestos:</span>
                <span className="font-medium">-{postedSummary.totalCost.toLocaleString('es-ES')} K</span>
              </div>
            )}
          </div>
        </div>

        {/* KPI 2: Ganancia Neta Estimada */}
        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl shadow-md space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              Beneficio Neto Proyectado
            </span>
            <span className="font-mono font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 text-[10px]">
              +{summary.overallRoi.toFixed(1)}% ROI
            </span>
          </div>
          <div className="text-base sm:text-lg font-black text-emerald-400 font-mono">
            +<KamaDisplay amount={summary.totalProfit + postedSummary.totalProfit} />
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-500">
            <span>Tasa de venta (2%) deducida</span>
            {postedSummary.totalProfit > 0 && (
              <span className="text-emerald-400 font-mono font-semibold">
                (+{postedSummary.totalProfit.toLocaleString('es-ES')} K en HDV)
              </span>
            )}
          </div>
        </div>

        {/* KPI 3: Variedad y Objetos */}
        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl shadow-md space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span className="flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-sky-400" />
              Volumen de Producción
            </span>
            <span className="text-sky-300 font-bold font-mono text-[11px]">
              {summary.recipeCount} {summary.recipeCount === 1 ? 'receta' : 'recetas'}
              {postedSummary.count > 0 ? ` (+${postedSummary.count} en HDV)` : ''}
            </span>
          </div>
          <div className="text-base sm:text-lg font-black text-white font-mono">
            {summary.totalUnits} {summary.totalUnits === 1 ? 'unidad' : 'unidades'}
            {postedSummary.totalUnits > 0 && (
              <span className="text-xs text-slate-400 font-normal ml-1.5">
                (+{postedSummary.totalUnits} en HDV)
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-500 block">
            Distribución multiobjeto
          </span>
        </div>

        {/* KPI 4: Slots de Mercadillo */}
        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl shadow-md space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span className="flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5 text-purple-400" />
              Slots en Mercadillo
            </span>
            <span className="font-mono font-bold text-purple-300 text-[11px]">
              {marketChannel === 'multichannel' || marketChannel === 'hybrid'
                ? `${summary.totalSlots + postedSummary.totalSlots} slots tot.`
                : `${summary.totalSlots + postedSummary.totalSlots} / ${
                    marketChannel === 'equipment'
                      ? maxEquipSlots
                      : marketChannel === 'consumables'
                      ? maxConsumableSlots
                      : maxResourceSlots
                  }`}
            </span>
          </div>
          {marketChannel === 'multichannel' || marketChannel === 'hybrid' ? (
            <div className="space-y-0.5 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1">
                  <Shield className="w-3 h-3 text-purple-400" /> Equipos:
                </span>
                <span className="font-bold text-purple-300">{summary.equipSlotsUsed + postedSummary.equipSlots} / {maxEquipSlots}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1">
                  <Package className="w-3 h-3 text-emerald-400" /> Consumibles:
                </span>
                <span className="font-bold text-emerald-300">{summary.consumableSlotsUsed + postedSummary.consumableSlots} / {maxConsumableSlots}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" /> Recursos:
                </span>
                <span className="font-bold text-amber-300">{summary.resourceSlotsUsed + postedSummary.resourceSlots} / {maxResourceSlots}</span>
              </div>
            </div>
          ) : (
            <div className="text-base sm:text-lg font-black text-purple-300 font-mono">
              {summary.totalSlots + postedSummary.totalSlots} slots ocupados
            </div>
          )}
          <span className="text-[10px] text-slate-500 block">
            {marketChannel === 'multichannel' || marketChannel === 'hybrid'
              ? '3 canales independientes'
              : 'Capacidad asignada'}
          </span>
        </div>
      </div>

      {/* KPI Barra de Liquidez y Retorno de Inversión */}
      {summary.dailyInflow > 0 && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2.5 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-300 shrink-0">
              <Zap className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="font-medium text-slate-300">
                Retorno de Inversión Proyectado:
              </span>
              <span className="font-mono font-bold text-amber-300 px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-[11px]">
                {summary.paybackHours !== null ? `~${summary.paybackHours} h` : `~${summary.paybackDays?.toFixed(1)} d`}
              </span>
              <span className="text-slate-500 font-mono text-[11px]">
                (Flujo: <span className="text-emerald-400 font-bold">~{summary.dailyInflow.toLocaleString('es-ES')} K/día</span>)
              </span>
            </div>
          </div>

          <div className="text-xs font-mono">
            {summary.paybackHours !== null && summary.paybackHours <= 24 && (
              <span className="text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 text-[10px]">
                Retorno rápido (&lt; 24h)
              </span>
            )}
          </div>
        </div>
      )}
    </>
  );
};
