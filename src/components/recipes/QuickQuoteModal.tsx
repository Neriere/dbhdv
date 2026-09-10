import React, { useState, useEffect } from "react";
import {
  X,
  Coins,
  TrendingUp,
  Activity,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Clock,
  Sparkles,
  Info,
} from "lucide-react";
import { DofusItem } from "../../types";
import {
  getItemIconUrl,
  getItemFallbackIconUrl,
  getItemName,
  getItemTypeName,
} from "../../services/dofusDbService";
import {
  ItemSalesVolume,
  analyzeSalesVolume,
  saveItemSalesVolume,
} from "../../services/salesVolumeService";

interface QuickQuoteModalProps {
  item: DofusItem | null;
  isOpen: boolean;
  onClose: () => void;
  currentPrice: number;
  craftCost: number;
  salesVolume?: ItemSalesVolume;
  onSavePrice: (itemId: number, price: number) => void;
  onSaveVolume?: (itemId: number, vol: Partial<ItemSalesVolume>) => void;
}

export const QuickQuoteModal: React.FC<QuickQuoteModalProps> = ({
  item,
  isOpen,
  onClose,
  currentPrice,
  craftCost,
  salesVolume,
  onSavePrice,
  onSaveVolume,
}) => {
  const [salePriceInput, setSalePriceInput] = useState<string>("");
  const [dailySalesInput, setDailySalesInput] = useState<string>("");
  const [v24hInput, setV24hInput] = useState<string>("");
  const [v7dInput, setV7dInput] = useState<string>("");
  const [v30dInput, setV30dInput] = useState<string>("");
  const [showAdvancedVolume, setShowAdvancedVolume] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen || !item) return;

    setSalePriceInput(currentPrice > 0 ? String(currentPrice) : "");
    const directDaily = salesVolume?.avgDailySales;
    setDailySalesInput(directDaily !== undefined && directDaily > 0 ? String(directDaily) : "");
    setV24hInput(salesVolume?.sales24h !== undefined ? String(salesVolume.sales24h) : "");
    setV7dInput(salesVolume?.sales7d !== undefined ? String(salesVolume.sales7d) : "");
    setV30dInput(salesVolume?.sales30d !== undefined ? String(salesVolume.sales30d) : "");
    setSaveSuccess(false);
  }, [isOpen, item, currentPrice, salesVolume]);

  if (!isOpen || !item) return null;

  const parsedPrice = parseFloat(salePriceInput) || 0;
  const parsedDaily = parseFloat(dailySalesInput) || 0;
  const parsed24h = v24hInput !== "" ? parseInt(v24hInput, 10) : undefined;
  const parsed7d = v7dInput !== "" ? parseInt(v7dInput, 10) : undefined;
  const parsed30d = v30dInput !== "" ? parseInt(v30dInput, 10) : undefined;

  // Real-time metrics preview
  const tax = parsedPrice > 0 ? Math.ceil(parsedPrice * 0.02) : 0;
  const netProfit = parsedPrice > 0 ? parsedPrice - tax - craftCost : 0;
  const roi = craftCost > 0 && parsedPrice > 0 ? (netProfit / craftCost) * 100 : 0;

  // Compute effective daily volume preview
  const previewVol: ItemSalesVolume = {
    ...salesVolume,
    avgDailySales: parsedDaily > 0 ? parsedDaily : undefined,
    sales24h: parsed24h,
    sales7d: parsed7d,
    sales30d: parsed30d,
  };
  const analysis = analyzeSalesVolume(parsedPrice, previewVol);
  const effectiveDaily = analysis.hasData ? analysis.avgDailySales : parsedDaily;
  const expectedDailyFlow = netProfit > 0 && effectiveDaily > 0 ? Math.round(netProfit * effectiveDaily) : 0;

  const handleSave = () => {
    if (parsedPrice >= 0) {
      onSavePrice(item.id, parsedPrice);
    }

    const updatedVol: Partial<ItemSalesVolume> = {
      avgDailySales: parsedDaily > 0 ? parsedDaily : undefined,
      sales24h: parsed24h,
      sales7d: parsed7d,
      sales30d: parsed30d,
    };

    saveItemSalesVolume(item.id, updatedVol);
    if (onSaveVolume) {
      onSaveVolume(item.id, updatedVol);
    }

    setSaveSuccess(true);
    setTimeout(() => {
      onClose();
    }, 600);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 text-slate-200 relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-950 p-1 border border-slate-800 flex items-center justify-center shrink-0">
              <img
                src={getItemIconUrl(item)}
                alt={getItemName(item)}
                className="w-10 h-10 object-contain"
                onError={(e) => {
                  const fallback = getItemFallbackIconUrl(item);
                  if (fallback && (e.target as HTMLImageElement).src !== fallback) {
                    (e.target as HTMLImageElement).src = fallback;
                  }
                }}
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white">{getItemName(item)}</h3>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-slate-950 text-amber-400 border border-slate-800">
                  Nv. {item.level}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Ajustar cotización HDV y ritmo de ventas diarias
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

        {/* Form Body */}
        <div className="space-y-4 text-xs">
          {/* HDV Sale Price Input */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 space-y-2">
            <label className="block text-slate-300 font-bold flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-amber-400" />
                <span>Precio de Venta en Mercadillo (Kamas)</span>
              </span>
              <span className="text-[11px] text-slate-500 font-normal">
                {currentPrice > 0 ? "Precio previo registrado" : "Sin cotizar aún"}
              </span>
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="1"
                value={salePriceInput}
                onChange={(e) => setSalePriceInput(e.target.value)}
                placeholder="ej. 150000"
                className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-base font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-500"
              />
              <span className="absolute right-3 top-2.5 font-bold text-slate-500 text-xs">K</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
              <span>Costo de crafteo: {craftCost > 0 ? `${craftCost.toLocaleString()} K` : "---"}</span>
              <span>Tasa mercadillo (2%): {tax > 0 ? `${tax.toLocaleString()} K` : "0 K"}</span>
            </div>
          </div>

          {/* Daily Sales / Velocity Input */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-slate-300 font-bold flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-sky-400" />
                <span>Velocidad de Venta (Unidades al Día)</span>
              </label>
              <button
                type="button"
                onClick={() => setShowAdvancedVolume((v) => !v)}
                className="text-[11px] text-sky-400 hover:text-sky-300 transition-colors cursor-pointer"
              >
                {showAdvancedVolume ? "Modo rápido (u/día)" : "¿Tienes datos 24h/7d/30d?"}
              </button>
            </div>

            {!showAdvancedVolume ? (
              <div className="space-y-2">
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={dailySalesInput}
                    onChange={(e) => setDailySalesInput(e.target.value)}
                    placeholder="ej. 1 (o 0.5 para 1 cada 2 días, 2 para 2 al día)"
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-sm font-mono font-bold text-sky-300 focus:outline-none focus:border-sky-500"
                  />
                  <span className="absolute right-3 top-2.5 font-bold text-slate-500 text-xs">u / día</span>
                </div>

                {/* Quick presets */}
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  <span className="text-[11px] text-slate-500">Atajos rápidos:</span>
                  {[
                    { label: "0.2 /día (~5d)", val: "0.2" },
                    { label: "0.5 /día (~2d)", val: "0.5" },
                    { label: "1.0 /día", val: "1.0" },
                    { label: "2.0 /día", val: "2.0" },
                    { label: "4.0 /día", val: "4.0" },
                  ].map((preset) => (
                    <button
                      key={preset.val}
                      type="button"
                      onClick={() => setDailySalesInput(preset.val)}
                      className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 text-[10px] font-mono text-slate-300 hover:text-sky-300 cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2 font-mono">
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-2">
                    <span className="text-[10px] text-slate-400 block mb-1">Últimas 24h</span>
                    <input
                      type="number"
                      min="0"
                      value={v24hInput}
                      onChange={(e) => setV24hInput(e.target.value)}
                      placeholder="—"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-center font-bold text-sky-300"
                    />
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-2">
                    <span className="text-[10px] text-slate-400 block mb-1">Últimos 7 días</span>
                    <input
                      type="number"
                      min="0"
                      value={v7dInput}
                      onChange={(e) => setV7dInput(e.target.value)}
                      placeholder="—"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-center font-bold text-sky-300"
                    />
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-2">
                    <span className="text-[10px] text-slate-400 block mb-1">Últimos 30 días</span>
                    <input
                      type="number"
                      min="0"
                      value={v30dInput}
                      onChange={(e) => setV30dInput(e.target.value)}
                      placeholder="—"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-center font-bold text-sky-300"
                    />
                  </div>
                </div>
                {analysis.hasData && (
                  <p className="text-[11px] text-sky-400 font-mono text-right">
                    Ritmo ponderado resultante: ~{analysis.avgDailySales} u/día
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Market Study Result Preview Card */}
          <div className="bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Rendimiento Financiero Estimado</span>
              </span>
              {analysis.turnoverLabel && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-bold border border-sky-500/30">
                  {analysis.turnoverLabel}
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 font-mono text-center">
              <div className="bg-slate-900/90 p-2 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-sans">Ganancia Neta</span>
                <span
                  className={`text-sm font-black ${
                    netProfit >= 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {parsedPrice > 0
                    ? `${netProfit >= 0 ? "+" : ""}${netProfit.toLocaleString()} K`
                    : "---"}
                </span>
              </div>

              <div className="bg-slate-900/90 p-2 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-sans">Rentabilidad ROI</span>
                <span
                  className={`text-sm font-black ${
                    roi >= 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {parsedPrice > 0 && craftCost > 0 ? `+${roi.toFixed(1)}%` : "---"}
                </span>
              </div>

              <div className="bg-slate-900/90 p-2 rounded-xl border border-slate-800">
                <span className="text-[10px] text-amber-400 block font-sans font-bold">
                  Flujo Diario (K/día)
                </span>
                <span className="text-sm font-black text-amber-300">
                  {expectedDailyFlow > 0 ? `~${expectedDailyFlow.toLocaleString()} K` : "---"}
                </span>
              </div>
            </div>

            {expectedDailyFlow > 0 && (
              <p className="text-[11px] text-slate-400 leading-relaxed font-sans pt-1">
                Con <strong className="text-white">{effectiveDaily} u/día</strong> estimadas,
                recuperarías el capital en{" "}
                <strong className="text-sky-300">
                  {effectiveDaily > 0 ? `~${(1 / effectiveDaily).toFixed(1)} días` : "---"}
                </strong>{" "}
                con un flujo proyectado de{" "}
                <strong className="text-emerald-400">
                  +{expectedDailyFlow.toLocaleString()} Kamas al día
                </strong>
                .
              </p>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-all cursor-pointer"
          >
            {saveSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-950" />
                <span>¡Cotización Guardada!</span>
              </>
            ) : (
              <>
                <Coins className="w-4 h-4" />
                <span>Guardar Cotización y Ventas</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
