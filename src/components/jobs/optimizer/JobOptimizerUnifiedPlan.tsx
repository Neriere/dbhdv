import React from 'react';
import { Trash2 } from 'lucide-react';
import { SelectedCraftEntry } from '../../../services/jobLevelingService';
import {
  getItemIconUrl,
  getItemFallbackIconUrl,
} from '../../../services/dofusDbService';

interface JobOptimizerUnifiedPlanProps {
  updatedSelectedCrafts: SelectedCraftEntry[];
  actualLevel: number;
  handleQuantityChange: (itemId: number, amount: number, destination?: 'sell' | 'crush') => void;
  handleRemoveCraft: (itemId: number, destination?: 'sell' | 'crush') => void;
}

export const JobOptimizerUnifiedPlan: React.FC<JobOptimizerUnifiedPlanProps> = ({
  updatedSelectedCrafts,
  actualLevel,
  handleQuantityChange,
  handleRemoveCraft,
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/50">
              <th className="py-3 px-4 font-medium">Item</th>
              <th className="py-3 px-3 font-medium text-center">Level</th>
              <th className="py-3 px-3 font-medium text-center">Quantity</th>
              <th className="py-3 px-3 font-medium text-right">XP earned</th>
              <th className="py-3 px-4 font-medium">Ingredients</th>
              <th className="py-3 px-3 font-medium text-right">Inversión</th>
              <th className="py-3 px-3 font-medium text-right">Balance</th>
              <th className="py-3 px-3 font-medium text-center">Fase</th>
              <th className="py-3 px-3 font-medium text-center"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {updatedSelectedCrafts.map((c) => {
              const resolvedName =
                typeof c.item.name === 'object'
                  ? c.item.name?.es || ''
                  : String(c.item.name || `Objeto #${c.item.id}`);

              return (
                <tr
                  key={`${c.phaseIndex || 1}-${c.item.id}-${c.destination || 'sell'}`}
                  className="hover:bg-slate-850/50 transition"
                >
                  <td className="py-3 px-4 font-sans">
                    <div className="flex items-center gap-3">
                      <div className="relative shrink-0">
                        <img
                          src={getItemIconUrl({ id: c.item.id, iconId: c.item.iconId })}
                          alt={resolvedName}
                          className="w-10 h-10 rounded-lg bg-slate-950 border border-slate-800 object-contain p-0.5"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = getItemFallbackIconUrl(c.item);
                          }}
                        />
                        <span className="absolute -top-1.5 -left-1.5 px-1.5 py-0.2 bg-slate-900/90 border border-slate-700 text-white font-bold text-[10px] rounded font-mono shadow">
                          {c.amount}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-white text-sm">
                            {resolvedName}
                          </span>
                          {c.destination === 'crush' ? (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/40 text-[9px] text-purple-300 font-mono font-bold"
                              title="Romper en la Rompedora para obtener runas (límite máx. 3x para proteger el coeficiente del servidor)"
                            >
                              ♻️ Romper (Runas, máx 3x)
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-sky-500/20 border border-sky-500/40 text-[9px] text-sky-300 font-mono font-medium"
                              title="Vender en el Mercadillo (HDV)"
                            >
                              🛒 Venta HDV
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-slate-500 font-mono">
                            ID #{c.item.id}
                          </span>
                          {c.totalSebuscalines > 0 && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-amber-500/15 border border-amber-500/30 text-[10px] text-amber-300 font-mono font-medium"
                              title={`Cofre de cacería: +${c.sebuscalinesPerCraft} Sebuscalines por craft (+${c.totalSebuscalinesValue.toLocaleString()} k de retorno total)`}
                            >
                              🪙 +{c.totalSebuscalines.toLocaleString()} Sebus (+{c.totalSebuscalinesValue.toLocaleString()} k)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="py-3 px-3 text-center text-slate-300 font-bold">
                    {c.item.level}
                  </td>

                  <td className="py-3 px-3 text-center font-sans">
                    <input
                      type="number"
                      min={1}
                      value={c.amount}
                      onChange={(e) =>
                        handleQuantityChange(c.item.id, Number(e.target.value) || 1, c.destination)
                      }
                      className="w-16 text-center bg-slate-950 border border-slate-700 rounded py-1 px-1.5 text-xs font-bold text-white focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </td>

                  <td className="py-3 px-3 text-right font-bold font-mono">
                    {c.isLevelInsufficient ||
                    (c.levelAtCraft !== undefined && c.levelAtCraft < c.item.level) ? (
                      <span
                        className="text-amber-400 font-bold text-[11px] bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded inline-flex items-center gap-1"
                        title={`No puedes craftear este objeto: tu nivel en este paso (${c.levelAtCraft ?? actualLevel}) es menor que el nivel requerido (${c.item.level})`}
                      >
                        ⚠️ 0 XP (Req. Nv. {c.item.level})
                      </span>
                    ) : c.xpGained <= 0 ? (
                      <span className="text-rose-400 font-bold text-[11px] bg-rose-500/10 border border-rose-500/30 px-1.5 py-0.5 rounded">
                        0 XP (Misión)
                      </span>
                    ) : (
                      <span className="text-sky-400">+{c.xpGained.toLocaleString()}</span>
                    )}
                  </td>

                  <td className="py-3 px-4 font-sans">
                    <div className="flex flex-wrap items-center gap-1.5 max-w-sm">
                      {c.recipe?.ingredientIds?.map((ingId, idx) => {
                        const qty = (c.recipe?.quantities?.[idx] || 1) * c.amount;
                        return (
                          <div
                            key={ingId}
                            className="relative group shrink-0"
                            title={`Ingrediente #${ingId} x${qty}`}
                          >
                            <img
                              src={getItemIconUrl(ingId)}
                              alt={`Ing #${ingId}`}
                              className="w-8 h-8 rounded bg-slate-950 border border-slate-800 object-contain p-0.5"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = getItemFallbackIconUrl({ id: ingId });
                              }}
                            />
                            <span className="absolute -top-1 -right-1 px-1 bg-black/85 text-[9px] font-bold text-amber-300 rounded font-mono shadow">
                              {qty}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </td>

                  <td className="py-3 px-3 text-right text-slate-300">
                    {c.totalCraftCost.toLocaleString()} k
                  </td>

                  <td
                    className={`py-3 px-3 text-right font-semibold ${
                      c.totalProfit >= 0 ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    <div>
                      {c.totalProfit >= 0 ? '+' : ''}
                      {c.totalProfit.toLocaleString()} k
                    </div>
                    {c.destination === 'crush' && (c.totalRunesEstimate || 0) > 0 && (
                      <div
                        className="text-[9px] font-normal text-purple-300 font-mono"
                        title="Estimación de valor en runas al romper"
                      >
                        (Runas: +{(c.totalRunesEstimate || 0).toLocaleString()} k
                        {c.totalSebuscalines > 0
                          ? ` | ByC: +${c.totalSebuscalinesValue.toLocaleString()} k`
                          : ''}
                        )
                      </div>
                    )}
                    {c.destination !== 'crush' && c.totalSebuscalines > 0 && (
                      <div
                        className="text-[9px] font-normal text-amber-400/90 font-mono"
                        title="Desglose: HDV + Sebuscalines"
                      >
                        (HDV: +{c.totalNetSale.toLocaleString()} k | ByC: +
                        {c.totalSebuscalinesValue.toLocaleString()} k)
                      </div>
                    )}
                  </td>

                  <td className="py-3 px-3 text-center">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-300 text-[10px] font-bold font-mono">
                      Fase {c.phaseIndex || 1}
                    </span>
                  </td>

                  <td className="py-3 px-3 text-center">
                    <button
                      onClick={() => handleRemoveCraft(c.item.id, c.destination)}
                      className="p-1 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded transition"
                      title="Eliminar este crafteo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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
