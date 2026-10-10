import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ProfitRankingPaginationProps {
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  totalItems: number;
  onPageChange: (newPage: number) => void;
}

export const ProfitRankingPagination: React.FC<ProfitRankingPaginationProps> = ({
  currentPage,
  totalPages,
  itemsPerPage,
  totalItems,
  onPageChange,
}) => {
  return (
    <div className="bg-slate-950 border-t border-slate-800 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
      <div className="text-slate-400 font-mono">
        Mostrando{" "}
        <strong className="text-white">
          {(currentPage - 1) * itemsPerPage + 1}
        </strong>{" "}
        a{" "}
        <strong className="text-white">
          {Math.min(currentPage * itemsPerPage, totalItems)}
        </strong>{" "}
        de <strong className="text-amber-400">{totalItems}</strong>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          disabled={currentPage <= 1}
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500/50 disabled:opacity-40 text-slate-300 font-bold flex items-center gap-1 transition-all"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Atrás</span>
        </button>

        <div className="flex items-center gap-1 font-mono px-2">
          <span className="text-amber-400 font-bold">{currentPage}</span>
          <span className="text-slate-600">/</span>
          <span className="text-slate-400">{totalPages}</span>
        </div>

        <button
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500/50 disabled:opacity-40 text-slate-300 font-bold flex items-center gap-1 transition-all"
        >
          <span>Siguiente</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
