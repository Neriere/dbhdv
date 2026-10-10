import React, { useState } from "react";
import {
  FileSpreadsheet,
  Download,
  Users,
  Coins,
  Percent,
  CheckCircle2,
  X,
  Layers,
  Sparkles,
  HelpCircle,
} from "lucide-react";
import { downloadBycWorkbook } from "../services/bycExcelExportService";
import { getStoredSalesVolumeMap } from "../services/salesVolumeService";
import { ModalPortal } from "./common/ModalPortal";

interface BycExportExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultPlayersCount?: number;
  defaultSebuscalinPrice?: number;
  marketPrices: Record<number, number>;
  onExportSuccess?: (filename: string) => void;
}

export const BycExportExcelModal: React.FC<BycExportExcelModalProps> = ({
  isOpen,
  onClose,
  defaultPlayersCount = 5,
  defaultSebuscalinPrice = 320,
  marketPrices,
  onExportSuccess,
}) => {
  const [playersCount, setPlayersCount] = useState<number>(defaultPlayersCount);
  const [sebuscalinPrice, setSebuscalinPrice] = useState<number>(defaultSebuscalinPrice);
  const [marketTaxPercent, setMarketTaxPercent] = useState<number>(2);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleExport = () => {
    try {
      setIsExporting(true);
      const salesVolumeMap = getStoredSalesVolumeMap();

      const filename = downloadBycWorkbook({
        playersCount: Math.max(1, Math.min(16, playersCount || 5)),
        sebuscalinPrice: Math.max(0, sebuscalinPrice || 320),
        marketTaxRate: Math.max(0, (marketTaxPercent || 3) / 100),
        marketPrices,
        salesVolumeMap,
      });

      if (onExportSuccess) {
        onExportSuccess(filename);
      }
      onClose();
    } catch (err) {
      console.error("Error al exportar archivo Excel ByC:", err);
      alert("Ocurrió un error al exportar el archivo Excel. Revisa la consola para más detalles.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div
        className="bg-slate-900 border border-emerald-500/30 rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-800 transition-colors"
          title="Cerrar modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-start gap-3.5 pr-8">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              Exportar Plan de Inversión Grupal
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                .xlsx
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Genera un libro de cálculo interactivo para cooperativas de jugadores, con fórmulas automáticas nativas para simular costes de mapas, reparto de cofres y crafteo de equipables.
            </p>
          </div>
        </div>

        {/* Configuration Parameters */}
        <div className="space-y-4 pt-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Parámetros Iniciales del Grupo
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Jugadores */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-1.5 focus-within:border-emerald-500/50 transition-colors">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-400" />
                Jugadores (N)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={16}
                  value={playersCount}
                  onChange={(e) => setPlayersCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-sm font-bold text-white text-center focus:outline-none focus:border-emerald-400"
                />
              </div>
              <span className="text-[10px] text-slate-500 block leading-tight">
                Divide inversión y ganancias
              </span>
            </div>

            {/* Valor Sebuscalín */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-1.5 focus-within:border-emerald-500/50 transition-colors">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                Sebuscalín (K/u)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  step={10}
                  value={sebuscalinPrice}
                  onChange={(e) => setSebuscalinPrice(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-sm font-bold text-amber-300 text-center focus:outline-none focus:border-emerald-400"
                />
              </div>
              <span className="text-[10px] text-slate-500 block leading-tight">
                Base de referencia por ficha
              </span>
            </div>

            {/* Tasa Mercadillo */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-1.5 focus-within:border-emerald-500/50 transition-colors">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5 text-purple-400" />
                Tasa Mercadillo
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={20}
                  step={0.5}
                  value={marketTaxPercent}
                  onChange={(e) => setMarketTaxPercent(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-sm font-bold text-purple-300 text-center focus:outline-none focus:border-emerald-400"
                />
              </div>
              <span className="text-[10px] text-slate-500 block leading-tight">
                Impuesto de venta (2%)
              </span>
            </div>
          </div>
        </div>

        {/* Feature Overview List */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 space-y-2.5 text-xs">
          <span className="font-semibold text-slate-300 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            Estructura del Libro Excel generado:
          </span>

          <ul className="space-y-1.5 text-slate-400 text-[11px] leading-relaxed">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong className="text-slate-200">45 Cacerías de Busca y Captura:</strong> Agrupadas por Zona (Astrub, Amakna, Frigost I, II, III y Dimensiones) y ordenadas por nivel.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong className="text-slate-200">Mapeo Dinámico de Fragmentos:</strong> Soporte exacto para mapas de 2, 4, 5 y 8 fragmentos con comparación automática vs mapa entero.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong className="text-slate-200">152 Recetas de Equipables:</strong> Evaluación de Venta Directa vs Crafteo, sumando los ingredientes secundarios como inversión del grupo.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong className="text-slate-200">Fórmulas Nativas Abiertas:</strong> Puedes cambiar en cualquier momento las celdas <span className="text-amber-300 font-mono">B4</span> (jugadores), <span className="text-amber-300 font-mono">E4</span> (sebuscalín) o alternar casillas <span className="text-emerald-300 font-mono">SÍ/NO</span> para activar o excluir cacerías en el total.
              </span>
            </li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isExporting}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-emerald-950/50 transition-all transform active:scale-95 disabled:opacity-50"
          >
            {isExporting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Generando Excel...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Descargar Excel (.xlsx)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  </ModalPortal>
);
};
