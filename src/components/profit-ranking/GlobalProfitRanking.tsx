import React from "react";
import { Trophy } from "lucide-react";
import { GlobalProfitRankingProps } from "./types";
import { useGlobalProfitRanking, ITEMS_PER_PAGE } from "./useGlobalProfitRanking";
import { ProfitRankingFilters } from "./ProfitRankingFilters";
import { ProfitRankingRow } from "./ProfitRankingRow";
import { ProfitRankingPagination } from "./ProfitRankingPagination";

export const GlobalProfitRanking: React.FC<GlobalProfitRankingProps> = ({
  onSelectRecipeForCalculator,
  onSelectForCrushing,
}) => {
  const {
    currentPage,
    setCurrentPage,
    totalPages,
    searchTerm,
    setSearchTerm,
    selectedJobId,
    setSelectedJobId,
    strategyFilter,
    setStrategyFilter,
    marketCategoryFilter,
    setMarketCategoryFilter,
    salesLiquidityFilter,
    setSalesLiquidityFilter,
    filterOutliers,
    setFilterOutliers,
    minProfit,
    setMinProfit,
    minRoi,
    setMinRoi,
    maxCraftCost,
    setMaxCraftCost,
    minLevel,
    setMinLevel,
    maxLevel,
    setMaxLevel,
    sortBy,
    setSortBy,
    hasActiveFilters,
    handleResetFilters,
    filteredRankings,
    paginatedRankings,
    isUserJobsEnabled,
    priceDrafts,
    setPriceDrafts,
    priceUpdatedAt,
    savedFeedbackItemId,
    addedCartItemId,
    handlePriceSave,
    handleAddToCart,
  } = useGlobalProfitRanking();

  return (
    <div className="space-y-4">
      <ProfitRankingFilters
        selectedJobId={selectedJobId}
        setSelectedJobId={setSelectedJobId}
        strategyFilter={strategyFilter}
        setStrategyFilter={setStrategyFilter}
        marketCategoryFilter={marketCategoryFilter}
        setMarketCategoryFilter={setMarketCategoryFilter}
        salesLiquidityFilter={salesLiquidityFilter}
        setSalesLiquidityFilter={setSalesLiquidityFilter}
        filterOutliers={filterOutliers}
        setFilterOutliers={setFilterOutliers}
        hasActiveFilters={hasActiveFilters}
        handleResetFilters={handleResetFilters}
        minLevel={minLevel}
        setMinLevel={setMinLevel}
        maxLevel={maxLevel}
        setMaxLevel={setMaxLevel}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        sortBy={sortBy}
        setSortBy={setSortBy}
        minRoi={minRoi}
        setMinRoi={setMinRoi}
        minProfit={minProfit}
        setMinProfit={setMinProfit}
        maxCraftCost={maxCraftCost}
        setMaxCraftCost={setMaxCraftCost}
        filteredCount={filteredRankings.length}
        isUserJobsEnabled={isUserJobsEnabled}
      />

      {/* Global Profit Rankings Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        {filteredRankings.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Trophy className="w-12 h-12 mx-auto text-slate-600 opacity-40" />
            <p className="text-sm font-bold text-slate-300">
              No se encontraron recetas con 100% de ingredientes costeados.
            </p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Solo se listan recetas donde todos sus ingredientes tienen un precio mayor a 0 K ingresado en el Gestor de Precios o en sus fichas.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase font-mono tracking-wider text-xs">
                <tr>
                  <th className="py-3 px-3 w-12 text-center font-bold">#</th>
                  <th className="py-3 px-4 min-w-[260px] font-bold">Objeto y Oficio</th>
                  <th className="py-3 px-4 text-right w-36 sm:w-44 font-bold">Costo Crafteo</th>
                  <th className="py-3 px-4 text-right w-44 sm:w-52 font-bold">Venta HDV</th>
                  <th className="py-3 px-4 text-right w-36 sm:w-44 font-bold">Valor Runas</th>
                  <th className="py-3 px-4 text-center w-40 sm:w-48 font-bold">Mejor Ganancia</th>
                  <th className="py-3 px-4 text-center w-36 font-bold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans text-xs sm:text-sm">
                {paginatedRankings.map((entry, idx) => {
                  const absoluteIndex = (currentPage - 1) * ITEMS_PER_PAGE + idx;
                  const rank = absoluteIndex + 1;
                  const item = entry.item;
                  const isSaved = savedFeedbackItemId === item.id;
                  const isAddedCart = addedCartItemId === item.id;

                  return (
                    <ProfitRankingRow
                      key={item.id}
                      entry={entry}
                      rank={rank}
                      priceDraft={priceDrafts[item.id]}
                      onPriceDraftChange={(itemId, val) =>
                        setPriceDrafts({
                          ...priceDrafts,
                          [itemId]: val,
                        })
                      }
                      onPriceSave={handlePriceSave}
                      priceUpdatedAt={priceUpdatedAt[item.id]}
                      isSaved={isSaved}
                      isAddedCart={isAddedCart}
                      filterOutliers={filterOutliers}
                      onSelectRecipeForCalculator={onSelectRecipeForCalculator}
                      onSelectForCrushing={onSelectForCrushing}
                      onAddToCart={handleAddToCart}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {filteredRankings.length > 0 && (
          <ProfitRankingPagination
            currentPage={currentPage}
            totalPages={totalPages}
            itemsPerPage={ITEMS_PER_PAGE}
            totalItems={filteredRankings.length}
            onPageChange={setCurrentPage}
          />
        )}
      </div>
    </div>
  );
};

export default GlobalProfitRanking;
