import React from 'react';
import { getItemIconUrl } from '../../services/dofusDbService';
import { EditSalesVolumeModal } from '../common/EditSalesVolumeModal';
import { ConsumablesHeader } from './ConsumablesHeader';
import { ScrollsTabKpiBar } from './ScrollsTabKpiBar';
import { ConsumablesFiltersBar } from './ConsumablesFiltersBar';
import { ScrollsSimulatorPanel } from './ScrollsSimulatorPanel';
import { ScrollsTableView } from './ScrollsTableView';
import { ConsumablesLevelingComparison } from './ConsumablesLevelingComparison';
import { ConsumablesTableView } from './ConsumablesTableView';
import { useConsumablesView } from './useConsumablesView';

export const ConsumablesCharacteristicView: React.FC = () => {
  const {
    isUserJobsEnabled,
    activeTab,
    setActiveTab,
    marketPrices,
    salesVolumes,
    statFilter,
    setStatFilter,
    jobFilter,
    setJobFilter,
    searchQuery,
    setSearchQuery,
    limitFilter,
    setLimitFilter,
    editingPriceId,
    setEditingPriceId,
    tempPriceValue,
    setTempPriceValue,
    scrollForSalesVolume,
    setScrollForSalesVolume,
    sortField,
    setSortField,
    sortAsc,
    setSortAsc,
    isSimulatorOpen,
    setIsSimulatorOpen,
    availableSebuscalines,
    setAvailableSebuscalines,
    simulationMode,
    setSimulationMode,
    statToLevelUp,
    setStatToLevelUp,
    tourmalinePrice,
    tourmalineRatio,
    filteredScrolls,
    topProfitScroll,
    topVolumeScroll,
    avgMarketRatio,
    filteredConsumables,
    statProgressionAnalysis,
    simulationResults,
    handleSavePrice,
    refreshData,
  } = useConsumablesView();

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <ConsumablesHeader activeTab={activeTab} onTabChange={setActiveTab} />

      {/* KPI Bar for Scrolls tab */}
      {activeTab === 'scrolls' && (
        <ScrollsTabKpiBar
          topProfitScroll={topProfitScroll}
          tourmalinePrice={tourmalinePrice}
          tourmalineRatio={tourmalineRatio}
          topVolumeScroll={topVolumeScroll}
          avgMarketRatio={avgMarketRatio}
        />
      )}

      {/* Filters Bar */}
      <ConsumablesFiltersBar
        activeTab={activeTab}
        statFilter={statFilter}
        onSetStatFilter={setStatFilter}
        searchQuery={searchQuery}
        onSetSearchQuery={setSearchQuery}
        jobFilter={jobFilter}
        onSetJobFilter={setJobFilter}
        limitFilter={limitFilter}
        onSetLimitFilter={setLimitFilter}
      />

      {/* Scrolls Tab Content */}
      {activeTab === 'scrolls' && (
        <>
          <ScrollsSimulatorPanel
            isSimulatorOpen={isSimulatorOpen}
            onToggleSimulator={() => setIsSimulatorOpen((prev) => !prev)}
            availableSebuscalines={availableSebuscalines}
            onChangeAvailableSebuscalines={setAvailableSebuscalines}
            simulationMode={simulationMode}
            onChangeSimulationMode={setSimulationMode}
            simulationResults={simulationResults}
          />

          <ScrollsTableView
            filteredScrolls={filteredScrolls}
            topProfitScroll={topProfitScroll}
            topVolumeScroll={topVolumeScroll}
            tourmalineRatio={tourmalineRatio}
            editingPriceId={editingPriceId}
            tempPriceValue={tempPriceValue}
            sortField={sortField}
            sortAsc={sortAsc}
            onSetSortField={setSortField}
            onSetSortAsc={setSortAsc}
            onStartEditingPrice={(id, price) => {
              setEditingPriceId(id);
              setTempPriceValue(String(price || ''));
            }}
            onChangeTempPrice={setTempPriceValue}
            onSavePrice={handleSavePrice}
            onCancelEditPrice={() => setEditingPriceId(null)}
            onOpenSalesVolume={setScrollForSalesVolume}
          />
        </>
      )}

      {/* Consumables Tab Content */}
      {activeTab === 'consumables' && (
        <div className="space-y-6">
          <ConsumablesLevelingComparison
            statToLevelUp={statToLevelUp}
            onSetStatToLevelUp={setStatToLevelUp}
            statProgressionAnalysis={statProgressionAnalysis}
          />

          <ConsumablesTableView
            filteredConsumables={filteredConsumables}
            isUserJobsEnabled={isUserJobsEnabled}
          />
        </div>
      )}

      {/* Modal para editar ventas 24h, 7d y 30d */}
      {scrollForSalesVolume && (
        <EditSalesVolumeModal
          isOpen={!!scrollForSalesVolume}
          onClose={() => setScrollForSalesVolume(null)}
          itemId={scrollForSalesVolume.id}
          itemName={scrollForSalesVolume.name}
          itemIconUrl={getItemIconUrl(scrollForSalesVolume.iconId)}
          itemLevel={scrollForSalesVolume.maxStatLimit}
          itemType={`Pergamino • ${scrollForSalesVolume.stat}`}
          currentPrice={marketPrices[scrollForSalesVolume.id] || 0}
          initialSalesVolume={salesVolumes[scrollForSalesVolume.id]}
          onSaved={refreshData}
        />
      )}
    </div>
  );
};

export default ConsumablesCharacteristicView;
