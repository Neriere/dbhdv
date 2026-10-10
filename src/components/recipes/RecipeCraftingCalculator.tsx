import React from 'react';
import { Briefcase } from 'lucide-react';
import { ItemPriceHistoryModal } from '../ItemPriceHistoryModal';
import { QuickQuoteModal } from './QuickQuoteModal';
import { RecipeCatalogFilters } from './RecipeCatalogFilters';
import { RecipeDetailView } from './RecipeDetailView';
import { RecipeCatalogCard } from './RecipeCatalogCard';
import { RecipeCatalogPagination } from './RecipeCatalogPagination';
import { RecipeCalculatorProps } from './types';
import { useRecipeCalculator } from './useRecipeCalculator';
import { clearRecipeTreeCache } from '../../services/dofusDbService';
import { getStoredSalesVolumeMap } from '../../services/salesVolumeService';

export const RecipeCraftingCalculator: React.FC<RecipeCalculatorProps> = ({
  initialSelectedItem,
  onSelectForCrushing,
}) => {
  const {
    isDetailView,
    setIsDetailView,
    selectedJobId,
    setSelectedJobId,
    minLevel,
    setMinLevel,
    maxLevel,
    setMaxLevel,
    searchTerm,
    setSearchTerm,
    sortBy,
    setSortBy,
    onlyProfitable,
    setOnlyProfitable,
    minProfitKamas,
    setMinProfitKamas,
    quotationFilter,
    setQuotationFilter,
    minDailySales,
    setMinDailySales,
    onlyWithSalesData,
    setOnlyWithSalesData,
    onlyFullyPricedIngredients,
    setOnlyFullyPricedIngredients,
    minRoi,
    setMinRoi,
    maxCraftCost,
    setMaxCraftCost,
    itemForQuickQuote,
    setItemForQuickQuote,
    activePresetItem,
    recipeTree,
    loadingTree,
    itemForHistory,
    setItemForHistory,
    activeSalePrice,
    salePriceDraft,
    setSalePriceDraft,
    treeExpandTrigger,
    setTreeExpandTrigger,
    salesVolumeMap,
    setSalesVolumeMap,
    marketPrices,
    effectivePriceUpdatedAt,
    selectedBycMethods,
    isSyncingLive,
    lastSyncNotice,
    itemsPerPage,
    setItemsPerPage,
    allCraftableItems,
    quotedCount,
    hasActiveFilters,
    itemMetricsMap,
    filteredItems,
    totalPages,
    safeCurrentPage,
    paginatedItems,
    directCraftCost,
    autoOptimalCost,
    activeProfileId,
    isUserJobsEnabled,
    handleSelectBycMethod,
    handlePriceChange,
    handleCommitSalePrice,
    handleManualSync,
    handleResetFilters,
    handleSelectItemForDetail,
    refreshPrices,
    setRecipeTreeVersion,
    setCurrentPage,
  } = useRecipeCalculator(initialSelectedItem);

  // VIEW MODE A: DEDICATED FULL-WIDTH ITEM PAGE
  if (isDetailView && activePresetItem) {
    return (
      <div className="space-y-4 w-full">
        <RecipeDetailView
          activePresetItem={activePresetItem}
          onBackToCatalog={() => setIsDetailView(false)}
          lastSyncNotice={lastSyncNotice}
          isSyncingLive={isSyncingLive}
          onManualSync={handleManualSync}
          activeSalePrice={activeSalePrice}
          salePriceDraft={salePriceDraft}
          onSalePriceDraftChange={setSalePriceDraft}
          onCommitSalePrice={handleCommitSalePrice}
          effectivePriceUpdatedAt={effectivePriceUpdatedAt}
          autoOptimalCost={autoOptimalCost}
          directCraftCost={directCraftCost}
          onSelectForCrushing={onSelectForCrushing}
          onOpenHistory={setItemForHistory}
          recipeTree={recipeTree}
          loadingTree={loadingTree}
          marketPrices={marketPrices}
          treeExpandTrigger={treeExpandTrigger}
          onSetTreeExpandTrigger={setTreeExpandTrigger}
          selectedBycMethods={selectedBycMethods}
          onPriceChange={handlePriceChange}
          onSelectBycMethod={handleSelectBycMethod}
        />

        {/* Item Price History Modal */}
        <ItemPriceHistoryModal
          item={itemForHistory}
          isOpen={!!itemForHistory}
          onClose={() => setItemForHistory(null)}
          profileId={activeProfileId}
          onPriceChanged={() => {
            clearRecipeTreeCache();
            setRecipeTreeVersion((v) => v + 1);
            refreshPrices();
          }}
        />
      </div>
    );
  }

  // VIEW MODE B: FULL CATALOG & SEARCH PAGE
  return (
    <div className="space-y-4 w-full">
      <RecipeCatalogFilters
        selectedJobId={selectedJobId}
        onSelectJobId={setSelectedJobId}
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        minLevel={minLevel}
        maxLevel={maxLevel}
        onMinLevelChange={setMinLevel}
        onMaxLevelChange={setMaxLevel}
        onLevelRangeChange={(min, max) => {
          setMinLevel(min);
          setMaxLevel(max);
        }}
        quotationFilter={quotationFilter}
        onQuotationFilterChange={setQuotationFilter}
        onlyProfitable={onlyProfitable}
        onOnlyProfitableChange={setOnlyProfitable}
        onlyFullyPricedIngredients={onlyFullyPricedIngredients}
        onOnlyFullyPricedIngredientsChange={setOnlyFullyPricedIngredients}
        minDailySales={minDailySales}
        onMinDailySalesChange={setMinDailySales}
        onlyWithSalesData={onlyWithSalesData}
        onOnlyWithSalesDataChange={setOnlyWithSalesData}
        minProfit={minProfitKamas}
        onMinProfitChange={setMinProfitKamas}
        minRoi={minRoi}
        onMinRoiChange={setMinRoi}
        maxCraftCost={maxCraftCost}
        onMaxCraftCostChange={setMaxCraftCost}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        totalItemsCount={allCraftableItems.length}
        filteredItemsCount={filteredItems.length}
        quotedItemsCount={quotedCount}
        onResetFilters={handleResetFilters}
        hasActiveFilters={hasActiveFilters}
      />

      {/* User Jobs Global Filter Notice */}
      {isUserJobsEnabled && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs shadow-sm animate-fade-in">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
              <Briefcase className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <span className="truncate">
              <strong>Filtro global de oficios activo:</strong> Mostrando únicamente recetas que tu personaje puede craftear según tus niveles de oficio.
            </span>
          </div>
          <span className="text-[11px] font-mono text-emerald-400/80 shrink-0 font-bold">
            {filteredItems.length} objetos disponibles
          </span>
        </div>
      )}

      {/* Catalog Grid Cards */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {paginatedItems.map((item) => {
            const metrics = itemMetricsMap.get(item.id) || {
              cost: 0,
              salePrice: 0,
              netProfit: 0,
              roi: 0,
              missingIngredientsCount: 0,
              hasFullIngredientPrices: false,
              avgDailySales: 0,
              hasSalesData: false,
              expectedDailyFlow: 0,
              daysToSell: null,
              turnoverRating: null,
              turnoverLabel: null,
            };

            return (
              <RecipeCatalogCard
                key={item.id}
                item={item}
                metrics={metrics}
                priceUpdatedAt={effectivePriceUpdatedAt[item.id]}
                onSelectItem={handleSelectItemForDetail}
                onOpenHistory={setItemForHistory}
                onQuickQuote={setItemForQuickQuote}
              />
            );
          })}
        </div>

        {filteredItems.length === 0 && (
          <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 text-xs">
            No se encontraron objetos con los filtros seleccionados.
          </div>
        )}

        {/* Catalog Pagination Controls */}
        {filteredItems.length > 0 && (
          <RecipeCatalogPagination
            safeCurrentPage={safeCurrentPage}
            totalPages={totalPages}
            itemsPerPage={itemsPerPage}
            filteredItemsCount={filteredItems.length}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={setItemsPerPage}
          />
        )}
      </div>

      {/* Item Price History Modal */}
      <ItemPriceHistoryModal
        item={itemForHistory}
        isOpen={!!itemForHistory}
        onClose={() => setItemForHistory(null)}
        profileId={activeProfileId}
        onPriceChanged={() => {
          clearRecipeTreeCache();
          setRecipeTreeVersion((v) => v + 1);
          refreshPrices();
        }}
      />

      {/* Quick Quote & Sales Volume Modal */}
      <QuickQuoteModal
        item={itemForQuickQuote}
        isOpen={!!itemForQuickQuote}
        onClose={() => setItemForQuickQuote(null)}
        currentPrice={
          itemForQuickQuote ? marketPrices[itemForQuickQuote.id] || 0 : 0
        }
        craftCost={
          itemForQuickQuote
            ? itemMetricsMap.get(itemForQuickQuote.id)?.cost || 0
            : 0
        }
        salesVolume={
          itemForQuickQuote ? salesVolumeMap[itemForQuickQuote.id] : undefined
        }
        onSavePrice={handlePriceChange}
        onSaveVolume={() => {
          setSalesVolumeMap(getStoredSalesVolumeMap());
        }}
        onOpenHistory={setItemForHistory}
      />
    </div>
  );
};

export default RecipeCraftingCalculator;
