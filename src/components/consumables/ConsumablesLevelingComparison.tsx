import React from 'react';
import { Shield } from 'lucide-react';
import { StatFilter, StatProgressionAnalysis } from './types';

interface ConsumablesLevelingComparisonProps {
  statToLevelUp: StatFilter;
  onSetStatToLevelUp: (stat: StatFilter) => void;
  statProgressionAnalysis: StatProgressionAnalysis | null;
}

export const ConsumablesLevelingComparison: React.FC<
  ConsumablesLevelingComparisonProps
> = ({ statToLevelUp, onSetStatToLevelUp, statProgressionAnalysis }) => {
  return (
    <div className="bg-slate-900/70 border border-slate-800/90 rounded-2xl p-5 shadow-lg space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-emerald-400" />
          <div>
            <h3 className="text-sm font-black text-slate-100">
              Comparador de Vías: Pergaminos vs Consumibles de Oficio (0 a 100)
            </h3>
            <p className="text-xs text-slate-400">
              Evalúa si te conviene subir la característica con comida/pociones de protectores o con pergaminos
            </p>
          </div>
        </div>

        {/* Selector de Stat a subir */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-semibold">
            Característica:
          </span>
          <select
            value={statToLevelUp}
            onChange={(e) => onSetStatToLevelUp(e.target.value as StatFilter)}
            className="bg-slate-950 border border-slate-700 text-xs font-bold text-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-emerald-500"
          >
            {(
              [
                'Fuerza',
                'Vitalidad',
                'Sabiduría',
                'Inteligencia',
                'Suerte',
                'Agilidad',
              ] as StatFilter[]
            ).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {statProgressionAnalysis && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 font-mono">
          {/* Tramo 0-25 */}
          <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-amber-400 font-sans">
                Tramo 0 a 25
              </span>
              <span className="text-[10px] text-slate-500">25 pts</span>
            </div>
            <div className="text-[11px] text-slate-300 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Perg. Pequeño:</span>
                <span className="font-bold">
                  {(
                    (statProgressionAnalysis.pPeq?.price || 0) * 25
                  ).toLocaleString()}{' '}
                  K
                </span>
              </div>
              {statProgressionAnalysis.bestConsumable0to25 && (
                <div className="flex justify-between text-emerald-400">
                  <span
                    className="truncate max-w-[110px]"
                    title={statProgressionAnalysis.bestConsumable0to25.name}
                  >
                    {statProgressionAnalysis.bestConsumable0to25.name}:
                  </span>
                  <span className="font-bold">
                    {(
                      statProgressionAnalysis.bestConsumable0to25.costPerPoint *
                      25
                    ).toLocaleString()}{' '}
                    K
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Tramo 25-50 */}
          <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-amber-400 font-sans">
                Tramo 25 a 50
              </span>
              <span className="text-[10px] text-slate-500">25 pts</span>
            </div>
            <div className="text-[11px] text-slate-300 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Perg. Mediano:</span>
                <span className="font-bold">
                  {(
                    (statProgressionAnalysis.pMed?.price || 0) * 25
                  ).toLocaleString()}{' '}
                  K
                </span>
              </div>
              {statProgressionAnalysis.bestConsumable25to50 && (
                <div className="flex justify-between text-emerald-400">
                  <span
                    className="truncate max-w-[110px]"
                    title={statProgressionAnalysis.bestConsumable25to50.name}
                  >
                    {statProgressionAnalysis.bestConsumable25to50.name}:
                  </span>
                  <span className="font-bold">
                    {(
                      statProgressionAnalysis.bestConsumable25to50.costPerPoint *
                      25
                    ).toLocaleString()}{' '}
                    K
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Tramo 50-80 */}
          <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-amber-400 font-sans">
                Tramo 50 a 80
              </span>
              <span className="text-[10px] text-slate-500">30 pts</span>
            </div>
            <div className="text-[11px] text-slate-300 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Perg. Grande:</span>
                <span className="font-bold">
                  {(
                    (statProgressionAnalysis.pGra?.price || 0) * 30
                  ).toLocaleString()}{' '}
                  K
                </span>
              </div>
              {statProgressionAnalysis.bestConsumable50to80 && (
                <div className="flex justify-between text-emerald-400">
                  <span
                    className="truncate max-w-[110px]"
                    title={statProgressionAnalysis.bestConsumable50to80.name}
                  >
                    {statProgressionAnalysis.bestConsumable50to80.name}:
                  </span>
                  <span className="font-bold">
                    {(
                      statProgressionAnalysis.bestConsumable50to80.costPerPoint *
                      30
                    ).toLocaleString()}{' '}
                    K
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Tramo 80-100 */}
          <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-amber-400 font-sans">
                Tramo 80 a 100
              </span>
              <span className="text-[10px] text-slate-500">20 pts</span>
            </div>
            <div className="text-[11px] text-slate-300 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Perg. Potente (x10):</span>
                <span className="font-bold">
                  {(
                    (statProgressionAnalysis.pPot?.price || 0) * 10
                  ).toLocaleString()}{' '}
                  K
                </span>
              </div>
              {statProgressionAnalysis.bestConsumable80to100 && (
                <div className="flex justify-between text-emerald-400">
                  <span
                    className="truncate max-w-[110px]"
                    title={statProgressionAnalysis.bestConsumable80to100.name}
                  >
                    {statProgressionAnalysis.bestConsumable80to100.name}:
                  </span>
                  <span className="font-bold">
                    {(
                      statProgressionAnalysis.bestConsumable80to100
                        .costPerPoint * 20
                    ).toLocaleString()}{' '}
                    K
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
