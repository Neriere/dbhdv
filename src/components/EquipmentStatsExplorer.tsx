import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Search,
  Sliders,
  SlidersHorizontal,
  Filter,
  RotateCcw,
  Sparkles,
  Coins,
  TrendingUp,
  Wrench,
  Zap,
  ShoppingCart,
  ExternalLink,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Heart,
  Eye,
  Star,
  Flame,
  Droplet,
  Wind,
  Shield,
  Sword,
  Target,
  Moon,
  RefreshCw,
  Edit2,
  CheckCircle2,
  ArrowUpDown,
  Layers,
  Tag,
  AlertCircle,
  Footprints,
  Scissors,
  Gem,
  Wand2,
  HelpCircle,
  Percent,
} from 'lucide-react';
import { DofusItem, MarketPriceMap, DofusRecipe } from '../types';
import {
  getAllLocalItems,
  getCraftableItemsSnapshot,
  getItemName,
  getItemTypeName,
  getItemIconUrl,
  getItemFallbackIconUrl,
  calculateItemCraftCost,
  getStoredMarketPrices,
  getStoredPriceUpdatedAt,
  saveMarketPrice,
  addToShoppingList,
  getRecipeByResultId,
} from '../services/dofusDbService';
import {
  DOFUS_BASE_RUNES,
  BaseRuneDefinition,
  extractItemStats,
  ExtractedItemStat,
} from '../data/dofusRuneWeights';
import { useMarketPrices } from '../hooks/useMarketPrices';
import { SafeImage } from './SafeImage';
import { KamaDisplay } from './common/KamaDisplay';
import { matchesSearchQuery } from '../utils/searchUtils';

// ==========================================
// CATEGORÍAS DE EQUIPAMIENTO (Slots)
// Conforme a la referencia de Dofusbook
// ==========================================
export interface EquipmentCategoryDef {
  id: string;
  name: string;
  typeIds: number[];
  iconName?: string;
}

export const EQUIPMENT_CATEGORIES: EquipmentCategoryDef[] = [
  { id: 'amuleto', name: 'Amuleto', typeIds: [1] },
  { id: 'anillo', name: 'Anillo', typeIds: [9] },
  { id: 'botas', name: 'Botas', typeIds: [11] },
  { id: 'escudo', name: 'Escudo', typeIds: [82, 112] },
  { id: 'capa', name: 'Capa', typeIds: [17] },
  { id: 'cinturon', name: 'Cinturón', typeIds: [10] },
  { id: 'sombrero', name: 'Sombrero', typeIds: [16] },
  { id: 'dofus', name: 'Dofus', typeIds: [23] },
  { id: 'trofeo', name: 'Trofeo', typeIds: [151, 271] },
  { id: 'prismaradita', name: 'Prismaradita', typeIds: [272] },
  { id: 'mascota', name: 'Mascota', typeIds: [18] },
  { id: 'mascotura', name: 'Mascotura', typeIds: [121, 281] },
  { id: 'dragopavo', name: 'Dragopavo', typeIds: [99, 326] },
  { id: 'mulagua', name: 'Mulagua', typeIds: [323] },
  { id: 'vueloceronte', name: 'Vueloceronte', typeIds: [327] },
  // Armas
  { id: 'espada', name: 'Espada', typeIds: [6] },
  { id: 'daga', name: 'Daga', typeIds: [5] },
  { id: 'arco', name: 'Arco', typeIds: [2] },
  { id: 'varita', name: 'Varita', typeIds: [3] },
  { id: 'baston', name: 'Bastón', typeIds: [4] },
  { id: 'martillo', name: 'Martillo', typeIds: [7] },
  { id: 'pala', name: 'Pala', typeIds: [8] },
  { id: 'hacha', name: 'Hacha', typeIds: [19] },
  { id: 'guadana', name: 'Guadaña', typeIds: [22] },
];

// ==========================================
// DEFINICIONES DE ESTADÍSTICAS (4 COLUMNAS)
// Idénticas a la imagen de Dofusbook
// ==========================================
export interface StatFilterItem {
  id: string;
  name: string;
  runeId: number;
  color: string;
  iconType: 'star' | 'pm' | 'eye' | 'heart' | 'leaf' | 'water' | 'plant' | 'fire' | 'zap' | 'crit' | 'moon' | 'shield' | 'heal' | 'lock' | 'dodge' | 'ini' | 'invo' | 'search' | 'pod' | 'neutral' | 'trap' | 'sword' | 'arrow' | 'target' | 'fist' | 'return';
  defaultStep?: number;
}

// 1. EFECTOS PRINCIPALES
export const STATS_PRINCIPALES: StatFilterItem[] = [
  { id: 'pa', name: 'PA', runeId: 1557, color: '#38bdf8', iconType: 'star', defaultStep: 1 },
  { id: 'pm', name: 'PM', runeId: 1558, color: '#10b981', iconType: 'pm', defaultStep: 1 },
  { id: 'al', name: 'AL', runeId: 7438, color: '#2dd4bf', iconType: 'eye', defaultStep: 1 },
  { id: 'vi', name: 'Vitalidad', runeId: 1523, color: '#f43f5e', iconType: 'heart', defaultStep: 50 },
  { id: 'agi', name: 'Agilidad', runeId: 1524, color: '#10b981', iconType: 'leaf', defaultStep: 10 },
  { id: 'sue', name: 'Suerte', runeId: 1525, color: '#0ea5e9', iconType: 'water', defaultStep: 10 },
  { id: 'fo', name: 'Fuerza', runeId: 1519, color: '#b45309', iconType: 'plant', defaultStep: 10 },
  { id: 'inte', name: 'Inteligencia', runeId: 1522, color: '#f97316', iconType: 'fire', defaultStep: 10 },
  { id: 'pot', name: 'Potencia', runeId: 7436, color: '#eab308', iconType: 'zap', defaultStep: 10 },
  { id: 'cri', name: 'Crítico', runeId: 7433, color: '#ef4444', iconType: 'crit', defaultStep: 1 },
  { id: 'sa', name: 'Sabiduría', runeId: 1521, color: '#a855f7', iconType: 'moon', defaultStep: 10 },
];

// 2. EFECTOS SECUNDARIOS
export const STATS_SECUNDARIAS: StatFilterItem[] = [
  { id: 'ret_pa', name: 'Retira PA', runeId: 11645, color: '#0284c7', iconType: 'star', defaultStep: 1 },
  { id: 'esq_pa', name: 'Esquiva PA', runeId: 11641, color: '#0284c7', iconType: 'shield', defaultStep: 5 },
  { id: 'ret_pm', name: 'Retira PM', runeId: 11647, color: '#059669', iconType: 'pm', defaultStep: 1 },
  { id: 'esq_pm', name: 'Esquiva PM', runeId: 11643, color: '#059669', iconType: 'shield', defaultStep: 5 },
  { id: 'cu', name: 'Cura', runeId: 7434, color: '#ef4444', iconType: 'heal', defaultStep: 5 },
  { id: 'pla', name: 'Placaje', runeId: 11639, color: '#84cc16', iconType: 'lock', defaultStep: 5 },
  { id: 'fui', name: 'Huida', runeId: 11637, color: '#f59e0b', iconType: 'dodge', defaultStep: 5 },
  { id: 'ini', name: 'Iniciativa', runeId: 7448, color: '#d946ef', iconType: 'ini', defaultStep: 100 },
  { id: 'invo', name: 'Invocación', runeId: 7442, color: '#eab308', iconType: 'invo', defaultStep: 1 },
  { id: 'prosp', name: 'Prospección', runeId: 7451, color: '#06b6d4', iconType: 'search', defaultStep: 5 },
  { id: 'pod', name: 'Pods', runeId: 7443, color: '#ca8a04', iconType: 'pod', defaultStep: 100 },
];

// 3. DAÑOS
export const STATS_DANOS: StatFilterItem[] = [
  { id: 'da_gen', name: 'Daños', runeId: 7435, color: '#eab308', iconType: 'zap', defaultStep: 5 },
  { id: 'da_neutro', name: 'Daños Neutro', runeId: 11665, color: '#94a3b8', iconType: 'neutral', defaultStep: 5 },
  { id: 'da_tierra', name: 'Daños Tierra', runeId: 11657, color: '#b45309', iconType: 'plant', defaultStep: 5 },
  { id: 'da_fuego', name: 'Daños Fuego', runeId: 11659, color: '#ef4444', iconType: 'fire', defaultStep: 5 },
  { id: 'da_agua', name: 'Daños Agua', runeId: 11661, color: '#0ea5e9', iconType: 'water', defaultStep: 5 },
  { id: 'da_aire', name: 'Daños Aire', runeId: 11663, color: '#14b8a6', iconType: 'leaf', defaultStep: 5 },
  { id: 'da_trampas', name: 'Daños Trampa', runeId: 7446, color: '#3b82f6', iconType: 'trap', defaultStep: 5 },
  { id: 'da_pot_trampas', name: 'Pot Trampa', runeId: 7447, color: '#10b981', iconType: 'zap', defaultStep: 5 },
  { id: 'da_hech', name: '% daños Hechizos', runeId: 18722, color: '#eab308', iconType: 'star', defaultStep: 1 },
  { id: 'da_arm', name: '% daños Armas', runeId: 18721, color: '#d97706', iconType: 'sword', defaultStep: 1 },
  { id: 'da_cri', name: 'Daños Crítico', runeId: 11653, color: '#ec4899', iconType: 'crit', defaultStep: 5 },
  { id: 'da_emp', name: 'Daños Empuje', runeId: 11649, color: '#f97316', iconType: 'arrow', defaultStep: 5 },
  { id: 'da_dis', name: '% daños Distancia', runeId: 18720, color: '#06b6d4', iconType: 'target', defaultStep: 1 },
  { id: 'da_cac', name: '% daños Cac', runeId: 18719, color: '#ef4444', iconType: 'fist', defaultStep: 1 },
  { id: 'reenvio', name: 'Reenvío daños', runeId: 7437, color: '#c084fc', iconType: 'return', defaultStep: 1 },
];

// 4. RESISTENCIAS
export const STATS_RESISTENCIAS: StatFilterItem[] = [
  { id: 'res_neu', name: 'Res. Neutro', runeId: 7456, color: '#64748b', iconType: 'shield', defaultStep: 5 },
  { id: 'res_p_neu', name: '% Res. Neutro', runeId: 7460, color: '#94a3b8', iconType: 'shield', defaultStep: 1 },
  { id: 'res_tie', name: 'Res. Tierra', runeId: 7455, color: '#92400e', iconType: 'shield', defaultStep: 5 },
  { id: 'res_p_tie', name: '% Res. Tierra', runeId: 7459, color: '#b45309', iconType: 'shield', defaultStep: 1 },
  { id: 'res_fue', name: 'Res. Fuego', runeId: 7452, color: '#dc2626', iconType: 'shield', defaultStep: 5 },
  { id: 'res_p_fue', name: '% Res. Fuego', runeId: 7457, color: '#ef4444', iconType: 'shield', defaultStep: 1 },
  { id: 'res_agu', name: 'Res. Agua', runeId: 7454, color: '#0284c7', iconType: 'shield', defaultStep: 5 },
  { id: 'res_p_agu', name: '% Res. Agua', runeId: 7560, color: '#0ea5e9', iconType: 'shield', defaultStep: 1 },
  { id: 'res_air', name: 'Res. Aire', runeId: 7453, color: '#0d9488', iconType: 'shield', defaultStep: 5 },
  { id: 'res_p_air', name: '% Res. Aire', runeId: 7458, color: '#14b8a6', iconType: 'shield', defaultStep: 1 },
  { id: 'res_cri', name: 'Res Crítico', runeId: 11655, color: '#ec4899', iconType: 'shield', defaultStep: 5 },
  { id: 'res_emp', name: 'Res Empuje', runeId: 11651, color: '#f97316', iconType: 'shield', defaultStep: 5 },
  { id: 'res_p_dis', name: '% Res Distancia', runeId: 18724, color: '#06b6d4', iconType: 'shield', defaultStep: 1 },
  { id: 'res_p_cac', name: '% Res CaC', runeId: 18723, color: '#ef4444', iconType: 'shield', defaultStep: 1 },
];

const ALL_STAT_ITEMS = [
  ...STATS_PRINCIPALES,
  ...STATS_SECUNDARIAS,
  ...STATS_DANOS,
  ...STATS_RESISTENCIAS,
];

const STAT_BY_ID_MAP = new Map<string, StatFilterItem>(
  ALL_STAT_ITEMS.map((s) => [s.id, s])
);

const STAT_BY_RUNE_ID_MAP = new Map<number, StatFilterItem>(
  ALL_STAT_ITEMS.map((s) => [s.runeId, s])
);

// Opciones de Ordenación
export type EquipmentSortOption =
  | 'level_desc'
  | 'level_asc'
  | 'price_asc'
  | 'price_desc'
  | 'craft_cost_asc'
  | 'profit_desc'
  | 'roi_desc'
  | 'stat_value_desc';

interface EquipmentStatsExplorerProps {
  onSelectRecipeForCalculator?: (item: DofusItem) => void;
  onSelectForCrushing?: (item: DofusItem) => void;
}

export const EquipmentStatsExplorer: React.FC<EquipmentStatsExplorerProps> = ({
  onSelectRecipeForCalculator,
  onSelectForCrushing,
}) => {
  // Hook de precios del mercado centralizado
  const { marketPrices, updatePrice } = useMarketPrices();

  // Estados de Filtros
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() => {
    // Por defecto, categorías principales equipables
    return ['amuleto', 'anillo', 'botas', 'escudo', 'capa', 'cinturon', 'sombrero', 'espada', 'daga', 'arco', 'varita', 'baston', 'martillo', 'pala', 'hacha'];
  });

  // Filtros de estadísticas activas con su valor mínimo: { [statId]: minimumValue }
  const [activeStatThresholds, setActiveStatThresholds] = useState<Record<string, number>>({});

  // Toggles auxiliares
  const [onlyCraftables, setOnlyCraftables] = useState<boolean>(false);
  const [onlyWithMarketPrice, setOnlyWithMarketPrice] = useState<boolean>(false);
  const [onlyProfitable, setOnlyProfitable] = useState<boolean>(false);

  // Rango de Niveles
  const [minLevel, setMinLevel] = useState<number | ''>(1);
  const [maxLevel, setMaxLevel] = useState<number | ''>(200);

  // Filtros de Precio
  const [minMarketPrice, setMinMarketPrice] = useState<number | ''>('');
  const [maxMarketPrice, setMaxMarketPrice] = useState<number | ''>('');
  const [minCraftCost, setMinCraftCost] = useState<number | ''>('');
  const [maxCraftCost, setMaxCraftCost] = useState<number | ''>('');
  const [minProfitKamas, setMinProfitKamas] = useState<number | ''>('');

  // Búsqueda por texto
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modo de visualización: 'effects' (mostrar estadísticas) | 'recipes' (mostrar recetas de ingredientes)
  const [displayMode, setDisplayMode] = useState<'effects' | 'recipes'>('effects');

  // Ordenación
  const [sortBy, setSortBy] = useState<EquipmentSortOption>('level_desc');

  // Paginación
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 30;

  // Estado de edición rápida de precio
  const [editingPriceItemId, setEditingPriceItemId] = useState<number | null>(null);
  const [editPriceInput, setEditPriceInput] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Colapso del panel de filtros en pantallas pequeñas
  const [isFilterBoxOpen, setIsFilterBoxOpen] = useState<boolean>(true);

  // Mostrar mensaje toast temporal
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 2800);
  }, []);

  // Catálogo base de equipamiento cargado desde el almacén
  const [rawItems, setRawItems] = useState<DofusItem[]>([]);

  useEffect(() => {
    const hydrate = () => {
      // Tomamos todos los ítems disponibles
      const allItems = getAllLocalItems();
      setRawItems(allItems);
    };

    hydrate();
    window.addEventListener('dofus_database_updated', hydrate);
    return () => window.removeEventListener('dofus_database_updated', hydrate);
  }, []);

  // Normalización de equipables con sus categorías y estadísticas pre-extraídas
  interface AnalyzedEquipment {
    item: DofusItem;
    name: string;
    level: number;
    typeId: number;
    category: EquipmentCategoryDef | null;
    stats: ExtractedItemStat[];
    statsMap: Map<number, ExtractedItemStat>; // runeId -> stat
    hasRecipe: boolean;
    marketPrice: number;
    craftCost: number;
    profit: number;
    roi: number;
    recipe?: DofusRecipe;
  }

  const analyzedItems = useMemo<AnalyzedEquipment[]>(() => {
    if (!rawItems || rawItems.length === 0) return [];

    // Mapeo rápido de typeId -> Category
    const typeIdToCategoryMap = new Map<number, EquipmentCategoryDef>();
    EQUIPMENT_CATEGORIES.forEach((cat) => {
      cat.typeIds.forEach((tid) => typeIdToCategoryMap.set(tid, cat));
    });

    const craftableSnapshot = getCraftableItemsSnapshot();
    const craftableMap = new Map<number, DofusItem>();
    craftableSnapshot.forEach((ci) => craftableMap.set(ci.id, ci));

    const results: AnalyzedEquipment[] = [];

    for (const item of rawItems) {
      const typeId = Number(item.typeId || item.type?.id || 0);
      const category = typeIdToCategoryMap.get(typeId) || null;

      // Solo incluimos objetos que pertenezcan a una categoría de equipamiento o tengan stats extraíbles
      if (!category && typeId !== 112 && typeId !== 271 && typeId !== 23) {
        continue;
      }

      const stats = extractItemStats(item);
      // Solo objetos equipables con características o categoría válida
      if (stats.length === 0 && !category) {
        continue;
      }

      const statsMap = new Map<number, ExtractedItemStat>();
      for (const s of stats) {
        statsMap.set(s.rune.id, s);
      }

      const marketPrice = marketPrices[item.id] || item.price || 0;
      const recipe = (item as any).recipeData || getRecipeByResultId(item.id);
      const hasRecipe = Boolean(recipe || item.hasRecipe || craftableMap.has(item.id));
      const craftCost = hasRecipe ? calculateItemCraftCost(item.id) : 0;
      const profit = (marketPrice > 0 && craftCost > 0) ? marketPrice - craftCost : 0;
      const roi = (craftCost > 0 && profit > 0) ? Math.round((profit / craftCost) * 100) : 0;

      results.push({
        item,
        name: getItemName(item),
        level: item.level || 1,
        typeId,
        category,
        stats,
        statsMap,
        hasRecipe,
        marketPrice,
        craftCost,
        profit,
        roi,
        recipe,
      });
    }

    return results;
  }, [rawItems, marketPrices]);

  // Manejador para alternar estadísticas en el filtro
  const handleToggleStat = (stat: StatFilterItem) => {
    setActiveStatThresholds((prev) => {
      const copy = { ...prev };
      if (copy[stat.id] !== undefined) {
        delete copy[stat.id];
      } else {
        copy[stat.id] = stat.defaultStep || 1;
      }
      return copy;
    });
    setCurrentPage(1);
  };

  // Manejador para cambiar el valor umbral de una estadística
  const handleThresholdChange = (statId: string, val: string) => {
    const num = Number(val);
    setActiveStatThresholds((prev) => ({
      ...prev,
      [statId]: Number.isNaN(num) ? 0 : Math.max(0, num),
    }));
    setCurrentPage(1);
  };

  // Manejador para alternar una categoría
  const handleToggleCategory = (catId: string) => {
    setSelectedCategories((prev) => {
      if (prev.includes(catId)) {
        return prev.filter((id) => id !== catId);
      } else {
        return [...prev, catId];
      }
    });
    setCurrentPage(1);
  };

  const handleSelectAllCategories = () => {
    setSelectedCategories(EQUIPMENT_CATEGORIES.map((c) => c.id));
    setCurrentPage(1);
  };

  const handleClearAllCategories = () => {
    setSelectedCategories([]);
    setCurrentPage(1);
  };

  // Restablecer todos los filtros
  const handleResetFilters = () => {
    setSelectedCategories(['amuleto', 'anillo', 'botas', 'escudo', 'capa', 'cinturon', 'sombrero', 'espada', 'daga', 'arco', 'varita', 'baston', 'martillo', 'pala', 'hacha']);
    setActiveStatThresholds({});
    setOnlyCraftables(false);
    setOnlyWithMarketPrice(false);
    setOnlyProfitable(false);
    setMinLevel(1);
    setMaxLevel(200);
    setMinMarketPrice('');
    setMaxMarketPrice('');
    setMinCraftCost('');
    setMaxCraftCost('');
    setMinProfitKamas('');
    setSearchQuery('');
    setSortBy('level_desc');
    setCurrentPage(1);
    showToast('Filtros restablecidos');
  };

  // Filtrado reactivo de ítems
  const filteredItems = useMemo(() => {
    return analyzedItems.filter((entry) => {
      // 1. Filtro por categoría seleccionada
      if (selectedCategories.length > 0) {
        if (!entry.category || !selectedCategories.includes(entry.category.id)) {
          return false;
        }
      }

      // 2. Filtro por nivel
      const minLvlNum = minLevel === '' ? 1 : Number(minLevel);
      const maxLvlNum = maxLevel === '' ? 200 : Number(maxLevel);
      if (entry.level < minLvlNum || entry.level > maxLvlNum) {
        return false;
      }

      // 3. Filtro por búsqueda de texto
      if (searchQuery.trim().length > 0) {
        if (!matchesSearchQuery([entry.name, entry.category?.name], searchQuery)) {
          return false;
        }
      }

      // 4. Filtro solo crafteables
      if (onlyCraftables && !entry.hasRecipe) {
        return false;
      }

      // 5. Filtro solo con precio de mercadillo
      if (onlyWithMarketPrice && entry.marketPrice <= 0) {
        return false;
      }

      // 6. Filtro solo rentables (Profit > 0)
      if (onlyProfitable && entry.profit <= 0) {
        return false;
      }

      // 7. Filtros económicos extras
      if (minMarketPrice !== '' && entry.marketPrice < Number(minMarketPrice)) {
        return false;
      }
      if (maxMarketPrice !== '' && entry.marketPrice > Number(maxMarketPrice)) {
        return false;
      }
      if (minCraftCost !== '' && entry.craftCost < Number(minCraftCost)) {
        return false;
      }
      if (maxCraftCost !== '' && entry.craftCost > Number(maxCraftCost)) {
        return false;
      }
      if (minProfitKamas !== '' && entry.profit < Number(minProfitKamas)) {
        return false;
      }

      // 8. FILTRO DE ESTADÍSTICAS (El corazón del módulo)
      // Debe cumplir simultáneamente TODOS los umbrales activos
      const activeKeys = Object.keys(activeStatThresholds);
      if (activeKeys.length > 0) {
        for (const statId of activeKeys) {
          const requiredMin = activeStatThresholds[statId];
          const statDef = STAT_BY_ID_MAP.get(statId);
          if (!statDef) continue;

          const itemStat = entry.statsMap.get(statDef.runeId);
          if (!itemStat) {
            return false; // El ítem no tiene esta estadística en absoluto
          }

          // En Dofusbook, se evalúa contra el roll máximo del objeto (statMax)
          if (itemStat.statMax < requiredMin) {
            return false;
          }
        }
      }

      return true;
    });
  }, [
    analyzedItems,
    selectedCategories,
    minLevel,
    maxLevel,
    searchQuery,
    onlyCraftables,
    onlyWithMarketPrice,
    onlyProfitable,
    minMarketPrice,
    maxMarketPrice,
    minCraftCost,
    maxCraftCost,
    minProfitKamas,
    activeStatThresholds,
  ]);

  // Primer stat activo para ordenación personalizada por valor de estadística
  const firstActiveStat = useMemo(() => {
    const keys = Object.keys(activeStatThresholds);
    if (keys.length === 0) return null;
    return STAT_BY_ID_MAP.get(keys[0]) || null;
  }, [activeStatThresholds]);

  // Ordenación de resultados
  const sortedItems = useMemo(() => {
    const list = [...filteredItems];

    list.sort((a, b) => {
      switch (sortBy) {
        case 'level_desc':
          return b.level - a.level || a.name.localeCompare(b.name);
        case 'level_asc':
          return a.level - b.level || a.name.localeCompare(b.name);
        case 'price_asc':
          if (a.marketPrice === 0) return 1;
          if (b.marketPrice === 0) return -1;
          return a.marketPrice - b.marketPrice;
        case 'price_desc':
          return b.marketPrice - a.marketPrice;
        case 'craft_cost_asc':
          if (a.craftCost === 0) return 1;
          if (b.craftCost === 0) return -1;
          return a.craftCost - b.craftCost;
        case 'profit_desc':
          return b.profit - a.profit;
        case 'roi_desc':
          return b.roi - a.roi;
        case 'stat_value_desc': {
          if (!firstActiveStat) return b.level - a.level;
          const valA = a.statsMap.get(firstActiveStat.runeId)?.statMax || 0;
          const valB = b.statsMap.get(firstActiveStat.runeId)?.statMax || 0;
          return valB - valA || b.level - a.level;
        }
        default:
          return b.level - a.level;
      }
    });

    return list;
  }, [filteredItems, sortBy, firstActiveStat]);

  // Paginación
  const totalPages = Math.max(1, Math.ceil(sortedItems.length / pageSize));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedItems.slice(start, start + pageSize);
  }, [sortedItems, currentPage, pageSize]);

  // Guardar edición rápida de precio
  const handleSavePrice = async (itemId: number) => {
    const parsed = Number(editPriceInput);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      await updatePrice(itemId, parsed);
      setEditingPriceItemId(null);
      setEditPriceInput('');
      showToast('Precio actualizado correctamente');
    }
  };

  // Añadir a lista de compras
  const handleAddToShopping = (item: DofusItem) => {
    addToShoppingList(item, 1);
    showToast(`"${getItemName(item)}" añadido a la lista de compras`);
  };

  // Función para renderizar el icono de una estadística según su tipo
  const renderStatIcon = (iconType: StatFilterItem['iconType'], color: string) => {
    switch (iconType) {
      case 'star':
        return <Star className="w-3.5 h-3.5 shrink-0 fill-current" style={{ color }} />;
      case 'pm':
        return <Footprints className="w-3.5 h-3.5 shrink-0" style={{ color }} />;
      case 'eye':
        return <Eye className="w-3.5 h-3.5 shrink-0" style={{ color }} />;
      case 'heart':
        return <Heart className="w-3.5 h-3.5 shrink-0 fill-current" style={{ color }} />;
      case 'leaf':
        return <Wind className="w-3.5 h-3.5 shrink-0" style={{ color }} />;
      case 'water':
        return <Droplet className="w-3.5 h-3.5 shrink-0 fill-current" style={{ color }} />;
      case 'plant':
        return <Sparkles className="w-3.5 h-3.5 shrink-0" style={{ color }} />;
      case 'fire':
        return <Flame className="w-3.5 h-3.5 shrink-0 fill-current" style={{ color }} />;
      case 'zap':
        return <Zap className="w-3.5 h-3.5 shrink-0 fill-current" style={{ color }} />;
      case 'crit':
        return <Target className="w-3.5 h-3.5 shrink-0" style={{ color }} />;
      case 'moon':
        return <Moon className="w-3.5 h-3.5 shrink-0 fill-current" style={{ color }} />;
      case 'shield':
        return <Shield className="w-3.5 h-3.5 shrink-0" style={{ color }} />;
      case 'heal':
        return <Heart className="w-3.5 h-3.5 shrink-0" style={{ color }} />;
      case 'lock':
      case 'dodge':
        return <Shield className="w-3.5 h-3.5 shrink-0" style={{ color }} />;
      case 'ini':
        return <Sparkles className="w-3.5 h-3.5 shrink-0" style={{ color }} />;
      case 'invo':
        return <Star className="w-3.5 h-3.5 shrink-0" style={{ color }} />;
      case 'search':
        return <Search className="w-3.5 h-3.5 shrink-0" style={{ color }} />;
      case 'sword':
        return <Sword className="w-3.5 h-3.5 shrink-0" style={{ color }} />;
      case 'arrow':
        return <Target className="w-3.5 h-3.5 shrink-0" style={{ color }} />;
      case 'target':
        return <Target className="w-3.5 h-3.5 shrink-0" style={{ color }} />;
      default:
        return <Sparkles className="w-3.5 h-3.5 shrink-0" style={{ color }} />;
    }
  };

  const activeStatKeys = Object.keys(activeStatThresholds);

  return (
    <div className="space-y-6 pb-12">
      {/* ── Toast flotante ── */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-emerald-950/90 border border-emerald-500/60 text-emerald-200 px-4 py-2.5 rounded-xl shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-3 duration-200 text-sm font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── Header Principal ── */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 md:p-6 shadow-xl backdrop-blur-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-inner">
                <Sliders className="w-5 h-5" />
              </div>
              <h1 className="text-xl md:text-2xl font-black text-slate-100 tracking-tight">
                Explorador de Equipamiento por Estadísticas &amp; Precios
              </h1>
            </div>
            <p className="text-xs md:text-sm text-slate-400 max-w-3xl">
              Encuentra y compara equipables según sus características mínimas (estilo Dofusbook) evaluando simultáneamente el{' '}
              <span className="text-amber-400 font-bold">precio en mercadillo</span> frente al{' '}
              <span className="text-emerald-400 font-bold">costo de crafteo</span>.
            </p>
          </div>

          {/* Métricas rápidas */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="bg-slate-950/80 border border-slate-800/80 px-3 py-1.5 rounded-lg flex items-center gap-2">
              <span className="text-slate-500">Coincidencias:</span>
              <span className="text-amber-400 font-bold">{filteredItems.length}</span>
            </div>
            <div className="bg-slate-950/80 border border-slate-800/80 px-3 py-1.5 rounded-lg flex items-center gap-2">
              <span className="text-slate-500">Con Precio HDV:</span>
              <span className="text-emerald-400 font-bold">
                {filteredItems.filter((i) => i.marketPrice > 0).length}
              </span>
            </div>
            <button
              onClick={handleResetFilters}
              className="px-3 py-1.5 bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 hover:text-white border border-slate-700/60 rounded-lg font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Restablecer todos los filtros"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Limpiar filtros</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── PANEL DE FILTROS ESTILO DOFUSBOOK (5 COLUMNAS) ── */}
      <div className="bg-slate-900/95 border border-slate-800/90 rounded-2xl shadow-xl overflow-hidden">
        {/* Barra superior de control del panel */}
        <div className="px-5 py-3.5 bg-slate-950/70 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-sm font-bold text-slate-200">
            <Filter className="w-4 h-4 text-amber-400" />
            <span>Filtros de Categorías &amp; Estadísticas</span>
            {activeStatKeys.length > 0 && (
              <span className="bg-amber-500 text-slate-950 font-black text-xs px-2 py-0.5 rounded-full">
                {activeStatKeys.length} stats activas
              </span>
            )}
          </div>
          <button
            onClick={() => setIsFilterBoxOpen(!isFilterBoxOpen)}
            className="text-xs font-semibold text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors cursor-pointer"
          >
            {isFilterBoxOpen ? 'Contraer panel' : 'Expandir panel'}
            {isFilterBoxOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {isFilterBoxOpen && (
          <div className="p-4 md:p-5 space-y-5">
            {/* Rejilla de 5 Columnas (Idéntica a Dofusbook) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
              {/* COLUMNA 1: CATEGORÍAS */}
              <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 flex flex-col">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800/60 mb-2">
                  <h3 className="text-xs font-black uppercase tracking-wider text-amber-400">
                    Categorías
                  </h3>
                  <div className="flex items-center gap-1 text-[11px]">
                    <button
                      onClick={handleSelectAllCategories}
                      className="text-slate-400 hover:text-amber-400 px-1 py-0.5 rounded transition-colors"
                      title="Seleccionar todas"
                    >
                      Todos
                    </button>
                    <span className="text-slate-600">|</span>
                    <button
                      onClick={handleClearAllCategories}
                      className="text-slate-400 hover:text-rose-400 px-1 py-0.5 rounded transition-colors"
                      title="Desmarcar todas"
                    >
                      Ninguno
                    </button>
                  </div>
                </div>
                <div className="space-y-1 overflow-y-auto max-h-[380px] pr-1 custom-scrollbar">
                  {EQUIPMENT_CATEGORIES.map((cat) => {
                    const isSelected = selectedCategories.includes(cat.id);
                    return (
                      <div
                        key={cat.id}
                        onClick={() => handleToggleCategory(cat.id)}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-slate-800/80 text-white border border-slate-700/80'
                            : 'bg-slate-900/30 text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
                        }`}
                      >
                        <span className="truncate">{cat.name}</span>
                        <div className="flex items-center gap-1">
                          <span
                            className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold ${
                              isSelected
                                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                                : 'bg-slate-800 text-slate-500'
                            }`}
                          >
                            ✓
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* COLUMNA 2: EFECTOS (PRINCIPALES) */}
              <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 flex flex-col">
                <div className="pb-2 border-b border-slate-800/60 mb-2">
                  <h3 className="text-xs font-black uppercase tracking-wider text-sky-400">
                    Efectos Principales
                  </h3>
                </div>
                <div className="space-y-1 overflow-y-auto max-h-[380px] pr-1 custom-scrollbar">
                  {STATS_PRINCIPALES.map((stat) => {
                    const isSelected = activeStatThresholds[stat.id] !== undefined;
                    return (
                      <button
                        key={stat.id}
                        type="button"
                        onClick={() => handleToggleStat(stat)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all text-left ${
                          isSelected
                            ? 'bg-sky-950/80 text-sky-200 border border-sky-500/80 shadow-md font-bold'
                            : 'bg-slate-900/40 text-slate-300 hover:text-white hover:bg-slate-800/60 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          {renderStatIcon(stat.iconType, stat.color)}
                          <span className="truncate">{stat.name}</span>
                        </div>
                        {isSelected && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-500/30 text-sky-300">
                            ≥{activeStatThresholds[stat.id]}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* COLUMNA 3: EFECTOS (SECUNDARIOS) */}
              <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 flex flex-col">
                <div className="pb-2 border-b border-slate-800/60 mb-2">
                  <h3 className="text-xs font-black uppercase tracking-wider text-emerald-400">
                    Efectos Secundarios
                  </h3>
                </div>
                <div className="space-y-1 overflow-y-auto max-h-[380px] pr-1 custom-scrollbar">
                  {STATS_SECUNDARIAS.map((stat) => {
                    const isSelected = activeStatThresholds[stat.id] !== undefined;
                    return (
                      <button
                        key={stat.id}
                        type="button"
                        onClick={() => handleToggleStat(stat)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all text-left ${
                          isSelected
                            ? 'bg-emerald-950/80 text-emerald-200 border border-emerald-500/80 shadow-md font-bold'
                            : 'bg-slate-900/40 text-slate-300 hover:text-white hover:bg-slate-800/60 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          {renderStatIcon(stat.iconType, stat.color)}
                          <span className="truncate">{stat.name}</span>
                        </div>
                        {isSelected && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/30 text-emerald-300">
                            ≥{activeStatThresholds[stat.id]}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* COLUMNA 4: DAÑOS */}
              <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 flex flex-col">
                <div className="pb-2 border-b border-slate-800/60 mb-2">
                  <h3 className="text-xs font-black uppercase tracking-wider text-rose-400">
                    Daños
                  </h3>
                </div>
                <div className="space-y-1 overflow-y-auto max-h-[380px] pr-1 custom-scrollbar">
                  {STATS_DANOS.map((stat) => {
                    const isSelected = activeStatThresholds[stat.id] !== undefined;
                    return (
                      <button
                        key={stat.id}
                        type="button"
                        onClick={() => handleToggleStat(stat)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all text-left ${
                          isSelected
                            ? 'bg-rose-950/80 text-rose-200 border border-rose-500/80 shadow-md font-bold'
                            : 'bg-slate-900/40 text-slate-300 hover:text-white hover:bg-slate-800/60 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          {renderStatIcon(stat.iconType, stat.color)}
                          <span className="truncate">{stat.name}</span>
                        </div>
                        {isSelected && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/30 text-rose-300">
                            ≥{activeStatThresholds[stat.id]}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* COLUMNA 5: RESISTENCIAS */}
              <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 flex flex-col">
                <div className="pb-2 border-b border-slate-800/60 mb-2">
                  <h3 className="text-xs font-black uppercase tracking-wider text-amber-500">
                    Resistencias
                  </h3>
                </div>
                <div className="space-y-1 overflow-y-auto max-h-[380px] pr-1 custom-scrollbar">
                  {STATS_RESISTENCIAS.map((stat) => {
                    const isSelected = activeStatThresholds[stat.id] !== undefined;
                    return (
                      <button
                        key={stat.id}
                        type="button"
                        onClick={() => handleToggleStat(stat)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all text-left ${
                          isSelected
                            ? 'bg-amber-950/80 text-amber-200 border border-amber-500/80 shadow-md font-bold'
                            : 'bg-slate-900/40 text-slate-300 hover:text-white hover:bg-slate-800/60 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          {renderStatIcon(stat.iconType, stat.color)}
                          <span className="truncate">{stat.name}</span>
                        </div>
                        {isSelected && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/30 text-amber-300">
                            ≥{activeStatThresholds[stat.id]}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* TOGGLES RÁPIDOS INFERIORES */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80 text-xs">
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer select-none text-slate-300 hover:text-white">
                  <input
                    type="checkbox"
                    checked={onlyCraftables}
                    onChange={(e) => {
                      setOnlyCraftables(e.target.checked);
                      setCurrentPage(1);
                    }}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900 cursor-pointer"
                  />
                  <span>Solo crafteables (con receta)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none text-slate-300 hover:text-white">
                  <input
                    type="checkbox"
                    checked={onlyWithMarketPrice}
                    onChange={(e) => {
                      setOnlyWithMarketPrice(e.target.checked);
                      setCurrentPage(1);
                    }}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900 cursor-pointer"
                  />
                  <span>Solo con precio en mercadillo</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none text-slate-300 hover:text-white">
                  <input
                    type="checkbox"
                    checked={onlyProfitable}
                    onChange={(e) => {
                      setOnlyProfitable(e.target.checked);
                      setCurrentPage(1);
                    }}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900 cursor-pointer"
                  />
                  <span>Solo con margen positivo (Ganancia &gt; 0)</span>
                </label>
              </div>

              {/* Selector de Nivel */}
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-medium">Nivel:</span>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={minLevel}
                  onChange={(e) => {
                    setMinLevel(e.target.value === '' ? '' : Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  placeholder="1"
                  className="w-14 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-center text-xs text-white font-bold focus:outline-none focus:border-amber-500"
                />
                <span className="text-slate-500">a</span>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={maxLevel}
                  onChange={(e) => {
                    setMaxLevel(e.target.value === '' ? '' : Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  placeholder="200"
                  className="w-14 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-center text-xs text-white font-bold focus:outline-none focus:border-amber-500"
                />
                <div className="flex items-center gap-1 ml-1">
                  <button
                    onClick={() => {
                      setMinLevel(200);
                      setMaxLevel(200);
                      setCurrentPage(1);
                    }}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-[11px] font-semibold text-slate-300"
                  >
                    200
                  </button>
                  <button
                    onClick={() => {
                      setMinLevel(150);
                      setMaxLevel(199);
                      setCurrentPage(1);
                    }}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-[11px] font-semibold text-slate-300"
                  >
                    150-199
                  </button>
                  <button
                    onClick={() => {
                      setMinLevel(1);
                      setMaxLevel(200);
                      setCurrentPage(1);
                    }}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-[11px] font-semibold text-slate-300"
                  >
                    Todos
                  </button>
                </div>
              </div>
            </div>

            {/* ── BARRA DE ESTADÍSTICAS ACTIVAS (INPUTS MANIPULABLES ESTILO DOFUSBOOK) ── */}
            {activeStatKeys.length > 0 && (
              <div className="pt-3 border-t border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5" />
                    Estadísticas activas (ajusta la cantidad mínima deseada):
                  </span>
                  <button
                    onClick={() => {
                      setActiveStatThresholds({});
                      setCurrentPage(1);
                    }}
                    className="text-xs text-rose-400 hover:text-rose-300 font-semibold transition-colors"
                  >
                    Limpiar todas las stats
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {activeStatKeys.map((statId) => {
                    const statDef = STAT_BY_ID_MAP.get(statId);
                    if (!statDef) return null;
                    const val = activeStatThresholds[statId];

                    return (
                      <div
                        key={statId}
                        className="flex items-center gap-1.5 bg-slate-950 border border-slate-700/90 rounded-lg pl-1.5 pr-2.5 py-1 text-xs shadow-inner group"
                      >
                        {/* Botón eliminar stat */}
                        <button
                          type="button"
                          onClick={() => handleToggleStat(statDef)}
                          className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-950/50 transition-colors"
                          title="Eliminar este filtro"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>

                        {/* Input de cantidad manipulable */}
                        <input
                          type="number"
                          min={0}
                          value={val}
                          onChange={(e) => handleThresholdChange(statId, e.target.value)}
                          className="w-16 bg-slate-900 border border-slate-700 focus:border-amber-500 rounded px-2 py-0.5 text-center text-white font-bold text-xs focus:outline-none"
                        />

                        {/* Nombre e icono de la stat */}
                        <div className="flex items-center gap-1.5 pl-1">
                          {renderStatIcon(statDef.iconType, statDef.color)}
                          <span className="font-bold text-slate-200">{statDef.name}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── BARRA DE BÚSQUEDA, PRECIOS EXTRAS Y ORDENACIÓN ── */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 md:p-5 shadow-lg space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Input de búsqueda por nombre */}
          <div className="md:col-span-5 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nombre (ej. Gelanillo, Velo de Tinta, Amuleto del Capitán...)"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-10 pr-9 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Toggle de Modo de visualización: Efectos vs Receta */}
          <div className="md:col-span-3 flex items-center justify-center md:justify-start gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setDisplayMode('effects')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                displayMode === 'effects'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>Mostrar efectos</span>
            </button>
            <button
              onClick={() => setDisplayMode('recipes')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                displayMode === 'recipes'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>Mostrar recetas</span>
            </button>
          </div>

          {/* Selector de Ordenación */}
          <div className="md:col-span-4 flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as EquipmentSortOption)}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2.5 text-xs text-white font-semibold focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="level_desc">Nivel descendente (200 → 1)</option>
              <option value="level_asc">Nivel ascendente (1 → 200)</option>
              <option value="price_asc">Precio Mercadillo: Más barato primero</option>
              <option value="price_desc">Precio Mercadillo: Más caro primero</option>
              <option value="craft_cost_asc">Costo Crafteo: Más barato de fabricar</option>
              <option value="profit_desc">Mayor Margen / Ganancia (Kamas)</option>
              <option value="roi_desc">Mayor Retorno de Inversión (ROI %)</option>
              {firstActiveStat && (
                <option value="stat_value_desc">
                  Mayor valor de {firstActiveStat.name}
                </option>
              )}
            </select>
          </div>
        </div>

        {/* Filtros Económicos Avanzados (Desplegables o inline) */}
        <div className="pt-3 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 text-xs">
          <div>
            <label className="block text-[11px] text-slate-400 mb-1 font-medium">Precio HDV Mín.</label>
            <input
              type="number"
              placeholder="0 K"
              value={minMarketPrice}
              onChange={(e) => {
                setMinMarketPrice(e.target.value === '' ? '' : Number(e.target.value));
                setCurrentPage(1);
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white font-medium focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1 font-medium">Precio HDV Máx.</label>
            <input
              type="number"
              placeholder="Sin límite"
              value={maxMarketPrice}
              onChange={(e) => {
                setMaxMarketPrice(e.target.value === '' ? '' : Number(e.target.value));
                setCurrentPage(1);
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white font-medium focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1 font-medium">Costo Crafteo Máx.</label>
            <input
              type="number"
              placeholder="Sin límite"
              value={maxCraftCost}
              onChange={(e) => {
                setMaxCraftCost(e.target.value === '' ? '' : Number(e.target.value));
                setCurrentPage(1);
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white font-medium focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1 font-medium">Ganancia Mínima</label>
            <input
              type="number"
              placeholder="≥ 0 K"
              value={minProfitKamas}
              onChange={(e) => {
                setMinProfitKamas(e.target.value === '' ? '' : Number(e.target.value));
                setCurrentPage(1);
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white font-medium focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setMinMarketPrice('');
                setMaxMarketPrice('');
                setMinCraftCost('');
                setMaxCraftCost('');
                setMinProfitKamas('');
                setCurrentPage(1);
              }}
              className="w-full py-1.5 px-3 bg-slate-800/60 hover:bg-slate-700/60 text-slate-400 hover:text-white rounded-lg font-medium transition-colors"
            >
              Borrar filtros precio
            </button>
          </div>
        </div>
      </div>

      {/* ── LISTADO DE RESULTADOS ── */}
      {sortedItems.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <HelpCircle className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-200">
              No se encontraron equipables con los filtros actuales
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Intenta reducir los umbrales de estadísticas mínimas, ampliar el rango de niveles o seleccionar más categorías de objetos.
            </p>
          </div>
          <button
            onClick={handleResetFilters}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-colors shadow-lg cursor-pointer"
          >
            Restablecer todos los filtros
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Encabezado de recuento y paginación superior */}
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span>
              Mostrando <strong className="text-white">{(currentPage - 1) * pageSize + 1}</strong> a{' '}
              <strong className="text-white">
                {Math.min(currentPage * pageSize, sortedItems.length)}
              </strong>{' '}
              de <strong className="text-amber-400">{sortedItems.length}</strong> equipables
            </span>

            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 cursor-pointer font-semibold"
                >
                  Anterior
                </button>
                <span className="px-2 font-bold text-slate-200">
                  {currentPage} / {totalPages}
                </span>
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 cursor-pointer font-semibold"
                >
                  Siguiente
                </button>
              </div>
            )}
          </div>

          {/* Rejilla de Tarjetas de Equipamiento */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {paginatedItems.map((entry) => {
              const { item, name, level, category, stats, marketPrice, craftCost, profit, roi, hasRecipe } = entry;
              const isEditingThisPrice = editingPriceItemId === item.id;

              return (
                <div
                  key={item.id}
                  className="bg-slate-900/90 hover:bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-4 flex flex-col justify-between transition-all duration-150 shadow-md group"
                >
                  {/* Bloque Superior: Icono, Nombre, Nivel y Categoría */}
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="relative shrink-0">
                        <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 p-1 flex items-center justify-center overflow-hidden shadow-inner group-hover:border-amber-500/50 transition-colors">
                          <SafeImage
                            src={getItemIconUrl(item.iconId)}
                            alt={name}
                            fallbackSrc={getItemFallbackIconUrl(item.id)}
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <span className="absolute -bottom-1.5 -right-1.5 bg-slate-950 text-amber-400 border border-slate-800 text-[10px] font-black px-1.5 py-0.2 rounded-md shadow">
                          Niv.{level}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[11px] font-bold text-slate-400 truncate">
                            {category?.name || getItemTypeName(item.typeId)}
                          </span>
                          {hasRecipe ? (
                            <span className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.2 rounded">
                              Crafteable
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded">
                              Sin receta
                            </span>
                          )}
                        </div>

                        <h4 className="font-bold text-slate-100 text-sm md:text-base leading-tight truncate group-hover:text-amber-400 transition-colors">
                          {name}
                        </h4>
                      </div>
                    </div>

                    {/* Contenido Central: Estadísticas O Receta según displayMode */}
                    {displayMode === 'effects' ? (
                      <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-2.5 max-h-[160px] overflow-y-auto custom-scrollbar space-y-1">
                        {stats.length === 0 ? (
                          <span className="text-xs text-slate-500 italic">Sin efectos registrados</span>
                        ) : (
                          stats.map((st, idx) => {
                            // Comprobar si esta stat coincide con alguno de los filtros activos
                            const matchingFilter = STAT_BY_RUNE_ID_MAP.get(st.rune.id);
                            const isHighlighted = matchingFilter && activeStatThresholds[matchingFilter.id] !== undefined;

                            return (
                              <div
                                key={idx}
                                className={`text-xs flex items-center justify-between px-2 py-0.5 rounded transition-all ${
                                  isHighlighted
                                    ? 'bg-amber-500/20 text-amber-200 font-bold border border-amber-500/40 shadow-sm'
                                    : 'text-slate-300'
                                }`}
                              >
                                <span className="truncate pr-2">
                                  {st.formattedText || st.rune.name}
                                </span>
                                {isHighlighted && (
                                  <span className="text-[10px] bg-amber-500 text-slate-950 font-black px-1 rounded shrink-0">
                                    ★ filtro
                                  </span>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    ) : (
                      /* Modo Receta */
                      <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-2.5 max-h-[160px] overflow-y-auto custom-scrollbar space-y-1.5">
                        {entry.recipe && entry.recipe.ingredientIds && entry.recipe.ingredientIds.length > 0 ? (
                          <div className="space-y-1">
                            <span className="text-[11px] font-bold text-slate-400 block mb-1">
                              Ingredientes necesarios ({entry.recipe.ingredientIds.length}):
                            </span>
                            {entry.recipe.ingredientIds.map((ingId, idx) => {
                              const qty = entry.recipe?.quantities?.[idx] || 1;
                              const unitPrice = marketPrices[ingId] || 0;
                              return (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between text-xs text-slate-300 py-0.5 border-b border-slate-900/60 last:border-none"
                                >
                                  <span className="truncate pr-2">
                                    <strong className="text-amber-400">{qty}x</strong> Objeto #{ingId}
                                  </span>
                                  <span className="text-slate-400 font-mono text-[11px] shrink-0">
                                    {unitPrice > 0 ? `${(unitPrice * qty).toLocaleString()} K` : '0 K'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-xs text-slate-500 italic py-2 text-center">
                            Este objeto no posee receta de artesanía conocida
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Bloque Inferior: Resumen Financiero & Acciones */}
                  <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-3">
                    {/* Panel Financiero (HDV vs Crafteo vs Margen) */}
                    <div className="grid grid-cols-3 gap-2 bg-slate-950/90 border border-slate-800/90 rounded-xl p-2 text-center">
                      {/* 1. Precio HDV */}
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-slate-400 block">Precio HDV</span>
                        {isEditingThisPrice ? (
                          <div className="flex items-center gap-1 justify-center">
                            <input
                              type="number"
                              value={editPriceInput}
                              onChange={(e) => setEditPriceInput(e.target.value)}
                              placeholder="Kamas"
                              className="w-16 bg-slate-900 border border-amber-500 rounded px-1 py-0.5 text-xs text-white font-bold"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSavePrice(item.id)}
                              className="text-emerald-400 hover:text-emerald-300 p-0.5"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingPriceItemId(null)}
                              className="text-rose-400 hover:text-rose-300 p-0.5"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1 group/price">
                            <span className="text-xs font-bold text-amber-400 font-mono">
                              {marketPrice > 0 ? (
                                <KamaDisplay amount={marketPrice} />
                              ) : (
                                <span className="text-slate-500">Sin precio</span>
                              )}
                            </span>
                            <button
                              onClick={() => {
                                setEditingPriceItemId(item.id);
                                setEditPriceInput(marketPrice > 0 ? String(marketPrice) : '');
                              }}
                              className="opacity-0 group-hover/price:opacity-100 text-slate-500 hover:text-amber-400 transition-opacity p-0.5 cursor-pointer"
                              title="Editar precio"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* 2. Costo Crafteo */}
                      <div className="space-y-0.5 border-x border-slate-800/80">
                        <span className="text-[10px] text-slate-400 block">Costo Crafteo</span>
                        <span className="text-xs font-bold text-slate-200 font-mono">
                          {craftCost > 0 ? (
                            <KamaDisplay amount={craftCost} />
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </span>
                      </div>

                      {/* 3. Margen / Rentabilidad */}
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-slate-400 block">Beneficio</span>
                        {marketPrice > 0 && craftCost > 0 ? (
                          profit > 0 ? (
                            <div className="text-emerald-400 font-bold text-xs font-mono">
                              +{profit.toLocaleString()}
                              <span className="text-[9px] block text-emerald-500 font-sans">
                                +{roi}% ROI
                              </span>
                            </div>
                          ) : (
                            <div className="text-rose-400 font-bold text-xs font-mono">
                              {profit.toLocaleString()}
                              <span className="text-[9px] block text-rose-500 font-sans">
                                Más barato HDV
                              </span>
                            </div>
                          )
                        ) : (
                          <span className="text-slate-500 text-xs">-</span>
                        )}
                      </div>
                    </div>

                    {/* Botones de acción rápida */}
                    <div className="flex items-center gap-1.5">
                      {hasRecipe && onSelectRecipeForCalculator && (
                        <button
                          onClick={() => onSelectRecipeForCalculator(item)}
                          className="flex-1 px-2.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                          title="Abrir en Calculadora de Recetas y Desglose"
                        >
                          <Wrench className="w-3.5 h-3.5" />
                          <span>Ver Crafteo</span>
                        </button>
                      )}

                      {onSelectForCrushing && (
                        <button
                          onClick={() => onSelectForCrushing(item)}
                          className="px-2.5 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                          title="Simular Machacado en la Rompedora"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Rompedora</span>
                        </button>
                      )}

                      {hasRecipe && (
                        <button
                          onClick={() => handleAddToShopping(item)}
                          className="p-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-lg text-xs transition-colors cursor-pointer"
                          title="Añadir ingredientes a Lista de Compras"
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <a
                        href={`https://dofusdb.fr/es/database/object/${item.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 rounded-lg text-xs transition-colors"
                        title="Ver ficha oficial en DofusDB"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Paginación inferior */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                disabled={currentPage <= 1}
                onClick={() => {
                  setCurrentPage((p) => Math.max(1, p - 1));
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 cursor-pointer"
              >
                ← Página Anterior
              </button>
              <span className="text-xs font-bold text-slate-300 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl">
                Página {currentPage} de {totalPages}
              </span>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => {
                  setCurrentPage((p) => Math.min(totalPages, p + 1));
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 cursor-pointer"
              >
                Página Siguiente →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
