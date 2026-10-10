import { DofusItem } from "../../types";

export interface ItemPriceHistoryModalProps {
  item: DofusItem | null;
  isOpen: boolean;
  onClose: () => void;
  onPriceChanged?: () => void;
  profileId?: number;
}
