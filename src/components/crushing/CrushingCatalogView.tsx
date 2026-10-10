import React from 'react';
import { Briefcase, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { CraftableItem } from '../../services/dofusDbService';
import {
  DateFilterOption,
  SortOption,
  StatFilterDef,
  ProcessedCatalogItem,
} from './types';
import { CrushingCatalogFilters } from './CrushingCatalogFilters';
import { CrushingCatalogCard } from './CrushingCatalogCard';

interface CrushingCatalogViewProps {
  // Filter state & handlers
  selectedSlots: string[];
  onToggleSlot: (slotId: string) => void;
  minLevel: number | '';
  setMinLevel: (val: number | '') => void;
  maxLevel: number | '';
  setMaxLevel: (val: number | '') => void;
  minCoeff: number | '';
  setMinCoeff: (val: number | '') => void;
  maxCoeff: number | '';
  setMaxCoeff: (val: number | '') => void;
  dateFilter: DateFilterOption;
  setDateFilter: (df: DateFilterOption) => void;
  isStatsFilterOpen: boolean;
  setIsStatsFilterOpen: (open: boolean) => void;
  selectedStatFilterIds: string[];
  onToggleStatFilter: (stat: StatFilterDef) => void;
  onClearAllFilters: () => void;
  onClearStatsOnly: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  sortBy: SortOption;
  setSortBy: (sb: SortOption) => void;
  currentPage: number;
  setCurrentPage: (page: number | ((prev: number) => number)) => void;

  // Catalog items
  isUserJobsEnabled: boolean;
  processedCatalogItems: ProcessedCatalogItem[];
  paginatedCatalogItems: ProcessedCatalogItem[];
  totalPages: number;
  onOpenDetail: (item: CraftableItem) => void;
}

export const CrushingCatalogView: React.FC<CrushingCatalogViewProps> = ({
  selectedSlots,
  onToggleSlot,
  minLevel,
  setMinLevel,
  maxLevel,
  setMaxLevel,
  minCoeff,
  setMinCoeff,
  maxCoeff,
  setMaxCoeff,
  dateFilter,
  setDateFilter,
  isStatsFilterOpen,
  setIsStatsFilterOpen,
  selectedStatFilterIds,
  onToggleStatFilter,
  onClearAllFilters,
  onClearStatsOnly,
  searchQuery,
  setSearchQuery,
  sortBy,
  setSortBy,
  currentPage,
  setCurrentPage,
  isUserJobsEnabled,
  processedCatalogItems,
  paginatedCatalogItems,
  totalPages,
  onOpenDetail,
}) => {
  return (
    <div className="space-y-4">
      {/* Main Filter Control Box */}
      <CrushingCatalogFilters
        selectedSlots={selectedSlots}
        onToggleSlot={onToggleSlot}
        minLevel={minLevel}
        setMinLevel={setMinLevel}
        maxLevel={maxLevel}
        setMaxLevel={setMaxLevel}
        minCoeff={minCoeff}
        setMinCoeff={setMinCoeff}
        maxCoeff={maxCoeff}
        setMaxCoeff={setMaxCoeff}
        dateFilter={dateFilter}
        setDateFilter={setDateFilter}
        isStatsFilterOpen={isStatsFilterOpen}
        setIsStatsFilterOpen={setIsStatsFilterOpen}
        selectedStatFilterIds={selectedStatFilterIds}
        onToggleStatFilter={onToggleStatFilter}
        onClearAllFilters={onClearAllFilters}
        onClearStatsOnly={onClearStatsOnly}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        sortBy={sortBy}
        setSortBy={setSortBy}
        setCurrentPage={setCurrentPage}
      />

      {/* User Jobs Global Filter Notice */}
      {isUserJobsEnabled && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs shadow-sm animate-fade-in">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
              <Briefcase className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <span className="truncate">
              <strong>Filtro global de oficios activo:</strong> Mostrando únicamente equipables que puedes craftear o magear según tus niveles de oficio.
            </span>
          </div>
          <span className="text-[11px] font-mono text-emerald-400/80 shrink-0 font-bold">
            {processedCatalogItems.length} equipables disponibles
          </span>
        </div>
      )}

      {/* Results Summary Bar */}
      <div className="flex items-center justify-between text-sm text-slate-400 px-1 font-medium">
        <span>
          Mostrando <strong className="text-slate-200">{paginatedCatalogItems.length}</strong> de <strong className="text-slate-200">{processedCatalogItems.length}</strong> equipables
        </span>
        <span>
          Página <strong className="text-slate-200">{currentPage}</strong> de <strong className="text-slate-200">{totalPages}</strong>
        </span>
      </div>

      {/* Catalog Grid Cards */}
      {paginatedCatalogItems.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
          <Sparkles className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-lg font-bold text-white">No se encontraron equipables</h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            No hay objetos que coincidan con los filtros seleccionados (oficio, nivel, runa o fecha de registro).
          </p>
          <button
            onClick={onClearAllFilters}
            className="px-5 py-2.5 bg-purple-600 text-white font-black rounded-xl text-sm hover:bg-purple-500 transition-colors inline-block shadow-lg"
          >
            Limpiar Filtros
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {paginatedCatalogItems.map((entry) => (
            <CrushingCatalogCard
              key={entry.item.id}
              entry={entry}
              onOpenDetail={onOpenDetail}
            />
          ))}
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
  );
};
