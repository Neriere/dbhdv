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
} from "../services/dofusDbService";

export const DofusImporter: React.FC<{
  onSyncComplete?: (items: DofusItem[]) => void;
}> = ({ onSyncComplete }) => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(getSyncStatus());
  const [syncSettings, setSyncSettings] =
    useState<SyncSettings>(getSyncSettings());
  const [itemsCount, setItemsCount] = useState<number>(0);
  const [recipesCount, setRecipesCount] = useState<number>(0);

  useEffect(() => {
    initializeDatabase()
      .then(() => {
        setSyncStatus(getSyncStatus());
        setSyncSettings(getSyncSettings());
      })
      .catch((error) => {
        console.error("No se pudo inicializar la base local:", error);
      });
  }, []);

  useEffect(() => {
    const items = getImportedItems();
    setItemsCount(items.length);
    const recipes = getStoredRecipes();
    setRecipesCount(Object.keys(recipes).length);
  }, [syncStatus]);

  const handleStartImport = async () => {
    try {
      const result = await performFullItemImport((status) => {
        setSyncStatus(status);
      });
      setItemsCount(result.items.length);
      const recipes = getStoredRecipes();
      setRecipesCount(Object.keys(recipes).length);
      if (onSyncComplete) onSyncComplete(result.items);
    } catch (e) {
      console.error("Import failed", e);
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

  return (
    <div className="space-y-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-amber-400" />
              Base de Datos Local
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Sincroniza objetos y recetas desde la API oficial de DofusDB en tu archivo local SQLite.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportDatabase}
              className="px-4 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold text-xs flex items-center gap-2 transition-all shrink-0"
            >
              <Database className="w-4 h-4 text-amber-400" />
              <span>Exportar .db</span>
            </button>
            <button
              onClick={handleStartImport}
              disabled={syncStatus.isLoading}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all shrink-0 disabled:opacity-50"
            >
              {syncStatus.isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Importando...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Importar Ahora</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-0.5">
          <div className="text-xs font-bold text-white">
            Sincronización periódica automática
          </div>
          <p className="text-xs text-slate-400">
            Revisión en segundo plano cada {syncSettings.intervalDays} días.
          </p>
        </div>
        <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-300">
          <input
            type="checkbox"
            checked={syncSettings.enabled}
            onChange={(event) => {
              void handleToggleAutoSync(event.target.checked);
            }}
            className="rounded border-slate-700 text-amber-500 focus:ring-0 bg-slate-950"
          />
          <span>{syncSettings.enabled ? "Activa" : "Pausada"}</span>
        </label>
      </div>

      <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-900/30 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-300/90 leading-relaxed font-medium">
          Se omiten cosméticos, apariencias de veteranía y objetos de misión para mantener la base liviana y enfocada 100% en economía y crafteo.
        </div>
      </div>

      {syncStatus.isLoading && (
        <div className="p-5 rounded-2xl bg-slate-900 border border-amber-500/40 space-y-3 animate-pulse shadow-lg">
          <div className="flex items-center justify-between text-xs font-mono text-amber-400">
            <span className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
              {syncStatus.progressMessage}
            </span>
            <span>{syncStatus.totalImported} ítems procesados</span>
          </div>
          <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
            <div className="h-full bg-amber-500 w-2/3 animate-pulse"></div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400 uppercase font-black tracking-wider">
              Objetos Guardados
            </span>
            <Layers className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black font-mono text-white">
            {itemsCount > 0 ? itemsCount : syncStatus.totalImported}
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
            {recipesCount > 0 ? recipesCount : syncStatus.recipesCount || 0}
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
            {syncStatus.equipablesCount}
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
            {syncStatus.consumablesCount + syncStatus.resourcesCount}
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
            {syncStatus.cosmeticsOmittedCount}
          </div>
          <p className="text-[11px] text-slate-500">Cosméticos omitidos</p>
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-400" />
          <span>
            Última sincronización:{" "}
            <strong className="text-slate-200">
              {syncStatus.lastSyncTimestamp
                ? new Date(syncStatus.lastSyncTimestamp).toLocaleString()
                : "Sin datos importados"}
            </strong>
          </span>
        </div>
        <span className="text-[11px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
          SQLite Local (Turso DB)
        </span>
      </div>
    </div>
  );
};
