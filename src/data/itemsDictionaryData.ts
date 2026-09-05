import { STATIC_ITEMS_DICT } from "./staticItemsDict";
import { ALL_DOFUS_RUNES_DICT } from "./dofusAllRunesDict";
import { SUPPLEMENTARY_ITEMS_DICT } from "./supplementaryItemsDict";

export function buildItemsDictionary(): Record<string, string> {
  return {
    ...STATIC_ITEMS_DICT,
    ...ALL_DOFUS_RUNES_DICT,
    ...SUPPLEMENTARY_ITEMS_DICT,
  };
}
