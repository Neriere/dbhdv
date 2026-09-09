import React, { useEffect, useState } from 'react';
import {
  X,
  TrendingUp,
  TrendingDown,
  History,
  RotateCcw,
  Calendar,
  Layers,
  ArrowRight,
  Sparkles,
  Loader2,
  AlertCircle,
  Coins,
} from 'lucide-react';
import { DofusItem, ItemPriceHistorySummary, PriceHistoryEntry } from '../types';
import {
  fetchItemPriceHistory,
  revertPriceHistory,
  formatRelativeTime,
  getItemIconUrl,
  getItemFallbackIconUrl,
  getItemName,
  getItemTypeName,
} from '../services/dofusDbService';

interface ItemPriceHistoryModalProps {
  item: DofusItem | null;
  isOpen: boolean;
  onClose: () => void;
  onPriceChanged?: () => void;
}

export const ItemPriceHistoryModal: React.FC<ItemPriceHistoryModalProps> = ({
  item,
  isOpen,
  onClose,
  onPriceChanged,
}) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ItemPriceHistorySummary | null>(null);
  const [revertingId, setRevertingId] = useState<number | null>(null);
  const [activePointIndex, setActivePointIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen || !item) {
      setData(null);
      return;
    }

    let isMounted = true;
    setLoading(true);

    fetchItemPriceHistory(item.id)
      .then((summary) => {
        if (isMounted) {
          setData(summary);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Error fetching item price history:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, item]);

  if (!isOpen || !item) return null;

  const handleRevert = async (entry: PriceHistoryEntry) => {
    if (revertingId) return;
    try {
      setRevertingId(entry.id);
      await revertPriceHistory(entry.id);
      // Reload history
      const updated = await fetchItemPriceHistory(item.id);
      setData(updated);
      if (onPriceChanged) onPriceChanged();
    } catch (err) {
      console.error('Error al revertir precio:', err);
      alert('No se pudo revertir el precio.');
    } finally {
      setRevertingId(null);
    }
  };

  const historyEntries = data ? [...data.history].reverse() : [];
  const chartPoints = data?.history || [];

  // Generate SVG path for the price trend
  const renderSvgChart = () => {
    if (!chartPoints || chartPoints.length < 2) {
      return (
        <div className="h-32 flex flex-col items-center justify-center text-slate-500 text-xs gap-1.5 border border-dashed border-slate-800 rounded-xl bg-slate-950/40">
          <History className="w-5 h-5 text-slate-600" />
          <span>Se necesitan al menos 2 registros para trazar la tendencia visual.</span>
        </div>
      );
    }

    const width = 600;
    const height = 120;
    const padding = 20;

    const minPrice = Math.min(...chartPoints.map((p) => p.price));
    const maxPrice = Math.max(...chartPoints.map((p) => p.price));
    const priceRange = maxPrice - minPrice || 1;

    const coords = chartPoints.map((p, idx) => {
      const x = padding + (idx / (chartPoints.length - 1)) * (width - padding * 2);
      const y = height - padding - ((p.price - minPrice) / priceRange) * (height - padding * 2);
      return { x, y, point: p };
    });

    const pointsStr = coords.map((c) => `${c.x},${c.y}`).join(' ');
    const firstCoord = coords[0];
    const lastCoord = coords[coords.length - 1];
    const areaStr = `${pointsStr} ${lastCoord.x},${height} ${firstCoord.x},${height}`;

    const isPriceIncreasing = lastCoord.point.price >= firstCoord.point.price;
    const strokeColor = isPriceIncreasing ? '#10b981' : '#f43f5e';
    const gradientId = `chartGrad_${item.id}`;

    return (
      <div className="relative bg-slate-950/70 border border-slate-800 rounded-2xl p-4 overflow-hidden">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
          <span className="flex items-center gap-1.5 font-bold">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Tendencia Histórica ({chartPoints.length} puntos)
          </span>
          <span className="font-mono text-[11px] text-slate-500">
            {new Date(chartPoints[0].timestamp).toLocaleDateString('es-ES')} — {new Date(chartPoints[chartPoints.length - 1].timestamp).toLocaleDateString('es-ES')}
          </span>
        </div>

        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-32 overflow-visible">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity="0.3" />
              <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="#334155" strokeDasharray="3 3" strokeOpacity="0.4" />
          <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="#334155" strokeDasharray="3 3" strokeOpacity="0.4" />
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#334155" strokeDasharray="3 3" strokeOpacity="0.4" />

          {/* Area Fill */}
          <polygon points={areaStr} fill={`url(#${gradientId})`} />

          {/* Main Line */}
          <polyline
            fill="none"
            stroke={strokeColor}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={pointsStr}
          />

          {/* Dots */}
          {coords.map((c, idx) => (
            <g key={idx} className="cursor-pointer group" onMouseEnter={() => setActivePointIndex(idx)} onMouseLeave={() => setActivePointIndex(null)}>
              <circle
                cx={c.x}
                cy={c.y}
                r={activePointIndex === idx ? 6 : 4}
                fill={activePointIndex === idx ? '#f59e0b' : strokeColor}
                stroke="#0f172a"
                strokeWidth="2"
                className="transition-all"
              />
            </g>
          ))}
        </svg>

        {/* Hover info tooltip */}
        {activePointIndex !== null && coords[activePointIndex] && (
          <div className="mt-2 text-center text-xs font-mono bg-slate-900 border border-slate-700 py-1.5 px-3 rounded-xl shadow-lg flex items-center justify-center gap-3">
            <span className="text-slate-400">
              {new Date(coords[activePointIndex].point.timestamp).toLocaleString('es-ES')}:
            </span>
            <strong className="text-amber-300 font-black">
              {coords[activePointIndex].point.price.toLocaleString('es-ES')} Kamas
            </strong>
            {coords[activePointIndex].point.difference !== 0 && (
              <span className={`text-[11px] font-bold ${coords[activePointIndex].point.difference > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                ({coords[activePointIndex].point.difference > 0 ? '+' : ''}{coords[activePointIndex].point.difference.toLocaleString('es-ES')} K)
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-5 animate-in fade-in duration-200">
      <div
        className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 p-1 shrink-0 flex items-center justify-center relative">
              <img
                src={getItemIconUrl(item)}
                alt={getItemName(item)}
                className="max-w-full max-h-full object-contain"
                onError={(e) => {
                  const target = e.currentTarget;
                  const fallback = getItemFallbackIconUrl(item);
                  if (target.src !== fallback) target.src = fallback;
                }}
              />
              {item.level && (
                <span className="absolute -bottom-1 -right-1 px-1.5 py-0.2 bg-slate-900 border border-slate-700 text-[10px] font-mono text-amber-400 rounded-md font-bold shadow">
                  Nv.{item.level}
                </span>
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-white truncate">
                  {getItemName(item)}
                </h3>
                <span className="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 font-bold">
                  {getItemTypeName(item)}
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                <History className="w-3.5 h-3.5 text-amber-400" />
                Historial de Precios y Modificaciones
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
              <span className="text-xs font-semibold">Cargando registros históricos...</span>
            </div>
          ) : !data ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <AlertCircle className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-sm">No se encontraron registros de precios para este objeto.</p>
            </div>
          ) : (
            <>
              {/* Metric Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-950/80 border border-amber-500/30 rounded-2xl p-3 text-center">
                  <span className="text-[10px] uppercase font-bold text-amber-400/80 block">
                    Precio Actual
                  </span>
                  <div className="text-base sm:text-lg font-black text-amber-300 font-mono mt-0.5">
                    {data.currentPrice > 0 ? `${data.currentPrice.toLocaleString('es-ES')} K` : 'Sin precio'}
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                    {formatRelativeTime(data.lastUpdatedAt)}
                  </span>
                </div>

                <div className="bg-slate-950/80 border border-emerald-500/20 rounded-2xl p-3 text-center">
                  <span className="text-[10px] uppercase font-bold text-emerald-400/80 block">
                    Mínimo Histórico
                  </span>
                  <div className="text-base sm:text-lg font-black text-emerald-400 font-mono mt-0.5">
                    {data.minPrice > 0 ? `${data.minPrice.toLocaleString('es-ES')} K` : '0 K'}
                  </div>
                  <span className="text-[10px] text-emerald-500/70 font-mono block mt-0.5">
                    Mejor compra
                  </span>
                </div>

                <div className="bg-slate-950/80 border border-rose-500/20 rounded-2xl p-3 text-center">
                  <span className="text-[10px] uppercase font-bold text-rose-400/80 block">
                    Máximo Histórico
                  </span>
                  <div className="text-base sm:text-lg font-black text-rose-400 font-mono mt-0.5">
                    {data.maxPrice > 0 ? `${data.maxPrice.toLocaleString('es-ES')} K` : '0 K'}
                  </div>
                  <span className="text-[10px] text-rose-500/70 font-mono block mt-0.5">
                    Pico máximo
                  </span>
                </div>

                <div className="bg-slate-950/80 border border-cyan-500/20 rounded-2xl p-3 text-center">
                  <span className="text-[10px] uppercase font-bold text-cyan-400/80 block">
                    Precio Promedio
                  </span>
                  <div className="text-base sm:text-lg font-black text-cyan-300 font-mono mt-0.5">
                    {data.avgPrice > 0 ? `${data.avgPrice.toLocaleString('es-ES')} K` : '0 K'}
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                    {data.totalChanges} cambios
                  </span>
                </div>
              </div>

              {/* Interactive Trend Chart */}
              {renderSvgChart()}

              {/* History Timeline Entries */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-amber-400" />
                    Registro Cronológico de Cambios ({historyEntries.length})
                  </h4>
                </div>

                {historyEntries.length === 0 ? (
                  <div className="bg-slate-950/50 border border-slate-800/80 rounded-2xl p-6 text-center text-slate-500 text-xs">
                    Solo existe el precio actual ({data.currentPrice.toLocaleString('es-ES')} K). Cada modificación que hagas quedará registrada aquí automáticamente.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {historyEntries.map((entry) => {
                      const isUp = entry.difference > 0;
                      const isDown = entry.difference < 0;
                      const isReverting = revertingId === entry.id;

                      return (
                        <div
                          key={entry.id}
                          className="bg-slate-950 border border-slate-800/80 hover:border-slate-700 rounded-xl p-3 flex items-center justify-between gap-3 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                isUp
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                  : isDown
                                  ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                  : 'bg-slate-900 text-slate-400 border border-slate-800'
                              }`}
                            >
                              {isUp ? (
                                <TrendingUp className="w-4 h-4" />
                              ) : isDown ? (
                                <TrendingDown className="w-4 h-4" />
                              ) : (
                                <Coins className="w-4 h-4" />
                              )}
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs text-slate-400">
                                  {entry.oldPrice.toLocaleString('es-ES')} K
                                </span>
                                <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />
                                <span className="font-mono text-sm font-black text-amber-300">
                                  {entry.price.toLocaleString('es-ES')} K
                                </span>

                                {entry.difference !== 0 && (
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                                      isUp
                                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                        : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                    }`}
                                  >
                                    {isUp ? '+' : ''}
                                    {entry.difference.toLocaleString('es-ES')} K ({isUp ? '+' : ''}
                                    {entry.percentageChange}%)
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                                <span>{formatRelativeTime(entry.timestamp)}</span>
                                <span>•</span>
                                <span className="text-slate-400">
                                  {new Date(entry.timestamp).toLocaleTimeString('es-ES', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                                {entry.source && entry.source !== 'manual' && (
                                  <>
                                    <span>•</span>
                                    <span className="capitalize px-1.5 py-0.2 bg-slate-900 rounded text-[10px] text-slate-400 border border-slate-800">
                                      {entry.source}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Revert Button */}
                          {entry.oldPrice > 0 && entry.price !== entry.oldPrice && (
                            <button
                              disabled={isReverting}
                              onClick={() => handleRevert(entry)}
                              className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-amber-500/20 border border-slate-800 hover:border-amber-500/40 text-slate-400 hover:text-amber-300 text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 disabled:opacity-50"
                              title={`Revertir precio a ${entry.oldPrice.toLocaleString('es-ES')} K`}
                            >
                              {isReverting ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                              ) : (
                                <RotateCcw className="w-3.5 h-3.5" />
                              )}
                              <span className="hidden sm:inline">Revertir</span>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-500">
          <span>Los cambios de precios se sincronizan automáticamente con tu perfil activo.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
