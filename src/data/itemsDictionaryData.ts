import staticItemsDict from "./staticItemsDictionary.json";

export function buildItemsDictionary(): Record<string, string> {
  return staticItemsDict as Record<string, string>;
}
