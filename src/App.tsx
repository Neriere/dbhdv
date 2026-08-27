/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Navbar, ActiveTab } from './components/Navbar';
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

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('recipes');
  const [selectedItem, setSelectedItem] = useState<DofusItem | null>(null);

  useEffect(() => {
    // Hydrate local database cache on app startup
    initializeDatabase().catch((err) => {
      console.warn('Error inicializando base de datos persistente local:', err);
    });
  }, []);

  const handleSelectRecipeForCalculator = (item: DofusItem) => {
    setSelectedItem(item);
    setActiveTab('recipes');
  };

  const handleSelectForCrushing = (item: DofusItem) => {
    setSelectedItem(item);
    setActiveTab('rompedora');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-amber-500 selection:text-slate-950 flex flex-col overflow-x-hidden">
      {/* Header Navbar with Top-Left Theme Dropdown and Reordered Tabs */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Main App Content Area */}
      <main className="flex-1 w-full max-w-[1760px] mx-auto px-3 sm:px-5 lg:px-8 py-4">
        <Suspense
          fallback={
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
              <span className="text-sm font-semibold">Cargando módulo...</span>
            </div>
          }
        >
          {activeTab === 'recipes' && (
            <RecipeCraftingCalculator
              initialSelectedItem={selectedItem}
              onSelectForCrushing={handleSelectForCrushing}
            />
          )}

          {activeTab === 'bank' && (
            <BankCraftingView
              onSelectRecipeForCalculator={handleSelectRecipeForCalculator}
              onSelectForCrushing={handleSelectForCrushing}
              onNavigateToShopping={() => setActiveTab('shopping')}
            />
          )}

          {activeTab === 'treasure_maps' && (
            <TreasureHuntCalculator
              onNavigateToShopping={() => setActiveTab('shopping')}
              onNavigateToBank={() => setActiveTab('bank')}
            />
          )}

          {activeTab === 'dofusbook' && (
            <DofusbookSetCalculator
              onSelectRecipeForCalculator={handleSelectRecipeForCalculator}
              onSelectForCrushing={handleSelectForCrushing}
              onNavigateToShopping={() => setActiveTab('shopping')}
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
              onSelectRecipeForCalculator={(presetItem) => {
                handleSelectRecipeForCalculator(presetItem);
              }}
              onSelectForCrushing={(presetItem) => {
                handleSelectForCrushing(presetItem);
              }}
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
              onSelectItemForRecipe={(item) => {
                handleSelectRecipeForCalculator(item);
              }}
            />
          )}

          {activeTab === 'importer' && (
            <DofusImporter onSyncComplete={() => setActiveTab('recipes')} />
          )}
        </Suspense>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 text-xs text-slate-500">
        <div className="max-w-[1760px] mx-auto px-3 sm:px-5 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <p>
            Dofus HDV - Datos sincronizados con <a href="https://api.dofusdb.fr" target="_blank" rel="noreferrer" className="text-slate-400 hover:text-amber-400 underline">DofusDB</a> & Turso SQLite.
          </p>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Gestor integral de crafteo, precios y rompedora de runas</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
