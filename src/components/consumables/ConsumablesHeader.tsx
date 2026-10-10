import React from 'react';
import { Scroll, Coins, Sparkles } from 'lucide-react';
import { MainTab } from './types';

interface ConsumablesHeaderProps {
  activeTab: MainTab;
  onTabChange: (tab: MainTab) => void;
}

export const ConsumablesHeader: React.FC<ConsumablesHeaderProps> = ({
  activeTab,
  onTabChange,
}) => {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
      <div>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/30 text-amber-400">
            <Scroll className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-100 flex items-center gap-2.5">
              Consumibles de Características & Pergaminos
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono font-medium">
                Sebuscalines & Recolección
              </span>
            </h1>
          </div>
        </div>
      </div>

      {/* Selector de Pestaña Principal */}
      <div className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800 shadow-inner">
        <button
          onClick={() => onTabChange('scrolls')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'scrolls'
              ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Coins className="w-4 h-4" />
          <span>Pergaminos & Sebuscalines</span>
          <span className="text-xs px-1.5 py-0.2 rounded bg-black/20 font-mono">25</span>
        </button>

        <button
          onClick={() => onTabChange('consumables')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'consumables'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 shadow-md shadow-emerald-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Consumibles de Oficios</span>
          <span className="text-xs px-1.5 py-0.2 rounded bg-black/20 font-mono">83</span>
        </button>
      </div>
    </div>
  );
};
