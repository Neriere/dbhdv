import React, { useState, useEffect, useMemo } from "react";
import {
  RefreshCw,
  Server,
  CheckCircle2,
  AlertCircle,
  Zap,
  ExternalLink,
  X,
  Database,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Globe,
  RotateCcw,
  Undo2,
} from "lucide-react";
import {
  syncDofocusCoefficients,
  DofocusSyncResult,
  fetchDofocusServerCoefficients,
  DofocusCoefficientEntry,
  normalizeServerToSlug,
  normalizeServerToDoFocusName,
  fetchGlobalSyncStatus,
  triggerGlobalSync,
  GlobalSyncStatusResponse,
} from "../../services/dofocusService";
import {
  getAllSavedItemCoefficients,
  getAllSavedItemCoefficientTimestamps,
  getAllSavedItemManualEdits,
  hasCoefficientSyncBackup,
  restoreLastCoefficientSyncBackup,
} from "../../data/dofusRuneWeights";
import { PriceProfile } from "../../types";
import {
  getPriceProfiles,
  getActivePriceProfile,
} from "../../services/dofusDbService";
import { getProfileCategoryInfo } from "../../utils/serverUtils";
import { ModalPortal } from "../common/ModalPortal";

interface DofocusSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncCompleted?: (result: DofocusSyncResult) => void;
  activeProfile?: PriceProfile;
}

const DOFUS_DOFOCUS_SERVERS = [
  "Draconiros",
  "Dakal",
  "Mikhal",
  "Kourial",
  "Brial",
  "Rafal",
  "Salar",
  "TalKasha",
  "HellMina",
  "Imagiro",
  "Orukam",
  "Tylezia",
  "Ombre",
];

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

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncProgress, setSyncProgress] = useState<number>(0);
  const [syncResult, setSyncResult] = useState<DofocusSyncResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [restoreFeedback, setRestoreFeedback] = useState<string | null>(null);

  // Global hourly sync background status
  const [globalSyncState, setGlobalSyncState] = useState<GlobalSyncStatusResponse | null>(null);
  const [isTriggeringGlobal, setIsTriggeringGlobal] = useState<boolean>(false);
  const [countdownText, setCountdownText] = useState<string>("");
  const [showServerDetails, setShowServerDetails] = useState<boolean>(false);

  // Poll global sync state
  useEffect(() => {
    if (!isOpen) return;

    const refreshGlobalStatus = () => {
      fetchGlobalSyncStatus()
        .then((status) => {
          if (status) setGlobalSyncState(status);
        })
        .catch(() => {});
    };

    refreshGlobalStatus();
    const interval = setInterval(refreshGlobalStatus, 5000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Countdown timer for next hourly sync
  useEffect(() => {
    if (!isOpen || !globalSyncState?.nextSyncTimestamp) {
      setCountdownText("");
      return;
    }

    const updateCountdown = () => {
      if (globalSyncState.isSyncRunning) {
        setCountdownText("Sincronizando servidores...");
        return;
      }
      const diff = globalSyncState.nextSyncTimestamp! - Date.now();
      if (diff <= 0) {
        setCountdownText("En curso...");
        return;
      }
      const minutes = Math.floor(diff / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setCountdownText(`${minutes}m ${seconds}s`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [isOpen, globalSyncState?.nextSyncTimestamp, globalSyncState?.isSyncRunning]);

  const handleTriggerGlobalSync = async () => {
    setIsTriggeringGlobal(true);
    try {
      await triggerGlobalSync();
      const st = await fetchGlobalSyncStatus();
      if (st) setGlobalSyncState(st);
    } catch (e: any) {
      console.warn("Trigger global sync error:", e);
    } finally {
      setIsTriggeringGlobal(false);
    }
  };

  // Remote server items for preview calculations
  const [serverCoefficients, setServerCoefficients] = useState<DofocusCoefficientEntry[]>([]);

  const selectedServerSlug = useMemo(
    () => normalizeServerToSlug(selectedServer),
    [selectedServer]
  );

  const matchedProfile = useMemo(() => {
    return (
      profiles.find((p) => normalizeServerToSlug(p.slug || p.name) === selectedServerSlug) ||
      profiles.find((p) => normalizeServerToSlug(p.name) === selectedServerSlug)
    );
  }, [profiles, selectedServerSlug]);

  const categoryInfo = useMemo(() => {
    return getProfileCategoryInfo(matchedProfile);
  }, [matchedProfile]);

  const [serverStats, setServerStats] = useState<{
    totalAvailable: number;
    loaded: boolean;
  }>({ totalAvailable: 3234, loaded: false });

  // Load server list on open
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

  const targetProfileSlug = useMemo(
    () => currentActiveProfile?.slug || selectedServerSlug,
    [currentActiveProfile?.slug, selectedServerSlug]
  );

  // Fetch coefficients preview whenever selected server changes
  useEffect(() => {
    if (!isOpen || !selectedServer) return;

    setServerStats((prev) => ({ ...prev, loaded: false }));
    fetchDofocusServerCoefficients(selectedServer, false)
      .then((res) => {
        const list = res.coefficients || [];
        setServerCoefficients(list);
        setServerStats({
          totalAvailable: res.total || list.length || 3234,
          loaded: true,
        });
      })
      .catch((err) => {
        console.error("Preview error:", err);
        setServerCoefficients([]);
        setServerStats({ totalAvailable: 3234, loaded: false });
        setErrorMsg(err.message || "Error al conectar con DoFocus");
      });
  }, [isOpen, selectedServer]);

  // Exact comparison calculation: How many items have a newer date in DoFocus vs already protected in DB
  const { newerInDofocusCount, protectedInDbCount } = useMemo(() => {
    if (!serverCoefficients || serverCoefficients.length === 0) {
      return {
        newerInDofocusCount: serverStats.loaded ? 0 : serverStats.totalAvailable,
        protectedInDbCount: 0,
      };
    }

    const savedTs = getAllSavedItemCoefficientTimestamps(targetProfileSlug);
    const manualEdits = getAllSavedItemManualEdits(targetProfileSlug);

    let newer = 0;
    let protectedCount = 0;

    for (const item of serverCoefficients) {
      let dofocusTs = 0;
      if (item.dateUpdated) {
        const parsed = new Date(item.dateUpdated).getTime();
        if (!isNaN(parsed) && parsed > 0) dofocusTs = parsed;
      }

      const dbTs = savedTs[item.itemId] ? Number(savedTs[item.itemId]) : 0;
      const isManual = Boolean(manualEdits[item.itemId]);

      // If DB has a timestamp and DoFocus date is NOT strictly greater than DB timestamp, it is protected
      if (dbTs > 0 && (dofocusTs <= dbTs || dofocusTs === 0)) {
        protectedCount++;
      } else {
        newer++;
      }
    }

    return { newerInDofocusCount: newer, protectedInDbCount: protectedCount };
  }, [serverCoefficients, serverStats.loaded, serverStats.totalAvailable, targetProfileSlug]);

  const handleRestoreBackup = () => {
    const res = restoreLastCoefficientSyncBackup(targetProfileSlug);
    if (res.success) {
      setRestoreFeedback(res.message);
      setSyncResult(null);
      setTimeout(() => setRestoreFeedback(null), 5000);
    } else {
      setErrorMsg(res.message);
    }
  };

  const handleStartSync = async () => {
    setIsSyncing(true);
    setErrorMsg(null);
    setRestoreFeedback(null);
    setSyncResult(null);
    setSyncProgress(25);

    try {
      setSyncProgress(65);
      const res = await syncDofocusCoefficients(selectedServer, {
        serverSlug: targetProfileSlug,
      });

      setSyncProgress(100);
      setSyncResult(res);

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
    <ModalPortal>
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
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full border uppercase tracking-wider font-bold ${categoryInfo.badgeClass}`}
                >
                  {selectedServer}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Actualización inteligente basada en fecha en base de datos SQLite
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

        {/* AUTOMATED HOURLY SYNC STATUS BANNER */}
        <div className="bg-gradient-to-r from-sky-950/40 via-indigo-950/30 to-amber-950/30 border border-sky-500/30 rounded-2xl p-3.5 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0 mt-0.5">
                <Globe className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">
                    Sincronización Automática Cada Hora
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Activa
                  </span>
                </div>
                <p className="text-[11px] text-slate-300">
                  El servidor sincroniza automáticamente todos los servidores uno por uno cada hora en segundo plano para no saturar la página.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              <button
                type="button"
                onClick={handleTriggerGlobalSync}
                disabled={isTriggeringGlobal || globalSyncState?.isSyncRunning}
                className="px-3 py-1.5 rounded-xl bg-sky-600/80 hover:bg-sky-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
                title="Ejecutar sincronización secuencial de todos los servidores ahora"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${
                    isTriggeringGlobal || globalSyncState?.isSyncRunning ? "animate-spin" : ""
                  }`}
                />
                <span>
                  {isTriggeringGlobal || globalSyncState?.isSyncRunning
                    ? "Sincronizando todos..."
                    : "Sincronizar Todos"}
                </span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80 text-[11px] text-slate-400 font-mono">
            <div className="flex items-center gap-3">
              <span>
                Última sincronización:{" "}
                <strong className="text-slate-200 font-sans">
                  {globalSyncState?.lastSyncTimestamp
                    ? new Date(globalSyncState.lastSyncTimestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Reciente"}
                </strong>
              </span>
              <span>
                Próxima:{" "}
                <strong className="text-sky-300 font-mono">
                  {countdownText || "En cola (60m)"}
                </strong>
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowServerDetails((v) => !v)}
              className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 font-sans transition-colors cursor-pointer"
            >
              <span>{showServerDetails ? "Ocultar servidores" : "Ver estado por servidor"}</span>
              {showServerDetails ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>
          </div>

          {/* Collapsible server details */}
          {showServerDetails && (
            <div className="pt-2 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-1.5 animate-fadeIn font-mono text-[10px]">
              {DOFUS_DOFOCUS_SERVERS.map((srv) => {
                const status = globalSyncState?.serverStatuses?.[srv.toLowerCase()];
                return (
                  <div
                    key={srv}
                    className="p-1.5 rounded-lg bg-slate-900/90 border border-slate-800 flex items-center justify-between"
                  >
                    <span className="font-sans font-medium text-slate-300 truncate">{srv}</span>
                    {status ? (
                      status.success ? (
                        <span className="text-emerald-400 font-bold">
                          {status.totalFetched.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-rose-400 font-bold" title={status.error || "Error"}>
                          Error
                        </span>
                      )
                    ) : (
                      <span className="text-slate-500">Pendiente</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Server & Data Preview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Active Server Info & Selector */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 space-y-2 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-amber-400" />
                <span>Servidor a Sincronizar</span>
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase tracking-wider ${categoryInfo.badgeClass}`}
              >
                {categoryInfo.label}
              </span>
            </div>
            <div>
              <select
                value={selectedServer}
                onChange={(e) => setSelectedServer(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-sm font-bold text-amber-300 focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                {DOFUS_DOFOCUS_SERVERS.map((srv) => (
                  <option key={srv} value={srv} className="bg-slate-900 text-slate-200">
                    {srv}{" "}
                    {srv === normalizeServerToDoFocusName(currentActiveProfile?.name || "")
                      ? "(Perfil Activo)"
                      : ""}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-[11px] text-slate-400 leading-tight">
              Los coeficientes se guardarán en la base de datos para el perfil:{" "}
              <strong className="text-slate-200">
                {currentActiveProfile?.name || selectedServer}
              </strong>
              .
            </p>
          </div>

          {/* DoFocus Available Data Card */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 space-y-1.5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-sky-400" />
                <span>Registros en DoFocus</span>
              </span>
              <span className="text-[10px] text-sky-400/90 font-medium">
                {serverStats.loaded ? "Consultado" : "Consultando..."}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-sky-300 font-mono">
                ~{serverStats.totalAvailable.toLocaleString()}
              </span>
              <span className="text-xs text-slate-400 font-medium">objetos disponibles</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80 font-mono">
              <span>
                Con fecha más nueva:{" "}
                <strong className="text-emerald-400">{newerInDofocusCount.toLocaleString()}</strong>
              </span>
              <span>
                Protegidos en BD:{" "}
                <strong className="text-sky-300">{protectedInDbCount.toLocaleString()}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* STRICT DATE RULE & PROTECTION PERMANENT NOTICE */}
        <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-3.5 space-y-2">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="text-xs space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white">
                  Protección Activa por Comparación de Fechas
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                  Siempre Activa
                </span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                Solo se actualizarán los coeficientes cuya fecha en DoFocus sea estrictamente{" "}
                <strong className="text-emerald-300">más reciente</strong> que la fecha guardada en
                la base de datos.
              </p>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Si guardaste un coeficiente manualmente, se almacena en la base de datos con su
                fecha exacta y <strong className="text-white">nunca</strong> será sobrescrito por
                datos antiguos de DoFocus.
              </p>
            </div>
          </div>
        </div>

        {/* Progress indicator */}
        {isSyncing && (
          <div className="bg-slate-950 border border-amber-500/30 rounded-2xl p-3.5 space-y-2 animate-fadeIn">
            <div className="flex items-center justify-between text-xs font-bold text-amber-300">
              <span className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                <span>Sincronizando y comparando coeficientes en base de datos...</span>
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

        {/* Sync Success Result */}
        {syncResult && (
          <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-2xl p-3.5 space-y-2 animate-fadeIn text-xs">
            <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>¡Sincronización completada con éxito para {syncResult.server}!</span>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1 font-mono">
              <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800 text-center">
                <span className="text-slate-400 text-[10px] block font-sans">
                  Actualizados en BD
                </span>
                <span className="text-emerald-400 font-bold text-base">
                  {syncResult.updatedCount.toLocaleString()}
                </span>
              </div>
              <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800 text-center">
                <span className="text-slate-400 text-[10px] block font-sans">
                  Conservados / Omitidos
                </span>
                <span className="text-sky-400 font-bold text-base">
                  {syncResult.skippedCount.toLocaleString()}
                </span>
              </div>
              <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800 text-center">
                <span className="text-slate-400 text-[10px] block font-sans">
                  Total Analizados
                </span>
                <span className="text-amber-400 font-bold text-base">
                  {syncResult.totalAvailable.toLocaleString()}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-slate-300 text-center pt-0.5 font-sans">
              Los coeficientes se han persistido en la base de datos de <strong>{syncResult.server}</strong>.
            </p>
            <button
              type="button"
              onClick={handleRestoreBackup}
              className="mt-2 w-full py-2 px-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 hover:border-amber-500/50 text-slate-300 hover:text-amber-300 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              <span>¿No estás conforme? Deshacer sincronización y restaurar valores previos</span>
            </button>
          </div>
        )}

        {restoreFeedback && (
          <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-2xl p-3 flex items-center gap-2.5 text-emerald-300 text-xs animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span className="font-semibold">{restoreFeedback}</span>
          </div>
        )}

        {!syncResult && !isSyncing && hasCoefficientSyncBackup(targetProfileSlug) && (
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <RotateCcw className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Hay una copia de seguridad previa para {selectedServer}.</span>
            </div>
            <button
              type="button"
              onClick={handleRestoreBackup}
              className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-bold text-[11px] transition-colors cursor-pointer shrink-0 flex items-center gap-1.5"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>Restaurar copia previa</span>
            </button>
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
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-800">
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
              disabled={isSyncing}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
              <span>
                {isSyncing
                  ? "Sincronizando..."
                  : `Sincronizar coeficientes de ${selectedServer}`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </ModalPortal>
);
};
