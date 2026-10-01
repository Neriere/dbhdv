import React, { useState, useMemo, useRef } from 'react';
import {
  TrendingUp,
  Coins,
  Package,
  Clock,
  AlertTriangle,
  CheckCircle2,
  UploadCloud,
  Trash2,
  Search,
  Filter,
  Layers,
  Store,
  Vault,
  Sparkles,
  Info,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Check,
  Copy,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { useSalesHistory } from '../../hooks/useSalesHistory';
import { KamaDisplay } from '../common/KamaDisplay';
import { SafeImage } from '../SafeImage';
import { getItemIconUrl, getItemFallbackIconUrl } from '../../services/dofusDbService';
import { copyItemNameToClipboard } from '../../utils/clipboardUtils';
import { ItemSoldStats, ActiveListingEntry, SaleEntry } from '../../services/salesHistoryService';

interface SalesAnalyticsViewProps {
  onSelectRecipeForCalculator?: (itemId: number) => void;
}

type SubTab = 'analytics' | 'active_listings' | 'raw_history' | 'manage';
type SortField = 'totalKamas' | 'totalUnitsSold' | 'unitsPerDay' | 'expiredCount' | 'name' | 'avgPrice';

export const SalesAnalyticsView: React.FC<SalesAnalyticsViewProps> = ({ onSelectRecipeForCalculator }) => {
  const {
    salesHistory,
    activeListings,
    historySummary,
    soldStats,
    activeSummary,
    importSalesHistory,
    importActiveListings,
    clearHistory,
    clearListings,
    deleteHistory,
    deleteListings,
  } = useSalesHistory();

  const [activeSubTab, setActiveSubTab] = useState<SubTab>('analytics');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterExpiredOnly, setFilterExpiredOnly] = useState(false);
  const [sortField, setSortField] = useState<SortField>('totalKamas');
  const [sortAsc, setSortAsc] = useState(false);
  const [importStatusNotice, setImportStatusNotice] = useState<string | null>(null);
  const [copiedItemId, setCopiedItemId] = useState<number | null>(null);

  const fileInputHistoryRef = useRef<HTMLInputElement>(null);
  const fileInputListingsRef = useRef<HTMLInputElement>(null);

  // File import handlers
  const handleHistoryFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const res = importSalesHistory(json);
        setImportStatusNotice(
          res.isDuplicate
            ? 'â„¹ï¸ Este archivo de historial ya habÃ­a sido importado anteriormente.'
            : `âœ… Historial importado con Ã©xito: ${res.snapshot.totalSales} registros (${res.snapshot.soldCount} vendidos, ${res.snapshot.expiredCount} caducados).`
        );
      } catch (err: any) {
        setImportStatusNotice(`âŒ Error al procesar el archivo: ${err.message || 'JSON invÃ¡lido'}`);
      }
      setTimeout(() => setImportStatusNotice(null), 5000);
      if (fileInputHistoryRef.current) fileInputHistoryRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handleListingsFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const res = importActiveListings(json);
        setImportStatusNotice(
          res.isDuplicate
            ? 'â„¹ï¸ Esta captura de listings activos ya estaba registrada.'
            : `âœ… Listings en venta importados: ${res.snapshot.totalLots} lotes en HDV por valor de ${res.snapshot.totalValue.toLocaleString('es-ES')} K.`
        );
      } catch (err: any) {
        setImportStatusNotice(`âŒ Error al procesar el archivo: ${err.message || 'JSON invÃ¡lido'}`);
      }
      setTimeout(() => setImportStatusNotice(null), 5000);
      if (fileInputListingsRef.current) fileInputListingsRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handleCopyName = (name: string, id: number) => {
    copyItemNameToClipboard(name);
    setCopiedItemId(id);
    setTimeout(() => setCopiedItemId(null), 1500);
  };

  // Filtered and sorted stats
  const filteredSoldStats = useMemo(() => {
    let list = [...soldStats];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((s) => s.name.toLowerCase().includes(q) || String(s.itemId).includes(q));
    }

    if (filterExpiredOnly) {
      list = list.filter((s) => s.expiredCount > 0);
    }

    list.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];
      if (typeof valA === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAsc ? valA - valB : valB - valA;
    });

    return list;
  }, [soldStats, searchQuery, filterExpiredOnly, sortField, sortAsc]);

  // Active listings list from latest snapshot
  const activeListingsList = useMemo(() => {
    const latest = activeListings[0];
    if (!latest) return [];
    let list = [...latest.listings];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((l) => l.name.toLowerCase().includes(q) || String(l.itemId).includes(q));
    }
    // Sort by seconds remaining ascending (soonest to expire first)
    list.sort((a, b) => {
      if (a.secondsRemaining === 0) return 1;
      if (b.secondsRemaining === 0) return -1;
      return a.secondsRemaining - b.secondsRemaining;
    });
    return list;
  }, [activeListings, searchQuery]);

  // All raw entries chronologically
  const rawHistoryEntries = useMemo(() => {
    const list: SaleEntry[] = [];
    const seen = new Set<string>();
    for (const snap of salesHistory) {
      for (const e of snap.entries) {
        const key = `${e.rawDate}|${e.itemId}|${e.price}|${e.quantity}|${e.status}`;
        if (!seen.has(key)) {
          seen.add(key);
          list.push(e);
        }
      }
    }
    let res = list;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      res = res.filter((e) => e.name.toLowerCase().includes(q) || String(e.itemId).includes(q));
    }
    if (filterExpiredOnly) {
      res = res.filter((e) => e.status === 'Sin vender');
    }
    res.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    return res;
  }, [salesHistory, searchQuery, filterExpiredOnly]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner Notice: Clarification between Vendido, Sin Vender and En Venta */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Registro y AnÃ¡lisis de Ventas
                </h2>
                <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold uppercase tracking-wider">
                  Mercadillo HDV
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Analiza quÃ© Ã­tems te generan mÃ¡s kamas, cuÃ¡les rotan rÃ¡pido y cuÃ¡les caducaron sin venderse.
              </p>
            </div>
          </div>

          {/* Import Buttons */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
            <input
              type="file"
              ref={fileInputHistoryRef}
              onChange={handleHistoryFileUpload}
              accept=".json"
              className="hidden"
            />
            <input
              type="file"
              ref={fileInputListingsRef}
              onChange={handleListingsFileUpload}
              accept=".json"
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputHistoryRef.current?.click()}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm hover:border-amber-500/50"
              title="Importar historial_ventas_capturado.json (OpciÃ³n 4 o 10 del sniffer)"
            >
              <UploadCloud className="w-3.5 h-3.5 text-amber-400" />
              <span>Importar Historial (Ventas)</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputListingsRef.current?.click()}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm hover:border-emerald-500/50"
              title="Importar listings_en_venta_capturado.json (OpciÃ³n 11 del sniffer)"
            >
              <Store className="w-3.5 h-3.5 text-emerald-400" />
              <span>Importar Listings (En Venta)</span>
            </button>
          </div>
        </div>

        {/* Feedback Alert Notice */}
        {importStatusNotice && (
          <div className="mt-3 p-2.5 rounded-xl bg-slate-950 border border-amber-500/30 text-xs text-slate-200 flex items-center justify-between animate-fadeIn">
            <span>{importStatusNotice}</span>
            <button
              type="button"
              onClick={() => setImportStatusNotice(null)}
              className="text-slate-400 hover:text-white text-xs px-2"
            >
              âœ•
            </button>
          </div>
        )}

        {/* Concept Distinctions Banner */}
        <div className="mt-3.5 grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
          <div className="bg-slate-950/70 border border-emerald-500/20 rounded-xl p-2.5 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-emerald-400">Vendido (Historial)</span>
              <p className="text-[11px] text-slate-400">
                Ventas completadas con Ã©xito en el mercadillo. Generaron kamas cobrados.
              </p>
            </div>
          </div>

          <div className="bg-slate-950/70 border border-amber-500/20 rounded-xl p-2.5 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-amber-400">Sin vender (Caducado 28d)</span>
              <p className="text-[11px] text-slate-400">
                Pasaron 28 dÃ­as sin actualizar precio en HDV. <strong className="text-slate-300">Caducaron y regresaron a tu banco</strong> (NO estÃ¡n en venta).
              </p>
            </div>
          </div>

          <div className="bg-slate-950/70 border border-blue-500/20 rounded-xl p-2.5 flex items-start gap-2">
            <Store className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-blue-400">En venta (Listings Activos)</span>
              <p className="text-[11px] text-slate-400">
                Lotes actualmente en mercadillo con tiempo restante de expiraciÃ³n activo (~2d, ~14d).
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Kamas Ganados */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-medium">Total Kamas Vendidos</span>
            <Coins className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-lg font-bold text-emerald-400">
            <KamaDisplay amount={historySummary.totalKamasSold} />
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
            <span>{historySummary.totalUnitsSold.toLocaleString('es-ES')} unidades</span>
            <span>{historySummary.distinctItemsSold} recetas</span>
          </div>
        </div>

        {/* Lotes Actualmente en Venta */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-medium">Actualmente en HDV</span>
            <Store className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-lg font-bold text-blue-300">
            <KamaDisplay amount={activeSummary.totalValue} />
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
            <span>{activeSummary.totalLots} lotes activos</span>
            {activeSummary.expiringSoonLots > 0 ? (
              <span className="text-amber-400 font-semibold">{activeSummary.expiringSoonLots} expiran &lt;24h</span>
            ) : (
              <span className="text-slate-500">Al dÃ­a</span>
            )}
          </div>
        </div>

        {/* Kamas Caducados (Sin Vender) */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-medium">Caducados (Sin Vender)</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-lg font-bold text-amber-400">
            <KamaDisplay amount={historySummary.totalKamasExpired} />
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
            <span>{historySummary.totalExpiredUnits.toLocaleString('es-ES')} devueltos a banco</span>
            <span>{historySummary.distinctItemsExpired} objetos</span>
          </div>
        </div>

        {/* Cobertura / Snapshots */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-medium">Capturas Guardadas</span>
            <Clock className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-base font-bold text-purple-300">
            {salesHistory.length} hist. / {activeListings.length} act.
          </div>
          <div className="text-[11px] text-slate-400 mt-1 truncate" title={historySummary.newestCapture || 'Sin datos'}>
            Ãšltima: {historySummary.newestCapture ? new Date(historySummary.newestCapture).toLocaleDateString() : 'Ninguna'}
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveSubTab('analytics')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'analytics'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
            <span>Â¿QuÃ© se vende y quÃ© no? ({soldStats.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('active_listings')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'active_listings'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Store className="w-3.5 h-3.5 text-blue-400" />
            <span>En Venta en HDV ({activeSummary.totalLots})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('raw_history')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'raw_history'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-purple-400" />
            <span>Registro HistÃ³rico</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('manage')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'manage'
                ? 'bg-slate-800 text-slate-200 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span>Archivos / Snapshots</span>
          </button>
        </div>

        {/* Search bar */}
        <div className="relative w-48 sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por objeto..."
            className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
            >
              âœ•
            </button>
          )}
        </div>
      </div>

      {/* SUBTAB 1: ANALYTICS ("Â¿QuÃ© se vende y quÃ© no?") */}
      {activeSubTab === 'analytics' && (
        <div className="space-y-3">
          {/* Controls / Quick Filters */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900 border border-slate-800 p-2.5 rounded-xl">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">Filtrar:</span>
              <button
                type="button"
                onClick={() => setFilterExpiredOnly(false)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  !filterExpiredOnly
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Todos los Ã­tems ({soldStats.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterExpiredOnly(true)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                  filterExpiredOnly
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                <span>Solo con caducados ("Sin vender")</span>
              </button>
            </div>

            <div className="text-xs text-slate-400">
              Mostrando <strong className="text-slate-200">{filteredSoldStats.length}</strong> de {soldStats.length} objetos
            </div>
          </div>

          {/* Table */}
          {filteredSoldStats.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-3">
              <Package className="w-10 h-10 text-slate-600 mx-auto" />
              <h3 className="text-sm font-semibold text-slate-300">No hay datos de ventas para mostrar</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Ejecuta el sniffer con la opciÃ³n <strong>[4]</strong> o <strong>[10]</strong> en <code className="text-amber-400">dofus_suite.py</code> para capturar tu historial de ventas, o importa el archivo JSON arriba.
              </p>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Objeto</th>
                      <th
                        className="py-2.5 px-3 cursor-pointer hover:text-slate-200"
                        onClick={() => toggleSort('totalUnitsSold')}
                      >
                        <div className="flex items-center gap-1">
                          <span>Uds Vendidas</span>
                          {sortField === 'totalUnitsSold' && (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                        </div>
                      </th>
                      <th
                        className="py-2.5 px-3 cursor-pointer hover:text-slate-200"
                        onClick={() => toggleSort('totalKamas')}
                      >
                        <div className="flex items-center gap-1">
                          <span>Total Ganado</span>
                          {sortField === 'totalKamas' && (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                        </div>
                      </th>
                      <th
                        className="py-2.5 px-3 cursor-pointer hover:text-slate-200"
                        onClick={() => toggleSort('avgPrice')}
                      >
                        <div className="flex items-center gap-1">
                          <span>Precio Prom.</span>
                          {sortField === 'avgPrice' && (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                        </div>
                      </th>
                      <th
                        className="py-2.5 px-3 cursor-pointer hover:text-slate-200"
                        onClick={() => toggleSort('unitsPerDay')}
                      >
                        <div className="flex items-center gap-1">
                          <span>RotaciÃ³n (Uds/dÃ­a)</span>
                          {sortField === 'unitsPerDay' && (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                        </div>
                      </th>
                      <th
                        className="py-2.5 px-3 cursor-pointer hover:text-slate-200"
                        onClick={() => toggleSort('expiredCount')}
                      >
                        <div className="flex items-center gap-1">
                          <span>Caducados (Sin Vender)</span>
                          {sortField === 'expiredCount' && (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                        </div>
                      </th>
                      <th className="py-2.5 px-3">Estado en HDV Actual</th>
                      <th className="py-2.5 px-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredSoldStats.map((item) => {
                      const activeItemInfo = activeSummary.byItemMap[item.itemId];
                      const isCopied = copiedItemId === item.itemId;

                      return (
                        <tr key={item.itemId} className="hover:bg-slate-800/40 transition-colors">
                          {/* Objeto */}
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2.5">
                              <SafeImage
                                src={getItemIconUrl(item.itemId)}
                                fallbackSrc={getItemFallbackIconUrl(item.itemId)}
                                alt={item.name}
                                className="w-7 h-7 rounded-lg object-contain bg-slate-950 p-0.5 border border-slate-800 shrink-0"
                              />
                              <div>
                                <span className="font-semibold text-slate-100 hover:text-amber-400 transition-colors">
                                  {item.name}
                                </span>
                                <div className="text-[10px] text-slate-500">ID: #{item.itemId}</div>
                              </div>
                            </div>
                          </td>

                          {/* Uds Vendidas */}
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-white">{item.totalUnitsSold.toLocaleString('es-ES')}</span>
                            <span className="text-[10px] text-slate-500 block">({item.transactionCount} ventas)</span>
                          </td>

                          {/* Total Ganado */}
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-emerald-400">
                              <KamaDisplay amount={item.totalKamas} />
                            </span>
                          </td>

                          {/* Precio Promedio */}
                          <td className="py-2.5 px-3 text-slate-300">
                            <KamaDisplay amount={item.avgPrice} />
                            <span className="text-[10px] text-slate-500 block">
                              MÃ­n: {item.minPrice.toLocaleString('es-ES')} | MÃ¡x: {item.maxPrice.toLocaleString('es-ES')}
                            </span>
                          </td>

                          {/* RotaciÃ³n */}
                          <td className="py-2.5 px-3">
                            <span className={`font-semibold ${
                              item.unitsPerDay >= 5
                                ? 'text-emerald-400'
                                : item.unitsPerDay >= 1
                                ? 'text-amber-400'
                                : 'text-slate-400'
                            }`}>
                              ~{item.unitsPerDay} / dÃ­a
                            </span>
                            {item.lastSoldAt && (
                              <span className="text-[10px] text-slate-500 block truncate" title={item.lastSoldAt}>
                                Ãšltima: {item.lastSoldAt.split('T')[0] || item.lastSoldAt}
                              </span>
                            )}
                          </td>

                          {/* Caducados ("Sin vender" devueltos a banco) */}
                          <td className="py-2.5 px-3">
                            {item.expiredCount > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[11px] font-semibold" title="Ãtems que estuvieron 28 dÃ­as sin actualizar y regresaron al banco">
                                <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                                <span>{item.expiredCount} caducados (banco)</span>
                              </span>
                            ) : (
                              <span className="text-slate-500 text-[11px]">0 caducados</span>
                            )}
                          </td>

                          {/* Estado en HDV Actual */}
                          <td className="py-2.5 px-3">
                            {activeItemInfo ? (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30 text-[11px] font-medium">
                                  <Store className="w-3 h-3 text-blue-400" />
                                  <span>{activeItemInfo.totalQty} uds en HDV</span>
                                </span>
                                <span className="text-[10px] text-slate-400 block">
                                  Expira en: <strong className="text-slate-200">{activeItemInfo.timeLabel}</strong>
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-500 text-[11px]">No listado en HDV</span>
                            )}
                          </td>

                          {/* Acciones */}
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleCopyName(item.name, item.itemId)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                                title="Copiar nombre para buscar en Dofus"
                              >
                                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>

                              {onSelectRecipeForCalculator && (
                                <button
                                  type="button"
                                  onClick={() => onSelectRecipeForCalculator(item.itemId)}
                                  className="p-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 transition-colors"
                                  title="Ver receta / simular crafteo"
                                >
                                  <Sparkles className="w-3.5 h-3.5" />
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
          )}
        </div>
      )}

      {/* SUBTAB 2: ACTIVE LISTINGS IN HDV */}
      {activeSubTab === 'active_listings' && (
        <div className="space-y-3">
          {activeListingsList.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-3">
              <Store className="w-10 h-10 text-slate-600 mx-auto" />
              <h3 className="text-sm font-semibold text-slate-300">No hay lotes en venta registrados</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Para capturar lo que tienes actualmente en venta, abre el mercadillo en Dofus, ve a la pestaÃ±a <strong>"VENTA"</strong> y ejecuta la opciÃ³n <strong>[11]</strong> en <code className="text-emerald-400">dofus_suite.py</code>.
              </p>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
              <div className="px-4 py-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-white">Lotes Actualmente Puestos en Venta en Mercadillo</h3>
                  <span className="text-[11px] text-slate-400">
                    Captura del {activeListings[0]?.capturedAt || 'reciente'} â€¢ {activeListingsList.length} lotes listados
                  </span>
                </div>
                <div className="text-xs font-bold text-blue-300">
                  Total en mercadillo: <KamaDisplay amount={activeSummary.totalValue} />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Objeto</th>
                      <th className="py-2.5 px-3">Lote (Uds)</th>
                      <th className="py-2.5 px-3">Precio Lote</th>
                      <th className="py-2.5 px-3">Precio Unitario</th>
                      <th className="py-2.5 px-3">Tiempo Restante</th>
                      <th className="py-2.5 px-3">Fecha LÃ­mite</th>
                      <th className="py-2.5 px-3 text-right">AcciÃ³n</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {activeListingsList.map((entry, idx) => {
                      const isExpiringSoon = entry.secondsRemaining > 0 && entry.secondsRemaining <= 86400;
                      const unitPrice = Math.round(entry.price / Math.max(1, entry.quantity));
                      const isCopied = copiedItemId === entry.itemId;

                      return (
                        <tr key={`${entry.itemId}-${idx}`} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2.5">
                              <SafeImage
                                src={getItemIconUrl(entry.itemId)}
                                fallbackSrc={getItemFallbackIconUrl(entry.itemId)}
                                alt={entry.name}
                                className="w-7 h-7 rounded-lg object-contain bg-slate-950 p-0.5 border border-slate-800 shrink-0"
                              />
                              <div>
                                <span className="font-semibold text-slate-100">{entry.name}</span>
                                <div className="text-[10px] text-slate-500">ID: #{entry.itemId}</div>
                              </div>
                            </div>
                          </td>

                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700 font-bold">
                              {entry.quantity}x
                            </span>
                          </td>

                          <td className="py-2.5 px-3 font-semibold text-blue-300">
                            <KamaDisplay amount={entry.price} />
                          </td>

                          <td className="py-2.5 px-3 text-slate-300">
                            <KamaDisplay amount={unitPrice} /> / u
                          </td>

                          <td className="py-2.5 px-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                              isExpiringSoon
                                ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30 animate-pulse'
                                : 'bg-slate-800 text-slate-300 border border-slate-700'
                            }`}>
                              <Clock className="w-3 h-3" />
                              <span>{entry.timeLabel}</span>
                            </span>
                          </td>

                          <td className="py-2.5 px-3 text-slate-400">
                            {entry.expiresAt ? entry.expiresAt : 'â€”'}
                          </td>

                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleCopyName(entry.name, entry.itemId)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                              title="Copiar nombre"
                            >
                              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 3: RAW CHRONOLOGICAL SALES & EXPIRED */}
      {activeSubTab === 'raw_history' && (
        <div className="space-y-3">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <div className="px-4 py-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-white">Registro CronolÃ³gico de Transacciones</h3>
                <span className="text-[11px] text-slate-400">
                  Mostrando {rawHistoryEntries.length} transacciones registradas
                </span>
              </div>
            </div>

            <div className="max-h-[500px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-800 sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3">Fecha</th>
                    <th className="py-2.5 px-3">Estado</th>
                    <th className="py-2.5 px-3">Objeto</th>
                    <th className="py-2.5 px-3">Cantidad</th>
                    <th className="py-2.5 px-3">Precio Unitario</th>
                    <th className="py-2.5 px-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {rawHistoryEntries.map((e, idx) => {
                    const isSold = e.status === 'Vendido';
                    const total = e.price * e.quantity;

                    return (
                      <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                          {e.date || e.rawDate}
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {isSold ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold uppercase">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Vendido</span>
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold uppercase"
                              title="CaducÃ³ tras 28 dÃ­as sin actualizar precio y regresÃ³ al banco"
                            >
                              <AlertTriangle className="w-3 h-3" />
                              <span>Sin vender (Banco)</span>
                            </span>
                          )}
                        </td>

                        <td className="py-2.5 px-3">
                          <span className="font-semibold text-slate-200">{e.name}</span>
                          <span className="text-[10px] text-slate-500 ml-1.5">#{e.itemId}</span>
                        </td>

                        <td className="py-2.5 px-3 font-medium text-slate-300">
                          {e.quantity}x
                        </td>

                        <td className="py-2.5 px-3 text-slate-300">
                          <KamaDisplay amount={e.price} />
                        </td>

                        <td className="py-2.5 px-3 text-right font-bold">
                          <span className={isSold ? 'text-emerald-400' : 'text-amber-400'}>
                            <KamaDisplay amount={total} />
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 4: MANAGE SNAPSHOTS */}
      {activeSubTab === 'manage' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Historial Snapshots */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-bold text-white">Snapshots de Historial ({salesHistory.length})</h3>
              </div>
              {salesHistory.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Â¿Deseas borrar todo el historial de ventas guardado?')) {
                      clearHistory();
                    }
                  }}
                  className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Borrar todo</span>
                </button>
              )}
            </div>

            {salesHistory.length === 0 ? (
              <p className="text-xs text-slate-500">No hay snapshots de historial importados.</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {salesHistory.map((s) => (
                  <div key={s.id} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold text-slate-200">
                        {new Date(s.capturedAt).toLocaleString()}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {s.soldCount} vendidos (<KamaDisplay amount={s.soldKamas} />) â€¢ {s.expiredCount} caducados
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteHistory(s.id)}
                      className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                      title="Eliminar este snapshot"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Listings Snapshots */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-blue-400" />
                <h3 className="text-xs font-bold text-white">Snapshots de Listings Activos ({activeListings.length})</h3>
              </div>
              {activeListings.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Â¿Deseas borrar todos los listings activos guardados?')) {
                      clearListings();
                    }
                  }}
                  className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Borrar todo</span>
                </button>
              )}
            </div>

            {activeListings.length === 0 ? (
              <p className="text-xs text-slate-500">No hay snapshots de listings activos importados.</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {activeListings.map((s) => (
                  <div key={s.id} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold text-slate-200">
                        {new Date(s.capturedAt).toLocaleString()}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {s.totalLots} lotes â€¢ Valor: <KamaDisplay amount={s.totalValue} />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteListings(s.id)}
                      className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                      title="Eliminar este snapshot"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

