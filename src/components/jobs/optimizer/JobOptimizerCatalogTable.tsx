import React from 'react';
import { Search } from 'lucide-react';
import { CatalogRecipeItem } from './types';
import {
  CraftableItem,
  getItemIconUrl,
  getItemFallbackIconUrl,
} from '../../../services/dofusDbService';
import { DofusRecipe } from '../../../types';

interface JobOptimizerCatalogTableProps {
  filteredRecipes: CatalogRecipeItem[];
  recipeCategoryFilter: 'all' | 'consumables' | 'equipment';
  setRecipeCategoryFilter: (filter: 'all' | 'consumables' | 'equipment') => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  actualLevel: number;
  nextMilestone: number;
  onAddOne: (recipe: DofusRecipe, item: CraftableItem) => void;
  onAddUntilLevel: (recipe: DofusRecipe, item: CraftableItem, targetLvl: number) => void;
}

export const JobOptimizerCatalogTable: React.FC<JobOptimizerCatalogTableProps> = ({
  filteredRecipes,
  recipeCategoryFilter,
  setRecipeCategoryFilter,
  searchQuery,
  setSearchQuery,
  actualLevel,
  nextMilestone,
  onAddOne,
  onAddUntilLevel,
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm space-y-3 p-4">
      {/* Encabezado del catálogo y buscador */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="text-emerald-400">Recipes</span> ({filteredRecipes.length})
          </h2>

          {/* Filtros de categoría */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setRecipeCategoryFilter('all')}
              className={`px-2.5 py-1 rounded font-medium transition ${
                recipeCategoryFilter === 'all'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setRecipeCategoryFilter('consumables')}
              className={`px-2.5 py-1 rounded font-medium transition ${
                recipeCategoryFilter === 'consumables'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Consumibles/Componentes
            </button>
            <button
              onClick={() => setRecipeCategoryFilter('equipment')}
              className={`px-2.5 py-1 rounded font-medium transition ${
                recipeCategoryFilter === 'equipment'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Equipables
            </button>
          </div>
        </div>

        {/* Buscador de recetas */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Tabla de Recetas */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400">
              <th className="py-2.5 font-medium">Item</th>
              <th className="py-2.5 font-medium text-center">Level</th>
              <th className="py-2.5 font-medium text-center">XP</th>
              <th className="py-2.5 font-medium">Ingredients</th>
              <th className="py-2.5 font-medium text-right">Coste</th>
              <th className="py-2.5 font-medium text-right">Balance</th>
              <th className="py-2.5 font-medium text-center">Ventas</th>
              <th className="py-2.5 font-medium text-right pr-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {filteredRecipes.slice(0, 100).map((r) => {
              const canCraftForLevel =
                actualLevel >= r.level && actualLevel <= r.level + 100;

              return (
                <tr
                  key={r.item.id}
                  className={`hover:bg-slate-850/50 transition ${
                    !canCraftForLevel ? 'opacity-35' : ''
                  }`}
                >
                  {/* Item */}
                  <td className="py-2.5 font-sans">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={getItemIconUrl({ id: r.item.id, iconId: r.item.iconId })}
                        alt={r.name}
                        className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-800 object-contain p-0.5 shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = getItemFallbackIconUrl(r.item);
                        }}
                      />
                      <div>
                        <div className="font-semibold text-slate-200">{r.name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-slate-500 font-mono">
                            #{r.item.id}
                          </span>
                          {r.sebuscalinesEarned > 0 && (
                            <span
                              className="px-1.5 py-0.2 rounded bg-amber-500/15 border border-amber-500/30 text-[9px] text-amber-300 font-mono"
                              title={`Genera +${r.sebuscalinesEarned} Sebuscalines (+${r.sebuscalinesValue.toLocaleString()} k de retorno por unidad)`}
                            >
                              🪙 +{r.sebuscalinesEarned} Sebus
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Level */}
                  <td className="py-2.5 text-center text-slate-300 font-bold">{r.level}</td>

                  {/* XP otorgada en tu nivel actual */}
                  <td className="py-2.5 text-center text-sky-400 font-bold">
                    {r.xpAtCurrent > 0 ? r.xpAtCurrent.toLocaleString() : '0'}
                  </td>

                  {/* Ingredients (miniaturas con cantidades por craft) */}
                  <td className="py-2.5 font-sans">
                    <div className="flex flex-wrap items-center gap-1 max-w-sm">
                      {r.recipe.ingredientIds?.map((ingId, idx) => {
                        const qty = r.recipe.quantities?.[idx] || 1;
                        return (
                          <div
                            key={ingId}
                            className="relative group shrink-0"
                            title={`Ingrediente #${ingId} x${qty}`}
                          >
                            <img
                              src={getItemIconUrl(ingId)}
                              alt={`Ing #${ingId}`}
                              className="w-7 h-7 rounded bg-slate-950 border border-slate-800 object-contain p-0.5"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = getItemFallbackIconUrl({
                                  id: ingId,
                                });
                              }}
                            />
                            <span className="absolute -top-1 -right-1 px-1 bg-black/80 text-[8px] font-bold text-amber-300 rounded font-mono shadow">
                              {qty}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </td>

                  {/* Coste */}
                  <td className="py-2.5 text-right text-slate-300">
                    {r.craftCost.toLocaleString()} k
                  </td>

                  {/* Balance */}
                  <td
                    className={`py-2.5 text-right font-semibold ${
                      r.profit >= 0 ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    <div>
                      {r.profit >= 0 ? '+' : ''}
                      {r.profit.toLocaleString()} k
                    </div>
                    {r.sebuscalinesEarned > 0 && (
                      <div
                        className="text-[9px] font-normal text-amber-400/90 font-mono"
                        title="HDV + Sebuscalines"
                      >
                        (HDV: +{r.netSale.toLocaleString()} k | ByC: +
                        {r.sebuscalinesValue.toLocaleString()} k)
                      </div>
                    )}
                  </td>

                  {/* Ventas diarias */}
                  <td className="py-2.5 text-center font-sans">
                    {r.avgDailySales > 0 ? (
                      <span className="text-slate-300 font-mono text-[11px]">
                        {r.avgDailySales.toFixed(1)}/d
                      </span>
                    ) : (
                      <span className="text-slate-600 text-[10px]">Sin ventas</span>
                    )}
                  </td>

                  {/* Botones de acción verdes (igual que DofusDB) */}
                  <td className="py-2.5 text-right pr-2 font-sans">
                    <div className="inline-flex items-center gap-1.5">
                      {/* Botón +1 */}
                      <button
                        disabled={!canCraftForLevel}
                        onClick={() => onAddOne(r.recipe, r.item)}
                        className={`px-2.5 py-1 rounded text-white text-xs font-bold shadow transition ${
                          canCraftForLevel
                            ? 'bg-lime-600 hover:bg-lime-500 cursor-pointer'
                            : 'bg-slate-700 text-slate-400 cursor-not-allowed opacity-50'
                        }`}
                        title={
                          canCraftForLevel
                            ? 'Añadir 1 crafteo'
                            : `Nivel de oficio insuficiente (Requiere Nivel ${r.level})`
                        }
                      >
                        +1
                      </button>

                      {/* Botón -> Siguiente Hito (ej. ->190) */}
                      {actualLevel < nextMilestone &&
                        canCraftForLevel &&
                        r.xpAtCurrent > 0 && (
                          <button
                            onClick={() =>
                              onAddUntilLevel(r.recipe, r.item, nextMilestone)
                            }
                            className="px-2.5 py-1 rounded bg-lime-600 hover:bg-lime-500 text-white text-xs font-bold shadow transition"
                            title={`Añadir crafteos hasta el nivel ${nextMilestone}`}
                          >
                            -&gt;{nextMilestone}
                          </button>
                        )}

                      {/* Botón -> 200 */}
                      {actualLevel < 200 &&
                        canCraftForLevel &&
                        r.xpAtCurrent > 0 && (
                          <button
                            onClick={() => onAddUntilLevel(r.recipe, r.item, 200)}
                            className="px-2.5 py-1 rounded bg-lime-600 hover:bg-lime-500 text-white text-xs font-bold shadow transition"
                            title="Añadir crafteos hasta el nivel 200"
                          >
                            -&gt;200
                          </button>
                        )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
