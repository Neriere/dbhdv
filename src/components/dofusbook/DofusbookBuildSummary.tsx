import React from 'react';
import {
  Shield,
  ExternalLink,
  X,
  Trash2,
  RotateCcw,
  CheckCheck,
  Check,
  Copy,
  ShoppingCart,
  PackageCheck,
  CheckCircle2,
  Hammer,
  Zap,
  TrendingDown,
} from 'lucide-react';
import { DofusbookBuildAnalysis } from '../../types';
import { DofusbookComputedData } from './types';
import { formatKamas } from '../../utils/kamaFormatters';

interface DofusbookBuildSummaryProps {
  analysis: DofusbookBuildAnalysis;
  computedData: DofusbookComputedData;
  copiedSummary: boolean;
  shoppingAddedToast: boolean;
  onNavigateToShopping?: () => void;
  onClearSet: () => void;
  onRemoveOwnedItems: () => void;
  onResetAllStatuses: () => void;
  onMarkAllAsOwned: () => void;
  onCopySummary: () => void;
  onSendToShoppingList: () => void;
}

export const DofusbookBuildSummary: React.FC<DofusbookBuildSummaryProps> = ({
  analysis,
  computedData,
  copiedSummary,
  shoppingAddedToast,
  onNavigateToShopping,
  onClearSet,
  onRemoveOwnedItems,
  onResetAllStatuses,
  onMarkAllAsOwned,
  onCopySummary,
  onSendToShoppingList,
}) => {
  return (
    <div className="space-y-4">
      {/* Build Info & Progress Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center text-slate-950 font-black text-lg shadow-md shrink-0">
              <Shield className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-white">{analysis.buildName}</h3>
                {analysis.buildLevel && (
                  <span className="px-2 py-0.5 bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold rounded-md">
                    Nivel {analysis.buildLevel}
                  </span>
                )}
                <span className="px-2 py-0.5 bg-slate-800 text-slate-300 text-xs font-medium rounded-md border border-slate-700">
                  {analysis.items.length} piezas en build
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                <span className="truncate max-w-xs font-mono">{analysis.url}</span>
                {analysis.resolvedUrl && (
                  <a
                    href={analysis.resolvedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Ver en Dofusbook</span>
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Quick Build Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={onClearSet}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors border border-slate-700 cursor-pointer"
              title="Limpiar el set actual y cargar otro"
            >
              <X className="w-3 h-3 text-rose-400" />
              <span>Nuevo Set</span>
            </button>

            {computedData.ownedCount > 0 && (
              <button
                type="button"
                onClick={onRemoveOwnedItems}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors border border-slate-700 cursor-pointer"
                title="Eliminar de la sección todas las piezas ya obtenidas"
              >
                <Trash2 className="w-3 h-3 text-rose-400" />
                <span>Eliminar obtenidas ({computedData.ownedCount})</span>
              </button>
            )}

            {computedData.ownedCount > 0 || computedData.removedCount > 0 ? (
              <button
                type="button"
                onClick={onResetAllStatuses}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors border border-slate-700 cursor-pointer"
                title="Reiniciar todos los objetos a pendientes"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reiniciar estados</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onMarkAllAsOwned}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-300 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors border border-slate-700 cursor-pointer"
                title="Marcar todas las piezas como ya obtenidas"
              >
                <CheckCheck className="w-3 h-3 text-emerald-400" />
                <span>Marcar todo obtenido</span>
              </button>
            )}

            <button
              type="button"
              onClick={onCopySummary}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors border border-slate-700 cursor-pointer shadow-sm"
              title="Copiar resumen con costes pendientes al portapapeles"
            >
              {copiedSummary ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">¡Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Copiar Resumen</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onSendToShoppingList}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/20 cursor-pointer"
              title="Añadir ingredientes de piezas pendientes a la lista de compras"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>Enviar Materiales Pendientes a Compras</span>
            </button>
          </div>
        </div>

        {/* Set Progression Bar */}
        <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between text-xs flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-300 flex items-center gap-1.5">
                <PackageCheck className="w-4 h-4 text-emerald-400" />
                Progreso del Set:
              </span>
              <span className="font-mono font-bold text-emerald-400">
                {computedData.ownedCount} de {computedData.activePiecesCount} piezas listas
              </span>
              {computedData.removedCount > 0 && (
                <span className="text-slate-500 text-[11px]">
                  ({computedData.removedCount} descartada{computedData.removedCount > 1 ? 's' : ''})
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-[11px]">
                Faltan:{' '}
                <strong className="text-amber-400 font-mono font-bold">
                  {computedData.neededCount} piezas
                </strong>
              </span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-mono font-black text-xs border border-emerald-500/30">
                {computedData.progressPercent}%
              </span>
            </div>
          </div>

          {/* Visual Progress Track */}
          <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300 rounded-full"
              style={{ width: `${computedData.progressPercent}%` }}
            ></div>
          </div>
        </div>

        {/* Set Completed Banner */}
        {computedData.activePiecesCount > 0 && computedData.neededCount === 0 && (
          <div className="bg-emerald-950/40 border border-emerald-500/50 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg shadow-emerald-950/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h4 className="font-black text-sm text-white flex items-center gap-2">
                  ¡Set Completado al 100%!
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-normal">
                    Todas las piezas obtenidas
                  </span>
                </h4>
                <p className="text-xs text-slate-300">
                  Has terminado de conseguir todo lo necesario para este set. Puedes limpiar la sección para comenzar con otro set.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onClearSet}
                className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
              >
                <X className="w-3.5 h-3.5 stroke-[3]" />
                <span>Limpiar Sección y Cargar Nuevo Set</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Toast Notification */}
      {shoppingAddedToast && (
        <div className="bg-emerald-500/15 border border-emerald-500/40 p-3 rounded-xl flex items-center justify-between text-emerald-300 text-xs shadow-lg animate-in slide-in-from-top duration-200">
          <div className="flex items-center gap-2 font-bold">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>¡Materiales de las piezas pendientes añadidos al Planificador de Compras con éxito!</span>
          </div>
          {onNavigateToShopping && (
            <button
              type="button"
              onClick={onNavigateToShopping}
              className="px-2.5 py-1 bg-emerald-500 text-slate-950 font-black rounded-lg text-[11px] hover:bg-emerald-400 transition-colors"
            >
              Ver Lista
            </button>
          )}
        </div>
      )}

      {/* Financial KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Direct Market Buy Total */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1 shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span className="flex items-center gap-1.5">
              <ShoppingCart className="w-3.5 h-3.5 text-sky-400" />
              Compra Directa (HDV)
            </span>
            <span className="text-[10px] uppercase font-bold text-slate-500">
              {computedData.neededCount} pendientes
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-white font-mono tracking-tight">
            {formatKamas(computedData.totals.totalMarketPrice)}
          </div>
          <p className="text-[11px] text-slate-400">
            Coste si compras en mercadillo todas las piezas que aún te faltan.
          </p>
        </div>

        {/* Crafting Cost Total */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1 shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span className="flex items-center gap-1.5">
              <Hammer className="w-3.5 h-3.5 text-amber-400" />
              Coste de Crafteo
            </span>
            <span className="text-[10px] uppercase font-bold text-slate-500">
              {computedData.totals.craftablePiecesCount} crafteables
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-300 font-mono tracking-tight">
            {formatKamas(computedData.totals.totalCraftCost)}
          </div>
          <p className="text-[11px] text-slate-400">
            Coste de materiales para fabricar las piezas que te faltan.
          </p>
        </div>

        {/* Optimal Strategy Mix */}
        <div className="bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/30 rounded-2xl p-4 space-y-1 shadow-md">
          <div className="flex items-center justify-between text-emerald-400 text-xs font-semibold">
            <span className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              Mix Óptimo Pendiente
            </span>
            <span className="text-[10px] uppercase font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
              Recomendado
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-300 font-mono tracking-tight">
            {formatKamas(computedData.totals.totalOptimalCost)}
          </div>
          <p className="text-[11px] text-slate-400">
            Presupuesto real para completar tu set combinando crafteo y compra.
          </p>
        </div>

        {/* Savings Total */}
        <div className="bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-900 border border-amber-500/30 rounded-2xl p-4 space-y-1 shadow-md">
          <div className="flex items-center justify-between text-amber-400 text-xs font-semibold">
            <span className="flex items-center gap-1.5">
              <TrendingDown className="w-3.5 h-3.5 text-amber-400" />
              Ahorro Máximo
            </span>
            <span className="text-[10px] uppercase font-bold text-amber-500">
              {computedData.totals.totalMarketPrice > 0
                ? `${Math.round(
                    (computedData.totals.totalSavings /
                      Math.max(1, computedData.totals.totalMarketPrice)) *
                      100
                  )}%`
                : '0%'}
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-400 font-mono tracking-tight">
            +{formatKamas(computedData.totals.totalSavings)}
          </div>
          <p className="text-[11px] text-slate-400">
            Kamas ahorradas optimizando cada pieza pendiente individualmente.
          </p>
        </div>
      </div>
    </div>
  );
};
