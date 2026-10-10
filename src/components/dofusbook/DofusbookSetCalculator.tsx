import React from 'react';
import { Layers, ShoppingCart } from 'lucide-react';
import { DofusbookSetCalculatorProps } from './types';
import { useDofusbookCalculator } from './useDofusbookCalculator';
import { DofusbookHeader } from './DofusbookHeader';
import { DofusbookBuildSummary } from './DofusbookBuildSummary';
import { DofusbookComparisonTable } from './DofusbookComparisonTable';
import { DofusbookMaterialsList } from './DofusbookMaterialsList';

export const DofusbookSetCalculator: React.FC<DofusbookSetCalculatorProps> = (props) => {
  const calc = useDofusbookCalculator(props);

  return (
    <div className="space-y-5 pb-12">
      {/* Header Banner */}
      <DofusbookHeader
        urlInput={calc.urlInput}
        setUrlInput={calc.setUrlInput}
        isLoading={calc.isLoading}
        error={calc.error}
        excludeDofus={calc.excludeDofus}
        excludeTrophies={calc.excludeTrophies}
        onAnalyze={calc.handleAnalyze}
        onToggleExcludeDofus={calc.toggleExcludeDofus}
        onToggleExcludeTrophies={calc.toggleExcludeTrophies}
      />

      {/* Analysis Results View */}
      {calc.analysis && (
        <div className="space-y-5 animate-in fade-in duration-300">
          {/* Build Info, Progress Bar, KPI Summary */}
          <DofusbookBuildSummary
            analysis={calc.analysis}
            computedData={calc.computedData}
            copiedSummary={calc.copiedSummary}
            shoppingAddedToast={calc.shoppingAddedToast}
            onNavigateToShopping={props.onNavigateToShopping}
            onClearSet={calc.handleClearSet}
            onRemoveOwnedItems={calc.removeOwnedItems}
            onResetAllStatuses={calc.resetAllStatuses}
            onMarkAllAsOwned={calc.markAllAsOwned}
            onCopySummary={calc.handleCopySummary}
            onSendToShoppingList={calc.handleSendToShoppingList}
          />

          {/* Tab Navigation */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => calc.setActiveTabSection('comparison')}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  calc.activeTabSection === 'comparison'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Desglose por Pieza ({calc.computedData.activePiecesCount})</span>
              </button>

              <button
                type="button"
                onClick={() => calc.setActiveTabSection('materials')}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  calc.activeTabSection === 'materials'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <ShoppingCart className="w-4 h-4" />
                <span>Materiales Requeridos ({calc.computedData.consolidatedIngredients.length})</span>
              </button>
            </div>
          </div>

          {/* TAB 1: Comparison Table */}
          {calc.activeTabSection === 'comparison' && (
            <DofusbookComparisonTable
              filteredItems={calc.filteredItems}
              computedData={calc.computedData}
              filterStatus={calc.filterStatus}
              setFilterStatus={calc.setFilterStatus}
              showOnlyCraftable={calc.showOnlyCraftable}
              setShowOnlyCraftable={calc.setShowOnlyCraftable}
              expandedItems={calc.expandedItems}
              onToggleItemExpand={calc.toggleItemExpand}
              onExpandAllRecipes={calc.expandAllRecipes}
              onCollapseAllRecipes={calc.collapseAllRecipes}
              editingPriceItemId={calc.editingPriceItemId}
              setEditingPriceItemId={calc.setEditingPriceItemId}
              tempPriceInput={calc.tempPriceInput}
              setTempPriceInput={calc.setTempPriceInput}
              obtainedMaterialIds={calc.obtainedMaterialIds}
              onToggleMaterialObtained={calc.toggleMaterialObtained}
              onToggleItemOwned={calc.toggleItemOwned}
              onToggleItemRemoved={calc.toggleItemRemoved}
              onRestoreItem={calc.restoreItem}
              onRestoreAllRemoved={calc.restoreAllRemoved}
              onSavePrice={calc.handleSavePrice}
              onSelectRecipeForCalculator={props.onSelectRecipeForCalculator}
              onSelectForCrushing={props.onSelectForCrushing}
            />
          )}

          {/* TAB 2: Consolidated Ingredients Shopping List */}
          {calc.activeTabSection === 'materials' && (
            <DofusbookMaterialsList
              computedData={calc.computedData}
              materialsFilter={calc.materialsFilter}
              setMaterialsFilter={calc.setMaterialsFilter}
              editingPriceItemId={calc.editingPriceItemId}
              setEditingPriceItemId={calc.setEditingPriceItemId}
              tempPriceInput={calc.tempPriceInput}
              setTempPriceInput={calc.setTempPriceInput}
              onToggleMaterialObtained={calc.toggleMaterialObtained}
              onResetObtainedMaterials={calc.resetObtainedMaterials}
              onSendToShoppingList={calc.handleSendToShoppingList}
              onSavePrice={calc.handleSavePrice}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default DofusbookSetCalculator;
