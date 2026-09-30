import React, { useState, useEffect, useMemo } from "react";
import {
  CheckCircle2,
  AlertCircle,
  Zap,
  ExternalLink,
  X,
  Database,
  FileText,
  Upload,
  Download,
  Copy,
  Code,
  RotateCcw,
  Sliders,
  TrendingUp,
  Trash2,
} from "lucide-react";
import {
  DofocusSyncResult,
  normalizeServerToSlug,
  normalizeServerToDoFocusName,
  importCoefficientsFromJson,
} from "../../services/dofocusService";
import {
  getAllSavedItemCoefficients,
  getAllSavedItemCoefficientTimestamps,
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
import { DOFUS_BROWSER_COLLECTOR_SCRIPT } from "../../utils/dofocusCollectorScript";

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

  const [syncMode, setSyncMode] = useState<"import" | "collector" | "export">("import");
  const [copyFeedback, setCopyFeedback] = useState<boolean>(false);
  const [jsonInput, setJsonInput] = useState<string>("");
  const [isProcessingJson, setIsProcessingJson] = useState<boolean>(false);
  const [syncResult, setSyncResult] = useState<DofocusSyncResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [restoreFeedback, setRestoreFeedback] = useState<string | null>(null);
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);

  // Inicializar servidor según el perfil activo
  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    setSyncResult(null);
    setRestoreFeedback(null);
    setExportFeedback(null);

    const latestProfiles = getPriceProfiles();
    setProfiles(latestProfiles);
    const active = propActiveProfile || getActivePriceProfile() || latestProfiles[0];
    if (active) {
      setSelectedServer(normalizeServerToDoFocusName(active.name || active.slug));
    }
  }, [isOpen, propActiveProfile]);

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

  // Estadísticas locales exactas de la base de datos para el servidor seleccionado
  const localStats = useMemo(() => {
    const coeffs = getAllSavedItemCoefficients(selectedServerSlug);
    const timestamps = getAllSavedItemCoefficientTimestamps(selectedServerSlug);
    const ids = Object.keys(coeffs).map(Number);
    const totalCount = ids.length;

    let avg = 100;
    let profitable = 0;
    let lastTs = 0;

    if (totalCount > 0) {
      const vals = ids.map((id) => coeffs[id]).filter((n) => !isNaN(n));
      if (vals.length > 0) {
        avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
        profitable = vals.filter((n) => n >= 150).length;
      }
      for (const id of ids) {
        const ts = Number(timestamps[id]) || 0;
        if (ts > lastTs) lastTs = ts;
      }
    }

    return {
      totalCount,
      averageCoeff: avg,
      profitableCount: profitable,
      lastUpdated: lastTs > 0 ? lastTs : null,
      hasBackup: hasCoefficientSyncBackup(selectedServerSlug),
    };
  }, [selectedServerSlug, syncResult, restoreFeedback]);

  const handleCopyCollectorScript = () => {
    navigator.clipboard.writeText(DOFUS_BROWSER_COLLECTOR_SCRIPT);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 3000);
  };

  const handleRestoreBackup = () => {
    const res = restoreLastCoefficientSyncBackup(selectedServerSlug);
    if (res.success) {
      setRestoreFeedback(res.message);
      setSyncResult(null);
      setErrorMsg(null);
      setTimeout(() => setRestoreFeedback(null), 5000);
      if (onSyncCompleted) {
        onSyncCompleted({
          server: selectedServer,
          serverSlug: selectedServerSlug,
          totalAvailable: localStats.totalCount,
          updatedCount: 0,
          skippedCount: 0,
          averageCoefficient: localStats.averageCoeff,
          topProfitableItemsCount: localStats.profitableCount,
          timestamp: Date.now(),
        });
      }
    } else {
      setErrorMsg(res.message);
    }
  };

  const handleClearManualEdits = () => {
    if (confirm(`¿Deseas desmarcar las etiquetas 'Manual' en ${selectedServer}? Los coeficientes seguirán guardados normalmente y pasarán a sincronizarse con las fechas reales de DoFocus.`)) {
      localStorage.removeItem(`dofus_user_item_coeff_manual_edits_${selectedServerSlug}`);
      window.dispatchEvent(
        new CustomEvent("dofus_coefficients_updated", {
          detail: { server: selectedServerSlug, timestamp: Date.now() },
        })
      );
      setRestoreFeedback(`Se limpiaron las marcas manuales de ${selectedServer}.`);
      setTimeout(() => setRestoreFeedback(null), 4000);
    }
  };

  const handleExportCoefficients = () => {
    const coeffs = getAllSavedItemCoefficients(selectedServerSlug);
    const timestamps = getAllSavedItemCoefficientTimestamps(selectedServerSlug);
    const entries = Object.entries(coeffs).map(([idStr, val]) => ({
      itemId: Number(idStr),
      coefficient: val,
      updatedAt: timestamps[Number(idStr)] || Date.now(),
    }));

    if (entries.length === 0) {
      setErrorMsg(`No hay coeficientes guardados en ${selectedServer} para exportar.`);
      return;
    }

    const payload = {
      server: selectedServer,
      serverSlug: selectedServerSlug,
      timestamp: Date.now(),
      total: entries.length,
      coefficients: entries,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `dofocus_coeficientes_${selectedServer}_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setExportFeedback(`¡Descargado archivo con ${entries.length.toLocaleString()} coeficientes de ${selectedServer}!`);
    setTimeout(() => setExportFeedback(null), 4000);
  };

  const processImportContent = (content: string) => {
    setIsProcessingJson(true);
    setErrorMsg(null);
    setRestoreFeedback(null);
    setSyncResult(null);

    try {
      // 1. Detectar si el JSON tiene un servidor especificado
      let targetServer = selectedServer;
      try {
        const parsed = JSON.parse(content);
        if (parsed?.server && typeof parsed.server === "string") {
          const norm = normalizeServerToDoFocusName(parsed.server);
          if (norm) {
            targetServer = norm;
            setSelectedServer(norm);
          }
        }
      } catch {}

      const res = importCoefficientsFromJson(content, targetServer);
      setSyncResult(res);
      setJsonInput("");
      if (onSyncCompleted) {
        onSyncCompleted(res);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Error al procesar el archivo JSON");
    } finally {
      setIsProcessingJson(false);
    }
  };

  const handleImportJson = () => {
    if (!jsonInput.trim()) {
      setErrorMsg("Pega el texto JSON de coeficientes antes de continuar.");
      return;
    }
    processImportContent(jsonInput);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === "string") {
        processImportContent(content);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-start justify-center py-8 px-4 overflow-y-auto bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
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
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <span>Gestor de Coeficientes de Rotura</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Importación por JSON y sincronización por servidor en base de datos local
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

          {/* SERVER SELECTOR & LIVE STATS CARD */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-bold">Servidor:</span>
                <select
                  value={selectedServer}
                  onChange={(e) => setSelectedServer(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1 text-xs font-bold text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  {DOFUS_DOFOCUS_SERVERS.map((srv) => (
                    <option key={srv} value={srv}>
                      {srv}
                    </option>
                  ))}
                </select>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full border uppercase tracking-wider font-bold ${categoryInfo.badgeClass}`}
                >
                  {categoryInfo.label}
                </span>
              </div>

              {localStats.lastUpdated && (
                <span className="text-[11px] text-slate-400 font-mono">
                  Actualizado: {new Date(localStats.lastUpdated).toLocaleDateString()}
                </span>
              )}
            </div>

            {/* KPI STATS ROW */}
            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-800/80">
              <div className="bg-slate-900/90 rounded-xl p-2 text-center border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-medium">Objetos Guardados</span>
                <span className="text-sm font-black text-white font-mono">
                  {localStats.totalCount.toLocaleString()}
                </span>
              </div>
              <div className="bg-slate-900/90 rounded-xl p-2 text-center border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-medium">Coeficiente Medio</span>
                <span className="text-sm font-black text-amber-300 font-mono">
                  {localStats.averageCoeff}%
                </span>
              </div>
              <div className="bg-slate-900/90 rounded-xl p-2 text-center border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-medium">Oportunidades &gt;150%</span>
                <span className="text-sm font-black text-emerald-400 font-mono">
                  {localStats.profitableCount.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* NAVIGATION TABS */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 rounded-2xl border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setSyncMode("import")}
              className={`flex-1 py-1.5 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                syncMode === "import"
                  ? "bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20 font-black"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Importar JSON</span>
            </button>
            <button
              type="button"
              onClick={() => setSyncMode("collector")}
              className={`flex-1 py-1.5 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                syncMode === "collector"
                  ? "bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20 font-black"
                  : "text-amber-400/80 hover:text-amber-300"
              }`}
            >
              <Code className="w-3.5 h-3.5" />
              <span>Extensión / Script</span>
            </button>
            <button
              type="button"
              onClick={() => setSyncMode("export")}
              className={`flex-1 py-1.5 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                syncMode === "export"
                  ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 font-black"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar & Respaldo</span>
            </button>
          </div>

          {/* SUCCESS FEEDBACK */}
          {syncResult && (
            <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-2xl p-3.5 space-y-1.5 text-xs text-emerald-200 animate-fadeIn">
              <div className="flex items-center gap-2 font-bold text-white text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>¡Coeficientes cargados exitosamente para {syncResult.server}!</span>
              </div>
              <p className="text-slate-300 text-[11px]">
                Se actualizaron <strong>{syncResult.updatedCount.toLocaleString()}</strong> de <strong>{syncResult.totalAvailable.toLocaleString()}</strong> objetos con sus fechas correspondientes.
              </p>
            </div>
          )}

          {/* RESTORE FEEDBACK */}
          {restoreFeedback && (
            <div className="bg-sky-950/40 border border-sky-500/40 rounded-2xl p-3 space-y-1 text-xs text-sky-200 animate-fadeIn">
              <div className="flex items-center gap-2 font-bold text-white">
                <CheckCircle2 className="w-4 h-4 text-sky-400" />
                <span>{restoreFeedback}</span>
              </div>
            </div>
          )}

          {/* EXPORT FEEDBACK */}
          {exportFeedback && (
            <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-2xl p-3 space-y-1 text-xs text-emerald-200 animate-fadeIn">
              <div className="flex items-center gap-2 font-bold text-white">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{exportFeedback}</span>
              </div>
            </div>
          )}

          {/* ERROR FEEDBACK */}
          {errorMsg && (
            <div className="bg-rose-950/40 border border-rose-500/40 rounded-2xl p-3 space-y-1 text-xs text-rose-200 animate-fadeIn">
              <div className="flex items-center gap-2 font-bold text-white">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            </div>
          )}

          {/* 1. IMPORT JSON TAB */}
          {syncMode === "import" && (
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3 animate-fadeIn text-xs">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="font-bold text-white text-sm flex items-center gap-2">
                    <Upload className="w-4 h-4 text-sky-400" />
                    <span>Importar Coeficientes para {selectedServer}</span>
                  </span>
                  <p className="text-slate-400 text-[11px]">
                    Sube el archivo JSON exportado por la extensión o pega el contenido copiado.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-sky-500/20">
                    <FileText className="w-4 h-4 text-slate-950" />
                    <span>Seleccionar archivo .json</span>
                    <input
                      type="file"
                      accept=".json,application/json"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                  <span className="text-[11px] text-slate-500">o pega el texto JSON abajo:</span>
                </div>

                <textarea
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  placeholder={`{\n  "server": "${selectedServer}",\n  "coefficients": [\n    { "itemId": 2411, "coefficient": 185, "dateUpdated": "< 1 mes" },\n    ...\n  ]\n}`}
                  rows={5}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-sky-500 resize-none placeholder-slate-600"
                />
              </div>

              <button
                type="button"
                onClick={handleImportJson}
                disabled={isProcessingJson || !jsonInput.trim()}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-sky-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-40 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>
                  {isProcessingJson
                    ? "Procesando coeficientes..."
                    : `Procesar e Importar Coeficientes para ${selectedServer}`}
                </span>
              </button>
            </div>
          )}

          {/* 2. EXTENSION / SCRIPT TAB */}
          {syncMode === "collector" && (
            <div className="bg-slate-950/80 border border-amber-500/30 rounded-2xl p-4 space-y-3.5 animate-fadeIn text-xs">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="font-bold text-white text-sm flex items-center gap-2">
                    <Code className="w-4 h-4 text-amber-400" />
                    <span>Herramientas de Recolección de Coeficientes</span>
                  </span>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Extrae miles de coeficientes desde DoFocus a ritmo humano con tu sesión abierta.
                  </p>
                </div>
                <a
                  href={`https://dofocus.fr/hdv/${encodeURIComponent(selectedServer)}?categories=equipment&page=1`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-bold text-xs flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Abrir DoFocus HDV</span>
                </a>
              </div>

              {/* Opción A: Extensión de Navegador */}
              <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-xl p-3 text-slate-300 text-[11px] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-emerald-400" />
                    <span>Método 1 (Recomendado): Extensión de Navegador DBHDV</span>
                  </span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-mono font-bold border border-emerald-500/30">
                    1 Clic Directo
                  </span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Añade un widget flotante en DoFocus, extrae los coeficientes automáticamente y puede <strong>enviarlos directamente a tu DBHDV</strong> con 1 solo clic.
                </p>
                <div className="text-[10px] text-slate-400 space-y-1 bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                  <div>1. Abre en tu navegador: <code className="text-emerald-300 font-mono">chrome://extensions</code> (o <code className="text-emerald-300 font-mono">edge://extensions</code>).</div>
                  <div>2. Activa el interruptor <strong>"Modo de desarrollador"</strong> (arriba a la derecha).</div>
                  <div>3. Pulsa <strong>"Cargar descomprimida"</strong> y selecciona la carpeta:</div>
                  <div className="font-mono text-amber-300 bg-slate-950 px-2 py-1 rounded select-all border border-slate-800 mt-0.5">
                    d:\dbhdv\extension_dofocus
                  </div>
                </div>
              </div>

              {/* Opción B: Script Manual para Consola F12 */}
              <div className="space-y-2 pt-1">
                <span className="text-[11px] font-bold text-slate-400 block">
                  Método 2: Ejecutar Script Asistente en la Consola (F12)
                </span>
                <div className="space-y-1.5 bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 text-slate-300 text-[11px]">
                  <div>1. Entra a <a href={`https://dofocus.fr/hdv/${encodeURIComponent(selectedServer)}?categories=equipment&page=1`} target="_blank" rel="noreferrer" className="text-amber-400 underline font-semibold">DoFocus HDV</a> logueado con Google.</div>
                  <div>2. Presiona <kbd className="bg-slate-800 px-1 py-0.5 rounded text-amber-300 font-mono text-[10px]">F12</kbd> &gt; Pestaña <strong>Console</strong>.</div>
                  <div>3. Pulsa el botón de abajo para copiar el script, pégalo y presiona <kbd className="bg-slate-800 px-1 py-0.5 rounded text-amber-300 font-mono text-[10px]">Enter</kbd>.</div>
                </div>

                <button
                  type="button"
                  onClick={handleCopyCollectorScript}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {copyFeedback ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-950" />
                      <span>¡Código copiado al portapapeles! Pégalo en la consola F12</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-slate-950" />
                      <span>Copiar Script Recolector para la Consola (F12)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* 3. EXPORT & BACKUP TAB */}
          {syncMode === "export" && (
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3.5 animate-fadeIn text-xs">
              <div className="space-y-1">
                <span className="font-bold text-white text-sm flex items-center gap-2">
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>Exportar & Respaldo de {selectedServer}</span>
                </span>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Descarga tus coeficientes guardados para compartirlos con compañeros de gremio o guardar una copia de seguridad.
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Coeficientes listos para exportar:</span>
                  <span className="font-bold text-white font-mono">{localStats.totalCount.toLocaleString()} ítems</span>
                </div>
                <button
                  type="button"
                  onClick={handleExportCoefficients}
                  disabled={localStats.totalCount === 0}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-colors disabled:opacity-40 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Descargar Coeficientes de {selectedServer} (.json)</span>
                </button>
              </div>

              {/* RESTORE BACKUP SECTION */}
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Copia de seguridad previa:</span>
                  <span className="font-bold text-slate-300 font-mono">
                    {localStats.hasBackup ? "Disponible" : "Sin copia"}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">
                  Si importaste un JSON incorrecto o deseas volver al estado anterior, puedes restaurar la última copia.
                </p>
                <button
                  type="button"
                  onClick={handleRestoreBackup}
                  disabled={!localStats.hasBackup}
                  className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                  <span>Restaurar Copia Anterior</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearManualEdits}
                  className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  title="Elimina etiquetas 'Manual' residuales permitiendo que todos los ítems muestren su fecha real sincronizada"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>Limpiar marcas 'Manual' en este servidor</span>
                </button>
              </div>
            </div>
          )}

          {/* Footer Close */}
          <div className="pt-1 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};
