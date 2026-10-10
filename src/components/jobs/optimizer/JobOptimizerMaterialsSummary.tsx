import React from 'react';
import { ShoppingCart, Coins } from 'lucide-react';
import {
  ConsolidatedMaterial,
  JobPlanState,
} from '../../../services/jobLevelingService';
import {
  getItemIconUrl,
  getItemFallbackIconUrl,
} from '../../../services/dofusDbService';

interface JobOptimizerMaterialsSummaryProps {
  materialsNeeded: ConsolidatedMaterial[];
  planSummary: JobPlanState['summary'];
  onExportToShoppingList: () => void;
}

export const JobOptimizerMaterialsSummary: React.FC<JobOptimizerMaterialsSummaryProps> = ({
  materialsNeeded,
  planSummary,
  onExportToShoppingList,
}) => {
  return (
    <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
          List of all necessary objects ({materialsNeeded.length} ingredientes requeridos):
        </div>

        <button
          onClick={onExportToShoppingList}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow transition"
        >
          <ShoppingCart className="w-3.5 h-3.5" />
          <span>Añadir a Lista de Compras</span>
        </button>
      </div>

      {/* Cuadrícula de iconos con cantidades totales */}
      <div className="flex flex-wrap gap-2 pt-1">
        {materialsNeeded.map((mat) => (
          <div
            key={mat.itemId}
            className="relative group shrink-0"
            title={`${mat.name}: ${mat.quantity.toLocaleString()} u (~${mat.totalCost.toLocaleString()} k)${
              mat.sebuscalinesEarned
                ? ` | Genera +${mat.sebuscalinesEarned.toLocaleString()} Sebuscalines (+${mat.sebuscalinesValue?.toLocaleString()} k)`
                : ''
            }`}
          >
            <img
              src={getItemIconUrl({ id: mat.itemId, iconId: mat.iconId })}
              alt={mat.name}
              className={`w-10 h-10 rounded-lg bg-slate-900 border object-contain p-1 ${
                mat.isByc
                  ? 'border-amber-500/60 ring-1 ring-amber-500/30'
                  : 'border-slate-700'
              }`}
              onError={(e) => {
                (e.target as HTMLImageElement).src = getItemFallbackIconUrl({ id: mat.itemId });
              }}
            />
            <span className="absolute -top-1.5 -left-1.5 px-1.5 py-0.2 bg-slate-950 border border-slate-700 text-amber-300 font-bold text-[10px] rounded font-mono shadow">
              {mat.quantity.toLocaleString()}
            </span>
            {mat.isByc && (
              <span className="absolute -bottom-1 -right-1 px-1 py-0.2 bg-amber-950 border border-amber-500/50 text-[8px] font-bold text-amber-400 rounded">
                ByC
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Info box de Botín ByC en materiales si aplica */}
      {planSummary.totalSebuscalines !== undefined && planSummary.totalSebuscalines > 0 && (
        <div className="flex items-center gap-2 p-2.5 bg-amber-950/30 border border-amber-500/30 rounded-xl text-xs text-amber-300">
          <Coins className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            <strong>Botín por Cacerías ByC:</strong> Al realizar las búsquedas y capturas para
            obtener los recursos ByC vía fragmentos/mapa, recibes un botín adicional de{' '}
            <strong>+{planSummary.totalSebuscalines.toLocaleString()} Sebuscalines</strong> (+
            {planSummary.totalSebuscalinesValue?.toLocaleString()} k de retorno según el precio
            configurado en Mapas & ByC).
          </span>
        </div>
      )}
    </div>
  );
};
