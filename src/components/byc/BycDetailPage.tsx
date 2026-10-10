import React from 'react';
import { BycExportExcelModal } from '../BycExportExcelModal';
import { BycDetailPageProps } from './types';
import { useBycDetail } from './useBycDetail';
import { BycDetailHeader } from './BycDetailHeader';
import { BycProfitabilitySection } from './BycProfitabilitySection';
import { BycEquipmentSection } from './BycEquipmentSection';

export const BycDetailPage: React.FC<BycDetailPageProps> = ({
  hunt,
  onBack,
  onSelectHunt,
  marketPrices,
  bankInventory,
  sebuscalinPrice,
  onUpdateSebuscalinPrice,
  onPriceChange,
  showToast,
}) => {
  const {
    isUserJobsEnabled,
    priceDrafts,
    handlePriceDraftChange,
    handlePriceCommit,
    huntSearch,
    setHuntSearch,
    isSwitchDropdownOpen,
    setIsSwitchDropdownOpen,
    isExcelModalOpen,
    setIsExcelModalOpen,
    salesVolumeMap,
    activeVolumeModalItemId,
    setActiveVolumeModalItemId,
    handleUpdateVolume,
    expandedEquipmentIds,
    toggleEquipmentExpand,
    selectedEquipmentMethod,
    setSelectedEquipmentMethod,
    formatKamas,
    getBankQty,
    getPrice,
    wholeMapPrice,
    resourcePriceGross,
    resourceNetIncome,
    fragmentsTotalCost,
    resourcesInBank,
    chestSebuscalines,
    missionSebuscalines,
    sebuscalinesValue,
    totalHuntNetReturn,
    profitMapNet,
    roiMap,
    profitFragsNet,
    roiFrags,
    effectiveCostViaFrags,
    bestHuntMethod,
    bestHuntInvestment,
    bestHuntProfitNet,
    bestHuntEffectiveUnitCost,
    optimalAcquisitionMethod,
    relatedEquipment,
    filteredSwitchHunts,
  } = useBycDetail({
    hunt,
    marketPrices,
    bankInventory,
    sebuscalinPrice,
    onPriceChange,
  });

  return (
    <div className="space-y-6 pb-12 animate-fadeIn" id="byc-detail-view">
      {/* Top Header & Breadcrumb */}
      <BycDetailHeader
        hunt={hunt}
        onBack={onBack}
        onSelectHunt={onSelectHunt}
        sebuscalinPrice={sebuscalinPrice}
        onUpdateSebuscalinPrice={onUpdateSebuscalinPrice}
        onOpenExcelModal={() => setIsExcelModalOpen(true)}
        isSwitchDropdownOpen={isSwitchDropdownOpen}
        onToggleSwitchDropdown={() =>
          setIsSwitchDropdownOpen(!isSwitchDropdownOpen)
        }
        onCloseSwitchDropdown={() => setIsSwitchDropdownOpen(false)}
        huntSearch={huntSearch}
        onSearchChange={setHuntSearch}
        filteredSwitchHunts={filteredSwitchHunts}
      />

      {/* Section 1: Rentabilidad de la Cacería */}
      <BycProfitabilitySection
        hunt={hunt}
        priceDrafts={priceDrafts}
        onPriceDraftChange={handlePriceDraftChange}
        onPriceCommit={handlePriceCommit}
        wholeMapPrice={wholeMapPrice}
        resourcePriceGross={resourcePriceGross}
        fragmentsTotalCost={fragmentsTotalCost}
        resourcesInBank={resourcesInBank}
        chestSebuscalines={chestSebuscalines}
        missionSebuscalines={missionSebuscalines}
        sebuscalinesValue={sebuscalinesValue}
        totalHuntNetReturn={totalHuntNetReturn}
        profitFragsNet={profitFragsNet}
        roiFrags={roiFrags}
        profitMapNet={profitMapNet}
        roiMap={roiMap}
        bestHuntMethod={bestHuntMethod}
        bestHuntProfitNet={bestHuntProfitNet}
        bestHuntInvestment={bestHuntInvestment}
        bestHuntEffectiveUnitCost={bestHuntEffectiveUnitCost}
        effectiveCostViaFrags={effectiveCostViaFrags}
        formatKamas={formatKamas}
        getPrice={getPrice}
        getBankQty={getBankQty}
      />

      {/* Section 2: Decisión de Negocio: Crafteo de Equipables */}
      <BycEquipmentSection
        hunt={hunt}
        relatedEquipment={relatedEquipment}
        isUserJobsEnabled={isUserJobsEnabled}
        fragmentsTotalCost={fragmentsTotalCost}
        wholeMapPrice={wholeMapPrice}
        resourcePriceGross={resourcePriceGross}
        resourceNetIncome={resourceNetIncome}
        sebuscalinesValue={sebuscalinesValue}
        chestSebuscalines={chestSebuscalines}
        optimalAcquisitionMethod={optimalAcquisitionMethod}
        expandedEquipmentIds={expandedEquipmentIds}
        onToggleExpand={toggleEquipmentExpand}
        selectedEquipmentMethod={selectedEquipmentMethod}
        onSelectMethod={(id, method) =>
          setSelectedEquipmentMethod((prev) => ({ ...prev, [id]: method }))
        }
        priceDrafts={priceDrafts}
        onPriceDraftChange={handlePriceDraftChange}
        onPriceCommit={handlePriceCommit}
        salesVolumeMap={salesVolumeMap}
        activeVolumeModalItemId={activeVolumeModalItemId}
        onToggleVolumeModal={(id) =>
          setActiveVolumeModalItemId(
            activeVolumeModalItemId === id ? null : id
          )
        }
        onUpdateVolume={handleUpdateVolume}
        getPrice={getPrice}
        getBankQty={getBankQty}
        formatKamas={formatKamas}
      />

      {/* Excel Export Modal */}
      <BycExportExcelModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        defaultPlayersCount={5}
        defaultSebuscalinPrice={sebuscalinPrice}
        marketPrices={marketPrices}
        onExportSuccess={(filename) => {
          showToast(`Plan de Inversión exportado: ${filename}`);
        }}
      />
    </div>
  );
};

export default BycDetailPage;
