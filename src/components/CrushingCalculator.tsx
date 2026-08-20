import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Zap,
  Search,
  Coins,
  Sparkles,
  Trophy,
  RotateCcw,
  Check,
  Tag,
  Shield,
  Sword,
  Wand2,
  Gem,
  Footprints,
  Scissors,
  Crosshair,
  Save,
  Percent,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  Sliders,
  Layers,
  Store,
  Calendar,
  Clock,
  Filter,
  ArrowUpDown,
  CheckCircle2,
  ExternalLink,
  Flame,
  Droplet,
  Wind,
  Mountain,
  CircleDot,
  TrendingUp,
  Crown,
  Disc,
  Eye,
  Target,
  Heart,
  Moon,
} from 'lucide-react';
import { DofusItem, MarketPriceMap } from '../types';
import {
  CRUSHING_ALLOWED_JOBS,
} from '../data/dofusJobs';
import {
  BASE_RUNES_BY_ID,
  BaseRuneDefinition,
  calculateItemCrushing,
  CrushingResult,
  DOFUS_BASE_RUNES,
  getSavedItemCoefficient,
  getItemCoefficientTimestamp,
  saveItemCoefficient,
  getAllSavedItemCoefficients,
  getAllSavedItemCoefficientTimestamps,
  TopFocusOption,
} from '../data/dofusRuneWeights';
import {
  CraftableItem,
  getCrushableItemsSnapshot,
  getItemFallbackIconUrl,
  getItemIconUrl,
  getItemName,
  getItemTypeName,
  getStoredMarketPrices,
  getStoredPriceUpdatedAt,
  getStoredRecipes,
  getLowestDetectedPrice,
  fetchRecipeByResultId,
  fetchItemDetailsById,
  getImportedItems,
  initializeDatabase,
  saveMarketPrice,
} from '../services/dofusDbService';
import { SafeImage } from './SafeImage';
import { RuneIcon } from './RuneIcon';

interface CrushingCalculatorProps {
  initialSelectedItem?: DofusItem | null;
  onSelectRecipeForCalculator?: (item: DofusItem) => void;
}

type CrushingViewMode = 'catalog' | 'detail' | 'rune_prices';

type DateFilterOption =
  | 'all'
  | 'custom_only'
  | 'today'
  | '3days'
  | 'week'
  | 'month'
  | 'default_only';

type SortOption =
  | 'profit_desc'
  | 'coeff_desc'
  | 'rune_profit_desc'
  | 'roi_desc'
  | 'breakeven_asc'
  | 'cost_asc'
  | 'level_desc'
  | 'date_desc';

const JOB_ICONS_MAP: Record<number, React.ComponentType<{ className?: string }>> = {
  27: Scissors, // Sastre
  16: Gem, // Joyero
  15: Footprints, // Zapatero
  60: Shield, // Fabricante
  11: Sword, // Herrero
  13: Wand2, // Escultor
};

function formatTimeAgo(ts: number | null | undefined): string {
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

function formatFullDate(ts: number | null | undefined): string {
  if (!ts) return 'No registrado aún (100% por defecto)';
  const d = new Date(ts);
  return `${d.toLocaleDateString()} a las ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export const CrushingCalculator: React.FC<CrushingCalculatorProps> = ({
  initialSelectedItem,
  onSelectRecipeForCalculator,
}) => {
  // Navigation View Mode: 'catalog' (Listado) vs 'detail' (Simulador Detallado) vs 'rune_prices' (HDV Runas)
  const [viewMode, setViewMode] = useState<CrushingViewMode>('catalog');
  
  // Database & Cache state
  const [marketPrices, setMarketPrices] = useState<MarketPriceMap>({});
  const [priceUpdatedAt, setPriceUpdatedAt] = useState<Record<number, number>>({});
  const [crushableItems, setCrushableItems] = useState<CraftableItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<CraftableItem | null>(null);
  const [savedCoefficients, setSavedCoefficients] = useState<Record<number, number>>({});
  const [savedTimestamps, setSavedTimestamps] = useState<Record<number, number>>({});

  // =========================================================================
  // CATALOG ADVANCED FILTERS & STATE (Matching Kamaskope & Dofus 3.0 Standard)
  // =========================================================================
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [slotFilter, setSlotFilter] = useState<string>('all');
  const [minLevel, setMinLevel] = useState<number | ''>('');
  const [maxLevel, setMaxLevel] = useState<number | ''>('');
  const [minCoeff, setMinCoeff] = useState<number | ''>('');
  const [maxCoeff, setMaxCoeff] = useState<number | ''>('');
  const [activeStatFilterId, setActiveStatFilterId] = useState<string | null>(null);
  const [selectedRuneId, setSelectedRuneId] = useState<number | 'all'>('all');
  const [selectedTextFilter, setSelectedTextFilter] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilterOption>('all');
  const [sortBy, setSortBy] = useState<SortOption>('profit_desc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const PAGE_SIZE = 24;

  // =========================================================================
  // DETAIL SIMULATOR STATE
  // =========================================================================
  const [coefficientPercent, setCoefficientPercent] = useState<number>(100);
  const [customStatValues, setCustomStatValues] = useState<Record<number, number>>({});
  const [focusedRuneId, setFocusedRuneId] = useState<number | null>(null);
  const [savedCoeffFeedback, setSavedCoeffFeedback] = useState<boolean>(false);
  const [detailSearchQuery, setDetailSearchQuery] = useState<string>('');
  const [isDetailSearchOpen, setIsDetailSearchOpen] = useState<boolean>(false);
  const detailSearchContainerRef = useRef<HTMLDivElement>(null);

  // Recipe ingredients state for detail view
  interface RecipeIngredientDetail {
    id: number;
    name: string;
    iconId: number;
    quantity: number;
    unitPrice: number;
    totalCost: number;
  }
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredientDetail[]>([]);
  const [ingredientDrafts, setIngredientDrafts] = useState<Record<number, string>>({});
  const [itemHdvPriceDraft, setItemHdvPriceDraft] = useState<string>('');
  const [savedIngFeedback, setSavedIngFeedback] = useState<number | null>(null);
  const [savedHdvFeedback, setSavedHdvFeedback] = useState<boolean>(false);

  // Inline rune price drafts
  const [runePriceDrafts, setRunePriceDrafts] = useState<Record<number, string>>({});
  const [savedRuneIdFeedback, setSavedRuneIdFeedback] = useState<number | null>(null);

  // HDV Runas Sub-Tab State
  const [runeCategoryFilter, setRuneCategoryFilter] = useState<
    'all' | 'especial' | 'primaria' | 'dano' | 'resistencia' | 'secundaria'
  >('all');
  const [runeSearchTerm, setRuneSearchTerm] = useState<string>('');

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        detailSearchContainerRef.current &&
        !detailSearchContainerRef.current.contains(e.target as Node)
      ) {
        setIsDetailSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Hydrate local database state
  const hydrate = () => {
    const storedPrices = getStoredMarketPrices();
    setMarketPrices(storedPrices);
    setPriceUpdatedAt(getStoredPriceUpdatedAt());
    const snapshot = getCrushableItemsSnapshot();
    setCrushableItems(snapshot);
    setSavedCoefficients(getAllSavedItemCoefficients());
    setSavedTimestamps(getAllSavedItemCoefficientTimestamps());

    // Initialize rune price drafts
    const initialRuneDrafts: Record<number, string> = {};
    for (const rune of DOFUS_BASE_RUNES) {
      const p = storedPrices[rune.id] ?? rune.defaultPrice;
      initialRuneDrafts[rune.id] = String(p);
    }
    setRunePriceDrafts(initialRuneDrafts);
  };

  useEffect(() => {
    initializeDatabase()
      .then(() => hydrate())
      .catch((e) => console.error('Error inicializando base en CrushingCalculator:', e));

    const handleDbUpdate = () => hydrate();
    const handleCoeffUpdate = () => {
      setSavedCoefficients(getAllSavedItemCoefficients());
      setSavedTimestamps(getAllSavedItemCoefficientTimestamps());
    };

    window.addEventListener('dofus_database_updated', handleDbUpdate);
    window.addEventListener('dofus_coefficients_updated', handleCoeffUpdate);
    return () => {
      window.removeEventListener('dofus_database_updated', handleDbUpdate);
      window.removeEventListener('dofus_coefficients_updated', handleCoeffUpdate);
    };
  }, []);

  // Handle external navigation with initialSelectedItem
  useEffect(() => {
    if (initialSelectedItem && crushableItems.length > 0) {
      const found = crushableItems.find((i) => i.id === initialSelectedItem.id);
      if (found) {
        setSelectedItem(found);
        setViewMode('detail');
      }
    }
  }, [initialSelectedItem, crushableItems]);

  // Load saved coefficient when selectedItem changes
  useEffect(() => {
    if (selectedItem) {
      const saved = getSavedItemCoefficient(selectedItem.id);
      setCoefficientPercent(saved || 100);
      setFocusedRuneId(null);
      setCustomStatValues({});
    }
  }, [selectedItem?.id]);

  // Compute craft cost for an item using lowest detected ingredient prices
  const getItemCraftCost = (item: CraftableItem): number => {
    if (!item.recipeData || !item.recipeData.ingredientIds || item.recipeData.ingredientIds.length === 0) {
      return marketPrices[item.id] || item.defaultMarketSalePrice || 0;
    }
    let total = 0;
    const { ingredientIds, quantities } = item.recipeData;
    const recipesMap = getStoredRecipes();
    for (let i = 0; i < ingredientIds.length; i += 1) {
      const ingId = ingredientIds[i];
      const qty = quantities?.[i] || 1;
      const ingPrice = getLowestDetectedPrice(ingId, marketPrices, recipesMap);
      total += ingPrice * qty;
    }
    return total;
  };

  // Resolve recipe ingredients and HDV price draft for detail view
  useEffect(() => {
    if (!selectedItem) {
      setRecipeIngredients([]);
      return;
    }

    const currentHdvPrice = marketPrices[selectedItem.id] ?? selectedItem.defaultMarketSalePrice ?? 0;
    setItemHdvPriceDraft(String(currentHdvPrice));

    const loadIngredients = async () => {
      let recipe = selectedItem.recipeData;
      if (!recipe || !recipe.ingredientIds || recipe.ingredientIds.length === 0) {
        recipe = (await fetchRecipeByResultId(selectedItem.id)) || undefined;
      }

      if (!recipe || !recipe.ingredientIds || recipe.ingredientIds.length === 0) {
        setRecipeIngredients([]);
        return;
      }

      const recipesMap = getStoredRecipes();
      const importedList = getImportedItems();
      const importedMap = new Map<number, DofusItem>();
      importedList.forEach((i) => importedMap.set(i.id, i));

      const ingDetails: RecipeIngredientDetail[] = [];
      const drafts: Record<number, string> = {};

      for (let i = 0; i < recipe.ingredientIds.length; i++) {
        const ingId = recipe.ingredientIds[i];
        const qty = recipe.quantities?.[i] || 1;
        let ingItem = importedMap.get(ingId);
        if (!ingItem) {
          ingItem = (await fetchItemDetailsById(ingId)) || undefined;
        }

        const unitPrice = getLowestDetectedPrice(ingId, marketPrices, recipesMap);
        drafts[ingId] = String(marketPrices[ingId] ?? unitPrice);

        ingDetails.push({
          id: ingId,
          name: ingItem ? getItemName(ingItem) : `Ingrediente #${ingId}`,
          iconId: ingItem?.iconId || (ingItem as any)?.icon_id || ingId,
          quantity: qty,
          unitPrice,
          totalCost: unitPrice * qty,
        });
      }

      setRecipeIngredients(ingDetails);
      setIngredientDrafts((prev) => ({ ...drafts, ...prev }));
    };

    void loadIngredients();
  }, [selectedItem?.id, marketPrices]);

  // Run calculation for current selected item in Detail view
  const crushingSimulation = useMemo<CrushingResult | null>(() => {
    if (!selectedItem) return null;
    const singleCraftCost = getItemCraftCost(selectedItem);
    return calculateItemCrushing(
      selectedItem,
      coefficientPercent,
      focusedRuneId,
      marketPrices,
      singleCraftCost,
      'avg',
      customStatValues,
    );
  }, [
    selectedItem,
    coefficientPercent,
    focusedRuneId,
    marketPrices,
    customStatValues,
  ]);

  // Quick reset buttons to set all stats to Min, Avg, or Max
  const handleResetStatsToPreset = (mode: 'min' | 'avg' | 'max') => {
    if (!crushingSimulation) return;
    const newValues: Record<number, number> = {};
    for (const st of crushingSimulation.statYields) {
      if (mode === 'min') {
        newValues[st.rune.id] = st.statMin;
      } else if (mode === 'max') {
        newValues[st.rune.id] = st.statMax;
      } else {
        newValues[st.rune.id] = Math.ceil((st.statMin + st.statMax) / 2);
      }
    }
    setCustomStatValues(newValues);
  };

  // Handle individual stat value change in detail view
  const handleStatChange = (runeId: number, value: string) => {
    const numeric = Math.max(0, Number(value) || 0);
    setCustomStatValues((prev) => ({
      ...prev,
      [runeId]: numeric,
    }));
  };

  // Handle saving coefficient for current item
  const handleSaveItemCoefficient = () => {
    if (!selectedItem) return;
    saveItemCoefficient(selectedItem.id, coefficientPercent);
    setSavedCoefficients(getAllSavedItemCoefficients());
    setSavedTimestamps(getAllSavedItemCoefficientTimestamps());
    setSavedCoeffFeedback(true);
    setTimeout(() => setSavedCoeffFeedback(false), 2000);
  };

  // Handle updating ingredient price inline
  const handleUpdateIngredientPrice = async (ingId: number, rawValue: string) => {
    const numeric = Math.max(0, Math.trunc(Number(rawValue) || 0));
    setIngredientDrafts((prev) => ({ ...prev, [ingId]: String(numeric) }));
    await saveMarketPrice(ingId, numeric);
    setSavedIngFeedback(ingId);
    setTimeout(() => setSavedIngFeedback(null), 1500);
  };

  // Handle updating finished item HDV sale price inline
  const handleUpdateItemHdvPrice = async (rawValue: string) => {
    if (!selectedItem) return;
    const numeric = Math.max(0, Math.trunc(Number(rawValue) || 0));
    setItemHdvPriceDraft(String(numeric));
    await saveMarketPrice(selectedItem.id, numeric);
    setSavedHdvFeedback(true);
    setTimeout(() => setSavedHdvFeedback(false), 1500);
  };

  // Handle updating rune price from detail or rune manager
  const handleUpdateRunePrice = async (runeId: number, rawValue: string) => {
    const numeric = Math.max(0, Math.trunc(Number(rawValue) || 0));
    setRunePriceDrafts((prev) => ({ ...prev, [runeId]: String(numeric) }));
    await saveMarketPrice(runeId, numeric);
    setSavedRuneIdFeedback(runeId);
    setTimeout(() => setSavedRuneIdFeedback(null), 1500);
  };

  // Transition to detail view with selected item
  // Transition to detail view with selected item
  const handleOpenDetail = (item: CraftableItem) => {
    setSelectedItem(item);
    setViewMode('detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // =========================================================================
  // ADVANCED FILTER DEFINITIONS (Dofus 3.0 & Kamaskope Standard)
  // =========================================================================
  const EQUIPMENT_SLOTS = useMemo(() => [
    { id: 'all', label: 'Todos', typeIds: [], icon: Layers },
    { id: 'sombrero', label: 'Sombrero', typeIds: [16], icon: Crown },
    { id: 'capa', label: 'Capa', typeIds: [17, 81], icon: Shield },
    { id: 'amuleto', label: 'Amuleto', typeIds: [1], icon: CircleDot },
    { id: 'anillo', label: 'Anillo', typeIds: [9], icon: Disc },
    { id: 'cinturon', label: 'Cinturón', typeIds: [10], icon: Sliders },
    { id: 'botas', label: 'Botas', typeIds: [11], icon: Footprints },
    { id: 'arma', label: 'Arma', typeIds: [2, 3, 4, 5, 6, 7, 8, 19, 21, 22, 212], icon: Sword },
    { id: 'escudo', label: 'Escudo', typeIds: [82], icon: Shield },
    { id: 'trofeo', label: 'Trofeo', typeIds: [151, 271], icon: Trophy },
    { id: 'mascota', label: 'Mascota', typeIds: [18, 121], icon: Sparkles },
  ], []);

  interface StatFilterDef {
    id: string;
    runeId?: number;
    textKey?: string;
    name: string;
    color: string;
    glyphType: string;
  }

  const STAT_FILTERS_DAMAGES: StatFilterDef[] = useMemo(() => [
    { id: 'da_tierra', runeId: 11657, name: 'Tierra (fijos)', color: '#b45309', glyphType: 'plant' },
    { id: 'da_fuego', runeId: 11659, name: 'Fuego (fijos)', color: '#ef4444', glyphType: 'fire' },
    { id: 'da_agua', runeId: 11661, name: 'Agua (fijos)', color: '#0ea5e9', glyphType: 'water' },
    { id: 'da_aire', runeId: 11663, name: 'Aire (fijos)', color: '#14b8a6', glyphType: 'air' },
    { id: 'da_neutro', runeId: 11665, name: 'Neutrales (fijos)', color: '#94a3b8', glyphType: 'neutral' },
    { id: 'da_cri', runeId: 11653, name: 'Críticos', color: '#ec4899', glyphType: 'crit' },
    { id: 'da_gen', runeId: 7435, name: 'Daños', color: '#d946ef', glyphType: 'zap' },
    { id: 'da_emp', runeId: 11649, name: 'Empuje', color: '#f97316', glyphType: 'arrow' },
    { id: 'da_trampas', textKey: 'trampa', name: 'Trampas', color: '#b45309', glyphType: 'trap' },
    { id: 'da_pot_trampas', textKey: 'pot_trampa', name: 'Potencia de Trampas', color: '#eab308', glyphType: 'zap' },
    { id: 'da_hech', runeId: 18722, name: 'Hechizos (%)', color: '#eab308', glyphType: 'star' },
    { id: 'da_arm', runeId: 18721, name: 'Arma (%)', color: '#d97706', glyphType: 'sword' },
    { id: 'da_dis', runeId: 18720, name: 'Distancia (%)', color: '#06b6d4', glyphType: 'target' },
    { id: 'da_cac', runeId: 18719, name: 'Cuerpo a Cuerpo (%)', color: '#ef4444', glyphType: 'fist' },
  ], []);

  const STAT_FILTERS_RESISTANCES: StatFilterDef[] = useMemo(() => [
    { id: 'res_p_tie', runeId: 7459, name: 'Tierra (%)', color: '#b45309', glyphType: 'plant' },
    { id: 'res_tie', runeId: 7455, name: 'Tierra (fija)', color: '#92400e', glyphType: 'plant' },
    { id: 'res_p_fue', runeId: 7457, name: 'Fuego (%)', color: '#ef4444', glyphType: 'fire' },
    { id: 'res_fue', runeId: 7452, name: 'Fuego (fija)', color: '#dc2626', glyphType: 'fire' },
    { id: 'res_p_agu', runeId: 7560, name: 'Agua (%)', color: '#0ea5e9', glyphType: 'water' },
    { id: 'res_agu', runeId: 7454, name: 'Agua (fija)', color: '#0284c7', glyphType: 'water' },
    { id: 'res_p_air', runeId: 7458, name: 'Aire (%)', color: '#14b8a6', glyphType: 'air' },
    { id: 'res_air', runeId: 7453, name: 'Aire (fija)', color: '#0d9488', glyphType: 'air' },
    { id: 'res_p_neu', runeId: 7460, name: 'Neutral (%)', color: '#94a3b8', glyphType: 'neutral' },
    { id: 'res_neu', runeId: 7456, name: 'Neutral (fija)', color: '#64748b', glyphType: 'neutral' },
    { id: 'res_cri', runeId: 11655, name: 'Crítica (fija)', color: '#ec4899', glyphType: 'crit' },
    { id: 'res_emp', runeId: 11651, name: 'Empuje (fija)', color: '#f97316', glyphType: 'arrow' },
    { id: 'res_p_dis', runeId: 18724, name: 'Distancia (%)', color: '#06b6d4', glyphType: 'target' },
    { id: 'res_p_cac', runeId: 18723, name: 'Cuerpo a Cuerpo (%)', color: '#ef4444', glyphType: 'fist' },
  ], []);

  const STAT_FILTERS_CHARACTERISTICS: StatFilterDef[] = useMemo(() => [
    { id: 'pa', runeId: 1557, name: 'PA', color: '#38bdf8', glyphType: 'star' },
    { id: 'fo', runeId: 1519, name: 'Fuerza', color: '#b45309', glyphType: 'plant' },
    { id: 'caza', runeId: 10057, name: 'Caza', color: '#ef4444', glyphType: 'caza' },
    { id: 'pm', runeId: 1558, name: 'PM', color: '#10b981', glyphType: 'pm' },
    { id: 'inte', runeId: 1522, name: 'Inteligencia', color: '#f97316', glyphType: 'fire' },
    { id: 'fui', runeId: 11637, name: 'Huida', color: '#f59e0b', glyphType: 'dodge' },
    { id: 'al', runeId: 7438, name: 'Alcance', color: '#2dd4bf', glyphType: 'eye' },
    { id: 'sue', runeId: 1525, name: 'Suerte', color: '#0ea5e9', glyphType: 'water' },
    { id: 'pla', runeId: 11639, name: 'Placaje', color: '#84cc16', glyphType: 'lock' },
    { id: 'invo', runeId: 7442, name: 'Invocaciones', color: '#eab308', glyphType: 'invo' },
    { id: 'agi', runeId: 1524, name: 'Agilidad', color: '#10b981', glyphType: 'air' },
    { id: 'esq_pa', runeId: 11641, name: 'Esquiva PA', color: '#0284c7', glyphType: 'shield' },
    { id: 'cri', runeId: 7433, name: 'Críticos (%)', color: '#ef4444', glyphType: 'crit' },
    { id: 'sa', runeId: 1521, name: 'Sabiduría', color: '#a855f7', glyphType: 'moon' },
    { id: 'esq_pm', runeId: 11643, name: 'Esquiva PM', color: '#059669', glyphType: 'shield' },
    { id: 'pot', runeId: 7436, name: 'Potencia', color: '#eab308', glyphType: 'zap' },
    { id: 'vi', runeId: 1523, name: 'Vitalidad', color: '#f43f5e', glyphType: 'heart' },
    { id: 'ret_pa', runeId: 11645, name: 'Retirada de PA', color: '#0284c7', glyphType: 'star' },
    { id: 'pod', runeId: 7443, name: 'Pods', color: '#ca8a04', glyphType: 'pod' },
    { id: 'ini', runeId: 7448, name: 'Iniciativa', color: '#d946ef', glyphType: 'ini' },
    { id: 'ret_pm', runeId: 11647, name: 'Retirada de PM', color: '#059669', glyphType: 'pm' },
    { id: 'cu', runeId: 7434, name: 'Curación', color: '#ef4444', glyphType: 'heal' },
    { id: 'prosp', runeId: 7451, name: 'Prospección', color: '#06b6d4', glyphType: 'search' },
    { id: 'reenvio', textKey: 'reenvio', name: 'Reenvío de Daños', color: '#c084fc', glyphType: 'return' },
  ], []);

  // Helper to render miniature glyph icon for stats
  const renderStatGlyph = (type: string, color: string) => {
    switch (type) {
      case 'plant':
        return (
          <span className="w-3.5 h-3.5 inline-flex items-center justify-center shrink-0 font-black text-xs" style={{ color }}>
            🌱
          </span>
        );
      case 'fire':
        return (
          <Flame className="w-3.5 h-3.5 shrink-0" style={{ color }} />
        );
      case 'water':
        return (
          <Droplet className="w-3.5 h-3.5 shrink-0" style={{ color }} />
        );
      case 'air':
        return (
          <Wind className="w-3.5 h-3.5 shrink-0" style={{ color }} />
        );
      case 'neutral':
        return (
          <CircleDot className="w-3.5 h-3.5 shrink-0" style={{ color }} />
        );
      case 'crit':
        return (
          <span className="w-3.5 h-3.5 inline-flex items-center justify-center shrink-0 font-black text-xs" style={{ color }}>
            💥
          </span>
        );
      case 'zap':
        return (
          <Zap className="w-3.5 h-3.5 shrink-0" style={{ color }} />
        );
      case 'arrow':
        return (
          <ArrowRight className="w-3.5 h-3.5 shrink-0" style={{ color }} />
        );
      case 'star':
        return (
          <span className="w-3.5 h-3.5 inline-flex items-center justify-center shrink-0 font-black text-xs" style={{ color }}>
            ★
          </span>
        );
      case 'sword':
        return (
          <Sword className="w-3.5 h-3.5 shrink-0" style={{ color }} />
        );
      case 'target':
        return (
          <Target className="w-3.5 h-3.5 shrink-0" style={{ color }} />
        );
      case 'fist':
        return (
          <span className="w-3.5 h-3.5 inline-flex items-center justify-center shrink-0 font-black text-xs" style={{ color }}>
            👊
          </span>
        );
      case 'pm':
        return (
          <Footprints className="w-3.5 h-3.5 shrink-0" style={{ color }} />
        );
      case 'eye':
        return (
          <Eye className="w-3.5 h-3.5 shrink-0" style={{ color }} />
        );
      case 'invo':
        return (
          <span className="w-3.5 h-3.5 inline-flex items-center justify-center shrink-0 font-black text-xs" style={{ color }}>
            👹
          </span>
        );
      case 'caza':
        return (
          <span className="w-3.5 h-3.5 inline-flex items-center justify-center shrink-0 font-black text-xs" style={{ color }}>
            🗡️
          </span>
        );
      case 'moon':
        return (
          <Moon className="w-3.5 h-3.5 shrink-0" style={{ color }} />
        );
      case 'heart':
        return (
          <Heart className="w-3.5 h-3.5 shrink-0" style={{ color }} />
        );
      case 'shield':
        return (
          <Shield className="w-3.5 h-3.5 shrink-0" style={{ color }} />
        );
      case 'lock':
        return (
          <span className="w-3.5 h-3.5 inline-flex items-center justify-center shrink-0 font-black text-xs" style={{ color }}>
            🔒
          </span>
        );
      case 'dodge':
        return (
          <span className="w-3.5 h-3.5 inline-flex items-center justify-center shrink-0 font-black text-xs" style={{ color }}>
            💨
          </span>
        );
      case 'heal':
        return (
          <span className="w-3.5 h-3.5 inline-flex items-center justify-center shrink-0 font-black text-xs font-mono" style={{ color }}>
            ➕
          </span>
        );
      case 'search':
        return (
          <Search className="w-3.5 h-3.5 shrink-0" style={{ color }} />
        );
      case 'pod':
        return (
          <span className="w-3.5 h-3.5 inline-flex items-center justify-center shrink-0 font-black text-xs" style={{ color }}>
            🎒
          </span>
        );
      case 'ini':
        return (
          <Sparkles className="w-3.5 h-3.5 shrink-0" style={{ color }} />
        );
      case 'return':
        return (
          <RotateCcw className="w-3.5 h-3.5 shrink-0" style={{ color }} />
        );
      default:
        return (
          <CircleDot className="w-3.5 h-3.5 shrink-0" style={{ color }} />
        );
    }
  };

  // Toggle or select stat filter
  const handleToggleStatFilter = (statDef: StatFilterDef) => {
    if (activeStatFilterId === statDef.id) {
      // Deactivate
      setActiveStatFilterId(null);
      setSelectedRuneId('all');
      setSelectedTextFilter(null);
    } else {
      // Activate
      setActiveStatFilterId(statDef.id);
      if (statDef.runeId) {
        setSelectedRuneId(statDef.runeId);
        setSelectedTextFilter(null);
        setSortBy('rune_profit_desc');
      } else if (statDef.textKey) {
        setSelectedRuneId('all');
        setSelectedTextFilter(statDef.textKey);
      }
    }
  };

  // Clear all filters
  const handleClearAllFilters = () => {
    setSearchQuery('');
    setSlotFilter('all');
    setMinLevel('');
    setMaxLevel('');
    setMinCoeff('');
    setMaxCoeff('');
    setActiveStatFilterId(null);
    setSelectedRuneId('all');
    setSelectedTextFilter(null);
    setDateFilter('all');
    setSortBy('profit_desc');
  };

  // Compute metrics and filter/sort the entire catalog
  const processedCatalogItems = useMemo(() => {
    const now = Date.now();
    const isTargetRuneFiltered = selectedRuneId !== 'all';
    const targetRuneIdNum = typeof selectedRuneId === 'number' ? selectedRuneId : null;

    // 1. Process simulations for each crushable item
    const results = crushableItems.map((item) => {
      const singleCraftCost = getItemCraftCost(item);
      const savedCoeff = savedCoefficients[item.id] ?? 100;
      const coeffTimestamp = savedTimestamps[item.id] ?? null;

      const sim = calculateItemCrushing(
        item,
        savedCoeff,
        null,
        marketPrices,
        singleCraftCost,
        'avg',
        {},
      );

      // Check if item generates the specifically selected rune (if any)
      const targetRuneYield = targetRuneIdNum
        ? sim.statYields.find((st) => st.rune.id === targetRuneIdNum) || null
        : null;

      let runeSpecificProfit = 0;
      let runeSpecificRunes = 0;
      let runeSpecificKamas = 0;
      if (targetRuneYield) {
        runeSpecificRunes = targetRuneYield.focusRunesPerItem;
        runeSpecificKamas = targetRuneYield.focusKamasValue;
        runeSpecificProfit = runeSpecificKamas - singleCraftCost;
      }

      // Best focus calculation
      const bestFocus = sim.bestFocusOption;
      const bestFocusProfit = bestFocus ? bestFocus.netProfit : sim.normalNetProfit;
      const bestFocusValue = bestFocus ? bestFocus.totalKamasValue : sim.normalTotalKamasValue;
      const bestFocusRoi = bestFocus ? bestFocus.roiPercent : sim.normalRoiPercent;
      const bestFocusRune = bestFocus ? bestFocus.rune : null;

      // Effective general profit (highest between normal and best focus)
      const maxProfit = Math.max(sim.normalNetProfit, bestFocusProfit);
      const maxKamasValue = Math.max(sim.normalTotalKamasValue, bestFocusValue);
      const maxRoi = Math.max(sim.normalRoiPercent, bestFocusRoi);

      return {
        item,
        level: item.level || 1,
        typeId: item.typeId || item.type?.id || 0,
        jobId: item.jobId,
        jobNameEs: item.jobNameEs,
        singleCraftCost,
        savedCoeff,
        coeffTimestamp,
        hasCustomCoeff: savedCoefficients[item.id] !== undefined,
        sim,
        normalProfit: sim.normalNetProfit,
        normalValue: sim.normalTotalKamasValue,
        normalRoi: sim.normalRoiPercent,
        bestFocusProfit,
        bestFocusValue,
        bestFocusRoi,
        bestFocusRune,
        maxProfit,
        maxKamasValue,
        maxRoi,
        breakEvenCoeff: sim.breakEvenCoefficient,
        targetRuneYield,
        runeSpecificProfit,
        runeSpecificRunes,
        runeSpecificKamas,
        hasTargetRune: !!targetRuneYield,
      };
    });

    // 2. Filter items
    const filtered = results.filter((entry) => {
      // Search query
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase().trim();
        const name = getItemName(entry.item).toLowerCase();
        const type = getItemTypeName(entry.item).toLowerCase();
        if (!name.includes(q) && !type.includes(q) && !String(entry.item.id).includes(q)) {
          return false;
        }
      }

      // Equipment Slot filter
      if (slotFilter !== 'all') {
        const slotDef = EQUIPMENT_SLOTS.find((s) => s.id === slotFilter);
        if (slotDef && slotDef.typeIds.length > 0) {
          if (!slotDef.typeIds.includes(entry.typeId)) {
            return false;
          }
        }
      }

      // Level filter (Manual numeric inputs)
      if (typeof minLevel === 'number' && entry.level < minLevel) return false;
      if (typeof maxLevel === 'number' && entry.level > maxLevel) return false;

      // Coefficient % filter (Manual numeric inputs)
      if (typeof minCoeff === 'number' && entry.savedCoeff < minCoeff) return false;
      if (typeof maxCoeff === 'number' && entry.savedCoeff > maxCoeff) return false;

      // Specific Rune filter
      if (isTargetRuneFiltered && !entry.hasTargetRune) {
        return false;
      }

      // Specific Text Filter (Trampas, Potencia de Trampas, Reenvío...)
      if (selectedTextFilter) {
        const effs = entry.item.possibleEffects || entry.item.effects || [];
        const matches = effs.some((eff) => {
          const formatted = (eff.formatted || eff.characteristicName || '').toLowerCase();
          if (selectedTextFilter === 'trampa') return formatted.includes('trampa');
          if (selectedTextFilter === 'pot_trampa') return formatted.includes('trampa') && (formatted.includes('potencia') || formatted.includes('%'));
          if (selectedTextFilter === 'reenvio') return formatted.includes('reenvío') || formatted.includes('reenvio') || formatted.includes('renvoi');
          return false;
        });
        if (!matches) return false;
      }

      // Date of Coefficient filter
      if (dateFilter === 'custom_only' && !entry.hasCustomCoeff) return false;
      if (dateFilter === 'default_only' && entry.hasCustomCoeff) return false;
      if (dateFilter === 'today') {
        if (!entry.coeffTimestamp || now - entry.coeffTimestamp > 24 * 60 * 60 * 1000) return false;
      }
      if (dateFilter === '3days') {
        if (!entry.coeffTimestamp || now - entry.coeffTimestamp > 3 * 24 * 60 * 60 * 1000) return false;
      }
      if (dateFilter === 'week') {
        if (!entry.coeffTimestamp || now - entry.coeffTimestamp > 7 * 24 * 60 * 60 * 1000) return false;
      }
      if (dateFilter === 'month') {
        if (!entry.coeffTimestamp || now - entry.coeffTimestamp > 30 * 24 * 60 * 60 * 1000) return false;
      }

      return true;
    });

    // 3. Sort items
    return filtered.sort((a, b) => {
      if (sortBy === 'profit_desc') {
        if (isTargetRuneFiltered) return b.runeSpecificProfit - a.runeSpecificProfit;
        return b.maxProfit - a.maxProfit;
      }
      if (sortBy === 'coeff_desc') {
        return b.savedCoeff - a.savedCoeff;
      }
      if (sortBy === 'rune_profit_desc') {
        return b.runeSpecificProfit - a.runeSpecificProfit;
      }
      if (sortBy === 'roi_desc') {
        return b.maxRoi - a.maxRoi;
      }
      if (sortBy === 'breakeven_asc') {
        return a.breakEvenCoeff - b.breakEvenCoeff;
      }
      if (sortBy === 'cost_asc') {
        return a.singleCraftCost - b.singleCraftCost;
      }
      if (sortBy === 'level_desc') {
        return b.level - a.level;
      }
      if (sortBy === 'date_desc') {
        const tsA = a.coeffTimestamp || 0;
        const tsB = b.coeffTimestamp || 0;
        return tsB - tsA;
      }
      return 0;
    });
  }, [
    crushableItems,
    marketPrices,
    savedCoefficients,
    savedTimestamps,
    searchQuery,
    slotFilter,
    minLevel,
    maxLevel,
    minCoeff,
    maxCoeff,
    selectedRuneId,
    selectedTextFilter,
    dateFilter,
    sortBy,
    EQUIPMENT_SLOTS,
  ]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchQuery,
    slotFilter,
    minLevel,
    maxLevel,
    minCoeff,
    maxCoeff,
    selectedRuneId,
    selectedTextFilter,
    dateFilter,
    sortBy,
  ]);

  const totalPages = Math.max(1, Math.ceil(processedCatalogItems.length / PAGE_SIZE));
  const paginatedCatalogItems = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return processedCatalogItems.slice(start, start + PAGE_SIZE);
  }, [processedCatalogItems, currentPage]);

  // Autocomplete search suggestions for Detail view
  const detailSearchResults = useMemo(() => {
    if (!detailSearchQuery.trim()) return crushableItems.slice(0, 20);
    const q = detailSearchQuery.toLowerCase().trim();
    return crushableItems
      .filter((i) => {
        const name = getItemName(i).toLowerCase();
        const type = getItemTypeName(i).toLowerCase();
        return name.includes(q) || type.includes(q) || String(i.id).includes(q);
      })
      .slice(0, 20);
  }, [crushableItems, detailSearchQuery]);

  // Filtered runes list for the HDV Runas manager tab
  const filteredBaseRunes = useMemo(() => {
    return DOFUS_BASE_RUNES.filter((rune) => {
      if (runeCategoryFilter !== 'all' && rune.category !== runeCategoryFilter) {
        return false;
      }
      if (runeSearchTerm.trim().length > 0) {
        const q = runeSearchTerm.toLowerCase().trim();
        return (
          rune.name.toLowerCase().includes(q) ||
          rune.shortCode.toLowerCase().includes(q) ||
          rune.description.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [runeCategoryFilter, runeSearchTerm]);

  // Get active rune object if filter is selected
  const activeSelectedRune = useMemo(() => {
    if (typeof selectedRuneId === 'number') {
      return BASE_RUNES_BY_ID[selectedRuneId] || null;
    }
    return null;
  }, [selectedRuneId]);

  return (
    <div className="space-y-5 w-full pb-12">
      {/* Top Header & Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-2xl px-5 py-3.5 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-black text-xl text-white tracking-tight">
                Rompedora de Runas
              </h1>
              <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {crushableItems.length} objetos
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Machacado de equipables, cálculo exacto de runas, coeficientes y rentabilidad.
            </p>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0 gap-1">
          <button
            onClick={() => setViewMode('catalog')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${
              viewMode === 'catalog'
                ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            Catálogo y Listado
          </button>

          {selectedItem && (
            <button
              onClick={() => setViewMode('detail')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${
                viewMode === 'detail'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Crosshair className="w-4 h-4" />
              Simulador ({getItemName(selectedItem).slice(0, 14)}...)
            </button>
          )}

          <button
            onClick={() => setViewMode('rune_prices')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${
              viewMode === 'rune_prices'
                ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Tag className="w-4 h-4" />
            HDV Runas ({DOFUS_BASE_RUNES.length})
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. VISTA: CATÁLOGO Y LISTADO DE MACHACADO                                 */}
      {/* ========================================================================= */}
      {viewMode === 'catalog' && (
        <div className="space-y-4">
          {/* Main Filter Control Box (Kamaskope & Dofus 3.0 Standard) */}
          <div className="bg-[#0f0e17] border border-purple-900/40 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4">
            {/* 1. Top Bar: Equipment Slots + Level Inputs + Coeff % Inputs + Date Filter */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-purple-950/60">
              {/* Equipment Slots Buttons */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-purple-900/40 max-w-full">
                {EQUIPMENT_SLOTS.map((slot) => {
                  const Icon = slot.icon;
                  const isSelected = slotFilter === slot.id;
                  return (
                    <button
                      key={slot.id}
                      onClick={() => setSlotFilter(isSelected && slot.id !== 'all' ? 'all' : slot.id)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
                        isSelected
                          ? 'bg-purple-600 text-white font-extrabold shadow-md shadow-purple-950/80 border border-purple-400'
                          : 'bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800 border border-purple-950/40'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {slot.label}
                    </button>
                  );
                })}
              </div>

              {/* Numeric Inputs: Level, Coeff %, and Date Dropdown */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Level Inputs */}
                <div className="flex items-center gap-1 bg-slate-950/90 border border-purple-950/60 rounded-xl px-2.5 py-1 text-xs">
                  <span className="font-bold text-slate-400">Niv.</span>
                  <input
                    type="number"
                    min="1"
                    max="200"
                    placeholder="Mín."
                    value={minLevel}
                    onChange={(e) =>
                      setMinLevel(
                        e.target.value === ''
                          ? ''
                          : Math.max(1, Math.min(200, Number(e.target.value)))
                      )
                    }
                    className="w-11 bg-slate-900 border border-slate-800 rounded px-1 text-center text-xs font-mono font-bold text-amber-300 placeholder-slate-600 focus:outline-none focus:border-purple-500"
                  />
                  <span className="text-slate-600 font-bold">-</span>
                  <input
                    type="number"
                    min="1"
                    max="200"
                    placeholder="Máx."
                    value={maxLevel}
                    onChange={(e) =>
                      setMaxLevel(
                        e.target.value === ''
                          ? ''
                          : Math.max(1, Math.min(200, Number(e.target.value)))
                      )
                    }
                    className="w-11 bg-slate-900 border border-slate-800 rounded px-1 text-center text-xs font-mono font-bold text-amber-300 placeholder-slate-600 focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* Coeff % Inputs */}
                <div className="flex items-center gap-1 bg-slate-950/90 border border-purple-950/60 rounded-xl px-2.5 py-1 text-xs">
                  <span className="font-bold text-slate-400">Coef %</span>
                  <input
                    type="number"
                    min="1"
                    max="2000"
                    placeholder="Mín."
                    value={minCoeff}
                    onChange={(e) =>
                      setMinCoeff(
                        e.target.value === ''
                          ? ''
                          : Math.max(1, Math.min(2000, Number(e.target.value)))
                      )
                    }
                    className="w-11 bg-slate-900 border border-slate-800 rounded px-1 text-center text-xs font-mono font-bold text-purple-300 placeholder-slate-600 focus:outline-none focus:border-purple-500"
                  />
                  <span className="text-slate-600 font-bold">-</span>
                  <input
                    type="number"
                    min="1"
                    max="2000"
                    placeholder="Máx."
                    value={maxCoeff}
                    onChange={(e) =>
                      setMaxCoeff(
                        e.target.value === ''
                          ? ''
                          : Math.max(1, Math.min(2000, Number(e.target.value)))
                      )
                    }
                    className="w-11 bg-slate-900 border border-slate-800 rounded px-1 text-center text-xs font-mono font-bold text-purple-300 placeholder-slate-600 focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* Updated Date Dropdown */}
                <div className="flex items-center gap-1.5 bg-slate-950/90 border border-purple-950/60 rounded-xl px-2.5 py-1 text-xs">
                  <Clock className="w-3.5 h-3.5 text-purple-400" />
                  <span className="font-bold text-slate-400 hidden sm:inline">Actualizado:</span>
                  <select
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value as DateFilterOption)}
                    className="bg-transparent text-xs font-bold text-slate-200 focus:outline-none cursor-pointer"
                  >
                    <option value="all" className="bg-slate-950">Todo</option>
                    <option value="today" className="bg-slate-950">Hoy (&lt;24h)</option>
                    <option value="3days" className="bg-slate-950">Últimos 3 días</option>
                    <option value="week" className="bg-slate-950">Última semana</option>
                    <option value="month" className="bg-slate-950">Último mes</option>
                    <option value="custom_only" className="bg-slate-950">Con Coef Guardado</option>
                    <option value="default_only" className="bg-slate-950">Sin Registrar (100%)</option>
                  </select>
                </div>

                {/* Reset Filters Button */}
                {(slotFilter !== 'all' ||
                  minLevel !== '' ||
                  maxLevel !== '' ||
                  minCoeff !== '' ||
                  maxCoeff !== '' ||
                  activeStatFilterId !== null ||
                  dateFilter !== 'all' ||
                  searchQuery !== '') && (
                  <button
                    onClick={handleClearAllFilters}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold text-red-400 hover:text-red-300 bg-red-950/40 hover:bg-red-900/60 border border-red-800/50 transition-colors"
                    title="Limpiar todos los filtros"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Limpiar
                  </button>
                )}
              </div>
            </div>

            {/* 2. Visual 3-Column Stats Filter Grid (Daños | Resistencias | Características) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
              {/* COLUMN 1: DAÑOS */}
              <div className="bg-slate-950/60 border border-purple-950/40 rounded-xl p-3 space-y-2">
                <h4 className="text-purple-400 font-extrabold text-xs uppercase tracking-wider text-center pb-2 border-b border-purple-950/60">
                  Daños
                </h4>
                <div className="grid grid-cols-2 gap-1.5">
                  {STAT_FILTERS_DAMAGES.map((stat) => {
                    const isSelected = activeStatFilterId === stat.id;
                    return (
                      <button
                        key={stat.id}
                        onClick={() => handleToggleStatFilter(stat)}
                        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-all text-left group ${
                          isSelected
                            ? 'bg-purple-600 text-white font-extrabold shadow-md border border-purple-300 ring-1 ring-purple-400'
                            : 'bg-slate-900/60 hover:bg-purple-950/40 text-slate-300 hover:text-white border border-slate-800/60 hover:border-purple-800/40'
                        }`}
                        title={stat.name}
                      >
                        {renderStatGlyph(stat.glyphType, stat.color)}
                        <span className="truncate text-[11px] font-semibold">{stat.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* COLUMN 2: RESISTENCIAS */}
              <div className="bg-slate-950/60 border border-purple-950/40 rounded-xl p-3 space-y-2">
                <h4 className="text-purple-400 font-extrabold text-xs uppercase tracking-wider text-center pb-2 border-b border-purple-950/60">
                  Resistencias
                </h4>
                <div className="grid grid-cols-2 gap-1.5">
                  {STAT_FILTERS_RESISTANCES.map((stat) => {
                    const isSelected = activeStatFilterId === stat.id;
                    return (
                      <button
                        key={stat.id}
                        onClick={() => handleToggleStatFilter(stat)}
                        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-all text-left group ${
                          isSelected
                            ? 'bg-purple-600 text-white font-extrabold shadow-md border border-purple-300 ring-1 ring-purple-400'
                            : 'bg-slate-900/60 hover:bg-purple-950/40 text-slate-300 hover:text-white border border-slate-800/60 hover:border-purple-800/40'
                        }`}
                        title={stat.name}
                      >
                        {renderStatGlyph(stat.glyphType, stat.color)}
                        <span className="truncate text-[11px] font-semibold">{stat.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* COLUMN 3: CARACTERÍSTICAS */}
              <div className="bg-slate-950/60 border border-purple-950/40 rounded-xl p-3 space-y-2">
                <h4 className="text-purple-400 font-extrabold text-xs uppercase tracking-wider text-center pb-2 border-b border-purple-950/60">
                  Características
                </h4>
                <div className="grid grid-cols-3 gap-1.5">
                  {STAT_FILTERS_CHARACTERISTICS.map((stat) => {
                    const isSelected = activeStatFilterId === stat.id;
                    return (
                      <button
                        key={stat.id}
                        onClick={() => handleToggleStatFilter(stat)}
                        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-all text-left group ${
                          isSelected
                            ? 'bg-purple-600 text-white font-extrabold shadow-md border border-purple-300 ring-1 ring-purple-400'
                            : 'bg-slate-900/60 hover:bg-purple-950/40 text-slate-300 hover:text-white border border-slate-800/60 hover:border-purple-800/40'
                        }`}
                        title={stat.name}
                      >
                        {renderStatGlyph(stat.glyphType, stat.color)}
                        <span className="truncate text-[11px] font-semibold">{stat.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 3. Bottom Row: Search Input + Sorting Selector */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-3 border-t border-purple-950/60">
              {/* Search input */}
              <div className="md:col-span-7 lg:col-span-8 relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar equipable por nombre (ej. Gelanillo, Solomonk, Capa del Roble Blando...)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-purple-950/60 rounded-xl pl-10 pr-9 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all font-medium"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Sorting Selector */}
              <div className="md:col-span-5 lg:col-span-4 relative">
                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="w-full bg-slate-950 border border-purple-950/60 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 font-bold focus:outline-none focus:border-purple-500 transition-all appearance-none cursor-pointer pr-9"
                  >
                    {selectedRuneId !== 'all' ? (
                      <option value="rune_profit_desc">🎯 Mayor Ganancia con Runa Seleccionada</option>
                    ) : null}
                    <option value="profit_desc">🏆 Mayor Ganancia Total (Kamas)</option>
                    <option value="coeff_desc">📈 Mayor Coeficiente (%)</option>
                    <option value="roi_desc">💰 Mayor Rentabilidad (% ROI)</option>
                    <option value="breakeven_asc">📉 Menor Coef. Rentable</option>
                    <option value="cost_asc">💵 Menor Costo de Crafteo</option>
                    <option value="level_desc">🎚️ Nivel (200 → 1)</option>
                    <option value="date_desc">🕒 Coeficiente Más Reciente</option>
                  </select>
                  <ArrowUpDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Active Stat or Rune Filter Indicator */}
            {(activeStatFilterId || selectedRuneId !== 'all' || slotFilter !== 'all') && (
              <div className="flex items-center justify-between bg-purple-950/40 border border-purple-500/40 rounded-xl px-3.5 py-2 text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span className="text-purple-200 font-bold">
                    Filtros activos:
                  </span>
                  {slotFilter !== 'all' && (
                    <span className="bg-purple-900/80 text-purple-200 px-2 py-0.5 rounded font-bold border border-purple-700">
                      Slot: {EQUIPMENT_SLOTS.find((s) => s.id === slotFilter)?.label}
                    </span>
                  )}
                  {activeStatFilterId && (
                    <span className="bg-purple-900/80 text-purple-200 px-2 py-0.5 rounded font-bold border border-purple-700">
                      Estadística:{' '}
                      {[
                        ...STAT_FILTERS_DAMAGES,
                        ...STAT_FILTERS_RESISTANCES,
                        ...STAT_FILTERS_CHARACTERISTICS,
                      ].find((s) => s.id === activeStatFilterId)?.name}
                    </span>
                  )}
                </div>
                <button
                  onClick={handleClearAllFilters}
                  className="text-xs text-purple-400 hover:text-purple-300 underline font-bold"
                >
                  Limpiar filtros
                </button>
              </div>
            )}
          </div>

          {/* Results Summary Bar */}
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span>
              Mostrando <strong>{paginatedCatalogItems.length}</strong> de <strong>{processedCatalogItems.length}</strong> equipables
            </span>
            <span>
              Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong>
            </span>
          </div>

          {/* Catalog Grid Cards */}
          {paginatedCatalogItems.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
              <Sparkles className="w-10 h-10 text-slate-600 mx-auto" />
              <h3 className="text-base font-bold text-white">No se encontraron equipables</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                No hay objetos que coincidan con los filtros seleccionados (oficio, nivel, runa o fecha de registro).
              </p>
              <button
                onClick={handleClearAllFilters}
                className="px-4 py-2 bg-purple-600 text-white font-black rounded-xl text-xs hover:bg-purple-500 transition-colors inline-block shadow-lg"
              >
                Limpiar Filtros
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
              {paginatedCatalogItems.map((entry) => {
                const item = entry.item;
                const itemName = getItemName(item);
                const typeName = getItemTypeName(item);
                const iconUrl = getItemIconUrl(item);

                return (
                  <div
                    key={item.id}
                    onClick={() => handleOpenDetail(item)}
                    className="bg-slate-900 border border-slate-800 hover:border-amber-500/60 rounded-2xl p-3.5 sm:p-4 transition-all cursor-pointer shadow-lg hover:shadow-amber-500/10 group flex flex-col justify-between gap-3"
                  >
                    {/* Top Identity Row */}
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 p-1 flex items-center justify-center shrink-0 group-hover:border-amber-500/40 transition-colors shadow-inner">
                        <SafeImage
                          src={iconUrl}
                          fallbackSrc={getItemFallbackIconUrl(item)}
                          alt={itemName}
                          className="w-10 h-10 object-contain"
                        />
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-start justify-between gap-1.5">
                          <span className="font-black text-white text-base leading-snug truncate group-hover:text-amber-400 transition-colors">
                            {itemName}
                          </span>
                          <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-md bg-slate-950 text-amber-400 border border-slate-800 shrink-0">
                            Nv. {entry.level}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-md border bg-slate-950 text-slate-300 border-slate-800">
                            {entry.jobNameEs}
                          </span>
                          {entry.hasCustomCoeff ? (
                            <span
                              className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1"
                              title={`Registrado: ${formatFullDate(entry.coeffTimestamp)}`}
                            >
                              <Percent className="w-3 h-3 text-amber-400" />
                              {entry.savedCoeff}%
                              <span className="text-[10px] text-amber-400/70 font-normal">
                                ({formatTimeAgo(entry.coeffTimestamp)})
                              </span>
                            </span>
                          ) : (
                            <span className="text-xs font-mono text-slate-400 px-1.5 py-0.5 bg-slate-950/60 rounded border border-slate-800">
                              Coef: 100%
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Target Rune Highlight (if specific rune is filtered) */}
                    {entry.targetRuneYield && (
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-2 flex items-center justify-between text-xs font-mono">
                        <div className="flex items-center gap-1.5 truncate">
                          <RuneIcon rune={entry.targetRuneYield.rune} size="xs" />
                          <span className="font-bold text-amber-300 truncate">
                            {entry.targetRuneYield.rune.name}: ~{entry.runeSpecificRunes.toFixed(2)} runas
                          </span>
                        </div>
                        <span className="font-black text-amber-400 shrink-0">
                          {entry.runeSpecificKamas.toLocaleString()} K
                        </span>
                      </div>
                    )}

                    {/* Metrics 3-box Grid: Coste | Valor Runas | Ganancia */}
                    <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 grid grid-cols-3 gap-2 text-center font-mono">
                      <div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                          Costo
                        </span>
                        <span className="text-sm font-bold text-slate-200">
                          {entry.singleCraftCost > 0
                            ? `${entry.singleCraftCost.toLocaleString()} K`
                            : '---'}
                        </span>
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                          Runas
                        </span>
                        <span className="text-sm font-bold text-amber-300">
                          {entry.maxKamasValue > 0
                            ? `${entry.maxKamasValue.toLocaleString()} K`
                            : '---'}
                        </span>
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                          Ganancia
                        </span>
                        <span
                          className={`text-sm font-black block ${
                            entry.maxProfit >= 0
                              ? 'text-emerald-400'
                              : 'text-rose-400'
                          }`}
                        >
                          {entry.maxProfit > 0 ? '+' : ''}
                          {entry.maxProfit.toLocaleString()} K
                        </span>
                      </div>
                    </div>

                    {/* Bottom Action Footer */}
                    <div className="pt-0.5 flex items-center justify-between text-xs text-amber-400 font-bold group-hover:translate-x-1 transition-transform">
                      <div className="flex items-center gap-2 flex-wrap">
                        {entry.maxRoi > 0 && (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-xs font-mono border border-emerald-500/30 font-bold">
                            +{entry.maxRoi.toFixed(0)}% ROI
                          </span>
                        )}
                        {entry.bestFocusRune && !entry.targetRuneYield && (
                          <span className="text-xs text-purple-300 flex items-center gap-1 font-semibold">
                            <Sparkles className="w-3 h-3 text-purple-400" />
                            Foco: {entry.bestFocusRune.name.replace('Runa ', '')}
                          </span>
                        )}
                      </div>
                      <span className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-amber-400 group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors">
                        <ChevronRight className="w-4 h-4" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-center gap-2 pt-4">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-slate-900 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" /> Anterior
              </button>

              {/* Direct Page Buttons */}
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => {
                    if (totalPages <= 7) return true;
                    if (p === 1 || p === totalPages) return true;
                    return Math.abs(p - currentPage) <= 2;
                  })
                  .map((pageNum, idx, arr) => {
                    const prev = arr[idx - 1];
                    const showEllipsis = prev && pageNum - prev > 1;

                    return (
                      <React.Fragment key={pageNum}>
                        {showEllipsis && (
                          <span className="px-2 text-xs text-slate-600">...</span>
                        )}
                        <button
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-9 h-9 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                            currentPage === pageNum
                              ? 'bg-amber-500 text-slate-950 font-black shadow'
                              : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
                          }`}
                        >
                          {pageNum}
                        </button>
                      </React.Fragment>
                    );
                  })}
              </div>

              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-slate-900 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center gap-1"
              >
                Siguiente <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. VISTA: SIMULADOR DETALLADO DEL EQUIPABLE SELECCIONADO                   */}
      {/* ========================================================================= */}
      {viewMode === 'detail' && selectedItem && crushingSimulation && (
        <div className="space-y-5">
          {/* Top Return Button & Quick Item Switcher */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
            <button
              onClick={() => setViewMode('catalog')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black bg-slate-950 text-amber-400 hover:text-amber-300 border border-amber-500/30 hover:border-amber-500/60 transition-all w-fit shadow"
            >
              <ChevronLeft className="w-4 h-4" />
              Volver al Catálogo de Rompedora
            </button>

            {/* Quick Switch Dropdown */}
            <div ref={detailSearchContainerRef} className="relative sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Cambiar de objeto..."
                value={detailSearchQuery}
                onFocus={() => setIsDetailSearchOpen(true)}
                onChange={(e) => {
                  setDetailSearchQuery(e.target.value);
                  setIsDetailSearchOpen(true);
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-8 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
              {isDetailSearchOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto z-50 divide-y divide-slate-800/60">
                  {detailSearchResults.map((it) => (
                    <div
                      key={it.id}
                      onClick={() => {
                        setSelectedItem(it);
                        setIsDetailSearchOpen(false);
                        setDetailSearchQuery('');
                      }}
                      className="p-2.5 flex items-center gap-2 hover:bg-slate-900 cursor-pointer transition-colors"
                    >
                      <SafeImage
                        src={getItemIconUrl(it)}
                        fallbackSrc={getItemFallbackIconUrl(it)}
                        alt={getItemName(it)}
                        className="w-6 h-6 object-contain"
                      />
                      <span className="text-xs font-bold text-white truncate flex-1">
                        {getItemName(it)}
                      </span>
                      <span className="text-[10px] font-mono text-amber-400">
                        Nv.{it.level}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Main Detail Header Card: Info, Coeff, Presets, and 3-Box Strategic Summary */}
          {(() => {
            const craftCost = crushingSimulation.craftCost;
            const hdvSalePrice = Number(marketPrices[selectedItem.id] || selectedItem.defaultMarketSalePrice || 0);
            const hdvProfit = hdvSalePrice - craftCost;

            const normalValue = crushingSimulation.normalTotalKamasValue;
            const normalProfit = crushingSimulation.normalNetProfit;

            const bestFocus = crushingSimulation.bestFocusOption;
            const focusValue = bestFocus ? bestFocus.totalKamasValue : normalValue;
            const focusProfit = bestFocus ? bestFocus.netProfit : normalProfit;
            const focusRuneName = bestFocus ? bestFocus.rune.name.replace('Runa ', '') : '';

            const highestRunesValue = Math.max(normalValue, focusValue);
            const highestRunesProfit = Math.max(normalProfit, focusProfit);
            const isFocusHigher = focusValue > normalValue;

            const coeffTimestamp = savedTimestamps[selectedItem.id];

            return (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
                  {/* Left: Item Identity */}
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-16 h-16 rounded-2xl bg-slate-950 border border-amber-500/30 flex items-center justify-center p-2 shadow-md shrink-0">
                      <SafeImage
                        key={selectedItem.id}
                        src={getItemIconUrl(selectedItem)}
                        fallbackSrc={getItemFallbackIconUrl(selectedItem)}
                        alt={getItemName(selectedItem)}
                        className="w-12 h-12 object-contain"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h2 className="text-xl font-black text-white truncate">
                          {getItemName(selectedItem)}
                        </h2>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0 font-mono">
                          Nv. {selectedItem.level || 1}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">
                          {getItemTypeName(selectedItem)} • {selectedItem.jobNameEs}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-1.5 flex-wrap">
                        {onSelectRecipeForCalculator && (
                          <button
                            onClick={() => onSelectRecipeForCalculator(selectedItem)}
                            className="flex items-center gap-1 text-xs font-bold text-amber-400 hover:text-amber-300 transition-colors"
                          >
                            Ver Receta Completa <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Quick Controls (Presets & Coeficiente con Fecha) */}
                  <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap shrink-0 border-t lg:border-t-0 lg:border-l border-slate-800 pt-3 lg:pt-0 lg:pl-5">
                    {/* Jet Quick Presets */}
                    <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2">
                      <span className="text-xs font-bold text-slate-400 flex items-center gap-1 pr-1">
                        <Sliders className="w-3.5 h-3.5 text-amber-400" /> Jets:
                      </span>
                      <button
                        onClick={() => handleResetStatsToPreset('min')}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-900 text-slate-300 hover:text-white border border-slate-800 transition-all"
                      >
                        Mín
                      </button>
                      <button
                        onClick={() => handleResetStatsToPreset('avg')}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 transition-all"
                      >
                        Prom
                      </button>
                      <button
                        onClick={() => handleResetStatsToPreset('max')}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-900 text-slate-300 hover:text-white border border-slate-800 transition-all"
                      >
                        Máx
                      </button>
                    </div>

                    {/* Coeficiente (%) Manual Input & Save */}
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-2 bg-slate-950 border border-amber-500/30 rounded-xl px-3 py-2">
                        <div className="flex items-center gap-1">
                          <Percent className="w-4 h-4 text-amber-400" />
                          <span className="text-xs font-black uppercase text-amber-400 tracking-wider">Coef:</span>
                        </div>
                        <div className="relative">
                          <input
                            type="number"
                            min="1"
                            max="2000"
                            value={coefficientPercent}
                            onChange={(e) =>
                              setCoefficientPercent(Math.max(1, Number(e.target.value) || 1))
                            }
                            className="w-20 bg-slate-900 border border-amber-500/40 rounded-lg px-2 py-1 text-center text-sm font-black text-amber-300 focus:outline-none focus:border-amber-400 font-mono"
                          />
                          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs font-black text-amber-500">
                            %
                          </span>
                        </div>
                        <button
                          onClick={handleSaveItemCoefficient}
                          title="Guardar coeficiente para este objeto con fecha y hora"
                          className={`p-2 rounded-lg text-xs font-bold transition-all ${
                            savedCoeffFeedback
                              ? 'bg-emerald-500 text-slate-950 font-black'
                              : 'bg-slate-900 text-amber-300 border border-amber-500/30 hover:bg-amber-500 hover:text-slate-950'
                          }`}
                        >
                          {savedCoeffFeedback ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                        </button>
                      </div>

                      {/* Display date timestamp of saved coefficient */}
                      <span className="text-[10px] text-slate-500 font-medium pr-1">
                        {coeffTimestamp
                          ? `Guardado: ${formatFullDate(coeffTimestamp)}`
                          : 'Coeficiente base sin guardar'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Top Strategic Summary: Coste Craft, Venta HDV & Roto por Runas */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-3.5 border-t border-slate-800">
                  {/* Box 1: Coste Craft */}
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase tracking-wider mb-1.5">
                      <span className="flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-amber-400" /> Coste Craft
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xl sm:text-2xl font-mono font-black text-amber-300">
                        {craftCost.toLocaleString()} K
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        {recipeIngredients.length} ingredientes
                      </span>
                    </div>
                  </div>

                  {/* Box 2: Venta Directa en HDV */}
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase tracking-wider mb-1.5">
                      <span className="flex items-center gap-1.5">
                        <Store className="w-4 h-4 text-emerald-400" /> Venta HDV
                      </span>
                      <div className="flex items-center gap-1.5">
                        <div className="relative">
                          <input
                            type="number"
                            value={itemHdvPriceDraft}
                            onChange={(e) => setItemHdvPriceDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleUpdateItemHdvPrice(itemHdvPriceDraft);
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                            className="w-28 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-right font-mono text-sm font-bold text-emerald-300 focus:outline-none focus:border-emerald-400 pr-5"
                          />
                          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500">
                            K
                          </span>
                        </div>
                        <button
                          onClick={() => handleUpdateItemHdvPrice(itemHdvPriceDraft)}
                          title="Guardar precio HDV"
                          className={`p-1.5 rounded-lg text-xs transition-all ${
                            savedHdvFeedback
                              ? 'bg-emerald-500 text-slate-950 font-bold'
                              : 'bg-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {savedHdvFeedback ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-slate-400 font-semibold">Ganancia Venta:</span>
                      <span className={`text-lg font-mono font-black ${hdvProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {hdvProfit >= 0 ? '+' : ''}{hdvProfit.toLocaleString()} K
                      </span>
                    </div>
                  </div>

                  {/* Box 3: Roto por Runas (Mejor valor detectado) */}
                  <div className={`bg-slate-950/80 border rounded-xl p-4 flex flex-col justify-between ${
                    highestRunesProfit > hdvProfit && highestRunesProfit > 0
                      ? 'border-purple-500/50 bg-purple-950/20'
                      : 'border-slate-800'
                  }`}>
                    <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider mb-1.5">
                      <span className="flex items-center gap-1.5 text-purple-300">
                        <Crosshair className="w-4 h-4 text-purple-400" /> Roto por Runas {isFocusHigher ? `(Foco ${focusRuneName})` : '(Sin Foco)'}
                      </span>
                      <span className="text-xs font-mono text-slate-300 font-bold">
                        {highestRunesValue.toLocaleString()} K
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-slate-400 font-semibold">Ganancia Runas:</span>
                      <span className={`text-lg font-mono font-black ${highestRunesProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {highestRunesProfit >= 0 ? '+' : ''}{highestRunesProfit.toLocaleString()} K
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Main Content Layout: Left Compact Recipe | Right Main Runes Focus Table */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left Column: Compact Recipe & Ingredients Price Editor */}
            <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Layers className="w-4.5 h-4.5 text-amber-400" />
                  <h3 className="text-sm font-black uppercase tracking-wider text-white">
                    Receta ({recipeIngredients.length})
                  </h3>
                </div>
                <span className="text-xs font-mono font-black text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
                  {crushingSimulation.craftCost.toLocaleString()} K
                </span>
              </div>

              {recipeIngredients.length > 0 ? (
                <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
                  {recipeIngredients.map((ing) => {
                    const draftVal = ingredientDrafts[ing.id] ?? String(ing.unitPrice);
                    const isSaved = savedIngFeedback === ing.id;

                    return (
                      <div
                        key={ing.id}
                        className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-2.5 flex items-center justify-between gap-2.5 hover:border-slate-700 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 p-0.5 shrink-0 flex items-center justify-center">
                            <SafeImage
                              src={getItemIconUrl(ing)}
                              fallbackSrc={getItemFallbackIconUrl(ing)}
                              alt={ing.name}
                              className="w-7 h-7 object-contain"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-slate-100 truncate leading-tight">
                              {ing.name}
                            </p>
                            <span className="text-xs font-mono text-amber-400 font-bold">
                              x{ing.quantity} • {ing.totalCost.toLocaleString()} K
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className="relative">
                            <input
                              type="number"
                              value={draftVal}
                              onChange={(e) =>
                                setIngredientDrafts((prev) => ({
                                  ...prev,
                                  [ing.id]: e.target.value,
                                }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleUpdateIngredientPrice(ing.id, draftVal);
                                  (e.target as HTMLInputElement).blur();
                                }
                              }}
                              className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-right font-mono text-sm font-bold text-slate-100 focus:outline-none focus:border-amber-500 pr-5"
                            />
                            <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500">
                              K
                            </span>
                          </div>
                          <button
                            onClick={() => handleUpdateIngredientPrice(ing.id, draftVal)}
                            title="Guardar precio"
                            className={`p-1.5 rounded-lg text-xs transition-all ${
                              isSaved
                                ? 'bg-emerald-500 text-slate-950 font-bold'
                                : 'bg-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            {isSaved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-slate-500">
                  Sin receta registrada o es recurso base.
                </div>
              )}
            </div>

            {/* Right Column: Main Central Runes & Focus Table */}
            <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3.5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 pb-3.5">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-4.5 h-4.5 text-amber-400" />
                  <h3 className="text-base font-black text-white">
                    Runas Obtenidas y Focos
                  </h3>
                </div>
                <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-400 font-medium">
                  <span>Mínimo Rentable: <strong className="text-orange-400 font-mono font-black">{crushingSimulation.breakEvenCoefficient}%</strong></span>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-xs">
                      <th className="py-3 px-3.5 min-w-[150px]">Estadística (Jet)</th>
                      <th className="py-3 px-3.5 min-w-[180px]">Runa</th>
                      <th className="py-3 px-3.5 min-w-[120px]">Precio HDV</th>
                      <th className="py-3 px-3.5 min-w-[130px] text-amber-400 bg-amber-500/5">Sin Foco</th>
                      <th className="py-3 px-3.5 min-w-[170px] text-purple-300 bg-purple-500/5">Con Foco</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {crushingSimulation.statYields.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-500">
                          Este objeto no posee estadísticas que generen runas conocidas.
                        </td>
                      </tr>
                    ) : (
                      crushingSimulation.statYields.map((yieldItem) => {
                        const isCurrentFocus = focusedRuneId === yieldItem.rune.id;
                        const isTop1 = crushingSimulation.top3FocusOptions[0]?.rune.id === yieldItem.rune.id;
                        const isTop2 = crushingSimulation.top3FocusOptions[1]?.rune.id === yieldItem.rune.id;
                        const isTop3 = crushingSimulation.top3FocusOptions[2]?.rune.id === yieldItem.rune.id;

                        const draftPrice =
                          runePriceDrafts[yieldItem.rune.id] ??
                          String(yieldItem.unitPrice);

                        const gainVsNormal =
                          yieldItem.focusKamasValue -
                          crushingSimulation.normalTotalKamasValue;

                        return (
                          <tr
                            key={yieldItem.rune.id}
                            className={`transition-colors ${
                              isCurrentFocus
                                ? 'bg-purple-950/30'
                                : 'hover:bg-slate-950/40'
                            }`}
                          >
                            {/* Tirada / Jet Controls */}
                            <td className="py-2.5 px-3.5">
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleStatChange(yieldItem.rune.id, String(yieldItem.statMin))}
                                    className={`px-2 py-0.5 rounded text-xs font-mono font-bold transition-all ${
                                      yieldItem.statSelectedVal === yieldItem.statMin
                                        ? 'bg-slate-700 text-white'
                                        : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                                    }`}
                                  >
                                    Mín
                                  </button>
                                  <button
                                    onClick={() => handleStatChange(yieldItem.rune.id, String(Math.ceil((yieldItem.statMin + yieldItem.statMax) / 2)))}
                                    className={`px-2 py-0.5 rounded text-xs font-mono font-bold transition-all ${
                                      yieldItem.statSelectedVal === Math.ceil((yieldItem.statMin + yieldItem.statMax) / 2)
                                        ? 'bg-amber-500 text-slate-950 font-black'
                                        : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                                    }`}
                                  >
                                    Prom
                                  </button>
                                  <button
                                    onClick={() => handleStatChange(yieldItem.rune.id, String(yieldItem.statMax))}
                                    className={`px-2 py-0.5 rounded text-xs font-mono font-bold transition-all ${
                                      yieldItem.statSelectedVal === yieldItem.statMax
                                        ? 'bg-slate-700 text-white'
                                        : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                                    }`}
                                  >
                                    Máx
                                  </button>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="number"
                                    min={0}
                                    value={yieldItem.statSelectedVal}
                                    onChange={(e) =>
                                      handleStatChange(yieldItem.rune.id, e.target.value)
                                    }
                                    className="w-20 bg-slate-950 border border-slate-700 rounded-lg px-2 py-0.5 text-center text-sm font-mono font-bold text-white focus:outline-none focus:border-amber-500"
                                  />
                                  <span className="text-xs text-slate-400 font-mono">
                                    ({yieldItem.statMin} - {yieldItem.statMax})
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* Rune identity */}
                            <td className="py-2.5 px-3.5">
                              <div className="flex items-center gap-2.5">
                                <RuneIcon rune={yieldItem.rune} size="sm" showTooltip />
                                <div className="min-w-0">
                                  <p className="font-bold text-white flex items-center gap-1.5 truncate leading-tight text-sm">
                                    <span className="text-amber-400">+{yieldItem.statSelectedVal}</span>
                                    <span className="truncate">{yieldItem.rune.name.replace('Runa ', '')}</span>
                                  </p>
                                  <span className="text-xs font-mono text-slate-400">
                                    Peso: {yieldItem.unitWeight}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* HDV Price Editor */}
                            <td className="py-2.5 px-3.5">
                              <div className="flex items-center gap-1.5">
                                <div className="relative">
                                  <input
                                    type="number"
                                    value={draftPrice}
                                    onChange={(e) =>
                                      setRunePriceDrafts((prev) => ({
                                        ...prev,
                                        [yieldItem.rune.id]: e.target.value,
                                      }))
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        handleUpdateRunePrice(
                                          yieldItem.rune.id,
                                          draftPrice,
                                        );
                                        (e.target as HTMLInputElement).blur();
                                      }
                                    }}
                                    className="w-24 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-right text-sm font-mono font-bold text-slate-100 focus:outline-none focus:border-amber-500 pr-5"
                                  />
                                  <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500">
                                    K
                                  </span>
                                </div>
                                {savedRuneIdFeedback === yieldItem.rune.id && (
                                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                                )}
                              </div>
                            </td>

                            {/* Normal Yield (Sin foco) */}
                            <td className="py-2.5 px-3.5 bg-amber-500/5 font-mono">
                              <div className="font-black text-amber-300 text-sm">
                                {yieldItem.normalRunesPerItem.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })} <span className="text-xs text-amber-400/80 font-semibold">runas</span>
                              </div>
                              <div className="text-xs font-bold text-slate-300">
                                {yieldItem.normalKamasValue.toLocaleString()} K
                              </div>
                            </td>

                            {/* Focus Yield (Con foco) */}
                            <td className="py-2.5 px-3.5 bg-purple-500/5 font-mono">
                              <div className="flex items-center justify-between gap-2">
                                <div>
                                  <span
                                    className={`font-black text-sm ${
                                      isTop1
                                        ? 'text-amber-300'
                                        : isTop2
                                        ? 'text-sky-300'
                                        : isTop3
                                        ? 'text-orange-300'
                                        : 'text-slate-300'
                                    }`}
                                  >
                                    {yieldItem.focusRunesPerItem.toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })} <span className="text-xs text-purple-400/80 font-semibold">runas</span>
                                  </span>
                                  <div className="text-xs font-bold text-slate-200">
                                    {yieldItem.focusKamasValue.toLocaleString()} K
                                  </div>
                                </div>

                                <div className="text-right shrink-0">
                                  {isTop1 && (
                                    <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-black text-xs">
                                      TOP 1
                                    </span>
                                  )}
                                  {isTop2 && (
                                    <span className="px-2 py-0.5 rounded bg-sky-500 text-slate-950 font-black text-xs">
                                      TOP 2
                                    </span>
                                  )}
                                  {isTop3 && (
                                    <span className="px-2 py-0.5 rounded bg-orange-500 text-slate-950 font-black text-xs">
                                      TOP 3
                                    </span>
                                  )}
                                  <div className="mt-0.5">
                                    <span
                                      className={`text-[10px] font-mono font-bold ${
                                        gainVsNormal >= 0 ? 'text-emerald-400' : 'text-slate-500'
                                      }`}
                                    >
                                      {gainVsNormal >= 0 ? '+' : ''}
                                      {gainVsNormal.toLocaleString()} K
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. VISTA: GESTOR DE PRECIOS HDV RUNAS                                     */}
      {/* ========================================================================= */}
      {viewMode === 'rune_prices' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Category Filter Pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => setRuneCategoryFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    runeCategoryFilter === 'all'
                      ? 'bg-amber-500 text-slate-950 font-black'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  Todas ({DOFUS_BASE_RUNES.length})
                </button>
                <button
                  onClick={() => setRuneCategoryFilter('especial')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    runeCategoryFilter === 'especial'
                      ? 'bg-amber-500 text-slate-950 font-black'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  ⭐ Especiales
                </button>
                <button
                  onClick={() => setRuneCategoryFilter('primaria')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    runeCategoryFilter === 'primaria'
                      ? 'bg-amber-500 text-slate-950 font-black'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  ⚡ Primarias
                </button>
                <button
                  onClick={() => setRuneCategoryFilter('resistencia')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    runeCategoryFilter === 'resistencia'
                      ? 'bg-amber-500 text-slate-950 font-black'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  🛡️ Resistencias
                </button>
                <button
                  onClick={() => setRuneCategoryFilter('dano')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    runeCategoryFilter === 'dano'
                      ? 'bg-amber-500 text-slate-950 font-black'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  💥 Daños
                </button>
                <button
                  onClick={() => setRuneCategoryFilter('secundaria')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    runeCategoryFilter === 'secundaria'
                      ? 'bg-amber-500 text-slate-950 font-black'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  ✨ Secundarias
                </button>
              </div>

              {/* Search in runes */}
              <div className="relative sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar runa (PA, PM, Fo, Cri...)"
                  value={runeSearchTerm}
                  onChange={(e) => setRuneSearchTerm(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Grid of Runes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredBaseRunes.map((rune) => {
              const currentPrice = marketPrices[rune.id] ?? rune.defaultPrice;
              const draftVal = runePriceDrafts[rune.id] ?? String(currentPrice);
              const isSaved = savedRuneIdFeedback === rune.id;

              return (
                <div
                  key={rune.id}
                  className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-3 shadow-md flex items-center justify-between gap-3 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <RuneIcon rune={rune} size="md" />
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs sm:text-sm font-black text-white truncate">
                        {rune.name}
                      </h4>
                      <p className="text-[11px] text-slate-400 truncate">
                        {rune.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="relative">
                      <input
                        type="number"
                        value={draftVal}
                        onChange={(e) =>
                          setRunePriceDrafts((prev) => ({
                            ...prev,
                            [rune.id]: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleUpdateRunePrice(rune.id, draftVal);
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                        className="w-24 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-right text-xs font-mono font-black text-amber-300 focus:outline-none focus:border-amber-500 pr-5"
                      />
                      <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500 font-mono">
                        K
                      </span>
                    </div>

                    <button
                      onClick={() => handleUpdateRunePrice(rune.id, draftVal)}
                      title="Guardar precio de la runa"
                      className={`p-1.5 rounded-lg text-xs transition-all ${
                        isSaved
                          ? 'bg-emerald-500 text-slate-950 font-bold'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {isSaved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
