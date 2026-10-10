import React from 'react';
import { ChevronLeft, Search } from 'lucide-react';
import { SafeImage } from '../SafeImage';
import { DofusItem, PriceProfile } from '../../types';
import {
  CraftableItem,
  getItemName,
  getItemIconUrl,
  getItemFallbackIconUrl,
} from '../../services/dofusDbService';
import { CrushingResult } from '../../data/dofusRuneWeights';
import { CrushingStrategyHero } from './CrushingStrategyHero';
import { RecipeSidebar, RecipeIngredientDetail } from './RecipeSidebar';
import { CrushingRunesTable } from './CrushingRunesTable';

interface CrushingDetailViewProps {
  selectedItem: CraftableItem;
  setSelectedItem: (item: CraftableItem) => void;
  onBackToCatalog: () => void;

  // Search & Switcher
  detailSearchQuery: string;
  setDetailSearchQuery: (q: string) => void;
  isDetailSearchOpen: boolean;
  setIsDetailSearchOpen: (open: boolean) => void;
  detailSearchContainerRef: React.RefObject<HTMLDivElement | null>;
  detailSearchResults: CraftableItem[];

  // Simulation & Hero
  crushingSimulation: CrushingResult;
  marketPrices: Record<number, number>;
  coefficientPercent: number;
  setCoefficientPercent: (coeff: number) => void;
  savedTimestamps: Record<number, number>;
  savedManualEdits: Record<number, number>;
  savedCoeffFeedback: boolean;
  activeProfile?: PriceProfile;
  onSaveItemCoefficient: (
    explicitCoeff?: number,
    options?: { timestamp?: number; isManual?: boolean }
  ) => void;
  onResetStatsPreset: (preset: 'min' | 'avg' | 'max') => void;
  onSelectRecipeForCalculator?: (item: DofusItem) => void;
  onOpenDofocusModal: () => void;

  // Recipe Sidebar
  recipeIngredients: RecipeIngredientDetail[];
  ingredientDrafts: Record<number, string>;
  savedIngFeedback: number | null;
  onIngredientPriceDraftChange: (id: number, val: string) => void;
  onUpdateIngredientPrice: (id: number, val: string) => void;
  onSelectBycMethod: (id: number, method: 'direct' | 'fragments' | 'map') => void;

  // Runes Table
  runePriceDrafts: Record<number, string>;
  savedRuneIdFeedback: number | null;
  focusedRuneId: number | null;
  setFocusedRuneId: (val: number | null | ((prev: number | null) => number | null)) => void;
  onStatChange: (runeId: number, value: string) => void;
  onRunePriceDraftChange: (runeId: number, val: string) => void;
  onUpdateRunePrice: (runeId: number, val: string) => void;
}

export const CrushingDetailView: React.FC<CrushingDetailViewProps> = ({
  selectedItem,
  setSelectedItem,
  onBackToCatalog,
  detailSearchQuery,
  setDetailSearchQuery,
  isDetailSearchOpen,
  setIsDetailSearchOpen,
  detailSearchContainerRef,
  detailSearchResults,
  crushingSimulation,
  marketPrices,
  coefficientPercent,
  setCoefficientPercent,
  savedTimestamps,
  savedManualEdits,
  savedCoeffFeedback,
  activeProfile,
  onSaveItemCoefficient,
  onResetStatsPreset,
  onSelectRecipeForCalculator,
  onOpenDofocusModal,
  recipeIngredients,
  ingredientDrafts,
  savedIngFeedback,
  onIngredientPriceDraftChange,
  onUpdateIngredientPrice,
  onSelectBycMethod,
  runePriceDrafts,
  savedRuneIdFeedback,
  focusedRuneId,
  setFocusedRuneId,
  onStatChange,
  onRunePriceDraftChange,
  onUpdateRunePrice,
}) => {
  return (
    <div className="space-y-5">
      {/* Top Return Button & Quick Item Switcher */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
        <button
          onClick={onBackToCatalog}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black bg-slate-950 text-amber-400 hover:text-amber-300 border border-amber-500/30 hover:border-amber-500/60 transition-all w-fit shadow"
        >
          <ChevronLeft className="w-4 h-4" />
          Volver al Catálogo de Rompedora
        </button>

        {/* Quick Switch Dropdown */}
        <div ref={detailSearchContainerRef} className="relative sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cambiar de objeto..."
            value={detailSearchQuery}
            onFocus={() => setIsDetailSearchOpen(true)}
            onChange={(e) => {
              setDetailSearchQuery(e.target.value);
              setIsDetailSearchOpen(true);
            }}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-8 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
          {isDetailSearchOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto z-50 divide-y divide-slate-800/60">
              {detailSearchResults.map((it) => (
                <div
                  key={it.id}
                  onClick={() => {
                    setSelectedItem(it);
                    setIsDetailSearchOpen(false);
                    setDetailSearchQuery('');
                  }}
                  className="p-2.5 flex items-center gap-2 hover:bg-slate-900 cursor-pointer transition-colors"
                >
                  <SafeImage
                    src={getItemIconUrl(it)}
                    fallbackSrc={getItemFallbackIconUrl(it)}
                    alt={getItemName(it)}
                    className="w-6 h-6 object-contain"
                  />
                  <span className="text-xs font-bold text-white truncate flex-1">
                    {getItemName(it)}
                  </span>
                  <span className="text-[10px] font-mono text-amber-400">
                    Nv.{it.level}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Detail Strategic Hero */}
      <CrushingStrategyHero
        selectedItem={selectedItem}
        craftCost={crushingSimulation.craftCost}
        marketSalePrice={Number(marketPrices[selectedItem.id] || selectedItem.defaultMarketSalePrice || 0)}
        normalTotalKamasValue={crushingSimulation.normalTotalKamasValue}
        normalNetProfit={crushingSimulation.normalNetProfit}
        bestFocusOption={crushingSimulation.bestFocusOption}
        coefficientPercent={coefficientPercent}
        savedCoefficientTimestamp={savedTimestamps[selectedItem.id]}
        isManualEdit={Boolean(savedManualEdits[selectedItem.id])}
        savedCoeffFeedback={savedCoeffFeedback}
        breakEvenCoefficient={crushingSimulation.breakEvenCoefficient}
        activeServerName={activeProfile?.name}
        activeServerSlug={activeProfile?.slug}
        onCoefficientChange={setCoefficientPercent}
        onSaveCoefficient={onSaveItemCoefficient}
        onResetStatsPreset={onResetStatsPreset}
        onSelectRecipeForCalculator={onSelectRecipeForCalculator}
        onOpenCoeffManager={onOpenDofocusModal}
      />

      {/* Main Content Layout: Left Compact Recipe | Right Main Runes Focus Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Compact Recipe & Ingredients Price Editor */}
        <div className="lg:col-span-5 xl:col-span-4">
          <RecipeSidebar
            recipeIngredients={recipeIngredients}
            totalCraftCost={crushingSimulation.craftCost}
            ingredientDrafts={ingredientDrafts}
            savedIngFeedback={savedIngFeedback}
            onDraftChange={onIngredientPriceDraftChange}
            onSavePrice={onUpdateIngredientPrice}
            onSelectBycMethod={onSelectBycMethod}
          />
        </div>

        {/* Right Column: Main Central Runes & Focus Table */}
        <div className="lg:col-span-7 xl:col-span-8">
          <CrushingRunesTable
            statYields={crushingSimulation.statYields}
            top3FocusOptions={crushingSimulation.top3FocusOptions}
            normalTotalKamasValue={crushingSimulation.normalTotalKamasValue}
            normalNetProfit={crushingSimulation.normalNetProfit}
            bestFocusOption={crushingSimulation.bestFocusOption}
            totalCraftCost={crushingSimulation.craftCost}
            breakEvenCoefficient={crushingSimulation.breakEvenCoefficient}
            runePriceDrafts={runePriceDrafts}
            savedRuneIdFeedback={savedRuneIdFeedback}
            focusedRuneId={focusedRuneId}
            onStatChange={onStatChange}
            onPriceDraftChange={onRunePriceDraftChange}
            onSaveRunePrice={onUpdateRunePrice}
            onToggleFocus={(runeId) =>
              setFocusedRuneId((prev) => (prev === runeId ? null : runeId))
            }
          />
        </div>
      </div>
    </div>
  );
};
