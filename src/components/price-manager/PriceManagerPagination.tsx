import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PriceManagerPaginationProps {
  safeCurrentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
}

export const PriceManagerPagination: React.FC<PriceManagerPaginationProps> = ({
  safeCurrentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
}) => {
  if (totalItems === 0) return null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shadow-md">
      <span className="text-slate-400 font-mono">
        Mostrando{' '}
        <strong className="text-white">
          {(safeCurrentPage - 1) * itemsPerPage + 1}
        </strong>{' '}
        a{' '}
        <strong className="text-white">
          {Math.min(safeCurrentPage * itemsPerPage, totalItems)}
        </strong>{' '}
        de <strong className="text-amber-400">{totalItems}</strong> Objetos
      </span>

      <div className="flex items-center gap-2">
        <button
          disabled={safeCurrentPage <= 1}
          onClick={() => onPageChange(Math.max(1, safeCurrentPage - 1))}
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
          onClick={() => onPageChange(Math.min(totalPages, safeCurrentPage + 1))}
          className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500/50 disabled:opacity-40 disabled:hover:border-slate-800 text-slate-300 font-bold flex items-center gap-1 transition-all"
        >
          <span>Siguiente</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
