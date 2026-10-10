import React from "react";
import { X, History, Loader2, AlertCircle } from "lucide-react";
import {
  getItemIconUrl,
  getItemFallbackIconUrl,
  getItemName,
  getItemTypeName,
} from "../../services/dofusDbService";
import { ModalPortal } from "../common/ModalPortal";
import { ItemPriceHistoryModalProps } from "./types";
import { useItemPriceHistory } from "./useItemPriceHistory";
import { PriceHistoryMetricsGrid } from "./PriceHistoryMetricsGrid";
import { PriceHistoryTrendChart } from "./PriceHistoryTrendChart";
import { PriceHistoryTimeline } from "./PriceHistoryTimeline";

export const ItemPriceHistoryModal: React.FC<ItemPriceHistoryModalProps> = ({
  item,
  isOpen,
  onClose,
  onPriceChanged,
  profileId,
}) => {
  const {
    loading,
    data,
    revertingId,
    activePointIndex,
    setActivePointIndex,
    handleRevert,
  } = useItemPriceHistory(item, isOpen, profileId, onPriceChanged);

  if (!isOpen || !item) return null;

  const historyEntries = data ? [...data.history].reverse() : [];
  const chartPoints = data?.history || [];

  return (
    <ModalPortal>
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
                <PriceHistoryMetricsGrid data={data} />

                {/* Interactive Trend Chart */}
                <PriceHistoryTrendChart
                  itemId={item.id}
                  chartPoints={chartPoints}
                  currentPrice={data.currentPrice}
                  lastUpdatedAt={data.lastUpdatedAt}
                  activePointIndex={activePointIndex}
                  setActivePointIndex={setActivePointIndex}
                />

                {/* History Timeline Entries */}
                <PriceHistoryTimeline
                  historyEntries={historyEntries}
                  currentPrice={data.currentPrice}
                  revertingId={revertingId}
                  onRevert={handleRevert}
                />
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
    </ModalPortal>
  );
};

export default ItemPriceHistoryModal;
