import React from "react";
import { ShoppingCart, CheckCircle2, Circle, Check } from "lucide-react";
import {
  getItemIconUrl,
  getItemFallbackIconUrl,
} from "../../services/dofusDbService";
import { SafeImage } from "../SafeImage";
import { KamaDisplay } from "../common/KamaDisplay";
import { ConsolidatedShoppingIngredientWithChecked } from "./types";

interface ShoppingListIngredientsTableProps {
  ingredients: ConsolidatedShoppingIngredientWithChecked[];
  editingPriceId: number | null;
  editPriceValue: string;
  onToggleChecked: (itemId: number) => void;
  onStartEditingPrice: (itemId: number, currentPrice: number) => void;
  onEditPriceChange: (val: string) => void;
  onSaveInlinePrice: (itemId: number) => void;
  onCancelEditingPrice: () => void;
}

export const ShoppingListIngredientsTable: React.FC<ShoppingListIngredientsTableProps> = ({
  ingredients,
  editingPriceId,
  editPriceValue,
  onToggleChecked,
  onStartEditingPrice,
  onEditPriceChange,
  onSaveInlinePrice,
  onCancelEditingPrice,
}) => {
  return (
    <div className="lg:col-span-8 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <ShoppingCart className="w-3.5 h-3.5 text-amber-400" /> Ingredientes ({ingredients.length})
        </h3>
        <span className="text-[11px] text-slate-500">
          Marcar elementos comprados
        </span>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-mono border-b border-slate-800 text-[10px] uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-3 w-8 text-center">Estado</th>
                <th className="py-2.5 px-3">Ingrediente</th>
                <th className="py-2.5 px-3 text-center">Cantidad</th>
                <th className="py-2.5 px-3 text-right">Precio Unitario</th>
                <th className="py-2.5 px-3 text-right">Costo Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {ingredients.map((ing) => {
                const isChecked = Boolean(ing.isChecked);
                const isEditing = editingPriceId === ing.itemId;

                return (
                  <tr
                    key={ing.itemId}
                    className={`hover:bg-slate-800/40 transition-colors ${
                      isChecked ? "bg-slate-950/40 opacity-60" : ""
                    }`}
                  >
                    <td className="py-2 px-3 text-center">
                      <button
                        onClick={() => onToggleChecked(ing.itemId)}
                        className="text-slate-500 hover:text-amber-400 transition-colors p-0.5"
                      >
                        {isChecked ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Circle className="w-4 h-4 text-slate-600 hover:text-slate-400" />
                        )}
                      </button>
                    </td>

                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-slate-950 border border-slate-800 rounded-lg p-0.5 shrink-0 flex items-center justify-center">
                          <SafeImage
                            src={getItemIconUrl(ing.item || { id: ing.itemId })}
                            fallbackSrc={getItemFallbackIconUrl(ing.item || { id: ing.itemId })}
                            alt={ing.item?.name?.es || ""}
                            className="w-6 h-6 object-contain"
                          />
                        </div>
                        <span
                          className={`font-bold ${
                            isChecked ? "line-through text-slate-500" : "text-slate-200"
                          }`}
                        >
                          {ing.item?.name?.es || `Objeto #${ing.itemId}`}
                        </span>
                      </div>
                    </td>

                    <td className="py-2 px-3 text-center font-bold text-amber-300 font-mono">
                      {ing.totalQuantityRequired.toLocaleString("es-ES")}x
                    </td>

                    <td className="py-2 px-3 text-right font-mono">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1">
                          <input
                            type="number"
                            value={editPriceValue}
                            onChange={(e) => onEditPriceChange(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") onSaveInlinePrice(ing.itemId);
                              if (e.key === "Escape") onCancelEditingPrice();
                            }}
                            autoFocus
                            className="w-20 px-1.5 py-0.5 bg-slate-950 border border-amber-500 rounded text-right text-xs text-white outline-none"
                          />
                          <button
                            onClick={() => onSaveInlinePrice(ing.itemId)}
                            className="p-1 bg-emerald-500 text-slate-950 rounded hover:bg-emerald-400"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => onStartEditingPrice(ing.itemId, ing.unitPrice || 0)}
                          className="group inline-flex items-center gap-1 hover:text-amber-300 font-semibold text-slate-300"
                        >
                          <KamaDisplay amount={ing.unitPrice} />
                        </button>
                      )}
                    </td>

                    <td className="py-2 px-3 text-right font-bold text-amber-400 font-mono">
                      <KamaDisplay amount={ing.totalPrice} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
