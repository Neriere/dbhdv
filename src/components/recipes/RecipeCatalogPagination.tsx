import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface RecipeCatalogPaginationProps {
  safeCurrentPage: number;
  totalPages: number;
  itemsPerPage: number;
  filteredItemsCount: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (count: number) => void;
}

export const RecipeCatalogPagination: React.FC<
  RecipeCatalogPaginationProps
> = ({
  safeCurrentPage,
  totalPages,
  itemsPerPage,
  filteredItemsCount,
  onPageChange,
  onItemsPerPageChange,
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shadow-md">
      <div className="flex items-center gap-3">
        <span className="text-slate-400 font-mono">
          Mostrando{' '}
          <strong className="text-white">
            {(safeCurrentPage - 1) * itemsPerPage + 1}
          </strong>{' '}
          a{' '}
          <strong className="text-white">
            {Math.min(safeCurrentPage * itemsPerPage, filteredItemsCount)}
          </strong>{' '}
          de <strong className="text-amber-400">{filteredItemsCount}</strong>{' '}
          Objetos
        </span>

        <div className="flex items-center gap-1.5 pl-2 border-l border-slate-800">
          <span className="text-slate-500 text-[11px] font-medium hidden sm:inline">
            Por página:
          </span>
          <select
            value={itemsPerPage}
            onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
            aria-label="Objetos por página"
            className="bg-slate-950 text-slate-300 border border-slate-800 hover:border-slate-700 rounded-lg px-2 py-1 text-xs font-bold font-mono outline-none cursor-pointer"
          >
            <option value={24}>24</option>
            <option value={48}>48</option>
            <option value={96}>96</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={safeCurrentPage <= 1}
          onClick={() => onPageChange(Math.max(1, safeCurrentPage - 1))}
          className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500/50 disabled:opacity-40 disabled:hover:border-slate-800 text-slate-300 font-bold flex items-center gap-1 transition-all cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Atrás</span>
        </button>

        <span className="px-3 font-mono text-slate-400 text-xs">
          Página <strong className="text-amber-400">{safeCurrentPage}</strong> de{' '}
          {totalPages}
        </span>

        <button
          type="button"
          disabled={safeCurrentPage >= totalPages}
          onClick={() =>
            onPageChange(Math.min(totalPages, safeCurrentPage + 1))
          }
          className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500/50 disabled:opacity-40 disabled:hover:border-slate-800 text-slate-300 font-bold flex items-center gap-1 transition-all cursor-pointer"
        >
          <span>Siguiente</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
