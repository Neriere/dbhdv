/**
 * Utilidades para normalización y búsqueda insensible a tildes/acentos y mayúsculas/minúsculas.
 * Soporta búsquedas donde el usuario escribe con o sin tildes (ej. "trithon" encuentra "Anillo trithón",
 * o "anillo trithón" encuentra "Anillo trithon").
 */

/**
 * Elimina acentos, diacríticos y caracteres especiales combinatorios de un texto,
 * transformándolo a minúsculas y eliminando espacios extra.
 */
export function removeAccents(str: string | null | undefined): string {
  if (!str) return "";
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export const normalizeSearchText = removeAccents;

/**
 * Evalúa si uno o varios textos/IDs de destino coinciden con los términos de una búsqueda.
 * Si la búsqueda tiene múltiples palabras (ej. "anillo trithon"), todas las palabras deben coincidir.
 */
export function matchesSearchQuery(
  targets: Array<string | number | null | undefined>,
  query: string | null | undefined,
): boolean {
  if (!query || !query.trim()) return true;

  const normalizedQuery = removeAccents(query);
  if (!normalizedQuery) return true;

  const queryTerms = normalizedQuery.split(/\s+/).filter(Boolean);

  const combinedTarget = targets
    .filter((t) => t !== null && t !== undefined)
    .map((t) => removeAccents(String(t)))
    .join(" ");

  return queryTerms.every((term) => combinedTarget.includes(term));
}
