import React from "react";
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  Coins,
  ArrowRight,
  RotateCcw,
  Loader2,
} from "lucide-react";
import { PriceHistoryEntry } from "../../types";
import { formatRelativeTime } from "../../services/dofusDbService";

interface PriceHistoryTimelineProps {
  historyEntries: PriceHistoryEntry[];
  currentPrice: number;
  revertingId: number | null;
  onRevert: (entry: PriceHistoryEntry) => void;
}

export const PriceHistoryTimeline: React.FC<PriceHistoryTimelineProps> = ({
  historyEntries,
  currentPrice,
  revertingId,
  onRevert,
}) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-amber-400" />
          Registro Cronológico de Cambios ({historyEntries.length})
        </h4>
      </div>

      {historyEntries.length === 0 ? (
        <div className="bg-slate-950/50 border border-slate-800/80 rounded-2xl p-6 text-center text-slate-500 text-xs">
          Solo existe el precio actual ({currentPrice.toLocaleString("es-ES")} K). Cada modificación que hagas quedará registrada aquí automáticamente.
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
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                        : isDown
                        ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                        : "bg-slate-900 text-slate-400 border border-slate-800"
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
                        {entry.oldPrice.toLocaleString("es-ES")} K
                      </span>
                      <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />
                      <span className="font-mono text-sm font-black text-amber-300">
                        {entry.price.toLocaleString("es-ES")} K
                      </span>

                      {entry.difference !== 0 && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                            isUp
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                              : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                          }`}
                        >
                          {isUp ? "+" : ""}
                          {entry.difference.toLocaleString("es-ES")} K ({isUp ? "+" : ""}
                          {entry.percentageChange}%)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                      <span>{formatRelativeTime(entry.timestamp)}</span>
                      <span>•</span>
                      <span className="text-slate-400">
                        {new Date(entry.timestamp).toLocaleTimeString("es-ES", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {entry.source && entry.source !== "manual" && (
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
                    onClick={() => onRevert(entry)}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-amber-500/20 border border-slate-800 hover:border-amber-500/40 text-slate-400 hover:text-amber-300 text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 disabled:opacity-50"
                    title={`Revertir precio a ${entry.oldPrice.toLocaleString("es-ES")} K`}
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
  );
};
