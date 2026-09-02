/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
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

// ── Status bar hook — checks if sniffer has synced recently ─────────────────
function useSnifferStatus() {
  const [lastSync, setLastSync] = useState<number | null>(null);

  useEffect(() => {
    // Listen for any price update events dispatched by the sniffer pathway
    const handler = () => setLastSync(Date.now());
    window.addEventListener('dofus_database_updated', handler);
    return () => window.removeEventListener('dofus_database_updated', handler);
  }, []);

  const isActive = lastSync !== null && Date.now() - lastSync < 5 * 60 * 1000; // active in last 5 min
  const relativeTime = lastSync
    ? (() => {
        const mins = Math.round((Date.now() - lastSync) / 60000);
        if (mins < 1) return 'ahora mismo';
        if (mins === 1) return 'hace 1 min';
        return `hace ${mins} min`;
      })()
    : null;

  return { isActive, relativeTime };
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('recipes');
  const [selectedItem, setSelectedItem] = useState<DofusItem | null>(null);
  const [tabKey, setTabKey] = useState(0); // triggers fade on tab change
  const { isActive: snifferActive, relativeTime: snifferTime } = useSnifferStatus();

  useEffect(() => {
    // Hydrate local database cache on app startup
    initializeDatabase().catch((err) => {
      console.warn('Error inicializando base de datos persistente local:', err);
    });
  }, []);

  const handleSetActiveTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    setTabKey((k) => k + 1); // bump key to restart fade animation
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
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-amber-500 selection:text-slate-950 flex flex-col overflow-x-hidden">
      <Navbar activeTab={activeTab} setActiveTab={handleSetActiveTab} />

      {/* Main content — key triggers the fade animation on tab change */}
      <main
        key={tabKey}
        className="tab-content-enter flex-1 w-full max-w-[1760px] mx-auto px-3 sm:px-5 lg:px-8 py-4"
      >
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
            <DofusImporter onSyncComplete={() => handleSetActiveTab('recipes')} />
          )}
        </Suspense>
      </main>

      {/* ── Status Footer ─────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-2.5 text-xs text-slate-500">
        <div className="max-w-[1760px] mx-auto px-3 sm:px-5 lg:px-8 flex items-center justify-between gap-3">
          {/* Left: sniffer status */}
          <div className="flex items-center gap-2">
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                snifferActive
                  ? 'bg-emerald-400 sniffer-dot-active'
                  : 'bg-slate-600'
              }`}
            />
            <span className={snifferActive ? 'text-emerald-400/80' : 'text-slate-600'}>
              {snifferActive
                ? `Sniffer activo · Última sync ${snifferTime}`
                : 'Sniffer inactivo'}
            </span>
          </div>

          {/* Right: attribution */}
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
            &amp; Turso SQLite
          </p>
        </div>
      </footer>
    </div>
  );
}
