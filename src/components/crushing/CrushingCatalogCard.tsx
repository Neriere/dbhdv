import React from 'react';
import { ShieldCheck, Percent, Sparkles, ChevronRight } from 'lucide-react';
import { SafeImage } from '../SafeImage';
import { RuneIcon } from '../RuneIcon';
import {
  CraftableItem,
  getItemName,
  getItemTypeName,
  getItemIconUrl,
  getItemFallbackIconUrl,
} from '../../services/dofusDbService';
import { ProcessedCatalogItem } from './types';
import {
  formatFullDate,
  formatTimeAgo,
} from './utils';

interface CrushingCatalogCardProps {
  entry: ProcessedCatalogItem;
  onOpenDetail: (item: CraftableItem) => void;
}

export const CrushingCatalogCard: React.FC<CrushingCatalogCardProps> = ({
  entry,
  onOpenDetail,
}) => {
  const item = entry.item;
  const itemName = getItemName(item);
  const iconUrl = getItemIconUrl(item);

  return (
    <div
      onClick={() => onOpenDetail(item)}
      className="bg-slate-900 border border-slate-800 hover:border-amber-500/60 rounded-2xl p-4 sm:p-4.5 transition-all cursor-pointer shadow-lg hover:shadow-amber-500/10 group flex flex-col justify-between gap-3.5"
    >
      {/* Top Identity Row */}
      <div className="flex items-start gap-3.5">
        <div className="w-14 h-14 rounded-xl bg-slate-950 border border-slate-800 p-1 flex items-center justify-center shrink-0 group-hover:border-amber-500/40 transition-colors shadow-inner">
          <SafeImage
            src={iconUrl}
            fallbackSrc={getItemFallbackIconUrl(item)}
            alt={itemName}
            className="w-12 h-12 object-contain"
          />
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <span className="font-black text-white text-base sm:text-lg leading-snug truncate group-hover:text-amber-400 transition-colors">
              {itemName}
            </span>
            <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-md bg-slate-950 text-amber-400 border border-slate-800 shrink-0">
              Nv. {entry.level}
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold px-2 py-0.5 rounded-md border bg-slate-950 text-slate-300 border-slate-800">
              {entry.jobNameEs}
            </span>
            {entry.hasCustomCoeff ? (
              <span
                className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                  entry.isManualEdit
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                }`}
                title={
                  entry.isManualEdit
                    ? `Editado manualmente (${formatFullDate(entry.coeffTimestamp)}) - Protegido contra DoFocus`
                    : `Sincronizado desde DoFocus (${formatFullDate(entry.coeffTimestamp)})`
                }
              >
                {entry.isManualEdit ? (
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Percent className="w-3.5 h-3.5 text-amber-400" />
                )}
                {entry.savedCoeff}%
                <span
                  className={`text-[11px] font-normal ${
                    entry.isManualEdit ? 'text-emerald-400/80' : 'text-amber-400/80'
                  }`}
                >
                  ({entry.isManualEdit ? 'Manual' : formatTimeAgo(entry.coeffTimestamp)})
                </span>
              </span>
            ) : (
              <span className="text-xs font-mono text-slate-400 px-2 py-0.5 bg-slate-950/60 rounded border border-slate-800">
                Coef: 100%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Target Rune Highlight (if specific rune is filtered) */}
      {entry.targetRuneYield && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5 flex items-center justify-between text-xs sm:text-sm font-mono">
          <div className="flex items-center gap-1.5 truncate">
            <RuneIcon rune={entry.targetRuneYield.rune} size="xs" />
            <span className="font-bold text-amber-300 truncate">
              {entry.targetRuneYield.rune.name}: ~{entry.runeSpecificRunes.toFixed(2)} runas
            </span>
          </div>
          <span className="font-black text-amber-400 shrink-0">
            {entry.runeSpecificKamas.toLocaleString()} K
          </span>
        </div>
      )}

      {/* Metrics 3-box Grid: Coste | Valor Runas | Ganancia */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 grid grid-cols-3 gap-2 text-center font-mono">
        <div>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
            Costo
          </span>
          <span className="text-sm sm:text-base font-bold text-slate-200">
            {entry.singleCraftCost > 0
              ? `${entry.singleCraftCost.toLocaleString()} K`
              : '---'}
          </span>
        </div>
        <div>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
            Runas
          </span>
          <span className="text-sm sm:text-base font-bold text-amber-300">
            {entry.maxKamasValue > 0
              ? `${entry.maxKamasValue.toLocaleString()} K`
              : '---'}
          </span>
        </div>
        <div>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
            Ganancia
          </span>
          <span
            className={`text-sm sm:text-base font-black block ${
              entry.maxProfit >= 0
                ? 'text-emerald-400'
                : 'text-rose-400'
            }`}
          >
            {entry.maxProfit > 0 ? '+' : ''}
            {entry.maxProfit.toLocaleString()} K
          </span>
        </div>
      </div>

      {/* Bottom Action Footer */}
      <div className="pt-0.5 flex items-center justify-between text-xs sm:text-sm text-amber-400 font-bold group-hover:translate-x-1 transition-transform">
        <div className="flex items-center gap-2 flex-wrap">
          {entry.maxRoi > 0 && (
            <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-xs font-mono border border-emerald-500/30 font-bold">
              +{entry.maxRoi.toFixed(0)}% ROI
            </span>
          )}
          {!entry.targetRuneYield && (
            <span
              className={`text-xs sm:text-sm flex items-center gap-1 font-semibold ${
                entry.bestStratIsNormal
                  ? 'text-amber-300'
                  : 'text-purple-300'
              }`}
            >
              <Sparkles
                className={`w-3.5 h-3.5 ${
                  entry.bestStratIsNormal
                    ? 'text-amber-400'
                    : 'text-purple-400'
                }`}
              />
              {entry.bestStratIsNormal
                ? 'Sin Foco'
                : `Foco: ${entry.bestFocusRune?.name.replace('Runa ', '')}`}
            </span>
          )}
        </div>
        <span className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-amber-400 group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors">
          <ChevronRight className="w-4 h-4" />
        </span>
      </div>
    </div>
  );
};
