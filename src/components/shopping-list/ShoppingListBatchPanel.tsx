import React from "react";
import {
  Sparkles,
  Wrench,
  Minus,
  Plus,
  Trash2,
  TrendingDown,
  AlertCircle,
} from "lucide-react";
import { DofusItem, ShoppingListItem } from "../../types";
import {
  getItemIconUrl,
  getItemFallbackIconUrl,
} from "../../services/dofusDbService";
import { SafeImage } from "../SafeImage";
import { KamaDisplay } from "../common/KamaDisplay";

interface ShoppingListBatchPanelProps {
  items: ShoppingListItem[];
  qtyInputs: Record<number, string>;
  onSetAllQuantities: (qty: number) => void;
  onUpdateQty: (itemId: number, delta: number) => void;
  onSetExactQty: (itemId: number, qty: number) => void;
  onQtyInputChange: (itemId: number, val: string) => void;
  onCommitQty: (itemId: number) => void;
  onCancelQty: (itemId: number) => void;
  onRemoveItem: (itemId: number) => void;
  onSelectRecipeForCalculator: (item: DofusItem) => void;
  consolidatedCount: number;
  totalCost: number;
  pendingCost: number;
  unpricedCount: number;
}

export const ShoppingListBatchPanel: React.FC<ShoppingListBatchPanelProps> = ({
  items,
  qtyInputs,
  onSetAllQuantities,
  onUpdateQty,
  onSetExactQty,
  onQtyInputChange,
  onCommitQty,
  onCancelQty,
  onRemoveItem,
  onSelectRecipeForCalculator,
  consolidatedCount,
  totalCost,
  pendingCost,
  unpricedCount,
}) => {
  return (
    <div className="lg:col-span-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Recetas ({items.length})
        </h3>
        {items.length > 1 && (
          <div className="flex items-center gap-1 text-[10px]">
            <span className="text-slate-500">Todas:</span>
            {[1, 5, 10].map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => onSetAllQuantities(q)}
                className="px-1.5 py-0.5 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-amber-300 border border-slate-800 rounded font-mono font-bold transition-colors cursor-pointer"
                title={`Fijar todas las recetas a ${q}x`}
              >
                {q}x
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
        {items.map((entry) => (
          <div
            key={entry.itemId}
            className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl hover:border-slate-700 transition-all flex flex-col gap-2 shadow-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 bg-slate-950 border border-slate-800 rounded-lg p-1 shrink-0 flex items-center justify-center">
                  <SafeImage
                    src={getItemIconUrl(entry.item)}
                    fallbackSrc={getItemFallbackIconUrl(entry.item)}
                    alt={entry.item.name?.es || ""}
                    className="w-7 h-7 object-contain"
                  />
                </div>
                <div className="min-w-0">
                  <div
                    className="font-bold text-white text-xs truncate hover:text-amber-300 transition-colors"
                    title={entry.item.name?.es || `Objeto #${entry.itemId}`}
                  >
                    {entry.item.name?.es || `Objeto #${entry.itemId}`}
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <span>Nv. {entry.item.level || 1}</span>
                    {entry.recipe && (
                      <>
                        <span>•</span>
                        <button
                          type="button"
                          onClick={() => onSelectRecipeForCalculator(entry.item)}
                          className="text-amber-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                        >
                          <Wrench className="w-3 h-3" /> Ver
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Quantity Stepper with Editable Input */}
              <div className="flex items-center gap-1 shrink-0 bg-slate-950 p-1 border border-slate-800 rounded-lg">
                <button
                  type="button"
                  onClick={(e) => onUpdateQty(entry.itemId, e.shiftKey ? -10 : -1)}
                  className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-colors cursor-pointer"
                  title="Restar 1 (Shift + Clic para restar 10)"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>

                <div className="relative flex items-center">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={
                      qtyInputs[entry.itemId] !== undefined
                        ? qtyInputs[entry.itemId]
                        : entry.targetQuantity
                    }
                    onChange={(e) => onQtyInputChange(entry.itemId, e.target.value)}
                    onFocus={(e) => e.target.select()}
                    onBlur={() => onCommitQty(entry.itemId)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        onCommitQty(entry.itemId);
                        (e.target as HTMLInputElement).blur();
                      }
                      if (e.key === "Escape") {
                        onCancelQty(entry.itemId);
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    className="w-12 text-center text-xs font-black text-amber-300 font-mono bg-slate-900 border border-slate-800 focus:border-amber-400 focus:bg-slate-950 focus:ring-1 focus:ring-amber-400/50 rounded py-0.5 outline-none transition-all cursor-text"
                    title="Escribe la cantidad directamente (Enter o clic fuera para confirmar)"
                  />
                </div>

                <button
                  type="button"
                  onClick={(e) => onUpdateQty(entry.itemId, e.shiftKey ? 10 : 1)}
                  className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-colors cursor-pointer"
                  title="Sumar 1 (Shift + Clic para sumar 10)"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => onRemoveItem(entry.itemId)}
                  className="p-1 text-rose-400 hover:bg-rose-500/20 rounded transition-colors ml-0.5 cursor-pointer"
                  title="Eliminar de la lista"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Quick Presets row */}
            <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/60 text-[10px]">
              <span className="text-slate-500 font-medium">Cant. rápida:</span>
              <div className="flex items-center gap-1">
                {[1, 5, 10, 50, 100].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => onSetExactQty(entry.itemId, preset)}
                    className={`px-1.5 py-0.5 rounded font-mono font-bold transition-all cursor-pointer ${
                      entry.targetQuantity === preset
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm"
                        : "bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800"
                    }`}
                    title={`Fijar exactamente a ${preset} unidades`}
                  >
                    {preset}x
                  </button>
                ))}
                <div className="h-3 w-px bg-slate-800 mx-0.5" />
                <button
                  type="button"
                  onClick={(e) => onUpdateQty(entry.itemId, e.shiftKey ? 50 : 10)}
                  className="px-1.5 py-0.5 rounded font-mono font-bold bg-slate-950 hover:bg-slate-800 text-amber-400/90 hover:text-amber-300 border border-slate-800 hover:border-amber-500/30 transition-all cursor-pointer"
                  title="Sumar +10 (Shift + Clic para sumar +50)"
                >
                  +10
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Budget Summary Card */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-2.5 shadow-md text-xs">
        <div className="font-bold text-slate-400 uppercase tracking-wider text-[11px]">
          Resumen Presupuestario
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-400">Total Ingredientes:</span>
          <span className="font-bold text-white">{consolidatedCount} tipos</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-400">Costo Total:</span>
          <span className="font-bold text-amber-400 font-mono text-sm">
            <KamaDisplay amount={totalCost} />
          </span>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <span className="text-slate-400 flex items-center gap-1">
            <TrendingDown className="w-3.5 h-3.5 text-emerald-400" /> Pendiente:
          </span>
          <span className="font-bold text-emerald-300 font-mono text-sm">
            <KamaDisplay amount={pendingCost} />
          </span>
        </div>

        {unpricedCount > 0 && (
          <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-300 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>
              <strong>{unpricedCount}</strong> ingredientes sin precio registrado.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
