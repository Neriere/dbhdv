import React, { useMemo, useState } from "react";
import { Vault, Upload } from "lucide-react";
import { DofusItem } from "../types";
import {
  getStoredItemPrice,
  getItemName,
  getItemById,
} from "../services/dofusDbService";
import { useMarketPrices } from "../hooks/useMarketPrices";
import { useBankInventory } from "../hooks/useBankInventory";
import { BankItemDrawer } from "./bank/BankItemDrawer";
import {
  importSalesHistoryJSON,
  importActiveListingsJSON,
} from "../services/salesHistoryService";
import { saveActiveListings } from "../services/activeListingsService";
import craftIngredientsIds from "../data/craftIngredientsIds.json";
import { isMountOrPet } from "../data/dofusJobs";

const craftIngredientsSet = new Set<number>(craftIngredientsIds);

// TypeIds a excluir siempre del banco
const BANK_EXCLUDED_TYPE_IDS = new Set<number>([
  78,          // Runas de forjamagia
  174, 175,    // Mapas de búsqueda del tesoro y fragmentos
  79,          // Llaves de mazmorra
  18, 97, 121, 196, 207, 333,  // Mascotas y monturas
]);

// SuperCategoryIds que corresponden a objetos de misión/ligados/no comerciables
const BANK_EXCLUDED_SUPER_CATEGORY_IDS = new Set<number>([4, 5, 14, 15]);

// TypeIds de equipables (no recursos). Se permiten si están en craftIngredientsSet
const EQUIPMENT_TYPE_IDS = new Set<number>([
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 16, 17, 19, 82, 112, 151, 217, 271,
]);

// TypeIds de consumibles (se permiten solo si son ingredientes de una receta)
const CONSUMABLE_TYPE_IDS = new Set<number>([
  65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76,
  85, 86, 87, 88, 89, 90,
  100, 101, 102,
  115, 116,
  183, 184,
  219, 220, 221,
  230, 231,
]);

function shouldExcludeFromBank(id: number, rawItem?: any): boolean {
  const resolved = getItemById(id) || rawItem;
  const typeId = Number(
    resolved?.typeId || resolved?.type?.id || rawItem?.typeId || 0
  );
  const superCatId = Number(
    resolved?.type?.superCategoryId || rawItem?.superCategoryId || 0
  );

  if (BANK_EXCLUDED_TYPE_IDS.has(typeId)) return true;
  if (BANK_EXCLUDED_SUPER_CATEGORY_IDS.has(superCatId)) return true;
  if (isMountOrPet(resolved || rawItem)) return true;

  const nameEs = (
    typeof resolved?.name === "object" ? resolved.name?.es || "" :
    typeof rawItem?.name === "string" ? rawItem.name : ""
  ).toLowerCase();
  if (
    typeId === 79 ||
    (nameEs.includes("llave") && !craftIngredientsSet.has(id)) ||
    (nameEs.includes("clave") && nameEs.includes("mazmorr") && !craftIngredientsSet.has(id))
  ) return true;

  if (EQUIPMENT_TYPE_IDS.has(typeId) && !craftIngredientsSet.has(id)) return true;
  if (CONSUMABLE_TYPE_IDS.has(typeId) && !craftIngredientsSet.has(id)) return true;

  if (
    nameEs.includes("geneticha") ||
    nameEs.includes("gremicha") ||
    nameEs.includes("sebuscalin") ||
    nameEs.includes("vuloceront")
  ) return true;

  if (
    (nameEs.includes("mapa") && (nameEs.includes("tesoro") || nameEs.includes("búsqueda") || nameEs.includes("busqueda"))) ||
    (nameEs.includes("fragmento") && nameEs.includes("mapa")) ||
    nameEs.includes("trozo de mapa")
  ) return true;

  return false;
}

interface BankCraftingViewProps {
  onSelectRecipeForCalculator?: (item: DofusItem) => void;
  onSelectForCrushing?: (item: DofusItem) => void;
  onNavigateToShopping?: () => void;
}

export const BankCraftingView: React.FC<BankCraftingViewProps> = () => {
  const { marketPrices } = useMarketPrices();
  const {
    bankInventory: bankItems,
    updateBankItem,
    removeBankItem: deleteBankItem,
    saveInventory,
    clearInventory,
  } = useBankInventory();

  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "info" } | null>(null);

  const showToast = (text: string, type: "success" | "info" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const bankStats = useMemo(() => {
    let totalUnits = 0;
    let totalKamasValue = 0;

    bankItems.forEach((b) => {
      totalUnits += b.quantity;
      const unitPrice = marketPrices[b.itemId] || getStoredItemPrice(b.itemId) || 0;
      totalKamasValue += b.quantity * unitPrice;
    });

    return {
      uniqueResources: bankItems.length,
      totalUnits,
      totalKamasValue,
    };
  }, [bankItems, marketPrices]);

  const handleAddToBank = (item: DofusItem, qty: number) => {
    updateBankItem(item.id, qty);
    showToast(`Se agregaron ${qty}x ${getItemName(item)} al banco`);
  };

  const handleUpdateQuantity = (itemId: number, newQty: number) => {
    updateBankItem(itemId, newQty);
  };

  const handleRemoveItem = (itemId: number, name: string) => {
    deleteBankItem(itemId);
    showToast(`Se eliminó ${name} del banco`, "info");
  };

  const handleClearBank = () => {
    if (window.confirm("¿Seguro que deseas vaciar todos los recursos de tu banco?")) {
      clearInventory();
      showToast("Banco vaciado correctamente", "info");
    }
  };

  const handleExportBank = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(bankItems, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `dofus_banco_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportBank = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList);
    let bankImportCount = 0;
    let bankExcludedCount = 0;
    let salesImportCount = 0;
    let listingsImportCount = 0;
    const errors: string[] = [];

    for (const file of files) {
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);

        // 1. Detectar Historial de Ventas (historial_ventas_capturado.json)
        if (parsed && Array.isArray(parsed.sales)) {
          const res = importSalesHistoryJSON(parsed);
          salesImportCount += res.snapshot.totalSales;
          continue;
        }

        // 2. Detectar Listings en Venta Activos (listings_en_venta_capturado.json)
        if (parsed && (Array.isArray(parsed.listings) || parsed.mercadillos)) {
          const res = importActiveListingsJSON(parsed);
          saveActiveListings(parsed);
          listingsImportCount += res.snapshot.totalLots;
          continue;
        }

        // 3. Detectar Banco / Inventario (banco_inventario_capturado.json o array)
        let rawList: any[] = [];
        if (Array.isArray(parsed)) {
          rawList = parsed;
        } else if (parsed && typeof parsed === "object") {
          if (Array.isArray(parsed.items)) {
            rawList = parsed.items;
          } else {
            rawList = Object.entries(parsed).map(([key, val]) => {
              if (typeof val === "number") {
                return { itemId: Number(key), quantity: val };
              }
              if (val && typeof val === "object") {
                return {
                  itemId: Number((val as any).itemId || (val as any).id || key),
                  quantity: Number((val as any).quantity || (val as any).qty || 1),
                };
              }
              return null;
            }).filter(Boolean);
          }
        }

        if (rawList.length > 0) {
          const validItemsMap = new Map<number, number>();
          rawList.forEach((entry) => {
            const id = Number(entry?.itemId || entry?.id || entry?.item_id || 0);
            const qty = Number(entry?.quantity || entry?.qty || entry?.count || 0);

            if (id > 0 && qty > 0) {
              if (shouldExcludeFromBank(id, entry?.item || entry)) {
                bankExcludedCount++;
                return;
              }
              const current = validItemsMap.get(id) || 0;
              validItemsMap.set(id, current + qty);
            }
          });

          if (validItemsMap.size > 0) {
            const newBankItems = Array.from(validItemsMap.entries()).map(([itemId, quantity]) => {
              const item = getItemById(itemId);
              return {
                itemId,
                quantity,
                item: item || undefined,
                addedAt: Date.now(),
              };
            });
            saveInventory(newBankItems);
            bankImportCount = newBankItems.length;
          }
        }
      } catch (err: any) {
        console.error(`Error procesando archivo ${file.name}:`, err);
        errors.push(`${file.name}: ${err?.message || "Formato no compatible"}`);
      }
    }

    event.target.value = "";

    const summaryParts: string[] = [];
    if (bankImportCount > 0) {
      const excludedMsg = bankExcludedCount > 0 ? ` (${bankExcludedCount} omitidos)` : "";
      summaryParts.push(`Banco: ${bankImportCount} recursos${excludedMsg}`);
    }
    if (salesImportCount > 0) {
      summaryParts.push(`Historial: ${salesImportCount} ventas`);
    }
    if (listingsImportCount > 0) {
      summaryParts.push(`En venta: ${listingsImportCount} lotes`);
    }

    if (summaryParts.length > 0) {
      showToast(`Importación exitosa: ${summaryParts.join(" • ")}`);
    } else if (errors.length > 0) {
      alert(`No se pudieron procesar los archivos:\n${errors.join("\n")}`);
    } else {
      alert("No se detectó un formato compatible en los archivos seleccionados.");
    }
  };

  return (
    <div className="space-y-5">
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-amber-500 text-slate-950 font-bold px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2">
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Hero Header Banner */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800 p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner shrink-0">
              <Vault className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                  Mi Banco
                </h1>
                <label
                  title="Selecciona a la vez banco_inventario, historial_ventas y/o listings_en_venta"
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 hover:border-amber-400 text-amber-300 hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-sm"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Importar JSONs (Multi-archivo)</span>
                  <input type="file" accept=".json" multiple onChange={handleImportBank} className="hidden" />
                </label>
              </div>
            </div>
          </div>

          {/* Quick Bank Summary Badges */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex flex-col justify-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Recursos</span>
              <span className="text-base sm:text-lg font-bold text-slate-100">
                {bankStats.uniqueResources.toLocaleString()}
              </span>
            </div>
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex flex-col justify-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Unidades</span>
              <span className="text-base sm:text-lg font-bold text-amber-400">
                {bankStats.totalUnits.toLocaleString()}
              </span>
            </div>
            <div className="bg-slate-950/60 border border-amber-500/20 rounded-xl p-3 flex flex-col justify-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Valor Banco</span>
              <span className="text-base sm:text-lg font-bold text-emerald-400 font-mono">
                {bankStats.totalKamasValue.toLocaleString()} K
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bank Inventory Direct View */}
      <BankItemDrawer
        bankItems={bankItems}
        marketPrices={marketPrices}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onAddCustomItem={handleAddToBank}
        onExportBank={handleExportBank}
        onImportBank={handleImportBank}
        onClearBank={handleClearBank}
      />
    </div>
  );
};
