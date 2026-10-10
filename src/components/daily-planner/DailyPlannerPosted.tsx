import React from 'react';
import {
  Store,
  RotateCcw,
  ChevronUp,
  ChevronDown,
  Vault,
} from 'lucide-react';
import { SafeImage } from '../SafeImage';
import {
  getItemIconUrl,
  getItemFallbackIconUrl,
  getItemName,
} from '../../services/dofusDbService';
import { PostedCraftItem } from './types';

interface DailyPlannerPostedProps {
  postedCrafts: PostedCraftItem[];
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
  showPostedDrawer: boolean;
  setShowPostedDrawer: (show: boolean) => void;
  handleClearAllPosted: () => void;
  handleUndoPosted: (itemId: number) => void;
}

export const DailyPlannerPosted: React.FC<DailyPlannerPostedProps> = ({
  postedCrafts,
  postedSummary,
  showPostedDrawer,
  setShowPostedDrawer,
  handleClearAllPosted,
  handleUndoPosted,
}) => {
  if (postedCrafts.length === 0) return null;

  return (
    <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl overflow-hidden shadow-lg transition-all">
      <div
        onClick={() => setShowPostedDrawer(!showPostedDrawer)}
        className="p-3.5 bg-slate-950/80 hover:bg-slate-950 flex items-center justify-between cursor-pointer border-b border-slate-800/80 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Store className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-white text-xs flex items-center gap-2">
              Puestos en Venta en Mercadillo (HDV)
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                {postedCrafts.length} {postedCrafts.length === 1 ? 'receta' : 'recetas'} ({postedSummary.totalUnits} uds)
              </span>
            </span>
            <p className="text-[11px] text-slate-400 font-mono">
              Inversión puesta: <span className="text-emerald-300 font-bold">{postedSummary.totalCost.toLocaleString('es-ES')} K</span> • 
              Beneficio proyectado: <span className="text-emerald-400 font-bold">+{postedSummary.totalProfit.toLocaleString('es-ES')} K</span> • 
              Slots ocupados: <span className="text-purple-300 font-bold">{postedSummary.totalSlots}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleClearAllPosted();
            }}
            className="px-2.5 py-1 bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-500/30 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer"
            title="Reiniciar lista de objetos puestos y devolver todo su costo al presupuesto libre"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Limpiar puestos</span>
          </button>

          {showPostedDrawer ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </div>

      {showPostedDrawer && (
        <div className="p-3.5 space-y-2 bg-slate-900/60 max-h-72 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {postedCrafts.map((posted) => {
              const itemName = getItemName(posted.item);
              return (
                <div
                  key={posted.itemId}
                  className="bg-slate-950 border border-emerald-500/20 rounded-xl p-2.5 flex items-center justify-between gap-2 shadow-sm text-xs font-mono"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-9 h-9 bg-slate-900 border border-slate-800 rounded-lg p-1 shrink-0 flex items-center justify-center">
                      <SafeImage
                        src={getItemIconUrl(posted.item)}
                        fallbackSrc={getItemFallbackIconUrl(posted.item)}
                        alt={itemName}
                        className="w-7 h-7 object-contain"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-white truncate text-[11px]" title={itemName}>
                        {itemName}
                      </div>
                      <div className="text-[10px] text-slate-400 font-sans flex items-center gap-1">
                        <span className="font-mono text-emerald-400 font-bold">{posted.units}x</span>
                        <span>•</span>
                        <span>{posted.jobName}</span>
                        <span>•</span>
                        <span className="text-purple-300">{posted.estimatedSlots} slots</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        Gasto: {posted.totalCraftCost.toLocaleString('es-ES')} K | Ganancia: +{posted.totalNetProfit.toLocaleString('es-ES')} K
                      </div>
                      {posted.deductedBankMaterials && (
                        <div className="text-[10px] text-amber-300 font-sans flex items-center gap-1 mt-0.5">
                          <Vault className="w-3 h-3 text-amber-400" />
                          <span>{Object.values(posted.deductedBankMaterials).reduce((a, b) => a + b, 0)} recursos descontados de Mi Banco</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleUndoPosted(posted.itemId)}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-[10px] font-sans font-semibold transition-colors flex items-center gap-1 shrink-0 cursor-pointer border border-slate-700"
                    title="Deshacer: Regresar este ítem al plan activo y restaurar las kamas gastadas a tus kamas actuales"
                  >
                    <RotateCcw className="w-3 h-3 text-amber-400" />
                    <span>Deshacer</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
