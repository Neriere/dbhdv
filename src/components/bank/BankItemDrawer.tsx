import React, { useState, useMemo } from "react";
import {
  Vault,
  Search,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Download,
  Upload,
  Plus,
} from "lucide-react";
import { BankInventoryItem, DofusItem, MarketPriceMap } from "../../types";
import {
  getItemIconUrl,
  getItemName,
  getStoredItemPrice,
  searchAllItems,
} from "../../services/dofusDbService";
import { SafeImage } from "../SafeImage";

interface BankItemDrawerProps {
  bankItems: BankInventoryItem[];
  marketPrices: MarketPriceMap;
  onUpdateQuantity: (itemId: number, quantity: number) => void;
  onRemoveItem: (itemId: number, name: string) => void;
  onAddCustomItem: (item: DofusItem, quantity: number) => void;
  onExportBank: () => void;
  onImportBank: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearBank: () => void;
  onSearchRecipesWithItem: (itemName: string) => void;
}

export const BankItemDrawer: React.FC<BankItemDrawerProps> = ({
  bankItems,
  marketPrices,
  onUpdateQuantity,
  onRemoveItem,
  onAddCustomItem,
  onExportBank,
  onImportBank,
  onClearBank,
  onSearchRecipesWithItem,
}) => {
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventorySort, setInventorySort] = useState<"value" | "quantity" | "name" | "recent">("value");
  const [inventoryPage, setInventoryPage] = useState<number>(1);
  const inventoryPageSize = 24;

  // Add Item to Bank Sub-State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<DofusItem[]>([]);
  const [selectedAddItem, setSelectedAddItem] = useState<DofusItem | null>(null);
  const [addQuantity, setAddQuantity] = useState<number>(100);

  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    const results = searchAllItems(q, 12);
    setSearchResults(results);
  };

  const handleDeposit = () => {
    if (selectedAddItem && addQuantity > 0) {
      onAddCustomItem(selectedAddItem, addQuantity);
      setSelectedAddItem(null);
      setSearchQuery("");
      setSearchResults([]);
    }
  };

  const filteredBankInventory = useMemo(() => {
    return bankItems
      .filter((item) => {
        if (!inventorySearch.trim()) return true;
        const name = getItemName(item.item || { id: item.itemId });
        return name.toLowerCase().includes(inventorySearch.toLowerCase());
      })
      .sort((a, b) => {
        const itemA = a.item || { id: a.itemId };
        const itemB = b.item || { id: b.itemId };
        const nameA = getItemName(itemA);
        const nameB = getItemName(itemB);

        const priceA = marketPrices[a.itemId] || getStoredItemPrice(a.itemId) || 0;
        const priceB = marketPrices[b.itemId] || getStoredItemPrice(b.itemId) || 0;
        const valA = a.quantity * priceA;
        const valB = b.quantity * priceB;

        if (inventorySort === "value") return valB - valA;
        if (inventorySort === "quantity") return b.quantity - a.quantity;
        if (inventorySort === "name") return nameA.localeCompare(nameB);
        if (inventorySort === "recent") return (b.addedAt || 0) - (a.addedAt || 0);
        return 0;
      });
  }, [bankItems, inventorySearch, inventorySort, marketPrices]);

  const totalInventoryPages = Math.max(1, Math.ceil(filteredBankInventory.length / inventoryPageSize));
  const safeInventoryPage = Math.min(Math.max(1, inventoryPage), totalInventoryPages);

  const paginatedInventory = useMemo(() => {
    const start = (safeInventoryPage - 1) * inventoryPageSize;
    return filteredBankInventory.slice(start, start + inventoryPageSize);
  }, [filteredBankInventory, safeInventoryPage, inventoryPageSize]);

  return (
    <div className="space-y-4">
      {/* Add Item to Bank Box */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
        <h3 className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <Plus className="w-4 h-4 text-amber-400" />
          Depositar Recurso en el Banco
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <div className="md:col-span-6 relative">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar recurso por nombre o ID..."
                value={selectedAddItem ? getItemName(selectedAddItem) : searchQuery}
                onChange={(e) => {
                  setSelectedAddItem(null);
                  handleSearchChange(e.target.value);
                }}
                className="w-full pl-10 pr-20 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
              {selectedAddItem && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAddItem(null);
                    setSearchQuery("");
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-200 bg-slate-800 px-2 py-0.5 rounded cursor-pointer"
                >
                  Cambiar
                </button>
              )}
            </div>

            {!selectedAddItem && searchResults.length > 0 && (
              <div className="absolute left-0 right-0 mt-1.5 max-h-56 overflow-y-auto bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-30 divide-y divide-slate-800">
                {searchResults.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      setSelectedAddItem(item);
                      setSearchResults([]);
                    }}
                    className="flex items-center gap-3 p-2 hover:bg-slate-800 cursor-pointer transition-colors text-xs"
                  >
                    <div className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-700 flex items-center justify-center p-1 shrink-0">
                      <SafeImage
                        src={getItemIconUrl(item.iconId || item.id)}
                        alt={getItemName(item)}
                        className="w-6 h-6 object-contain"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-100 truncate">
                        {getItemName(item)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Nivel {item.level} {item.type?.name?.es ? `• ${item.type.name.es}` : ""}
                      </div>
                    </div>
                    <div className="font-mono text-amber-400 font-bold">
                      {(marketPrices[item.id] || getStoredItemPrice(item.id) || 0).toLocaleString()} K
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="md:col-span-4 flex items-center gap-2">
            <input
              type="number"
              min="1"
              max="999999"
              value={addQuantity}
              onChange={(e) => setAddQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-24 px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono text-slate-100 focus:outline-none focus:border-amber-500"
              placeholder="Cantidad"
            />
            <div className="flex items-center gap-1">
              {[10, 100, 500, 1000].map((preset) => (
                <button
                  type="button"
                  key={preset}
                  onClick={() => setAddQuantity(preset)}
                  className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-bold text-slate-300 hover:text-white cursor-pointer"
                >
                  +{preset}
                </button>
              ))}
            </div>
          </div>

          <div className="md:col-span-2">
            <button
              type="button"
              onClick={handleDeposit}
              disabled={!selectedAddItem}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-slate-950 font-bold text-xs shadow-md transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Guardar
            </button>
          </div>
        </div>
      </div>

      {/* Top Filter & Toolbar Bar */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filtrar recursos en el banco..."
            value={inventorySearch}
            onChange={(e) => {
              setInventorySearch(e.target.value);
              setInventoryPage(1);
            }}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400 shrink-0">Ordenar:</span>
            <select
              value={inventorySort}
              onChange={(e) => setInventorySort(e.target.value as any)}
              className="px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-slate-200 focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="value">Mayor Valor Total</option>
              <option value="quantity">Mayor Cantidad</option>
              <option value="name">Alfabético (A-Z)</option>
              <option value="recent">Recientes</option>
            </select>
          </div>

          <div className="flex items-center gap-1 pl-2 border-l border-slate-800">
            <button
              type="button"
              onClick={onExportBank}
              disabled={bankItems.length === 0}
              title="Exportar inventario a JSON"
              className="p-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 disabled:opacity-40 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <label
              title="Importar inventario desde JSON"
              className="p-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <input type="file" accept=".json" onChange={onImportBank} className="hidden" />
            </label>
            <button
              type="button"
              onClick={onClearBank}
              disabled={bankItems.length === 0}
              title="Vaciar banco"
              className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-lg text-rose-400 disabled:opacity-40 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Inventory Grid */}
      {filteredBankInventory.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900 border border-dashed border-slate-800 space-y-2">
          <Vault className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-sm font-bold text-slate-300">
            No hay recursos en el banco
          </h3>
          <p className="text-xs text-slate-500">
            Usa el buscador superior para agregar recursos y sus cantidades a tu banco.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {paginatedInventory.map((item) => {
              const resolvedItem = item.item || { id: item.itemId };
              const name = getItemName(resolvedItem);
              const unitPrice = marketPrices[item.itemId] || getStoredItemPrice(item.itemId) || 0;
              const totalValue = item.quantity * unitPrice;

              return (
                <div
                  key={item.itemId}
                  className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 flex flex-col justify-between gap-3 shadow transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-700 flex items-center justify-center p-1 shrink-0">
                      <SafeImage
                        src={getItemIconUrl(('iconId' in resolvedItem && resolvedItem.iconId) ? (resolvedItem as any).iconId : item.itemId)}
                        alt={name}
                        className="w-8 h-8 object-contain"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-slate-100 truncate" title={name}>
                        {name}
                      </h4>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Unitario: <span className="font-mono text-amber-400 font-bold">{unitPrice.toLocaleString()} K</span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Valor total:{" "}
                        <span className="font-mono font-bold text-emerald-400">
                          {totalValue.toLocaleString()} K
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onRemoveItem(item.itemId, name)}
                      className="text-slate-500 hover:text-rose-400 p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Eliminar del banco"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
                    <span className="text-xs text-slate-400 font-medium">Cantidad:</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="1"
                        max="999999"
                        value={item.quantity}
                        onChange={(e) =>
                          onUpdateQuantity(
                            item.itemId,
                            Math.max(1, parseInt(e.target.value) || 1)
                          )
                        }
                        className="w-20 px-2 py-1 bg-slate-950 border border-slate-700 rounded-lg text-right text-xs font-mono font-bold text-amber-400 focus:outline-none focus:border-amber-500"
                      />
                      <button
                        type="button"
                        onClick={() => onSearchRecipesWithItem(name)}
                        className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                        title="Buscar recetas con este recurso"
                      >
                        Recetas
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {totalInventoryPages > 1 && (
            <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-800 text-xs">
              <div className="text-slate-400">
                Página <strong>{safeInventoryPage}</strong> de <strong>{totalInventoryPages}</strong> ({filteredBankInventory.length} recursos)
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setInventoryPage(1)}
                  disabled={safeInventoryPage === 1}
                  className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 font-bold text-slate-300 cursor-pointer"
                >
                  Primera
                </button>
                <button
                  type="button"
                  onClick={() => setInventoryPage((p) => Math.max(1, p - 1))}
                  disabled={safeInventoryPage === 1}
                  className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-300 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="px-2 font-mono font-bold text-slate-200">
                  {safeInventoryPage} / {totalInventoryPages}
                </span>
                <button
                  type="button"
                  onClick={() => setInventoryPage((p) => Math.min(totalInventoryPages, p + 1))}
                  disabled={safeInventoryPage === totalInventoryPages}
                  className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-300 cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setInventoryPage(totalInventoryPages)}
                  disabled={safeInventoryPage === totalInventoryPages}
                  className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 font-bold text-slate-300 cursor-pointer"
                >
                  Última
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
