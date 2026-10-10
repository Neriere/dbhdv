import { formatKamas } from '../../utils/kamaFormatters';
import {
  DOFUSBOOK_SESSION_STORAGE_KEY,
  DofusbookSavedSession,
  DofusbookComputedData,
} from './types';
import { DofusbookBuildAnalysis } from '../../types';

export function loadSavedDofusbookSession(): DofusbookSavedSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DOFUSBOOK_SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn('Error loading cached Dofusbook session:', e);
    return null;
  }
}

export function saveDofusbookSession(session: DofusbookSavedSession | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (session) {
      localStorage.setItem(DOFUSBOOK_SESSION_STORAGE_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(DOFUSBOOK_SESSION_STORAGE_KEY);
    }
  } catch (e) {
    console.warn('Error saving Dofusbook session to localStorage:', e);
  }
}

export function buildSummaryClipboardText(
  analysis: DofusbookBuildAnalysis,
  computedData: DofusbookComputedData,
): string {
  const lines = [
    `=== ANÁLISIS DE SET DOFUSBOOK ===`,
    `Set: ${analysis.buildName} ${analysis.buildLevel ? `(Nivel ${analysis.buildLevel})` : ''}`,
    `Enlace: ${analysis.url}`,
    `Progreso: ${computedData.ownedCount} de ${computedData.activePiecesCount} piezas obtenidas (${computedData.progressPercent}%)`,
    ``,
    `RESUMEN DE COSTES PENDIENTES:`,
    `- Total Compra Directa (HDV): ${formatKamas(computedData.totals.totalMarketPrice)}`,
    `- Total Coste Crafteo: ${formatKamas(computedData.totals.totalCraftCost)}`,
    `- Total Estrategia Óptima: ${formatKamas(computedData.totals.totalOptimalCost)}`,
    `- Ahorro Estimado: ${formatKamas(computedData.totals.totalSavings)}`,
    ``,
    `DETALLE POR PIEZA:`,
  ];

  computedData.items.forEach((it) => {
    const name = it.item?.name?.es || it.rawName;
    if (it.isRemoved) {
      lines.push(`* [DESCARTADO] ${it.slotName}: ${name} (Eliminado del cálculo)`);
      return;
    }
    if (it.isOwned) {
      lines.push(`* [✓ YA OBTENIDO] ${it.slotName}: ${name} (En posesión - 0 K pendientes)`);
      return;
    }
    const craft = it.craftCost > 0 ? `${formatKamas(it.craftCost)}` : 'Sin precio';
    const hdv = it.marketPrice > 0 ? `${formatKamas(it.marketPrice)}` : 'Sin precio';
    const verdict =
      it.cheaperOption === 'craft'
        ? `[CRAFTEAR - Ahorras ${formatKamas(it.savings)}]`
        : it.cheaperOption === 'buy'
        ? `[COMPRAR - Ahorras ${formatKamas(it.savings)}]`
        : it.cheaperOption === 'dofus_excluded'
        ? `[DOFUS EXCLUIDO]`
        : `[-]`;

    lines.push(
      `* ${it.slotName}: ${name} (Lvl ${it.item?.level || '?'}) | Crafteo: ${craft} | HDV: ${hdv} ${verdict}`
    );
  });

  return lines.join('\n');
}
