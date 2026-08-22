import React, { useMemo } from 'react';
import { Layers, Save, Check, AlertCircle, TrendingUp } from 'lucide-react';
import { SafeImage } from '../SafeImage';
import { getItemIconUrl, getItemFallbackIconUrl } from '../../services/dofusDbService';
import { KamaDisplay } from '../common/KamaDisplay';

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
}

interface RecipeSidebarProps {
  recipeIngredients: RecipeIngredientDetail[];
  totalCraftCost: number;
  ingredientDrafts: Record<number, string>;
  savedIngFeedback: number | null;
  onDraftChange: (ingredientId: number, value: string) => void;
  onSavePrice: (ingredientId: number, value: string) => void;
}

export const RecipeSidebar: React.FC<RecipeSidebarProps> = ({
  recipeIngredients,
  totalCraftCost,
  ingredientDrafts,
  savedIngFeedback,
  onDraftChange,
  onSavePrice,
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

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3.5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-amber-400" />
          <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-white">
            Receta ({recipeIngredients.length})
          </h3>
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
                className={`bg-slate-950/70 border rounded-xl p-2.5 flex flex-col gap-2 transition-all ${
                  isBottleneck
                    ? 'border-amber-500/40 bg-amber-950/10 hover:border-amber-500/60'
                    : 'border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-900 border border-slate-800 p-1 shrink-0 flex items-center justify-center relative">
                      <SafeImage
                        src={getItemIconUrl(ing)}
                        fallbackSrc={getItemFallbackIconUrl(ing)}
                        alt={ing.name}
                        className="w-7 h-7 sm:w-8 sm:h-8 object-contain"
                      />
                      {isBottleneck && (
                        <span
                          title={`Cuello de botella (${costPercent}% del costo total)`}
                          className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-400 border-2 border-slate-950"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 truncate">
                        <p className="text-sm font-bold text-slate-100 truncate leading-tight">
                          {ing.name}
                        </p>
                        {isBottleneck && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                            {costPercent}%
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs sm:text-sm font-mono text-amber-400 font-bold mt-0.5 whitespace-nowrap">
                        <span>x{ing.quantity}</span>
                        <span className="text-slate-500">•</span>
                        <span>{ing.totalCost.toLocaleString('de-DE')} K</span>
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
                        className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-right font-mono text-sm font-bold text-slate-100 focus:outline-none focus:border-amber-500 pr-5"
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
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {isSaved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

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
