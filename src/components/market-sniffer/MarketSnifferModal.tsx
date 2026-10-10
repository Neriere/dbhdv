import React, { useState, useEffect } from 'react';
import {
  Radio,
  X,
  Copy,
  Check,
  Download,
  Terminal,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Server,
  Layers,
  FileCode,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';
import { triggerLivePriceSync } from '../../services/dofusDbService';
import { ModalPortal } from '../common/ModalPortal';
import { MarketSnifferModalProps, PRESET_SERVERS } from './types';
import { generatePythonScript } from './pythonScriptGenerator';
import { generateBatScript } from './batScriptGenerator';

export const MarketSnifferModal: React.FC<MarketSnifferModalProps> = ({
  isOpen,
  onClose,
  activeProfile,
}) => {
  const [selectedServer, setSelectedServer] = useState<string>(activeProfile?.name || 'Draconiros');
  const [isCustomServer, setIsCustomServer] = useState<boolean>(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedBat, setCopiedBat] = useState(false);
  const [activeTab, setActiveTab] = useState<'instructions' | 'bat' | 'script'>('instructions');
  const [downloadSuccessToast, setDownloadSuccessToast] = useState<string | null>(null);
  const [communityTokens, setCommunityTokens] = useState<Record<string, string> | null>(null);
  const [tokensLastCalibrated, setTokensLastCalibrated] = useState<string | null>(null);
  const [isLoadingTokens, setIsLoadingTokens] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      void triggerLivePriceSync(true);
      setIsLoadingTokens(true);
      fetch('/api/tokens')
        .then((res) => res.json())
        .then((data) => {
          if (data && data.success && data.tokens) {
            setCommunityTokens(data.tokens);
            setTokensLastCalibrated(data.last_calibrated || null);
          }
        })
        .catch((err) => {
          console.warn('[MarketSnifferModal] Error consultando tokens comunitarios:', err);
        })
        .finally(() => {
          setIsLoadingTokens(false);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const batchApiUrl = `${currentOrigin}/api/market/batch-update`;
  const updateApiUrl = `${currentOrigin}/api/market/update`;
  const dictApiUrl = `${currentOrigin}/api/market/items-dictionary`;
  const activeServerTarget = (selectedServer || activeProfile?.name || 'Draconiros').trim();
  const suiteScriptUrl = `${currentOrigin}/api/market/suite-script`;
  const itemsDbDownloadUrl = `${currentOrigin}/api/market/download-items-db`;

  const pythonScript = generatePythonScript({
    activeServerTarget,
    batchApiUrl,
    updateApiUrl,
    dictApiUrl,
    currentOrigin,
  });

  const batContent = generateBatScript({
    activeServerTarget,
    currentOrigin,
    suiteScriptUrl,
    itemsDbDownloadUrl,
  });

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(updateApiUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleCopyScript = async () => {
    try {
      const resp = await fetch(`/api/market/suite-script`);
      if (resp.ok) {
        const text = await resp.text();
        navigator.clipboard.writeText(text);
        setCopiedScript(true);
        setTimeout(() => setCopiedScript(false), 2000);
        return;
      }
    } catch {
      // fallback
    }
    navigator.clipboard.writeText(pythonScript);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  const handleCopyBat = () => {
    const crlfBat = batContent.replace(/\r?\n/g, '\r\n');
    navigator.clipboard.writeText(crlfBat);
    setCopiedBat(true);
    setTimeout(() => setCopiedBat(false), 2000);
  };

  const handleDownloadScript = async () => {
    try {
      const resp = await fetch(`/api/market/suite-script`);
      if (resp.ok) {
        const text = await resp.text();
        const blob = new Blob([text], { type: 'text/x-python;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dofus_suite.py`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return;
      }
    } catch {
      // fallback
    }
    const blob = new Blob([pythonScript], { type: 'text/x-python;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dofus_suite.py`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadItemsDb = async () => {
    try {
      const resp = await fetch('/api/market/download-items-db');
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'items_db.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.warn("Items DB download error:", e);
    }
  };

  const handleDownloadCalibrator = async () => {
    try {
      const resp = await fetch('/api/market/calibrator-script');
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
      const text = await resp.text();
      const blob = new Blob([text], { type: 'text/x-python;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'calibrar_token.py';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setDownloadSuccessToast('Descarga completada: calibrar_token.py');
      setTimeout(() => setDownloadSuccessToast(null), 4000);
    } catch (e) {
      console.error("Error al descargar calibrador:", e);
    }
  };

  const handleDownloadBat = async () => {
    try {
      const filename = `dbhdv_suite_${activeServerTarget.toLowerCase().replace(/[^a-z0-9]/g, '_')}.bat`;
      let content = batContent;
      try {
        const resp = await fetch(`/api/market/download-bat?server=${encodeURIComponent(activeServerTarget)}`);
        if (resp.ok) {
          content = await resp.text();
        }
      } catch (e) {
        // Fallback a batContent
      }
      const crlfBat = content.replace(/\r?\n/g, '\r\n');
      const blob = new Blob([crlfBat], { type: 'application/x-bat;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setDownloadSuccessToast(
        `Descarga completada: ${filename} (DBHDV Suite Unificada 3.6).`
      );
      setTimeout(() => setDownloadSuccessToast(null), 5000);
    } catch (e) {
      console.error("Error al descargar BAT:", e);
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-start justify-center py-8 px-3 sm:px-5 overflow-y-auto bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                DBHDV Suite Unificada 3.6 (Sniffer y Calibrador)
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold uppercase tracking-wider">
                  En Vivo y Privado
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Captura cotizaciones HDV en vivo, almacén unificado, historial de ventas y listings activos.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Server Selector Bar */}
        <div className="px-5 py-3.5 bg-slate-950/90 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-xs font-bold text-slate-300">Servidor de sincronización:</span>
          </div>

          <div className="flex items-center gap-2 flex-1 max-w-md">
            {!isCustomServer ? (
              <div className="relative flex-1">
                <select
                  value={selectedServer}
                  onChange={(e) => {
                    if (e.target.value === '__custom__') {
                      setIsCustomServer(true);
                    } else {
                      setSelectedServer(e.target.value);
                    }
                  }}
                  className="w-full bg-slate-900 border border-slate-700 hover:border-amber-500/50 rounded-xl px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-amber-500 appearance-none pr-8 cursor-pointer"
                >
                  {PRESET_SERVERS.map((srv) => (
                    <option key={srv.name} value={srv.name}>
                      {srv.name} ({srv.category})
                    </option>
                  ))}
                  <option value="__custom__">+ Otro servidor (Escribir nombre)...</option>
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            ) : (
              <div className="flex items-center gap-1.5 flex-1">
                <input
                  type="text"
                  value={selectedServer}
                  onChange={(e) => setSelectedServer(e.target.value)}
                  placeholder="Nombre de servidor..."
                  className="flex-1 bg-slate-900 border border-amber-500 rounded-xl px-3 py-1.5 text-xs font-bold text-white focus:outline-none"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setIsCustomServer(false)}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Lista
                </button>
              </div>
            )}

            <span className="text-[11px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20 shrink-0">
              {activeServerTarget}
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-5 pt-3 border-b border-slate-800 bg-slate-950/30 text-xs font-bold overflow-x-auto">
          <button
            onClick={() => setActiveTab('instructions')}
            className={`pb-3 px-3 border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'instructions'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            Guía y Requisitos
          </button>
          <button
            onClick={() => setActiveTab('bat')}
            className={`pb-3 px-3 border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'bat'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode className="w-4 h-4 text-amber-400" />
            Lanzador Windows (.BAT)
          </button>
          <button
            onClick={() => setActiveTab('script')}
            className={`pb-3 px-3 border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'script'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-4 h-4" />
            Script Python (.PY)
          </button>
        </div>

        {/* Download Toast Notification */}
        {downloadSuccessToast && (
          <div className="bg-amber-500/10 border-b border-amber-500/30 px-5 py-2.5 flex items-center justify-between text-xs text-amber-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{downloadSuccessToast}</span>
            </div>
            <button
              onClick={() => setDownloadSuccessToast(null)}
              className="text-slate-400 hover:text-white ml-3"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Modal Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 text-slate-300 text-xs sm:text-sm">
          {activeTab === 'instructions' && (
            <div className="space-y-5">
              {/* Endpoint Card */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-amber-400" /> Endpoint de Ingestión de Precios
                  </span>
                  <span className="text-xs font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    Servidor: {activeServerTarget}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={updateApiUrl}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none select-all"
                  />
                  <button
                    onClick={handleCopyUrl}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedUrl ? '¡Copiado!' : 'Copiar URL'}
                  </button>
                  <button
                    onClick={handleDownloadItemsDb}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-amber-500/20"
                    title="Descargar base de nombres de objetos (items_db.json)"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-400" />
                    items_db.json
                  </button>
                </div>
              </div>

              {/* Requirement Cards */}
              <div className="bg-slate-950 border border-amber-500/20 rounded-2xl p-4 space-y-3">
                <h4 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-2 text-amber-400">
                  <ShieldCheck className="w-4 h-4" /> Requisitos iniciales (Solo 1 vez)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-1.5">
                    <span className="font-bold text-white block">1. Python en tu PC</span>
                    <p className="text-slate-400 text-[11px]">
                      Descarga Python desde <a href="https://www.python.org/downloads/" target="_blank" rel="noreferrer" className="text-amber-400 underline inline-flex items-center gap-0.5">python.org <ExternalLink className="w-2.5 h-2.5" /></a> asegurándote de marcar la casilla <em>"Add Python to PATH"</em> en el instalador.
                    </p>
                    <p className="text-emerald-400 text-[11px] font-semibold">
                      Las dependencias (scapy, requests) se instalan automáticamente.
                    </p>
                  </div>
                  <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-1.5">
                    <span className="font-bold text-white block">2. Controlador Npcap (Requerido en Windows)</span>
                    <p className="text-slate-400 text-[11px]">
                      Permite capturar los paquetes de red de Dofus Unity en tiempo real.
                    </p>
                    <a
                      href="https://npcap.com/#download"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-amber-400 font-bold text-xs hover:underline mt-1"
                    >
                      Descargar Npcap (npcap.com) <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>

              {/* Community Verified Tokens Banner */}
              <div className="bg-slate-950 border border-emerald-500/20 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Tokens Comunitarios Activos (DBHDV Cloud)
                    </span>
                    {isLoadingTokens && (
                      <span className="text-[10px] text-slate-400 font-mono animate-pulse">
                        (Consultando nube...)
                      </span>
                    )}
                  </div>
                  {tokensLastCalibrated && (
                    <span className="text-[11px] text-slate-400 font-mono">
                      Última calibración: <strong className="text-slate-200">{tokensLastCalibrated}</strong>
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5">
                    <span className="text-[10px] text-slate-400 block font-semibold uppercase">Mercadillo</span>
                    <span className="font-mono font-bold text-amber-400 text-sm">{communityTokens?.price_list ? `'${communityTokens.price_list}'` : "'jzn'"}</span>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5">
                    <span className="text-[10px] text-slate-400 block font-semibold uppercase">En Venta (Listings)</span>
                    <span className="font-mono font-bold text-emerald-400 text-sm">{communityTokens?.active_listings ? `'${communityTokens.active_listings}'` : "'ket'"}</span>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5">
                    <span className="text-[10px] text-slate-400 block font-semibold uppercase">Inventario</span>
                    <span className="font-mono font-bold text-cyan-400 text-sm">{communityTokens?.inventory ? `'${communityTokens.inventory}'` : "'isb'"}</span>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5">
                    <span className="text-[10px] text-slate-400 block font-semibold uppercase">Almacén (Banco)</span>
                    <span className="font-mono font-bold text-indigo-400 text-sm">{communityTokens?.storage ? `'${communityTokens.storage}'` : "'hlp'"}</span>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5">
                    <span className="text-[10px] text-slate-400 block font-semibold uppercase">Historial Ventas</span>
                    <span className="font-mono font-bold text-purple-400 text-sm">{communityTokens?.sales_history ? `'${communityTokens.sales_history}'` : "'kyo'"}</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400">
                  Al iniciar el script .bat, se sincronizarán automáticamente estos tokens comunitarios en tu keymap local para que no requieras calibrar manualmente tras cada parche.
                </p>
              </div>

              {/* Step by step download card */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="font-bold text-white text-xs uppercase tracking-wider">
                    Descargar Suite para servidor: <span className="text-amber-400">{activeServerTarget}</span>
                  </h4>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={handleDownloadScript}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors border border-amber-500/20"
                    >
                      <Download className="w-3.5 h-3.5" /> dofus_suite.py
                    </button>
                    <button
                      onClick={handleDownloadBat}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer transition-colors shadow-lg shadow-amber-500/20"
                    >
                      <Download className="w-4 h-4" /> Descargar .BAT (Suite Unificada 3.6)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <div className="bg-slate-900/90 border border-amber-500/20 rounded-xl p-3 space-y-2">
                    <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">
                      Suite Unificada Todo en Uno (12 Opciones)
                    </span>
                    <ul className="space-y-1 text-xs text-slate-300">
                      <li>• <strong>[1-4] Sniffers en Vivo:</strong> Mercadillo HDV, Almacén Unificado, Historial de Ventas y Listings Activos.</li>
                      <li>• <strong>[5-6] Visores Web Locales:</strong> Visualización offline de tu inventario y tus ventas.</li>
                      <li>• <strong>[7-10] Calibradores Automáticos:</strong> Auto-detección interactiva de tokens con 1 solo clic en el juego.</li>
                      <li>• <strong>[11] Sincronización Cloud:</strong> Descarga y subida de tokens verificados con la comunidad de DBHDV.</li>
                    </ul>
                  </div>

                  <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2">
                    <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                      ¿Cómo funciona tras cada mantenimiento semanal?
                    </span>
                    <p className="text-xs text-slate-400">
                      La suite intenta primero descargar los tokens actualizados desde DBHDV Cloud. Si eres el primer usuario en conectarte tras un parche de Ankama, puedes calibrar el token con la opción <strong>[10]</strong> (o <strong>[7-9]</strong>) en el menú del .bat y compartirlo con la comunidad para que los demás lo reciban al instante.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'bat' && (
            <div className="space-y-4">
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-amber-400" /> Lanzador Windows (.BAT) &mdash; {activeServerTarget}
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Ejecución directa en Windows. Configurado para sincronizar con {activeServerTarget}.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyBat}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
                  >
                    {copiedBat ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedBat ? '¡Código Copiado!' : 'Copiar Código .BAT'}
                  </button>
                  <button
                    onClick={handleDownloadBat}
                    className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-lg shadow-amber-500/20"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Descargar .BAT
                  </button>
                </div>
              </div>

              <pre className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-[360px] select-all leading-relaxed">
                {batContent}
              </pre>
            </div>
          )}

          {activeTab === 'script' && (
            <div className="space-y-4">
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-emerald-400" /> Código Fuente Python (dofus_suite.py) &mdash; {activeServerTarget}
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Suite Unificada de captura en vivo, visor visual offline de almacén e historial, y calibrador interactivo.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyScript}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
                  >
                    {copiedScript ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedScript ? '¡Código Copiado!' : 'Copiar Código .py'}
                  </button>
                  <button
                    onClick={handleDownloadScript}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-lg shadow-emerald-600/20"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Descargar dofus_suite.py
                  </button>
                </div>
              </div>

              <pre className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-[380px] select-all leading-relaxed">
                {pythonScript}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-500">
          <span>Servidor seleccionado: <strong className="text-amber-400">{activeServerTarget}</strong></span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  </ModalPortal>
);
};


export default MarketSnifferModal;
