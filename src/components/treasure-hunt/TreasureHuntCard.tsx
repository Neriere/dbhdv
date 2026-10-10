import React from 'react';
import {
  MapPin,
  Layers,
  Award,
  Flame,
  Vault,
  Hammer,
  TrendingUp,
  ShoppingCart,
  ArrowRight,
} from 'lucide-react';
import { getItemIconUrl } from '../../services/dofusDbService';
import { CalculatedHunt, CalculatedBycEquipment, formatKamas } from './types';

interface TreasureHuntCardProps {
  hunt: CalculatedHunt;
  priceDrafts: Record<number, string>;
  onPriceDraftChange: (itemId: number, rawVal: string) => void;
  onPriceCommit: (itemId: number, rawVal: string) => void;
  onSelectHuntForDetail: (hunt: CalculatedHunt) => void;
  selectedEquipmentTab: number | undefined;
  onSelectEquipmentTab: (eqId: number) => void;
  onAddFragmentsToShopping: (hunt: CalculatedHunt) => void;
  onAddWholeMapToShopping: (hunt: CalculatedHunt) => void;
  onAddEquipmentRecipeToShopping: (eq: CalculatedBycEquipment) => void;
}

export const TreasureHuntCard: React.FC<TreasureHuntCardProps> = ({
  hunt,
  priceDrafts,
  onPriceDraftChange,
  onPriceCommit,
  onSelectHuntForDetail,
  selectedEquipmentTab,
  onSelectEquipmentTab,
  onAddFragmentsToShopping,
  onAddWholeMapToShopping,
  onAddEquipmentRecipeToShopping,
}) => {
  const isProfitable = hunt.netProfit > 0;

  return (
    <div
      className={`rounded-2xl bg-slate-900/95 border transition-all duration-200 hover:border-slate-700 p-5 sm:p-6 space-y-4 shadow-lg ${
        isProfitable
          ? 'border-slate-800 hover:border-emerald-500/40'
          : 'border-slate-800/80 opacity-90'
      }`}
    >
      {/* Top Row: Monster Header, Level, Zone & Dual Profit Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3.5">
        <div
          className="flex items-center gap-3.5 cursor-pointer group/header min-w-0"
          onClick={() => onSelectHuntForDetail(hunt)}
        >
          <div className="w-13 h-13 rounded-xl bg-slate-950 border border-slate-800 p-1.5 flex items-center justify-center shrink-0 shadow-inner relative group-hover/header:border-amber-500/50 transition-colors">
            <img
              src={
                hunt.resource.iconId
                  ? `https://api.dofusdb.fr/img/items/${hunt.resource.iconId}.png`
                  : getItemIconUrl(hunt.resource.id)
              }
              alt={hunt.resource.name}
              className="w-10 h-10 object-contain group-hover/header:scale-105 transition-transform"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 text-[10px] font-black leading-none shadow">
              {hunt.monsterLevel}
            </span>
          </div>

          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-bold text-slate-100 group-hover/header:text-amber-300 transition-colors truncate">
                {hunt.monsterName}
              </h3>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-xs font-semibold">
                {hunt.levelRequirement}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 truncate">
              <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="truncate">{hunt.zone}</span>
              {hunt.subArea && (
                <span className="text-slate-400 truncate">
                  ({hunt.subArea})
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Dual Profit & ROI Summaries */}
        <div className="flex items-center justify-end gap-3 shrink-0 pt-1 sm:pt-0">
          {/* Cacería Pura */}
          <div className="text-right px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">
              Cacería Pura
            </span>
            <div className="flex items-baseline justify-end gap-1.5">
              <span
                className={`text-base font-bold font-mono ${
                  isProfitable ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {hunt.netProfit >= 0
                  ? `+${hunt.netProfit.toLocaleString()}`
                  : hunt.netProfit.toLocaleString()}{' '}
                K
              </span>
              <span className="text-xs font-semibold text-slate-400">
                ({formatKamas(hunt.netProfit)})
              </span>
            </div>
            <span
              className={`text-xs block font-bold font-mono ${
                isProfitable ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {Math.round(hunt.roiPercent)}% ROI
            </span>
          </div>

          {/* Crafteo Óptimo */}
          {hunt.bestCraftEquipment && (
            <div className="text-right px-3 py-1.5 rounded-xl bg-purple-950/30 border border-purple-500/40">
              <span
                className="text-[10px] text-purple-300 block font-bold uppercase tracking-wider truncate max-w-[150px]"
                title={hunt.bestCraftEquipment.name}
              >
                Crafteo ({hunt.bestCraftEquipment.name})
              </span>
              <div className="flex items-baseline justify-end gap-1.5">
                <span
                  className={`text-base font-bold font-mono ${
                    hunt.bestCraftEquipment.optimalNetProfit >= 0
                      ? 'text-emerald-400'
                      : 'text-rose-400'
                  }`}
                >
                  {hunt.bestCraftEquipment.optimalNetProfit >= 0
                    ? `+${hunt.bestCraftEquipment.optimalNetProfit.toLocaleString()}`
                    : hunt.bestCraftEquipment.optimalNetProfit.toLocaleString()}{' '}
                  K
                </span>
                <span className="text-xs font-semibold text-slate-400">
                  ({formatKamas(hunt.bestCraftEquipment.optimalNetProfit)})
                </span>
              </div>
              <span
                className={`text-xs block font-bold font-mono ${
                  hunt.bestCraftEquipment.optimalNetProfit >= 0
                    ? 'text-emerald-400'
                    : 'text-rose-400'
                }`}
              >
                {hunt.bestCraftEquipment.optimalRoi.toFixed(0)}% ROI
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Middle Two-Column Breakdown: Cost vs Rewards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
        {/* Left: Coste de Entrada */}
        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-bold text-slate-200 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-amber-400" />
              Coste de Entrada
            </span>
            <span className="text-xs text-slate-400">
              Mejor opción:{' '}
              <strong className="text-amber-300 font-bold">
                {hunt.isFragmentsCheaper ? 'Fragmentos' : 'Mapa Entero'}
              </strong>
            </span>
          </div>

          <div className="space-y-2 text-sm">
            {/* Option 1: Whole Map */}
            <div
              className={`p-2.5 rounded-xl border transition-colors flex items-center justify-between gap-3 ${
                !hunt.isFragmentsCheaper
                  ? 'bg-amber-500/10 border-amber-500/40 text-slate-100'
                  : 'bg-slate-900/70 border-slate-800 text-slate-300'
              }`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-semibold truncate">Mapa Entero:</span>
              </div>
              <div className="flex items-center gap-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 focus-within:border-amber-400 shrink-0 shadow-inner">
                <input
                  type="number"
                  min="0"
                  value={
                    priceDrafts[hunt.mapItem.id] !== undefined
                      ? priceDrafts[hunt.mapItem.id]
                      : hunt.wholeMapPrice > 0
                      ? hunt.wholeMapPrice
                      : ''
                  }
                  onChange={(e) =>
                    onPriceDraftChange(hunt.mapItem.id, e.target.value)
                  }
                  onBlur={(e) =>
                    onPriceCommit(hunt.mapItem.id, e.target.value)
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter')
                      onPriceCommit(
                        hunt.mapItem.id,
                        (e.target as HTMLInputElement).value
                      );
                  }}
                  placeholder="0"
                  className="w-28 bg-transparent text-right font-mono font-bold text-amber-300 text-sm focus:outline-none"
                />
                <span className="text-xs text-slate-400 font-mono font-bold">
                  K
                </span>
              </div>
            </div>

            {/* Option 2: Fragments Total */}
            <div
              className={`p-2.5 rounded-xl border transition-colors flex items-center justify-between ${
                hunt.isFragmentsCheaper
                  ? 'bg-amber-500/10 border-amber-500/40 text-slate-100'
                  : 'bg-slate-900/70 border-slate-800 text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold">
                  {hunt.fragments.count}x Fragmentos:
                </span>
                <button
                  type="button"
                  onClick={() => onSelectHuntForDetail(hunt)}
                  className="text-amber-400 hover:text-amber-300 transition-colors text-xs underline font-medium cursor-pointer"
                  title="Ver desglose de fragmentos"
                >
                  Ver piezas
                </button>
              </div>
              <span className="font-mono font-bold text-slate-100">
                {hunt.fragmentsTotal.toLocaleString()} K
              </span>
            </div>

            {/* Savings difference */}
            <div className="text-xs text-slate-300 flex items-center justify-between px-1 pt-0.5">
              <span>Ahorro entre opciones:</span>
              <span className="text-emerald-400 font-mono font-bold">
                +{hunt.entryMethodSavings.toLocaleString()} K (
                {formatKamas(hunt.entryMethodSavings)})
              </span>
            </div>
          </div>
        </div>

        {/* Right: Recompensas al Completar */}
        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-bold text-slate-200 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-emerald-400" />
              Recompensas del Cofre
            </span>
            <span className="text-emerald-400 font-mono font-bold text-sm">
              {hunt.totalRewardValue.toLocaleString()} K
            </span>
          </div>

          <div className="space-y-2 text-sm">
            {/* ByC Resource */}
            <div className="flex items-center justify-between gap-3 p-1">
              <div className="flex items-center gap-1.5 truncate min-w-0 pr-1">
                <span className="text-slate-200 font-semibold truncate">
                  {hunt.resource.name}:
                </span>
              </div>
              <div className="flex items-center gap-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 focus-within:border-amber-400 shrink-0 shadow-inner">
                <input
                  type="number"
                  min="0"
                  value={
                    priceDrafts[hunt.resource.id] !== undefined
                      ? priceDrafts[hunt.resource.id]
                      : hunt.resourcePrice > 0
                      ? hunt.resourcePrice
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
                  className="w-28 bg-transparent text-right font-mono font-bold text-slate-100 text-sm focus:outline-none"
                />
                <span className="text-xs text-slate-400 font-mono font-bold">
                  K
                </span>
              </div>
            </div>

            {/* Sebuscalines */}
            <div className="flex items-center justify-between text-slate-300 px-1 py-0.5">
              <span className="text-xs font-medium">
                +{hunt.sebuscalines} Sebuscalines del cofre:
              </span>
              <span className="font-mono text-amber-300 font-bold text-xs sm:text-sm">
                +{hunt.sebuscalinesValue.toLocaleString()} K
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Direct Comparison: Hunt vs Buy Resource in Mercadillo */}
      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs sm:text-sm">
        <div className="flex items-center gap-2 min-w-0">
          <Flame
            className={`w-4 h-4 shrink-0 ${
              hunt.huntVsBuyBenefit >= 0 ? 'text-amber-400' : 'text-slate-500'
            }`}
          />
          <span className="text-slate-200">
            {hunt.huntVsBuyBenefit >= 0 ? (
              <span>
                Ahorras{' '}
                <strong className="text-emerald-400 font-bold">
                  {hunt.huntVsBuyBenefit.toLocaleString()} K (
                  {formatKamas(hunt.huntVsBuyBenefit)})
                </strong>{' '}
                haciendo la cacería vs comprar en mercadillo{' '}
                <span className="text-amber-300 font-semibold">
                  (+{hunt.sebuscalines} sebuscalines)
                </span>
                .
              </span>
            ) : (
              <span>
                Comprar en mercadillo es{' '}
                <strong className="text-amber-400 font-bold">
                  {Math.abs(hunt.huntVsBuyBenefit).toLocaleString()} K (
                  {formatKamas(Math.abs(hunt.huntVsBuyBenefit))})
                </strong>{' '}
                más barato que montar el mapa.
              </span>
            )}
          </span>
        </div>

        {/* Bank inventory badge */}
        {hunt.bankFragmentsCount > 0 && (
          <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 shrink-0">
            <Vault className="w-3.5 h-3.5" />
            {hunt.bankFragmentsCount}/{hunt.fragments.count} piezas en Banco
          </span>
        )}
      </div>

      {/* Craftable Equipment Summary Section */}
      {hunt.calculatedEquipments.length > 0 && (() => {
        const activeEqId =
          selectedEquipmentTab ||
          hunt.bestCraftEquipment?.id ||
          hunt.calculatedEquipments[0].id;
        const activeEq =
          hunt.calculatedEquipments.find((e) => e.id === activeEqId) ||
          hunt.calculatedEquipments[0];

        return (
          <div className="p-4 rounded-xl bg-slate-950/90 border border-purple-500/30 space-y-3.5">
            {/* Equipment Section Header & Switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-300">
                  <Hammer className="w-4 h-4" />
                </div>
                <span className="text-sm font-bold text-purple-200">
                  Venta y Crafteo de Equipable Asociado
                </span>
              </div>

              {/* Equipment Tabs if multiple */}
              {hunt.calculatedEquipments.length > 1 && (
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  {hunt.calculatedEquipments.map((eq) => {
                    const isSelected = eq.id === activeEq.id;
                    return (
                      <button
                        key={eq.id}
                        type="button"
                        onClick={() => onSelectEquipmentTab(eq.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 border cursor-pointer ${
                          isSelected
                            ? 'bg-purple-500/25 border-purple-500/60 text-purple-100 shadow'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-slate-100'
                        }`}
                      >
                        <span>{eq.name}</span>
                        <span
                          className={`text-xs font-mono font-bold ${
                            eq.optimalNetProfit >= 0
                              ? 'text-emerald-400'
                              : 'text-rose-400'
                          }`}
                        >
                          ({eq.optimalNetProfit >= 0 ? '+' : ''}
                          {formatKamas(eq.optimalNetProfit)})
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Active Equipment Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 items-center">
              {/* Equipment Identity */}
              <div className="flex items-center gap-3 sm:col-span-1 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 p-1.5 flex items-center justify-center shrink-0 shadow-inner">
                  <img
                    src={getItemIconUrl({
                      iconId: activeEq.iconId,
                      id: activeEq.id,
                    })}
                    alt={activeEq.name}
                    className="w-9 h-9 object-contain"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-bold text-slate-100 truncate block">
                      {activeEq.name}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-500/40 text-xs font-semibold">
                      Nv {activeEq.level}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 block">
                    {activeEq.type}
                  </span>
                </div>
              </div>

              {/* Price Input & Net Sale */}
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-2.5">
                <div className="space-y-0.5 min-w-0">
                  <span className="text-xs text-slate-400 block font-medium">
                    Venta en Mercadillo:
                  </span>
                  <span className="text-xs text-slate-400 block font-mono">
                    Neto (-2%):{' '}
                    <strong className="text-slate-200">
                      {activeEq.salePriceNet.toLocaleString()} K
                    </strong>
                  </span>
                </div>
                <div className="flex items-center gap-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 focus-within:border-purple-400 shrink-0 shadow-inner">
                  <input
                    type="number"
                    min="0"
                    value={
                      priceDrafts[activeEq.id] !== undefined
                        ? priceDrafts[activeEq.id]
                        : activeEq.salePriceGross > 0
                        ? activeEq.salePriceGross
                        : ''
                    }
                    onChange={(e) =>
                      onPriceDraftChange(activeEq.id, e.target.value)
                    }
                    onBlur={(e) =>
                      onPriceCommit(activeEq.id, e.target.value)
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter')
                        onPriceCommit(
                          activeEq.id,
                          (e.target as HTMLInputElement).value
                        );
                    }}
                    placeholder="0"
                    className="w-28 bg-transparent text-right font-mono font-bold text-purple-300 text-sm focus:outline-none"
                  />
                  <span className="text-xs text-slate-400 font-mono font-bold">
                    K
                  </span>
                </div>
              </div>

              {/* Method Breakdown & Net Profit */}
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-slate-400">Vía Mercadillo directo:</span>
                  <span
                    className={`font-mono font-bold ${
                      activeEq.netProfitHdv >= 0
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {activeEq.netProfitHdv >= 0
                      ? `+${activeEq.netProfitHdv.toLocaleString()}`
                      : activeEq.netProfitHdv.toLocaleString()}{' '}
                    K
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-slate-400">Vía Cacería completa:</span>
                  <span
                    className={`font-mono font-bold ${
                      activeEq.netProfitHunt >= 0
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {activeEq.netProfitHunt >= 0
                      ? `+${activeEq.netProfitHunt.toLocaleString()}`
                      : activeEq.netProfitHunt.toLocaleString()}{' '}
                    K
                  </span>
                </div>
              </div>
            </div>

            {/* Final Strategy Conclusion Box */}
            <div className="pt-2.5 border-t border-slate-800/90 flex items-start gap-2.5">
              <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 shrink-0 mt-0.5">
                <TrendingUp className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-xs sm:text-sm leading-relaxed text-slate-200 flex-1">
                <strong className="text-slate-100 font-bold">
                  Conclusión Estratégica:{' '}
                </strong>
                {(() => {
                  const isHuntProfitable = hunt.netProfit > 0;
                  const isCraftHdvProfitable = activeEq.netProfitHdv > 0;
                  const isCraftHuntProfitable = activeEq.netProfitHunt > 0;

                  if (
                    activeEq.optimalMethod === 'hdv' &&
                    isCraftHdvProfitable &&
                    (!isHuntProfitable ||
                      activeEq.netProfitHdv > hunt.netProfit)
                  ) {
                    return (
                      <span>
                        Conviene comprar el recurso{' '}
                        <strong className="text-amber-300">
                          {hunt.resource.name}
                        </strong>{' '}
                        directamente en el mercadillo (
                        {hunt.resourcePrice.toLocaleString()} K) y craftear{' '}
                        <strong className="text-purple-300">
                          {activeEq.name}
                        </strong>{' '}
                        para obtener una ganancia neta de{' '}
                        <strong className="text-emerald-400">
                          +{activeEq.netProfitHdv.toLocaleString()} K (
                          {formatKamas(activeEq.netProfitHdv)})
                        </strong>{' '}
                        ({activeEq.roiHdv.toFixed(0)}% ROI), evitando el coste del
                        mapa.
                      </span>
                    );
                  }

                  if (
                    isCraftHuntProfitable &&
                    activeEq.optimalMethod === 'hunt' &&
                    activeEq.netProfitHunt >= hunt.netProfit
                  ) {
                    return (
                      <span>
                        Conviene realizar la cacería con{' '}
                        <strong className="text-amber-300">
                          {hunt.isFragmentsCheaper ? 'fragmentos' : 'mapa'}
                        </strong>{' '}
                        y craftear{' '}
                        <strong className="text-purple-300">
                          {activeEq.name}
                        </strong>
                        . Obtendrás el equipable más los {hunt.sebuscalines}{' '}
                        sebuscalines con una ganancia neta total de{' '}
                        <strong className="text-emerald-400">
                          +{activeEq.netProfitHunt.toLocaleString()} K (
                          {formatKamas(activeEq.netProfitHunt)})
                        </strong>
                        .
                      </span>
                    );
                  }

                  if (
                    isHuntProfitable &&
                    hunt.netProfit > activeEq.optimalNetProfit
                  ) {
                    return (
                      <span>
                        Conviene realizar la cacería y vender el botín en bruto (
                        {hunt.resource.name} + sebuscalines) para ganar{' '}
                        <strong className="text-emerald-400">
                          +{hunt.netProfit.toLocaleString()} K (
                          {formatKamas(hunt.netProfit)})
                        </strong>
                        . No se recomienda craftear el equipable.
                      </span>
                    );
                  }

                  return (
                    <span className="text-slate-400">
                      Ninguna ruta resulta rentable con los precios actuales (Cacería
                      pura:{' '}
                      <span className="text-rose-400">
                        {formatKamas(hunt.netProfit)}
                      </span>
                      , Crafteo en mercadillo:{' '}
                      <span className="text-rose-400">
                        {formatKamas(activeEq.netProfitHdv)}
                      </span>
                      ).
                    </span>
                  );
                })()}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Bottom Action Buttons */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2.5 border-t border-slate-800/80">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => onAddFragmentsToShopping(hunt)}
            className="px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-amber-300 border border-slate-800 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Añadir fragmentos a lista de compras"
          >
            <ShoppingCart className="w-3.5 h-3.5 text-amber-400" />
            <span>{hunt.fragments.count}x Fragmentos</span>
          </button>
          <button
            type="button"
            onClick={() => onAddWholeMapToShopping(hunt)}
            className="px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-amber-300 border border-slate-800 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Añadir mapa entero a lista de compras"
          >
            <ShoppingCart className="w-3.5 h-3.5 text-amber-400" />
            <span>Mapa Entero</span>
          </button>
          {hunt.calculatedEquipments.length > 0 && (() => {
            const activeEqId =
              selectedEquipmentTab ||
              hunt.bestCraftEquipment?.id ||
              hunt.calculatedEquipments[0].id;
            const activeEq =
              hunt.calculatedEquipments.find((e) => e.id === activeEqId) ||
              hunt.calculatedEquipments[0];
            return (
              <button
                type="button"
                onClick={() => onAddEquipmentRecipeToShopping(activeEq)}
                className="px-3 py-2 rounded-xl bg-purple-950/50 hover:bg-purple-900/60 text-purple-200 hover:text-white border border-purple-500/40 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title={`Añadir ingredientes de ${activeEq.name} a la lista de compras`}
              >
                <ShoppingCart className="w-3.5 h-3.5 text-purple-300" />
                <span>Mats {activeEq.name}</span>
              </button>
            );
          })()}
        </div>

        <button
          type="button"
          onClick={() => onSelectHuntForDetail(hunt)}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500/20 to-amber-600/10 hover:from-amber-500/30 hover:to-amber-600/20 text-amber-300 border border-amber-500/40 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-sm group shrink-0 cursor-pointer"
        >
          <Layers className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
          <span>Ver Análisis Detallado</span>
          <ArrowRight className="w-3.5 h-3.5 text-amber-400 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </div>
  );
};
