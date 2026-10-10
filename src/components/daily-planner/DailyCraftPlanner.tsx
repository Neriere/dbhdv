import React, { useState } from 'react';
import { SalesAnalyticsView } from '../planner/SalesAnalyticsView';
import { UserJobsModal } from '../common/UserJobsModal';
import { addToShoppingList } from '../../services/dofusDbService';
import { DailyCraftPlannerProps } from './types';
import { useDailyPlanner } from './useDailyPlanner';
import { DailyPlannerHeader } from './DailyPlannerHeader';
import { DailyPlannerConfig } from './DailyPlannerConfig';
import { DailyPlannerSummary } from './DailyPlannerSummary';
import { DailyPlannerMaterials } from './DailyPlannerMaterials';
import { DailyPlannerPosted } from './DailyPlannerPosted';
import { DailyPlannerItemList } from './DailyPlannerItemList';

export const DailyCraftPlanner: React.FC<DailyCraftPlannerProps> = (props) => {
  const {
    budget,
    budgetInput,
    handleBudgetChange,
    handleApplyPresetBudget,
    optimizationMode,
    setOptimizationMode,
    marketChannel,
    setMarketChannel,
    targetDays,
    setTargetDays,
    maxEquipSlots,
    setMaxEquipSlots,
    maxConsumableSlots,
    setMaxConsumableSlots,
    maxResourceSlots,
    setMaxResourceSlots,
    maxBudgetShare,
    setMaxBudgetShare,
    maxMarketShare,
    setMaxMarketShare,
    onlyMyJobs,
    setOnlyMyJobs,
    requireSalesHistory,
    setRequireSalesHistory,
    recentSalesOnly,
    setRecentSalesOnly,
    filterOutliers,
    setFilterOutliers,
    selectedJobFilter,
    setSelectedJobFilter,
    minRoiFilter,
    setMinRoiFilter,
    minDailySales,
    setMinDailySales,
    excludedItemIds,
    setExcludedItemIds,
    handleAdjustUnits,
    isJobsModalOpen,
    setIsJobsModalOpen,
    copiedItemNameId,
    handleCopyName,
    addedAllNotice,
    handleAddAllToShoppingList,
    showMaterialsDrawer,
    setShowMaterialsDrawer,
    copiedMaterialsNotice,
    handleCopyMaterialsList,
    useBankResources,
    setUseBankResources,
    avoidAlreadyListed,
    setAvoidAlreadyListed,
    bankQtyMap,
    postedCrafts,
    postedSummary,
    showPostedDrawer,
    setShowPostedDrawer,
    justPostedNotice,
    soldStats,
    activeSummary,
    soldStatsMap,
    plannerMainTab,
    setPlannerMainTab,
    plannedCrafts,
    summary,
    materialsSummary,
    handleDiscardItem,
    handleMarkAsPosted,
    handleUndoPosted,
    handleClearAllPosted,
    handleResetAllFilters,
    handleSelectRecipeById,
    marketPrices,
  } = useDailyPlanner(props);

  const [, setAddedItemNotice] = useState(false);

  const handleAddToCart = (item: any, units: number) => {
    addToShoppingList(item, units);
    setAddedItemNotice(true);
    setTimeout(() => setAddedItemNotice(false), 1500);
  };

  return (
    <div className="space-y-4 pb-12">
      <DailyPlannerHeader
        plannedCraftsCount={plannedCrafts.length}
        onOpenJobsModal={() => setIsJobsModalOpen(true)}
        onAddAllToShoppingList={handleAddAllToShoppingList}
        addedAllNotice={addedAllNotice}
        plannerMainTab={plannerMainTab}
        setPlannerMainTab={setPlannerMainTab}
        soldStatsCount={soldStats.length}
        activeTotalLots={activeSummary.totalLots}
      />

      {plannerMainTab === 'sales_analytics' ? (
        <SalesAnalyticsView onSelectRecipeForCalculator={handleSelectRecipeById} />
      ) : (
        <>
          <DailyPlannerConfig
            marketChannel={marketChannel}
            setMarketChannel={setMarketChannel}
            budget={budget}
            budgetInput={budgetInput}
            handleBudgetChange={handleBudgetChange}
            handleApplyPresetBudget={handleApplyPresetBudget}
            maxBudgetShare={maxBudgetShare}
            setMaxBudgetShare={setMaxBudgetShare}
            optimizationMode={optimizationMode}
            setOptimizationMode={setOptimizationMode}
            targetDays={targetDays}
            setTargetDays={setTargetDays}
            maxEquipSlots={maxEquipSlots}
            setMaxEquipSlots={setMaxEquipSlots}
            maxConsumableSlots={maxConsumableSlots}
            setMaxConsumableSlots={setMaxConsumableSlots}
            maxResourceSlots={maxResourceSlots}
            setMaxResourceSlots={setMaxResourceSlots}
            onlyMyJobs={onlyMyJobs}
            setOnlyMyJobs={setOnlyMyJobs}
            requireSalesHistory={requireSalesHistory}
            setRequireSalesHistory={setRequireSalesHistory}
            recentSalesOnly={recentSalesOnly}
            setRecentSalesOnly={setRecentSalesOnly}
            minDailySales={minDailySales}
            setMinDailySales={setMinDailySales}
            filterOutliers={filterOutliers}
            setFilterOutliers={setFilterOutliers}
            useBankResources={useBankResources}
            setUseBankResources={setUseBankResources}
            avoidAlreadyListed={avoidAlreadyListed}
            setAvoidAlreadyListed={setAvoidAlreadyListed}
            selectedJobFilter={selectedJobFilter}
            setSelectedJobFilter={setSelectedJobFilter}
            minRoiFilter={minRoiFilter}
            setMinRoiFilter={setMinRoiFilter}
            maxMarketShare={maxMarketShare}
            setMaxMarketShare={setMaxMarketShare}
            excludedCount={excludedItemIds.size}
            onClearExclusions={() => setExcludedItemIds(new Set())}
            onResetAllFilters={handleResetAllFilters}
            justPostedNotice={justPostedNotice}
          />

          <DailyPlannerSummary
            budget={budget}
            summary={summary}
            postedSummary={postedSummary}
            marketChannel={marketChannel}
            maxEquipSlots={maxEquipSlots}
            maxConsumableSlots={maxConsumableSlots}
            maxResourceSlots={maxResourceSlots}
          />

          <DailyPlannerMaterials
            materialsSummary={materialsSummary}
            showMaterialsDrawer={showMaterialsDrawer}
            setShowMaterialsDrawer={setShowMaterialsDrawer}
            useBankResources={useBankResources}
            copiedMaterialsNotice={copiedMaterialsNotice}
            handleCopyMaterialsList={handleCopyMaterialsList}
          />

          <DailyPlannerPosted
            postedCrafts={postedCrafts}
            postedSummary={postedSummary}
            showPostedDrawer={showPostedDrawer}
            setShowPostedDrawer={setShowPostedDrawer}
            handleClearAllPosted={handleClearAllPosted}
            handleUndoPosted={handleUndoPosted}
          />

          <DailyPlannerItemList
            plannedCrafts={plannedCrafts}
            postedCraftsCount={postedCrafts.length}
            postedTotalCost={postedSummary.totalCost}
            budget={budget}
            requireSalesHistory={requireSalesHistory}
            onApplyPresetBudget={handleApplyPresetBudget}
            onClearAllPosted={handleClearAllPosted}
            onSetMinRoiFilter={setMinRoiFilter}
            onSetRequireSalesHistory={setRequireSalesHistory}
            onOpenJobsModal={() => setIsJobsModalOpen(true)}
            copiedItemNameId={copiedItemNameId}
            onCopyName={handleCopyName}
            onMarkAsPosted={handleMarkAsPosted}
            onDiscardItem={handleDiscardItem}
            onAdjustUnits={handleAdjustUnits}
            useBankResources={useBankResources}
            bankQtyMap={bankQtyMap}
            marketPrices={marketPrices}
            activeSummary={activeSummary}
            soldStatsMap={soldStatsMap}
            onSelectRecipeForCalculator={props.onSelectRecipeForCalculator}
            onSelectForCrushing={props.onSelectForCrushing}
            onAddToCart={handleAddToCart}
          />
        </>
      )}

      <UserJobsModal
        isOpen={isJobsModalOpen}
        onClose={() => setIsJobsModalOpen(false)}
      />
    </div>
  );
};

export default DailyCraftPlanner;
