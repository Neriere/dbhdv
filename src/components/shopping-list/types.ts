import { DofusItem, ShoppingListItem } from "../../types";

export interface ShoppingListPlannerProps {
  onSelectRecipeForCalculator: (item: DofusItem) => void;
  onSelectForCrushing?: (item: DofusItem) => void;
  onOpenQuickSearch?: () => void;
}

export interface ConsolidatedShoppingIngredientWithChecked {
  itemId: number;
  item?: DofusItem;
  totalQuantityRequired: number;
  unitPrice: number;
  totalPrice: number;
  isChecked: boolean;
}
