import React, { useState, useEffect } from "react";
import {
  X,
  Activity,
  TrendingUp,
  Check,
  RotateCcw,
  Sparkles,
  Coins,
  Info,
  Calendar,
  Clock,
  Flame,
} from "lucide-react";
import { ItemSalesVolume } from "../../types";
import { analyzeSalesVolume, saveItemSalesVolume } from "../../services/salesVolumeService";

export interface EditSalesVolumeModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemId: number;
  itemName: string;
  itemIconUrl?: string;
  itemLevel?: number;
  itemType?: string;
  currentPrice?: number;
  initialSalesVolume?: ItemSalesVolume;
  onSaved?: (volume: ItemSalesVolume) => void;
}

export const EditSalesVolumeModal: React.FC<EditSalesVolumeModalProps> = ({
  isOpen,
  onClose,
  itemId,
  itemName,
  itemIconUrl,
  itemLevel,
  itemType,
  currentPrice = 0,
  initialSalesVolume,
  onSaved,
}) => {
  const [v24hInput, setV24hInput] = useState<string>("");
  const [v7dInput, setV7dInput] = useState<string>("");
  const [v30dInput, setV30dInput] = useState<string>("");
  const [isSaved, setIsSaved] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    setV24hInput(initialSalesVolume?.sales24h !== undefined ? String(initialSalesVolume.sales24h) : "");
    setV7dInput(initialSalesVolume?.sales7d !== undefined ? String(initialSalesVolume.sales7d) : "");
    setV30dInput(initialSalesVolume?.sales30d !== undefined ? String(initialSalesVolume.sales30d) : "");
    setIsSaved(false);
  }, [isOpen, initialSalesVolume, itemId]);

  if (!isOpen) return null;

  const parsed24h = v24hInput.trim() !== "" ? Math.max(0, parseInt(v24hInput.replace(/\D/g, ""), 10) || 0) : undefined;
  const parsed7d = v7dInput.trim() !== "" ? Math.max(0, parseInt(v7dInput.replace(/\D/g, ""), 10) || 0) : undefined;
  const parsed30d = v30dInput.trim() !== "" ? Math.max(0, parseInt(v30dInput.replace(/\D/g, ""), 10) || 0) : undefined;

  const previewVol: ItemSalesVolume = {
    ...initialSalesVolume,
    sales24h: parsed24h,
    sales7d: parsed7d,
    sales30d: parsed30d,
  };

  const analysis = analyzeSalesVolume(currentPrice, previewVol);
  const effectiveDaily = analysis.hasData ? analysis.avgDailySales : 0;
  const estDailyKamas = currentPrice > 0 && effectiveDaily > 0 ? Math.round(currentPrice * effectiveDaily) : 0;

  const handleSave = () => {
    const updated: Partial<ItemSalesVolume> = {
      sales24h: parsed24h,
      sales7d: parsed7d,
      sales30d: parsed30d,
      avgDailySales: effectiveDaily > 0 ? effectiveDaily : undefined,
      updatedAt: Date.now(),
    };

    saveItemSalesVolume(itemId, updated);
    setIsSaved(true);
    if (onSaved) {
      onSaved({ ...initialSalesVolume, ...updated } as ItemSalesVolume);
    }
    setTimeout(() => {
      onClose();
    }, 400);
  };

  const handleClear = () => {
    const cleared: Partial<ItemSalesVolume> = {
      sales24h: undefined,
      sales7d: undefined,
      sales30d: undefined,
      avgDailySales: undefined,
      updatedAt: Date.now(),
    };
    saveItemSalesVolume(itemId, cleared);
    if (onSaved) {
      onSaved({ ...initialSalesVolume, ...cleared } as ItemSalesVolume);
    }
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-5 text-slate-200 relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            {itemIconUrl ? (
              <div className="w-12 h-12 rounded-2xl bg-slate-950 p-1 border border-slate-800 flex items-center justify-center shrink-0 shadow-inner">
                <img src={itemIconUrl} alt={itemName} className="w-10 h-10 object-contain" />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-2xl bg-slate-950 p-2.5 border border-slate-800 flex items-center justify-center shrink-0 text-cyan-400">
                <Activity className="w-6 h-6" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-black text-white">{itemName}</h3>
                {itemLevel ? (
                  <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-950 text-amber-400 border border-slate-800">
                    Nv. {itemLevel}
                  </span>
                ) : null}
                {itemType ? (
                  <span className="text-[10px] text-slate-400 px-1.5 py-0.5 rounded bg-slate-800/80">
                    {itemType}
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Volumen de ventas en Mercadillo (24h · 7d · 30d)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Market Price Banner */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl px-4 py-2.5 flex items-center justify-between text-xs">
          <span className="text-slate-400 flex items-center gap-1.5">
            <Coins className="w-4 h-4 text-amber-400" />
            Precio en mercadillo:
          </span>
          <span className="font-mono font-bold text-amber-300">
            {currentPrice > 0 ? `${currentPrice.toLocaleString()} Kamas` : "Sin cotizar"}
          </span>
        </div>

        {/* 3 Main Sales Volume Inputs */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-sky-400" />
              <span>Registro de Ventas por Período</span>
            </label>
            <span className="text-[11px] text-slate-500 font-mono">
              Unidades vendidas
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {/* 24h Input */}
            <div className="bg-slate-950/90 border border-slate-800 focus-within:border-cyan-500/80 rounded-2xl p-3 transition-colors flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-cyan-300 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  24 Horas
                </span>
                <span className="text-[10px] text-slate-500">Último día</span>
              </div>
              <input
                type="number"
                min="0"
                step="1"
                value={v24hInput}
                onChange={(e) => setV24hInput(e.target.value)}
                placeholder="0"
                autoFocus
                className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-center font-mono font-bold text-cyan-300 text-base focus:outline-none focus:border-cyan-400"
              />
              <span className="text-[10px] text-slate-500 text-center mt-1">
                Ponderación 50%
              </span>
            </div>

            {/* 7d Input */}
            <div className="bg-slate-950/90 border border-slate-800 focus-within:border-sky-500/80 rounded-2xl p-3 transition-colors flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-sky-300 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-sky-400" />
                  7 Días
                </span>
                <span className="text-[10px] text-slate-500">Semana</span>
              </div>
              <input
                type="number"
                min="0"
                step="1"
                value={v7dInput}
                onChange={(e) => setV7dInput(e.target.value)}
                placeholder="0"
                className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-center font-mono font-bold text-sky-300 text-base focus:outline-none focus:border-sky-400"
              />
              <span className="text-[10px] text-slate-500 text-center mt-1">
                Ponderación 35%
              </span>
            </div>

            {/* 30d Input */}
            <div className="bg-slate-950/90 border border-slate-800 focus-within:border-indigo-500/80 rounded-2xl p-3 transition-colors flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-indigo-300 flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-indigo-400" />
                  30 Días
                </span>
                <span className="text-[10px] text-slate-500">Mes</span>
              </div>
              <input
                type="number"
                min="0"
                step="1"
                value={v30dInput}
                onChange={(e) => setV30dInput(e.target.value)}
                placeholder="0"
                className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-center font-mono font-bold text-indigo-300 text-base focus:outline-none focus:border-indigo-400"
              />
              <span className="text-[10px] text-slate-500 text-center mt-1">
                Ponderación 15%
              </span>
            </div>
          </div>
        </div>

        {/* Real-time Analytics Preview */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 flex items-center gap-1.5 font-semibold">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              Métricas y Ritmo Calculado:
            </span>
            {analysis.hasData && analysis.turnoverLabel ? (
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                  analysis.turnoverRating === "alta"
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                    : analysis.turnoverRating === "media"
                    ? "bg-sky-500/20 text-sky-300 border-sky-500/30"
                    : "bg-slate-800 text-slate-400 border-slate-700"
                }`}
              >
                {analysis.turnoverLabel}
              </span>
            ) : (
              <span className="text-[10px] text-slate-500 font-mono">Sin datos de salida</span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            {/* Ritmo diario */}
            <div className="bg-slate-900/90 rounded-xl p-2.5 border border-slate-800/80">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Ritmo de Salida</div>
              <div className="text-base font-black text-emerald-400 mt-0.5">
                {effectiveDaily > 0 ? `~${effectiveDaily.toFixed(1)} u / día` : "0 u / día"}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {analysis.daysToSell ? `1 venta cada ~${analysis.daysToSell} días` : "Sin rotación calculable"}
              </div>
            </div>

            {/* Facturación diaria */}
            <div className="bg-slate-900/90 rounded-xl p-2.5 border border-slate-800/80">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Facturación / Profit Est.</div>
              <div className="text-base font-black text-amber-300 mt-0.5">
                {estDailyKamas > 0 ? `${estDailyKamas.toLocaleString()} K` : "—"}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {estDailyKamas > 0 ? "Kamas estimados al día" : "Requiere precio y ventas"}
              </div>
            </div>
          </div>

          {/* Momentum Indicator */}
          {analysis.momentum && (
            <div className="flex items-center justify-between text-[11px] px-2 py-1 rounded-lg bg-slate-900/60 border border-slate-800">
              <span className="text-slate-400">Tendencia de salida (24h vs semana):</span>
              <span
                className={`font-bold capitalize ${
                  analysis.momentum === "acelerado"
                    ? "text-emerald-400"
                    : analysis.momentum === "desacelerado"
                    ? "text-rose-400"
                    : "text-sky-400"
                }`}
              >
                {analysis.momentum}
              </span>
            </div>
          )}

          <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>
              La rotación diaria pondera 50% el volumen de 24h, 35% el de 7d y 15% el de 30d para predecir liquidez real.
            </span>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-1 gap-2">
          <button
            type="button"
            onClick={handleClear}
            className="px-3 py-2 rounded-xl bg-slate-950 hover:bg-red-950/40 border border-slate-800 hover:border-red-900/50 text-slate-400 hover:text-red-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Borrar datos de ventas para este ítem"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Limpiar datos</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-sky-500/20 transition-all cursor-pointer"
            >
              {isSaved ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>¡Guardado!</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-white" />
                  <span>Guardar Ventas</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
