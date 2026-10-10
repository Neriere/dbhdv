import React from "react";
import { ShoppingCart } from "lucide-react";

export const ShoppingListEmptyState: React.FC = () => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center max-w-md mx-auto space-y-3">
      <div className="w-12 h-12 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-center text-slate-500 mx-auto">
        <ShoppingCart className="w-6 h-6" />
      </div>
      <div>
        <h3 className="text-sm font-bold text-white">Tu lista de compras está vacía</h3>
        <p className="text-xs text-slate-400 mt-1">
          Usa el botón <span className="text-amber-400 font-semibold">&ldquo;+ Añadir&rdquo;</span> para buscar y agregar objetos o recetas a tu lista.
        </p>
      </div>
    </div>
  );
};
