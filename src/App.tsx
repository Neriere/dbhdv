/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Navbar, ActiveTab } from './components/Navbar';
import { RecipeCraftingCalculator } from './components/RecipeCraftingCalculator';
import { GlobalProfitRanking } from './components/GlobalProfitRanking';
import { PriceManager } from './components/PriceManager';
import { DofusImporter } from './components/DofusImporter';
import { DofusItem } from './types';
import { initializeDatabase } from './services/dofusDbService';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('recipes');
  const [selectedItem, setSelectedItem] = useState<DofusItem | null>(null);

  useEffect(() => {
    // Hydrate local file database cache on app startup
    initializeDatabase().catch((err) => {
      console.warn('Error inicializando base de datos persistente local:', err);
    });
  }, []);

  const handleSelectRecipeForCalculator = (item: DofusItem) => {
    setSelectedItem(item);
    setActiveTab('recipes');
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-neutral-200 font-sans selection:bg-amber-500 selection:text-black flex flex-col">
      {/* Navbar Header */}
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main App Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'recipes' && (
          <RecipeCraftingCalculator initialSelectedItem={selectedItem} />
        )}

        {activeTab === 'ranking' && (
          <GlobalProfitRanking
            onSelectRecipeForCalculator={(presetItem) => {
              handleSelectRecipeForCalculator(presetItem);
            }}
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
      </main>

      <footer className="border-t border-neutral-900 bg-[#050505] py-5 text-xs text-neutral-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <p>
            Datos de <a href="https://api.dofusdb.fr" target="_blank" rel="noreferrer" className="text-neutral-400 hover:text-amber-400 underline">DofusDB</a>.
          </p>
          <p>Base local para pruebas.</p>
        </div>
      </footer>
    </div>
  );
}
