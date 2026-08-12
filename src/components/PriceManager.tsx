import React, { useState, useEffect, useMemo } from 'react';
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
  Trash2,
  Filter,
  Layers,
  Hammer,
  AlertCircle,
  Database,
  ChevronLeft,
  ChevronRight,
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
  setActiveLocalPriceProfile,
  getItemName,
  getItemTypeName,
  getItemIconUrl,
  getItemFallbackIconUrl,
  initializeDatabase,
} from '../services/dofusDbService';
import { DOFUS_DB_TYPE_TO_JOB_MAP, DOFUS_DU_TYPE_TO_JOB_MAP } from '../data/jobCategoryDatabase';

type PriceFilterCategory =
  | 'all'
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

  // Reset page whenever search or category changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeCategory]);

  const [priceDrafts, setPriceDrafts] = useState<Record<number, string>>({});

  useEffect(() => {
    const hydrateState = () => {
      const storedPrices = getStoredMarketPrices();
      setItems(getImportedItems());
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

  const handlePriceUpdate = (itemId: number, rawValue: string) => {
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
  };

  // Quick increment price helper (+100, +1000, etc.)
  const handleQuickAddPrice = (itemId: number, addAmount: number) => {
    const currentPrice = Number(marketPrices[itemId]) || 0;
    const newPrice = currentPrice + addAmount;
    handlePriceUpdate(itemId, String(newPrice));
  };

  const handleClearPrice = (itemId: number) => {
    handlePriceUpdate(itemId, '0');
  };

  const handleClearAllPrices = () => {
    if (window.confirm('¿Estás seguro de reiniciar TODOS los precios de mercadillo guardados a 0?')) {
      saveAllMarketPrices({})
        .then((emptyPrices) => {
          setMarketPrices(emptyPrices);
          setPriceDrafts({});
        })
        .catch((error) => {
          console.error('No se pudieron limpiar los precios guardados:', error);
        });
    }
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

  const handleImportPricesJSON = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        if (typeof parsed === 'object' && parsed !== null) {
          saveAllMarketPrices(parsed)
            .then((updated) => {
              setMarketPrices(updated);
              const newDrafts: Record<number, string> = {};
              for (const [id, price] of Object.entries(updated)) {
                if (Number(price) > 0) newDrafts[Number(id)] = String(price);
              }
              setPriceDrafts(newDrafts);
              alert('¡Precios importados correctamente!');
            })
            .catch((error) => {
              console.error('No se pudieron importar los precios al archivo local:', error);
              alert('No se pudieron importar los precios.');
            });
        }
      } catch (err) {
        alert('Archivo JSON de precios inválido.');
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

    // 1. Search Query Filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      result = result.filter((item) => {
        const name = getItemName(item).toLowerCase();
        const typeName = getItemTypeName(item).toLowerCase();
        const idStr = String(item.id);
        return name.includes(term) || typeName.includes(term) || idStr === term;
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

    for (const item of items) {
      if (recipeIngredientIds.has(item.id) || allResourceTypesSet.has(Number(item.typeId || item.type?.id || 0))) {
        counts.craft_ingredients++;
      }
      if (matchCategory(item, 'campesino')) counts.campesino++;
      if (matchCategory(item, 'lenador')) counts.lenador++;
      if (matchCategory(item, 'alquimista')) counts.alquimista++;
      if (matchCategory(item, 'minero')) counts.minero++;
      if (matchCategory(item, 'pescador')) counts.pescador++;
      if (matchCategory(item, 'cazador')) counts.cazador++;
      if (matchCategory(item, 'ganadero')) counts.ganadero++;
      if (matchCategory(item, 'monsters')) counts.monsters++;
      if (matchCategory(item, 'equipment')) counts.equipment++;
      if (Number(marketPrices[item.id]) > 0) counts.has_price++;
      else counts.without_price++;
    }

    return counts;
  }, [items, marketPrices, recipeIngredientIds]);

  return (
    <div className="space-y-6">
      <div className="bg-[#0f0f0f] border border-neutral-800 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute -right-12 -top-12 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-amber-400 font-mono text-xs uppercase tracking-wider mb-1 font-bold">
              <Coins className="w-4 h-4" /> Precios
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Recursos y ventas
            </h2>
            <p className="text-xs text-neutral-400 mt-1">
              Perfil activo: {priceProfiles.find((profile) => profile.id === activePriceProfileId)?.name || 'General'}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 font-mono text-xs font-bold flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-amber-400" />
              {categoryCounts.has_price} Precios Fijados
            </span>

            <button
              onClick={handleExportPricesJSON}
              className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 hover:text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
              title="Exportar copia de seguridad de precios en JSON"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" /> Exportar JSON
            </button>

            <button
              onClick={handleExportDatabase}
              className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 hover:text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
              title="Descargar la base SQLite completa"
            >
              <Database className="w-3.5 h-3.5 text-amber-400" /> Exportar .db
            </button>

            <label className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 hover:text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm">
              <Upload className="w-3.5 h-3.5 text-amber-400" /> Importar JSON
              <input type="file" accept=".json" onChange={handleImportPricesJSON} className="hidden" />
            </label>

            {categoryCounts.has_price > 0 && (
              <button
                onClick={handleClearAllPrices}
                className="px-2.5 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-red-800/50 text-red-300 text-xs font-bold transition-all flex items-center gap-1"
                title="Vaciar todos los precios guardados"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-[#0f0f0f] border border-neutral-800 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_220px_auto] gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre o ID"
              className="w-full pl-10 pr-10 py-2.5 bg-[#0a0a0a] border border-neutral-800 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500 transition-colors shadow-inner font-sans"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3.5 top-3 text-xs text-neutral-500 hover:text-neutral-300 font-bold bg-neutral-800/60 px-1.5 py-0.5 rounded"
              >
                ✕
              </button>
            )}
          </div>

          <select
            value={activePriceProfileId}
            onChange={(event) => {
              void handleChangeProfile(Number(event.target.value));
            }}
            className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-neutral-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
            title="Servidor o perfil privado"
          >
            {priceProfiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-neutral-400 font-bold uppercase tracking-wider">
            <span className="flex items-center gap-1.5 text-amber-400">
              <Filter className="w-3.5 h-3.5" /> Filtros
            </span>
            <span className="text-neutral-500 font-normal normal-case">
              {filteredItems.length} / {items.length}
            </span>
          </div>

          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
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
                    className={`p-2.5 rounded-xl border text-left text-xs font-bold transition-all flex items-center justify-between gap-1.5 ${
                      isActive
                        ? `${cat.color} border-current shadow-md`
                        : 'bg-[#0a0a0a] border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-amber-400' : 'text-neutral-400'}`} />
                      <span className="truncate">{cat.label}</span>
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/40 border border-neutral-800 text-neutral-300">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Producción y uso
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setActiveCategory('equipment')}
                className={`px-3 py-1.5 rounded-lg border font-bold transition-all ${
                  activeCategory === 'equipment'
                    ? 'bg-blue-500/20 border-blue-500 text-blue-300 shadow-sm'
                    : 'bg-[#0a0a0a] border-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                Equipables ({categoryCounts.equipment})
              </button>
              <button
                onClick={() => setActiveCategory('craft_ingredients')}
                className={`px-3 py-1.5 rounded-lg border font-bold transition-all flex items-center gap-1.5 ${
                  activeCategory === 'craft_ingredients'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm'
                    : 'bg-[#0a0a0a] border-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                <Hammer className="w-3.5 h-3.5 text-amber-400" />
                Ingredientes ({categoryCounts.craft_ingredients})
              </button>
              <button
                onClick={() => setActiveCategory('monsters')}
                className={`px-3 py-1.5 rounded-lg border font-bold transition-all ${
                  activeCategory === 'monsters'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm'
                    : 'bg-[#0a0a0a] border-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                Monstruos ({categoryCounts.monsters})
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Estado
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setActiveCategory('without_price')}
                className={`px-3 py-1.5 rounded-lg border font-bold transition-all flex items-center gap-1.5 ${
                  activeCategory === 'without_price'
                    ? 'bg-rose-500/20 border-rose-500 text-rose-300 shadow-sm'
                    : 'bg-[#0a0a0a] border-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                Sin precio ({categoryCounts.without_price})
              </button>
              <button
                onClick={() => setActiveCategory('has_price')}
                className={`px-3 py-1.5 rounded-lg border font-bold transition-all flex items-center gap-1.5 ${
                  activeCategory === 'has_price'
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm'
                    : 'bg-[#0a0a0a] border-neutral-800 text-emerald-400 hover:text-white'
                }`}
              >
                <Tag className="w-3.5 h-3.5 text-emerald-400" />
                Con precio ({categoryCounts.has_price})
              </button>
              <button
                onClick={() => setActiveCategory('all')}
                className={`px-3 py-1.5 rounded-lg border font-bold transition-all ${
                  activeCategory === 'all'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm'
                    : 'bg-[#0a0a0a] border-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                Todo ({items.length})
              </button>
            </div>
          </div>
        </div>

      </div>

      {filteredItems.length === 0 ? (
        <div className="bg-[#0f0f0f] border border-neutral-800 rounded-2xl p-12 text-center text-neutral-400 space-y-3">
          <Package className="w-10 h-10 text-neutral-600 mx-auto" />
          <h3 className="text-base font-bold text-white">Sin resultados</h3>
          <p className="text-xs text-neutral-500 max-w-md mx-auto">Ajusta la búsqueda o el filtro.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {paginatedItems.map((item) => {
              const currentPrice = Number(marketPrices[item.id]) || 0;
              const draftVal = priceDrafts[item.id] !== undefined ? priceDrafts[item.id] : currentPrice > 0 ? String(currentPrice) : '';
              const isSaved = savedFeedbackItemId === item.id;
              const typeName = getItemTypeName(item);
              const isUsedInCrafting = recipeIngredientIds.has(item.id);

              return (
                <div
                  key={item.id}
                  className={`bg-[#0f0f0f] border rounded-xl p-3.5 transition-all flex flex-col justify-between gap-3 relative ${
                    currentPrice > 0
                      ? 'border-amber-500/40 bg-gradient-to-b from-amber-950/10 to-[#0f0f0f]'
                      : 'border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  {/* Top Item Row */}
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-lg bg-[#0a0a0a] border border-neutral-800 p-1 shrink-0 flex items-center justify-center relative">
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
                      {item.level && (
                        <span className="absolute -bottom-1.5 -right-1.5 px-1 py-0.2 bg-neutral-900 border border-neutral-700 text-[9px] font-mono text-neutral-300 rounded font-bold">
                          Nv.{item.level}
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="text-xs font-bold text-white truncate group-hover:text-amber-400 transition-colors">
                          {getItemName(item)}
                        </h4>
                        {currentPrice > 0 ? (
                          <span
                            className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[9px] font-bold shrink-0 border border-amber-500/30"
                            title={formatUpdatedAtLabel(item.id)}
                          >
                            Fijado
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded bg-neutral-900 text-neutral-500 font-mono text-[9px] font-medium shrink-0 border border-neutral-800">
                            Sin precio
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 mt-1 text-[10px] text-neutral-400 flex-wrap">
                        <span className="px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-300 font-medium">
                          {typeName}
                        </span>
                        {isUsedInCrafting && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 font-semibold text-[9px] flex items-center gap-0.5">
                            🧪 Ingrediente
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Price Input & Quick Adjust Controls */}
                  <div className="space-y-1.5 pt-2 border-t border-neutral-800/80">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={draftVal}
                          onChange={(e) => setPriceDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          onBlur={(e) => handlePriceUpdate(item.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handlePriceUpdate(item.id, (e.target as HTMLInputElement).value);
                            }
                          }}
                          placeholder="Precio en Kamas..."
                          title={formatUpdatedAtLabel(item.id)}
                          className="w-full pl-3 pr-8 py-1.5 bg-[#0a0a0a] border border-neutral-700 rounded-lg text-xs font-mono font-bold text-amber-400 placeholder-neutral-600 focus:outline-none focus:border-amber-500 transition-colors"
                        />
                        <span className="absolute right-2.5 top-2 text-[10px] text-neutral-500 font-bold font-mono">
                          K
                        </span>
                      </div>

                      {/* Instant Save Feedback */}
                      {isSaved && (
                        <span
                          className="px-2 py-1.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold flex items-center gap-1 border border-emerald-500/30 shrink-0"
                          title={formatUpdatedAtLabel(item.id)}
                        >
                          <Check className="w-3 h-3 text-emerald-400" /> Guardado
                        </span>
                      )}
                    </div>

                    {/* Quick Add Buttons Bar */}
                    <div className="flex items-center justify-between text-[10px] text-neutral-400 gap-1 pt-0.5">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleQuickAddPrice(item.id, 100)}
                          className="px-1.5 py-0.5 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 font-mono transition-all"
                          title="Sumar +100 Kamas"
                        >
                          +100
                        </button>
                        <button
                          onClick={() => handleQuickAddPrice(item.id, 1000)}
                          className="px-1.5 py-0.5 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 font-mono transition-all"
                          title="Sumar +1,000 Kamas"
                        >
                          +1k
                        </button>
                        <button
                          onClick={() => handleQuickAddPrice(item.id, 10000)}
                          className="px-1.5 py-0.5 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 font-mono transition-all"
                          title="Sumar +10,000 Kamas"
                        >
                          +10k
                        </button>
                        {currentPrice > 0 && (
                          <button
                            onClick={() => handleClearPrice(item.id)}
                            className="px-1.5 py-0.5 rounded bg-red-950/30 hover:bg-red-900/40 border border-red-900/40 text-red-300 transition-all"
                            title="Reiniciar precio a 0"
                          >
                            <RotateCcw className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>

                      {/* Direct jump to Recipe Calculator */}
                      {onSelectItemForRecipe && (
                        <button
                          onClick={() => onSelectItemForRecipe(item)}
                          className="text-[10px] text-amber-400/80 hover:text-amber-300 hover:underline flex items-center gap-0.5 font-medium ml-auto"
                          title="Calcular recetas con este objeto"
                        >
                          Recetas <ExternalLink className="w-2.5 h-2.5" />
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
            <div className="bg-[#0f0f0f] border border-neutral-800 rounded-xl px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shadow-md">
              <span className="text-neutral-400 font-mono">
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
                  className="px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-amber-500/50 disabled:opacity-40 disabled:hover:border-neutral-800 text-neutral-300 font-medium flex items-center gap-1 transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Atrás</span>
                </button>

                <span className="px-3 font-mono text-neutral-400 text-xs">
                  Página <strong className="text-amber-400">{safeCurrentPage}</strong> de{' '}
                  {totalPages}
                </span>

                <button
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-amber-500/50 disabled:opacity-40 disabled:hover:border-neutral-800 text-neutral-300 font-medium flex items-center gap-1 transition-all"
                >
                  <span>Siguiente</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
};
