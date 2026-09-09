import React, { useState, useRef } from 'react';
import {
  Download,
  Upload,
  Database,
  FileCheck,
  AlertTriangle,
  CheckCircle2,
  X,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  Layers,
  Vault,
  Coins,
  Activity,
} from 'lucide-react';
import {
  downloadBackupFile,
  generateBackupData,
  importBackupJSON,
  BackupImportSummary,
} from '../../services/backupService';
import { getStoredMarketPrices, getStoredBankInventory } from '../../services/dofusDbService';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  showToast?: (message: string) => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({
  isOpen,
  onClose,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [selectedFileContent, setSelectedFileContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [fileStats, setFileStats] = useState<{
    pricesCount: number;
    bankCount: number;
    coeffCount: number;
    exportedAt: string;
  } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<BackupImportSummary | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Real-time local stats for export tab
  const currentPrices = getStoredMarketPrices();
  const currentBank = getStoredBankInventory();
  const pricesCount = Object.keys(currentPrices).length;
  const bankCount = currentBank.length;

  const handleExport = () => {
    downloadBackupFile();
    if (showToast) {
      showToast('Copia de seguridad descargada correctamente');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setImportResult(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        setSelectedFileContent(text);
        const parsed = JSON.parse(text);
        const data = parsed.data || parsed;

        const pCount = data.prices ? Object.keys(data.prices).length : 0;
        const bCount = Array.isArray(data.bankInventory) ? data.bankInventory.length : 0;
        let cCount = 0;
        if (data.crushingCoefficients && typeof data.crushingCoefficients === 'object') {
          for (const map of Object.values(data.crushingCoefficients)) {
            if (map && typeof map === 'object') {
              cCount += Object.keys(map).length;
            }
          }
        }

        setFileStats({
          pricesCount: pCount,
          bankCount: bCount,
          coeffCount: cCount,
          exportedAt: parsed.exportedAt || 'Fecha desconocida',
        });
      } catch (err) {
        setErrorMsg('El archivo seleccionado no es un formato JSON válido de DBHDV.');
        setSelectedFileContent(null);
        setFileStats(null);
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteImport = async () => {
    if (!selectedFileContent) return;

    setIsImporting(true);
    setErrorMsg(null);

    try {
      const summary = await importBackupJSON(selectedFileContent, importMode);
      setImportResult(summary);
      if (showToast) {
        showToast(summary.message);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al importar la copia de seguridad.';
      setErrorMsg(msg);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Copias de Seguridad (Backup)
              </h2>
              <p className="text-xs text-slate-400">
                Guarda y restaura todos tus precios, inventario de banco y coeficientes
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-slate-800 px-6 bg-slate-900/50">
          <button
            type="button"
            onClick={() => {
              setActiveTab('export');
              setErrorMsg(null);
            }}
            className={`flex items-center gap-2 py-3 px-4 text-xs sm:text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'export'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Download className="w-4 h-4" />
            Exportar / Descargar
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('import');
              setErrorMsg(null);
            }}
            className={`flex items-center gap-2 py-3 px-4 text-xs sm:text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'import'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-4 h-4" />
            Importar / Restaurar
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {activeTab === 'export' ? (
            <div className="space-y-5">
              <div className="rounded-xl bg-slate-950/60 border border-slate-800/80 p-4 space-y-3">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                  Resumen de datos a respaldar:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-3">
                    <Coins className="w-5 h-5 text-amber-400 shrink-0" />
                    <div>
                      <span className="text-base font-bold font-mono text-white block">
                        {pricesCount.toLocaleString()}
                      </span>
                      <span className="text-[11px] text-slate-400 font-medium">Precios de HDV</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-3">
                    <Vault className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div>
                      <span className="text-base font-bold font-mono text-white block">
                        {bankCount.toLocaleString()}
                      </span>
                      <span className="text-[11px] text-slate-400 font-medium">Ítems en Banco</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-3 col-span-2 sm:col-span-1">
                    <Activity className="w-5 h-5 text-purple-400 shrink-0" />
                    <div>
                      <span className="text-base font-bold font-mono text-white block">
                        Completo
                      </span>
                      <span className="text-[11px] text-slate-400 font-medium">Rompedora & Listas</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-200">
                <ShieldCheck className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <p>
                  El archivo generado contiene una instantánea JSON completa compatible con cualquier navegador. Podrás restaurarlo en cualquier momento o trasladarlo a otro dispositivo.
                </p>
              </div>

              <button
                type="button"
                onClick={handleExport}
                className="w-full py-3.5 px-5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2.5 transition-all cursor-pointer"
              >
                <Download className="w-5 h-5" />
                <span>Descargar Copia de Seguridad (.json)</span>
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {/* File Selector */}
              <input
                type="file"
                ref={fileInputRef}
                accept=".json"
                onChange={handleFileChange}
                className="hidden"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-amber-500/60 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-slate-950/40 hover:bg-slate-950/80 group"
              >
                <Upload className="w-8 h-8 text-slate-400 group-hover:text-amber-400 mx-auto mb-2 transition-colors" />
                <span className="text-sm font-semibold text-slate-200 block">
                  {fileName ? fileName : 'Haz clic para seleccionar o arrastra tu archivo .json'}
                </span>
                <span className="text-xs text-slate-500 mt-1 block">
                  Archivos de copia de seguridad generados por DBHDV
                </span>
              </div>

              {errorMsg && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {fileStats && (
                <div className="rounded-xl bg-slate-950/80 border border-slate-800 p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
                    <span className="text-slate-400 font-medium">Fecha del respaldo:</span>
                    <span className="text-slate-200 font-mono font-semibold">
                      {new Date(fileStats.exportedAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                      <span className="text-amber-400 font-bold font-mono block">
                        {fileStats.pricesCount.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-slate-400">Precios HDV</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                      <span className="text-emerald-400 font-bold font-mono block">
                        {fileStats.bankCount.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-slate-400">Ítems Banco</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                      <span className="text-purple-400 font-bold font-mono block">
                        {fileStats.coeffCount.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-slate-400">Coeficientes</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Mode Selector */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                  Método de Restauración:
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                      importMode === 'merge'
                        ? 'bg-amber-500/10 border-amber-500/50 text-white'
                        : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      value="merge"
                      checked={importMode === 'merge'}
                      onChange={() => setImportMode('merge')}
                      className="mt-0.5 text-amber-500 focus:ring-amber-500"
                    />
                    <div className="text-xs">
                      <span className="font-bold block text-slate-200">Combinar (Merge)</span>
                      <span className="text-[11px] text-slate-400">
                        Conserva datos existentes y añade los del archivo
                      </span>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                      importMode === 'replace'
                        ? 'bg-rose-500/10 border-rose-500/50 text-white'
                        : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      value="replace"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                      className="mt-0.5 text-rose-500 focus:ring-rose-500"
                    />
                    <div className="text-xs">
                      <span className="font-bold block text-slate-200">Sobrescribir (Replace)</span>
                      <span className="text-[11px] text-slate-400">
                        Reemplaza completamente los datos actuales
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {importResult && (
                <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span>{importResult.message}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={!selectedFileContent || isImporting}
                className={`w-full py-3.5 px-5 rounded-xl font-bold text-sm shadow-lg flex items-center justify-center gap-2.5 transition-all cursor-pointer ${
                  !selectedFileContent || isImporting
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-amber-500/20'
                }`}
              >
                <Upload className="w-5 h-5" />
                <span>
                  {isImporting ? 'Restaurando copia...' : 'Restaurar Copia de Seguridad'}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
