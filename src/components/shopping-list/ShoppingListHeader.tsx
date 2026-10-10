import React from "react";
import { ShoppingCart, Plus, Copy, Check, Trash2 } from "lucide-react";

interface ShoppingListHeaderProps {
  itemsCount: number;
  onOpenSearch: () => void;
  onCopyChatFormat: () => void;
  copied: boolean;
  onClearList: () => void;
}

export const ShoppingListHeader: React.FC<ShoppingListHeaderProps> = ({
  itemsCount,
  onOpenSearch,
  onCopyChatFormat,
  copied,
  onClearList,
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
          <ShoppingCart className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-black text-white tracking-tight">
            Lista de Compras
          </h2>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
        <button
          onClick={onOpenSearch}
          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> Añadir
        </button>

        {itemsCount > 0 && (
          <>
            <button
              onClick={onCopyChatFormat}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              {copied ? "¡Copiado!" : "Copiar lista"}
            </button>

            <button
              onClick={onClearList}
              className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl transition-all cursor-pointer"
              title="Vaciar lista"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};
