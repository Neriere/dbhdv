import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Search,
  Coins,
  Wheat,
  Axe,
  FlaskConical,
  Pickaxe,
  Fish,
  Drumstick,
  Heart,
  Package,
  Tag,
  Check,
  Sparkles,
  ExternalLink,
  Download,
  Upload,
  Filter,
  Hammer,
  AlertCircle,
  Zap,
  ChevronLeft,
  ChevronRight,
  History,
  Clock,
  X,
  Radio,
  HardDriveDownload,
  ArrowUpDown,
  BarChart2,
  Layers,
  Activity,
  Edit2,
  TrendingUp,
  TrendingDown,
  Minus,
  ShoppingCart,
  Copy,
  List,
  LayoutGrid,
} from 'lucide-react';
import { DofusItem, MarketPriceMap, PriceUpdatedAtMap, SalesVolumeMap, PriceChangeInfo } from '../types';
import { EditSalesVolumeModal } from './common/EditSalesVolumeModal';
import {
  getActivePriceProfileId,
  getImportedItems,
  getPriceProfiles,
  getStoredMarketPrices,
  getStoredPriceUpdatedAt,
  getStoredRecipes,
  saveMarketPrice,
  saveAllMarketPrices,
  importFullDatabaseJSON,
  setActiveLocalPriceProfile,
  getItemName,
  getItemTypeName,
  getItemIconUrl,
  getItemFallbackIconUrl,
  initializeDatabase,
  formatRelativeTime,
  addToShoppingList,
  fetchLatestPriceChanges,
} from '../services/dofusDbService';
import { getStoredSalesVolumeMap } from '../services/salesVolumeService';
import { DOFUS_DB_TYPE_TO_JOB_MAP, DOFUS_DU_TYPE_TO_JOB_MAP } from '../data/jobCategoryDatabase';
import { DOFUS_BASE_RUNES, BASE_RUNES_BY_ID } from '../data/dofusRuneWeights';
import { ALL_DOFUS_RUNES } from '../data/dofusAllRunesDict';
import { isOmittedItem, isDofusItem } from '../data/dofusJobs';
import { RuneIcon } from './RuneIcon';
import { matchesSearchQuery } from '../utils/searchUtils';
import { GlobalPriceHistoryModal } from './GlobalPriceHistoryModal';
import { ItemPriceHistoryModal } from './ItemPriceHistoryModal';
import { MarketSnifferModal } from './MarketSnifferModal';
import { BackupModal } from './common/BackupModal';
import { groupPriceProfilesByCategory } from '../utils/serverUtils';

type PriceFilterCategory =
  | 'all'
  | 'dofus'
  | 'runes'
  | 'craft_ingredients'
  | 'campesino'
  | 'lenador'
  | 'alquimista'
  | 'minero'
  | 'pescador'
  | 'cazador'
  | 'ganadero'
  | 'monsters'
  | 'equipment'
  | 'has_price'
  | 'without_price';

type ItemScopeFilter = 'all_scope' | 'resources_only' | 'craftable_only';
type SortByField = 'default' | 'sales24h' | 'sales7d' | 'sales30d' | 'avgDaily';

interface PriceManagerProps {
  onSelectItemForRecipe?: (item: DofusItem) => void;
}

export const PriceManager: React.FC<PriceManagerProps> = ({ onSelectItemForRecipe }) => {
  const [items, setItems] = useState<DofusItem[]>([]);
  const [marketPrices, setMarketPrices] = useState<MarketPriceMap>({});
  const [priceUpdatedAt, setPriceUpdatedAt] = useState<Record<number, number>>({});
  const [databaseVersion, setDatabaseVersion] = useState<number>(0);
  const [priceProfiles, setPriceProfiles] = useState(() => getPriceProfiles());
  const [activePriceProfileId, setActivePriceProfileId] = useState<number>(() => getActivePriceProfileId());
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<PriceFilterCategory>('all');
  const [activeScope, setActiveScope] = useState<ItemScopeFilter>('all_scope');
  const [sortByField, setSortByField] = useState<SortByField>('default');
  const [salesVolumes, setSalesVolumes] = useState<SalesVolumeMap>({});
  const ITEMS_PER_PAGE = 50;
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [savedFeedbackItemId, setSavedFeedbackItemId] = useState<number | null>(null);
  const [isGlobalHistoryOpen, setIsGlobalHistoryOpen] = useState<boolean>(false);
  const [isSnifferModalOpen, setIsSnifferModalOpen] = useState<boolean>(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState<boolean>(false);
  const [itemForHistory, setItemForHistory] = useState<DofusItem | null>(null);
  const [itemForSalesVolume, setItemForSalesVolume] = useState<DofusItem | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [priceChanges, setPriceChanges] = useState<Record<number, PriceChangeInfo>>({});
  const [addedCartItemIds, setAddedCartItemIds] = useState<Record<number, boolean>>({});
  const [copiedItemId, setCopiedItemId] = useState<number | null>(null);

  const handleAddToShoppingList = useCallback((item: DofusItem, quantity: number = 1) => {
    addToShoppingList(item, quantity);
    setAddedCartItemIds((prev) => ({ ...prev, [item.id]: true }));
    setTimeout(() => {
      setAddedCartItemIds((prev) => {
        const copy = { ...prev };
        delete copy[item.id];
        return copy;
      });
    }, 1600);
  }, []);

  const handleCopyItemName = useCallback((item: DofusItem) => {
    const name = getItemName(item);
    navigator.clipboard.writeText(name);
    setCopiedItemId(item.id);
    setTimeout(() => {
      setCopiedItemId((curr) => (curr === item.id ? null : curr));
    }, 1200);
  }, []);

  // Reset page whenever search, category, or scope changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeCategory, activeScope, sortByField]);

  const [priceDrafts, setPriceDrafts] = useState<Record<number, string>>({});
  const debounceTimersRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      Object.values(debounceTimersRef.current).forEach((timer) => clearTimeout(timer));
    };
  }, []);

  useEffect(() => {
    const hydrateState = () => {
      const storedPrices = getStoredMarketPrices();
      const baseRuneItems: DofusItem[] = ALL_DOFUS_RUNES.map((r) => ({
        id: r.id,
        name: { es: r.name.es, fr: r.name.fr, en: r.name.en },
        level: r.level || 1,
        typeId: 78,
        type: { id: 78, name: { es: 'Runa', fr: 'Rune', en: 'Rune' } },
        iconId: r.iconId || 78000,
        description: { es: `Runa oficial de forjamagia y triturado.` },
      }));

      const imported = getImportedItems().filter((i) => !isOmittedItem(i));
      const existingIds = new Set<number>();
      const combined: DofusItem[] = [];

      for (const item of imported) {
        if (!existingIds.has(item.id)) {
          existingIds.add(item.id);
          combined.push(item);
        }
      }

      for (const runeItem of baseRuneItems) {
        if (!existingIds.has(runeItem.id)) {
          existingIds.add(runeItem.id);
          combined.push(runeItem);
        }
      }

      setItems(combined);
      setMarketPrices(storedPrices);
      setPriceUpdatedAt(getStoredPriceUpdatedAt());
      setPriceProfiles(getPriceProfiles());
      setActivePriceProfileId(getActivePriceProfileId());
      setSalesVolumes(getStoredSalesVolumeMap());
      setDatabaseVersion((prev) => prev + 1);

      const initialDrafts: Record<number, string> = {};
      for (const [id, price] of Object.entries(storedPrices)) {
        if (Number(price) > 0) {
          initialDrafts[Number(id)] = String(price);
        }
      }
      setPriceDrafts(initialDrafts);

      fetchLatestPriceChanges()
        .then((changes) => {
          if (changes) setPriceChanges(changes);
        })
        .catch(() => {});
    };

    initializeDatabase()
      .then(() => {
        hydrateState();
      })
      .catch((error) => {
        console.error('No se pudo inicializar la base local:', error);
      });

    let lastPricesEventTime = 0;

    const handlePricesUpdated = (event?: Event) => {
      lastPricesEventTime = Date.now();
      fetchLatestPriceChanges()
        .then((changes) => {
          if (changes) setPriceChanges(changes);
        })
        .catch(() => {});

      const customEvent = event as CustomEvent<{
        updatedPrices?: MarketPriceMap;
        priceUpdatedAt?: PriceUpdatedAtMap;
        replacePrices?: boolean;
      }>;
      if (customEvent?.detail?.replacePrices) {
        const freshPrices = customEvent.detail.updatedPrices || getStoredMarketPrices();
        setMarketPrices({ ...freshPrices });
        const nextDrafts: Record<number, string> = {};
        for (const [id, p] of Object.entries(freshPrices)) {
          if (Number(p) > 0) nextDrafts[Number(id)] = String(p);
        }
        setPriceDrafts(nextDrafts);
      } else if (customEvent?.detail?.updatedPrices) {
        setMarketPrices((prev) => ({ ...prev, ...customEvent.detail.updatedPrices }));
        setPriceDrafts((prev) => {
          const next = { ...prev };
          for (const [id, p] of Object.entries(customEvent.detail.updatedPrices!)) {
            next[Number(id)] = p > 0 ? String(p) : '';
          }
          return next;
        });
      }
      if (customEvent?.detail?.priceUpdatedAt) {
        if (customEvent.detail.replacePrices) {
          setPriceUpdatedAt({ ...customEvent.detail.priceUpdatedAt });
        } else {
          setPriceUpdatedAt((prev) => ({ ...prev, ...customEvent.detail.priceUpdatedAt }));
        }
      }
    };

    const handleDbUpdate = () => {
      hydrateState();
    };

    const handleSalesVolumeUpdate = () => setSalesVolumes(getStoredSalesVolumeMap());
    const handleProfileChange = () => hydrateState();

    window.addEventListener('dofus_prices_updated', handlePricesUpdated);
    window.addEventListener('dofus_database_updated', handleDbUpdate);
    window.addEventListener('dofus_sales_volume_updated', handleSalesVolumeUpdate);
    window.addEventListener('dofus_profile_changed', handleProfileChange);

    return () => {
      window.removeEventListener('dofus_prices_updated', handlePricesUpdated);
      window.removeEventListener('dofus_database_updated', handleDbUpdate);
      window.removeEventListener('dofus_sales_volume_updated', handleSalesVolumeUpdate);
      window.removeEventListener('dofus_profile_changed', handleProfileChange);
    };
  }, []);

  const recipeIngredientIds = useMemo(() => {
    const recipes = getStoredRecipes();
    const set = new Set<number>();
    for (const recipe of Object.values(recipes)) {
      if (recipe.ingredientIds) {
        for (const id of recipe.ingredientIds) set.add(Number(id));
      }
      if (recipe.ingredients) {
        for (const ing of recipe.ingredients) {
          const id = Number(ing.id ?? ing.itemId ?? (ing as any).item_id);
          if (id) set.add(id);
        }
      }
    }
    return set;
  }, [databaseVersion]);

  // Set of item IDs that have their own crafting recipe (i.e. they are the result of a recipe)
  const craftableItemIds = useMemo(() => {
    const recipes = getStoredRecipes();
    return new Set<number>(Object.keys(recipes).map(Number));
  }, [databaseVersion]);

  const handlePriceUpdate = useCallback((itemId: number, rawValue: string) => {
    if (debounceTimersRef.current[itemId]) {
      clearTimeout(debounceTimersRef.current[itemId]);
      delete debounceTimersRef.current[itemId];
    }

    const numericPrice = Math.max(0, parseInt(rawValue, 10) || 0);
    const oldPrice = Number(marketPrices[itemId]) || 0;

    if (numericPrice !== oldPrice && (numericPrice > 0 || oldPrice > 0)) {
      const diff = numericPrice - oldPrice;
      const pct = oldPrice > 0 ? (diff / oldPrice) * 100 : (numericPrice > 0 ? 100 : 0);
      setPriceChanges((prev) => ({
        ...prev,
        [itemId]: {
          itemId,
          price: numericPrice,
          oldPrice,
          difference: diff,
          percentageChange: Number(pct.toFixed(1)),
          timestamp: Date.now(),
        },
      }));
    }

    saveMarketPrice(itemId, numericPrice)
      .then((updated) => {
        setMarketPrices(updated);
        setPriceDrafts((prev) => ({ ...prev, [itemId]: numericPrice > 0 ? String(numericPrice) : '' }));
        setSavedFeedbackItemId(itemId);
        setTimeout(() => setSavedFeedbackItemId((curr) => (curr === itemId ? null : curr)), 1200);
      })
      .catch((error) => {
        console.error(`No se pudo guardar el precio del item ${itemId}:`, error);
      });
  }, [marketPrices]);

  const handlePriceDraftChange = useCallback((itemId: number, value: string) => {
    setPriceDrafts((prev) => ({ ...prev, [itemId]: value }));

    if (debounceTimersRef.current[itemId]) {
      clearTimeout(debounceTimersRef.current[itemId]);
    }

    // Auto-save after 450ms of inactivity
    debounceTimersRef.current[itemId] = setTimeout(() => {
      handlePriceUpdate(itemId, value);
    }, 450);
  }, [handlePriceUpdate]);

  // Quick increment price helper (+100, +1000, etc.)
  const handleQuickAddPrice = (itemId: number, addAmount: number) => {
    const currentPrice = Number(marketPrices[itemId]) || 0;
    const newPrice = currentPrice + addAmount;
    handlePriceUpdate(itemId, String(newPrice));
  };

  const handleExportPricesJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(marketPrices, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `dofus_market_prices_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportFullDatabaseJSON = () => {
    window.location.href = '/api/local-db/export-json';
  };

  const handleImportPricesJSON = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        if (typeof parsed !== 'object' || parsed === null) {
          alert('Archivo JSON inválido.');
          return;
        }

        // Check if it's a full DB backup structure (contains items, recipes or version)
        if (parsed.version === 2 || parsed.items || parsed.recipes || parsed.prices) {
          await importFullDatabaseJSON(parsed);
          const updatedPrices = getStoredMarketPrices();
          setMarketPrices(updatedPrices);
          setItems(getImportedItems());
          const newDrafts: Record<number, string> = {};
          for (const [id, price] of Object.entries(updatedPrices)) {
            if (Number(price) > 0) newDrafts[Number(id)] = String(price);
          }
          setPriceDrafts(newDrafts);
          alert('¡Base de datos y precios importados correctamente!');
        } else {
          // Standard flat prices map { [id]: price }
          const updated = await saveAllMarketPrices(parsed);
          setMarketPrices(updated);
          const newDrafts: Record<number, string> = {};
          for (const [id, price] of Object.entries(updated)) {
            if (Number(price) > 0) newDrafts[Number(id)] = String(price);
          }
          setPriceDrafts(newDrafts);
          alert('¡Precios importados correctamente!');
        }
      } catch (err) {
        console.error('Error al importar:', err);
        alert('No se pudo importar el archivo JSON.');
      } finally {
        event.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleChangeProfile = async (profileId: number) => {
    try {
      await setActiveLocalPriceProfile(profileId);
      setActivePriceProfileId(profileId);
      const changes = await fetchLatestPriceChanges(profileId);
      if (changes) setPriceChanges(changes);
    } catch (error) {
      console.error('No se pudo cambiar el perfil:', error);
    }
  };

  const handleExportDatabase = () => {
    window.location.href = '/api/local-db/export-database';
  };

  const formatUpdatedAtLabel = (itemId: number) => {
    const updatedAt = priceUpdatedAt[itemId];
    return updatedAt ? `Actualizado: ${new Date(updatedAt).toLocaleString()}` : '';
  };

  const gatheringCategories: { id: PriceFilterCategory; label: string; icon: any; color: string; jobId: number }[] = [
    { id: 'campesino', label: 'Campesino', icon: Wheat, color: 'text-amber-400 border-amber-500/30 bg-amber-500/10', jobId: 28 },
    { id: 'lenador', label: 'Leñador', icon: Axe, color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10', jobId: 2 },
    { id: 'alquimista', label: 'Alquimista', icon: FlaskConical, color: 'text-purple-400 border-purple-500/30 bg-purple-500/10', jobId: 26 },
    { id: 'minero', label: 'Minero', icon: Pickaxe, color: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10', jobId: 24 },
    { id: 'pescador', label: 'Pescador', icon: Fish, color: 'text-blue-400 border-blue-500/30 bg-blue-500/10', jobId: 36 },
    { id: 'cazador', label: 'Cazador', icon: Drumstick, color: 'text-rose-400 border-rose-500/30 bg-rose-500/10', jobId: 41 },
    { id: 'ganadero', label: 'Ganadero', icon: Heart, color: 'text-pink-400 border-pink-500/30 bg-pink-500/10', jobId: 101 },
  ];

  const monsterDropTypeIds = new Set([
    47, 48, 53, 54, 55, 56, 57, 59, 103, 104, 105, 106, 107, 108, 109, 110, 111, 119, 15, 74, 96, 98, 152, 219, 229, 278
  ]);

  const allResourceTypesSet = new Set([
    12, 15, 26, 28, 33, 34, 35, 36, 37, 38, 39, 40, 41, 46, 47, 48, 49, 50, 51, 53, 54, 55, 56, 57, 58, 59, 60, 62, 63,
    64, 66, 68, 69, 70, 71, 79, 83, 85, 91, 95, 96, 98, 99, 103, 104, 105, 106, 107, 108, 109, 110, 111, 119, 128, 129, 134,
    135, 150, 152, 153, 167, 170, 179, 183, 185, 187, 206, 219, 228, 229, 242, 278, 307, 308
  ]);

  const matchCategory = (item: DofusItem, cat: PriceFilterCategory): boolean => {
    const typeId = Number(item.typeId || item.type?.id || 0);

    if (cat === 'all') return true;
    if (cat === 'dofus') {
      return typeId === 23 || isDofusItem(item);
    }
    if (cat === 'runes') {
      return typeId === 78 || typeId === 18 || ALL_DOFUS_RUNES.some((r) => r.id === item.id);
    }
    if (cat === 'has_price') return (Number(marketPrices[item.id]) || 0) > 0;
    if (cat === 'without_price') return !marketPrices[item.id] || Number(marketPrices[item.id]) === 0;

    if (cat === 'craft_ingredients') {
      return recipeIngredientIds.has(item.id) || allResourceTypesSet.has(typeId);
    }

    if (cat === 'monsters') {
      return monsterDropTypeIds.has(typeId);
    }

    if (cat === 'equipment') {
      return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 16, 17, 19, 82, 112, 151, 217, 271].includes(typeId);
    }

    const targetCat = gatheringCategories.find((c) => c.id === cat);
    if (targetCat) {
      const jobInfo = DOFUS_DB_TYPE_TO_JOB_MAP[typeId] || DOFUS_DU_TYPE_TO_JOB_MAP[typeId];
      if (jobInfo && jobInfo.jobId === targetCat.jobId) return true;

      if (targetCat.jobId === 28) return [34, 33, 37, 58, 60, 68, 46, 28, 128, 129].includes(typeId);
      if (targetCat.jobId === 2) return [38, 95, 96, 98, 183, 185, 242, 12, 170].includes(typeId);
      if (targetCat.jobId === 26) return [12, 26, 35, 36, 70, 71, 79, 179, 183, 206, 228, 167, 62].includes(typeId);
      if (targetCat.jobId === 24) return [39, 40, 50, 51, 83, 85, 307, 308, 167, 153, 66, 91].includes(typeId);
      if (targetCat.jobId === 36) return [41, 49, 134, 135, 64].includes(typeId);
      if (targetCat.jobId === 41) return [63, 69, 187, 56, 59, 150].includes(typeId);
      if (targetCat.jobId === 101) return [99, 323, 326, 327].includes(typeId);
    }

    return false;
  };

  const filteredItems = useMemo(() => {
    let result = items;

    // 0. Scope Pre-Filter (resources only / craftable only)
    if (activeScope === 'resources_only') {
      const runeIdsSet = new Set(ALL_DOFUS_RUNES.map((r) => r.id));
      result = result.filter((item) => {
        const typeId = Number(item.typeId || item.type?.id || 0);
        // Exclude runes (they have their own filter) and items with own recipe
        const isRune = typeId === 78 || typeId === 18 || runeIdsSet.has(item.id);
        return !craftableItemIds.has(item.id) && !isRune;
      });
    } else if (activeScope === 'craftable_only') {
      result = result.filter((item) => craftableItemIds.has(item.id));
    }

    // 1. Search Query Filter (Accent and case-insensitive)
    if (searchTerm.trim()) {
      result = result.filter((item) => {
        return matchesSearchQuery(
          [getItemName(item), getItemTypeName(item), item.id],
          searchTerm,
        );
      });
    }

    // 2. Active Category Filter
    if (activeCategory !== 'all') {
      result = result.filter((item) => matchCategory(item, activeCategory));
    }

    // 3. Sort by sales volume if active
    if (sortByField !== 'default') {
      result = [...result].sort((a, b) => {
        const volA = salesVolumes[a.id];
        const volB = salesVolumes[b.id];
        let valA = 0;
        let valB = 0;
        if (sortByField === 'sales24h') { valA = volA?.sales24h ?? 0; valB = volB?.sales24h ?? 0; }
        else if (sortByField === 'sales7d') { valA = volA?.sales7d ?? 0; valB = volB?.sales7d ?? 0; }
        else if (sortByField === 'sales30d') { valA = volA?.sales30d ?? 0; valB = volB?.sales30d ?? 0; }
        else if (sortByField === 'avgDaily') { valA = volA?.avgDailySales ?? 0; valB = volB?.avgDailySales ?? 0; }
        return valB - valA; // Descending: most sold first
      });
    }

    return result;
  }, [items, searchTerm, activeCategory, activeScope, sortByField, marketPrices, recipeIngredientIds, craftableItemIds, salesVolumes]);

  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE) || 1;
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedItems = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
    return filteredItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredItems, safeCurrentPage]);

  // Compute live category item counts (respecting active scope)
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: 0,
      dofus: 0,
      runes: 0,
      craft_ingredients: 0,
      campesino: 0,
      lenador: 0,
      alquimista: 0,
      minero: 0,
      pescador: 0,
      cazador: 0,
      ganadero: 0,
      monsters: 0,
      equipment: 0,
      has_price: 0,
      without_price: 0,
    };

    const runeIdsSet = new Set(ALL_DOFUS_RUNES.map((r) => r.id));
    const equipTypeIdsSet = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 16, 17, 19, 82, 112, 151, 217, 271]);
    const campesinoTypes = new Set([34, 33, 37, 58, 60, 68, 46, 28, 128, 129]);
    const lenadorTypes = new Set([38, 95, 96, 98, 183, 185, 242, 12, 170]);
    const alquimistaTypes = new Set([12, 26, 35, 36, 70, 71, 79, 179, 183, 206, 228, 167, 62]);
    const mineroTypes = new Set([39, 40, 50, 51, 83, 85, 307, 308, 167, 153, 66, 91]);
    const pescadorTypes = new Set([41, 49, 134, 135, 64]);
    const cazadorTypes = new Set([63, 69, 187, 56, 59, 150]);
    const ganaderoTypes = new Set([99, 323, 326, 327]);

    // Pre-filter items by scope so counts reflect the active scope
    let scopedItems = items;
    if (activeScope === 'resources_only') {
      scopedItems = items.filter((item) => {
        const typeId = Number(item.typeId || item.type?.id || 0);
        const isRune = typeId === 78 || typeId === 18 || runeIdsSet.has(item.id);
        return !craftableItemIds.has(item.id) && !isRune;
      });
    } else if (activeScope === 'craftable_only') {
      scopedItems = items.filter((item) => craftableItemIds.has(item.id));
    }

    counts.all = scopedItems.length;

    for (const item of scopedItems) {
      const typeId = Number(item.typeId || item.type?.id || 0);
      const isDof = typeId === 23 || isDofusItem(item);
      const isRune = typeId === 78 || typeId === 18 || runeIdsSet.has(item.id);

      if (isDof) counts.dofus++;
      if (isRune) counts.runes++;

      if (recipeIngredientIds.has(item.id) || allResourceTypesSet.has(typeId)) {
        counts.craft_ingredients++;
      }

      if (campesinoTypes.has(typeId)) counts.campesino++;
      if (lenadorTypes.has(typeId)) counts.lenador++;
      if (alquimistaTypes.has(typeId)) counts.alquimista++;
      if (mineroTypes.has(typeId)) counts.minero++;
      if (pescadorTypes.has(typeId)) counts.pescador++;
      if (cazadorTypes.has(typeId)) counts.cazador++;
      if (ganaderoTypes.has(typeId)) counts.ganadero++;
      if (monsterDropTypeIds.has(typeId)) counts.monsters++;
      if (equipTypeIdsSet.has(typeId)) counts.equipment++;

      if (Number(marketPrices[item.id]) > 0) counts.has_price++;
      else counts.without_price++;
    }

    return counts;
  }, [items, marketPrices, recipeIngredientIds, activeScope, craftableItemIds]);

  // Scope counts (always based on full items, unaffected by scope itself)
  const scopeCounts = useMemo(() => {
    const runeIdsSet = new Set(ALL_DOFUS_RUNES.map((r) => r.id));
    let resources = 0;
    let craftable = 0;
    for (const item of items) {
      const typeId = Number(item.typeId || item.type?.id || 0);
      const isRune = typeId === 78 || typeId === 18 || runeIdsSet.has(item.id);
      if (craftableItemIds.has(item.id)) craftable++;
      else if (!isRune) resources++;
    }
    return { all: items.length, resources, craftable };
  }, [items, craftableItemIds]);

  return (
    <div className="space-y-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute -right-12 -top-12 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-amber-400 font-mono text-xs uppercase tracking-wider mb-1 font-black">
              <Coins className="w-4 h-4" /> Gestor de Precios
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Precios de Mercadillo (HDV)
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Perfil activo: <strong className="text-slate-200">{priceProfiles.find((profile) => profile.id === activePriceProfileId)?.name || 'General'}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setIsBackupModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-amber-300 border border-slate-700 font-black text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md"
              title="Descargar copia de seguridad o restaurar datos desde un archivo JSON"
            >
              <HardDriveDownload className="w-4 h-4 text-amber-400" />
              Backup / Restaurar
            </button>
            <button
              onClick={() => setIsSnifferModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 font-black text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-amber-500/5"
              title="Configurar y probar Sniffer Automático de Mercadillo en segundo plano"
            >
              <Radio className="w-4 h-4 text-amber-400 animate-pulse" />
              Auto Sniffer (Python)
            </button>
            <button
              onClick={() => setIsGlobalHistoryOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
            >
              <History className="w-4 h-4" />
              Historial de Precios
            </button>
            <span className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-amber-300 font-mono text-xs font-black flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-amber-400" />
              {categoryCounts.has_price} Precios Guardados
            </span>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-lg">
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_220px_auto] gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar recurso por nombre o ID..."
              className="w-full pl-10 pr-10 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-medium text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors shadow-inner font-sans"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3.5 top-2.5 text-slate-500 hover:text-slate-300 p-0.5 rounded"
                title="Limpiar búsqueda"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <select
            value={activePriceProfileId}
            onChange={(event) => {
              void handleChangeProfile(Number(event.target.value));
            }}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-slate-200 focus:outline-none focus:border-amber-500 shadow-inner cursor-pointer"
            title="Servidor o perfil de precios"
          >
            {groupPriceProfilesByCategory(priceProfiles).map((group) => (
              <optgroup
                key={group.category}
                label={`── ${group.label} ──`}
                className="bg-slate-950 text-amber-400 font-bold"
              >
                {group.profiles.map((profile) => (
                  <option
                    key={profile.id}
                    value={profile.id}
                    className="bg-slate-900 text-slate-100 font-normal py-1"
                  >
                    {profile.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase tracking-wider flex-wrap gap-2">
            <span className="flex items-center gap-1.5 text-amber-400">
              <Filter className="w-3.5 h-3.5" /> Categorías y Filtros
            </span>
            <div className="flex items-center gap-3">
              {/* View Mode Toggle: Tabla / Tarjetas */}
              <div className="flex items-center bg-slate-950 p-0.5 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    viewMode === 'table'
                      ? 'bg-amber-500/20 text-amber-300 shadow-sm border border-amber-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Vista en tabla / lista detallada"
                >
                  <List className="w-3.5 h-3.5" />
                  <span>Tabla</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    viewMode === 'grid'
                      ? 'bg-amber-500/20 text-amber-300 shadow-sm border border-amber-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Vista en cuadrícula de tarjetas"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Tarjetas</span>
                </button>
              </div>

              <span className="text-slate-400 font-mono text-[11px] font-bold">
                {filteredItems.length} / {scopeCounts.all} Objetos
              </span>
            </div>
          </div>

          {/* ── Scope Pre-Filter: Tipo de Item ──────────────────────── */}
          <div className="space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <Layers className="w-3 h-3 inline mr-1" />Tipo de Item
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setActiveScope('resources_only')}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeScope === 'resources_only'
                    ? 'bg-teal-500/20 border-teal-500 text-teal-300 shadow-md font-black ring-1 ring-teal-400/50'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-teal-300 hover:border-teal-500/40'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                Solo Recursos ({scopeCounts.resources})
              </button>
              <button
                onClick={() => setActiveScope('craftable_only')}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeScope === 'craftable_only'
                    ? 'bg-violet-500/20 border-violet-500 text-violet-300 shadow-md font-black ring-1 ring-violet-400/50'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-violet-300 hover:border-violet-500/40'
                }`}
              >
                <Hammer className="w-3.5 h-3.5" />
                Solo Crafteables ({scopeCounts.craftable})
              </button>
              <button
                onClick={() => setActiveScope('all_scope')}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                  activeScope === 'all_scope'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm font-black'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Todos ({scopeCounts.all})
              </button>
            </div>
          </div>

          {/* ── Sort by Sales ────────────────────────────────────────── */}
          <div className="space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <ArrowUpDown className="w-3 h-3 inline mr-1" />Ordenar por Ventas
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { id: 'sales24h' as SortByField, label: 'Más vendidos 24h' },
                { id: 'sales7d' as SortByField, label: 'Más vendidos 7d' },
                { id: 'sales30d' as SortByField, label: 'Más vendidos 30d' },
                { id: 'avgDaily' as SortByField, label: 'Promedio diario' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setSortByField(sortByField === opt.id ? 'default' : opt.id)}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all flex items-center gap-1 ${
                    sortByField === opt.id
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-sm font-black'
                      : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <BarChart2 className="w-3 h-3" />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Recolección
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
              {gatheringCategories.map((cat) => {
                const Icon = cat.icon;
                const isActive = activeCategory === cat.id;
                const count = categoryCounts[cat.id] || 0;
                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setActiveCategory(isActive ? 'all' : cat.id);
                    }}
                    className={`p-2 rounded-xl border text-left text-xs font-bold transition-all flex items-center justify-between gap-1.5 ${
                      isActive
                        ? `${cat.color} border-current shadow-md bg-amber-500/20 text-amber-300 font-black`
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                      <span className="truncate text-xs">{cat.label}</span>
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/40 border border-slate-800 text-slate-300">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Producción y uso
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setActiveCategory('dofus')}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeCategory === 'dofus'
                    ? 'bg-amber-500/25 border-amber-400 text-amber-200 shadow-md font-black ring-1 ring-amber-400/50'
                    : 'bg-slate-950 border-slate-800 text-amber-400 hover:text-amber-300 hover:border-amber-500/40'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Dofus ({categoryCounts.dofus})
              </button>
              <button
                onClick={() => setActiveCategory('runes')}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeCategory === 'runes'
                    ? 'bg-purple-500/20 border-purple-500 text-purple-300 shadow-sm font-black'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-purple-400" />
                Runas Base ({categoryCounts.runes})
              </button>
              <button
                onClick={() => setActiveCategory('equipment')}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                  activeCategory === 'equipment'
                    ? 'bg-sky-500/20 border-sky-500 text-sky-300 shadow-sm font-black'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Equipables ({categoryCounts.equipment})
              </button>
              <button
                onClick={() => setActiveCategory('craft_ingredients')}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeCategory === 'craft_ingredients'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm font-black'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Hammer className="w-3.5 h-3.5 text-amber-400" />
                Ingredientes ({categoryCounts.craft_ingredients})
              </button>
              <button
                onClick={() => setActiveCategory('monsters')}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                  activeCategory === 'monsters'
                    ? 'bg-orange-500/20 border-orange-500 text-orange-300 shadow-sm font-black'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Monstruos ({categoryCounts.monsters})
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Estado de Precios
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setActiveCategory('without_price')}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeCategory === 'without_price'
                    ? 'bg-rose-500/20 border-rose-500 text-rose-300 shadow-sm font-black'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                Sin precio ({categoryCounts.without_price})
              </button>
              <button
                onClick={() => setActiveCategory('has_price')}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeCategory === 'has_price'
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm font-black'
                    : 'bg-slate-950 border-slate-800 text-emerald-400 hover:text-white'
                }`}
              >
                <Tag className="w-3.5 h-3.5 text-emerald-400" />
                Con precio ({categoryCounts.has_price})
              </button>
              <button
                onClick={() => setActiveCategory('all')}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                  activeCategory === 'all'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm font-black'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Todo ({categoryCounts.all})
              </button>
            </div>
          </div>
        </div>

      </div>

      {filteredItems.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 space-y-3">
          <Package className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-white">Sin resultados</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">Ajusta la búsqueda o el filtro seleccionado.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {viewMode === 'table' ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-950/90 text-slate-400 font-mono border-b border-slate-800 text-[11px] uppercase tracking-wider sticky top-0 z-10 backdrop-blur-md">
                    <tr>
                      <th className="py-3.5 px-4 min-w-[280px] font-bold">Recurso / Objeto</th>
                      <th className="py-3.5 px-4 min-w-[180px] font-bold">Precio HDV (Kamas)</th>
                      <th className="py-3.5 px-4 min-w-[150px] text-center font-bold">Variación</th>
                      <th className="py-3.5 px-4 min-w-[150px] font-bold">Actualizado</th>
                      <th className="py-3.5 px-4 min-w-[150px] text-center font-bold">Lista de Compra</th>
                      <th className="py-3.5 px-4 min-w-[130px] text-center font-bold">Historial</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-sans text-xs">
                    {paginatedItems.map((item) => {
                      const currentPrice = Number(marketPrices[item.id]) || 0;
                      const draftVal = priceDrafts[item.id] !== undefined ? priceDrafts[item.id] : currentPrice > 0 ? String(currentPrice) : '';
                      const isSaved = savedFeedbackItemId === item.id;
                      const typeName = getItemTypeName(item);
                      const isUsedInCrafting = recipeIngredientIds.has(item.id);
                      const hasCraftRecipe = craftableItemIds.has(item.id);
                      const vol = salesVolumes[item.id];
                      const hasSalesData = vol && ((vol.sales24h ?? 0) > 0 || (vol.sales7d ?? 0) > 0 || (vol.sales30d ?? 0) > 0);
                      const isAddedCart = Boolean(addedCartItemIds[item.id]);
                      const isCopied = copiedItemId === item.id;
                      const change = priceChanges[item.id];

                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-slate-800/40 transition-colors group ${
                            currentPrice > 0 ? 'bg-slate-900/30' : ''
                          }`}
                        >
                          {/* 1. Recurso / Objeto (Izquierda) */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              {/* Icono con Nivel */}
                              <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 p-1 shrink-0 flex items-center justify-center relative shadow-inner group-hover:border-amber-500/40 transition-colors">
                                {BASE_RUNES_BY_ID[item.id] ? (
                                  <RuneIcon rune={BASE_RUNES_BY_ID[item.id]} size="md" />
                                ) : (
                                  <img
                                    src={getItemIconUrl(item)}
                                    alt={getItemName(item)}
                                    className="w-8 h-8 object-contain"
                                    onError={(e) => {
                                      const target = e.currentTarget;
                                      const fallback = getItemFallbackIconUrl(item);
                                      if (target.src !== fallback) target.src = fallback;
                                    }}
                                  />
                                )}
                                {item.level && !BASE_RUNES_BY_ID[item.id] && (
                                  <span className="absolute -bottom-1 -right-1 px-1 py-0.2 bg-slate-900 border border-slate-700 text-[9px] font-mono text-amber-400 rounded font-bold shadow">
                                    {item.level}
                                  </span>
                                )}
                              </div>

                              {/* Info: Nombre y etiquetas */}
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-white text-sm group-hover:text-amber-300 transition-colors truncate">
                                    {getItemName(item)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyItemName(item)}
                                    className="p-1 rounded hover:bg-amber-500/20 text-slate-500 hover:text-amber-300 transition-colors cursor-pointer shrink-0"
                                    title="Copiar nombre para buscar en Dofus (Ctrl+V)"
                                  >
                                    {isCopied ? (
                                      <Check className="w-3 h-3 text-emerald-400" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>

                                <div className="flex items-center gap-1.5 text-xs text-slate-400 flex-wrap">
                                  <span className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-slate-300 font-semibold text-[11px]">
                                    {typeName}
                                  </span>
                                  {isUsedInCrafting && (
                                    <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold text-[10px] flex items-center gap-1">
                                      <FlaskConical className="w-2.5 h-2.5" />
                                      Ingrediente
                                    </span>
                                  )}
                                  {hasCraftRecipe ? (
                                    <span className="px-2 py-0.5 rounded-md bg-violet-500/15 border border-violet-500/30 text-violet-300 font-bold text-[10px] flex items-center gap-1">
                                      <Hammer className="w-2.5 h-2.5" />
                                      Crafteable
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-md bg-teal-500/10 border border-teal-500/20 text-teal-400 font-bold text-[10px] flex items-center gap-1">
                                      <Package className="w-2.5 h-2.5" />
                                      Recurso
                                    </span>
                                  )}
                                  {hasSalesData ? (
                                    <button
                                      onClick={() => setItemForSalesVolume(item)}
                                      className="px-2 py-0.5 rounded-md bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/25 text-[10px] font-mono text-cyan-300 font-bold transition-colors cursor-pointer flex items-center gap-1"
                                      title="Ventas registradas: 24h, 7d, 30d (Clic para editar)"
                                    >
                                      <Activity className="w-2.5 h-2.5" />
                                      <span>{vol.sales24h ?? 0}/24h</span>
                                      <span className="opacity-60">·</span>
                                      <span>{vol.sales7d ?? 0}/7d</span>
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => setItemForSalesVolume(item)}
                                      className="px-1.5 py-0.5 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-[10px] text-slate-500 hover:text-cyan-400 font-mono transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                                      title="Registrar ventas (24h/7d/30d)"
                                    >
                                      + Ventas
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* 2. Precio HDV */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="relative w-32 sm:w-36">
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={draftVal}
                                  onChange={(e) => handlePriceDraftChange(item.id, e.target.value)}
                                  onBlur={(e) => handlePriceUpdate(item.id, e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handlePriceUpdate(item.id, (e.target as HTMLInputElement).value);
                                    }
                                  }}
                                  placeholder="0"
                                  title={formatUpdatedAtLabel(item.id)}
                                  className="w-full pl-3 pr-7 py-1.5 bg-slate-950 border border-slate-700/80 focus:border-amber-400 rounded-xl text-xs font-mono font-black text-amber-300 placeholder-slate-600 focus:outline-none transition-colors shadow-inner"
                                />
                                <span className="absolute right-2.5 top-2 text-xs text-slate-500 font-bold font-mono pointer-events-none">
                                  K
                                </span>
                              </div>

                              {isSaved && (
                                <span className="px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 text-[11px] font-bold flex items-center gap-1 border border-emerald-500/30 shrink-0">
                                  <Check className="w-3 h-3 text-emerald-400" />
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 3. Variación (Cuánto subió o bajó) */}
                          <td className="py-3 px-4 text-center font-mono">
                            {(() => {
                              if (change && change.difference > 0) {
                                return (
                                  <div
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-bold"
                                    title={`Precio anterior: ${change.oldPrice.toLocaleString()} K -> Actual: ${change.price.toLocaleString()} K`}
                                  >
                                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                    <div className="text-left leading-tight">
                                      <div>+{change.difference.toLocaleString()} K</div>
                                      <div className="text-[10px] text-emerald-500/80">+{change.percentageChange > 0 ? change.percentageChange.toFixed(1) : '0'}%</div>
                                    </div>
                                  </div>
                                );
                              }
                              if (change && change.difference < 0) {
                                return (
                                  <div
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs font-bold"
                                    title={`Precio anterior: ${change.oldPrice.toLocaleString()} K -> Actual: ${change.price.toLocaleString()} K`}
                                  >
                                    <TrendingDown className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                    <div className="text-left leading-tight">
                                      <div>{change.difference.toLocaleString()} K</div>
                                      <div className="text-[10px] text-rose-500/80">{change.percentageChange.toFixed(1)}%</div>
                                    </div>
                                  </div>
                                );
                              }
                              if (change && change.difference === 0) {
                                return (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono text-slate-500 bg-slate-950/60 border border-slate-800">
                                    <Minus className="w-3 h-3 text-slate-600" /> Sin cambio
                                  </span>
                                );
                              }
                              return (
                                <span className="text-slate-600 text-[11px] font-mono">
                                  -
                                </span>
                              );
                            })()}
                          </td>

                          {/* 4. Última Actualización */}
                          <td className="py-3 px-4">
                            <div
                              className="flex items-center gap-1.5 text-slate-400 text-xs"
                              title={formatUpdatedAtLabel(item.id)}
                            >
                              <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                              <span className="font-mono text-[11px] text-slate-300">
                                {priceUpdatedAt[item.id] ? formatRelativeTime(priceUpdatedAt[item.id]) : 'Sin registro'}
                              </span>
                            </div>
                          </td>

                          {/* 5. Añadir a la Lista de Compra */}
                          <td className="py-3 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => handleAddToShoppingList(item, 1)}
                              className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-sm ${
                                isAddedCart
                                  ? 'bg-emerald-500/25 border-emerald-500/50 text-emerald-300 ring-1 ring-emerald-400/40 font-black'
                                  : 'bg-slate-950 hover:bg-emerald-500/20 border-slate-800 hover:border-emerald-500/40 text-slate-300 hover:text-emerald-300'
                              }`}
                              title="Añadir 1 unidad a la lista de compras"
                            >
                              {isAddedCart ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>¡Añadido!</span>
                                </>
                              ) : (
                                <>
                                  <ShoppingCart className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Añadir</span>
                                </>
                              )}
                            </button>
                          </td>

                          {/* 6. Historial & Recetas */}
                          <td className="py-3 px-4 text-center">
                            <div className="inline-flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => setItemForHistory(item)}
                                className="px-2.5 py-1.5 rounded-xl bg-slate-950 hover:bg-amber-500/20 border border-slate-800 hover:border-amber-500/40 text-slate-300 hover:text-amber-300 transition-all font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
                                title="Ver historial detallado de precios"
                              >
                                <History className="w-3.5 h-3.5 text-amber-400" />
                                <span>Historial</span>
                              </button>

                              {onSelectItemForRecipe && (
                                <button
                                  onClick={() => onSelectItemForRecipe(item)}
                                  className="p-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-amber-300 transition-all cursor-pointer shadow-sm"
                                  title="Ver o calcular recetas con este objeto"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Vista en Cuadrícula de Tarjetas */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
              {paginatedItems.map((item) => {
                const currentPrice = Number(marketPrices[item.id]) || 0;
                const draftVal = priceDrafts[item.id] !== undefined ? priceDrafts[item.id] : currentPrice > 0 ? String(currentPrice) : '';
                const isSaved = savedFeedbackItemId === item.id;
                const typeName = getItemTypeName(item);
                const isUsedInCrafting = recipeIngredientIds.has(item.id);
                const hasCraftRecipe = craftableItemIds.has(item.id);
                const vol = salesVolumes[item.id];
                const hasSalesData = vol && ((vol.sales24h ?? 0) > 0 || (vol.sales7d ?? 0) > 0 || (vol.sales30d ?? 0) > 0);
                const isAddedCart = Boolean(addedCartItemIds[item.id]);
                const change = priceChanges[item.id];

                return (
                  <div
                    key={item.id}
                    className={`bg-slate-900 border rounded-2xl p-3.5 transition-all flex flex-col justify-between gap-3 relative shadow-md ${
                      currentPrice > 0
                        ? 'border-amber-500/40 bg-gradient-to-b from-amber-950/20 to-slate-900'
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* Top Item Row */}
                    <div className="flex items-start gap-3">
                      <div className="w-11 h-11 rounded-xl bg-slate-950 border border-slate-800 p-1 shrink-0 flex items-center justify-center relative">
                        {BASE_RUNES_BY_ID[item.id] ? (
                          <RuneIcon rune={BASE_RUNES_BY_ID[item.id]} size="md" />
                        ) : (
                          <img
                            src={getItemIconUrl(item)}
                            alt={getItemName(item)}
                            className="max-w-full max-h-full object-contain"
                            onError={(e) => {
                              const target = e.currentTarget;
                              const fallback = getItemFallbackIconUrl(item);
                              if (target.src !== fallback) target.src = fallback;
                            }}
                          />
                        )}
                        {item.level && !BASE_RUNES_BY_ID[item.id] && (
                          <span className="absolute -bottom-1 -right-1 px-1.5 py-0.2 bg-slate-900 border border-slate-700 text-[10px] font-mono text-amber-400 rounded-md font-bold shadow">
                            Nv.{item.level}
                          </span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-1.5">
                          <h4 className="text-sm sm:text-base font-black text-white truncate group-hover:text-amber-400 transition-colors">
                            {getItemName(item)}
                          </h4>
                          {currentPrice > 0 ? (
                            <span
                              className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold shrink-0 border border-amber-500/30"
                              title={formatUpdatedAtLabel(item.id)}
                            >
                              Fijado
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-slate-950 text-slate-500 font-mono text-[10px] font-bold shrink-0 border border-slate-800">
                              Sin precio
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 text-xs text-slate-300 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-slate-300 font-bold text-xs">
                            {typeName}
                          </span>
                          {isUsedInCrafting && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold text-xs flex items-center gap-1">
                              <FlaskConical className="w-3 h-3" />
                              Ingrediente
                            </span>
                          )}
                          {hasCraftRecipe ? (
                            <span className="px-2 py-0.5 rounded-md bg-violet-500/15 border border-violet-500/30 text-violet-300 font-bold text-[10px] flex items-center gap-1">
                              <Hammer className="w-3 h-3" />
                              Crafteable
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-teal-500/10 border border-teal-500/20 text-teal-400 font-bold text-[10px] flex items-center gap-1">
                              <Package className="w-3 h-3" />
                              Recurso
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Sales Volume & Price Change Row */}
                    <div className="flex items-center justify-between gap-1.5 flex-wrap pt-1">
                      <div
                        onClick={() => setItemForSalesVolume(item)}
                        className="group/vol flex items-center gap-1.5 flex-wrap cursor-pointer px-2 py-0.5 rounded-lg hover:bg-slate-900 border border-transparent hover:border-slate-800 transition-all text-xs"
                        title="Haz clic para registrar o editar ventas en 24h, 7d y 30d"
                      >
                        {hasSalesData ? (
                          <>
                            <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-[10px] font-mono font-bold text-cyan-300">
                              24h: {vol.sales24h ?? 0}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-[10px] font-mono font-bold text-cyan-300">
                              7d: {vol.sales7d ?? 0}
                            </span>
                          </>
                        ) : (
                          <span className="text-[10px] font-mono text-slate-500 group-hover/vol:text-cyan-400">
                            + Ventas (24h/7d)
                          </span>
                        )}
                      </div>

                      {change && change.difference !== 0 && (
                        <div
                          className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                            change.difference > 0
                              ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-400'
                              : 'bg-rose-500/10 border border-rose-500/25 text-rose-400'
                          }`}
                          title={`Precio anterior: ${change.oldPrice.toLocaleString()} K -> Actual: ${change.price.toLocaleString()} K`}
                        >
                          {change.difference > 0 ? (
                            <TrendingUp className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <TrendingDown className="w-3 h-3 text-rose-400" />
                          )}
                          <span>{change.difference > 0 ? `+${change.difference.toLocaleString()}` : change.difference.toLocaleString()} K</span>
                        </div>
                      )}
                    </div>

                    {/* Price Input Controls */}
                    <div className="space-y-1.5 pt-2 border-t border-slate-800">
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={draftVal}
                            onChange={(e) => handlePriceDraftChange(item.id, e.target.value)}
                            onBlur={(e) => handlePriceUpdate(item.id, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handlePriceUpdate(item.id, (e.target as HTMLInputElement).value);
                              }
                            }}
                            placeholder="Precio en Kamas..."
                            title={formatUpdatedAtLabel(item.id)}
                            className="w-full pl-3 pr-8 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm font-mono font-black text-amber-300 placeholder-slate-600 focus:outline-none focus:border-amber-400 transition-colors"
                          />
                          <span className="absolute right-3 top-2 text-xs text-slate-400 font-bold font-mono">
                            K
                          </span>
                        </div>

                        {/* Instant Save Feedback */}
                        {isSaved && (
                          <span
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-bold flex items-center gap-1 border border-emerald-500/30 shrink-0"
                            title={formatUpdatedAtLabel(item.id)}
                          >
                            <Check className="w-3.5 h-3.5 text-emerald-400" /> Guardado
                          </span>
                        )}

                        {/* Add to Shopping List Button */}
                        <button
                          type="button"
                          onClick={() => handleAddToShoppingList(item, 1)}
                          className={`p-2 rounded-xl border transition-all shrink-0 cursor-pointer ${
                            isAddedCart
                              ? 'bg-emerald-500/25 border-emerald-500/50 text-emerald-300'
                              : 'bg-slate-950 hover:bg-emerald-500/20 border-slate-800 hover:border-emerald-500/40 text-slate-400 hover:text-emerald-300'
                          }`}
                          title="Añadir a la lista de compras"
                        >
                          {isAddedCart ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <ShoppingCart className="w-3.5 h-3.5 text-emerald-400" />}
                        </button>

                        {/* Sales Volume Button */}
                        <button
                          onClick={() => setItemForSalesVolume(item)}
                          className="p-2 rounded-xl bg-slate-950 hover:bg-sky-500/20 border border-slate-800 hover:border-sky-500/40 text-slate-400 hover:text-sky-300 transition-all shrink-0 cursor-pointer"
                          title="Registrar / editar volumen de ventas (24h, 7d, 30d)"
                        >
                          <Activity className="w-3.5 h-3.5" />
                        </button>

                        {/* Price History Button */}
                        <button
                          onClick={() => setItemForHistory(item)}
                          className="p-2 rounded-xl bg-slate-950 hover:bg-amber-500/20 border border-slate-800 hover:border-amber-500/40 text-slate-400 hover:text-amber-300 transition-all shrink-0 cursor-pointer"
                          title="Ver historial de cambios de este objeto"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Footer Info: Relative Timestamp & Recipe Link */}
                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                        <span className="flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5 text-slate-500" />
                          {priceUpdatedAt[item.id] ? formatRelativeTime(priceUpdatedAt[item.id]) : 'Sin cambios'}
                        </span>

                        {onSelectItemForRecipe && (
                          <button
                            onClick={() => onSelectItemForRecipe(item)}
                            className="text-amber-400 hover:text-amber-300 hover:underline flex items-center gap-1 font-bold cursor-pointer"
                            title="Calcular recetas con este objeto"
                          >
                            Ver Recetas <ExternalLink className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination Controls Bar */}
          {filteredItems.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shadow-md">
              <span className="text-slate-400 font-mono">
                Mostrando{' '}
                <strong className="text-white">
                  {(safeCurrentPage - 1) * ITEMS_PER_PAGE + 1}
                </strong>{' '}
                a{' '}
                <strong className="text-white">
                  {Math.min(safeCurrentPage * ITEMS_PER_PAGE, filteredItems.length)}
                </strong>{' '}
                de <strong className="text-amber-400">{filteredItems.length}</strong> Objetos
              </span>

              <div className="flex items-center gap-2">
                <button
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500/50 disabled:opacity-40 disabled:hover:border-slate-800 text-slate-300 font-bold flex items-center gap-1 transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Atrás</span>
                </button>

                <span className="px-3 font-mono text-slate-400 text-xs">
                  Página <strong className="text-amber-400">{safeCurrentPage}</strong> de{' '}
                  {totalPages}
                </span>

                <button
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500/50 disabled:opacity-40 disabled:hover:border-slate-800 text-slate-300 font-bold flex items-center gap-1 transition-all"
                >
                  <span>Siguiente</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Global Price History Modal */}
      <GlobalPriceHistoryModal
        isOpen={isGlobalHistoryOpen}
        onClose={() => setIsGlobalHistoryOpen(false)}
        onPriceChanged={() => {
          const updatedPrices = getStoredMarketPrices();
          setMarketPrices(updatedPrices);
          setPriceUpdatedAt(getStoredPriceUpdatedAt());
          void fetchLatestPriceChanges().then((changes) => {
            if (changes) setPriceChanges(changes);
          });
          const newDrafts: Record<number, string> = {};
          for (const [id, price] of Object.entries(updatedPrices)) {
            if (Number(price) > 0) newDrafts[Number(id)] = String(price);
          }
          setPriceDrafts(newDrafts);
        }}
      />

      {/* Individual Item Price History Modal */}
      <ItemPriceHistoryModal
        item={itemForHistory}
        isOpen={!!itemForHistory}
        onClose={() => setItemForHistory(null)}
        onPriceChanged={() => {
          const updatedPrices = getStoredMarketPrices();
          setMarketPrices(updatedPrices);
          setPriceUpdatedAt(getStoredPriceUpdatedAt());
          void fetchLatestPriceChanges().then((changes) => {
            if (changes) setPriceChanges(changes);
          });
          if (itemForHistory) {
            const p = updatedPrices[itemForHistory.id];
            setPriceDrafts((prev) => ({
              ...prev,
              [itemForHistory.id]: p ? String(p) : '',
            }));
          }
        }}
      />

      {/* Standalone Sniffer Sync Modal */}
      <MarketSnifferModal
        isOpen={isSnifferModalOpen}
        onClose={() => setIsSnifferModalOpen(false)}
        activeProfile={priceProfiles.find((profile) => profile.id === activePriceProfileId)}
        onPriceUpdated={() => {
          const updatedPrices = getStoredMarketPrices();
          setMarketPrices(updatedPrices);
          setPriceUpdatedAt(getStoredPriceUpdatedAt());
          void fetchLatestPriceChanges().then((changes) => {
            if (changes) setPriceChanges(changes);
          });
          const newDrafts: Record<number, string> = {};
          for (const [id, price] of Object.entries(updatedPrices)) {
            if (Number(price) > 0) newDrafts[Number(id)] = String(price);
          }
          setPriceDrafts(newDrafts);
        }}
      />

      {/* Backup & Restore Modal */}
      <BackupModal
        isOpen={isBackupModalOpen}
        onClose={() => {
          setIsBackupModalOpen(false);
          const updatedPrices = getStoredMarketPrices();
          setMarketPrices(updatedPrices);
          setPriceUpdatedAt(getStoredPriceUpdatedAt());
          setPriceProfiles(getPriceProfiles());
        }}
      />

      {/* Sales Volume Modal (24h, 7d, 30d) */}
      {itemForSalesVolume && (
        <EditSalesVolumeModal
          isOpen={!!itemForSalesVolume}
          onClose={() => setItemForSalesVolume(null)}
          itemId={itemForSalesVolume.id}
          itemName={getItemName(itemForSalesVolume)}
          itemIconUrl={getItemIconUrl(itemForSalesVolume)}
          itemLevel={itemForSalesVolume.level}
          itemType={getItemTypeName(itemForSalesVolume)}
          currentPrice={marketPrices[itemForSalesVolume.id] || 0}
          initialSalesVolume={salesVolumes[itemForSalesVolume.id]}
          onSaved={() => {
            setSalesVolumes(getStoredSalesVolumeMap());
          }}
        />
      )}
    </div>
  );
};
