import React from 'react';
import {
  Zap,
  Sliders,
  Layers,
  Crosshair,
  Tag,
} from 'lucide-react';
import { PriceProfile } from '../../types';
import { CraftableItem } from '../../services/dofusDbService';
import { DOFUS_BASE_RUNES } from '../../data/dofusRuneWeights';
import { CrushingViewMode } from './types';

interface CrushingHeaderProps {
  crushableItemsCount: number;
  activeProfile?: PriceProfile;
  onOpenDofocusModal: () => void;
  viewMode: CrushingViewMode;
  setViewMode: (mode: CrushingViewMode) => void;
  selectedItem: CraftableItem | null;
}

export const CrushingHeader: React.FC<CrushingHeaderProps> = ({
  crushableItemsCount,
  activeProfile,
  onOpenDofocusModal,
  viewMode,
  setViewMode,
  selectedItem,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-2xl px-5 py-3.5 shadow-md">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
          <Zap className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-black text-xl text-white tracking-tight">
              Rompedora de Runas
            </h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {crushableItemsCount} objetos
            </span>
          </div>
        </div>
      </div>

      {/* Header Right Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={onOpenDofocusModal}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-950 hover:bg-amber-500/15 text-slate-300 hover:text-amber-300 border border-slate-800 hover:border-amber-500/40 shadow-sm transition-all cursor-pointer"
          title={`Gestor de Coeficientes de Rotura (${activeProfile?.name || 'Servidor Activo'})`}
        >
          <Sliders className="w-3.5 h-3.5 text-amber-400" />
          <span>Gestor de Coeficientes</span>
          <span className="px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold">
            {activeProfile?.name || 'Servidor'}
          </span>
        </button>

        {/* View Switcher Tabs */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0 gap-1">
          <button
            onClick={() => setViewMode('catalog')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'catalog'
                ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Catálogo
          </button>

          {selectedItem && (
            <button
              onClick={() => setViewMode('detail')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'detail'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Crosshair className="w-3.5 h-3.5" />
              Simulador
            </button>
          )}

          <button
            onClick={() => setViewMode('rune_prices')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'rune_prices'
                ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            Precios Runas ({DOFUS_BASE_RUNES.length})
          </button>
        </div>
      </div>
    </div>
  );
};
