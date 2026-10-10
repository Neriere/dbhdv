import React from 'react';
import { Map as MapIcon, Coins, FileSpreadsheet } from 'lucide-react';
import { CalculatedHunt } from './types';

interface TreasureHuntHeroBannerProps {
  sebuscalinPrice: number;
  onOpenRatesModal: () => void;
  onOpenExcelModal: () => void;
  totalHuntsCount: number;
  profitableHuntsCount: number;
  highestProfitHunt: CalculatedHunt | undefined;
}

export const TreasureHuntHeroBanner: React.FC<
  TreasureHuntHeroBannerProps
> = ({
  sebuscalinPrice,
  onOpenRatesModal,
  onOpenExcelModal,
  totalHuntsCount,
  profitableHuntsCount,
  highestProfitHunt,
}) => {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-amber-950/20 to-slate-900 border border-amber-500/20 p-4 sm:p-5 shadow-lg">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shadow-inner shrink-0">
              <MapIcon className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-100 tracking-tight flex items-center gap-2">
                Búsquedas del Tesoro & Busca y Captura (ByC)
              </h1>
            </div>
          </div>
        </div>

        {/* Quick Rates Button & Status */}
        <div className="flex items-center gap-2 bg-slate-950/90 p-2 rounded-xl border border-slate-800 shrink-0 self-start md:self-auto">
          <div className="flex items-center gap-2 text-xs font-mono px-2">
            <span className="text-slate-400">Valor Sebuscalín:</span>
            <span className="text-amber-400 font-bold">
              {sebuscalinPrice} K
            </span>
          </div>

          <button
            type="button"
            onClick={onOpenRatesModal}
            className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Coins className="w-3.5 h-3.5" />
            Editar Cotización
          </button>

          <button
            type="button"
            onClick={onOpenExcelModal}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/40 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-emerald-950/40 cursor-pointer"
            title="Exportar Plan de Inversión Grupal (.xlsx)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Exportar Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Global Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3.5 border-t border-slate-800/80">
        <div className="px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <span className="text-xs text-slate-400 block font-medium">
            Total Cacerías
          </span>
          <span className="text-lg sm:text-xl font-bold text-slate-200">
            {totalHuntsCount}
          </span>
        </div>

        <div className="px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <span className="text-xs text-slate-400 block font-medium">
            Cacerías Rentables
          </span>
          <span className="text-lg sm:text-xl font-bold text-emerald-400">
            {profitableHuntsCount}{' '}
            <span className="text-xs text-slate-400 font-normal">
              ({totalHuntsCount > 0 ? Math.round((profitableHuntsCount / totalHuntsCount) * 100) : 0}%)
            </span>
          </span>
        </div>

        <div className="px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 col-span-2">
          <span className="text-xs text-slate-400 block font-medium">
            Cacería Top Más Rentable
          </span>
          {highestProfitHunt ? (
            <div className="flex items-center justify-between gap-2 mt-0.5">
              <span className="text-sm font-bold text-amber-300 truncate">
                {highestProfitHunt.monsterName} (Nv{' '}
                {highestProfitHunt.monsterLevel})
              </span>
              <span className="text-sm font-bold text-emerald-400 font-mono shrink-0">
                +{highestProfitHunt.netProfit.toLocaleString()} K (
                {Math.round(highestProfitHunt.roiPercent)}% ROI)
              </span>
            </div>
          ) : (
            <span className="text-sm text-slate-500">-</span>
          )}
        </div>
      </div>
    </div>
  );
};
