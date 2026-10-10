import React from "react";
import { Sparkles, History } from "lucide-react";
import { PriceHistoryEntry } from "../../types";
import { formatRelativeTime } from "../../services/dofusDbService";

interface PriceHistoryTrendChartProps {
  itemId: number;
  chartPoints: PriceHistoryEntry[];
  currentPrice: number;
  lastUpdatedAt: number;
  activePointIndex: number | null;
  setActivePointIndex: (idx: number | null) => void;
}

export const PriceHistoryTrendChart: React.FC<PriceHistoryTrendChartProps> = ({
  itemId,
  chartPoints,
  currentPrice,
  lastUpdatedAt,
  activePointIndex,
  setActivePointIndex,
}) => {
  const width = 600;
  const height = 120;
  const padding = 20;

  if (!chartPoints || chartPoints.length === 0) {
    if (currentPrice > 0) {
      return (
        <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Precio fijado actual:{" "}
              <strong className="text-amber-300 font-mono font-black">
                {currentPrice.toLocaleString("es-ES")} K
              </strong>
            </span>
          </div>
          <span className="text-[11px] font-mono text-slate-500">
            Registrado {lastUpdatedAt ? formatRelativeTime(lastUpdatedAt) : "recientemente"}
          </span>
        </div>
      );
    }
    return (
      <div className="h-28 flex flex-col items-center justify-center text-slate-500 text-xs gap-1.5 border border-dashed border-slate-800 rounded-xl bg-slate-950/40">
        <History className="w-5 h-5 text-slate-600" />
        <span>Sin registros de precio para este objeto.</span>
      </div>
    );
  }

  // If only 1 recorded point
  if (chartPoints.length === 1) {
    const singlePoint = chartPoints[0];
    const hasOldPrice = singlePoint.oldPrice > 0 && singlePoint.price !== singlePoint.oldPrice;

    if (!hasOldPrice) {
      return (
        <div className="relative bg-slate-950/70 border border-slate-800 rounded-2xl p-4 overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="flex items-center gap-1.5 font-bold">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Precio de Referencia Inicial
            </span>
            <span className="font-mono text-[11px] text-slate-500">
              {new Date(singlePoint.timestamp).toLocaleDateString("es-ES")}
            </span>
          </div>
          <div className="h-20 flex items-center justify-between px-6 bg-slate-900/50 border border-slate-800/80 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
              <span className="text-xs text-slate-300 font-mono font-bold">
                {singlePoint.price.toLocaleString("es-ES")} Kamas
              </span>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              Registrado {formatRelativeTime(singlePoint.timestamp)} ({singlePoint.source || "manual"})
            </span>
          </div>
        </div>
      );
    }
  }

  const minPrice = Math.min(...chartPoints.map((p) => p.price));
  const maxPrice = Math.max(...chartPoints.map((p) => p.price));
  const isFlat = maxPrice === minPrice;
  const priceRange = maxPrice - minPrice || 1;

  const coords = chartPoints.map((p, idx) => {
    const x = padding + (idx / Math.max(1, chartPoints.length - 1)) * (width - padding * 2);
    const y = isFlat
      ? height / 2
      : height - padding - ((p.price - minPrice) / priceRange) * (height - padding * 2);
    return { x, y, point: p };
  });

  const pointsStr = coords.map((c) => `${c.x},${c.y}`).join(" ");
  const firstCoord = coords[0];
  const lastCoord = coords[coords.length - 1];
  const areaStr = `${pointsStr} ${lastCoord.x},${height} ${firstCoord.x},${height}`;

  const isPriceIncreasing = lastCoord.point.price >= firstCoord.point.price;
  const strokeColor = isFlat ? "#38bdf8" : isPriceIncreasing ? "#10b981" : "#f43f5e";
  const gradientId = `chartGrad_${itemId}`;

  return (
    <div className="relative bg-slate-950/70 border border-slate-800 rounded-2xl p-4 overflow-hidden">
      <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
        <span className="flex items-center gap-1.5 font-bold">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Tendencia Histórica ({chartPoints.length} puntos)
          {isFlat && (
            <span className="ml-1 px-1.5 py-0.2 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30 text-[10px]">
              Precio Estable
            </span>
          )}
        </span>
        <span className="font-mono text-[11px] text-slate-500">
          {new Date(chartPoints[0].timestamp).toLocaleDateString("es-ES")} —{" "}
          {new Date(chartPoints[chartPoints.length - 1].timestamp).toLocaleDateString("es-ES")}
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
        <line
          x1={padding}
          y1={padding}
          x2={width - padding}
          y2={padding}
          stroke="#334155"
          strokeDasharray="3 3"
          strokeOpacity="0.4"
        />
        <line
          x1={padding}
          y1={height / 2}
          x2={width - padding}
          y2={height / 2}
          stroke="#334155"
          strokeDasharray="3 3"
          strokeOpacity="0.4"
        />
        <line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          stroke="#334155"
          strokeDasharray="3 3"
          strokeOpacity="0.4"
        />

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
          <g
            key={idx}
            className="cursor-pointer group"
            onMouseEnter={() => setActivePointIndex(idx)}
            onMouseLeave={() => setActivePointIndex(null)}
          >
            <circle
              cx={c.x}
              cy={c.y}
              r={activePointIndex === idx ? 6 : 4}
              fill={activePointIndex === idx ? "#f59e0b" : strokeColor}
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
            {new Date(coords[activePointIndex].point.timestamp).toLocaleString("es-ES")}:
          </span>
          <strong className="text-amber-300 font-black">
            {coords[activePointIndex].point.price.toLocaleString("es-ES")} Kamas
          </strong>
          {coords[activePointIndex].point.difference !== 0 && (
            <span
              className={`text-[11px] font-bold ${
                coords[activePointIndex].point.difference > 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              ({coords[activePointIndex].point.difference > 0 ? "+" : ""}
              {coords[activePointIndex].point.difference.toLocaleString("es-ES")} K)
            </span>
          )}
        </div>
      )}
    </div>
  );
};
