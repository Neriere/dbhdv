import React from 'react';
import {
  ShoppingCart,
  RotateCcw,
  CheckCircle2,
  Package,
  Check,
  Tag,
} from 'lucide-react';
import { SafeImage } from '../SafeImage';
import {
  getItemIconUrl,
  getItemFallbackIconUrl,
} from '../../services/dofusDbService';
import { formatKamas } from '../../utils/kamaFormatters';
import { DofusbookComputedData, MaterialsFilter } from './types';

interface DofusbookMaterialsListProps {
  computedData: DofusbookComputedData;
  materialsFilter: MaterialsFilter;
  setMaterialsFilter: (filter: MaterialsFilter) => void;
  editingPriceItemId: number | null;
  setEditingPriceItemId: (id: number | null) => void;
  tempPriceInput: string;
  setTempPriceInput: (val: string) => void;
  onToggleMaterialObtained: (itemId: number) => void;
  onResetObtainedMaterials: () => void;
  onSendToShoppingList: () => void;
  onSavePrice: (itemId: number, price: number) => void;
}

export const DofusbookMaterialsList: React.FC<DofusbookMaterialsListProps> = ({
  computedData,
  materialsFilter,
  setMaterialsFilter,
  editingPriceItemId,
  setEditingPriceItemId,
  tempPriceInput,
  setTempPriceInput,
  onToggleMaterialObtained,
  onResetObtainedMaterials,
  onSendToShoppingList,
  onSavePrice,
}) => {
  const displayList =
    materialsFilter === 'needed'
      ? computedData.neededIngredients
      : materialsFilter === 'obtained'
      ? computedData.obtainedIngredients
      : computedData.consolidatedIngredients;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-5 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h4 className="text-base font-black text-white flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-amber-400" />
            Lista de Materiales Requeridos ({computedData.consolidatedIngredients.length} recursos)
          </h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Marca los recursos que ya tienes para restar su coste del total requerido y mantener el foco en lo que realmente te falta.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {computedData.obtainedIngredients.length > 0 && (
            <button
              type="button"
              onClick={onResetObtainedMaterials}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all border border-slate-700 cursor-pointer"
              title="Desmarcar todos los recursos obtenidos"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>Limpiar Obtenidos</span>
            </button>
          )}

          <button
            type="button"
            onClick={onSendToShoppingList}
            disabled={computedData.neededIngredients.length === 0}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all shadow-md shadow-amber-500/20 cursor-pointer"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>Enviar Faltantes a Compras</span>
          </button>
        </div>
      </div>

      {/* Materials Progress & Filter Subtabs */}
      {computedData.consolidatedIngredients.length > 0 && (
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-400">Ver:</span>
              <div className="inline-flex rounded-lg bg-slate-900 p-1 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setMaterialsFilter('needed')}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                    materialsFilter === 'needed'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>Faltantes</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-black ${
                    materialsFilter === 'needed' ? 'bg-amber-600/40 text-slate-950' : 'bg-slate-800 text-amber-400'
                  }`}>
                    {computedData.neededIngredients.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setMaterialsFilter('obtained')}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                    materialsFilter === 'obtained'
                      ? 'bg-emerald-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>Ya Obtenidos</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-black ${
                    materialsFilter === 'obtained' ? 'bg-emerald-600/40 text-slate-950' : 'bg-slate-800 text-emerald-400'
                  }`}>
                    {computedData.obtainedIngredients.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setMaterialsFilter('all')}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                    materialsFilter === 'all'
                      ? 'bg-slate-700 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>Todos</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-black ${
                    materialsFilter === 'all' ? 'bg-slate-800 text-slate-200' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {computedData.consolidatedIngredients.length}
                  </span>
                </button>
              </div>
            </div>

            {/* Cost summary badges */}
            <div className="flex items-center gap-3 text-xs">
              <div className="bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg">
                <span className="text-slate-400 mr-1.5">Gasto restante:</span>
                <strong className="text-amber-400 font-mono font-bold">
                  {formatKamas(computedData.totalNeededMaterialsCost)}
                </strong>
              </div>
              {computedData.obtainedIngredients.length > 0 && (
                <div className="bg-slate-900 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                  <span className="text-slate-400 mr-1.5">Ahorrado (tienes):</span>
                  <strong className="text-emerald-400 font-mono font-bold">
                    {formatKamas(computedData.totalObtainedMaterialsCost)}
                  </strong>
                </div>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-slate-400 font-medium">
              <span>Progreso de recolección de materiales</span>
              <span className="text-emerald-400 font-bold font-mono">
                {computedData.obtainedIngredients.length} de {computedData.consolidatedIngredients.length} ({computedData.materialsProgressPercent}%)
              </span>
            </div>
            <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
              <div
                className="bg-emerald-500 h-full transition-all duration-300 rounded-full"
                style={{ width: `${computedData.materialsProgressPercent}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {computedData.consolidatedIngredients.length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-xs">
          {computedData.ownedCount > 0 && computedData.neededCount === 0 ? (
            <div className="space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <p className="font-bold text-emerald-300 text-sm">¡Tienes todas las piezas del set obtenidas!</p>
              <p className="text-slate-400">No requieres comprar ningún material adicional.</p>
            </div>
          ) : (
            'No hay materiales requeridos o las piezas pendientes no tienen recetas registradas.'
          )}
        </div>
      ) : displayList.length === 0 ? (
        <div className="text-center py-10 bg-slate-950/40 rounded-xl border border-slate-800 text-slate-400 text-xs space-y-2">
          {materialsFilter === 'needed' ? (
            <>
              <CheckCircle2 className="w-7 h-7 text-emerald-400 mx-auto" />
              <p className="font-bold text-emerald-300">¡Has marcado todos los recursos como obtenidos!</p>
              <p className="text-slate-500">No te falta ningún material de las piezas pendientes.</p>
            </>
          ) : materialsFilter === 'obtained' ? (
            <>
              <Package className="w-7 h-7 text-slate-600 mx-auto" />
              <p className="font-semibold text-slate-400">No has marcado ningún material como obtenido aún.</p>
              <p className="text-slate-500">Haz clic en el botón de check "✓" de los materiales que ya tengas.</p>
            </>
          ) : (
            <p>No hay materiales disponibles.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {displayList.map((mat) => {
            const isEditingThisMat = editingPriceItemId === mat.itemId;
            const isMatObtained = !!mat.isObtained;

            return (
              <div
                key={mat.itemId}
                className={`border rounded-xl p-2.5 flex items-center justify-between gap-2 transition-all ${
                  isMatObtained
                    ? 'bg-emerald-950/20 border-emerald-500/30 hover:border-emerald-500/50'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 p-0.5 flex items-center justify-center shrink-0">
                    {mat.item ? (
                      <SafeImage
                        src={getItemIconUrl(mat.item)}
                        fallbackSrc={getItemFallbackIconUrl(mat.item)}
                        alt={mat.item.name?.es || `Ingrediente #${mat.itemId}`}
                        className="w-7 h-7 object-contain"
                      />
                    ) : (
                      <Package className="w-3.5 h-3.5 text-slate-500" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-slate-200 text-xs truncate flex items-center gap-1">
                      <span className="truncate">{mat.item?.name?.es || `Ingrediente #${mat.itemId}`}</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Total: <strong className="text-amber-300 font-mono">x{mat.totalQuantityRequired.toLocaleString()}</strong>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => onToggleMaterialObtained(mat.itemId)}
                    className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-all border ${
                      isMatObtained
                        ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/50 hover:bg-emerald-500/35'
                        : 'bg-slate-900 text-slate-400 border-slate-700 hover:bg-emerald-500/20 hover:text-emerald-300 hover:border-emerald-500/30'
                    }`}
                    title={
                      isMatObtained
                        ? 'Material obtenido (Clic para mover a pendientes)'
                        : 'Marcar como ya obtenido (resta del cálculo)'
                    }
                  >
                    <CheckCircle2 className={`w-3.5 h-3.5 ${isMatObtained ? 'text-emerald-400' : 'text-slate-500'}`} />
                  </button>

                  <div className="text-right font-mono">
                    {isEditingThisMat ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={tempPriceInput}
                          onChange={(e) => setTempPriceInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              onSavePrice(mat.itemId, Number(tempPriceInput) || 0);
                            } else if (e.key === 'Escape') {
                              setEditingPriceItemId(null);
                            }
                          }}
                          autoFocus
                          placeholder="Precio u."
                          className="w-18 px-1.5 py-0.5 bg-slate-900 border border-amber-500 text-right text-xs rounded text-amber-300 font-mono outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => onSavePrice(mat.itemId, Number(tempPriceInput) || 0)}
                          className="p-1 bg-amber-500 text-slate-950 rounded hover:bg-amber-400 cursor-pointer"
                          title="Guardar precio"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPriceItemId(mat.itemId);
                          setTempPriceInput(String(mat.unitPrice || ''));
                        }}
                        className="group/matprice text-right block cursor-pointer"
                        title="Haz clic para editar el precio de este recurso"
                      >
                        <div className={`text-xs font-black ${
                          isMatObtained
                            ? 'text-emerald-400/80 line-through group-hover/matprice:text-emerald-300'
                            : 'text-amber-400 group-hover/matprice:text-amber-300'
                        }`}>
                          {mat.totalPrice > 0 ? formatKamas(mat.totalPrice) : '-'}
                        </div>
                        <div className="text-[10px] text-slate-500 group-hover/matprice:text-amber-400 flex items-center justify-end gap-1">
                          <span>{mat.unitPrice > 0 ? `${formatKamas(mat.unitPrice)} u.` : 'Sin precio'}</span>
                          <Tag className="w-2.5 h-2.5 opacity-0 group-hover/matprice:opacity-100 text-slate-500" />
                        </div>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
