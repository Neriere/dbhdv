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
  RotateCcw,
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
} from 'lucide-react';
import { DofusItem, MarketPriceMap } from '../types';
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
} from '../services/dofusDbService';
import { DOFUS_DB_TYPE_TO_JOB_MAP, DOFUS_DU_TYPE_TO_JOB_MAP } from '../data/jobCategoryDatabase';
import { DOFUS_BASE_RUNES, BASE_RUNES_BY_ID } from '../data/dofusRuneWeights';
import { isOmittedItem, isDofusItem } from '../data/dofusJobs';
import { RuneIcon } from './RuneIcon';
import { matchesSearchQuery } from '../utils/searchUtils';
import { GlobalPriceHistoryModal } from './GlobalPriceHistoryModal';
import { ItemPriceHistoryModal } from './ItemPriceHistoryModal';

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
  const ITEMS_PER_PAGE = 50;
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [savedFeedbackItemId, setSavedFeedbackItemId] = useState<number | null>(null);
  const [isGlobalHistoryOpen, setIsGlobalHistoryOpen] = useState<boolean>(false);
  const [itemForHistory, setItemForHistory] = useState<DofusItem | null>(null);

  // Reset page whenever search or category changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeCategory]);

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
      const baseRuneItems: DofusItem[] = DOFUS_BASE_RUNES.map((r) => ({
        id: r.id,
        name: { es: r.name, fr: r.name, en: r.name },
        level: 1,
        typeId: 78,
        type: { id: 78, name: { es: 'Runa', fr: 'Rune', en: 'Rune' } },
        iconId: r.iconId,
        description: { es: `${r.description} (Peso: ${r.unitWeight})` },
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
      setDatabaseVersion((prev) => prev + 1);

      const initialDrafts: Record<number, string> = {};
      for (const [id, price] of Object.entries(storedPrices)) {
        if (Number(price) > 0) {
          initialDrafts[Number(id)] = String(price);
        }
      }
      setPriceDrafts(initialDrafts);
    };

    initializeDatabase()
      .then(() => {
        hydrateState();
      })
      .catch((error) => {
        console.error('No se pudo inicializar la base local:', error);
      });

    const handleDbUpdate = () => {
      hydrateState();
    };
    window.addEventListener('dofus_database_updated', handleDbUpdate);

    return () => {
      window.removeEventListener('dofus_database_updated', handleDbUpdate);
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

  const handlePriceUpdate = useCallback((itemId: number, rawValue: string) => {
    if (debounceTimersRef.current[itemId]) {
      clearTimeout(debounceTimersRef.current[itemId]);
      delete debounceTimersRef.current[itemId];
    }

    const numericPrice = Math.max(0, parseInt(rawValue, 10) || 0);
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
  }, []);

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

  const handleClearPrice = (itemId: number) => {
    handlePriceUpdate(itemId, '0');
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
      return typeId === 78 || typeId === 18 || DOFUS_BASE_RUNES.some((r) => r.id === item.id);
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

    return result;
  }, [items, searchTerm, activeCategory, marketPrices, recipeIngredientIds]);

  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE) || 1;
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedItems = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
    return filteredItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredItems, safeCurrentPage]);

  // Compute live category item counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: items.length,
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

    const runeIdsSet = new Set(DOFUS_BASE_RUNES.map((r) => r.id));
    const equipTypeIdsSet = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 16, 17, 19, 82, 112, 151, 217, 271]);
    const campesinoTypes = new Set([34, 33, 37, 58, 60, 68, 46, 28, 128, 129]);
    const lenadorTypes = new Set([38, 95, 96, 98, 183, 185, 242, 12, 170]);
    const alquimistaTypes = new Set([12, 26, 35, 36, 70, 71, 79, 179, 183, 206, 228, 167, 62]);
    const mineroTypes = new Set([39, 40, 50, 51, 83, 85, 307, 308, 167, 153, 66, 91]);
    const pescadorTypes = new Set([41, 49, 134, 135, 64]);
    const cazadorTypes = new Set([63, 69, 187, 56, 59, 150]);
    const ganaderoTypes = new Set([99, 323, 326, 327]);

    for (const item of items) {
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
  }, [items, marketPrices, recipeIngredientIds]);

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
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-slate-200 focus:outline-none focus:border-amber-500"
            title="Servidor o perfil de precios"
          >
            {priceProfiles.map((profile) => (
              <option key={profile.id} value={profile.id} className="bg-slate-900 text-white">
                {profile.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase tracking-wider">
            <span className="flex items-center gap-1.5 text-amber-400">
              <Filter className="w-3.5 h-3.5" /> Categorías y Filtros
            </span>
            <span className="text-slate-400 font-mono text-[11px] font-bold">
              {filteredItems.length} / {items.length} Objetos
            </span>
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
                Todo ({items.length})
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
            {paginatedItems.map((item) => {
              const currentPrice = Number(marketPrices[item.id]) || 0;
              const draftVal = priceDrafts[item.id] !== undefined ? priceDrafts[item.id] : currentPrice > 0 ? String(currentPrice) : '';
              const isSaved = savedFeedbackItemId === item.id;
              const typeName = getItemTypeName(item);
              const isUsedInCrafting = recipeIngredientIds.has(item.id);

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
                      </div>
                    </div>
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

                      {/* Price History Button */}
                      <button
                        onClick={() => setItemForHistory(item)}
                        className="p-2 rounded-xl bg-slate-950 hover:bg-amber-500/20 border border-slate-800 hover:border-amber-500/40 text-slate-400 hover:text-amber-300 transition-all shrink-0"
                        title="Ver historial de cambios de este objeto"
                      >
                        <History className="w-3.5 h-3.5" />
                      </button>

                      {currentPrice > 0 && !isSaved && (
                        <button
                          onClick={() => handleClearPrice(item.id)}
                          className="p-2 rounded-xl bg-slate-950 hover:bg-red-950/40 border border-slate-800 hover:border-red-900/50 text-slate-400 hover:text-red-300 transition-all shrink-0"
                          title="Reiniciar precio a 0"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
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
                          className="text-amber-400 hover:text-amber-300 hover:underline flex items-center gap-1 font-bold"
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
          if (itemForHistory) {
            const p = updatedPrices[itemForHistory.id];
            setPriceDrafts((prev) => ({
              ...prev,
              [itemForHistory.id]: p ? String(p) : '',
            }));
          }
        }}
      />
    </div>
  );
};
