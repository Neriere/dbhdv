import React from "react";
import {
  Layers,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  ShoppingCart,
  Zap,
} from "lucide-react";
import { DofusItem, ReverseCraftAnalysis } from "../../types";
import { getItemIconUrl, getItemName } from "../../services/dofusDbService";
import { SafeImage } from "../SafeImage";

interface ReverseCraftCardProps {
  craft: ReverseCraftAnalysis;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onSelectRecipeForCalculator: (item: DofusItem) => void;
  onSelectForCrushing?: (item: DofusItem) => void;
  onAddMissingToShoppingList: (craft: ReverseCraftAnalysis) => void;
}

export const ReverseCraftCard: React.FC<ReverseCraftCardProps> = ({
  craft,
  isExpanded,
  onToggleExpand,
  onSelectRecipeForCalculator,
  onSelectForCrushing,
  onAddMissingToShoppingList,
}) => {
  const isProfitable = craft.netProfit > 0;

  return (
    <div
      className={`rounded-2xl border transition-all ${
        craft.isFullyCraftable
          ? "bg-slate-900/90 border-emerald-500/40 hover:border-emerald-500/70"
          : isProfitable
          ? "bg-slate-900/80 border-slate-800 hover:border-slate-700"
          : "bg-slate-900/50 border-slate-800/60 opacity-80"
      } shadow-md overflow-hidden`}
    >
      {/* Header Row */}
      <div className="p-4 sm:p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        {/* Item Icon & Basic Info */}
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="relative w-14 h-14 rounded-xl bg-slate-950 border border-slate-700/80 flex items-center justify-center p-1.5 shrink-0 shadow-inner">
            <SafeImage
              src={getItemIconUrl(craft.item.iconId || craft.item.id)}
              alt={getItemName(craft.item)}
              className="w-11 h-11 object-contain"
            />
            {craft.isFullyCraftable && (
              <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center shadow">
                <Check className="w-3 h-3 stroke-[3]" />
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3
                className="text-base font-bold text-white hover:text-amber-400 cursor-pointer transition-colors"
                onClick={() => onSelectRecipeForCalculator(craft.item)}
              >
                {getItemName(craft.item)}
              </h3>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono font-medium">
                Nv. {craft.item.level}
              </span>
              {craft.jobNameEs && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 font-semibold">
                  {craft.jobNameEs}
                </span>
              )}
            </div>

            <div className="mt-1 flex items-center gap-3 text-xs text-slate-400 flex-wrap">
              <span className="flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-slate-500" />
                Materiales en banco:{" "}
                <strong
                  className={
                    craft.materialsCoveragePercent === 100
                      ? "text-emerald-400"
                      : "text-amber-400"
                  }
                >
                  {craft.availableIngredientsCount}/{craft.totalIngredientsCount} ({craft.materialsCoveragePercent}%)
                </strong>
              </span>

              {craft.maxCraftableWithBank > 0 && (
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                  ¡Puedes craftear {craft.maxCraftableWithBank}x sin comprar nada!
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Economics & Profit Metrics */}
        <div className="flex items-center gap-4 sm:gap-6 flex-wrap lg:flex-nowrap justify-between w-full lg:w-auto">
          {/* Cost breakdown */}
          <div className="text-right">
            <div className="text-xs text-slate-400">Coste Compra Mercadillo</div>
            <div
              className={`text-sm font-mono font-bold ${
                craft.missingMaterialsCost === 0 ? "text-emerald-400" : "text-slate-200"
              }`}
            >
              {craft.missingMaterialsCost === 0
                ? "0 K (Todo en banco)"
                : `${craft.missingMaterialsCost.toLocaleString()} K`}
            </div>
            <div className="text-[11px] text-slate-500">
              Ahorro banco: {craft.bankMaterialsValue.toLocaleString()} K
            </div>
          </div>

          {/* Market Sale Price */}
          <div className="text-right">
            <div className="text-xs text-slate-400">Venta Estimada Mercadillo</div>
            <div className="text-sm font-mono font-bold text-amber-300">
              {craft.marketSalePrice.toLocaleString()} K
            </div>
            <div className="text-[11px] text-slate-500">
              Coste Total: {craft.totalCraftCost.toLocaleString()} K
            </div>
          </div>

          {/* Net Profit & ROI Pill */}
          <div className="text-right min-w-[130px] bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
            <div className="text-xs text-slate-400">Ganancia Neta</div>
            <div
              className={`text-base font-mono font-extrabold flex items-center justify-end gap-1 ${
                isProfitable ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {isProfitable ? "+" : ""}
              {craft.netProfit.toLocaleString()} K
            </div>
            <div
              className={`text-xs font-bold ${
                isProfitable ? "text-emerald-500" : "text-rose-500"
              }`}
            >
              ROI: {craft.roi > 0 ? "+" : ""}
              {craft.roi.toFixed(1)}%
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleExpand}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
              title={isExpanded ? "Ocultar ingredientes" : "Ver ingredientes"}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => onSelectRecipeForCalculator(craft.item)}
              className="flex items-center gap-1 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow transition-all cursor-pointer"
              title="Abrir en Calculadora de Recetas"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Ver Receta</span>
            </button>
          </div>
        </div>
      </div>

      {/* Expandable Ingredients Accordion */}
      {isExpanded && (
        <div className="p-4 sm:p-5 bg-slate-950/80 border-t border-slate-800/80 space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              Desglose de Ingredientes de la Receta
            </h4>

            <div className="flex items-center gap-2">
              {!craft.isFullyCraftable && (
                <button
                  type="button"
                  onClick={() => onAddMissingToShoppingList(craft)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-300 text-xs font-bold transition-all cursor-pointer"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  Añadir faltantes a Lista de Compras
                </button>
              )}

              {onSelectForCrushing && (
                <button
                  type="button"
                  onClick={() => onSelectForCrushing(craft.item)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-300 text-xs font-bold transition-all cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5" />
                  Probar en Rompedora
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {craft.ingredientsStatus.map((ing) => (
              <div
                key={ing.itemId}
                className={`p-3 rounded-xl border flex items-center gap-3 ${
                  ing.isFullyAvailable
                    ? "bg-emerald-950/20 border-emerald-500/30"
                    : "bg-slate-900 border-slate-800"
                }`}
              >
                <div className="w-9 h-9 rounded-lg bg-slate-950 border border-slate-700/60 flex items-center justify-center p-1 shrink-0">
                  <SafeImage
                    src={getItemIconUrl(ing.itemIconId || ing.itemId)}
                    alt={ing.itemName}
                    className="w-7 h-7 object-contain"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-slate-200 truncate">
                    {ing.itemName}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    En banco:{" "}
                    <strong
                      className={
                        ing.isFullyAvailable ? "text-emerald-400" : "text-amber-400"
                      }
                    >
                      {ing.inBank}
                    </strong>{" "}
                    / Requerido: <strong>{ing.required}</strong>
                  </div>
                  {!ing.isFullyAvailable && (
                    <div className="text-[11px] text-rose-400 font-medium">
                      Faltan: {ing.missing} (Coste: {ing.missingCost.toLocaleString()} K)
                    </div>
                  )}
                </div>

                <div className="shrink-0">
                  {ing.isFullyAvailable ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                      Listo
                    </span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                      Comprar
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
