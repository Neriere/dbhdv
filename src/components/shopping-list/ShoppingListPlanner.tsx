import React from "react";
import { QuickSearchModal } from "../QuickSearchModal";
import { ShoppingListPlannerProps } from "./types";
import { useShoppingListPlanner } from "./useShoppingListPlanner";
import { ShoppingListHeader } from "./ShoppingListHeader";
import { ShoppingListEmptyState } from "./ShoppingListEmptyState";
import { ShoppingListBatchPanel } from "./ShoppingListBatchPanel";
import { ShoppingListIngredientsTable } from "./ShoppingListIngredientsTable";

export const ShoppingListPlanner: React.FC<ShoppingListPlannerProps> = ({
  onSelectRecipeForCalculator,
  onSelectForCrushing,
  onOpenQuickSearch,
}) => {
  const {
    items,
    consolidatedIngredients,
    totalCost,
    pendingCost,
    unpricedCount,
    qtyInputs,
    copied,
    editingPriceId,
    editPriceValue,
    isSearchModalOpen,
    setIsSearchModalOpen,
    setEditingPriceId,
    setEditPriceValue,
    toggleChecked,
    handleOpenSearch,
    handleSetExactQty,
    handleUpdateQty,
    handleQtyInputChange,
    handleCommitQty,
    handleCancelQty,
    handleSetAllQuantities,
    handleSaveInlinePrice,
    handleCopyChatFormat,
    handleClearList,
    handleRemoveItem,
  } = useShoppingListPlanner(onOpenQuickSearch);

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <ShoppingListHeader
        itemsCount={items.length}
        onOpenSearch={handleOpenSearch}
        onCopyChatFormat={handleCopyChatFormat}
        copied={copied}
        onClearList={handleClearList}
      />

      {items.length === 0 ? (
        <ShoppingListEmptyState />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Column: Recipes in Batch & Budget Summary */}
          <ShoppingListBatchPanel
            items={items}
            qtyInputs={qtyInputs}
            onSetAllQuantities={handleSetAllQuantities}
            onUpdateQty={handleUpdateQty}
            onSetExactQty={handleSetExactQty}
            onQtyInputChange={handleQtyInputChange}
            onCommitQty={handleCommitQty}
            onCancelQty={handleCancelQty}
            onRemoveItem={handleRemoveItem}
            onSelectRecipeForCalculator={onSelectRecipeForCalculator}
            consolidatedCount={consolidatedIngredients.length}
            totalCost={totalCost}
            pendingCost={pendingCost}
            unpricedCount={unpricedCount}
          />

          {/* Right Column: Consolidated Ingredients Table */}
          <ShoppingListIngredientsTable
            ingredients={consolidatedIngredients}
            editingPriceId={editingPriceId}
            editPriceValue={editPriceValue}
            onToggleChecked={toggleChecked}
            onStartEditingPrice={(itemId, unitPrice) => {
              setEditingPriceId(itemId);
              setEditPriceValue(String(unitPrice || ""));
            }}
            onEditPriceChange={setEditPriceValue}
            onSaveInlinePrice={handleSaveInlinePrice}
            onCancelEditingPrice={() => setEditingPriceId(null)}
          />
        </div>
      )}

      {/* Quick Search Modal for adding items to shopping list */}
      <QuickSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        onSelectForCalculator={(item) => {
          onSelectRecipeForCalculator(item);
          setIsSearchModalOpen(false);
        }}
        onSelectForCrushing={(item) => {
          if (onSelectForCrushing) {
            onSelectForCrushing(item);
          }
          setIsSearchModalOpen(false);
        }}
      />
    </div>
  );
};

export default ShoppingListPlanner;
