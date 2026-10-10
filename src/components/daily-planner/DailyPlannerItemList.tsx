import React from 'react';
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { PresetCraftableItem } from '../../data/presetCraftableItems';
import { ItemSoldStats } from '../../services/salesHistoryService';
import { PlannedCraftItem } from './types';
import { DailyPlannerItemCard } from './DailyPlannerItemCard';

interface DailyPlannerItemListProps {
  plannedCrafts: PlannedCraftItem[];
  postedCraftsCount: number;
  postedTotalCost: number;
  budget: number;
  requireSalesHistory: boolean;
  onApplyPresetBudget: (val: number) => void;
  onClearAllPosted: () => void;
  onSetMinRoiFilter: (val: number) => void;
  onSetRequireSalesHistory: (val: boolean) => void;
  onOpenJobsModal: () => void;
  copiedItemNameId: number | null;
  onCopyName: (id: number, name: string) => void;
  onMarkAsPosted: (craft: PlannedCraftItem) => void;
  onDiscardItem: (id: number) => void;
  onAdjustUnits: (id: number, delta: number) => void;
  useBankResources: boolean;
  bankQtyMap: Record<number, number>;
  marketPrices: Record<number, number>;
  activeSummary: {
    byItemMap: Record<number, { count: number; totalQty: number; timeLabel: string }>;
  };
  soldStatsMap: Map<number, ItemSoldStats>;
  onSelectRecipeForCalculator: (item: PresetCraftableItem) => void;
  onSelectForCrushing?: (item: PresetCraftableItem) => void;
  onAddToCart: (item: PresetCraftableItem, units: number) => void;
}

export const DailyPlannerItemList: React.FC<DailyPlannerItemListProps> = ({
  plannedCrafts,
  postedCraftsCount,
  postedTotalCost,
  budget,
  requireSalesHistory,
  onApplyPresetBudget,
  onClearAllPosted,
  onSetMinRoiFilter,
  onSetRequireSalesHistory,
  onOpenJobsModal,
  copiedItemNameId,
  onCopyName,
  onMarkAsPosted,
  onDiscardItem,
  onAdjustUnits,
  useBankResources,
  bankQtyMap,
  marketPrices,
  activeSummary,
  soldStatsMap,
  onSelectRecipeForCalculator,
  onSelectForCrushing,
  onAddToCart,
}) => {
  if (plannedCrafts.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center max-w-lg mx-auto space-y-4 shadow-lg">
        <div className="w-14 h-14 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-center text-slate-500 mx-auto">
          {postedCraftsCount > 0 ? (
            <CheckCircle2 className="w-7 h-7 text-emerald-400" />
          ) : (
            <AlertCircle className="w-7 h-7" />
          )}
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-white">
            {postedCraftsCount > 0
              ? '¡Kamas actuales completamente invertidas!'
              : 'No se encontraron crafteos viables con los filtros actuales'}
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            {postedCraftsCount > 0
              ? `Has marcado ${postedCraftsCount} crafteo(s) como puestos en mercadillo (${postedTotalCost.toLocaleString('es-ES')} K invertidos). Puedes ingresar más fondos en 'Mis Kamas Actuales' si deseas planificar más objetos.`
              : `Intenta ingresar más kamas en 'Mis Kamas Actuales', bajar el filtro de ROI mínimo, o desactivar temporalmente "Solo oficios que puedo craftear" ${requireSalesHistory ? 'o "Solo con historial de ventas"' : ''} para ampliar las opciones.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          <button
            type="button"
            onClick={() => onApplyPresetBudget(budget + 5_000_000)}
            className="px-3 py-1.5 bg-amber-500 text-slate-950 rounded-xl text-xs font-bold cursor-pointer hover:bg-amber-400"
          >
            +5 Mk a mis kamas
          </button>
          {postedCraftsCount > 0 ? (
            <button
              type="button"
              onClick={onClearAllPosted}
              className="px-3 py-1.5 bg-slate-800 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-bold cursor-pointer hover:bg-slate-700"
            >
              Limpiar puestos y restaurar kamas
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onSetMinRoiFilter(0)}
                className="px-3 py-1.5 bg-slate-800 text-slate-300 border border-slate-700 rounded-xl text-xs font-bold cursor-pointer hover:bg-slate-700"
              >
                Quitar ROI mínimo
              </button>
              {requireSalesHistory && (
                <button
                  type="button"
                  onClick={() => onSetRequireSalesHistory(false)}
                  className="px-3 py-1.5 bg-slate-800 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold cursor-pointer hover:bg-slate-700"
                >
                  Permitir sin historial de ventas
                </button>
              )}
              <button
                type="button"
                onClick={onOpenJobsModal}
                className="px-3 py-1.5 bg-slate-800 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold cursor-pointer hover:bg-slate-700"
              >
                Configurar Niveles de Oficio
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          Cartera Recomendada ({plannedCrafts.length} recetas)
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {plannedCrafts.map((craft) => (
          <DailyPlannerItemCard
            key={craft.item.id}
            craft={craft}
            budget={budget}
            isCopied={copiedItemNameId === craft.item.id}
            onCopyName={onCopyName}
            onMarkAsPosted={onMarkAsPosted}
            onDiscardItem={onDiscardItem}
            onAdjustUnits={onAdjustUnits}
            useBankResources={useBankResources}
            bankQtyMap={bankQtyMap}
            marketPrices={marketPrices}
            activeItemInfo={activeSummary.byItemMap[craft.item.id]}
            soldItemInfo={soldStatsMap.get(craft.item.id)}
            onSelectRecipeForCalculator={onSelectRecipeForCalculator}
            onSelectForCrushing={onSelectForCrushing}
            onAddToCart={onAddToCart}
          />
        ))}
      </div>
    </div>
  );
};
