import React from 'react';
import {
  Coins,
  Info,
  ArrowUpDown,
  Edit2,
  Check,
  X,
} from 'lucide-react';
import { getItemIconUrl } from '../../services/dofusDbService';
import {
  ProcessedScrollItem,
  SortFieldScroll,
  getStatBadgeClass,
} from './types';

interface ScrollsTableViewProps {
  filteredScrolls: ProcessedScrollItem[];
  topProfitScroll: ProcessedScrollItem | undefined;
  topVolumeScroll: ProcessedScrollItem | undefined;
  tourmalineRatio: number;
  editingPriceId: number | null;
  tempPriceValue: string;
  sortField: SortFieldScroll;
  sortAsc: boolean;
  onSetSortField: (field: SortFieldScroll) => void;
  onSetSortAsc: (asc: boolean) => void;
  onStartEditingPrice: (id: number, currentPrice: number) => void;
  onChangeTempPrice: (val: string) => void;
  onSavePrice: (id: number) => void;
  onCancelEditPrice: () => void;
  onOpenSalesVolume: (scroll: ProcessedScrollItem) => void;
}

export const ScrollsTableView: React.FC<ScrollsTableViewProps> = ({
  filteredScrolls,
  topProfitScroll,
  topVolumeScroll,
  tourmalineRatio,
  editingPriceId,
  tempPriceValue,
  sortField,
  sortAsc,
  onSetSortField,
  onSetSortAsc,
  onStartEditingPrice,
  onChangeTempPrice,
  onSavePrice,
  onCancelEditPrice,
  onOpenSalesVolume,
}) => {
  const handleSortToggle = (field: SortFieldScroll) => {
    if (sortField === field) {
      onSetSortAsc(!sortAsc);
    } else {
      onSetSortField(field);
      onSetSortAsc(false);
    }
  };

  return (
    <div className="bg-slate-900/70 border border-slate-800/90 rounded-2xl overflow-hidden shadow-lg">
      <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Coins className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-bold text-slate-200">
            Ranking de Rentabilidad y Salida de Pergaminos
          </h2>
          <span className="text-xs text-slate-500 font-mono">
            ({filteredScrolls.length} ítems)
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Info className="w-3.5 h-3.5 text-amber-500" />
          <span>Haz clic en un precio o venta para editarlo directamente</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-semibold uppercase text-[10px] tracking-wider">
            <tr>
              <th className="py-3 px-4">
                <button
                  onClick={() => handleSortToggle('name')}
                  className="flex items-center gap-1 hover:text-slate-200"
                >
                  Pergamino / Recurso <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="py-3 px-3 text-center">Stat & Límite</th>
              <th className="py-3 px-3 text-right">
                <button
                  onClick={() => handleSortToggle('sebuscalines')}
                  className="flex items-center gap-1 ml-auto hover:text-slate-200"
                >
                  Coste Seb. <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="py-3 px-3 text-right">
                <button
                  onClick={() => handleSortToggle('price')}
                  className="flex items-center gap-1 ml-auto hover:text-slate-200"
                >
                  Precio Mercadillo <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="py-3 px-3 text-right">
                <button
                  onClick={() => handleSortToggle('ratio')}
                  className="flex items-center gap-1 ml-auto text-amber-400 font-bold hover:text-amber-300"
                >
                  Kamas / Seb. <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="py-3 px-3 text-center">vs Turmalina</th>
              <th className="py-3 px-3 text-center">
                <button
                  onClick={() => {
                    if (sortField === 'sales24h') {
                      onSetSortField('avgDailySales');
                    } else {
                      onSetSortField('sales24h');
                    }
                    onSetSortAsc(!sortAsc);
                  }}
                  className="flex items-center gap-1 mx-auto hover:text-slate-200"
                  title="Haz clic para ordenar por ventas registradas (24h) o ritmo diario"
                >
                  Ventas 24h / 7d / 30d <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="py-3 px-4 text-right">
                <button
                  onClick={() => handleSortToggle('profitDaily')}
                  className="flex items-center gap-1 ml-auto text-emerald-400 font-bold hover:text-emerald-300"
                >
                  Profit Diario Est. <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredScrolls.map((scroll, index) => {
              const isTopRatio =
                topProfitScroll && scroll.id === topProfitScroll.id;
              const isTopVolume =
                topVolumeScroll && scroll.id === topVolumeScroll.id;

              return (
                <tr
                  key={scroll.id}
                  className={`hover:bg-slate-800/40 transition-colors ${
                    scroll.isSpecial ? 'bg-teal-950/20' : ''
                  }`}
                >
                  {/* Ítem y nombre */}
                  <td className="py-3 px-4 flex items-center gap-3">
                    <span className="text-slate-600 font-mono text-[11px] w-5 text-right">
                      #{index + 1}
                    </span>
                    <img
                      src={getItemIconUrl(scroll.iconId)}
                      alt={scroll.name}
                      className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-800 object-contain"
                    />
                    <div className="min-w-0">
                      <div className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                        {scroll.name}
                        {scroll.isSpecial && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30">
                            Especial
                          </span>
                        )}
                        {isTopRatio && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                            🥇 Max K/Seb
                          </span>
                        )}
                        {isTopVolume && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 font-bold">
                            ⚡ Max Salida
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 capitalize">
                        Tier: {scroll.tier} • ID: {scroll.id}
                      </div>
                    </div>
                  </td>

                  {/* Stat & Límite */}
                  <td className="py-3 px-3 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold border ${getStatBadgeClass(
                        scroll.stat
                      )}`}
                    >
                      {scroll.stat}{' '}
                      {scroll.maxStatLimit > 0 ? `(≤ ${scroll.maxStatLimit})` : ''}
                    </span>
                  </td>

                  {/* Coste Sebuscalines */}
                  <td className="py-3 px-3 text-right font-mono font-bold text-slate-300">
                    {scroll.sebuscalines.toLocaleString()}{' '}
                    <span className="text-[10px] text-slate-500">Seb</span>
                  </td>

                  {/* Precio Mercadillo (Editable) */}
                  <td className="py-3 px-3 text-right">
                    {editingPriceId === scroll.id ? (
                      <div className="flex items-center justify-end gap-1">
                        <input
                          type="number"
                          value={tempPriceValue}
                          onChange={(e) => onChangeTempPrice(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') onSavePrice(scroll.id);
                            if (e.key === 'Escape') onCancelEditPrice();
                          }}
                          className="w-24 px-1.5 py-1 text-right rounded bg-slate-950 border border-amber-500 text-xs font-mono font-bold text-slate-100"
                          autoFocus
                        />
                        <button
                          onClick={() => onSavePrice(scroll.id)}
                          className="p-1 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={onCancelEditPrice}
                          className="p-1 rounded bg-slate-800 text-slate-400 hover:bg-slate-700"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={() =>
                          onStartEditingPrice(scroll.id, scroll.price)
                        }
                        className="cursor-pointer group flex items-center justify-end gap-1 text-slate-200 hover:text-amber-400 transition-colors"
                        title="Haz clic para modificar el precio"
                      >
                        <span className="font-mono font-bold">
                          {scroll.price > 0
                            ? `${scroll.price.toLocaleString()} K`
                            : 'Sin precio'}
                        </span>
                        <Edit2 className="w-3 h-3 text-slate-600 group-hover:text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    )}
                  </td>

                  {/* Ratio Kamas / Sebuscalín */}
                  <td className="py-3 px-3 text-right font-mono font-black text-sm">
                    <span
                      className={
                        scroll.ratio >= tourmalineRatio * 1.1
                          ? 'text-emerald-400'
                          : scroll.ratio >= tourmalineRatio
                          ? 'text-amber-400'
                          : 'text-slate-400'
                      }
                    >
                      {scroll.ratio.toLocaleString()}{' '}
                      <span className="text-[10px] text-slate-500 font-normal">
                        K/s
                      </span>
                    </span>
                  </td>

                  {/* Comparativa vs Turmalina */}
                  <td className="py-3 px-3 text-center font-mono text-xs">
                    {scroll.isSpecial ? (
                      <span className="text-teal-400 font-bold">Referencia</span>
                    ) : scroll.vsTourmalinePct > 0 ? (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                        +{scroll.vsTourmalinePct}%
                      </span>
                    ) : scroll.vsTourmalinePct < 0 ? (
                      <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 font-bold border border-rose-500/20">
                        {scroll.vsTourmalinePct}%
                      </span>
                    ) : (
                      <span className="text-slate-500">0%</span>
                    )}
                  </td>

                  {/* Ventas 24h / 7d / 30d */}
                  <td className="py-2 px-3 text-center font-mono">
                    <div
                      onClick={() => onOpenSalesVolume(scroll)}
                      className="cursor-pointer group inline-flex flex-col items-center justify-center px-2.5 py-1 rounded-xl hover:bg-slate-800/80 transition-all border border-transparent hover:border-slate-700"
                      title="Haz clic para registrar o editar ventas en 24 horas, 7 días y 30 días"
                    >
                      <div className="flex items-center gap-1 font-mono text-xs font-semibold">
                        <span
                          className={
                            scroll.sales24h > 0
                              ? 'text-cyan-300 font-bold'
                              : 'text-slate-500'
                          }
                        >
                          {scroll.sales24h}
                        </span>
                        <span className="text-slate-600">/</span>
                        <span
                          className={
                            scroll.sales7d > 0
                              ? 'text-sky-300 font-bold'
                              : 'text-slate-500'
                          }
                        >
                          {scroll.sales7d}
                        </span>
                        <span className="text-slate-600">/</span>
                        <span
                          className={
                            scroll.sales30d > 0
                              ? 'text-indigo-300 font-bold'
                              : 'text-slate-500'
                          }
                        >
                          {scroll.sales30d}
                        </span>
                        <Edit2 className="w-2.5 h-2.5 text-slate-500 group-hover:text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
                      </div>
                      {scroll.avgDailySales > 0 ? (
                        <span className="text-[10px] text-emerald-400 font-mono font-medium">
                          ~{scroll.avgDailySales.toFixed(1)}/día
                        </span>
                      ) : (
                        <span className="text-[9px] text-slate-600 font-mono">
                          0/día
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Profit Diario Estimado */}
                  <td className="py-3 px-4 text-right font-mono font-black text-emerald-400 text-xs">
                    {scroll.profitDaily > 0 ? (
                      `${scroll.profitDaily.toLocaleString()} K`
                    ) : (
                      <span className="text-slate-600">--</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
