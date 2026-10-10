import React from "react";
import { ItemPriceHistorySummary } from "../../types";
import { formatRelativeTime } from "../../services/dofusDbService";

interface PriceHistoryMetricsGridProps {
  data: ItemPriceHistorySummary;
}

export const PriceHistoryMetricsGrid: React.FC<PriceHistoryMetricsGridProps> = ({ data }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="bg-slate-950/80 border border-amber-500/30 rounded-2xl p-3 text-center">
        <span className="text-[10px] uppercase font-bold text-amber-400/80 block">
          Precio Actual
        </span>
        <div className="text-base sm:text-lg font-black text-amber-300 font-mono mt-0.5">
          {data.currentPrice > 0 ? `${data.currentPrice.toLocaleString("es-ES")} K` : "Sin precio"}
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
          {data.minPrice > 0 ? `${data.minPrice.toLocaleString("es-ES")} K` : "0 K"}
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
          {data.maxPrice > 0 ? `${data.maxPrice.toLocaleString("es-ES")} K` : "0 K"}
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
          {data.avgPrice > 0 ? `${data.avgPrice.toLocaleString("es-ES")} K` : "0 K"}
        </div>
        <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
          {data.totalChanges} cambios
        </span>
      </div>
    </div>
  );
};
