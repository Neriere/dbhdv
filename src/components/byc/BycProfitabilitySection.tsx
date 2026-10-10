import React from 'react';
import {
  Layers,
  Map as MapIcon,
  Award,
  Sparkles,
  Vault,
} from 'lucide-react';
import { LegendaryHuntInfo } from '../../data/legendaryHuntsData';
import { getItemIconUrl } from '../../services/dofusDbService';

interface BycProfitabilitySectionProps {
  hunt: LegendaryHuntInfo;
  priceDrafts: Record<number, string>;
  onPriceDraftChange: (itemId: number, rawVal: string) => void;
  onPriceCommit: (itemId: number, rawVal: string) => void;
  wholeMapPrice: number;
  resourcePriceGross: number;
  fragmentsTotalCost: number;
  resourcesInBank: number;
  chestSebuscalines: number;
  missionSebuscalines: number;
  sebuscalinesValue: number;
  totalHuntNetReturn: number;
  profitFragsNet: number;
  roiFrags: number;
  profitMapNet: number;
  roiMap: number;
  bestHuntMethod: 'fragments' | 'map';
  bestHuntProfitNet: number;
  bestHuntInvestment: number;
  bestHuntEffectiveUnitCost: number;
  effectiveCostViaFrags: number;
  formatKamas: (val: number) => string;
  getPrice: (itemId: number, defaultVal: number) => number;
  getBankQty: (itemId: number) => number;
}

export const BycProfitabilitySection: React.FC<
  BycProfitabilitySectionProps
> = ({
  hunt,
  priceDrafts,
  onPriceDraftChange,
  onPriceCommit,
  wholeMapPrice,
  resourcePriceGross,
  fragmentsTotalCost,
  resourcesInBank,
  chestSebuscalines,
  missionSebuscalines,
  sebuscalinesValue,
  totalHuntNetReturn,
  profitFragsNet,
  roiFrags,
  profitMapNet,
  roiMap,
  bestHuntMethod,
  bestHuntProfitNet,
  bestHuntInvestment,
  bestHuntEffectiveUnitCost,
  effectiveCostViaFrags,
  formatKamas,
  getPrice,
  getBankQty,
}) => {
  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
      {/* Header with Title and Global Price Inputs */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3.5 border-b border-slate-800">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0 shadow-inner mt-0.5 sm:mt-0">
            <img
              src={
                hunt.resource.iconId
                  ? `https://api.dofusdb.fr/img/items/${hunt.resource.iconId}.png`
                  : getItemIconUrl(hunt.resource.id)
              }
              alt={hunt.resource.name}
              className="w-9 h-9 object-contain"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-white">
                1. Rentabilidad de la Cacería
              </h2>
              <span className="text-slate-400 text-sm hidden sm:inline">|</span>
              <span className="text-sm sm:text-base font-semibold text-amber-300">
                {hunt.resource.name}
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
                {hunt.fragments.count} fragmentos
              </span>
              {resourcesInBank > 0 && (
                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/20 px-2.5 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1">
                  <Vault className="w-3 h-3" /> {resourcesInBank} en banco
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-400">
              Cofre otorga{' '}
              <strong className="text-amber-300 font-mono">
                +{chestSebuscalines} Sebuscalines
              </strong>{' '}
              ({formatKamas(sebuscalinesValue)} K){' '}
              <span className="text-slate-500 font-normal">
                ({missionSebuscalines} u de misión, 50% en cofre)
              </span>{' '}
              + 1x {hunt.resource.name} (Retorno neto venta -2% tasa mercadillo:{' '}
              <strong className="text-emerald-400 font-mono">
                {formatKamas(totalHuntNetReturn)} K
              </strong>
              ).
            </p>
          </div>
        </div>

        {/* Quick Input Controls */}
        <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap shrink-0">
          {/* Whole Map Price */}
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 shadow-sm">
            <span className="text-xs sm:text-sm text-slate-300 font-medium whitespace-nowrap">
              Mapa en mercadillo:
            </span>
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 focus-within:border-amber-400">
              <input
                type="number"
                min="0"
                value={
                  priceDrafts[hunt.mapItem.id] !== undefined
                    ? priceDrafts[hunt.mapItem.id]
                    : wholeMapPrice > 0
                    ? wholeMapPrice
                    : ''
                }
                onChange={(e) =>
                  onPriceDraftChange(hunt.mapItem.id, e.target.value)
                }
                onBlur={(e) => onPriceCommit(hunt.mapItem.id, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter')
                    onPriceCommit(
                      hunt.mapItem.id,
                      (e.target as HTMLInputElement).value
                    );
                }}
                placeholder="0"
                className="w-24 bg-transparent text-right font-mono font-bold text-amber-300 text-xs sm:text-sm focus:outline-none"
              />
              <span className="text-xs text-slate-400 font-mono">K</span>
            </div>
          </div>

          {/* Boss Resource Price */}
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 shadow-sm">
            <span
              className="text-xs sm:text-sm text-slate-300 font-medium whitespace-nowrap max-w-[150px] sm:max-w-[200px] truncate"
              title={`${hunt.resource.name} en mercadillo`}
            >
              {hunt.resource.name}:
            </span>
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 focus-within:border-amber-400">
              <input
                type="number"
                min="0"
                value={
                  priceDrafts[hunt.resource.id] !== undefined
                    ? priceDrafts[hunt.resource.id]
                    : resourcePriceGross > 0
                    ? resourcePriceGross
                    : ''
                }
                onChange={(e) =>
                  onPriceDraftChange(hunt.resource.id, e.target.value)
                }
                onBlur={(e) =>
                  onPriceCommit(hunt.resource.id, e.target.value)
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter')
                    onPriceCommit(
                      hunt.resource.id,
                      (e.target as HTMLInputElement).value
                    );
                }}
                placeholder="0"
                className="w-24 bg-transparent text-right font-mono font-bold text-amber-300 text-xs sm:text-sm focus:outline-none"
              />
              <span className="text-xs text-slate-400 font-mono">K</span>
            </div>
          </div>
        </div>
      </div>

      {/* Content: Fragments Grid (Left) & Profit Analysis Options (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left Column: Fragment Pieces */}
        <div className="lg:col-span-7 space-y-2.5">
          <div
            className={`grid gap-2 ${
              hunt.fragments.count <= 2
                ? 'grid-cols-2'
                : hunt.fragments.count <= 4
                ? 'grid-cols-2 sm:grid-cols-4'
                : 'grid-cols-2 sm:grid-cols-4'
            }`}
          >
            {hunt.fragments.fragmentIds.map((fragId, idx) => {
              const price = getPrice(
                fragId,
                hunt.fragments.defaultUnitPrice
              );
              const inBank = getBankQty(fragId);
              const pieceNum = idx + 1;

              return (
                <div
                  key={fragId}
                  className={`flex flex-col justify-between p-2.5 rounded-xl border transition ${
                    inBank > 0
                      ? 'bg-emerald-950/20 border-emerald-600/40'
                      : 'bg-slate-800/60 border-slate-700/80 hover:border-indigo-500/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      {pieceNum}/{hunt.fragments.count}
                    </span>
                    {inBank > 0 ? (
                      <span className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-500/30">
                        <Vault className="w-2.5 h-2.5" /> x{inBank}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500 font-medium">
                        0 banco
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 my-1">
                    <div className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                      <img
                        src="https://api.dofusdb.fr/img/items/77042.png"
                        alt={`Fragmento ${pieceNum}`}
                        className="w-6 h-6 object-contain"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                    <span className="text-xs font-bold text-slate-200 truncate">
                      Pieza [{pieceNum}/{hunt.fragments.count}]
                    </span>
                  </div>

                  <div className="mt-1 pt-1.5 border-t border-slate-700/60 flex items-center justify-between gap-1">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">
                      Mercadillo
                    </span>
                    <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-md px-1.5 py-0.5 focus-within:border-amber-400">
                      <input
                        type="number"
                        min="0"
                        value={
                          priceDrafts[fragId] !== undefined
                            ? priceDrafts[fragId]
                            : price > 0
                            ? price
                            : ''
                        }
                        onChange={(e) =>
                          onPriceDraftChange(fragId, e.target.value)
                        }
                        onBlur={(e) =>
                          onPriceCommit(fragId, e.target.value)
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter')
                            onPriceCommit(
                              fragId,
                              (e.target as HTMLInputElement).value
                            );
                        }}
                        placeholder="0"
                        className="w-16 bg-transparent text-right font-mono font-bold text-amber-300 text-xs focus:outline-none"
                      />
                      <span className="text-[10px] text-slate-400 font-mono">
                        K
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Fragments Total Bar */}
          <div className="flex items-center justify-between p-2.5 px-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs sm:text-sm">
            <span className="text-slate-400">
              Inversión armar los {hunt.fragments.count} fragmentos:
            </span>
            <span className="font-mono font-bold text-amber-300">
              {formatKamas(fragmentsTotalCost)} Kamas
            </span>
          </div>
        </div>

        {/* Right Column: Complete Profitability Matrix (Hunt & Sell directly in HDV) */}
        <div className="lg:col-span-5 space-y-2.5">
          <div className="space-y-2">
            {/* Option 1: Hunt with Fragments */}
            <div
              className={`p-3 rounded-xl border flex items-center justify-between transition ${
                bestHuntMethod === 'fragments'
                  ? 'bg-emerald-950/30 border-emerald-500/50 ring-1 ring-emerald-500/30'
                  : 'bg-slate-800/40 border-slate-700/70'
              }`}
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs sm:text-sm font-bold text-slate-200">
                    1. Cazar con Fragmentos
                  </span>
                  {bestHuntMethod === 'fragments' && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500 text-slate-950">
                      MÁS BARATO
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Inversión:{' '}
                  <span className="font-mono text-slate-300">
                    {formatKamas(fragmentsTotalCost)} K
                  </span>{' '}
                  | Retorno:{' '}
                  <span className="font-mono text-slate-300">
                    {formatKamas(totalHuntNetReturn)} K
                  </span>
                </div>
              </div>

              <div className="text-right">
                <div
                  className={`text-sm sm:text-base font-black font-mono ${
                    profitFragsNet >= 0
                      ? 'text-emerald-400'
                      : 'text-rose-400'
                  }`}
                >
                  {profitFragsNet >= 0
                    ? `+${formatKamas(profitFragsNet)}`
                    : `-${formatKamas(Math.abs(profitFragsNet))}`}{' '}
                  K
                </div>
                <span
                  className={`text-xs font-mono font-bold ${
                    profitFragsNet >= 0
                      ? 'text-emerald-300/90'
                      : 'text-rose-400/90'
                  }`}
                >
                  {roiFrags >= 0
                    ? `+${roiFrags.toFixed(0)}%`
                    : `${roiFrags.toFixed(0)}%`}{' '}
                  ROI neto
                </span>
              </div>
            </div>

            {/* Option 2: Hunt with Whole Map */}
            <div
              className={`p-3 rounded-xl border flex items-center justify-between transition ${
                bestHuntMethod === 'map'
                  ? 'bg-emerald-950/30 border-emerald-500/50 ring-1 ring-emerald-500/30'
                  : 'bg-slate-800/40 border-slate-700/70'
              }`}
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <MapIcon className="w-4 h-4 text-amber-400" />
                  <span className="text-xs sm:text-sm font-bold text-slate-200">
                    2. Cazar con Mapa Entero
                  </span>
                  {bestHuntMethod === 'map' && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500 text-slate-950">
                      MÁS BARATO
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Inversión:{' '}
                  <span className="font-mono text-slate-300">
                    {formatKamas(wholeMapPrice)} K
                  </span>{' '}
                  | Retorno:{' '}
                  <span className="font-mono text-slate-300">
                    {formatKamas(totalHuntNetReturn)} K
                  </span>
                </div>
              </div>

              <div className="text-right">
                <div
                  className={`text-sm sm:text-base font-black font-mono ${
                    profitMapNet >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {profitMapNet >= 0
                    ? `+${formatKamas(profitMapNet)}`
                    : `-${formatKamas(Math.abs(profitMapNet))}`}{' '}
                  K
                </div>
                <span
                  className={`text-xs font-mono font-bold ${
                    profitMapNet >= 0
                      ? 'text-emerald-300/90'
                      : 'text-rose-400/90'
                  }`}
                >
                  {roiMap >= 0
                    ? `+${roiMap.toFixed(0)}%`
                    : `${roiMap.toFixed(0)}%`}{' '}
                  ROI neto
                </span>
              </div>
            </div>

            {/* Option 3: Cost to Buy Resource Direct */}
            <div className="p-3 rounded-xl border bg-slate-800/30 border-slate-700/60 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs sm:text-sm font-bold text-slate-200">
                    3. Comprar {hunt.resource.name} en mercadillo
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">
                  Compra directa sin cacería (0 Sebuscalines)
                </span>
              </div>

              <div className="text-right">
                <div className="text-sm sm:text-base font-black font-mono text-slate-200">
                  {formatKamas(resourcePriceGross)} K
                </div>
                <span className="text-xs font-mono text-slate-400">
                  Precio compra mercadillo
                </span>
              </div>
            </div>
          </div>

          {/* Acquisition & Profit Verdict Banner */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 text-xs sm:text-sm flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div>
                {bestHuntProfitNet > 0 ? (
                  <span className="text-emerald-400 font-bold">
                    ¡Cazar genera +{formatKamas(bestHuntProfitNet)} Kamas de
                    beneficio directo! (Inviertes{' '}
                    {formatKamas(bestHuntInvestment)} K y sacas{' '}
                    {formatKamas(totalHuntNetReturn)} K).
                  </span>
                ) : (
                  <span className="text-rose-400 font-bold">
                    Cazar genera déficit de -
                    {formatKamas(Math.abs(bestHuntProfitNet))} K frente a
                    comprar directo.
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                {effectiveCostViaFrags < 0 ? (
                  <span className="text-cyan-300">
                    Nota: Los {chestSebuscalines} Sebuscalines superan el coste
                    de los fragmentos, dejándote{' '}
                    <strong>
                      +{formatKamas(Math.abs(effectiveCostViaFrags))} K limpios
                    </strong>{' '}
                    de ganancia extra antes de usar/vender el recurso.
                  </span>
                ) : (
                  <span>
                    Coste efectivo neto de la materia prima al cazar:{' '}
                    <strong className="text-amber-300 font-mono">
                      {formatKamas(bestHuntEffectiveUnitCost)} K
                    </strong>{' '}
                    (Ahorras{' '}
                    {formatKamas(
                      resourcePriceGross - bestHuntEffectiveUnitCost
                    )}{' '}
                    K vs mercadillo).
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
