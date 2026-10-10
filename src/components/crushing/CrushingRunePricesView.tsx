import React from 'react';
import { Search, Check, Save } from 'lucide-react';
import { RuneIcon } from '../RuneIcon';
import { DOFUS_BASE_RUNES, BaseRuneDefinition } from '../../data/dofusRuneWeights';

type RuneCategory = 'all' | 'especial' | 'primaria' | 'dano' | 'resistencia' | 'secundaria';

interface CrushingRunePricesViewProps {
  runeCategoryFilter: RuneCategory;
  setRuneCategoryFilter: (cat: RuneCategory) => void;
  runeSearchTerm: string;
  setRuneSearchTerm: (term: string) => void;
  filteredBaseRunes: BaseRuneDefinition[];
  marketPrices: Record<number, number>;
  runePriceDrafts: Record<number, string>;
  setRunePriceDrafts: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  savedRuneIdFeedback: number | null;
  onUpdateRunePrice: (runeId: number, val: string) => void;
}

export const CrushingRunePricesView: React.FC<CrushingRunePricesViewProps> = ({
  runeCategoryFilter,
  setRuneCategoryFilter,
  runeSearchTerm,
  setRuneSearchTerm,
  filteredBaseRunes,
  marketPrices,
  runePriceDrafts,
  setRunePriceDrafts,
  savedRuneIdFeedback,
  onUpdateRunePrice,
}) => {
  return (
    <div className="space-y-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setRuneCategoryFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                runeCategoryFilter === 'all'
                  ? 'bg-amber-500 text-slate-950 font-black'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              Todas ({DOFUS_BASE_RUNES.length})
            </button>
            <button
              onClick={() => setRuneCategoryFilter('especial')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                runeCategoryFilter === 'especial'
                  ? 'bg-amber-500 text-slate-950 font-black'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              Especiales
            </button>
            <button
              onClick={() => setRuneCategoryFilter('primaria')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                runeCategoryFilter === 'primaria'
                  ? 'bg-amber-500 text-slate-950 font-black'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              Primarias
            </button>
            <button
              onClick={() => setRuneCategoryFilter('resistencia')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                runeCategoryFilter === 'resistencia'
                  ? 'bg-amber-500 text-slate-950 font-black'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              Resistencias
            </button>
            <button
              onClick={() => setRuneCategoryFilter('dano')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                runeCategoryFilter === 'dano'
                  ? 'bg-amber-500 text-slate-950 font-black'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              Daños
            </button>
            <button
              onClick={() => setRuneCategoryFilter('secundaria')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                runeCategoryFilter === 'secundaria'
                  ? 'bg-amber-500 text-slate-950 font-black'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              Secundarias
            </button>
          </div>

          {/* Search in runes */}
          <div className="relative sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar runa (PA, PM, Fo, Cri...)"
              value={runeSearchTerm}
              onChange={(e) => setRuneSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>
      </div>

      {/* Grid of Runes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {filteredBaseRunes.map((rune) => {
          const currentPrice = marketPrices[rune.id] ?? rune.defaultPrice;
          const draftVal = runePriceDrafts[rune.id] ?? String(currentPrice);
          const isSaved = savedRuneIdFeedback === rune.id;

          return (
            <div
              key={rune.id}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-3 shadow-md flex items-center justify-between gap-3 transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <RuneIcon rune={rune} size="md" />
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs sm:text-sm font-black text-white truncate">
                    {rune.name}
                  </h4>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <div className="relative">
                  <input
                    type="number"
                    value={draftVal}
                    onChange={(e) =>
                      setRunePriceDrafts((prev) => ({
                        ...prev,
                        [rune.id]: e.target.value,
                      }))
                    }
                    onBlur={() => {
                      onUpdateRunePrice(rune.id, draftVal);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        onUpdateRunePrice(rune.id, draftVal);
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    className="w-24 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-right text-xs font-mono font-black text-amber-300 focus:outline-none focus:border-amber-500 pr-5"
                  />
                  <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500 font-mono">
                    K
                  </span>
                </div>

                <button
                  onClick={() => onUpdateRunePrice(rune.id, draftVal)}
                  title="Guardar precio de la runa"
                  className={`p-1.5 rounded-lg text-xs transition-all ${
                    isSaved
                      ? 'bg-emerald-500 text-slate-950 font-bold'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {isSaved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
