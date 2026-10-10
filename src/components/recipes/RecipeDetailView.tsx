import React from 'react';
import {
  ArrowLeft,
  RefreshCw,
  Layers,
  FolderOpen,
  FolderClosed,
} from 'lucide-react';
import { DofusItem, RecipeTreeNode } from '../../types';
import { PresetCraftableItem } from '../../data/presetCraftableItems';
import { RecipeSummaryCard } from './RecipeSummaryCard';
import { HorizontalIngredientCard } from './RecipeTreeNodeRow';

interface RecipeDetailViewProps {
  activePresetItem: PresetCraftableItem;
  onBackToCatalog: () => void;
  lastSyncNotice: string | null;
  isSyncingLive: boolean;
  onManualSync: () => void;
  activeSalePrice: number | '';
  salePriceDraft: string;
  onSalePriceDraftChange: (draft: string) => void;
  onCommitSalePrice: (val: string) => void;
  effectivePriceUpdatedAt: Record<number, number>;
  autoOptimalCost: number;
  directCraftCost: number;
  onSelectForCrushing?: (item: DofusItem) => void;
  onOpenHistory: (item: DofusItem) => void;
  recipeTree: RecipeTreeNode | null;
  loadingTree: boolean;
  marketPrices: Record<number, number>;
  treeExpandTrigger: { trigger: number; expand: boolean };
  onSetTreeExpandTrigger: (val: { trigger: number; expand: boolean }) => void;
  selectedBycMethods: Record<number, 'direct' | 'fragments' | 'map'>;
  onPriceChange: (itemId: number, newPrice: number) => void;
  onSelectBycMethod: (
    itemId: number,
    method: 'direct' | 'fragments' | 'map'
  ) => void;
}

export const RecipeDetailView: React.FC<RecipeDetailViewProps> = ({
  activePresetItem,
  onBackToCatalog,
  lastSyncNotice,
  isSyncingLive,
  onManualSync,
  activeSalePrice,
  salePriceDraft,
  onSalePriceDraftChange,
  onCommitSalePrice,
  effectivePriceUpdatedAt,
  autoOptimalCost,
  directCraftCost,
  onSelectForCrushing,
  onOpenHistory,
  recipeTree,
  loadingTree,
  marketPrices,
  treeExpandTrigger,
  onSetTreeExpandTrigger,
  selectedBycMethods,
  onPriceChange,
  onSelectBycMethod,
}) => {
  return (
    <div className="space-y-4 w-full">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-lg">
        <button
          type="button"
          onClick={onBackToCatalog}
          className="px-3.5 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 hover:border-amber-500/50 text-amber-400 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md group cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Volver al Catálogo</span>
        </button>

        <div className="flex items-center gap-2.5">
          {lastSyncNotice && (
            <span className="text-xs font-semibold text-emerald-400 bg-emerald-950/70 border border-emerald-500/40 px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {lastSyncNotice}
            </span>
          )}

          <button
            type="button"
            onClick={onManualSync}
            disabled={isSyncingLive}
            className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 hover:border-amber-500/50 text-slate-200 hover:text-amber-300 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-sm disabled:opacity-50"
            title="Comprobar y sincronizar precios más recientes enviados por el sniffer o mercadillo"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-amber-400 ${
                isSyncingLive ? 'animate-spin' : ''
              }`}
            />
            <span>
              {isSyncingLive ? 'Sincronizando...' : 'Sincronizar Mercadillo'}
            </span>
          </button>
        </div>
      </div>

      {/* Hero Item Banner Card */}
      <RecipeSummaryCard
        item={activePresetItem}
        salePrice={typeof activeSalePrice === 'number' ? activeSalePrice : 0}
        salePriceDraft={salePriceDraft}
        onSalePriceDraftChange={onSalePriceDraftChange}
        onCommitSalePrice={onCommitSalePrice}
        priceUpdatedAt={effectivePriceUpdatedAt}
        autoOptimalCost={autoOptimalCost}
        directCraftCost={directCraftCost}
        onSelectForCrushing={onSelectForCrushing}
        onOpenHistory={onOpenHistory}
      />

      {/* Horizontal Ingredients Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-5 h-5 text-amber-400" />
              Ingredientes y Precios de Mercadillo
            </h2>
            {recipeTree?.subIngredients &&
              recipeTree.subIngredients.filter(
                (s) => (marketPrices[s.itemId] || 0) <= 0
              ).length > 0 && (
                <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  {
                    recipeTree.subIngredients.filter(
                      (s) => (marketPrices[s.itemId] || 0) <= 0
                    ).length
                  }{' '}
                  sin precio
                </span>
              )}
          </div>

          {recipeTree?.subIngredients &&
            recipeTree.subIngredients.some(
              (s) =>
                s.isCraftable &&
                s.subIngredients &&
                s.subIngredients.length > 0
            ) && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    onSetTreeExpandTrigger({
                      trigger: Date.now(),
                      expand: true,
                    })
                  }
                  className="px-2.5 py-1 rounded-xl bg-slate-950 hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 border border-slate-800 hover:border-amber-500/40 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                  title="Desplegar todos los sub-árboles de crafteo de la receta"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                  <span>Desplegar todo el árbol</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onSetTreeExpandTrigger({
                      trigger: Date.now(),
                      expand: false,
                    })
                  }
                  className="px-2.5 py-1 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                  title="Plegar todos los sub-árboles"
                >
                  <FolderClosed className="w-3.5 h-3.5" />
                  <span>Plegar todo</span>
                </button>
              </div>
            )}
        </div>

        {loadingTree ? (
          <div className="py-16 text-center space-y-3 bg-slate-950 border border-slate-800 rounded-2xl">
            <RefreshCw className="w-8 h-8 animate-spin text-amber-400 mx-auto" />
            <p className="text-xs text-slate-400">
              Cargando receta e ingredientes...
            </p>
          </div>
        ) : recipeTree &&
          recipeTree.subIngredients &&
          recipeTree.subIngredients.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {recipeTree.subIngredients.map((childNode) => (
              <HorizontalIngredientCard
                key={childNode.itemId}
                node={childNode}
                marketPrices={marketPrices}
                priceUpdatedAt={effectivePriceUpdatedAt}
                onPriceChange={onPriceChange}
                onOpenHistory={onOpenHistory}
                forceExpandTrigger={treeExpandTrigger.trigger}
                forceExpandValue={treeExpandTrigger.expand}
                selectedBycMethod={selectedBycMethods[childNode.itemId]}
                onSelectBycMethod={onSelectBycMethod}
              />
            ))}
          </div>
        ) : (
          <div className="py-12 text-center text-xs text-slate-500 bg-slate-950 border border-slate-800 rounded-2xl">
            Este objeto no posee receta de fabricación registrada o es un
            recurso base.
          </div>
        )}
      </div>
    </div>
  );
};
