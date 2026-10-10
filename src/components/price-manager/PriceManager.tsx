import React from 'react';
import { Package } from 'lucide-react';
import { PriceManagerProps } from './types';
import { usePriceManager, ITEMS_PER_PAGE } from './usePriceManager';
import { PriceManagerHeader } from './PriceManagerHeader';
import { PriceManagerFilters } from './PriceManagerFilters';
import { PriceManagerTableView } from './PriceManagerTableView';
import { PriceManagerGridView } from './PriceManagerGridView';
import { PriceManagerPagination } from './PriceManagerPagination';
import { GlobalPriceHistoryModal } from '../GlobalPriceHistoryModal';
import { ItemPriceHistoryModal } from '../ItemPriceHistoryModal';
import { MarketSnifferModal } from '../MarketSnifferModal';
import { BackupModal } from '../common/BackupModal';
import { EditSalesVolumeModal } from '../common/EditSalesVolumeModal';
import {
  getItemName,
  getItemTypeName,
  getItemIconUrl,
} from '../../services/dofusDbService';

export const PriceManager: React.FC<PriceManagerProps> = ({ onSelectItemForRecipe }) => {
  const {
    items,
    marketPrices,
    setMarketPrices,
    priceUpdatedAt,
    setPriceUpdatedAt,
    priceProfiles,
    setPriceProfiles,
    activePriceProfileId,
    searchTerm,
    setSearchTerm,
    activeCategory,
    setActiveCategory,
    activeScope,
    setActiveScope,
    sortByField,
    setSortByField,
    salesVolumes,
    setCurrentPage,
    savedFeedbackItemId,
    isGlobalHistoryOpen,
    setIsGlobalHistoryOpen,
    isSnifferModalOpen,
    setIsSnifferModalOpen,
    isBackupModalOpen,
    setIsBackupModalOpen,
    itemForHistory,
    setItemForHistory,
    itemForSalesVolume,
    setItemForSalesVolume,
    viewMode,
    setViewMode,
    priceChanges,
    addedCartItemIds,
    copiedItemId,
    priceDrafts,
    setPriceDrafts,
    recipeIngredientIds,
    craftableItemIds,
    filteredItems,
    totalPages,
    safeCurrentPage,
    paginatedItems,
    categoryCounts,
    scopeCounts,
    handlePriceUpdate,
    handlePriceDraftChange,
    handleAddToShoppingList,
    handleCopyItemName,
    handleChangeProfile,
    refreshPrices,
    refreshSalesVolumes,
  } = usePriceManager();

  const activeProfile = priceProfiles.find((p) => p.id === activePriceProfileId);
  const activeProfileName = activeProfile?.name || 'General';

  return (
    <div className="space-y-4">
      {/* 1. Header con acciones globales */}
      <PriceManagerHeader
        activeProfileName={activeProfileName}
        hasPriceCount={categoryCounts.has_price}
        onOpenBackupModal={() => setIsBackupModalOpen(true)}
        onOpenSnifferModal={() => setIsSnifferModalOpen(true)}
        onOpenGlobalHistoryModal={() => setIsGlobalHistoryOpen(true)}
      />

      {/* 2. Filtros, buscador y categorías */}
      <PriceManagerFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        priceProfiles={priceProfiles}
        activePriceProfileId={activePriceProfileId}
        onChangeProfile={handleChangeProfile}
        viewMode={viewMode}
        setViewMode={setViewMode}
        filteredCount={filteredItems.length}
        totalScopeCount={scopeCounts.all}
        activeScope={activeScope}
        setActiveScope={setActiveScope}
        scopeCounts={scopeCounts}
        sortByField={sortByField}
        setSortByField={setSortByField}
        activeCategory={activeCategory}
        setActiveCategory={setActiveCategory}
        categoryCounts={categoryCounts}
      />

      {/* 3. Contenido (Tabla o Cuadrícula) */}
      {filteredItems.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 space-y-3">
          <Package className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-white">Sin resultados</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Ajusta la búsqueda o el filtro seleccionado.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {viewMode === 'table' ? (
            <PriceManagerTableView
              paginatedItems={paginatedItems}
              marketPrices={marketPrices}
              priceDrafts={priceDrafts}
              priceUpdatedAt={priceUpdatedAt}
              savedFeedbackItemId={savedFeedbackItemId}
              recipeIngredientIds={recipeIngredientIds}
              craftableItemIds={craftableItemIds}
              salesVolumes={salesVolumes}
              addedCartItemIds={addedCartItemIds}
              copiedItemId={copiedItemId}
              priceChanges={priceChanges}
              onPriceDraftChange={handlePriceDraftChange}
              onPriceUpdate={handlePriceUpdate}
              onCopyItemName={handleCopyItemName}
              onAddToShoppingList={handleAddToShoppingList}
              onOpenItemHistory={setItemForHistory}
              onOpenSalesVolume={setItemForSalesVolume}
              onSelectItemForRecipe={onSelectItemForRecipe}
            />
          ) : (
            <PriceManagerGridView
              paginatedItems={paginatedItems}
              marketPrices={marketPrices}
              priceDrafts={priceDrafts}
              priceUpdatedAt={priceUpdatedAt}
              savedFeedbackItemId={savedFeedbackItemId}
              recipeIngredientIds={recipeIngredientIds}
              craftableItemIds={craftableItemIds}
              salesVolumes={salesVolumes}
              addedCartItemIds={addedCartItemIds}
              priceChanges={priceChanges}
              onPriceDraftChange={handlePriceDraftChange}
              onPriceUpdate={handlePriceUpdate}
              onAddToShoppingList={handleAddToShoppingList}
              onOpenItemHistory={setItemForHistory}
              onOpenSalesVolume={setItemForSalesVolume}
              onSelectItemForRecipe={onSelectItemForRecipe}
            />
          )}

          {/* 4. Paginación */}
          <PriceManagerPagination
            safeCurrentPage={safeCurrentPage}
            totalPages={totalPages}
            totalItems={filteredItems.length}
            itemsPerPage={ITEMS_PER_PAGE}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {/* 5. Modales */}
      <GlobalPriceHistoryModal
        isOpen={isGlobalHistoryOpen}
        onClose={() => setIsGlobalHistoryOpen(false)}
        onPriceChanged={refreshPrices}
      />

      <ItemPriceHistoryModal
        item={itemForHistory}
        isOpen={!!itemForHistory}
        onClose={() => setItemForHistory(null)}
        onPriceChanged={refreshPrices}
      />

      <MarketSnifferModal
        isOpen={isSnifferModalOpen}
        onClose={() => setIsSnifferModalOpen(false)}
        activeProfile={activeProfile}
        onPriceUpdated={refreshPrices}
      />

      <BackupModal
        isOpen={isBackupModalOpen}
        onClose={() => {
          setIsBackupModalOpen(false);
          refreshPrices();
          setPriceProfiles(priceProfiles);
        }}
      />

      {itemForSalesVolume && (
        <EditSalesVolumeModal
          isOpen={!!itemForSalesVolume}
          onClose={() => setItemForSalesVolume(null)}
          itemId={itemForSalesVolume.id}
          itemName={getItemName(itemForSalesVolume)}
          itemIconUrl={getItemIconUrl(itemForSalesVolume)}
          itemLevel={itemForSalesVolume.level}
          itemType={getItemTypeName(itemForSalesVolume)}
          currentPrice={marketPrices[itemForSalesVolume.id] || 0}
          initialSalesVolume={salesVolumes[itemForSalesVolume.id]}
          onSaved={refreshSalesVolumes}
        />
      )}
    </div>
  );
};

export default PriceManager;
