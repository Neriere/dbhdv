import React, { useState, useEffect } from "react";
import {
  RefreshCw,
  Server,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Zap,
  TrendingUp,
  Clock,
  ExternalLink,
  SlidersHorizontal,
  X,
  Database,
  ArrowRight,
} from "lucide-react";
import {
  getDofocusServers,
  syncDofocusCoefficients,
  DofocusServer,
  DofocusSyncResult,
  fetchDofocusServerCoefficients,
} from "../../services/dofocusService";
import {
  getAllSavedItemCoefficients,
  getAllSavedItemCoefficientTimestamps,
} from "../../data/dofusRuneWeights";

interface DofocusSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncCompleted?: (result: DofocusSyncResult) => void;
}

export const DofocusSyncModal: React.FC<DofocusSyncModalProps> = ({
  isOpen,
  onClose,
  onSyncCompleted,
}) => {
  const [servers, setServers] = useState<DofocusServer[]>([]);
  const [selectedServer, setSelectedServer] = useState<string>("Draconiros");
  const [syncMode, setSyncMode] = useState<"only_defaults" | "all">("only_defaults");
  const [forceRefresh, setForceRefresh] = useState<boolean>(false);

  const [isLoadingServers, setIsLoadingServers] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncProgress, setSyncProgress] = useState<number>(0);
  const [syncResult, setSyncResult] = useState<DofocusSyncResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Local state stats
  const [localStats, setLocalStats] = useState<{
    totalSaved: number;
    defaultCount: number;
    customCount: number;
  }>({ totalSaved: 0, defaultCount: 0, customCount: 0 });

  const [serverStats, setServerStats] = useState<{
    totalAvailable: number;
    loaded: boolean;
  }>({ totalAvailable: 3234, loaded: false });

  // Load server list and local stats on open
  useEffect(() => {
    if (!isOpen) return;

    setErrorMsg(null);
    setSyncResult(null);

    // Compute local stats
    const saved = getAllSavedItemCoefficients();
    const keys = Object.keys(saved);
    const custom = keys.filter((k) => saved[Number(k)] !== 100).length;
    setLocalStats({
      totalSaved: keys.length,
      defaultCount: keys.length - custom,
      customCount: custom,
    });

    // Load available servers
    setIsLoadingServers(true);
    getDofocusServers()
      .then((srvs) => {
        setServers(srvs);
        if (srvs.some((s) => s.name.toLowerCase() === "draconiros")) {
          setSelectedServer("Draconiros");
        } else if (srvs.length > 0) {
          setSelectedServer(srvs[0].name);
        }
      })
      .catch((err) => console.error("Error loading servers:", err))
      .finally(() => setIsLoadingServers(false));

    // Preview server data
    fetchDofocusServerCoefficients("Draconiros")
      .then((res) => {
        setServerStats({
          totalAvailable: res.total || res.coefficients?.length || 3234,
          loaded: true,
        });
      })
      .catch(() => {
        setServerStats({ totalAvailable: 3234, loaded: false });
      });
  }, [isOpen]);

  const handleStartSync = async () => {
    setIsSyncing(true);
    setErrorMsg(null);
    setSyncResult(null);
    setSyncProgress(20);

    try {
      setSyncProgress(50);
      const res = await syncDofocusCoefficients(selectedServer, {
        onlyIfDefault: syncMode === "only_defaults",
        forceRefresh,
      });

      setSyncProgress(100);
      setSyncResult(res);

      // Refresh local stats
      const saved = getAllSavedItemCoefficients();
      const keys = Object.keys(saved);
      const custom = keys.filter((k) => saved[Number(k)] !== 100).length;
      setLocalStats({
        totalSaved: keys.length,
        defaultCount: keys.length - custom,
        customCount: custom,
      });

      if (onSyncCompleted) {
        onSyncCompleted(res);
      }
    } catch (err: any) {
      console.error("Sync error:", err);
      setErrorMsg(err.message || "Error al sincronizar con DoFocus");
    } finally {
      setIsSyncing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div
        className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-5 text-slate-200 relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow accent */}
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-inner">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <span>Sincronización con DoFocus</span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30 uppercase tracking-wider font-bold">
                  {selectedServer}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Importa automáticamente miles de coeficientes de rotura reales
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Server Selector & Settings */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Server selection */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 space-y-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-amber-400" />
                <span>Servidor de Dofus</span>
              </label>
              <select
                value={selectedServer}
                onChange={(e) => setSelectedServer(e.target.value)}
                disabled={isSyncing}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                {servers.map((s) => (
                  <option key={s._id || s.name} value={s.name}>
                    {s.name} {s.name.toLowerCase() === "draconiros" ? "(Recomendado)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* DoFocus Available Data Card */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-sky-400" />
                <span>Datos en DoFocus</span>
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-black text-sky-300 font-mono">
                  ~{serverStats.totalAvailable.toLocaleString()}
                </span>
                <span className="text-xs text-slate-400 font-medium">objetos indexados</span>
              </div>
              <p className="text-[10px] text-slate-500">
                Coeficientes colaborativos con actualización en tiempo real.
              </p>
            </div>
          </div>

          {/* Sync Strategy Options */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
              <span>Modalidad de Sincronización</span>
            </span>

            <div className="space-y-2">
              <label
                onClick={() => setSyncMode("only_defaults")}
                className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                  syncMode === "only_defaults"
                    ? "bg-amber-500/10 border-amber-500/50 text-white"
                    : "bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-300"
                }`}
              >
                <input
                  type="radio"
                  name="syncMode"
                  checked={syncMode === "only_defaults"}
                  onChange={() => setSyncMode("only_defaults")}
                  className="mt-1 accent-amber-500"
                />
                <div className="text-xs space-y-0.5">
                  <span className="font-bold block text-amber-300">
                    Solo objetos en 100% o sin registrar (Recomendado)
                  </span>
                  <span className="text-slate-400 block text-[11px]">
                    Rellena todos los coeficientes vacíos de una sola vez sin sobrescribir los valores que ya hayas modificado manualmente.
                  </span>
                </div>
              </label>

              <label
                onClick={() => setSyncMode("all")}
                className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                  syncMode === "all"
                    ? "bg-amber-500/10 border-amber-500/50 text-white"
                    : "bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-300"
                }`}
              >
                <input
                  type="radio"
                  name="syncMode"
                  checked={syncMode === "all"}
                  onChange={() => setSyncMode("all")}
                  className="mt-1 accent-amber-500"
                />
                <div className="text-xs space-y-0.5">
                  <span className="font-bold block text-white">
                    Sobrescribir todos los coeficientes del servidor
                  </span>
                  <span className="text-slate-400 block text-[11px]">
                    Reemplaza el 100% de la base de datos local con la versión más reciente extraída de DoFocus ({selectedServer}).
                  </span>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Progress / Success / Error Message */}
        {isSyncing && (
          <div className="bg-slate-950 border border-amber-500/30 rounded-2xl p-4 space-y-2 animate-fadeIn">
            <div className="flex items-center justify-between text-xs font-bold text-amber-300">
              <span className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                <span>Extrayendo y procesando coeficientes de {selectedServer}...</span>
              </span>
              <span>{syncProgress}%</span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full transition-all duration-500"
                style={{ width: `${syncProgress}%` }}
              />
            </div>
          </div>
        )}

        {syncResult && (
          <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-2xl p-4 space-y-2 animate-fadeIn text-xs">
            <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>¡Sincronización completada con éxito!</span>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1 font-mono">
              <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800 text-center">
                <span className="text-slate-400 text-[10px] block font-sans">Actualizados</span>
                <span className="text-emerald-400 font-bold text-base">
                  {syncResult.updatedCount.toLocaleString()}
                </span>
              </div>
              <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800 text-center">
                <span className="text-slate-400 text-[10px] block font-sans">Coef. Promedio</span>
                <span className="text-amber-400 font-bold text-base">
                  {syncResult.averageCoefficient}%
                </span>
              </div>
              <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800 text-center">
                <span className="text-slate-400 text-[10px] block font-sans">Coef. ≥ 150%</span>
                <span className="text-sky-400 font-bold text-base">
                  {syncResult.topProfitableItemsCount.toLocaleString()}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-slate-300 text-center pt-1 font-sans">
              Los cálculos del calculador de rotura y listas de objetos se han actualizado con los datos de <strong>{syncResult.server}</strong>.
            </p>
          </div>
        )}

        {errorMsg && (
          <div className="bg-rose-950/40 border border-rose-500/40 rounded-2xl p-3.5 flex items-start gap-2.5 text-rose-300 text-xs animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <div>
              <span className="font-bold">Error de sincronización: </span>
              <span>{errorMsg}</span>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <a
            href="https://dofocus.fr"
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors"
          >
            <span>Fuente: DoFocus.fr</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={handleStartSync}
              disabled={isSyncing}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
              <span>
                {isSyncing
                  ? "Sincronizando..."
                  : `Sincronizar ${selectedServer}`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
