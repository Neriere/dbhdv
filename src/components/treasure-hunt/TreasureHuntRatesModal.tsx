import React from 'react';
import { Coins, X } from 'lucide-react';
import { ModalPortal } from '../common/ModalPortal';

interface TreasureHuntRatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  tempSebuscalin: string;
  onTempSebuscalinChange: (val: string) => void;
  onSaveRates: () => void;
}

export const TreasureHuntRatesModal: React.FC<
  TreasureHuntRatesModalProps
> = ({
  isOpen,
  onClose,
  tempSebuscalin,
  onTempSebuscalinChange,
  onSaveRates,
}) => {
  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start justify-center py-8 px-4 overflow-y-auto">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Coins className="w-5 h-5 text-amber-400" />
              Cotización de Sebuscalines
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              title="Cerrar modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-slate-400">
            Define cuánto vale cada Sebuscalín en Kamas en tu servidor. Este
            valor se multiplicará por los Sebuscalines obtenidos en el cofre para
            calcular el retorno de cada cacería.
          </p>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span>Precio estimado por 1 Sebuscalín (K):</span>
                <span className="text-slate-500 font-normal text-[11px]">
                  (ej: 25 K)
                </span>
              </label>
              <input
                type="number"
                min="1"
                value={tempSebuscalin}
                onChange={(e) => onTempSebuscalinChange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm font-mono focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onSaveRates}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow cursor-pointer"
            >
              Guardar Cotización
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};
