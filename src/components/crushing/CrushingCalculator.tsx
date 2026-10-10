import React from 'react';
import { CrushingCalculatorProps } from './types';
import { useCrushingCalculator } from './useCrushingCalculator';
import { CrushingHeader } from './CrushingHeader';
import { CrushingCatalogView } from './CrushingCatalogView';
import { CrushingDetailView } from './CrushingDetailView';
import { CrushingRunePricesView } from './CrushingRunePricesView';
import { DofocusSyncModal } from './DofocusSyncModal';

export const CrushingCalculator: React.FC<CrushingCalculatorProps> = (props) => {
  const calc = useCrushingCalculator(props);

  return (
    <div className="space-y-5 w-full pb-12">
      {/* Top Header & Navigation Bar */}
      <CrushingHeader
        crushableItemsCount={calc.crushableItems.length}
        activeProfile={calc.activeProfile}
        onOpenDofocusModal={() => calc.setIsDofocusModalOpen(true)}
        viewMode={calc.viewMode}
        setViewMode={calc.setViewMode}
        selectedItem={calc.selectedItem}
      />

      {/* 1. VISTA: CATÁLOGO Y LISTADO DE MACHACADO */}
      {calc.viewMode === 'catalog' && (
        <CrushingCatalogView
          selectedSlots={calc.selectedSlots}
          onToggleSlot={calc.handleToggleSlot}
          minLevel={calc.minLevel}
          setMinLevel={calc.setMinLevel}
          maxLevel={calc.maxLevel}
          setMaxLevel={calc.setMaxLevel}
          minCoeff={calc.minCoeff}
          setMinCoeff={calc.setMinCoeff}
          maxCoeff={calc.maxCoeff}
          setMaxCoeff={calc.setMaxCoeff}
          dateFilter={calc.dateFilter}
          setDateFilter={calc.setDateFilter}
          isStatsFilterOpen={calc.isStatsFilterOpen}
          setIsStatsFilterOpen={calc.setIsStatsFilterOpen}
          selectedStatFilterIds={calc.selectedStatFilterIds}
          onToggleStatFilter={calc.handleToggleStatFilter}
          onClearAllFilters={calc.handleClearAllFilters}
          onClearStatsOnly={calc.handleClearStatsOnly}
          searchQuery={calc.searchQuery}
          setSearchQuery={calc.setSearchQuery}
          sortBy={calc.sortBy}
          setSortBy={calc.setSortBy}
          currentPage={calc.currentPage}
          setCurrentPage={calc.setCurrentPage}
          isUserJobsEnabled={calc.isUserJobsEnabled}
          processedCatalogItems={calc.processedCatalogItems}
          paginatedCatalogItems={calc.paginatedCatalogItems}
          totalPages={calc.totalPages}
          onOpenDetail={calc.handleOpenDetail}
        />
      )}

      {/* 2. VISTA: SIMULADOR DETALLADO DEL EQUIPABLE SELECCIONADO */}
      {calc.viewMode === 'detail' && calc.selectedItem && calc.crushingSimulation && (
        <CrushingDetailView
          selectedItem={calc.selectedItem}
          setSelectedItem={calc.setSelectedItem}
          onBackToCatalog={() => calc.setViewMode('catalog')}
          detailSearchQuery={calc.detailSearchQuery}
          setDetailSearchQuery={calc.setDetailSearchQuery}
          isDetailSearchOpen={calc.isDetailSearchOpen}
          setIsDetailSearchOpen={calc.setIsDetailSearchOpen}
          detailSearchContainerRef={calc.detailSearchContainerRef}
          detailSearchResults={calc.detailSearchResults}
          crushingSimulation={calc.crushingSimulation}
          marketPrices={calc.marketPrices}
          coefficientPercent={calc.coefficientPercent}
          setCoefficientPercent={calc.setCoefficientPercent}
          savedTimestamps={calc.savedTimestamps}
          savedManualEdits={calc.savedManualEdits}
          savedCoeffFeedback={calc.savedCoeffFeedback}
          activeProfile={calc.activeProfile}
          onSaveItemCoefficient={calc.handleSaveItemCoefficient}
          onResetStatsPreset={calc.handleResetStatsToPreset}
          onSelectRecipeForCalculator={props.onSelectRecipeForCalculator}
          onOpenDofocusModal={() => calc.setIsDofocusModalOpen(true)}
          recipeIngredients={calc.recipeIngredients}
          ingredientDrafts={calc.ingredientDrafts}
          savedIngFeedback={calc.savedIngFeedback}
          onIngredientPriceDraftChange={calc.handleIngredientPriceDraftChange}
          onUpdateIngredientPrice={calc.handleUpdateIngredientPrice}
          onSelectBycMethod={calc.handleSaveSelectedBycMethod}
          runePriceDrafts={calc.runePriceDrafts}
          savedRuneIdFeedback={calc.savedRuneIdFeedback}
          focusedRuneId={calc.focusedRuneId}
          setFocusedRuneId={calc.setFocusedRuneId}
          onStatChange={calc.handleStatChange}
          onRunePriceDraftChange={calc.handleRunePriceDraftChange}
          onUpdateRunePrice={calc.handleUpdateRunePrice}
        />
      )}

      {/* 3. VISTA: GESTOR DE PRECIOS HDV RUNAS */}
      {calc.viewMode === 'rune_prices' && (
        <CrushingRunePricesView
          runeCategoryFilter={calc.runeCategoryFilter}
          setRuneCategoryFilter={calc.setRuneCategoryFilter}
          runeSearchTerm={calc.runeSearchTerm}
          setRuneSearchTerm={calc.setRuneSearchTerm}
          filteredBaseRunes={calc.filteredBaseRunes}
          marketPrices={calc.marketPrices}
          runePriceDrafts={calc.runePriceDrafts}
          setRunePriceDrafts={calc.setRunePriceDrafts}
          savedRuneIdFeedback={calc.savedRuneIdFeedback}
          onUpdateRunePrice={calc.handleUpdateRunePrice}
        />
      )}

      {/* DoFocus Synchronization Modal */}
      <DofocusSyncModal
        isOpen={calc.isDofocusModalOpen}
        onClose={() => calc.setIsDofocusModalOpen(false)}
        activeProfile={calc.activeProfile}
        onSyncCompleted={calc.handleDofocusSyncCompleted}
      />
    </div>
  );
};

export default CrushingCalculator;
