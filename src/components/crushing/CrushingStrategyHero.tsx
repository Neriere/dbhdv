import React from 'react';
import {
  Sparkles,
  Check,
  Save,
  Clock,
  ArrowRight,
  Sliders,
  Store,
  Zap,
  Target,
  TrendingUp,
  AlertTriangle,
  Flame,
} from 'lucide-react';
import { DofusItem } from '../../types';
import {
  CraftableItem,
  getItemFallbackIconUrl,
  getItemIconUrl,
  getItemName,
  getItemTypeName,
} from '../../services/dofusDbService';
import { SafeImage } from '../SafeImage';
import { TopFocusOption } from '../../data/dofusRuneWeights';
import { KamaDisplay } from '../common/KamaDisplay';

interface CrushingStrategyHeroProps {
  selectedItem: CraftableItem;
  craftCost: number;
  marketSalePrice: number;
  normalTotalKamasValue: number;
  normalNetProfit: number;
  bestFocusOption: TopFocusOption | undefined;
  coefficientPercent: number;
  savedCoefficientTimestamp?: number;
  savedCoeffFeedback: boolean;
  breakEvenCoefficient: number;
  onCoefficientChange: (newCoeff: number) => void;
  onSaveCoefficient: () => void;
  onResetStatsPreset: (preset: 'min' | 'avg' | 'max') => void;
  onSelectRecipeForCalculator?: (item: DofusItem) => void;
}

export function formatTimeAgoText(ts: number | null | undefined): string {
  if (!ts) return 'Por defecto';
  const diffMs = Date.now() - ts;
  const diffMin = Math.floor(diffMs / (1000 * 60));
  if (diffMin < 1) return 'Hace un momento';
  if (diffMin < 60) return `Hace ${diffMin}m`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Hace ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays}d`;
  const d = new Date(ts);
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}

export function formatFullDateText(ts: number | null | undefined): string {
  if (!ts) return 'No registrado aún (100% por defecto)';
  const d = new Date(ts);
  return `${d.toLocaleDateString()} a las ${d.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

export const CrushingStrategyHero: React.FC<CrushingStrategyHeroProps> = ({
  selectedItem,
  craftCost,
  marketSalePrice,
  normalTotalKamasValue,
  normalNetProfit,
  bestFocusOption,
  coefficientPercent,
  savedCoefficientTimestamp,
  savedCoeffFeedback,
  breakEvenCoefficient,
  onCoefficientChange,
  onSaveCoefficient,
  onResetStatsPreset,
  onSelectRecipeForCalculator,
}) => {
  const hdvProfit = marketSalePrice - craftCost;
  const bestProfit = bestFocusOption ? bestFocusOption.netProfit : normalNetProfit;
  const bestValue = bestFocusOption ? bestFocusOption.totalKamasValue : normalTotalKamasValue;
  const isProfitable = bestProfit > 0;
  const isAboveBreakEven = coefficientPercent >= breakEvenCoefficient;
  const bestStratRuneName =
    bestFocusOption && !bestFocusOption.isNormal && bestFocusOption.rune
      ? bestFocusOption.rune.name.replace('Runa ', '')
      : 'Sin Foco (Todas)';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
      {/* Top Section: Item Info + Preset Buttons + Coeff Control */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        {/* Left: Item Info */}
        <div className="flex items-center gap-3.5 flex-1 min-w-0">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-slate-950 border border-amber-500/30 flex items-center justify-center p-2 shadow-md shrink-0">
            <SafeImage
              key={selectedItem.id}
              src={getItemIconUrl(selectedItem)}
              fallbackSrc={getItemFallbackIconUrl(selectedItem)}
              alt={getItemName(selectedItem)}
              className="w-10 h-10 sm:w-12 sm:h-12 object-contain"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl sm:text-2xl font-black text-white truncate">
                {getItemName(selectedItem)}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs sm:text-sm font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0 font-mono">
                Nv. {selectedItem.level || 1}
              </span>
              <span className="text-sm text-slate-300 font-medium">
                {getItemTypeName(selectedItem)} • {selectedItem.jobNameEs}
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-400 mt-1 flex-wrap">
              {onSelectRecipeForCalculator && (
                <button
                  onClick={() => onSelectRecipeForCalculator(selectedItem)}
                  className="flex items-center gap-1 text-sm font-bold text-amber-400 hover:text-amber-300 transition-colors"
                >
                  Ver Receta Completa <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right: Quick Controls (Presets & Coeff) */}
        <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap shrink-0 border-t lg:border-t-0 lg:border-l border-slate-800 pt-3 lg:pt-0 lg:pl-4">
          {/* Global Jet Presets */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5">
            <span className="text-xs sm:text-sm font-bold text-slate-300 flex items-center gap-1 pr-1">
              <Sliders className="w-4 h-4 text-amber-400" /> Jets:
            </span>
            <button
              onClick={() => onResetStatsPreset('min')}
              className="px-2.5 py-1 rounded-lg text-xs sm:text-sm font-bold bg-slate-900 text-slate-300 hover:text-white border border-slate-800 transition-all"
            >
              Mín
            </button>
            <button
              onClick={() => onResetStatsPreset('avg')}
              className="px-2.5 py-1 rounded-lg text-xs sm:text-sm font-bold bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 transition-all"
            >
              Prom
            </button>
            <button
              onClick={() => onResetStatsPreset('max')}
              className="px-2.5 py-1 rounded-lg text-xs sm:text-sm font-bold bg-slate-900 text-slate-300 hover:text-white border border-slate-800 transition-all"
            >
              Máx
            </button>
          </div>

          {/* Coeff Manual Input & Presets */}
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl p-1.5">
            <div className="flex items-center gap-1">
              <button
                onClick={() => onCoefficientChange(Math.max(1, coefficientPercent - 10))}
                className="w-7 h-7 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 flex items-center justify-center text-sm font-black border border-slate-800"
              >
                -
              </button>
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  max={4000}
                  value={coefficientPercent}
                  onChange={(e) => onCoefficientChange(Math.max(1, Number(e.target.value) || 1))}
                  className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-center text-sm sm:text-base font-mono font-black text-amber-300 focus:outline-none focus:border-amber-500 pr-5"
                />
                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">
                  %
                </span>
              </div>
              <button
                onClick={() => onCoefficientChange(coefficientPercent + 10)}
                className="w-7 h-7 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 flex items-center justify-center text-sm font-black border border-slate-800"
              >
                +
              </button>
            </div>

            <button
              onClick={onSaveCoefficient}
              title={`Guardar coeficiente (${formatFullDateText(savedCoefficientTimestamp)})`}
              className={`p-2 rounded-lg text-xs transition-all flex items-center gap-1 ${
                savedCoeffFeedback
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold'
              }`}
            >
              {savedCoeffFeedback ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* 4 Strategic Comparison Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* 1. Coste Fabricación */}
        <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-xs sm:text-sm font-bold uppercase text-slate-300 tracking-wider">
            Inversión (Craft)
          </span>
          <div className="mt-1.5">
            <div className="text-lg sm:text-xl md:text-2xl font-black text-white font-mono">
              {craftCost.toLocaleString('de-DE')} K
            </div>
            <span className="text-xs text-slate-400 mt-0.5 block">Costo total de receta</span>
          </div>
        </div>

        {/* 2. Venta HDV */}
        <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-bold uppercase text-slate-300 tracking-wider flex items-center gap-1.5">
              <Store className="w-4 h-4 text-sky-400" /> Venta HDV
            </span>
          </div>
          <div className="mt-1.5">
            <div className="text-lg sm:text-xl md:text-2xl font-black text-sky-300 font-mono">
              {marketSalePrice > 0 ? `${marketSalePrice.toLocaleString('de-DE')} K` : 'Sin precio'}
            </div>
            <div
              className={`text-xs sm:text-sm font-mono font-black mt-0.5 ${
                hdvProfit >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {marketSalePrice > 0 ? `${hdvProfit >= 0 ? '+' : ''}${hdvProfit.toLocaleString('de-DE')} K` : '-'}
            </div>
          </div>
        </div>

        {/* 3. Romper Normal (Sin Foco) */}
        <div className="bg-slate-950/80 border border-amber-500/20 rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-xs sm:text-sm font-bold uppercase text-amber-400 tracking-wider flex items-center gap-1.5">
            <Zap className="w-4 h-4" /> Sin Foco (Todas)
          </span>
          <div className="mt-1.5">
            <div className="text-lg sm:text-xl md:text-2xl font-black text-amber-300 font-mono">
              {normalTotalKamasValue.toLocaleString('de-DE')} K
            </div>
            <div
              className={`text-xs sm:text-sm font-mono font-black mt-0.5 ${
                normalNetProfit >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {normalNetProfit >= 0 ? '+' : ''}
              {normalNetProfit.toLocaleString('de-DE')} K
            </div>
          </div>
        </div>

        {/* 4. Romper con Foco Óptimo */}
        <div className="bg-slate-950/80 border border-purple-500/30 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-bold uppercase text-purple-300 tracking-wider flex items-center gap-1.5">
              <Target className="w-4 h-4" /> Mejor Foco
            </span>
            <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-black text-xs">
              TOP 1
            </span>
          </div>
          <div className="mt-1.5">
            <div className="text-lg sm:text-xl md:text-2xl font-black text-purple-300 font-mono truncate">
              {bestValue.toLocaleString('de-DE')} K
            </div>
            <div className="flex items-center justify-between gap-1.5 mt-0.5">
              <span
                className={`text-xs sm:text-sm font-mono font-black ${
                  bestProfit >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {bestProfit >= 0 ? '+' : ''}
                {bestProfit.toLocaleString('de-DE')} K
              </span>
              <span className="text-xs text-purple-400 truncate font-semibold">
                {bestStratRuneName}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Break-even & Rentability Status Bar */}
      <div
        className={`p-3 sm:p-3.5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-sm sm:text-base transition-colors ${
          isAboveBreakEven
            ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
            : 'bg-amber-950/20 border-amber-500/30 text-amber-300'
        }`}
      >
        <div className="flex items-center gap-2.5">
          {isAboveBreakEven ? (
            <TrendingUp className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          )}
          <span>
            {isAboveBreakEven ? (
              <>
                <strong className="font-black">¡Rentable al coeficiente actual!</strong> Estás {coefficientPercent - breakEvenCoefficient}% por encima del mínimo rentable ({breakEvenCoefficient}%).
              </>
            ) : (
              <>
                <strong className="font-black">Coeficiente insuficiente para cubrir costes.</strong> Necesitas un mínimo de {breakEvenCoefficient}% para recuperar la inversión del crafteo.
              </>
            )}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs sm:text-sm font-mono text-slate-300 shrink-0">
          <Clock className="w-4 h-4 text-slate-400" />
          <span>Último guardado: {formatTimeAgoText(savedCoefficientTimestamp)}</span>
        </div>
      </div>
    </div>
  );
};
