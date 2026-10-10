import React from 'react';
import { Briefcase, Sparkles } from 'lucide-react';
import { getItemIconUrl } from '../../services/dofusDbService';
import { ProcessedConsumableItem, getStatBadgeClass } from './types';

interface ConsumablesTableViewProps {
  filteredConsumables: ProcessedConsumableItem[];
  isUserJobsEnabled: boolean;
}

export const ConsumablesTableView: React.FC<ConsumablesTableViewProps> = ({
  filteredConsumables,
  isUserJobsEnabled,
}) => {
  return (
    <div className="space-y-4">
      {isUserJobsEnabled && (
        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs font-medium">
          <Briefcase className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            Filtro activo: Mostrando únicamente consumibles que tus oficios pueden recolectar y preparar.
          </span>
        </div>
      )}

      {/* Listado de los 83 Consumibles Verificados */}
      <div className="bg-slate-900/70 border border-slate-800/90 rounded-2xl overflow-hidden shadow-lg">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-slate-200">
              Consumibles de Recolección con Recursos Raros de Protectores
            </h2>
            <span className="text-xs text-slate-500 font-mono">
              ({filteredConsumables.length} consumibles encontrados)
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Consumible</th>
                <th className="py-3 px-3">Oficio</th>
                <th className="py-3 px-3 text-center">Stat & Límite</th>
                <th className="py-3 px-4">Ingredientes de la Receta</th>
                <th className="py-3 px-3 text-right">Coste Crafteo</th>
                <th className="py-3 px-3 text-right">Precio Mercado</th>
                <th className="py-3 px-3 text-right font-bold text-emerald-400">
                  Coste / Punto
                </th>
                <th className="py-3 px-4 text-center">vs Pergamino Tramo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredConsumables.map((consumable) => {
                return (
                  <tr
                    key={consumable.id}
                    className="hover:bg-slate-800/40 transition-colors"
                  >
                    {/* Consumible */}
                    <td className="py-3 px-4 flex items-center gap-3">
                      <img
                        src={getItemIconUrl(consumable.iconId)}
                        alt={consumable.name}
                        className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-800 object-contain"
                      />
                      <div>
                        <div className="font-bold text-slate-200 text-xs">
                          {consumable.name}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          Nivel {consumable.level} • ID: {consumable.id}
                        </div>
                      </div>
                    </td>

                    {/* Oficio */}
                    <td className="py-3 px-3 font-semibold text-slate-300">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px]">
                        {consumable.job}
                      </span>
                    </td>

                    {/* Stat & Límite */}
                    <td className="py-3 px-3 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold border ${getStatBadgeClass(
                            consumable.stat
                          )}`}
                        >
                          +{consumable.points} {consumable.stat}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono font-medium">
                          {consumable.criterions
                            ? consumable.criterions.toUpperCase()
                            : `Hasta ${consumable.maxStatLimit}`}
                        </span>
                      </div>
                    </td>

                    {/* Ingredientes de la Receta */}
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1.5 max-w-[340px]">
                        {consumable.ingredientsWithPrice.map((ing, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-300"
                            title={`${ing.name} (x${ing.quantity}) - Coste unitario: ${ing.unitPrice.toLocaleString()} K`}
                          >
                            <span className="font-bold text-amber-400">
                              {ing.quantity}x
                            </span>
                            <span className="truncate max-w-[110px]">
                              {ing.name}
                            </span>
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Coste Crafteo */}
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-300">
                      {consumable.craftCost > 0 ? (
                        `${consumable.craftCost.toLocaleString()} K`
                      ) : (
                        <span className="text-slate-600 font-normal">--</span>
                      )}
                    </td>

                    {/* Precio Mercado */}
                    <td className="py-3 px-3 text-right font-mono text-slate-400">
                      {consumable.marketPrice > 0 ? (
                        `${consumable.marketPrice.toLocaleString()} K`
                      ) : (
                        <span className="text-slate-600">--</span>
                      )}
                    </td>

                    {/* Coste por Punto */}
                    <td className="py-3 px-3 text-right font-mono font-black text-sm text-emerald-400">
                      {consumable.costPerPoint > 0 ? (
                        `${consumable.costPerPoint.toLocaleString()} K`
                      ) : (
                        <span className="text-slate-600">--</span>
                      )}
                    </td>

                    {/* Comparativa vs Pergamino */}
                    <td className="py-3 px-4 text-center font-mono text-xs">
                      {consumable.equivScrollCostPerPoint > 0 &&
                      consumable.costPerPoint > 0 ? (
                        consumable.savingsVsScrollPct > 0 ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
                            Ahorras {consumable.savingsVsScrollPct}%
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                            +{Math.abs(consumable.savingsVsScrollPct)}% vs perg.
                          </span>
                        )
                      ) : (
                        <span className="text-slate-600">--</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
