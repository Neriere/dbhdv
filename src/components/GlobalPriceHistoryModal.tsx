import React, { useEffect, useState, useMemo } from 'react';
import {
  X,
  History,
  TrendingUp,
  TrendingDown,
  RotateCcw,
  Search,
  Calendar,
  Filter,
  ArrowRight,
  Loader2,
  AlertCircle,
  Trash2,
  RefreshCw,
  Coins,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';
import { PriceHistoryEntry } from '../types';
import {
  fetchPriceHistory,
  revertPriceHistory,
  clearPriceHistoryApi,
  formatRelativeTime,
  getItemIconUrl,
  getItemFallbackIconUrl,
} from '../services/dofusDbService';

interface GlobalPriceHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPriceChanged?: () => void;
}

export const GlobalPriceHistoryModal: React.FC<GlobalPriceHistoryModalProps> = ({
  isOpen,
  onClose,
  onPriceChanged,
}) => {
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<PriceHistoryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'increased' | 'decreased'>('all');
  const [page, setPage] = useState(1);
  const [revertingId, setRevertingId] = useState<number | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const PAGE_SIZE = 40;

  const loadData = async (currentPage = 1, currentFilter = filterType, search = searchTerm) => {
    setLoading(true);
    try {
      const res = await fetchPriceHistory({
        limit: PAGE_SIZE,
        offset: (currentPage - 1) * PAGE_SIZE,
        filter: currentFilter,
        search: search.trim() || undefined,
      });
      setEntries(res.entries || []);
      setTotal(res.total || 0);
    } catch (err) {
      console.error('Error fetching global price history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData(page, filterType, searchTerm);
    }
  }, [isOpen, page, filterType]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadData(1, filterType, searchTerm);
  };

  const handleRevert = async (entry: PriceHistoryEntry) => {
    if (revertingId) return;
    try {
      setRevertingId(entry.id);
      await revertPriceHistory(entry.id);
      setSuccessToast(`Precio de ${entry.itemName} revertido a ${entry.oldPrice.toLocaleString('es-ES')} K`);
      setTimeout(() => setSuccessToast(null), 3000);
      await loadData(page, filterType, searchTerm);
      if (onPriceChanged) onPriceChanged();
    } catch (err) {
      console.error('Error al revertir precio:', err);
      alert('No se pudo revertir el precio.');
    } finally {
      setRevertingId(null);
    }
  };

  const handleClearHistory = async () => {
    if (!window.confirm('¿Seguro que deseas vaciar el historial de cambios de precios del perfil activo? Esta acción no borrará los precios actuales.')) {
      return;
    }
    try {
      setLoading(true);
      await clearPriceHistoryApi();
      await loadData(1, filterType, searchTerm);
      setSuccessToast('Historial de precios vaciado.');
      setTimeout(() => setSuccessToast(null), 3000);
    } catch (err) {
      console.error('Error clearing history:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-5 animate-in fade-in duration-200">
      <div
        className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white">
                  Historial de Precios & Cambios
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono text-xs font-bold border border-amber-500/30">
                  {total} registros
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Seguimiento cronológico detallado de todas las modificaciones de precios en el servidor
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadData(page, filterType, searchTerm)}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-colors"
              title="Refrescar historial"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Success Toast */}
        {successToast && (
          <div className="bg-emerald-500/20 border-b border-emerald-500/30 px-5 py-2 text-xs font-bold text-emerald-300 flex items-center gap-2 animate-in slide-in-from-top-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successToast}</span>
          </div>
        )}

        {/* Toolbar & Filters */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-950/40 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          {/* Search form */}
          <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar objeto por nombre o ID..."
              className="w-full pl-9 pr-8 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  loadData(1, filterType, '');
                }}
                className="absolute right-2.5 top-2 text-slate-500 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </form>

          {/* Quick Filter Buttons */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto justify-start sm:justify-end overflow-x-auto">
            <button
              onClick={() => {
                setFilterType('all');
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shrink-0 ${
                filterType === 'all'
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => {
                setFilterType('increased');
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                filterType === 'increased'
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                  : 'bg-slate-950 border-slate-800 text-emerald-400/80 hover:text-white'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              Subidas (+)
            </button>
            <button
              onClick={() => {
                setFilterType('decreased');
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                filterType === 'decreased'
                  ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                  : 'bg-slate-950 border-slate-800 text-rose-400/80 hover:text-white'
              }`}
            >
              <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
              Bajadas (-)
            </button>
          </div>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5">
          {loading && entries.length === 0 ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
              <span className="text-xs font-semibold">Cargando historial de precios...</span>
            </div>
          ) : entries.length === 0 ? (
            <div className="py-20 text-center text-slate-400 space-y-3 bg-slate-950/40 rounded-2xl border border-slate-800/80 p-8">
              <History className="w-10 h-10 text-slate-600 mx-auto" />
              <h4 className="text-base font-bold text-white">Sin registros en el historial</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Los cambios de precios que guardes en el Gestor de Precios o importes quedarán registrados automáticamente aquí.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {entries.map((entry) => {
                const isUp = entry.difference > 0;
                const isDown = entry.difference < 0;
                const isReverting = revertingId === entry.id;

                const dummyItem = {
                  id: entry.itemId,
                  iconId: entry.itemIconId,
                  name: { es: entry.itemName || `Objeto #${entry.itemId}` },
                } as any;

                return (
                  <div
                    key={entry.id}
                    className="bg-slate-950 border border-slate-800/80 hover:border-slate-700 rounded-2xl p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors shadow-sm"
                  >
                    {/* Item Info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 p-1 shrink-0 flex items-center justify-center relative">
                        <img
                          src={getItemIconUrl(dummyItem)}
                          alt={entry.itemName || 'Objeto'}
                          className="max-w-full max-h-full object-contain"
                          onError={(e) => {
                            const target = e.currentTarget;
                            const fallback = getItemFallbackIconUrl(dummyItem);
                            if (target.src !== fallback) target.src = fallback;
                          }}
                        />
                        {entry.itemLevel && (
                          <span className="absolute -bottom-1 -right-1 px-1 py-0.2 bg-slate-900 border border-slate-700 text-[9px] font-mono text-amber-400 rounded font-bold shadow">
                            {entry.itemLevel}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-black text-white truncate max-w-[200px] sm:max-w-[260px]">
                            {entry.itemName}
                          </h4>
                          {entry.itemTypeName && (
                            <span className="px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-[10px] text-slate-400 font-bold">
                              {entry.itemTypeName}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                          <span className="font-medium text-slate-400">{formatRelativeTime(entry.timestamp)}</span>
                          <span>•</span>
                          <span>
                            {new Date(entry.timestamp).toLocaleDateString('es-ES', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          {entry.source && entry.source !== 'manual' && (
                            <>
                              <span>•</span>
                              <span className="capitalize px-1.5 py-0.2 bg-slate-900 rounded text-[10px] text-slate-400 border border-slate-800">
                                {entry.source}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Price Difference & Action */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 pl-13 sm:pl-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-900">
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <div className="flex items-center gap-1.5 font-mono text-xs">
                            <span className="text-slate-400">
                              {entry.oldPrice.toLocaleString('es-ES')} K
                            </span>
                            <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />
                            <strong className="text-sm font-black text-amber-300">
                              {entry.price.toLocaleString('es-ES')} K
                            </strong>
                          </div>

                          {entry.difference !== 0 ? (
                            <div className="flex justify-end mt-0.5">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                                  isUp
                                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                }`}
                              >
                                {isUp ? '+' : ''}
                                {entry.difference.toLocaleString('es-ES')} K ({isUp ? '+' : ''}
                                {entry.percentageChange}%)
                              </span>
                            </div>
                          ) : (
                            <div className="text-[10px] text-slate-500 font-mono">
                              Precio inicial registrado
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Revert Action */}
                      {entry.oldPrice > 0 && entry.price !== entry.oldPrice && (
                        <button
                          disabled={isReverting}
                          onClick={() => handleRevert(entry)}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-amber-500/20 border border-slate-800 hover:border-amber-500/40 text-slate-400 hover:text-amber-300 text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 disabled:opacity-50"
                          title={`Revertir precio a ${entry.oldPrice.toLocaleString('es-ES')} K`}
                        >
                          {isReverting ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                          ) : (
                            <RotateCcw className="w-3.5 h-3.5" />
                          )}
                          <span className="hidden md:inline">Revertir</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer with Pagination and Clear */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/90 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={handleClearHistory}
              disabled={entries.length === 0}
              className="text-slate-500 hover:text-rose-400 disabled:opacity-40 flex items-center gap-1.5 transition-colors font-bold"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Vaciar Historial</span>
            </button>
          </div>

          {/* Pagination */}
          {total > PAGE_SIZE && (
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-amber-500/50 disabled:opacity-40 text-slate-300 transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="font-mono text-slate-400 text-xs px-2">
                Página <strong className="text-amber-400">{page}</strong> de {totalPages}
              </span>

              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-amber-500/50 disabled:opacity-40 text-slate-300 transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
