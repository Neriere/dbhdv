/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, Suspense, lazy } from 'react';
import { AppShell } from './components/layout/AppShell';
import { ActiveTab } from './components/layout/Sidebar';
import { DofusItem } from './types';
import { initializeDatabase } from './services/dofusDbService';
import { Loader2 } from 'lucide-react';

// Lazy loaded views for optimal code-splitting and performance
const RecipeCraftingCalculator = lazy(() =>
  import('./components/RecipeCraftingCalculator').then((m) => ({
    default: m.RecipeCraftingCalculator,
  }))
);
const CrushingCalculator = lazy(() =>
  import('./components/CrushingCalculator').then((m) => ({
    default: m.CrushingCalculator,
  }))
);
const JobLevelingOptimizer = lazy(() =>
  import('./components/jobs/JobLevelingOptimizer').then((m) => ({
    default: m.JobLevelingOptimizer,
  }))
);
const DailyCraftPlanner = lazy(() =>
  import('./components/DailyCraftPlanner').then((m) => ({
    default: m.DailyCraftPlanner,
  }))
);
const GlobalProfitRanking = lazy(() =>
  import('./components/GlobalProfitRanking').then((m) => ({
    default: m.GlobalProfitRanking,
  }))
);
const ShoppingListPlanner = lazy(() =>
  import('./components/ShoppingListPlanner').then((m) => ({
    default: m.ShoppingListPlanner,
  }))
);
const DofusbookSetCalculator = lazy(() =>
  import('./components/DofusbookSetCalculator').then((m) => ({
    default: m.DofusbookSetCalculator,
  }))
);
const PriceManager = lazy(() =>
  import('./components/PriceManager').then((m) => ({
    default: m.PriceManager,
  }))
);
const BankCraftingView = lazy(() =>
  import('./components/BankCraftingView').then((m) => ({
    default: m.BankCraftingView,
  }))
);
const TreasureHuntCalculator = lazy(() =>
  import('./components/TreasureHuntCalculator').then((m) => ({
    default: m.TreasureHuntCalculator,
  }))
);
const DofusImporter = lazy(() =>
  import('./components/DofusImporter').then((m) => ({
    default: m.DofusImporter,
  }))
);
const ConsumablesCharacteristicView = lazy(() =>
  import('./components/ConsumablesCharacteristicView').then((m) => ({
    default: m.ConsumablesCharacteristicView,
  }))
);

// ── Module loading fallback ───────────────────────────────────────────────────
const ModuleFallback = (
  <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
    <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
    <span className="text-sm font-semibold">Cargando módulo...</span>
  </div>
);

// ── Footer ────────────────────────────────────────────────────────────────────
const AppFooter = (
  <footer className="border-t border-slate-900 bg-slate-950/80 py-2.5 text-xs text-slate-500">
    <div className="max-w-full px-4 sm:px-6 flex items-center justify-end gap-3">
      <p className="hidden sm:block text-slate-700">
        Datos via{' '}
        <a
          href="https://api.dofusdb.fr"
          target="_blank"
          rel="noreferrer"
          className="text-slate-600 hover:text-amber-400/70 transition-colors underline"
        >
          DofusDB
        </a>{' '}
        &amp; Base de Datos SQL
      </p>
    </div>
  </footer>
);

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab,    setActiveTabState] = useState<ActiveTab>('recipes');
  const [selectedItem, setSelectedItem]  = useState<DofusItem | null>(null);
  const [tabKey,       setTabKey]        = useState(0);

  useEffect(() => {
    initializeDatabase().catch((err) => {
      console.warn('Error inicializando base de datos persistente local:', err);
    });
  }, []);

  const handleSetActiveTab = (tab: ActiveTab) => {
    setActiveTabState(tab);
    setTabKey((k) => k + 1);
  };

  const handleSelectRecipeForCalculator = (item: DofusItem) => {
    setSelectedItem(item);
    handleSetActiveTab('recipes');
  };

  const handleSelectForCrushing = (item: DofusItem) => {
    setSelectedItem(item);
    handleSetActiveTab('rompedora');
  };

  return (
    <AppShell
      activeTab={activeTab}
      setActiveTab={handleSetActiveTab}
      footer={AppFooter}
    >
      {/* Main content area — key triggers the fade animation on tab change */}
      <div
        key={tabKey}
        className="tab-content-enter flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4"
      >
        <Suspense fallback={ModuleFallback}>
          {activeTab === 'recipes' && (
            <RecipeCraftingCalculator
              initialSelectedItem={selectedItem}
              onSelectForCrushing={handleSelectForCrushing}
            />
          )}

          {activeTab === 'daily_crafts' && (
            <DailyCraftPlanner
              onSelectRecipeForCalculator={handleSelectRecipeForCalculator}
              onSelectForCrushing={handleSelectForCrushing}
              onNavigateToShopping={() => handleSetActiveTab('shopping')}
            />
          )}

          {activeTab === 'job_optimizer' && (
            <JobLevelingOptimizer
              onNavigateToShopping={() => handleSetActiveTab('shopping')}
            />
          )}

          {activeTab === 'bank' && (
            <BankCraftingView
              onSelectRecipeForCalculator={handleSelectRecipeForCalculator}
              onSelectForCrushing={handleSelectForCrushing}
              onNavigateToShopping={() => handleSetActiveTab('shopping')}
            />
          )}

          {activeTab === 'treasure_maps' && (
            <TreasureHuntCalculator
              onNavigateToShopping={() => handleSetActiveTab('shopping')}
              onNavigateToBank={() => handleSetActiveTab('bank')}
            />
          )}

          {activeTab === 'dofusbook' && (
            <DofusbookSetCalculator
              onSelectRecipeForCalculator={handleSelectRecipeForCalculator}
              onSelectForCrushing={handleSelectForCrushing}
              onNavigateToShopping={() => handleSetActiveTab('shopping')}
            />
          )}

          {activeTab === 'rompedora' && (
            <CrushingCalculator
              initialSelectedItem={selectedItem}
              onSelectRecipeForCalculator={handleSelectRecipeForCalculator}
            />
          )}

          {activeTab === 'ranking' && (
            <GlobalProfitRanking
              onSelectRecipeForCalculator={handleSelectRecipeForCalculator}
              onSelectForCrushing={handleSelectForCrushing}
            />
          )}

          {activeTab === 'shopping' && (
            <ShoppingListPlanner
              onSelectRecipeForCalculator={handleSelectRecipeForCalculator}
              onSelectForCrushing={handleSelectForCrushing}
            />
          )}

          {activeTab === 'prices' && (
            <PriceManager
              onSelectItemForRecipe={handleSelectRecipeForCalculator}
            />
          )}

          {activeTab === 'consumables' && <ConsumablesCharacteristicView />}

          {activeTab === 'importer' && (
            <DofusImporter onSyncComplete={() => handleSetActiveTab('recipes')} />
          )}
        </Suspense>
      </div>
    </AppShell>
  );
}
