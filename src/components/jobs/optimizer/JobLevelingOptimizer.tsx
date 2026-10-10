import React from 'react';
import { Layers, ListFilter, Plus } from 'lucide-react';
import { JobLevelingOptimizerProps } from './types';
import { useJobLevelingOptimizer } from './useJobLevelingOptimizer';
import { JobOptimizerConfigBar } from './JobOptimizerConfigBar';
import { JobOptimizerProgressBar } from './JobOptimizerProgressBar';
import { JobOptimizerPhasePlan } from './JobOptimizerPhasePlan';
import { JobOptimizerUnifiedPlan } from './JobOptimizerUnifiedPlan';
import { JobOptimizerMaterialsSummary } from './JobOptimizerMaterialsSummary';
import { JobOptimizerCatalogTable } from './JobOptimizerCatalogTable';
import { getNextMilestoneLevel } from '../../../services/jobLevelingService';

export const JobLevelingOptimizer: React.FC<JobLevelingOptimizerProps> = ({
  initialJobId,
  onNavigateToShopping,
}) => {
  const {
    jobId,
    jobLevels,
    userSavedLevel,
    startingLevel,
    startingXp,
    targetLevel,
    xpMultiplier,
    isBoostedServer,
    strategy,
    setStrategy,
    showAdvancedFilters,
    setShowAdvancedFilters,
    maxDailyAbsorptionRatio,
    setMaxDailyAbsorptionRatio,
    excludeByc,
    setExcludeByc,
    excludePebbles,
    setExcludePebbles,
    phases,
    selectedCrafts,
    viewMode,
    setViewMode,
    expandedPhases,
    searchQuery,
    setSearchQuery,
    recipeCategoryFilter,
    setRecipeCategoryFilter,
    copiedNotification,
    shoppingNotification,
    updatedSelectedCrafts,
    actualXp,
    actualLevel,
    materialsNeeded,
    totalXpGained,
    planSummary,
    filteredRecipes,
    nextMilestone,
    progressPercent,
    handleStartingLevelChange,
    handleTargetLevelChange,
    handleSetTargetNextMilestone,
    handleSetTargetPlusTen,
    handleSetTarget100,
    handleSetTarget200,
    handleStartingXpChange,
    handleSelectJob,
    setXpMultiplier,
    setIsBoostedServer,
    handleAutoOptimize,
    handleAppendNextPhase,
    handlePhaseQuantityChange,
    handlePhaseRemoveCraft,
    handleRemovePhase,
    togglePhaseAccordion,
    handleAddOne,
    handleAddUntilLevel,
    handleQuantityChange,
    handleRemoveCraft,
    handleClearPlan,
    handleSaveAsStarting,
    handleExportToShoppingList,
    handleCopySummary,
  } = useJobLevelingOptimizer({ initialJobId });

  return (
    <div className="space-y-5 pb-16">
      {/* 1. BARRA SUPERIOR DE PARÁMETROS */}
      <JobOptimizerConfigBar
        jobId={jobId}
        jobLevels={jobLevels}
        userSavedLevel={userSavedLevel}
        startingLevel={startingLevel}
        targetLevel={targetLevel}
        startingXp={startingXp}
        xpMultiplier={xpMultiplier}
        isBoostedServer={isBoostedServer}
        strategy={strategy}
        setStrategy={setStrategy}
        showAdvancedFilters={showAdvancedFilters}
        setShowAdvancedFilters={setShowAdvancedFilters}
        excludeByc={excludeByc}
        setExcludeByc={setExcludeByc}
        excludePebbles={excludePebbles}
        setExcludePebbles={setExcludePebbles}
        maxDailyAbsorptionRatio={maxDailyAbsorptionRatio}
        setMaxDailyAbsorptionRatio={setMaxDailyAbsorptionRatio}
        onSelectJob={handleSelectJob}
        onStartingLevelChange={handleStartingLevelChange}
        onTargetLevelChange={handleTargetLevelChange}
        onSetTargetNextMilestone={handleSetTargetNextMilestone}
        onSetTargetPlusTen={handleSetTargetPlusTen}
        onSetTarget100={handleSetTarget100}
        onSetTarget200={handleSetTarget200}
        onStartingXpChange={handleStartingXpChange}
        setXpMultiplier={setXpMultiplier}
        setIsBoostedServer={setIsBoostedServer}
        onAutoOptimize={handleAutoOptimize}
      />

      {/* 2. BARRA DE PROGRESO */}
      <JobOptimizerProgressBar
        startingLevel={startingLevel}
        actualLevel={actualLevel}
        targetLevel={targetLevel}
        actualXp={actualXp}
        totalXpGained={totalXpGained}
        progressPercent={progressPercent}
        updatedSelectedCraftsCount={updatedSelectedCrafts.length}
        planSummary={planSummary}
        copiedNotification={copiedNotification}
        shoppingNotification={shoppingNotification}
        onNavigateToShopping={onNavigateToShopping}
        onSaveAsStarting={handleSaveAsStarting}
        onClearPlan={handleClearPlan}
        onCopySummary={handleCopySummary}
      />

      {/* 3. CRAFTEOS SELECCIONADOS */}
      {(phases.length > 0 || updatedSelectedCrafts.length > 0) && (
        <div className="space-y-3">
          {/* Selector de Vistas y Botón de Apilar Fase */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('phases')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  viewMode === 'phases'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Plan por Fases ({phases.length})</span>
              </button>

              <button
                onClick={() => setViewMode('unified')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  viewMode === 'unified'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
              >
                <ListFilter className="w-3.5 h-3.5" />
                <span>Vista Unificada ({updatedSelectedCrafts.length})</span>
              </button>
            </div>

            {actualLevel < 200 && (
              <button
                onClick={handleAppendNextPhase}
                className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow transition"
                title="Apilar siguiente fase (+10 niveles)"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>
                  + Apilar Siguiente Fase ({actualLevel} &rarr;{' '}
                  {getNextMilestoneLevel(actualLevel)})
                </span>
              </button>
            )}
          </div>

          {/* Vistas */}
          {viewMode === 'phases' ? (
            <JobOptimizerPhasePlan
              phases={phases}
              expandedPhases={expandedPhases}
              actualLevel={actualLevel}
              startingLevel={startingLevel}
              targetLevel={targetLevel}
              onTogglePhaseAccordion={togglePhaseAccordion}
              onRemovePhase={handleRemovePhase}
              onPhaseQuantityChange={handlePhaseQuantityChange}
              onPhaseRemoveCraft={handlePhaseRemoveCraft}
            />
          ) : (
            <JobOptimizerUnifiedPlan
              updatedSelectedCrafts={updatedSelectedCrafts}
              actualLevel={actualLevel}
              handleQuantityChange={handleQuantityChange}
              handleRemoveCraft={handleRemoveCraft}
            />
          )}

          {/* Resumen de materiales */}
          <JobOptimizerMaterialsSummary
            materialsNeeded={materialsNeeded}
            planSummary={planSummary}
            onExportToShoppingList={handleExportToShoppingList}
          />
        </div>
      )}

      {/* 4. RECIPES CATALOG */}
      <JobOptimizerCatalogTable
        filteredRecipes={filteredRecipes}
        recipeCategoryFilter={recipeCategoryFilter}
        setRecipeCategoryFilter={setRecipeCategoryFilter}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        actualLevel={actualLevel}
        nextMilestone={nextMilestone}
        onAddOne={handleAddOne}
        onAddUntilLevel={handleAddUntilLevel}
      />
    </div>
  );
};

export default JobLevelingOptimizer;
