import React, { useState } from 'react';
import {
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
  RefreshCw,
  Sparkles,
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
import { fetchDofocusItemCoefficient } from '../../services/dofocusService';

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
  activeServerName?: string;
  activeServerSlug?: string;
  onCoefficientChange: (newCoeff: number) => void;
  onSaveCoefficient: () => void;
  onResetStatsPreset: (preset: 'min' | 'avg' | 'max') => void;
  onSelectRecipeForCalculator?: (item: DofusItem) => void;
}

export function formatTimeAgoText(ts: number | null | undefined): string {
  if (!ts) return '100%';
  const diffMs = Date.now() - ts;
  const diffMin = Math.floor(diffMs / (1000 * 60));
  if (diffMin < 1) return 'Ahora';
  if (diffMin < 60) return `${diffMin}m`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `${diffDays}d`;
  const d = new Date(ts);
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}

export function formatFullDateText(ts: number | null | undefined): string {
  if (!ts) return '100% por defecto';
  const d = new Date(ts);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {
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
  activeServerName = 'Draconiros',
  activeServerSlug,
  onCoefficientChange,
  onSaveCoefficient,
  onResetStatsPreset,
  onSelectRecipeForCalculator,
}) => {
  const hdvProfit = marketSalePrice - craftCost;
  const bestProfit = bestFocusOption ? bestFocusOption.netProfit : normalNetProfit;
  const bestValue = bestFocusOption ? bestFocusOption.totalKamasValue : normalTotalKamasValue;
  const isAboveBreakEven = coefficientPercent >= breakEvenCoefficient;
  const bestStratRuneName =
    bestFocusOption && !bestFocusOption.isNormal && bestFocusOption.rune
      ? bestFocusOption.rune.name.replace('Runa ', '')
      : 'Sin Foco';

  const [isFetchingDofocus, setIsFetchingDofocus] = useState(false);
  const [dofocusFeedback, setDofocusFeedback] = useState<string | null>(null);

  const handleFetchFromDofocus = async () => {
    if (!selectedItem?.id || isFetchingDofocus) return;
    setIsFetchingDofocus(true);
    setDofocusFeedback(null);
    try {
      const serverTarget = activeServerName || activeServerSlug || 'Draconiros';
      const data = await fetchDofocusItemCoefficient(selectedItem.id, serverTarget);
      if (data && typeof data.coefficient === 'number') {
        onCoefficientChange(data.coefficient);
        onSaveCoefficient();
        setDofocusFeedback(`${serverTarget}: ${data.coefficient}%`);
        setTimeout(() => setDofocusFeedback(null), 3000);
      }
    } catch (err) {
      console.error('Error fetching DoFocus coefficient:', err);
      setDofocusFeedback('Error');
      setTimeout(() => setDofocusFeedback(null), 2500);
    } finally {
      setIsFetchingDofocus(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-4">
      {/* Top Section: Item Info + Preset Buttons + Coeff Control */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        {/* Left: Item Info */}
        <div className="flex items-center gap-3.5 flex-1 min-w-0">
          <div className="w-14 h-14 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center p-2 shadow-inner shrink-0">
            <SafeImage
              key={selectedItem.id}
              src={getItemIconUrl(selectedItem)}
              fallbackSrc={getItemFallbackIconUrl(selectedItem)}
              alt={getItemName(selectedItem)}
              className="w-10 h-10 object-contain"
            />
          </div>
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-black text-white truncate">
                {getItemName(selectedItem)}
              </h2>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0 font-mono">
                Nv. {selectedItem.level || 1}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                {getItemTypeName(selectedItem)} • {selectedItem.jobNameEs}
              </span>
            </div>
            {onSelectRecipeForCalculator && (
              <div>
                <button
                  onClick={() => onSelectRecipeForCalculator(selectedItem)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-amber-400 hover:underline"
                >
                  <span>Receta</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Quick Controls (Presets & Coeff) */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap shrink-0 border-t lg:border-t-0 lg:border-l border-slate-800 pt-3 lg:pt-0 lg:pl-4 text-xs">
          {/* Global Jet Presets */}
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1">
            <span className="font-bold text-slate-400 flex items-center gap-1 pr-1">
              <Sliders className="w-3.5 h-3.5 text-amber-400" /> Jets:
            </span>
            <button
              onClick={() => onResetStatsPreset('min')}
              className="px-2 py-0.5 rounded-lg font-bold bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
            >
              Mín
            </button>
            <button
              onClick={() => onResetStatsPreset('avg')}
              className="px-2 py-0.5 rounded-lg font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40"
            >
              Prom
            </button>
            <button
              onClick={() => onResetStatsPreset('max')}
              className="px-2 py-0.5 rounded-lg font-bold bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
            >
              Máx
            </button>
          </div>

          {/* Coeff Manual Input & Presets */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl p-1">
            <div className="flex items-center gap-1">
              <button
                onClick={() => onCoefficientChange(Math.max(1, coefficientPercent - 10))}
                className="w-6 h-6 rounded bg-slate-900 hover:bg-slate-800 text-slate-200 flex items-center justify-center font-bold border border-slate-800"
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
                  className="w-16 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-center font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-500 pr-4 text-xs"
                />
                <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500">
                  %
                </span>
              </div>
              <button
                onClick={() => onCoefficientChange(coefficientPercent + 10)}
                className="w-6 h-6 rounded bg-slate-900 hover:bg-slate-800 text-slate-200 flex items-center justify-center font-bold border border-slate-800"
              >
                +
              </button>
            </div>

            {/* Quick DoFocus Draconiros button */}
            <button
              type="button"
              onClick={handleFetchFromDofocus}
              disabled={isFetchingDofocus}
              title="Obtener coeficiente actualizado de Draconiros en DoFocus"
              className={`px-2 py-1.5 rounded-lg border font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer ${
                dofocusFeedback
                  ? 'bg-sky-500/20 border-sky-500/50 text-sky-300'
                  : 'bg-slate-900 hover:bg-sky-500/20 border-slate-700 hover:border-sky-500/40 text-slate-300 hover:text-sky-300'
              }`}
            >
              <RefreshCw className={`w-3 h-3 text-sky-400 ${isFetchingDofocus ? 'animate-spin' : ''}`} />
              <span className="font-mono">
                {dofocusFeedback || 'DoFocus'}
              </span>
            </button>

            <button
              onClick={onSaveCoefficient}
              title={`Guardar (${formatFullDateText(savedCoefficientTimestamp)})`}
              className={`p-1.5 rounded-lg transition-all flex items-center gap-1 ${
                savedCoeffFeedback
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold'
              }`}
            >
              {savedCoeffFeedback ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* 4 Strategic Comparison Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {/* 1. Coste Fabricación */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
            Costo Crafteo
          </span>
          <div className="mt-1">
            <div className="text-base font-black text-white font-mono">
              {craftCost.toLocaleString('de-DE')} K
            </div>
          </div>
        </div>

        {/* 2. Venta HDV */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1">
            <Store className="w-3.5 h-3.5 text-sky-400" /> Venta HDV
          </span>
          <div className="mt-1">
            <div className="text-base font-black text-sky-300 font-mono">
              {marketSalePrice > 0 ? `${marketSalePrice.toLocaleString('de-DE')} K` : '---'}
            </div>
            <div
              className={`text-xs font-mono font-bold ${
                hdvProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {marketSalePrice > 0 ? `${hdvProfit >= 0 ? '+' : ''}${hdvProfit.toLocaleString('de-DE')} K` : ''}
            </div>
          </div>
        </div>

        {/* 3. Romper Normal (Sin Foco) */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase text-amber-400 tracking-wider flex items-center gap-1">
            <Zap className="w-3.5 h-3.5" /> Sin Foco
          </span>
          <div className="mt-1">
            <div className="text-base font-black text-amber-300 font-mono">
              {normalTotalKamasValue.toLocaleString('de-DE')} K
            </div>
            <div
              className={`text-xs font-mono font-bold ${
                normalNetProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {normalNetProfit >= 0 ? '+' : ''}{normalNetProfit.toLocaleString('de-DE')} K
            </div>
          </div>
        </div>

        {/* 4. Romper con Foco Óptimo */}
        <div className="bg-slate-950 border border-purple-500/30 rounded-xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-purple-300 tracking-wider flex items-center gap-1">
              <Target className="w-3.5 h-3.5" /> Foco Óptimo
            </span>
          </div>
          <div className="mt-1">
            <div className="text-base font-black text-purple-300 font-mono truncate">
              {bestValue.toLocaleString('de-DE')} K
            </div>
            <div className="flex items-center justify-between gap-1">
              <span
                className={`text-xs font-mono font-bold ${
                  bestProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {bestProfit >= 0 ? '+' : ''}{bestProfit.toLocaleString('de-DE')} K
              </span>
              <span className="text-[10px] text-purple-400 truncate font-semibold">
                {bestStratRuneName}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Break-even Status Bar */}
      <div
        className={`p-2.5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs transition-colors ${
          isAboveBreakEven
            ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
            : 'bg-amber-950/20 border-amber-500/30 text-amber-300'
        }`}
      >
        <div className="flex items-center gap-2">
          {isAboveBreakEven ? (
            <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          )}
          <span>
            {isAboveBreakEven
              ? `Rentable (+${coefficientPercent - breakEvenCoefficient}% sobre breakeven: ${breakEvenCoefficient}%)`
              : `No rentable (Mínimo requerido: ${breakEvenCoefficient}%)`}
          </span>
        </div>
        <div className="flex items-center gap-1 font-mono text-slate-400 shrink-0 text-[11px]">
          <Clock className="w-3.5 h-3.5" />
          <span>Guardado: {formatTimeAgoText(savedCoefficientTimestamp)}</span>
        </div>
      </div>
    </div>
  );
};
