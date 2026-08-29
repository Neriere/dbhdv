import React, { useMemo } from 'react';
import { Layers, Save, Check, AlertCircle, TrendingUp, Sparkles, Map as MapIcon, Award } from 'lucide-react';
import { SafeImage } from '../SafeImage';
import { getItemIconUrl, getItemFallbackIconUrl } from '../../services/dofusDbService';
import { KamaDisplay } from '../common/KamaDisplay';
import { BycResourceCostAnalysis } from '../../services/bycCostService';

export interface RecipeIngredientDetail {
  id: number;
  name: string;
  iconId: number;
  quantity: number;
  unitPrice: number;
  marketBuyPrice: number;
  subCraftCost: number;
  isCraftable: boolean;
  isCraftCheaper: boolean;
  totalCost: number;
  // ByC Legendary Hunt Acquisition Info
  isByc?: boolean;
  bycAnalysis?: BycResourceCostAnalysis;
  selectedBycMethod?: 'direct' | 'fragments' | 'map';
}

interface RecipeSidebarProps {
  recipeIngredients: RecipeIngredientDetail[];
  totalCraftCost: number;
  ingredientDrafts: Record<number, string>;
  savedIngFeedback: number | null;
  onDraftChange: (ingredientId: number, value: string) => void;
  onSavePrice: (ingredientId: number, value: string) => void;
  onSelectBycMethod?: (ingredientId: number, method: 'direct' | 'fragments' | 'map') => void;
}

export const RecipeSidebar: React.FC<RecipeSidebarProps> = ({
  recipeIngredients,
  totalCraftCost,
  ingredientDrafts,
  savedIngFeedback,
  onDraftChange,
  onSavePrice,
  onSelectBycMethod,
}) => {
  // Find the bottleneck ingredient (the one that represents the highest percentage of total cost)
  const { bottleneckId, highestShare } = useMemo(() => {
    if (recipeIngredients.length === 0 || totalCraftCost <= 0) {
      return { bottleneckId: null, highestShare: 0 };
    }
    let maxCost = 0;
    let maxId: number | null = null;
    recipeIngredients.forEach((ing) => {
      if (ing.totalCost > maxCost) {
        maxCost = ing.totalCost;
        maxId = ing.id;
      }
    });
    const share = totalCraftCost > 0 ? (maxCost / totalCraftCost) * 100 : 0;
    return {
      bottleneckId: share >= 35 && recipeIngredients.length > 1 ? maxId : null,
      highestShare: Math.round(share),
    };
  }, [recipeIngredients, totalCraftCost]);

  const unpricedCount = recipeIngredients.filter((i) => i.unitPrice <= 0).length;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3.5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Layers className="w-5 h-5 text-amber-400" />
          <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-white">
            Receta ({recipeIngredients.length})
          </h3>
          {unpricedCount > 0 && (
            <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
              {unpricedCount} sin precio
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <KamaDisplay
            amount={totalCraftCost}
            variant="amber"
            size="sm"
            className="bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg text-sm font-black"
          />
        </div>
      </div>

      {/* Ingredients List */}
      {recipeIngredients.length > 0 ? (
        <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
          {recipeIngredients.map((ing) => {
            const draftVal = ingredientDrafts[ing.id] ?? String(ing.unitPrice);
            const isSaved = savedIngFeedback === ing.id;
            const costPercent = totalCraftCost > 0 ? Math.round((ing.totalCost / totalCraftCost) * 100) : 0;
            const isBottleneck = ing.id === bottleneckId;

            return (
              <div
                key={ing.id}
                className={`bg-slate-950/80 border rounded-xl p-2.5 sm:p-3 flex flex-col gap-2 transition-all ${
                  isBottleneck
                    ? 'border-amber-500/40 bg-amber-950/15 hover:border-amber-500/60'
                    : 'border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2.5 sm:gap-3">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 p-1 shrink-0 flex items-center justify-center relative shadow-inner">
                      <SafeImage
                        src={getItemIconUrl(ing)}
                        fallbackSrc={getItemFallbackIconUrl(ing)}
                        alt={ing.name}
                        className="w-8 h-8 object-contain"
                      />
                      {isBottleneck && (
                        <span
                          title={`Cuello de botella (${costPercent}% del costo total)`}
                          className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-400 border-2 border-slate-950"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs sm:text-sm font-bold text-slate-100 truncate leading-snug" title={ing.name}>
                          {ing.name}
                        </p>
                        {isBottleneck && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                            {costPercent}%
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-mono font-bold mt-0.5 whitespace-nowrap">
                        <span className="text-slate-300">x{ing.quantity}</span>
                        <span className="text-slate-600">•</span>
                        {ing.unitPrice > 0 ? (
                          <span className="text-amber-400 font-black">{ing.totalCost.toLocaleString('de-DE')} K</span>
                        ) : (
                          <span className="text-amber-400/80 font-semibold text-[11px]">0 K (sin precio)</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Price input */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        value={draftVal}
                        onChange={(e) => onDraftChange(ing.id, e.target.value)}
                        onBlur={() => onSavePrice(ing.id, draftVal)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            onSavePrice(ing.id, draftVal);
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                        className="w-20 sm:w-24 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-right font-mono text-xs sm:text-sm font-bold text-slate-100 focus:outline-none focus:border-amber-500 pr-5"
                      />
                      <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                        K
                      </span>
                    </div>

                    <button
                      onClick={() => onSavePrice(ing.id, draftVal)}
                      title="Guardar precio de este ingrediente"
                      className={`p-1.5 rounded-lg text-xs transition-all ${
                        isSaved
                          ? 'bg-emerald-500 text-slate-950 font-bold animate-pulse'
                          : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                      }`}
                    >
                      {isSaved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* ByC Legendary Hunt Acquisition Method Selector */}
                {ing.isByc && ing.bycAnalysis && (
                  <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-amber-400 font-bold flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        Obtención ByC ({ing.bycAnalysis.hunt.monsterName}):
                      </span>
                      {ing.bycAnalysis.savingsVsDirect > 0 && ing.selectedBycMethod !== 'direct' && (
                        <span className="text-emerald-400 font-bold font-mono text-[10px]">
                          -{(ing.bycAnalysis.savingsVsDirect * ing.quantity).toLocaleString('de-DE')} K
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-1 text-[10px]">
                      {/* Option 1: Direct HDV */}
                      <button
                        type="button"
                        onClick={() => onSelectBycMethod && onSelectBycMethod(ing.id, 'direct')}
                        className={`p-1.5 rounded-lg border text-center transition flex flex-col items-center justify-center ${
                          (ing.selectedBycMethod || 'direct') === 'direct'
                            ? 'bg-amber-500/20 border-amber-500/60 text-amber-200 font-bold'
                            : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-1">
                          <Award className="w-2.5 h-2.5" />
                          <span>HDV Recurso</span>
                        </div>
                        <span className="font-mono text-[9px] mt-0.5 font-bold">
                          {ing.bycAnalysis.directPrice > 0 ? `${ing.bycAnalysis.directPrice.toLocaleString('de-DE')} K` : '—'}
                        </span>
                      </button>

                      {/* Option 2: Fragments */}
                      <button
                        type="button"
                        onClick={() => onSelectBycMethod && onSelectBycMethod(ing.id, 'fragments')}
                        className={`p-1.5 rounded-lg border text-center transition flex flex-col items-center justify-center ${
                          ing.selectedBycMethod === 'fragments'
                            ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-200 font-bold'
                            : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                        } ${ing.bycAnalysis.bestMethod === 'fragments' ? 'ring-1 ring-emerald-400/40' : ''}`}
                      >
                        <div className="flex items-center gap-1">
                          <Layers className="w-2.5 h-2.5 text-indigo-400" />
                          <span>Fragmentos</span>
                        </div>
                        <span className="font-mono text-[9px] mt-0.5 font-bold">
                          {ing.bycAnalysis.fragmentsPrice > 0 ? `${ing.bycAnalysis.fragmentsPrice.toLocaleString('de-DE')} K` : '—'}
                        </span>
                      </button>

                      {/* Option 3: Whole Map */}
                      <button
                        type="button"
                        onClick={() => onSelectBycMethod && onSelectBycMethod(ing.id, 'map')}
                        className={`p-1.5 rounded-lg border text-center transition flex flex-col items-center justify-center ${
                          ing.selectedBycMethod === 'map'
                            ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-200 font-bold'
                            : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                        } ${ing.bycAnalysis.bestMethod === 'map' ? 'ring-1 ring-emerald-400/40' : ''}`}
                      >
                        <div className="flex items-center gap-1">
                          <MapIcon className="w-2.5 h-2.5 text-amber-400" />
                          <span>Mapa Entero</span>
                        </div>
                        <span className="font-mono text-[9px] mt-0.5 font-bold">
                          {ing.bycAnalysis.mapPrice > 0 ? `${ing.bycAnalysis.mapPrice.toLocaleString('de-DE')} K` : '—'}
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Sub-craft cheaper indicator */}
                {ing.isCraftable && ing.isCraftCheaper && (
                  <div className="text-xs text-emerald-400 font-bold flex items-center gap-1 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">
                    <TrendingUp className="w-3.5 h-3.5 shrink-0" />
                    <span>Más barato craftearlo ({ing.subCraftCost.toLocaleString('de-DE')} K)</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-6 text-slate-400 text-sm font-medium">
          No hay ingredientes registrados para este objeto.
        </div>
      )}
    </div>
  );
};
