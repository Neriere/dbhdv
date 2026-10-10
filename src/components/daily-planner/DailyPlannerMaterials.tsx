import React from 'react';
import {
  Package,
  Vault,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  Copy,
  Check,
} from 'lucide-react';

interface MaterialItem {
  id: number;
  name: string;
  totalQty: number;
  unitPrice: number;
  totalCost: number;
  recipesUsing: number;
  inBankQty: number;
  coveredByBankQty: number;
  neededToBuyQty: number;
  bankSavingsCost: number;
}

interface DailyPlannerMaterialsProps {
  materialsSummary: {
    list: MaterialItem[];
    totalIngredientsCount: number;
    grandTotalCost: number;
    totalBankSavings: number;
    effectiveCostAfterBank: number;
    bottlenecks: MaterialItem[];
  } | null;
  showMaterialsDrawer: boolean;
  setShowMaterialsDrawer: (show: boolean) => void;
  useBankResources: boolean;
  copiedMaterialsNotice: boolean;
  handleCopyMaterialsList: () => void;
}

export const DailyPlannerMaterials: React.FC<DailyPlannerMaterialsProps> = ({
  materialsSummary,
  showMaterialsDrawer,
  setShowMaterialsDrawer,
  useBankResources,
  copiedMaterialsNotice,
  handleCopyMaterialsList,
}) => {
  if (!materialsSummary || materialsSummary.list.length === 0) return null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg transition-all">
      <div
        onClick={() => setShowMaterialsDrawer(!showMaterialsDrawer)}
        className="p-3.5 bg-slate-950/70 hover:bg-slate-950 flex items-center justify-between cursor-pointer border-b border-slate-800/60 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <Package className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-white text-xs flex items-center gap-2 flex-wrap">
              Desglose Agregado de Materiales & Cuellos de Botella
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                {materialsSummary.totalIngredientsCount} recursos necesarios
              </span>
              {useBankResources && materialsSummary.totalBankSavings > 0 && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold flex items-center gap-1 border border-amber-500/30">
                  <Vault className="w-3 h-3 text-amber-400" />
                  Ahorro Mi Banco: ~{materialsSummary.totalBankSavings.toLocaleString('es-ES')} K
                </span>
              )}
            </span>
            <p className="text-[11px] text-slate-400">
              {materialsSummary.bottlenecks.length > 0
                ? `⚠️ ${materialsSummary.bottlenecks.length} cuello(s) de botella acaparan la mayor parte del presupuesto`
                : 'Gasto de materiales bien distribuido sin dependencias críticas'}
              {useBankResources && materialsSummary.totalBankSavings > 0 && (
                <span className="text-amber-200/90 ml-1.5 font-mono">
                  (A comprar en HDV: ~{materialsSummary.effectiveCostAfterBank.toLocaleString('es-ES')} K)
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleCopyMaterialsList();
            }}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
            title="Copiar lista de compras en formato texto para compartir o pegar en Dofus"
          >
            {copiedMaterialsNotice ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            <span>{copiedMaterialsNotice ? '¡Copiado!' : 'Copiar Lista'}</span>
          </button>
          {showMaterialsDrawer ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </div>

      {showMaterialsDrawer && (
        <div className="p-4 space-y-3 bg-slate-900/60">
          {materialsSummary.bottlenecks.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold text-amber-300">Cuellos de botella detectados en la cartera:</span>
                <p className="text-[11px] text-amber-200/90 leading-relaxed">
                  {materialsSummary.bottlenecks.map((b) => {
                    const pct = ((b.totalCost / materialsSummary.grandTotalCost) * 100).toFixed(0);
                    return `"${b.name}" (${b.totalQty.toLocaleString('es-ES')}x = ${b.totalCost.toLocaleString('es-ES')} K, ~${pct}% del gasto total)`;
                  }).join(' • ')}
                  . Vigila la disponibilidad y precio de estos recursos antes de empezar a craftear.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-60 overflow-y-auto pr-1">
            {materialsSummary.list.map((mat) => {
              const pct = materialsSummary.grandTotalCost > 0 ? (mat.totalCost / materialsSummary.grandTotalCost) * 100 : 0;
              const isBottleneck = pct >= 20;

              return (
                <div
                  key={mat.id}
                  className={`p-2 rounded-xl border flex items-center justify-between text-xs font-mono ${
                    isBottleneck
                      ? 'bg-amber-950/20 border-amber-500/40 text-amber-200'
                      : 'bg-slate-950 border-slate-800/80 text-slate-300'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-bold truncate text-white flex items-center gap-1.5" title={mat.name}>
                      <span>{mat.name}</span>
                      {useBankResources && mat.coveredByBankQty > 0 && (
                        <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-semibold shrink-0">
                          🏦 {mat.coveredByBankQty.toLocaleString('es-ES')}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 font-sans">
                      {mat.totalQty.toLocaleString('es-ES')}x • {mat.unitPrice.toLocaleString('es-ES')} K/u
                      {useBankResources && mat.coveredByBankQty > 0 && mat.neededToBuyQty > 0 && (
                        <span className="text-amber-200/90 ml-1.5">
                          (Comprar: {mat.neededToBuyQty.toLocaleString('es-ES')}x)
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-amber-300">
                      {useBankResources && mat.coveredByBankQty > 0 ? (
                        <>
                          <span className="line-through text-slate-500 text-[10px] mr-1">
                            {mat.totalCost.toLocaleString('es-ES')} K
                          </span>
                          <span>
                            {(mat.neededToBuyQty * mat.unitPrice).toLocaleString('es-ES')} K
                          </span>
                        </>
                      ) : (
                        `${mat.totalCost.toLocaleString('es-ES')} K`
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {useBankResources && mat.neededToBuyQty === 0 ? (
                        <span className="text-emerald-400 font-bold">100% en banco</span>
                      ) : (
                        `${pct.toFixed(0)}% del gasto`
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
