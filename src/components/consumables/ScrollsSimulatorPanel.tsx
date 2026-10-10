import React from 'react';
import { Zap, ChevronUp, ChevronDown } from 'lucide-react';
import { getItemIconUrl } from '../../services/dofusDbService';
import { SimulationResult, getStatBadgeClass } from './types';

interface ScrollsSimulatorPanelProps {
  isSimulatorOpen: boolean;
  onToggleSimulator: () => void;
  availableSebuscalines: number;
  onChangeAvailableSebuscalines: (seb: number) => void;
  simulationMode: 'diversified' | 'max_profit';
  onChangeSimulationMode: (mode: 'diversified' | 'max_profit') => void;
  simulationResults: SimulationResult | null;
}

export const ScrollsSimulatorPanel: React.FC<ScrollsSimulatorPanelProps> = ({
  isSimulatorOpen,
  onToggleSimulator,
  availableSebuscalines,
  onChangeAvailableSebuscalines,
  simulationMode,
  onChangeSimulationMode,
  simulationResults,
}) => {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
      <button
        onClick={onToggleSimulator}
        className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-slate-800/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-200 flex items-center gap-2">
              Simulador de Canje Inteligente por Sebuscalines
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Opcional
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Reparte una bolsa de sebuscalines sin saturar el mercadillo ni desplomar los precios
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <span className="text-xs font-semibold">
            {isSimulatorOpen ? 'Ocultar simulador' : 'Abrir simulador'}
          </span>
          {isSimulatorOpen ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </div>
      </button>

      {isSimulatorOpen && (
        <div className="p-5 border-t border-slate-800 bg-slate-950/60 space-y-4 animate-fadeIn">
          <div className="flex flex-wrap items-center gap-4 bg-slate-900/80 p-3.5 rounded-xl border border-slate-800">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs font-bold text-slate-300 block mb-1">
                Sebuscalines disponibles a canjear:
              </label>
              <div className="relative">
                <input
                  type="number"
                  step={20}
                  min={20}
                  value={availableSebuscalines}
                  onChange={(e) =>
                    onChangeAvailableSebuscalines(
                      Math.max(0, parseInt(e.target.value, 10) || 0)
                    )
                  }
                  className="w-full pl-3 pr-24 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm font-mono font-bold text-amber-400 focus:outline-none focus:border-amber-500"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">
                  Sebuscalines
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-300 block mb-1">
                Estrategia:
              </span>
              <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800">
                <button
                  onClick={() => onChangeSimulationMode('diversified')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                    simulationMode === 'diversified'
                      ? 'bg-emerald-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  🛡️ Diversificado (Antidevaluación)
                </button>
                <button
                  onClick={() => onChangeSimulationMode('max_profit')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                    simulationMode === 'max_profit'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  ⚡ Máxima Rentabilidad Pura
                </button>
              </div>
            </div>
          </div>

          {simulationResults && simulationResults.plan.length > 0 ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                  <div className="text-xs text-slate-400">
                    Total Kamas Estimadas:
                  </div>
                  <div className="text-xl font-black text-emerald-400 font-mono mt-0.5">
                    {simulationResults.totalKamas.toLocaleString()} K
                  </div>
                </div>
                <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                  <div className="text-xs text-slate-400">
                    Sebuscalines Utilizados:
                  </div>
                  <div className="text-xl font-black text-amber-400 font-mono mt-0.5">
                    {simulationResults.spentSeb.toLocaleString()} /{' '}
                    {availableSebuscalines.toLocaleString()}
                  </div>
                </div>
                <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                  <div className="text-xs text-slate-400">
                    Rendimiento Promedio Canje:
                  </div>
                  <div className="text-xl font-black text-purple-400 font-mono mt-0.5">
                    {simulationResults.globalRatio.toLocaleString()} K / Seb
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800 font-semibold uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Ítem Recomendado</th>
                      <th className="py-2.5 px-3 text-center">Unidades</th>
                      <th className="py-2.5 px-3 text-right">Coste Seb.</th>
                      <th className="py-2.5 px-3 text-right">Precio Ud.</th>
                      <th className="py-2.5 px-3 text-right">Ratio K/Seb</th>
                      <th className="py-2.5 px-3 text-right font-bold text-emerald-400">
                        Kamas Estimadas
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {simulationResults.plan.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/30">
                        <td className="py-2.5 px-3 font-sans flex items-center gap-2 text-slate-200">
                          <img
                            src={getItemIconUrl(item.scroll.iconId)}
                            alt={item.scroll.name}
                            className="w-6 h-6 object-contain"
                          />
                          <span className="font-semibold">{item.scroll.name}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded border ${getStatBadgeClass(
                              item.scroll.stat
                            )}`}
                          >
                            {item.scroll.stat}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-amber-300">
                          {item.count}x
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-300">
                          {item.costSeb.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-300">
                          {item.scroll.price.toLocaleString()} K
                        </td>
                        <td className="py-2.5 px-3 text-right text-purple-300 font-bold">
                          {item.scroll.ratio.toLocaleString()} K/s
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-400">
                          {item.estKamas.toLocaleString()} K
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-slate-500 text-xs">
              Ingresa una cantidad de sebuscalines para ver la distribución recomendada.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
