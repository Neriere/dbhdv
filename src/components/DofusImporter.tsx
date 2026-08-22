import React, { useState, useEffect } from "react";
import {
  Download,
  RefreshCw,
  Database,
  ShieldAlert,
  CheckCircle2,
  Layers,
  Filter,
  Sparkles,
  AlertCircle,
  Wrench,
  Check,
  Server,
  ArrowRight,
  Upload,
  FileJson,
  Zap,
} from "lucide-react";
import { SyncStatus, DofusItem, SyncSettings } from "../types";
import {
  getSyncSettings,
  getSyncStatus,
  initializeDatabase,
  performFullItemImport,
  getImportedItems,
  getStoredRecipes,
  saveAutomaticSyncSettings,
  fetchLiveSyncStatus,
  resetLocalSyncStatus,
  importFullDatabaseJSON,
  triggerFastSeedDatabase,
} from "../services/dofusDbService";

export const DofusImporter: React.FC<{
  onSyncComplete?: (items: DofusItem[]) => void;
}> = ({ onSyncComplete }) => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(getSyncStatus());
  const [syncSettings, setSyncSettings] =
    useState<SyncSettings>(getSyncSettings());
  const [itemsCount, setItemsCount] = useState<number>(0);
  const [recipesCount, setRecipesCount] = useState<number>(0);
  const [justCompleted, setJustCompleted] = useState<boolean>(false);
  const [isFastSeeding, setIsFastSeeding] = useState<boolean>(false);

  useEffect(() => {
    // Immediately fetch real-time sync status from server to show last sync date & metrics accurately
    fetchLiveSyncStatus().then((status) => {
      if (status) {
        setSyncStatus({ ...status });
      }
    });

    initializeDatabase()
      .then(() => {
        setSyncStatus(getSyncStatus());
        setSyncSettings(getSyncSettings());
        const items = getImportedItems();
        setItemsCount(items.length);
        const recipes = getStoredRecipes();
        setRecipesCount(Object.keys(recipes).length);
      })
      .catch((error) => {
        console.error("No se pudo inicializar la base local:", error);
      });
  }, []);

  useEffect(() => {
    const handleDbUpdated = () => {
      setSyncStatus(getSyncStatus());
      const items = getImportedItems();
      setItemsCount(items.length);
      const recipes = getStoredRecipes();
      setRecipesCount(Object.keys(recipes).length);
    };

    window.addEventListener("dofus_database_updated", handleDbUpdated);
    return () => {
      window.removeEventListener("dofus_database_updated", handleDbUpdated);
    };
  }, []);

  useEffect(() => {
    const items = getImportedItems();
    setItemsCount(items.length);
    const recipes = getStoredRecipes();
    setRecipesCount(Object.keys(recipes).length);
  }, [syncStatus]);

  const handleFastSeed = async () => {
    setIsFastSeeding(true);
    setJustCompleted(false);
    try {
      const result = await triggerFastSeedDatabase(true, (status) => {
        setSyncStatus({ ...status });
      });
      setItemsCount(result.items.length);
      const recipes = getStoredRecipes();
      setRecipesCount(Object.keys(recipes).length);
      setJustCompleted(true);
      if (onSyncComplete) onSyncComplete(result.items);
    } catch (e) {
      console.error("Fast seed failed:", e);
      alert(`Error al sembrar la base de datos en Turso: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsFastSeeding(false);
    }
  };

  const handleStartImport = async () => {
    setJustCompleted(false);
    try {
      const result = await performFullItemImport((status) => {
        setSyncStatus({ ...status });
      });
      setItemsCount(result.items.length);
      const recipes = getStoredRecipes();
      setRecipesCount(Object.keys(recipes).length);
      setJustCompleted(true);
      if (onSyncComplete) onSyncComplete(result.items);
    } catch (e) {
      console.error("Import failed", e);
      alert(
        `No se pudo completar el rastreo en vivo de DofusDB (${e instanceof Error ? e.message : String(e)}). Puedes usar el botón verde "Sincronizar Turso (Rápido)" para cargar la base completa instantáneamente.`
      );
    }
  };

  const handleToggleAutoSync = async (enabled: boolean) => {
    try {
      const updated = await saveAutomaticSyncSettings({
        ...syncSettings,
        enabled,
      });
      setSyncSettings(updated);
      setSyncStatus(getSyncStatus());
    } catch (error) {
      console.error(
        "No se pudo actualizar la sincronización automática:",
        error,
      );
    }
  };

  const handleExportDatabase = () => {
    window.location.href = "/api/local-db/export-database";
  };

  const handleExportJson = () => {
    window.location.href = "/api/local-db/export-json";
  };

  const handleImportJson = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        await importFullDatabaseJSON(parsed);
        alert("¡Base de datos JSON importada con éxito!");
      } catch (err) {
        console.error("Error al importar backup JSON:", err);
        alert("No se pudo importar el archivo JSON.");
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsText(file);
  };

  const handleResetStatus = async () => {
    try {
      const reset = await resetLocalSyncStatus();
      setSyncStatus({ ...reset });
      setJustCompleted(false);
    } catch (e) {
      console.error("Failed to reset sync status", e);
    }
  };

  const progress = Math.min(
    100,
    Math.max(
      0,
      typeof syncStatus.progressPercent === "number"
        ? syncStatus.progressPercent
        : syncStatus.isLoading
        ? 5
        : 100,
    ),
  );

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-amber-400" />
              Base de Datos Local (SQLite / Turso)
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Sincroniza y almacena objetos, recetas y estadísticas en la base de datos persistente local de alta velocidad.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {syncStatus.isLoading && (
              <button
                onClick={handleResetStatus}
                title="Desbloquear si la conexión se interrumpió"
                className="px-3 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800 text-rose-300 font-bold text-xs flex items-center gap-1.5 transition-all shrink-0"
              >
                <span>Desbloquear</span>
              </button>
            )}
            <button
              onClick={handleExportJson}
              title="Descargar copia de seguridad completa en formato JSON (objetos, recetas y precios)"
              className="px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-all shrink-0"
            >
              <FileJson className="w-4 h-4 text-emerald-400" />
              <span>Exportar JSON</span>
            </button>
            <label
              title="Restaurar base de datos u objetos desde un archivo JSON"
              className="px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
            >
              <Upload className="w-4 h-4 text-cyan-400" />
              <span>Importar JSON</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImportJson}
                className="hidden"
              />
            </label>
            <button
              onClick={handleExportDatabase}
              title="Descargar archivo binario SQLite (.db)"
              className="px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-all shrink-0"
            >
              <Database className="w-4 h-4 text-amber-400" />
              <span>.db</span>
            </button>
            <button
              onClick={handleFastSeed}
              disabled={syncStatus.isLoading || isFastSeeding}
              title="Sincronizar y poblar Turso instantáneamente con el paquete completo de objetos y recetas"
              className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md transition-all shrink-0 ${
                syncStatus.isLoading || isFastSeeding
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20 active:scale-95 border border-emerald-400/30"
              }`}
            >
              {isFastSeeding ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-300" />
                  <span>Sembrando Turso...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 text-emerald-200" />
                  <span>Sincronizar Turso (Rápido)</span>
                </>
              )}
            </button>
            <button
              onClick={handleStartImport}
              disabled={syncStatus.isLoading || isFastSeeding}
              title="Descargar y rastrear en vivo directamente desde api.dofusdb.fr"
              className={`px-5 py-2.5 rounded-xl font-black text-xs flex items-center gap-2 shadow-lg transition-all shrink-0 ${
                syncStatus.isLoading
                  ? "bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-700"
                  : "bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20 active:scale-95"
              }`}
            >
              {syncStatus.isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                  <span>Sincronizando ({progress}%)...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Rastreo Completo DofusDB</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Real-time Import Progress Bar */}
      {syncStatus.isLoading && (
        <div className="p-5 rounded-2xl bg-slate-900 border-2 border-amber-500/50 space-y-3.5 shadow-xl animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
                <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />
              </div>
              <div>
                <span className="text-xs font-black text-white flex items-center gap-1.5">
                  {syncStatus.currentStep || "Sincronizando con DofusDB"}
                </span>
                <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                  {syncStatus.progressMessage || "Procesando datos..."}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 shrink-0 self-end sm:self-center font-mono">
              <span className="text-xs text-slate-400 font-bold">
                {syncStatus.totalImported.toLocaleString()} ítems
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 font-black text-xs">
                {progress}%
              </span>
            </div>
          </div>

          {/* Stepped Visual Progress Bar */}
          <div className="space-y-1.5">
            <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-400 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${Math.max(5, progress)}%` }}
              />
            </div>
            
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold px-1">
              <span className={progress >= 20 ? "text-amber-400" : ""}>1. Objetos</span>
              <span className={progress >= 60 ? "text-amber-400" : ""}>2. Recetas</span>
              <span className={progress >= 90 ? "text-emerald-400" : ""}>3. Indexado SQLite</span>
            </div>
          </div>
        </div>
      )}

      {/* Success Notification after import */}
      {!syncStatus.isLoading && justCompleted && (
        <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2.5 text-xs text-emerald-300 font-bold">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>
              ¡Sincronización completada con éxito! Se han guardado {itemsCount.toLocaleString()} objetos y {recipesCount.toLocaleString()} recetas en tu base local.
            </span>
          </div>
          <button
            onClick={() => setJustCompleted(false)}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-bold px-2 py-1"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Automatic Sync Config */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-0.5">
          <div className="text-xs font-bold text-white">
            Sincronización periódica automática
          </div>
          <p className="text-xs text-slate-400">
            Revisión en segundo plano cada {syncSettings.intervalDays} días.
          </p>
        </div>
        <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={syncSettings.enabled}
            onChange={(event) => {
              void handleToggleAutoSync(event.target.checked);
            }}
            className="rounded border-slate-700 text-amber-500 focus:ring-0 bg-slate-950"
          />
          <span className={syncSettings.enabled ? "text-emerald-400 font-black" : "text-slate-500 font-medium"}>
            {syncSettings.enabled ? "Activa" : "Pausada"}
          </span>
        </label>
      </div>

      <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-900/30 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-300/90 leading-relaxed font-medium">
          Se omiten cosméticos, apariencias de veteranía y objetos de misión para mantener la base liviana y enfocada 100% en economía y crafteo.
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400 uppercase font-black tracking-wider">
              Objetos Guardados
            </span>
            <Layers className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black font-mono text-white">
            {(itemsCount > 0 ? itemsCount : syncStatus.totalImported).toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-500">En base local</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400 uppercase font-black tracking-wider">
              Recetas
            </span>
            <Wrench className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black font-mono text-amber-400">
            {(recipesCount > 0 ? recipesCount : syncStatus.recipesCount || 0).toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-500">Recetas indexadas</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400 uppercase font-black tracking-wider">
              Equipables
            </span>
            <Filter className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black font-mono text-emerald-400">
            {syncStatus.equipablesCount.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-500">Armas y equipamiento</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400 uppercase font-black tracking-wider">
              Recursos
            </span>
            <Sparkles className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-black font-mono text-sky-400">
            {(syncStatus.consumablesCount + syncStatus.resourcesCount).toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-500">
            Ingredientes y consumibles
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400 uppercase font-black tracking-wider">
              Filtrados
            </span>
            <CheckCircle2 className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-2xl font-black font-mono text-slate-400">
            {syncStatus.cosmeticsOmittedCount.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-500">Cosméticos omitidos</p>
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-400" />
          <span>
            Última sincronización:{" "}
            <strong className="text-slate-200 font-mono">
              {syncStatus.lastSyncTimestamp
                ? new Date(syncStatus.lastSyncTimestamp).toLocaleString()
                : "Sin datos importados"}
            </strong>
          </span>
        </div>
        <span className="text-[11px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 flex items-center gap-1.5">
          <Server className="w-3.5 h-3.5" />
          SQLite Local (Turso DB)
        </span>
      </div>
    </div>
  );
};
