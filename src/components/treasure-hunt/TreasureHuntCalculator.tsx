import React from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { resolveServerSlug } from '../../data/dofusRuneWeights';
import { SEBUSCALIN_STORAGE_KEY } from '../../services/bycCostService';
import { BycDetailPage } from '../BycDetailPage';
import { BycExportExcelModal } from '../BycExportExcelModal';
import { TreasureHuntCalculatorProps } from './types';
import { useTreasureHuntCalculator } from './useTreasureHuntCalculator';
import { TreasureHuntHeroBanner } from './TreasureHuntHeroBanner';
import { TreasureHuntControlBar } from './TreasureHuntControlBar';
import { TreasureHuntCard } from './TreasureHuntCard';
import { TreasureHuntRatesModal } from './TreasureHuntRatesModal';

export const TreasureHuntCalculator: React.FC<TreasureHuntCalculatorProps> = ({
  onNavigateToShopping,
  onNavigateToBank,
}) => {
  const {
    marketPrices,
    updatePrice,
    bankInventory,
    sebuscalinPrice,
    setSebuscalinPrice,
    searchQuery,
    setSearchQuery,
    levelFilter,
    setLevelFilter,
    zoneFilter,
    setZoneFilter,
    onlyProfitable,
    setOnlyProfitable,
    sortBy,
    setSortBy,
    selectedHuntForDetail,
    setSelectedHuntForDetail,
    selectedEquipmentTab,
    setSelectedEquipmentTab,
    priceDrafts,
    handlePriceDraftChange,
    handlePriceCommit,
    isRatesModalOpen,
    setIsRatesModalOpen,
    isExcelModalOpen,
    setIsExcelModalOpen,
    tempSebuscalin,
    setTempSebuscalin,
    toastMessage,
    showToast,
    handleSaveRates,
    filteredHunts,
    totalHuntsCount,
    profitableHuntsCount,
    highestProfitHunt,
    handleAddFragmentsToShopping,
    handleAddWholeMapToShopping,
    handleAddEquipmentRecipeToShopping,
  } = useTreasureHuntCalculator();

  if (selectedHuntForDetail) {
    return (
      <div className="w-full max-w-[1760px] mx-auto px-3 sm:px-5 lg:px-8 py-6 space-y-6">
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-emerald-400/30 animate-bounce">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-medium text-sm">{toastMessage}</span>
          </div>
        )}
        <BycDetailPage
          hunt={selectedHuntForDetail}
          onBack={() => setSelectedHuntForDetail(null)}
          onSelectHunt={setSelectedHuntForDetail}
          marketPrices={marketPrices}
          bankInventory={bankInventory}
          sebuscalinPrice={sebuscalinPrice}
          onUpdateSebuscalinPrice={(p) => {
            setSebuscalinPrice(p);
            if (typeof window !== 'undefined') {
              const slug = resolveServerSlug();
              localStorage.setItem(
                `dofus_sebuscalin_unit_price_${slug}`,
                String(p)
              );
              localStorage.setItem(SEBUSCALIN_STORAGE_KEY, String(p));
            }
          }}
          onPriceChange={(itemId, newPrice) => {
            void updatePrice(itemId, newPrice);
          }}
          onNavigateToShopping={onNavigateToShopping}
          onNavigateToBank={onNavigateToBank}
          showToast={showToast}
        />
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1760px] mx-auto px-3 sm:px-5 lg:px-8 py-6 space-y-6">
      {/* Toast notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-emerald-400/30 animate-bounce">
          <CheckCircle2 className="w-5 h-5" />
          <span className="font-medium text-sm">{toastMessage}</span>
        </div>
      )}

      {/* Hero Banner */}
      <TreasureHuntHeroBanner
        sebuscalinPrice={sebuscalinPrice}
        onOpenRatesModal={() => {
          setTempSebuscalin(String(sebuscalinPrice));
          setIsRatesModalOpen(true);
        }}
        onOpenExcelModal={() => setIsExcelModalOpen(true)}
        totalHuntsCount={totalHuntsCount}
        profitableHuntsCount={profitableHuntsCount}
        highestProfitHunt={highestProfitHunt}
      />

      {/* Control Bar: Filters, Search & Sorting */}
      <TreasureHuntControlBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        levelFilter={levelFilter}
        onLevelFilterChange={setLevelFilter}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        zoneFilter={zoneFilter}
        onZoneFilterChange={setZoneFilter}
        onlyProfitable={onlyProfitable}
        onOnlyProfitableChange={setOnlyProfitable}
      />

      {/* Hunts Grid List */}
      {filteredHunts.length === 0 ? (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-12 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-amber-400 mx-auto opacity-70" />
          <h3 className="text-lg font-bold text-slate-200">
            No se encontraron búsquedas con los filtros actuales
          </h3>
          <p className="text-sm text-slate-400">
            Prueba a limpiar la búsqueda o cambiar los filtros de nivel y
            rentabilidad.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {filteredHunts.map((hunt) => (
            <TreasureHuntCard
              key={hunt.id}
              hunt={hunt}
              priceDrafts={priceDrafts}
              onPriceDraftChange={handlePriceDraftChange}
              onPriceCommit={handlePriceCommit}
              onSelectHuntForDetail={setSelectedHuntForDetail}
              selectedEquipmentTab={selectedEquipmentTab[hunt.id]}
              onSelectEquipmentTab={(eqId) =>
                setSelectedEquipmentTab((prev) => ({
                  ...prev,
                  [hunt.id]: eqId,
                }))
              }
              onAddFragmentsToShopping={handleAddFragmentsToShopping}
              onAddWholeMapToShopping={handleAddWholeMapToShopping}
              onAddEquipmentRecipeToShopping={
                handleAddEquipmentRecipeToShopping
              }
            />
          ))}
        </div>
      )}

      {/* Modal: Edit Global Currency Rates */}
      <TreasureHuntRatesModal
        isOpen={isRatesModalOpen}
        onClose={() => setIsRatesModalOpen(false)}
        tempSebuscalin={tempSebuscalin}
        onTempSebuscalinChange={setTempSebuscalin}
        onSaveRates={handleSaveRates}
      />

      {/* Excel Group Investment Export Modal */}
      <BycExportExcelModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        defaultPlayersCount={5}
        defaultSebuscalinPrice={sebuscalinPrice}
        marketPrices={marketPrices}
        onExportSuccess={(filename) => {
          showToast(`Archivo Excel descargado: ${filename}`);
        }}
      />
    </div>
  );
};

export default TreasureHuntCalculator;
