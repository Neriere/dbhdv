import React, { useState, useEffect, useMemo } from "react";
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
  ShieldCheck,
  Calendar,
  Filter,
  Check,
} from "lucide-react";
import {
  getDofocusServers,
  syncDofocusCoefficients,
  DofocusServer,
  DofocusSyncResult,
  fetchDofocusServerCoefficients,
  DofocusCoefficientEntry,
  normalizeServerToSlug,
  normalizeServerToDoFocusName,
} from "../../services/dofocusService";
import {
  getAllSavedItemCoefficients,
  getAllSavedItemCoefficientTimestamps,
} from "../../data/dofusRuneWeights";
import { PriceProfile, ServerCategory } from "../../types";
import {
  getPriceProfiles,
  getActivePriceProfile,
  setActiveLocalPriceProfile,
} from "../../services/dofusDbService";
import {
  groupPriceProfilesByCategory,
  getProfileCategoryInfo,
  SERVER_CATEGORIES_CONFIG,
} from "../../utils/serverUtils";

interface DofocusSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncCompleted?: (result: DofocusSyncResult) => void;
  activeProfile?: PriceProfile;
}

type TimeFilterOption = 1 | 3 | 5 | 7 | 30 | null;

export const DofocusSyncModal: React.FC<DofocusSyncModalProps> = ({
  isOpen,
  onClose,
  onSyncCompleted,
  activeProfile: propActiveProfile,
}) => {
  const [profiles, setProfiles] = useState<PriceProfile[]>(() => getPriceProfiles());
  const currentActiveProfile = propActiveProfile || getActivePriceProfile() || profiles[0];

  const [selectedServer, setSelectedServer] = useState<string>(
    normalizeServerToDoFocusName(currentActiveProfile?.name || "Draconiros")
  );
  const [syncMode, setSyncMode] = useState<"only_defaults" | "all">("only_defaults");
  const [timeFilterDays, setTimeFilterDays] = useState<TimeFilterOption>(null);
  const [protectLocalEdits, setProtectLocalEdits] = useState<boolean>(true);
  const [forceRefresh, setForceRefresh] = useState<boolean>(false);

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncProgress, setSyncProgress] = useState<number>(0);
  const [syncResult, setSyncResult] = useState<DofocusSyncResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Cached remote server items for preview calculations
  const [serverCoefficients, setServerCoefficients] = useState<DofocusCoefficientEntry[]>([]);

  const selectedServerSlug = useMemo(
    () => normalizeServerToSlug(selectedServer),
    [selectedServer]
  );

  const matchedProfile = useMemo(() => {
    return profiles.find((p) => normalizeServerToSlug(p.slug || p.name) === selectedServerSlug) ||
      profiles.find((p) => normalizeServerToSlug(p.name) === selectedServerSlug);
  }, [profiles, selectedServerSlug]);

  const categoryInfo = useMemo(() => {
    return getProfileCategoryInfo(matchedProfile);
  }, [matchedProfile]);

  // Local state stats for currently selected server partition
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

    const latestProfiles = getPriceProfiles();
    setProfiles(latestProfiles);
    const active = propActiveProfile || getActivePriceProfile() || latestProfiles[0];
    if (active) {
      setSelectedServer(normalizeServerToDoFocusName(active.name || active.slug));
    }
  }, [isOpen, propActiveProfile]);

  // Re-calculate local stats whenever selectedServerSlug changes
  useEffect(() => {
    if (!isOpen) return;
    const saved = getAllSavedItemCoefficients(selectedServerSlug);
    const keys = Object.keys(saved);
    const custom = keys.filter((k) => saved[Number(k)] !== 100).length;
    setLocalStats({
      totalSaved: keys.length,
      defaultCount: keys.length - custom,
      customCount: custom,
    });
  }, [isOpen, selectedServerSlug]);

  // Fetch coefficients preview whenever selected server changes
  useEffect(() => {
    if (!isOpen || !selectedServer) return;

    setServerStats((prev) => ({ ...prev, loaded: false }));
    fetchDofocusServerCoefficients(selectedServer)
      .then((res) => {
        const list = res.coefficients || [];
        setServerCoefficients(list);
        setServerStats({
          totalAvailable: res.total || list.length || 3234,
          loaded: true,
        });
      })
      .catch(() => {
        setServerCoefficients([]);
        setServerStats({ totalAvailable: 3234, loaded: false });
      });
  }, [isOpen, selectedServer]);

  // Compute how many items match the current filters
  const matchingItemsCount = useMemo(() => {
    if (!serverCoefficients || serverCoefficients.length === 0) {
      return serverStats.totalAvailable;
    }

    const now = Date.now();
    const cutoffTs =
      timeFilterDays && timeFilterDays > 0 ? now - timeFilterDays * 24 * 60 * 60 * 1000 : 0;

    const saved = getAllSavedItemCoefficients(selectedServerSlug);
    const savedTs = getAllSavedItemCoefficientTimestamps(selectedServerSlug);

    let count = 0;
    for (const item of serverCoefficients) {
      let dofocusTs = 0;
      if (item.dateUpdated) {
        const parsed = new Date(item.dateUpdated).getTime();
        if (!isNaN(parsed) && parsed > 0) dofocusTs = parsed;
      }

      if (cutoffTs > 0 && dofocusTs < cutoffTs) continue;

      const currentCoeff = saved[item.itemId];
      const isDefaultOrMissing = currentCoeff === undefined || currentCoeff === 100;
      if (syncMode === "only_defaults" && !isDefaultOrMissing) continue;

      const localTs = savedTs[item.itemId] ? Number(savedTs[item.itemId]) : 0;
      if (protectLocalEdits && localTs > 0 && dofocusTs > 0 && localTs > dofocusTs) {
        continue;
      }

      count++;
    }
    return count;
  }, [
    serverCoefficients,
    timeFilterDays,
    syncMode,
    protectLocalEdits,
    serverStats.totalAvailable,
    selectedServerSlug,
  ]);

  const handleStartSync = async () => {
    setIsSyncing(true);
    setErrorMsg(null);
    setSyncResult(null);
    setSyncProgress(20);

    try {
      setSyncProgress(50);
      const res = await syncDofocusCoefficients(selectedServer, {
        onlyIfDefault: syncMode === "only_defaults",
        maxAgeDays: timeFilterDays,
        protectNewerLocalEdits: protectLocalEdits,
        forceRefresh,
        serverSlug: selectedServerSlug,
      });

      setSyncProgress(100);
      setSyncResult(res);

      // Refresh local stats
      const saved = getAllSavedItemCoefficients(selectedServerSlug);
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

  const groupedProfiles = groupPriceProfilesByCategory(profiles);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div
        className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl space-y-4 text-slate-200 relative overflow-hidden max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow accents */}
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-inner shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <span>Sincronización con DoFocus</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border uppercase tracking-wider font-bold ${categoryInfo.badgeClass}`}>
                  {selectedServer}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Sincroniza coeficientes de rotura específicos para tu servidor y categoría
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Server & Data Preview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Server selection with Categories */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 space-y-1.5">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-amber-400" />
                <span>Servidor a Sincronizar</span>
              </span>
              <span className="text-[10px] text-amber-400/90 font-medium">
                {categoryInfo.label}
              </span>
            </label>
            <select
              value={selectedServer}
              onChange={(e) => setSelectedServer(e.target.value)}
              disabled={isSyncing}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-amber-500 cursor-pointer shadow-inner"
            >
              {groupedProfiles.map((group) => (
                <optgroup
                  key={group.category}
                  label={`── ${group.label} ──`}
                  className="bg-slate-950 text-amber-400 font-bold"
                >
                  {group.profiles.map((p) => {
                    const dofocusName = normalizeServerToDoFocusName(p.name || p.slug);
                    return (
                      <option
                        key={p.id}
                        value={dofocusName}
                        className="bg-slate-900 text-slate-100 font-normal py-1"
                      >
                        {p.name}
                      </option>
                    );
                  })}
                </optgroup>
              ))}
            </select>
          </div>

          {/* DoFocus Available Data Card */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-sky-400" />
              <span>Disponibles en DoFocus</span>
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-black text-sky-300 font-mono">
                ~{serverStats.totalAvailable.toLocaleString()}
              </span>
              <span className="text-xs text-slate-400 font-medium">objetos</span>
            </div>
            <p className="text-[10px] text-slate-500">
              Coinciden con los filtros para <strong className="text-amber-300">{selectedServer}</strong>:{" "}
              <strong className="text-amber-300">{matchingItemsCount.toLocaleString()}</strong>
            </p>
          </div>
        </div>

        {/* TIME FILTER SECTION */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Período de actualización en DoFocus</span>
            </span>
            <span className="text-[10px] text-slate-500 font-medium">
              Solo ítems actualizados recientemente
            </span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
            {[
              { label: "1 día", val: 1 },
              { label: "3 días", val: 3 },
              { label: "5 días", val: 5 },
              { label: "1 semana", val: 7 },
              { label: "1 mes", val: 30 },
              { label: "Todos", val: null },
            ].map((opt) => {
              const active = timeFilterDays === opt.val;
              return (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => setTimeFilterDays(opt.val as TimeFilterOption)}
                  className={`px-2 py-1.5 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer ${
                    active
                      ? "bg-amber-500 text-slate-950 border-amber-400 shadow-md font-black"
                      : "bg-slate-900/80 border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <p className="text-[11px] text-slate-400">
            {timeFilterDays
              ? `Se sincronizarán únicamente los objetos cuya rotura se haya registrado en DoFocus (${selectedServer}) en los últimos ${
                  timeFilterDays === 1
                    ? "1 día (24 horas)"
                    : timeFilterDays === 7
                    ? "7 días (1 semana)"
                    : `${timeFilterDays} días`
                }.`
              : `Se sincronizarán todos los objetos de ${selectedServer} sin importar la fecha en que se registraron.`}
          </p>
        </div>

        {/* PROTECT LOCAL EDITS TOGGLE */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 space-y-2">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={protectLocalEdits}
              onChange={(e) => setProtectLocalEdits(e.target.checked)}
              className="mt-1 w-4 h-4 rounded accent-amber-500 cursor-pointer"
            />
            <div className="text-xs space-y-0.5">
              <span className="font-bold flex items-center gap-1.5 text-white">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Proteger mis ediciones manuales recientes en {selectedServer}</span>
                <span className="text-[10px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded-full font-bold border border-emerald-500/30">
                  Recomendado
                </span>
              </span>
              <span className="text-slate-400 block text-[11px] leading-relaxed">
                Si modificaste manualmente el coeficiente de un ítem en tu perfil de {selectedServer} y tu fecha local es más reciente que el registro de DoFocus, <strong>no se sobrescribirá</strong>.
              </span>
            </div>
          </label>
        </div>

        {/* Sync Strategy Options */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 space-y-2.5">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
            <span>Modalidad de Sincronización</span>
          </span>

          <div className="space-y-2">
            <label
              onClick={() => setSyncMode("only_defaults")}
              className={`flex items-start gap-3 p-2.5 rounded-xl border transition-all cursor-pointer ${
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
                className="mt-1 accent-amber-500 cursor-pointer"
              />
              <div className="text-xs space-y-0.5">
                <span className="font-bold block text-amber-300">
                  Solo objetos en 100% o sin registrar en {selectedServer}
                </span>
                <span className="text-slate-400 block text-[11px]">
                  Rellena los coeficientes vacíos sin tocar los que ya tengan un valor personalizado.
                </span>
              </div>
            </label>

            <label
              onClick={() => setSyncMode("all")}
              className={`flex items-start gap-3 p-2.5 rounded-xl border transition-all cursor-pointer ${
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
                className="mt-1 accent-amber-500 cursor-pointer"
              />
              <div className="text-xs space-y-0.5">
                <span className="font-bold block text-white">
                  Actualizar todos los coeficientes de {selectedServer}
                </span>
                <span className="text-slate-400 block text-[11px]">
                  Aplica los datos de DoFocus a todos los objetos que cumplan con el filtro temporal (respetando la protección de cambios recientes).
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Progress / Success / Error Message */}
        {isSyncing && (
          <div className="bg-slate-950 border border-amber-500/30 rounded-2xl p-3.5 space-y-2 animate-fadeIn">
            <div className="flex items-center justify-between text-xs font-bold text-amber-300">
              <span className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                <span>Procesando coeficientes de {selectedServer}...</span>
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
          <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-2xl p-3.5 space-y-2 animate-fadeIn text-xs">
            <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>¡Sincronización completada con éxito para {syncResult.server}!</span>
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
                <span className="text-slate-400 text-[10px] block font-sans">Protegidos/Omitidos</span>
                <span className="text-sky-400 font-bold text-base">
                  {syncResult.skippedCount.toLocaleString()}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-slate-300 text-center pt-0.5 font-sans">
              Los coeficientes del calculador de rotura y catálogo se han guardado exclusivamente en el perfil de <strong>{syncResult.server}</strong> ({categoryInfo.label}).
            </p>
          </div>
        )}

        {errorMsg && (
          <div className="bg-rose-950/40 border border-rose-500/40 rounded-2xl p-3 flex items-start gap-2.5 text-rose-300 text-xs animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <div>
              <span className="font-bold">Error de sincronización: </span>
              <span>{errorMsg}</span>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-800">
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
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={handleStartSync}
              disabled={isSyncing || matchingItemsCount === 0}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
              <span>
                {isSyncing
                  ? "Sincronizando..."
                  : `Sincronizar ${selectedServer} (${matchingItemsCount.toLocaleString()})`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
