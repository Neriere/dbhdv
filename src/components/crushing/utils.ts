import React from 'react';
import {
  Scissors,
  Gem,
  Footprints,
  Shield,
  Sword,
  Wand2,
  Layers,
  Crown,
  CircleDot,
  Disc,
  Sliders,
  Trophy,
} from 'lucide-react';
import {
  SavedFiltersState,
  SavedCrushingViewState,
  StatFilterDef,
  CRUSHING_STATE_KEY,
  FILTER_PERSISTENCE_KEY,
} from './types';

export const getInitialSavedViewState = (): SavedCrushingViewState => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(CRUSHING_STATE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error loading saved view state:', e);
  }
  return {};
};

export const getInitialSavedFilters = (): SavedFiltersState => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(FILTER_PERSISTENCE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error loading saved filters:', e);
  }
  return {};
};

export const JOB_ICONS_MAP: Record<number, React.ComponentType<{ className?: string }>> = {
  27: Scissors, // Sastre
  16: Gem, // Joyero
  15: Footprints, // Zapatero
  60: Shield, // Fabricante
  11: Sword, // Herrero
  13: Wand2, // Escultor
};

export function formatTimeAgo(ts: number | null | undefined): string {
  if (!ts) return 'Por defecto';
  const diffMs = Date.now() - ts;
  const diffMin = Math.floor(diffMs / (1000 * 60));
  if (diffMin < 1) return 'Hace un momento';
  if (diffMin < 60) return `Hace ${diffMin}m`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Hace ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays}d`;
  const d = new Date(ts);
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}

export function formatFullDate(ts: number | null | undefined): string {
  if (!ts) return 'No registrado aún (100% por defecto)';
  const d = new Date(ts);
  return `${d.toLocaleDateString()} a las ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export const EQUIPMENT_SLOTS = [
  { id: 'all', label: 'Todos', typeIds: [], icon: Layers },
  { id: 'sombrero', label: 'Sombrero', typeIds: [16], icon: Crown },
  { id: 'capa', label: 'Capa', typeIds: [17, 81], icon: Shield },
  { id: 'amuleto', label: 'Amuleto', typeIds: [1], icon: CircleDot },
  { id: 'anillo', label: 'Anillo', typeIds: [9], icon: Disc },
  { id: 'cinturon', label: 'Cinturón', typeIds: [10], icon: Sliders },
  { id: 'botas', label: 'Botas', typeIds: [11], icon: Footprints },
  { id: 'arma_herrero', label: 'Arma (Herrero)', jobId: 11, typeIds: [5, 6, 7, 8, 19, 20, 21, 22, 212], icon: Sword },
  { id: 'arma_escultor', label: 'Arma (Escultor)', jobId: 13, typeIds: [2, 3, 4], icon: Wand2 },
  { id: 'escudo', label: 'Escudo', typeIds: [82], icon: Shield },
  { id: 'trofeo', label: 'Trofeo', typeIds: [151, 271], icon: Trophy },
];

export const STAT_FILTERS_DAMAGES: StatFilterDef[] = [
  { id: 'da_tierra', runeId: 11657, iconId: 11657, name: 'Tierra (fijos)', color: '#b45309', glyphType: 'plant' },
  { id: 'da_fuego', runeId: 11659, iconId: 11659, name: 'Fuego (fijos)', color: '#ef4444', glyphType: 'fire' },
  { id: 'da_agua', runeId: 11661, iconId: 11661, name: 'Agua (fijos)', color: '#0ea5e9', glyphType: 'water' },
  { id: 'da_aire', runeId: 11663, iconId: 11663, name: 'Aire (fijos)', color: '#14b8a6', glyphType: 'air' },
  { id: 'da_neutro', runeId: 11665, iconId: 11665, name: 'Neutrales (fijos)', color: '#94a3b8', glyphType: 'neutral' },
  { id: 'da_cri', runeId: 11653, iconId: 11653, name: 'Críticos', color: '#ec4899', glyphType: 'crit' },
  { id: 'da_gen', runeId: 7435, iconId: 7435, name: 'Daños', color: '#d946ef', glyphType: 'zap' },
  { id: 'da_emp', runeId: 11649, iconId: 11649, name: 'Empuje', color: '#f97316', glyphType: 'arrow' },
  { id: 'da_trampas', runeId: 7446, iconId: 78268, textKey: 'trampa', name: 'Trampas (Da Tram)', color: '#3b82f6', glyphType: 'trap' },
  { id: 'da_pot_trampas', runeId: 7447, iconId: 78024, textKey: 'pot_trampa', name: 'Potencia Trampas (Por Tram)', color: '#10b981', glyphType: 'zap' },
  { id: 'da_hech', runeId: 18722, iconId: 18722, name: 'Hechizos (%)', color: '#eab308', glyphType: 'star' },
  { id: 'da_arm', runeId: 18721, iconId: 18721, name: 'Arma (%)', color: '#d97706', glyphType: 'sword' },
  { id: 'da_dis', runeId: 18720, iconId: 18720, name: 'Distancia (%)', color: '#06b6d4', glyphType: 'target' },
  { id: 'da_cac', runeId: 18719, iconId: 18719, name: 'Cuerpo a Cuerpo (%)', color: '#ef4444', glyphType: 'fist' },
];

export const STAT_FILTERS_RESISTANCES: StatFilterDef[] = [
  { id: 'res_p_tie', runeId: 7459, iconId: 7459, name: 'Tierra (%)', color: '#b45309', glyphType: 'plant' },
  { id: 'res_tie', runeId: 7455, iconId: 7455, name: 'Tierra (fija)', color: '#92400e', glyphType: 'plant' },
  { id: 'res_p_fue', runeId: 7457, iconId: 7457, name: 'Fuego (%)', color: '#ef4444', glyphType: 'fire' },
  { id: 'res_fue', runeId: 7452, iconId: 7452, name: 'Fuego (fija)', color: '#dc2626', glyphType: 'fire' },
  { id: 'res_p_agu', runeId: 7560, iconId: 7560, name: 'Agua (%)', color: '#0ea5e9', glyphType: 'water' },
  { id: 'res_agu', runeId: 7454, iconId: 7454, name: 'Agua (fija)', color: '#0284c7', glyphType: 'water' },
  { id: 'res_p_air', runeId: 7458, iconId: 7458, name: 'Aire (%)', color: '#14b8a6', glyphType: 'air' },
  { id: 'res_air', runeId: 7453, iconId: 7453, name: 'Aire (fija)', color: '#0d9488', glyphType: 'air' },
  { id: 'res_p_neu', runeId: 7460, iconId: 7460, name: 'Neutral (%)', color: '#94a3b8', glyphType: 'neutral' },
  { id: 'res_neu', runeId: 7456, iconId: 7456, name: 'Neutral (fija)', color: '#64748b', glyphType: 'neutral' },
  { id: 'res_cri', runeId: 11655, iconId: 11655, name: 'Crítica (fija)', color: '#ec4899', glyphType: 'crit' },
  { id: 'res_emp', runeId: 11651, iconId: 11651, name: 'Empuje (fija)', color: '#f97316', glyphType: 'arrow' },
  { id: 'res_p_dis', runeId: 18724, iconId: 18724, name: 'Distancia (%)', color: '#06b6d4', glyphType: 'target' },
  { id: 'res_p_cac', runeId: 18723, iconId: 18723, name: 'Cuerpo a Cuerpo (%)', color: '#ef4444', glyphType: 'fist' },
];

export const STAT_FILTERS_CHARACTERISTICS: StatFilterDef[] = [
  { id: 'pa', runeId: 1557, iconId: 1557, name: 'PA', color: '#38bdf8', glyphType: 'star' },
  { id: 'fo', runeId: 1519, iconId: 1519, name: 'Fuerza', color: '#b45309', glyphType: 'plant' },
  { id: 'caza', runeId: 10057, iconId: 10057, name: 'Caza', color: '#ef4444', glyphType: 'caza' },
  { id: 'pm', runeId: 1558, iconId: 1558, name: 'PM', color: '#10b981', glyphType: 'pm' },
  { id: 'inte', runeId: 1522, iconId: 1522, name: 'Inteligencia', color: '#f97316', glyphType: 'fire' },
  { id: 'fui', runeId: 11637, iconId: 11637, name: 'Huida', color: '#f59e0b', glyphType: 'dodge' },
  { id: 'al', runeId: 7438, iconId: 7438, name: 'Alcance', color: '#2dd4bf', glyphType: 'eye' },
  { id: 'sue', runeId: 1525, iconId: 1525, name: 'Suerte', color: '#0ea5e9', glyphType: 'water' },
  { id: 'pla', runeId: 11639, iconId: 11639, name: 'Placaje', color: '#84cc16', glyphType: 'lock' },
  { id: 'invo', runeId: 7442, iconId: 7442, name: 'Invocaciones', color: '#eab308', glyphType: 'invo' },
  { id: 'agi', runeId: 1524, iconId: 1524, name: 'Agilidad', color: '#10b981', glyphType: 'air' },
  { id: 'esq_pa', runeId: 11641, iconId: 11641, name: 'Esquiva PA', color: '#0284c7', glyphType: 'shield' },
  { id: 'cri', runeId: 7433, iconId: 7433, name: 'Críticos (%)', color: '#ef4444', glyphType: 'crit' },
  { id: 'sa', runeId: 1521, iconId: 1521, name: 'Sabiduría', color: '#a855f7', glyphType: 'moon' },
  { id: 'esq_pm', runeId: 11643, iconId: 11643, name: 'Esquiva PM', color: '#059669', glyphType: 'shield' },
  { id: 'pot', runeId: 7436, iconId: 7436, name: 'Potencia', color: '#eab308', glyphType: 'zap' },
  { id: 'vi', runeId: 1523, iconId: 1523, name: 'Vitalidad', color: '#f43f5e', glyphType: 'heart' },
  { id: 'ret_pa', runeId: 11645, iconId: 11645, name: 'Retirada de PA', color: '#0284c7', glyphType: 'star' },
  { id: 'pod', runeId: 7443, iconId: 7443, name: 'Pods', color: '#ca8a04', glyphType: 'pod' },
  { id: 'ini', runeId: 7448, iconId: 7448, name: 'Iniciativa', color: '#d946ef', glyphType: 'ini' },
  { id: 'ret_pm', runeId: 11647, iconId: 11647, name: 'Retirada de PM', color: '#059669', glyphType: 'pm' },
  { id: 'cu', runeId: 7434, iconId: 7434, name: 'Curación', color: '#ef4444', glyphType: 'heal' },
  { id: 'prosp', runeId: 7451, iconId: 7451, name: 'Prospección', color: '#06b6d4', glyphType: 'search' },
  { id: 'reenvio', runeId: 7437, iconId: 7437, textKey: 'reenvio', name: 'Reenvío de Daños', color: '#c084fc', glyphType: 'return' },
];

export const ALL_STAT_FILTERS: StatFilterDef[] = [
  ...STAT_FILTERS_DAMAGES,
  ...STAT_FILTERS_RESISTANCES,
  ...STAT_FILTERS_CHARACTERISTICS,
];
