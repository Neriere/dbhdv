import React from 'react';
import {
  ArrowLeft,
  Coins,
  FileSpreadsheet,
  Search,
  ChevronDown,
} from 'lucide-react';
import { LegendaryHuntInfo } from '../../data/legendaryHuntsData';

interface BycDetailHeaderProps {
  hunt: LegendaryHuntInfo;
  onBack: () => void;
  onSelectHunt: (hunt: LegendaryHuntInfo) => void;
  sebuscalinPrice: number;
  onUpdateSebuscalinPrice: (price: number) => void;
  onOpenExcelModal: () => void;
  isSwitchDropdownOpen: boolean;
  onToggleSwitchDropdown: () => void;
  onCloseSwitchDropdown: () => void;
  huntSearch: string;
  onSearchChange: (search: string) => void;
  filteredSwitchHunts: LegendaryHuntInfo[];
}

export const BycDetailHeader: React.FC<BycDetailHeaderProps> = ({
  hunt,
  onBack,
  onSelectHunt,
  sebuscalinPrice,
  onUpdateSebuscalinPrice,
  onOpenExcelModal,
  isSwitchDropdownOpen,
  onToggleSwitchDropdown,
  onCloseSwitchDropdown,
  huntSearch,
  onSearchChange,
  filteredSwitchHunts,
}) => {
  return (
    <div className="relative z-30 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl backdrop-blur-md">
      <div className="flex items-center gap-3 sm:gap-4 flex-wrap sm:flex-nowrap">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 transition font-medium text-xs sm:text-sm shadow-sm shrink-0"
        >
          <ArrowLeft className="w-4 h-4 text-emerald-400" />
          <span>Volver a la lista</span>
        </button>

        <div className="h-6 w-px bg-slate-700 hidden sm:block" />

        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Nv. {hunt.monsterLevel}
            </span>
            <h1 className="text-lg md:text-xl font-bold text-white tracking-tight">
              {hunt.monsterName}
            </h1>
            {hunt.zone && (
              <span className="text-xs text-slate-300 bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700">
                {hunt.zone}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Requisito de búsqueda:{' '}
            <span className="text-slate-300 font-medium">
              {hunt.levelRequirement}
            </span>
          </p>
        </div>
      </div>

      {/* Right Controls: Sebuscalin Quote + Quick Hunt Switcher */}
      <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap shrink-0">
        {/* Inline Sebuscalin Quote Input */}
        <div className="bg-slate-950/90 border border-amber-500/40 rounded-xl px-3 py-1.5 flex items-center gap-2 shadow-sm">
          <Coins className="w-4 h-4 text-amber-400 shrink-0" />
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold text-amber-300 tracking-wider">
              1 Sebuscalín =
            </span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="1"
                step="1"
                value={sebuscalinPrice}
                onChange={(e) =>
                  onUpdateSebuscalinPrice(
                    Math.max(1, Number(e.target.value) || 1)
                  )
                }
                className="w-16 bg-slate-900 border border-amber-500/50 rounded-md px-1.5 py-0.5 text-xs font-mono font-bold text-amber-300 text-right focus:outline-none focus:border-amber-400"
              />
              <span className="text-xs text-slate-400 font-mono">K</span>
            </div>
          </div>
        </div>

        {/* Excel Export Button */}
        <button
          type="button"
          onClick={onOpenExcelModal}
          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600/90 hover:bg-emerald-500 text-white rounded-xl border border-emerald-400/40 text-xs sm:text-sm font-semibold transition shadow-md shadow-emerald-950/40 shrink-0"
          title="Exportar Plan de Inversión Grupal (.xlsx)"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span className="hidden sm:inline">Exportar Excel</span>
        </button>

        {/* Quick Hunt Switcher */}
        <div className="relative">
          <button
            onClick={onToggleSwitchDropdown}
            className="flex items-center justify-between gap-2.5 px-3 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-xl border border-slate-700 text-xs sm:text-sm font-medium transition w-full sm:w-56"
          >
            <span className="truncate flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              Cambiar monstruo...
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          </button>

          {isSwitchDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={onCloseSwitchDropdown}
              />
              <div className="absolute right-0 mt-2 w-72 max-h-80 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col">
                <div className="p-2 border-b border-slate-800">
                  <input
                    type="text"
                    placeholder="Buscar ByC..."
                    value={huntSearch}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                    autoFocus
                  />
                </div>
                <div className="overflow-y-auto max-h-64 p-1">
                  {filteredSwitchHunts.map((h) => (
                    <button
                      key={h.id}
                      onClick={() => {
                        onSelectHunt(h);
                        onCloseSwitchDropdown();
                        onSearchChange('');
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-left rounded-lg text-xs transition ${
                        h.id === hunt.id
                          ? 'bg-emerald-600/30 text-emerald-300 font-semibold'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <span className="truncate">{h.monsterName}</span>
                      <span className="text-[10px] text-slate-400 ml-2">
                        Nv. {h.monsterLevel}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
