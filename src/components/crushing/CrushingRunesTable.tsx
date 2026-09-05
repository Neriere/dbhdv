import React, { useMemo } from 'react';
import { Sparkles, Check, Crown, Flame } from 'lucide-react';
import { BaseRuneDefinition, StatRuneYield, TopFocusOption } from '../../data/dofusRuneWeights';
import { RuneIcon } from '../RuneIcon';
import { KamaDisplay } from '../common/KamaDisplay';

interface CrushingRunesTableProps {
  statYields: StatRuneYield[];
  top3FocusOptions: TopFocusOption[];
  normalTotalKamasValue: number;
  normalNetProfit: number;
  bestFocusOption: TopFocusOption | undefined;
  totalCraftCost: number;
  breakEvenCoefficient: number;
  runePriceDrafts: Record<number, string>;
  savedRuneIdFeedback: number | null;
  focusedRuneId: number | null;
  onStatChange: (runeId: number, value: string) => void;
  onPriceDraftChange: (runeId: number, value: string) => void;
  onSaveRunePrice: (runeId: number, value: string) => void;
  onToggleFocus: (runeId: number) => void;
}

export const CrushingRunesTable: React.FC<CrushingRunesTableProps> = ({
  statYields,
  top3FocusOptions,
  normalTotalKamasValue,
  normalNetProfit,
  bestFocusOption,
  totalCraftCost,
  breakEvenCoefficient,
  runePriceDrafts,
  savedRuneIdFeedback,
  focusedRuneId,
  onStatChange,
  onPriceDraftChange,
  onSaveRunePrice,
  onToggleFocus,
}) => {
  // Identify the star rune (the one that contributes > 40% of the total Kamas value)
  const { starRuneId, starRunePercent } = useMemo(() => {
    if (statYields.length === 0 || normalTotalKamasValue <= 0) {
      return { starRuneId: null, starRunePercent: 0 };
    }
    let maxVal = 0;
    let maxId: number | null = null;
    statYields.forEach((y) => {
      const val = Math.max(y.normalKamasValue, y.focusKamasValue);
      if (val > maxVal) {
        maxVal = val;
        maxId = y.rune.id;
      }
    });
    const share = normalTotalKamasValue > 0 ? (maxVal / normalTotalKamasValue) * 100 : 0;
    return {
      starRuneId: share >= 35 ? maxId : null,
      starRunePercent: Math.round(share),
    };
  }, [statYields, normalTotalKamasValue]);

  const normalTopRank = top3FocusOptions.find((s) => s.isNormal)?.rank;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3.5">
      {/* Table Title Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-400" />
          <h3 className="text-base sm:text-lg font-black text-white">
            Runas Obtenidas y Focos
          </h3>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-300 font-medium">
          <span>
            Mínimo Rentable:{' '}
            <strong className="text-orange-400 font-mono font-black text-base whitespace-nowrap">
              {breakEvenCoefficient}%
            </strong>
          </span>
        </div>
      </div>

      {/* Main Table without horizontal scroll */}
      <div className="w-full">
        <table className="w-full text-left text-sm sm:text-base table-auto">
          <thead>
            <tr className="border-b border-slate-800 text-slate-300 font-bold uppercase tracking-wider text-xs sm:text-sm">
              <th className="py-3 px-2.5 w-[19%]">Estadística (Jet)</th>
              <th className="py-3 px-2.5 w-[23%]">Runa</th>
              <th className="py-3 px-2.5 w-[14%]">Precio HDV</th>
              <th className="py-3 px-3 w-[20%] text-amber-400 bg-amber-500/5">
                <div className="flex items-center justify-between gap-1 whitespace-nowrap">
                  <span>Sin Foco</span>
                  {normalTopRank && (
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-black shrink-0 ${
                        normalTopRank === 1
                          ? 'bg-amber-500 text-slate-950'
                          : normalTopRank === 2
                          ? 'bg-sky-500 text-slate-950'
                          : 'bg-orange-500 text-slate-950'
                      }`}
                    >
                      TOP {normalTopRank}
                    </span>
                  )}
                </div>
              </th>
              <th className="py-3 px-3 w-[24%] text-purple-300 bg-purple-500/5 whitespace-nowrap">
                Con Foco
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-medium">
            {statYields.map((yieldItem) => {
              const isFocused = focusedRuneId === yieldItem.rune.id;
              const isTop1 = yieldItem.isBestFocus;
              const isTop2 = top3FocusOptions.find((s) => !s.isNormal && s.rune?.id === yieldItem.rune.id)?.rank === 2;
              const isTop3 = top3FocusOptions.find((s) => !s.isNormal && s.rune?.id === yieldItem.rune.id)?.rank === 3;
              const isHuntingRune = yieldItem.rune.id === 10057 || !yieldItem.isFocusable;
              const isStarRune = yieldItem.rune.id === starRuneId;

              const draftPrice =
                runePriceDrafts[yieldItem.rune.id] ?? String(yieldItem.unitPrice);

              const focusProfit = yieldItem.focusNetProfit;

              return (
                <tr
                  key={yieldItem.rune.id}
                  className={`hover:bg-slate-800/40 transition-colors ${
                    isFocused
                      ? 'bg-purple-950/20'
                      : isTop1
                      ? 'bg-amber-950/10'
                      : ''
                  }`}
                >
                  {/* Tirada / Jet Controls */}
                  <td className="py-2.5 px-2.5">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onStatChange(yieldItem.rune.id, String(yieldItem.statMin))}
                          className={`px-2 py-0.5 rounded text-xs font-mono font-bold transition-all ${
                            yieldItem.statSelectedVal === yieldItem.statMin
                              ? 'bg-slate-700 text-white'
                              : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                          }`}
                        >
                          Mín
                        </button>
                        <button
                          onClick={() =>
                            onStatChange(
                              yieldItem.rune.id,
                              String(Math.floor((yieldItem.statMin + yieldItem.statMax) / 2))
                            )
                          }
                          className={`px-2 py-0.5 rounded text-xs font-mono font-bold transition-all ${
                            yieldItem.statSelectedVal ===
                            Math.floor((yieldItem.statMin + yieldItem.statMax) / 2)
                              ? 'bg-amber-500 text-slate-950 font-black'
                              : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                          }`}
                        >
                          Prom
                        </button>
                        <button
                          onClick={() => onStatChange(yieldItem.rune.id, String(yieldItem.statMax))}
                          className={`px-2 py-0.5 rounded text-xs font-mono font-bold transition-all ${
                            yieldItem.statSelectedVal === yieldItem.statMax
                              ? 'bg-slate-700 text-white'
                              : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                          }`}
                        >
                          Máx
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={0}
                          value={yieldItem.statSelectedVal}
                          onChange={(e) => onStatChange(yieldItem.rune.id, e.target.value)}
                          className="w-16 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-center text-sm font-mono font-bold text-white focus:outline-none focus:border-amber-500"
                        />
                        <span className="text-xs text-slate-400 font-mono whitespace-nowrap">
                          ({yieldItem.statMin}-{yieldItem.statMax})
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Rune identity */}
                  <td className="py-2.5 px-2.5">
                    <div className="flex items-center gap-2">
                      <RuneIcon rune={yieldItem.rune} size="sm" showTooltip />
                      <div className="min-w-0">
                        <p className="font-bold text-white flex items-center gap-1.5 truncate leading-tight text-sm sm:text-base">
                          <span className="text-amber-400 font-black whitespace-nowrap">
                            +{yieldItem.statSelectedVal}
                          </span>
                          <span className="truncate">{yieldItem.rune.name.replace('Runa ', '')}</span>
                        </p>
                        <div className="flex items-center gap-1.5 text-xs font-mono text-slate-300 mt-0.5 whitespace-nowrap">
                          <span>P: {yieldItem.unitWeight}</span>
                          {isStarRune && (
                            <span className="text-amber-400 font-bold flex items-center gap-0.5">
                              • <Flame className="w-3 h-3" />
                              {starRunePercent}% valor
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* HDV Price Editor */}
                  <td className="py-2.5 px-2.5">
                    <div className="flex items-center gap-1.5">
                      <div className="relative w-full max-w-[110px]">
                        <input
                          type="number"
                          value={draftPrice}
                          onChange={(e) => onPriceDraftChange(yieldItem.rune.id, e.target.value)}
                          onBlur={() => onSaveRunePrice(yieldItem.rune.id, draftPrice)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              onSaveRunePrice(yieldItem.rune.id, draftPrice);
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-right text-sm font-mono font-bold text-slate-100 focus:outline-none focus:border-amber-500 pr-5"
                        />
                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                          K
                        </span>
                      </div>
                      {savedRuneIdFeedback === yieldItem.rune.id && (
                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      )}
                    </div>
                  </td>

                  {/* Normal Yield (Sin foco) */}
                  <td className="py-2.5 px-3 bg-amber-500/5 font-mono whitespace-nowrap">
                    <div className="font-bold text-amber-300 text-sm sm:text-base whitespace-nowrap">
                      {yieldItem.normalRunesPerItem.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{' '}
                      <span className="text-xs text-amber-400/80 font-normal">runas</span>
                    </div>
                    <div className="text-sm sm:text-base font-black text-amber-200 mt-0.5 whitespace-nowrap">
                      {yieldItem.normalKamasValue.toLocaleString('de-DE')} K
                    </div>
                  </td>

                  {/* Focus Yield (Con foco) */}
                  <td className="py-2.5 px-3 bg-purple-500/5 font-mono whitespace-nowrap">
                    {isHuntingRune ? (
                      <div className="text-slate-400 italic text-sm py-1 whitespace-nowrap">
                        No enfocable
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div
                            className={`font-bold text-sm sm:text-base whitespace-nowrap ${
                              isTop1
                                ? 'text-amber-300'
                                : isTop2
                                ? 'text-sky-300'
                                : isTop3
                                ? 'text-orange-300'
                                : 'text-purple-300'
                            }`}
                          >
                            {yieldItem.focusRunesPerItem.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{' '}
                            <span className="text-xs text-purple-400/80 font-normal">runas</span>
                          </div>
                          <div className="text-sm sm:text-base font-black text-purple-200 mt-0.5 whitespace-nowrap">
                            {yieldItem.focusKamasValue.toLocaleString('de-DE')} K
                          </div>
                        </div>

                        <div className="text-right shrink-0 flex flex-col items-end">
                          {isTop1 && (
                            <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-black text-xs whitespace-nowrap shadow-sm">
                              TOP 1
                            </span>
                          )}
                          {isTop2 && !isTop1 && (
                            <span className="px-2 py-0.5 rounded bg-sky-500 text-slate-950 font-black text-xs whitespace-nowrap shadow-sm">
                              TOP 2
                            </span>
                          )}
                          {isTop3 && !isTop1 && !isTop2 && (
                            <span className="px-2 py-0.5 rounded bg-orange-500 text-slate-950 font-black text-xs whitespace-nowrap shadow-sm">
                              TOP 3
                            </span>
                          )}
                          <div className="mt-1">
                            <span
                              className={`text-xs sm:text-sm font-mono font-black whitespace-nowrap ${
                                focusProfit >= 0 ? 'text-emerald-400' : 'text-red-400'
                              }`}
                            >
                              {focusProfit >= 0 ? '+' : ''}
                              {focusProfit.toLocaleString('de-DE')} K
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* Footer Totals */}
          {statYields.length > 0 && (
            <tfoot className="border-t-2 border-slate-700 bg-slate-950/90">
              <tr>
                <td
                  colSpan={3}
                  className="py-3 px-2.5 text-sm sm:text-base font-black uppercase text-slate-200 tracking-wider whitespace-nowrap"
                >
                  Total Valor de Runas:
                </td>
                <td className="py-3 px-3 bg-amber-500/10 font-mono whitespace-nowrap">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-base sm:text-lg font-black text-amber-300 whitespace-nowrap">
                        {normalTotalKamasValue.toLocaleString('de-DE')} K
                      </div>
                      <div
                        className={`text-xs sm:text-sm font-mono font-black mt-0.5 whitespace-nowrap ${
                          normalNetProfit >= 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {normalNetProfit >= 0 ? '+' : ''}
                        {normalNetProfit.toLocaleString('de-DE')} K
                      </div>
                    </div>
                    {normalTopRank && (
                      <span
                        className={`px-2 py-0.5 rounded font-black text-xs shrink-0 whitespace-nowrap ${
                          normalTopRank === 1
                            ? 'bg-amber-500 text-slate-950'
                            : normalTopRank === 2
                            ? 'bg-sky-500 text-slate-950'
                            : 'bg-orange-500 text-slate-950'
                        }`}
                      >
                        TOP {normalTopRank}
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-3 px-3 bg-purple-500/10 font-mono whitespace-nowrap">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-base sm:text-lg font-black text-purple-300 whitespace-nowrap">
                        {(
                          bestFocusOption?.totalKamasValue ?? normalTotalKamasValue
                        ).toLocaleString('de-DE')}{' '}
                        K
                      </div>
                      <div
                        className={`text-xs sm:text-sm font-mono font-black mt-0.5 whitespace-nowrap ${
                          (bestFocusOption?.netProfit ?? normalNetProfit) >= 0
                            ? 'text-emerald-400'
                            : 'text-red-400'
                        }`}
                      >
                        {(bestFocusOption?.netProfit ?? normalNetProfit) >= 0 ? '+' : ''}
                        {(bestFocusOption?.netProfit ?? normalNetProfit).toLocaleString('de-DE')} K
                      </div>
                    </div>
                    {bestFocusOption && (
                      <span
                        className={`px-2 py-0.5 rounded font-black text-xs shrink-0 whitespace-nowrap ${
                          bestFocusOption.rank === 1
                            ? 'bg-amber-500 text-slate-950'
                            : bestFocusOption.rank === 2
                            ? 'bg-sky-500 text-slate-950'
                            : 'bg-orange-500 text-slate-950'
                        }`}
                      >
                        TOP {bestFocusOption.rank}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};
