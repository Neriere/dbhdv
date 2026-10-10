import React from 'react';
import { Award, Gem, Flame, BarChart2 } from 'lucide-react';
import { getItemIconUrl } from '../../services/dofusDbService';
import { ProcessedScrollItem } from './types';

interface ScrollsTabKpiBarProps {
  topProfitScroll: ProcessedScrollItem | undefined;
  tourmalinePrice: number;
  tourmalineRatio: number;
  topVolumeScroll: ProcessedScrollItem | undefined;
  avgMarketRatio: number;
}

export const ScrollsTabKpiBar: React.FC<ScrollsTabKpiBarProps> = ({
  topProfitScroll,
  tourmalinePrice,
  tourmalineRatio,
  topVolumeScroll,
  avgMarketRatio,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
      {/* Top Profit Scroll */}
      <div className="bg-slate-900/80 border border-slate-800/80 hover:border-amber-500/40 rounded-xl p-4 transition-all shadow-sm">
        <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
          <span className="flex items-center gap-1.5 text-amber-400">
            <Award className="w-4 h-4" /> Top Rentabilidad Hoy
          </span>
          <span className="font-mono text-emerald-400">
            +{topProfitScroll?.vsTourmalinePct || 0}% vs Turm.
          </span>
        </div>
        <div className="flex items-center gap-3 mt-2">
          <img
            src={getItemIconUrl(topProfitScroll?.iconId || 0)}
            alt={topProfitScroll?.name}
            className="w-10 h-10 rounded-lg bg-slate-950 border border-slate-800 object-contain"
          />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-slate-100 truncate">
              {topProfitScroll?.name || 'Cargando...'}
            </div>
            <div className="text-lg font-black text-amber-400 font-mono">
              {(topProfitScroll?.ratio || 0).toLocaleString()}{' '}
              <span className="text-xs text-slate-400 font-normal">K / Seb</span>
            </div>
          </div>
        </div>
      </div>

      {/* Turmalina Referencia */}
      <div className="bg-slate-900/80 border border-slate-800/80 hover:border-teal-500/40 rounded-xl p-4 transition-all shadow-sm">
        <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
          <span className="flex items-center gap-1.5 text-teal-400">
            <Gem className="w-4 h-4" /> Turmalina (Activo Seguro)
          </span>
          <span className="font-mono text-slate-400">200 Seb.</span>
        </div>
        <div className="flex items-center gap-3 mt-2">
          <img
            src={getItemIconUrl(15271)}
            alt="Turmalina"
            className="w-10 h-10 rounded-lg bg-slate-950 border border-slate-800 object-contain"
          />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-slate-100 truncate">
              Turmalina
            </div>
            <div className="text-lg font-black text-teal-300 font-mono">
              {Math.round(tourmalineRatio).toLocaleString()}{' '}
              <span className="text-xs text-slate-400 font-normal">
                K / Seb ({tourmalinePrice.toLocaleString()} K)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Mayor Salida / Rotación */}
      <div className="bg-slate-900/80 border border-slate-800/80 hover:border-sky-500/40 rounded-xl p-4 transition-all shadow-sm">
        <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
          <span className="flex items-center gap-1.5 text-sky-400">
            <Flame className="w-4 h-4" /> Mayor Salida / Rotación
          </span>
          <span className="font-mono text-sky-300">
            {topVolumeScroll
              ? topVolumeScroll.sales24h > 0
                ? `${topVolumeScroll.sales24h} en 24h`
                : `~${topVolumeScroll.avgDailySales.toFixed(1)}/día`
              : '0 uds'}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-2">
          <img
            src={getItemIconUrl(topVolumeScroll?.iconId || 0)}
            alt={topVolumeScroll?.name}
            className="w-10 h-10 rounded-lg bg-slate-950 border border-slate-800 object-contain"
          />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-slate-100 truncate">
              {topVolumeScroll?.name || 'Sin datos recientes'}
            </div>
            <div className="text-lg font-black text-slate-200 font-mono">
              {(topVolumeScroll?.price || 0).toLocaleString()}{' '}
              <span className="text-xs text-slate-400 font-normal">
                Kamas / ud
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Promedio de Mercado */}
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 transition-all shadow-sm">
        <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
          <span className="flex items-center gap-1.5 text-purple-400">
            <BarChart2 className="w-4 h-4" /> Promedio Mercado
          </span>
          <span className="font-mono text-slate-500">24 pergaminos</span>
        </div>
        <div className="mt-2">
          <div className="text-2xl font-black text-purple-300 font-mono">
            {avgMarketRatio.toLocaleString()}{' '}
            <span className="text-xs text-slate-400 font-normal">
              Kamas / Sebuscalín
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Vender por encima de esta cifra maximiza el rendimiento de tus
            sebuscalines
          </p>
        </div>
      </div>
    </div>
  );
};
